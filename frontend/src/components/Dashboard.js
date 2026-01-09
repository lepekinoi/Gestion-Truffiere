import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import WeatherWidget from './WeatherWidget';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

const COLORS = ['#27ae60', '#f39c12', '#e74c3c', '#3498db', '#9b59b6', '#1abc9c'];

function Dashboard() {
  const [stats, setStats] = useState({
    parcelles: 0,
    arbres: 0,
    recoltes: 0,
    totalProduction: 0,
    interventionsPrevues: 0,
    chiffreAffaires: 0
  });
  const [loading, setLoading] = useState(true);
  const [recentRecoltes, setRecentRecoltes] = useState([]);
  const [interventionsAVenir, setInterventionsAVenir] = useState([]);
  const [productionParMois, setProductionParMois] = useState([]);
  const [productionParParcelle, setProductionParParcelle] = useState([]);
  const [arbresParEtat, setArbresParEtat] = useState([]);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      const [
        parcellesRes,
        arbresRes,
        recoltesRes,
        interventionsRes,
        ventesRes
      ] = await Promise.all([
        axios.get(`${API_URL}/parcelles`),
        axios.get(`${API_URL}/arbres`),
        axios.get(`${API_URL}/recoltes`),
        axios.get(`${API_URL}/interventions`),
        axios.get(`${API_URL}/ventes`)
      ]);

      const totalProduction = recoltesRes.data.reduce((sum, r) => sum + parseFloat(r.poids_grammes || 0), 0);
      const totalVentes = ventesRes.data
        .filter(v => v.statut === 'Payée')
        .reduce((sum, v) => sum + parseFloat(v.montant_total || 0), 0);

      const today = new Date();
      const interventionsPrevues = interventionsRes.data.filter(i => {
        const datePrevue = new Date(i.date_prevue);
        return datePrevue >= today && i.statut === 'Planifié';
      });

      setStats({
        parcelles: parcellesRes.data.length,
        arbres: arbresRes.data.length,
        recoltes: recoltesRes.data.length,
        totalProduction: (totalProduction / 1000).toFixed(2),
        interventionsPrevues: interventionsPrevues.length,
        chiffreAffaires: totalVentes.toFixed(2)
      });

      // Dernières récoltes (5 plus récentes)
      const sortedRecoltes = [...recoltesRes.data]
        .sort((a, b) => new Date(b.date_recolte) - new Date(a.date_recolte))
        .slice(0, 5);
      setRecentRecoltes(sortedRecoltes);

      // Prochaines interventions (5 suivantes)
      const sortedInterventions = interventionsPrevues
        .sort((a, b) => new Date(a.date_prevue) - new Date(b.date_prevue))
        .slice(0, 5);
      setInterventionsAVenir(sortedInterventions);

      // Graphique : Production par mois (12 derniers mois)
      const productionMensuelle = {};
      const now = new Date();
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const moisNom = d.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' });
        productionMensuelle[key] = { mois: moisNom, production: 0 };
      }

      recoltesRes.data.forEach(recolte => {
        const date = new Date(recolte.date_recolte);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        if (productionMensuelle[key]) {
          productionMensuelle[key].production += parseFloat(recolte.poids_grammes || 0) / 1000;
        }
      });

      setProductionParMois(Object.values(productionMensuelle).map(p => ({
        ...p,
        production: parseFloat(p.production.toFixed(2))
      })));

      // Graphique : Production par parcelle
      const prodParParcelle = {};
      recoltesRes.data.forEach(recolte => {
        const parcelle = recolte.parcelle_nom || 'Non défini';
        if (!prodParParcelle[parcelle]) {
          prodParParcelle[parcelle] = 0;
        }
        prodParParcelle[parcelle] += parseFloat(recolte.poids_grammes || 0) / 1000;
      });

      setProductionParParcelle(
        Object.entries(prodParParcelle).map(([nom, kg]) => ({
          nom,
          kg: parseFloat(kg.toFixed(2))
        }))
      );

      // Graphique : Arbres par état
      const etatsCount = { 'Bon': 0, 'Moyen': 0, 'Mauvais': 0, 'Mort': 0 };
      arbresRes.data.forEach(arbre => {
        if (etatsCount.hasOwnProperty(arbre.etat)) {
          etatsCount[arbre.etat]++;
        }
      });

      setArbresParEtat(
        Object.entries(etatsCount)
          .filter(([, count]) => count > 0)
          .map(([etat, count]) => ({ etat, count }))
      );

      setLoading(false);
    } catch (error) {
      console.error('Erreur lors du chargement du tableau de bord:', error);
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  if (loading) {
    return <div className="loading">Chargement du tableau de bord...</div>;
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h2>📊 Tableau de bord</h2>
      </div>

      {/* Statistiques principales */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Parcelles</div>
          <div className="stat-value">{stats.parcelles}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Arbres truffiers</div>
          <div className="stat-value">{stats.arbres}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Récoltes totales</div>
          <div className="stat-value">{stats.recoltes}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Production (kg)</div>
          <div className="stat-value">{stats.totalProduction}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Interventions prévues</div>
          <div className="stat-value">{stats.interventionsPrevues}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Chiffre d'affaires (€)</div>
          <div className="stat-value">{stats.chiffreAffaires}</div>
        </div>
      </div>

      {/* Graphiques - Première ligne */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '2rem', marginTop: '2rem' }}>
        
        {/* Production mensuelle */}
        <div style={{ background: 'white', padding: '1.5rem', borderRadius: '12px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
          <h3 style={{ color: '#2c5f2d', marginBottom: '1rem' }}>📈 Production des 12 derniers mois</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={productionParMois}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="mois" />
              <YAxis label={{ value: 'kg', angle: -90, position: 'insideLeft' }} />
              <Tooltip formatter={(value) => `${value} kg`} />
              <Legend />
              <Line type="monotone" dataKey="production" stroke="#2c5f2d" strokeWidth={3} name="Production (kg)" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Widget météo */}
        <WeatherWidget location="Lusseray,FR" />
      </div>

      {/* Graphiques - Deuxième ligne */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginTop: '2rem' }}>

        {/* Arbres par état */}
        <div style={{ background: 'white', padding: '1.5rem', borderRadius: '12px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
          <h3 style={{ color: '#2c5f2d', marginBottom: '1rem' }}>🌳 État des arbres</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={arbresParEtat}
                dataKey="count"
                nameKey="etat"
                cx="50%"
                cy="50%"
                outerRadius={100}
                label={({ etat, count }) => `${etat}: ${count}`}
              >
                {arbresParEtat.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={
                    entry.etat === 'Bon' ? '#27ae60' :
                    entry.etat === 'Moyen' ? '#f39c12' :
                    entry.etat === 'Mauvais' ? '#e74c3c' : '#95a5a6'
                  } />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Production par parcelle */}
        {productionParParcelle.length > 0 && (
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: '12px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
            <h3 style={{ color: '#2c5f2d', marginBottom: '1rem' }}>🗺️ Production par parcelle</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={productionParParcelle}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="nom" />
                <YAxis label={{ value: 'kg', angle: -90, position: 'insideLeft' }} />
                <Tooltip formatter={(value) => `${value} kg`} />
                <Legend />
                <Bar dataKey="kg" fill="#97bc62" name="Production (kg)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Deux colonnes pour les listes */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginTop: '2rem' }}>
        
        {/* Dernières récoltes */}
        <div>
          <h3 style={{ color: '#2c5f2d', marginBottom: '1rem' }}>🍄 Dernières récoltes</h3>
          {recentRecoltes.length === 0 ? (
            <div className="empty-state">
              <p>Aucune récolte enregistrée</p>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Parcelle</th>
                  <th>Poids (g)</th>
                  <th>Qualité</th>
                </tr>
              </thead>
              <tbody>
                {recentRecoltes.map(recolte => (
                  <tr key={recolte.id}>
                    <td>{formatDate(recolte.date_recolte)}</td>
                    <td>{recolte.parcelle_nom || '-'}</td>
                    <td>{parseFloat(recolte.poids_grammes).toFixed(0)} g</td>
                    <td>{recolte.qualite || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Prochaines interventions */}
        <div>
          <h3 style={{ color: '#2c5f2d', marginBottom: '1rem' }}>🛠️ Interventions à venir</h3>
          {interventionsAVenir.length === 0 ? (
            <div className="empty-state">
              <p>Aucune intervention planifiée</p>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Parcelle</th>
                </tr>
              </thead>
              <tbody>
                {interventionsAVenir.map(intervention => (
                  <tr key={intervention.id}>
                    <td>{formatDate(intervention.date_prevue)}</td>
                    <td>
                      <span style={{
                        display: 'inline-block',
                        padding: '0.25rem 0.5rem',
                        borderRadius: '4px',
                        backgroundColor: intervention.type_couleur || '#ccc',
                        color: 'white',
                        fontSize: '0.85rem'
                      }}>
                        {intervention.type_nom}
                      </span>
                    </td>
                    <td>{intervention.parcelle_nom || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Informations de bienvenue */}
      <div style={{ 
        marginTop: '2rem', 
        padding: '1.5rem', 
        background: '#f0f7f0', 
        borderRadius: '12px',
        borderLeft: '4px solid #2c5f2d'
      }}>
        <h3 style={{ color: '#2c5f2d', marginBottom: '0.5rem' }}>👋 Bienvenue sur votre gestionnaire de truffière</h3>
        <p style={{ color: '#666', lineHeight: '1.6' }}>
          Utilisez le menu de navigation pour accéder aux différentes fonctionnalités : 
          cartographie interactive, gestion des parcelles et arbres, planification des interventions, 
          enregistrement des récoltes, suivi des ventes et analyse des statistiques.
        </p>
      </div>
    </div>
  );
}

export default Dashboard;