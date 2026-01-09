import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import WeatherWidget from './WeatherWidget';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

// Couleurs cohérentes pour les états des arbres
const ETAT_COLORS = {
  'Bon': '#27ae60',
  'Moyen': '#f39c12',
  'Mauvais': '#e74c3c',
  'Mort': '#95a5a6'
};

function Dashboard() {
  // ==================== ÉTATS ====================
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Statistiques principales (depuis /api/stats/dashboard)
  const [stats, setStats] = useState({
    parcelles: { count: 0, surface: 0 },
    arbres: { count: 0, parEtat: [] },
    recoltes: { totalGrammes: 0, count: 0 },
    ventes: { chiffreAffaires: 0, count: 0 },
    interventions: { aVenir: 0 },
    commandes: { enCours: 0 }
  });
  
  // Alertes (nécessite des données complémentaires)
  const [alertes, setAlertes] = useState({
    commandesEnAttente: 0,
    ventesEnAttente: 0
  });
  
  // Listes pour les activités récentes
  const [recentRecoltes, setRecentRecoltes] = useState([]);
  const [interventionsAVenir, setInterventionsAVenir] = useState([]);
  const [commandesRecentes, setCommandesRecentes] = useState([]);
  
  // Données pour les graphiques
  const [productionParMois, setProductionParMois] = useState([]);
  const [productionParParcelle, setProductionParParcelle] = useState([]);

  // ==================== CHARGEMENT DES DONNÉES ====================
  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      // 1. Charger les statistiques consolidées (endpoint optimisé)
      const statsRes = await axios.get(`${API_URL}/stats/dashboard`);
      setStats(statsRes.data);

      // 2. Charger les données complémentaires en parallèle
      const [
        recoltesRes,
        interventionsRes,
        commandesRes,
        ventesRes,
        recoltesMensuellesRes
      ] = await Promise.all([
        axios.get(`${API_URL}/recoltes`),
        axios.get(`${API_URL}/interventions`),
        axios.get(`${API_URL}/commandes`),
        axios.get(`${API_URL}/ventes`),
        axios.get(`${API_URL}/stats/recoltes-mensuelles`)
      ]);

      // 3. Calculer les alertes
      const commandesEnAttente = commandesRes.data.filter(c => 
        c.statut === 'En attente' || c.statut === 'Confirmée'
      ).length;
      const ventesEnAttente = ventesRes.data.filter(v => 
        v.statut === 'En attente'
      ).length;
      setAlertes({ commandesEnAttente, ventesEnAttente });

      // 4. Préparer les listes d'activités récentes
      // Dernières récoltes (5 plus récentes)
      const sortedRecoltes = [...recoltesRes.data]
        .sort((a, b) => new Date(b.date_recolte) - new Date(a.date_recolte))
        .slice(0, 5);
      setRecentRecoltes(sortedRecoltes);

      // Prochaines interventions planifiées (5 suivantes)
      const today = new Date();
      const sortedInterventions = interventionsRes.data
        .filter(i => new Date(i.date_prevue) >= today && i.statut === 'Planifié')
        .sort((a, b) => new Date(a.date_prevue) - new Date(b.date_prevue))
        .slice(0, 5);
      setInterventionsAVenir(sortedInterventions);

      // Commandes en cours (5 plus récentes non terminées)
      const sortedCommandes = commandesRes.data
        .filter(c => c.statut !== 'Annulée' && c.statut !== 'Livrée')
        .sort((a, b) => new Date(b.date_commande) - new Date(a.date_commande))
        .slice(0, 5);
      setCommandesRecentes(sortedCommandes);

      // 5. Préparer les données des graphiques
      // Production mensuelle (utiliser l'endpoint optimisé + compléter les mois manquants)
      const productionMensuelle = prepareProductionMensuelle(recoltesMensuellesRes.data);
      setProductionParMois(productionMensuelle);

      // Production par parcelle
      const prodParParcelle = {};
      recoltesRes.data.forEach(recolte => {
        const parcelle = recolte.parcelle_nom || 'Non défini';
        if (!prodParParcelle[parcelle]) prodParParcelle[parcelle] = 0;
        prodParParcelle[parcelle] += parseFloat(recolte.poids_grammes || 0) / 1000;
      });
      setProductionParParcelle(
        Object.entries(prodParParcelle)
          .map(([nom, kg]) => ({ nom, kg: parseFloat(kg.toFixed(2)) }))
          .sort((a, b) => b.kg - a.kg)
      );

      setLoading(false);
    } catch (err) {
      console.error('Erreur lors du chargement du tableau de bord:', err);
      setError('Impossible de charger les données du tableau de bord');
      setLoading(false);
    }
  };

  // Préparer les données de production mensuelle avec tous les mois
  const prepareProductionMensuelle = (data) => {
    const now = new Date();
    const result = [];
    
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const moisNom = d.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' });
      
      const found = data.find(item => item.mois === key);
      result.push({
        mois: moisNom,
        production: found ? parseFloat((found.total_grammes / 1000).toFixed(2)) : 0
      });
    }
    
    return result;
  };

  // ==================== FONCTIONS UTILITAIRES ====================
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  const formatDateShort = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', { 
      day: 'numeric',
      month: 'short'
    });
  };

  // ==================== RENDU CONDITIONNEL ====================
  if (loading) {
    return (
      <div className="page-container">
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          height: '50vh',
          flexDirection: 'column',
          gap: '1rem'
        }}>
          <div style={{ fontSize: '3rem' }}>🍄</div>
          <div>Chargement du tableau de bord...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-container">
        <div style={{ 
          background: '#fee', 
          border: '1px solid #c00', 
          borderRadius: '8px', 
          padding: '2rem',
          textAlign: 'center'
        }}>
          <p style={{ color: '#c00', margin: 0 }}>⚠️ {error}</p>
          <button 
            onClick={loadDashboardData}
            style={{ marginTop: '1rem', padding: '0.5rem 1rem' }}
          >
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  // ==================== RENDU PRINCIPAL ====================
  return (
    <div className="page-container">
      
      {/* ═══════════════════════════════════════════════════════════════
          SECTION 1: ACCUEIL + ALERTES
          Objectif: Accueillir l'utilisateur et signaler les actions urgentes
      ═══════════════════════════════════════════════════════════════ */}
      <section style={{ marginBottom: '2rem' }}>
        {/* Message de bienvenue */}
        <div style={{ 
          padding: '1.5rem', 
          background: 'linear-gradient(135deg, #2c5f2d 0%, #4a8b4c 100%)', 
          borderRadius: '12px',
          color: 'white',
          boxShadow: '0 4px 15px rgba(44, 95, 45, 0.3)',
          marginBottom: '1rem'
        }}>
          <h2 style={{ margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            👋 Bienvenue sur votre gestionnaire de truffière
          </h2>
          <p style={{ margin: 0, opacity: 0.9, lineHeight: '1.6' }}>
            Gérez vos parcelles, arbres, interventions, récoltes et ventes depuis une interface unique.
          </p>
        </div>

        {/* Alertes prioritaires */}
        {(alertes.commandesEnAttente > 0 || alertes.ventesEnAttente > 0) && (
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', 
            gap: '1rem'
          }}>
            {alertes.commandesEnAttente > 0 && (
              <div style={{ 
                background: '#fff3cd', 
                border: '1px solid #ffc107', 
                borderRadius: '8px', 
                padding: '1rem',
                display: 'flex',
                alignItems: 'center',
                gap: '1rem'
              }}>
                <span style={{ fontSize: '2rem' }}>📦</span>
                <div>
                  <strong style={{ color: '#856404' }}>
                    {alertes.commandesEnAttente} commande(s) en attente
                  </strong>
                  <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.9rem', color: '#856404' }}>
                    À traiter dans la section Commercial
                  </p>
                </div>
              </div>
            )}
            {alertes.ventesEnAttente > 0 && (
              <div style={{ 
                background: '#d1ecf1', 
                border: '1px solid #17a2b8', 
                borderRadius: '8px', 
                padding: '1rem',
                display: 'flex',
                alignItems: 'center',
                gap: '1rem'
              }}>
                <span style={{ fontSize: '2rem' }}>💳</span>
                <div>
                  <strong style={{ color: '#0c5460' }}>
                    {alertes.ventesEnAttente} vente(s) en attente de paiement
                  </strong>
                  <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.9rem', color: '#0c5460' }}>
                    À suivre dans la section Commercial
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          SECTION 2: KPIs PATRIMOINE
          Lien avec: Parcelles + Arbres
          Source: /api/stats/dashboard
      ═══════════════════════════════════════════════════════════════ */}
      <section style={{ marginBottom: '2rem' }}>
        <div className="page-header">
          <h2>📊 Vue d'ensemble</h2>
        </div>
        <div className="stats-grid">
          {/* Patrimoine */}
          <div className="stat-card">
            <div className="stat-label">📋 Parcelles</div>
            <div className="stat-value">{stats.parcelles.count}</div>
            <div style={{ fontSize: '0.85rem', color: '#666', marginTop: '0.25rem' }}>
              {stats.parcelles.surface.toFixed(2)} ha
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label">🌳 Arbres truffiers</div>
            <div className="stat-value">{stats.arbres.count}</div>
          </div>
          
          {/* Production - Lien avec Récoltes */}
          <div className="stat-card">
            <div className="stat-label">🍄 Récoltes (saison)</div>
            <div className="stat-value">{stats.recoltes.count}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">⚖️ Production (kg)</div>
            <div className="stat-value" style={{ color: '#27ae60' }}>
              {(stats.recoltes.totalGrammes / 1000).toFixed(2)}
            </div>
          </div>
          
          {/* Activité - Lien avec Interventions */}
          <div className="stat-card">
            <div className="stat-label">🛠️ Interventions prévues</div>
            <div className="stat-value" style={{ 
              color: stats.interventions.aVenir > 0 ? '#f39c12' : '#27ae60' 
            }}>
              {stats.interventions.aVenir}
            </div>
          </div>
          
          {/* Commercial - Lien avec Commercial */}
          <div className="stat-card">
            <div className="stat-label">💰 Chiffre d'affaires (mois)</div>
            <div className="stat-value" style={{ color: '#27ae60' }}>
              {stats.ventes.chiffreAffaires.toFixed(2)} €
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          SECTION 3: GRAPHIQUE PRODUCTION + MÉTÉO
          Lien avec: Récoltes + Prévisions
      ═══════════════════════════════════════════════════════════════ */}
      <section style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '2rem' }}>
          
          {/* Graphique production mensuelle */}
          <div style={{ 
            background: 'white', 
            padding: '1.5rem', 
            borderRadius: '12px', 
            boxShadow: '0 2px 10px rgba(0,0,0,0.05)' 
          }}>
            <h3 style={{ color: '#2c5f2d', marginBottom: '1rem', marginTop: 0 }}>
              📈 Production des 12 derniers mois
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={productionParMois}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="mois" />
                <YAxis label={{ value: 'kg', angle: -90, position: 'insideLeft' }} />
                <Tooltip formatter={(value) => `${value} kg`} />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="production" 
                  stroke="#2c5f2d" 
                  strokeWidth={3} 
                  name="Production (kg)"
                  dot={{ fill: '#2c5f2d' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Widget Météo - Lien avec Prévisions */}
          <WeatherWidget location="Lusseray,FR" />
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          SECTION 4: GRAPHIQUES DÉTAILLÉS
          Lien avec: Arbres + Statistiques
      ═══════════════════════════════════════════════════════════════ */}
      <section style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
          
          {/* État des arbres - Lien avec Arbres */}
          <div style={{ 
            background: 'white', 
            padding: '1.5rem', 
            borderRadius: '12px', 
            boxShadow: '0 2px 10px rgba(0,0,0,0.05)' 
          }}>
            <h3 style={{ color: '#2c5f2d', marginBottom: '1rem', marginTop: 0 }}>
              🌳 État sanitaire des arbres
            </h3>
            {stats.arbres.parEtat.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={stats.arbres.parEtat.map(item => ({
                      etat: item.etat,
                      count: parseInt(item.count)
                    }))}
                    dataKey="count"
                    nameKey="etat"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={({ etat, count }) => `${etat}: ${count}`}
                  >
                    {stats.arbres.parEtat.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={ETAT_COLORS[entry.etat] || '#999'} 
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ 
                height: '280px', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                color: '#888'
              }}>
                Aucune donnée disponible
              </div>
            )}
          </div>

          {/* Production par parcelle - Lien avec Parcelles */}
          <div style={{ 
            background: 'white', 
            padding: '1.5rem', 
            borderRadius: '12px', 
            boxShadow: '0 2px 10px rgba(0,0,0,0.05)' 
          }}>
            <h3 style={{ color: '#2c5f2d', marginBottom: '1rem', marginTop: 0 }}>
              🗺️ Production par parcelle
            </h3>
            {productionParParcelle.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={productionParParcelle}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="nom" />
                  <YAxis label={{ value: 'kg', angle: -90, position: 'insideLeft' }} />
                  <Tooltip formatter={(value) => `${value} kg`} />
                  <Legend />
                  <Bar dataKey="kg" fill="#97bc62" name="Production (kg)" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ 
                height: '280px', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                color: '#888'
              }}>
                Aucune récolte enregistrée
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          SECTION 5: ACTIVITÉS RÉCENTES
          Lien avec: Récoltes + Interventions + Commercial
      ═══════════════════════════════════════════════════════════════ */}
      <section>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '2rem' }}>
          
          {/* Dernières récoltes - Lien avec Récoltes */}
          <div style={{ 
            background: 'white', 
            padding: '1.5rem', 
            borderRadius: '12px', 
            boxShadow: '0 2px 10px rgba(0,0,0,0.05)' 
          }}>
            <h3 style={{ color: '#2c5f2d', marginBottom: '1rem', marginTop: 0 }}>
              🍄 Dernières récoltes
            </h3>
            {recentRecoltes.length === 0 ? (
              <div style={{ padding: '1rem', color: '#888', textAlign: 'center' }}>
                Aucune récolte enregistrée
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {recentRecoltes.map(recolte => (
                  <div key={recolte.id} style={{ 
                    padding: '0.75rem', 
                    background: '#f9f9f9', 
                    borderRadius: '8px',
                    borderLeft: '3px solid #8e44ad'
                  }}>
                    <div style={{ fontWeight: '500' }}>
                      {formatDateShort(recolte.date_recolte)}
                    </div>
                    <div style={{ fontSize: '0.9rem', color: '#666' }}>
                      {recolte.parcelle_nom || '-'} • 
                      <strong> {parseFloat(recolte.poids_grammes).toFixed(0)} g</strong>
                    </div>
                    {recolte.qualite && (
                      <div style={{ fontSize: '0.85rem', color: '#888' }}>
                        {recolte.qualite}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Interventions à venir - Lien avec Interventions */}
          <div style={{ 
            background: 'white', 
            padding: '1.5rem', 
            borderRadius: '12px', 
            boxShadow: '0 2px 10px rgba(0,0,0,0.05)' 
          }}>
            <h3 style={{ color: '#2c5f2d', marginBottom: '1rem', marginTop: 0 }}>
              🛠️ Interventions à venir
            </h3>
            {interventionsAVenir.length === 0 ? (
              <div style={{ padding: '1rem', color: '#888', textAlign: 'center' }}>
                Aucune intervention planifiée
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {interventionsAVenir.map(intervention => (
                  <div key={intervention.id} style={{ 
                    padding: '0.75rem', 
                    background: '#f9f9f9', 
                    borderRadius: '8px',
                    borderLeft: `3px solid ${intervention.type_couleur || '#e67e22'}`
                  }}>
                    <div style={{ fontWeight: '500' }}>
                      {formatDateShort(intervention.date_prevue)}
                    </div>
                    <div style={{ fontSize: '0.9rem', color: '#666' }}>
                      <span style={{
                        display: 'inline-block',
                        padding: '0.15rem 0.5rem',
                        borderRadius: '4px',
                        backgroundColor: intervention.type_couleur || '#ccc',
                        color: 'white',
                        fontSize: '0.8rem'
                      }}>
                        {intervention.type_nom}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.85rem', color: '#888', marginTop: '0.25rem' }}>
                      {intervention.parcelle_nom || '-'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Commandes en cours - Lien avec Commercial */}
          <div style={{ 
            background: 'white', 
            padding: '1.5rem', 
            borderRadius: '12px', 
            boxShadow: '0 2px 10px rgba(0,0,0,0.05)' 
          }}>
            <h3 style={{ color: '#2c5f2d', marginBottom: '1rem', marginTop: 0 }}>
              📦 Commandes en cours
            </h3>
            {commandesRecentes.length === 0 ? (
              <div style={{ padding: '1rem', color: '#888', textAlign: 'center' }}>
                Aucune commande en cours
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {commandesRecentes.map(commande => (
                  <div key={commande.id} style={{ 
                    padding: '0.75rem', 
                    background: '#f9f9f9', 
                    borderRadius: '8px',
                    borderLeft: '3px solid #3498db'
                  }}>
                    <div style={{ 
                      fontWeight: '500', 
                      display: 'flex', 
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      <span>{commande.numero_commande || `CMD-${commande.id}`}</span>
                      <span style={{ 
                        fontSize: '0.75rem', 
                        padding: '0.15rem 0.5rem', 
                        borderRadius: '12px',
                        background: commande.statut === 'En attente' ? '#fff3cd' : '#cce5ff',
                        color: commande.statut === 'En attente' ? '#856404' : '#004085'
                      }}>
                        {commande.statut}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.9rem', color: '#666' }}>
                      {parseFloat(commande.poids_grammes || 0).toFixed(0)} g • 
                      <strong> {parseFloat(commande.montant_total || 0).toFixed(2)} €</strong>
                    </div>
                    {commande.date_livraison_demandee && (
                      <div style={{ fontSize: '0.85rem', color: '#888' }}>
                        Livraison : {formatDateShort(commande.date_livraison_demandee)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

export default Dashboard;
