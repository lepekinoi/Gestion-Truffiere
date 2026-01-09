import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

function Previsions() {
  const [loading, setLoading] = useState(true);
  const [recoltes, setRecoltes] = useState([]);
  const [arbres, setArbres] = useState([]);
  const [productionHistorique, setProductionHistorique] = useState([]);
  const [previsions, setPrevisions] = useState(null);
  const [selectedParcelle, setSelectedParcelle] = useState('all');
  const [parcelles, setParcelles] = useState([]);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (recoltes.length > 0) {
      calculerPrevisions();
    }
  }, [recoltes, selectedParcelle]);

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

      // Intervalle de confiance (±1.96 * écart-type pour 95%)
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
      
      const arbresProductifs = arbresFiltered.filter(a => a.etat === 'Bon' || a.etat === 'Moyen').length;
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
        <h2>🔮 Prévisions de production</h2>
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