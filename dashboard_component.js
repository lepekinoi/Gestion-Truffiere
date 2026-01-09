import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

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
        totalProduction: (totalProduction / 1000).toFixed(2), // Convertir en kg
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
          gestion des parcelles et des arbres, planification des interventions, 
          enregistrement des récoltes, suivi des ventes et analyse des statistiques.
        </p>
      </div>
    </div>
  );
}

export default Dashboard;