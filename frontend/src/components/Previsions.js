import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

// Configuration des APIs météo externes (à personnaliser)
const METEO_CONFIG = {
  // OpenWeatherMap - API gratuite jusqu'à 1000 appels/jour
  openWeatherMap: {
    baseUrl: 'https://api.openweathermap.org/data/2.5',
    apiKey: process.env.REACT_APP_OPENWEATHER_API_KEY || '',
    enabled: false
  },
  // Météo France - API officielle
  meteoFrance: {
    baseUrl: 'https://public-api.meteofrance.fr/public',
    apiKey: process.env.REACT_APP_METEOFRANCE_API_KEY || '',
    enabled: false
  },
  // Open-Meteo - API gratuite sans clé
  openMeteo: {
    baseUrl: 'https://api.open-meteo.com/v1',
    enabled: true // Activé par défaut car pas besoin de clé
  }
};

function Previsions() {
  const [loading, setLoading] = useState(true);
  const [recoltes, setRecoltes] = useState([]);
  const [arbres, setArbres] = useState([]);
  const [productionHistorique, setProductionHistorique] = useState([]);
  const [previsions, setPrevisions] = useState(null);
  const [selectedParcelle, setSelectedParcelle] = useState('all');
  const [parcelles, setParcelles] = useState([]);
  
  // État pour les données météo externes
  const [meteoData, setMeteoData] = useState(null);
  const [meteoLoading, setMeteoLoading] = useState(false);
  const [showMeteoPanel, setShowMeteoPanel] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (recoltes.length > 0) {
      calculerPrevisions();
    }
  }, [recoltes, selectedParcelle]);

  // Charger les données météo depuis Open-Meteo (API gratuite)
  const loadMeteoData = async (latitude, longitude) => {
    if (!latitude || !longitude) return;
    
    setMeteoLoading(true);
    try {
      // Open-Meteo API - gratuite et sans clé
      const response = await axios.get(`${METEO_CONFIG.openMeteo.baseUrl}/forecast`, {
        params: {
          latitude,
          longitude,
          daily: 'temperature_2m_max,temperature_2m_min,precipitation_sum,soil_temperature_6cm_max',
          timezone: 'Europe/Paris',
          forecast_days: 14
        }
      });
      
      setMeteoData({
        source: 'Open-Meteo',
        daily: response.data.daily,
        location: { latitude, longitude }
      });
    } catch (error) {
      console.error('Erreur chargement météo:', error);
      setMeteoData(null);
    }
    setMeteoLoading(false);
  };

  // Charger les données historiques météo pour analyse de corrélation
  const loadHistoricalMeteo = async (latitude, longitude, startDate, endDate) => {
    try {
      const response = await axios.get(`${METEO_CONFIG.openMeteo.baseUrl}/archive`, {
        params: {
          latitude,
          longitude,
          start_date: startDate,
          end_date: endDate,
          daily: 'temperature_2m_mean,precipitation_sum,soil_temperature_6cm_mean',
          timezone: 'Europe/Paris'
        }
      });
      return response.data;
    } catch (error) {
      console.error('Erreur données météo historiques:', error);
      return null;
    }
  };

  const loadData = async () => {
    try {
      const [recoltesRes, arbresRes, parcellesRes] = await Promise.all([
        axios.get(`${API_URL}/recoltes`),
        axios.get(`${API_URL}/arbres`),
        axios.get(`${API_URL}/parcelles`)
      ]);
      
      setRecoltes(recoltesRes.data);
      setArbres(arbresRes.data);
      setParcelles(parcellesRes.data);
      
      // Si une parcelle a des coordonnées, charger les données météo
      if (parcellesRes.data.length > 0) {
        const firstParcelle = parcellesRes.data[0];
        if (firstParcelle.coordinates && firstParcelle.coordinates.length > 0) {
          const center = firstParcelle.coordinates[0];
          loadMeteoData(center[0], center[1]);
        }
      }
      
      setLoading(false);
    } catch (error) {
      console.error('Erreur:', error);
      setLoading(false);
    }
  };

  const calculerPrevisions = () => {
    // Filtrer les récoltes par parcelle si nécessaire
    let recoltesFiltered = recoltes;
    if (selectedParcelle !== 'all') {
      recoltesFiltered = recoltes.filter(r => r.parcelle_id === parseInt(selectedParcelle));
    }

    // Regrouper par année
    const productionParAnnee = {};
    recoltesFiltered.forEach(recolte => {
      const annee = new Date(recolte.date_recolte).getFullYear();
      if (!productionParAnnee[annee]) {
        productionParAnnee[annee] = {
          annee,
          production: 0,
          nbRecoltes: 0
        };
      }
      productionParAnnee[annee].production += parseFloat(recolte.poids_grammes || 0) / 1000;
      productionParAnnee[annee].nbRecoltes += 1;
    });

    const historique = Object.values(productionParAnnee)
      .sort((a, b) => a.annee - b.annee)
      .map(item => ({
        ...item,
        production: parseFloat(item.production.toFixed(2))
      }));

    setProductionHistorique(historique);

    if (historique.length >= 2) {
      // Calcul des prévisions avec régression linéaire simple
      const n = historique.length;
      const sumX = historique.reduce((sum, item, idx) => sum + idx, 0);
      const sumY = historique.reduce((sum, item) => sum + item.production, 0);
      const sumXY = historique.reduce((sum, item, idx) => sum + (idx * item.production), 0);
      const sumX2 = historique.reduce((sum, item, idx) => sum + (idx * idx), 0);

      const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
      const intercept = (sumY - slope * sumX) / n;

      // Prévision pour l'année prochaine
      const derniereAnnee = historique[historique.length - 1].annee;
      const prochainIdx = n;
      const previsionProchaine = slope * prochainIdx + intercept;

      // Tendance
      const tendance = slope > 0 ? 'hausse' : slope < 0 ? 'baisse' : 'stable';
      const tauxCroissance = historique.length > 1
        ? ((historique[historique.length - 1].production - historique[0].production) / historique[0].production) * 100
        : 0;

      // Production moyenne
      const productionMoyenne = sumY / n;

      // Écart type pour calculer la confiance
      const variance = historique.reduce((sum, item) => {
        return sum + Math.pow(item.production - productionMoyenne, 2);
      }, 0) / n;
      const ecartType = Math.sqrt(variance);

      // Intervalle de confiance (Â±1.96 * écart-type pour 95%)
      const margeErreur = 1.96 * ecartType;

      // Prévisions pour les 3 prochaines années
      const previsionsAnnuelles = [];
      for (let i = 1; i <= 3; i++) {
        const idx = n + i - 1;
        const prevision = slope * idx + intercept;
        previsionsAnnuelles.push({
          annee: derniereAnnee + i,
          production: Math.max(0, parseFloat(prevision.toFixed(2))),
          min: Math.max(0, parseFloat((prevision - margeErreur).toFixed(2))),
          max: parseFloat((prevision + margeErreur).toFixed(2)),
          type: 'prevision'
        });
      }

      // Calculer le potentiel maximum basé sur les arbres
      const arbresFiltered = selectedParcelle !== 'all' 
        ? arbres.filter(a => a.parcelle_id === parseInt(selectedParcelle))
        : arbres;
      
      const arbresProductifs = arbresFiltered.filter(a => a.etat_sanitaire  === 'Bon' || a.etat_sanitaire  === 'Moyen').length;
      const productionMoyenneParArbre = arbresProductifs > 0 
        ? productionMoyenne / arbresProductifs 
        : 0;
      const potentielMax = arbresFiltered.length * productionMoyenneParArbre * 1.5; // 150% de la moyenne

      setPrevisions({
        tendance,
        tauxCroissance: parseFloat(tauxCroissance.toFixed(1)),
        productionMoyenne: parseFloat(productionMoyenne.toFixed(2)),
        previsionProchaine: Math.max(0, parseFloat(previsionProchaine.toFixed(2))),
        previsionsAnnuelles,
        potentielMax: parseFloat(potentielMax.toFixed(2)),
        confianceModele: Math.min(100, (historique.length / 5) * 100), // Plus de données = plus de confiance
        arbresProductifs,
        totalArbres: arbresFiltered.length
      });
    } else {
      setPrevisions({
        tendance: 'insuffisant',
        message: 'Pas assez de données historiques (minimum 2 années requises)'
      });
    }
  };

  const getTendanceIcon = (tendance) => {
    switch(tendance) {
      case 'hausse': return '📈';
      case 'baisse': return '📉';
      case 'stable': return '➡️';
      default: return '❓';
    }
  };

  const getTendanceColor = (tendance) => {
    switch(tendance) {
      case 'hausse': return '#27ae60';
      case 'baisse': return '#e74c3c';
      case 'stable': return '#f39c12';
      default: return '#95a5a6';
    }
  };

  if (loading) {
    return <div className="loading">Chargement des prévisions...</div>;
  }

  // Combiner historique et prévisions pour le graphique
  const donneesGraphique = [
    ...productionHistorique.map(item => ({ ...item, type: 'historique' })),
    ...(previsions?.previsionsAnnuelles || [])
  ];

  return (
    <div className="page-container">
      <div className="page-header">
        <h2>🔍® Prévisions de production</h2>
      </div>

      {/* Filtre par parcelle */}
      <div style={{ marginBottom: '2rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <strong>Analyse pour :</strong>
        <button 
          className={`btn ${selectedParcelle === 'all' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setSelectedParcelle('all')}
          style={{ padding: '0.5rem 1rem' }}
        >
          Toutes les parcelles
        </button>
        {parcelles.map(parcelle => (
          <button 
            key={parcelle.id}
            className={`btn ${selectedParcelle === parcelle.id ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setSelectedParcelle(parcelle.id)}
            style={{ padding: '0.5rem 1rem' }}
          >
            {parcelle.nom}
          </button>
        ))}
      </div>

      {previsions?.tendance === 'insuffisant' ? (
        <div style={{
          background: '#fff3cd',
          color: '#856404',
          padding: '2rem',
          borderRadius: '12px',
          textAlign: 'center',
          border: '2px solid #ffc107'
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📊</div>
          <h3>Données insuffisantes</h3>
          <p style={{ margin: '1rem 0' }}>{previsions.message}</p>
          <p style={{ fontSize: '0.9rem', opacity: 0.8 }}>
            Enregistrez des récoltes sur au moins 2 années pour obtenir des prévisions.
          </p>
        </div>
      ) : previsions ? (
        <>
          {/* Indicateurs clés */}
          <div className="card-grid" style={{ marginBottom: '2rem' }}>
            <div className="card">
              <div className="card-title">Tendance</div>
              <div style={{ fontSize: '3rem', margin: '0.5rem 0' }}>
                {getTendanceIcon(previsions.tendance)}
              </div>
              <div style={{ 
                fontSize: '1.5rem', 
                fontWeight: 'bold',
                color: getTendanceColor(previsions.tendance)
              }}>
                {previsions.tendance.charAt(0).toUpperCase() + previsions.tendance.slice(1)}
              </div>
              <div style={{ fontSize: '0.9rem', color: '#666', marginTop: '0.5rem' }}>
                {previsions.tauxCroissance > 0 ? '+' : ''}{previsions.tauxCroissance}% global
              </div>
            </div>

            <div className="card">
              <div className="card-title">Prévision {new Date().getFullYear() + 1}</div>
              <div className="card-value">{previsions.previsionProchaine} <span style={{ fontSize: '1.5rem' }}>kg</span></div>
              <div style={{ fontSize: '0.9rem', color: '#666', marginTop: '0.5rem' }}>
                Année prochaine
              </div>
            </div>

            <div className="card">
              <div className="card-title">Production moyenne</div>
              <div className="card-value">{previsions.productionMoyenne} <span style={{ fontSize: '1.5rem' }}>kg</span></div>
              <div style={{ fontSize: '0.9rem', color: '#666', marginTop: '0.5rem' }}>
                Historique
              </div>
            </div>

            <div className="card">
              <div className="card-title">Potentiel maximum</div>
              <div className="card-value">{previsions.potentielMax} <span style={{ fontSize: '1.5rem' }}>kg</span></div>
              <div style={{ fontSize: '0.9rem', color: '#666', marginTop: '0.5rem' }}>
                Avec {previsions.totalArbres} arbres
              </div>
            </div>

            <div className="card">
              <div className="card-title">Arbres productifs</div>
              <div className="card-value">{previsions.arbresProductifs}/{previsions.totalArbres}</div>
              <div style={{ fontSize: '0.9rem', color: '#666', marginTop: '0.5rem' }}>
                En bon/moyen état
              </div>
            </div>

            <div className="card">
              <div className="card-title">Confiance du modèle</div>
              <div className="card-value">{Math.round(previsions.confianceModele)}%</div>
              <div style={{ fontSize: '0.9rem', color: '#666', marginTop: '0.5rem' }}>
                Basé sur {productionHistorique.length} années
              </div>
            </div>
          </div>

          {/* Graphique prévisions */}
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: '12px', marginBottom: '2rem', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
            <h3 style={{ color: '#2c5f2d', marginBottom: '1rem' }}>📊 Historique et prévisions</h3>
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={donneesGraphique}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="annee" />
                <YAxis label={{ value: 'Production (kg)', angle: -90, position: 'insideLeft' }} />
                <Tooltip formatter={(value) => `${value} kg`} />
                <Legend />
                <ReferenceLine 
                  x={productionHistorique[productionHistorique.length - 1]?.annee} 
                  stroke="#666" 
                  strokeDasharray="3 3"
                  label="Aujourd'hui"
                />
                <Line 
                  type="monotone" 
                  dataKey="production" 
                  stroke="#2c5f2d" 
                  strokeWidth={3}
                  name="Historique"
                  dot={{ r: 6 }}
                  connectNulls
                />
                <Line 
                  type="monotone" 
                  dataKey={(item) => item.type === 'prevision' ? item.production : null}
                  stroke="#3498db" 
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  name="Prévisions"
                  dot={{ r: 6, fill: '#3498db' }}
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Tableau des prévisions détaillées */}
          <h3 style={{ color: '#2c5f2d', marginBottom: '1rem' }}>📅 Prévisions détaillées</h3>
          <table>
            <thead>
              <tr>
                <th>Année</th>
                <th>Production prévue</th>
                <th>Intervalle de confiance (95%)</th>
                <th>Évolution</th>
              </tr>
            </thead>
            <tbody>
              {previsions.previsionsAnnuelles.map((prev, idx) => {
                const evolution = idx === 0 
                  ? prev.production - productionHistorique[productionHistorique.length - 1].production
                  : prev.production - previsions.previsionsAnnuelles[idx - 1].production;
                
                return (
                  <tr key={prev.annee}>
                    <td><strong>{prev.annee}</strong></td>
                    <td style={{ fontSize: '1.1rem', color: '#2c5f2d', fontWeight: 'bold' }}>
                      {prev.production} kg
                    </td>
                    <td>{prev.min} kg - {prev.max} kg</td>
                    <td>
                      <span style={{ 
                        color: evolution > 0 ? '#27ae60' : evolution < 0 ? '#e74c3c' : '#f39c12',
                        fontWeight: 'bold'
                      }}>
                        {evolution > 0 ? '↗' : evolution < 0 ? '↘' : '→'} 
                        {' '}{evolution > 0 ? '+' : ''}{evolution.toFixed(2)} kg
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Section Données Météo Externes */}
          <div style={{
            marginTop: '2rem',
            padding: '1.5rem',
            background: '#e3f2fd',
            borderRadius: '12px',
            border: '1px solid #90caf9'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ color: '#1565c0', margin: 0 }}>🌤️ Données Météo Externes</h3>
              <button
                onClick={() => setShowMeteoPanel(!showMeteoPanel)}
                style={{
                  padding: '0.5rem 1rem',
                  background: showMeteoPanel ? '#1565c0' : 'white',
                  color: showMeteoPanel ? 'white' : '#1565c0',
                  border: '1px solid #1565c0',
                  borderRadius: '6px',
                  cursor: 'pointer'
                }}
              >
                {showMeteoPanel ? 'Masquer' : 'Afficher'} les détails
              </button>
            </div>

            {showMeteoPanel && (
              <div>
                {meteoLoading ? (
                  <p>Chargement des données météo...</p>
                ) : meteoData ? (
                  <div>
                    <p style={{ marginBottom: '1rem', color: '#666' }}>
                      <strong>Source :</strong> {meteoData.source} | 
                      <strong> Position :</strong> {meteoData.location.latitude.toFixed(4)}°N, {meteoData.location.longitude.toFixed(4)}°E
                    </p>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                      {meteoData.daily?.time?.slice(0, 7).map((date, idx) => (
                        <div key={date} style={{ background: 'white', padding: '0.75rem', borderRadius: '8px', textAlign: 'center' }}>
                          <div style={{ fontWeight: 'bold', color: '#1565c0' }}>
                            {new Date(date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' })}
                          </div>
                          <div style={{ fontSize: '0.9rem', color: '#666' }}>
                            {meteoData.daily.temperature_2m_min[idx]?.toFixed(0)}° - {meteoData.daily.temperature_2m_max[idx]?.toFixed(0)}°C
                          </div>
                          <div style={{ fontSize: '0.85rem', color: '#1976d2' }}>
                            💧 {meteoData.daily.precipitation_sum[idx]?.toFixed(1) || 0} mm
                          </div>
                          {meteoData.daily.soil_temperature_6cm_max && (
                            <div style={{ fontSize: '0.85rem', color: '#8b4513' }}>
                              🌡️ Sol: {meteoData.daily.soil_temperature_6cm_max[idx]?.toFixed(1)}°C
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p style={{ color: '#666' }}>
                    Aucune donnée météo disponible. Vérifiez que vos parcelles ont des coordonnées GPS.
                  </p>
                )}

                {/* Guide d'intégration des APIs météo */}
                <div style={{ background: 'white', padding: '1rem', borderRadius: '8px', marginTop: '1rem' }}>
                  <h4 style={{ color: '#1565c0', marginBottom: '0.5rem' }}>📚 Comment intégrer des données météo externes</h4>
                  <p style={{ fontSize: '0.9rem', color: '#666', marginBottom: '1rem' }}>
                    Pour améliorer vos prévisions de production, vous pouvez intégrer des données météo via plusieurs APIs :
                  </p>
                  
                  <div style={{ display: 'grid', gap: '1rem' }}>
                    <div style={{ borderLeft: '3px solid #4caf50', paddingLeft: '1rem' }}>
                      <strong style={{ color: '#2e7d32' }}>✅ Open-Meteo (Actif par défaut)</strong>
                      <p style={{ fontSize: '0.85rem', margin: '0.25rem 0' }}>
                        API gratuite, sans clé requise. Prévisions 14 jours + historique.
                        <br />
                        <code style={{ background: '#f5f5f5', padding: '2px 6px', borderRadius: '4px' }}>
                          https://open-meteo.com/
                        </code>
                      </p>
                    </div>
                    
                    <div style={{ borderLeft: '3px solid #ff9800', paddingLeft: '1rem' }}>
                      <strong style={{ color: '#e65100' }}>⚙️ OpenWeatherMap</strong>
                      <p style={{ fontSize: '0.85rem', margin: '0.25rem 0' }}>
                        1000 appels/jour gratuits. Ajouter dans <code>.env</code> :
                        <br />
                        <code style={{ background: '#f5f5f5', padding: '2px 6px', borderRadius: '4px' }}>
                          REACT_APP_OPENWEATHER_API_KEY=votre_clé
                        </code>
                      </p>
                    </div>
                    
                    <div style={{ borderLeft: '3px solid #2196f3', paddingLeft: '1rem' }}>
                      <strong style={{ color: '#1565c0' }}>⚙️ Météo France</strong>
                      <p style={{ fontSize: '0.85rem', margin: '0.25rem 0' }}>
                        API officielle française. Inscription sur :
                        <br />
                        <code style={{ background: '#f5f5f5', padding: '2px 6px', borderRadius: '4px' }}>
                          https://portail-api.meteofrance.fr/
                        </code>
                      </p>
                    </div>
                  </div>

                  <div style={{ marginTop: '1rem', padding: '0.75rem', background: '#fff3e0', borderRadius: '6px' }}>
                    <strong style={{ color: '#e65100' }}>💡 Conseil :</strong>
                    <span style={{ fontSize: '0.9rem', color: '#666' }}>
                      {' '}Pour des prévisions plus précises, combinez les données météo historiques avec vos récoltes 
                      pour identifier les conditions optimales (température du sol, pluviométrie été/automne).
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Recommandations */}
          <div style={{
            marginTop: '2rem',
            padding: '1.5rem',
            background: '#e8f5e9',
            borderRadius: '12px',
            borderLeft: '4px solid #27ae60'
          }}>
            <h3 style={{ color: '#2c5f2d', marginBottom: '1rem' }}>💡 Recommandations</h3>
            <ul style={{ margin: 0, paddingLeft: '1.5rem', lineHeight: '1.8' }}>
              {previsions.tendance === 'hausse' && (
                <>
                  <li>Excellente tendance ! Continuez vos pratiques actuelles.</li>
                  <li>Envisagez d'augmenter la capacité de stockage pour la saison prochaine.</li>
                  <li>Préparez vos canaux de vente pour absorber la production supplémentaire.</li>
                </>
              )}
              {previsions.tendance === 'baisse' && (
                <>
                  <li>Analysez les causes de la baisse : météo, état des arbres, entretien.</li>
                  <li>Vérifiez l'état sanitaire de vos arbres et planifiez des interventions.</li>
                  <li>Consultez un expert truffier si la tendance persiste.</li>
                </>
              )}
              {previsions.arbresProductifs < previsions.totalArbres * 0.8 && (
                <li>
                  <strong>Attention :</strong> {previsions.totalArbres - previsions.arbresProductifs} arbres 
                  en mauvais état. Intervenez pour améliorer le potentiel de production.
                </li>
              )}
              {previsions.confianceModele < 60 && (
                <li>
                  <strong>Note :</strong> Ces prévisions sont basées sur peu de données. 
                  La fiabilité augmentera avec l'accumulation d'historique.
                </li>
              )}
              <li>Le potentiel maximum ({previsions.potentielMax} kg) suppose des conditions optimales.</li>
            </ul>
          </div>
        </>
      ) : null}
    </div>
  );
}

export default Previsions;
