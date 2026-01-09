import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { exportProductionPDF } from '../utils/pdfExport';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

function Statistiques() {
  const [stats, setStats] = useState({
    parcelles: [],
    arbres: [],
    ventes: [],
    productionAnnuelle: []
  });
  const [loading, setLoading] = useState(true);
  const [selectedView, setSelectedView] = useState('production');

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      // Utiliser les endpoints existants au lieu des endpoints /stats/* qui n'existent pas
      const [recoltesRes, parcellesRes, arbresRes, ventesRes] = await Promise.all([
        axios.get(`${API_URL}/recoltes`),
        axios.get(`${API_URL}/parcelles`),
        axios.get(`${API_URL}/arbres`),
        axios.get(`${API_URL}/ventes`).catch(() => ({ data: [] })) // ventes peut ne pas exister
      ]);
      
      const recoltes = recoltesRes.data || [];
      const parcelles = parcellesRes.data || [];
      const arbres = arbresRes.data || [];
      const ventes = ventesRes.data || [];

      // === Calculer les stats de production par parcelle ===
      const parcelleStats = {};
      recoltes.forEach(r => {
        const parcelleName = r.parcelle_nom || r.parcelle || 'Inconnue';
        const annee = r.date_recolte ? new Date(r.date_recolte).getFullYear() : null;
        const key = `${parcelleName}_${annee}`;
        
        if (!parcelleStats[key]) {
          parcelleStats[key] = {
            parcelle: parcelleName,
            annee: annee,
            nombre_recoltes: 0,
            poids_total_g: 0,
            valeur_totale: 0
          };
        }
        parcelleStats[key].nombre_recoltes += 1;
        parcelleStats[key].poids_total_g += parseFloat(r.poids_grammes || r.poids || 0);
        parcelleStats[key].valeur_totale += parseFloat(r.valeur || r.prix || 0);
      });

      const statsParParcelle = Object.values(parcelleStats).map(s => ({
        ...s,
        poids_moyen_g: s.nombre_recoltes > 0 ? s.poids_total_g / s.nombre_recoltes : 0
      })).sort((a, b) => b.poids_total_g - a.poids_total_g);

      // === Calculer les stats de production par arbre ===
      const arbreStats = {};
      recoltes.forEach(r => {
        const arbreId = r.arbre_id;
        if (!arbreId) return;
        
        if (!arbreStats[arbreId]) {
          // Trouver les infos de l'arbre
          const arbreInfo = arbres.find(a => a.id === arbreId) || {};
          arbreStats[arbreId] = {
            id: arbreId,
            numero: arbreInfo.numero || r.arbre_numero || `Arbre ${arbreId}`,
            espece: arbreInfo.espece || r.espece || '-',
            parcelle: arbreInfo.parcelle_nom || r.parcelle_nom || '-',
            nombre_recoltes: 0,
            poids_total_g: 0
          };
        }
        arbreStats[arbreId].nombre_recoltes += 1;
        arbreStats[arbreId].poids_total_g += parseFloat(r.poids_grammes || r.poids || 0);
      });

      const statsParArbre = Object.values(arbreStats).map(s => ({
        ...s,
        poids_moyen_g: s.nombre_recoltes > 0 ? s.poids_total_g / s.nombre_recoltes : 0
      })).sort((a, b) => b.poids_total_g - a.poids_total_g);

      // === Calculer les stats de ventes par mois ===
      const venteStats = {};
      ventes.forEach(v => {
        const date = v.date_vente || v.date;
        if (!date) return;
        
        const d = new Date(date);
        const mois = d.getMonth() + 1;
        const annee = d.getFullYear();
        const key = `${annee}-${mois}`;
        
        if (!venteStats[key]) {
          venteStats[key] = {
            mois: mois,
            annee: annee,
            nombre_ventes: 0,
            quantite_vendue_g: 0,
            chiffre_affaires: 0
          };
        }
        venteStats[key].nombre_ventes += 1;
        venteStats[key].quantite_vendue_g += parseFloat(v.poids_grammes || v.quantite || 0);
        venteStats[key].chiffre_affaires += parseFloat(v.montant_total || v.prix || 0);
      });

      const statsVentes = Object.values(venteStats).map(s => ({
        ...s,
        prix_moyen_kg: s.quantite_vendue_g > 0 ? (s.chiffre_affaires / s.quantite_vendue_g) * 1000 : 0
      })).sort((a, b) => {
        if (a.annee !== b.annee) return b.annee - a.annee;
        return b.mois - a.mois;
      });

      // === Production annuelle ===
      const prodAnnuelle = {};
      recoltes.forEach(r => {
        if (!r.date_recolte) return;
        const annee = new Date(r.date_recolte).getFullYear();
        if (!prodAnnuelle[annee]) prodAnnuelle[annee] = 0;
        prodAnnuelle[annee] += parseFloat(r.poids_grammes || r.poids || 0) / 1000;
      });

      const productionAnnuelle = Object.entries(prodAnnuelle).map(([annee, kg]) => ({
        annee: parseInt(annee),
        kg: parseFloat(kg.toFixed(2))
      })).sort((a, b) => a.annee - b.annee);

      setStats({
        parcelles: statsParParcelle,
        arbres: statsParArbre,
        ventes: statsVentes,
        productionAnnuelle
      });
      setLoading(false);
    } catch (error) {
      console.error('Erreur lors du chargement des statistiques:', error);
      setLoading(false);
    }
  };

  if (loading) return <div className="loading">Chargement des statistiques...</div>;

  return (
    <div className="page-container">
      <div className="page-header">
        <h2>📈 Statistiques et analyses</h2>
        <button 
          className="btn btn-secondary" 
          onClick={() => exportProductionPDF(stats)}
          disabled={stats.parcelles.length === 0 && stats.arbres.length === 0}
          title="Exporter le rapport de production en PDF"
        >
          📄 Exporter rapport PDF
        </button>
      </div>

      {/* Onglets de vue */}
      <div style={{ marginBottom: '2rem', display: 'flex', gap: '0.5rem', borderBottom: '2px solid #e0e0e0', paddingBottom: '0.5rem' }}>
        <button 
          className={`btn ${selectedView === 'production' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setSelectedView('production')}
        >
          🍄 Production
        </button>
        <button 
          className={`btn ${selectedView === 'arbres' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setSelectedView('arbres')}
        >
          🌳 Arbres
        </button>
        <button 
          className={`btn ${selectedView === 'ventes' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setSelectedView('ventes')}
        >
          💰 Ventes
        </button>
      </div>

      {/* Vue Production */}
      {selectedView === 'production' && (
        <>
          {/* Évolution annuelle */}
          {stats.productionAnnuelle && stats.productionAnnuelle.length > 0 && (
            <div style={{ background: 'white', padding: '1.5rem', borderRadius: '12px', marginBottom: '2rem', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
              <h3 style={{ color: '#2c5f2d', marginBottom: '1rem' }}>📊 Évolution de la production annuelle</h3>
              <ResponsiveContainer width="100%" height={350}>
                <LineChart data={stats.productionAnnuelle}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="annee" />
                  <YAxis label={{ value: 'kg', angle: -90, position: 'insideLeft' }} />
                  <Tooltip formatter={(value) => `${value} kg`} />
                  <Legend />
                  <Line type="monotone" dataKey="kg" stroke="#2c5f2d" strokeWidth={3} name="Production (kg)" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Production par parcelle */}
          <h3 style={{ color: '#2c5f2d', marginTop: '2rem', marginBottom: '1rem' }}>🗺️ Production par parcelle</h3>
          {stats.parcelles.length === 0 ? (
            <p style={{ color: '#999', padding: '1rem' }}>Aucune donnée disponible</p>
          ) : (
            <>
              <div style={{ background: 'white', padding: '1.5rem', borderRadius: '12px', marginBottom: '2rem', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={stats.parcelles.slice(0, 10)}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="parcelle" />
                    <YAxis label={{ value: 'kg', angle: -90, position: 'insideLeft' }} />
                    <Tooltip formatter={(value) => `${(value / 1000).toFixed(2)} kg`} />
                    <Bar dataKey="poids_total_g" fill="#97bc62" name="Production (g)" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              
              <table>
                <thead>
                  <tr>
                    <th>Parcelle</th>
                    <th>Année</th>
                    <th>Nb récoltes</th>
                    <th>Production (kg)</th>
                    <th>Poids moyen (g)</th>
                    <th>Valeur (€)</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.parcelles.map((stat, idx) => (
                    <tr key={idx}>
                      <td><strong>{stat.parcelle}</strong></td>
                      <td>{stat.annee || '-'}</td>
                      <td>{stat.nombre_recoltes || 0}</td>
                      <td>{stat.poids_total_g ? (stat.poids_total_g / 1000).toFixed(2) : '0.00'} kg</td>
                      <td>{stat.poids_moyen_g ? parseFloat(stat.poids_moyen_g).toFixed(0) : '0'} g</td>
                      <td>{stat.valeur_totale ? parseFloat(stat.valeur_totale).toFixed(2) : '0.00'} €</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </>
      )}

      {/* Vue Arbres */}
      {selectedView === 'arbres' && (
        <>
          <h3 style={{ color: '#2c5f2d', marginBottom: '1rem' }}>🌳 Top 10 arbres producteurs</h3>
          {stats.arbres.length === 0 ? (
            <p style={{ color: '#999', padding: '1rem' }}>Aucune donnée disponible</p>
          ) : (
            <>
              <div style={{ background: 'white', padding: '1.5rem', borderRadius: '12px', marginBottom: '2rem', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={stats.arbres.slice(0, 10)} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" label={{ value: 'kg', position: 'insideRight' }} />
                    <YAxis dataKey="numero" type="category" width={80} />
                    <Tooltip formatter={(value) => `${(value / 1000).toFixed(2)} kg`} />
                    <Bar dataKey="poids_total_g" fill="#27ae60" name="Production (g)" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <table>
                <thead>
                  <tr>
                    <th>Numéro</th>
                    <th>Espèce</th>
                    <th>Parcelle</th>
                    <th>Nb récoltes</th>
                    <th>Production (kg)</th>
                    <th>Moyenne/récolte</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.arbres.slice(0, 20).map((stat) => (
                    <tr key={stat.id}>
                      <td><strong>{stat.numero}</strong></td>
                      <td>{stat.espece}</td>
                      <td>{stat.parcelle}</td>
                      <td>{stat.nombre_recoltes || 0}</td>
                      <td>{stat.poids_total_g ? (stat.poids_total_g / 1000).toFixed(2) : '0.00'} kg</td>
                      <td>{stat.poids_moyen_g ? parseFloat(stat.poids_moyen_g).toFixed(0) : '0'} g</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </>
      )}

      {/* Vue Ventes */}
      {selectedView === 'ventes' && (
        <>
          <h3 style={{ color: '#2c5f2d', marginBottom: '1rem' }}>💰 Chiffre d'affaires mensuel</h3>
          {stats.ventes.length === 0 ? (
            <p style={{ color: '#999', padding: '1rem' }}>Aucune donnée de ventes disponible</p>
          ) : (
            <>
              <div style={{ background: 'white', padding: '1.5rem', borderRadius: '12px', marginBottom: '2rem', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
                <ResponsiveContainer width="100%" height={350}>
                  <BarChart data={stats.ventes.slice(0, 12)}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey={(item) => `${item.mois}/${item.annee}`} />
                    <YAxis yAxisId="left" label={{ value: '€', angle: -90, position: 'insideLeft' }} />
                    <YAxis yAxisId="right" orientation="right" label={{ value: 'kg', angle: 90, position: 'insideRight' }} />
                    <Tooltip />
                    <Legend />
                    <Bar yAxisId="left" dataKey="chiffre_affaires" fill="#27ae60" name="CA (€)" />
                    <Bar yAxisId="right" dataKey={(item) => (item.quantite_vendue_g / 1000).toFixed(2)} fill="#f39c12" name="Quantité (kg)" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <table>
                <thead>
                  <tr>
                    <th>Période</th>
                    <th>Nb ventes</th>
                    <th>Quantité (kg)</th>
                    <th>CA (€)</th>
                    <th>Prix moyen/kg</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.ventes.map((stat, idx) => (
                    <tr key={idx}>
                      <td><strong>{stat.mois}/{stat.annee}</strong></td>
                      <td>{stat.nombre_ventes}</td>
                      <td>{stat.quantite_vendue_g ? (stat.quantite_vendue_g / 1000).toFixed(2) : '0.00'} kg</td>
                      <td>{stat.chiffre_affaires ? parseFloat(stat.chiffre_affaires).toFixed(2) : '0.00'} €</td>
                      <td>{stat.prix_moyen_kg ? parseFloat(stat.prix_moyen_kg).toFixed(2) : '0.00'} €</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </>
      )}
    </div>
  );
}

export default Statistiques;
