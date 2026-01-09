import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area } from 'recharts';
import { exportProductionPDF } from '../utils/pdfExport';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

// Options d'exposition
const EXPOSITIONS = [
  { value: 'Nord', label: 'Nord', short: 'N', angle: 270 },
  { value: 'Nord-Est', label: 'Nord-Est', short: 'NE', angle: 315 },
  { value: 'Est', label: 'Est', short: 'E', angle: 0 },
  { value: 'Sud-Est', label: 'Sud-Est', short: 'SE', angle: 45 },
  { value: 'Sud', label: 'Sud', short: 'S', angle: 90 },
  { value: 'Sud-Ouest', label: 'Sud-Ouest', short: 'SO', angle: 135 },
  { value: 'Ouest', label: 'Ouest', short: 'O', angle: 180 },
  { value: 'Nord-Ouest', label: 'Nord-Ouest', short: 'NO', angle: 225 }
];

// Couleurs pour les graphiques
const COLORS = ['#2c5f2d', '#97bc62', '#f39c12', '#3498db', '#e74c3c', '#9b59b6', '#1abc9c', '#34495e'];

// Couleurs pour les expositions
const EXPOSURE_COLORS = {
  'Nord': '#2196F3',
  'Nord-Est': '#03A9F4',
  'Est': '#00BCD4',
  'Sud-Est': '#009688',
  'Sud': '#4CAF50',
  'Sud-Ouest': '#8BC34A',
  'Ouest': '#CDDC39',
  'Nord-Ouest': '#FFC107'
};

// Composant visuel Vue de dessus de l'arbre avec expositions colorées
function ArbreExpositionView({ expositionStats, arbreNumero }) {
  // Trouver l'exposition la plus fréquente
  const maxCount = Math.max(...expositionStats.map(e => e.count), 0);
  const totalRecoltes = expositionStats.reduce((sum, e) => sum + e.count, 0);
  
  // Fonction pour obtenir la couleur selon le nombre de récoltes
  const getColor = (count) => {
    if (count === 0) return '#f5f5f5';
    if (count === maxCount && maxCount > 0) return '#e53935';
    const intensity = count / maxCount;
    const green = Math.round(200 - (intensity * 100));
    return `rgb(${Math.round(100 + intensity * 50)}, ${green}, ${Math.round(100 - intensity * 50)})`;
  };

  // Positions des zones autour de l'arbre (vue de dessus)
  const zones = [
    { expo: 'Nord', x: 50, y: 5, width: 30, height: 25 },
    { expo: 'Nord-Est', x: 75, y: 15, width: 25, height: 25 },
    { expo: 'Est', x: 80, y: 40, width: 20, height: 30 },
    { expo: 'Sud-Est', x: 75, y: 70, width: 25, height: 25 },
    { expo: 'Sud', x: 50, y: 80, width: 30, height: 20 },
    { expo: 'Sud-Ouest', x: 15, y: 70, width: 25, height: 25 },
    { expo: 'Ouest', x: 5, y: 40, width: 20, height: 30 },
    { expo: 'Nord-Ouest', x: 15, y: 15, width: 25, height: 25 }
  ];

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center',
      padding: '1rem',
      background: 'white',
      borderRadius: '12px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
    }}>
      <h4 style={{ margin: '0 0 0.5rem 0', color: '#2c5f2d' }}>
        🌳 {arbreNumero}
      </h4>
      <p style={{ margin: '0 0 1rem 0', fontSize: '0.85rem', color: '#666' }}>
        {totalRecoltes} récolte{totalRecoltes > 1 ? 's' : ''} enregistrée{totalRecoltes > 1 ? 's' : ''}
      </p>
      
      <svg viewBox="0 0 120 120" style={{ width: '180px', height: '180px' }}>
        {/* Zones d'exposition */}
        {zones.map(zone => {
          const stat = expositionStats.find(e => e.exposition === zone.expo);
          const count = stat ? stat.count : 0;
          const color = getColor(count);
          const isMax = count === maxCount && maxCount > 0;
          
          return (
            <g key={zone.expo}>
              <rect
                x={zone.x}
                y={zone.y}
                width={zone.width}
                height={zone.height}
                fill={color}
                stroke={isMax ? '#c62828' : '#ddd'}
                strokeWidth={isMax ? 2 : 1}
                rx="3"
                style={{ transition: 'all 0.3s' }}
              />
              <text
                x={zone.x + zone.width / 2}
                y={zone.y + zone.height / 2}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize="8"
                fill={count > 0 ? (isMax ? 'white' : '#333') : '#999'}
                fontWeight={isMax ? 'bold' : 'normal'}
              >
                {count > 0 ? count : ''}
              </text>
            </g>
          );
        })}
        
        {/* Cercle central représentant l'arbre */}
        <circle
          cx="60"
          cy="55"
          r="18"
          fill="#4a7c4f"
          stroke="#2c5f2d"
          strokeWidth="2"
        />
        <text
          x="60"
          y="55"
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize="10"
          fill="white"
          fontWeight="bold"
        >
          🌳
        </text>
        
        {/* Labels des directions */}
        <text x="60" y="2" textAnchor="middle" fontSize="7" fill="#666">N</text>
        <text x="118" y="55" textAnchor="end" fontSize="7" fill="#666">E</text>
        <text x="60" y="118" textAnchor="middle" fontSize="7" fill="#666">S</text>
        <text x="2" y="55" textAnchor="start" fontSize="7" fill="#666">O</text>
      </svg>
      
      {/* Légende */}
      {maxCount > 0 && (
        <div style={{ 
          marginTop: '0.5rem', 
          fontSize: '0.75rem', 
          color: '#666',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          <span style={{ 
            display: 'inline-block', 
            width: '12px', 
            height: '12px', 
            background: '#e53935',
            borderRadius: '2px'
          }}></span>
          <span>Zone la plus fréquente</span>
        </div>
      )}
    </div>
  );
}

function Statistiques() {
  const [stats, setStats] = useState({
    parcelles: [],
    arbres: [],
    ventes: [],
    productionAnnuelle: [],
    expositions: [],
    interventions: [],
    summary: {
      totalRecoltes: 0,
      totalPoids: 0,
      totalValeur: 0,
      moyennePoids: 0,
      totalArbres: 0,
      arbresProductifs: 0,
      totalParcelles: 0
    }
  });
  const [loading, setLoading] = useState(true);
  const [selectedView, setSelectedView] = useState('dashboard');
  const [selectedAnnee, setSelectedAnnee] = useState('all');

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const [recoltesRes, parcellesRes, arbresRes, ventesRes, interventionsRes] = await Promise.all([
        axios.get(`${API_URL}/recoltes`),
        axios.get(`${API_URL}/parcelles`),
        axios.get(`${API_URL}/arbres`),
        axios.get(`${API_URL}/ventes`).catch(() => ({ data: [] })),
        axios.get(`${API_URL}/interventions`).catch(() => ({ data: [] }))
      ]);
      
      const recoltes = recoltesRes.data || [];
      const parcelles = parcellesRes.data || [];
      const arbres = arbresRes.data || [];
      const ventes = ventesRes.data || [];
      const interventions = interventionsRes.data || [];

      // === RÉSUMÉ GLOBAL ===
      const totalPoids = recoltes.reduce((sum, r) => sum + (parseFloat(r.poids_grammes || r.poids || 0)), 0);
      const totalValeur = recoltes.reduce((sum, r) => sum + (parseFloat(r.valeur || r.prix || 0)), 0);
      const arbresAvecRecoltes = new Set(recoltes.map(r => r.arbre_id).filter(Boolean));

      const summary = {
        totalRecoltes: recoltes.length,
        totalPoids: totalPoids,
        totalValeur: totalValeur,
        moyennePoids: recoltes.length > 0 ? totalPoids / recoltes.length : 0,
        totalArbres: arbres.length,
        arbresProductifs: arbresAvecRecoltes.size,
        totalParcelles: parcelles.length,
        totalInterventions: interventions.length,
        interventionsTerminees: interventions.filter(i => i.statut === 'Terminé').length,
        coutInterventions: interventions.reduce((sum, i) => sum + (parseFloat(i.cout) || 0), 0)
      };

      // === Production par parcelle ===
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

      // === Production par arbre ===
      const arbreStats = {};
      recoltes.forEach(r => {
        const arbreId = r.arbre_id;
        if (!arbreId) return;
        
        if (!arbreStats[arbreId]) {
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

      // === Ventes par mois ===
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
        if (!prodAnnuelle[annee]) {
          prodAnnuelle[annee] = { kg: 0, count: 0, valeur: 0 };
        }
        prodAnnuelle[annee].kg += parseFloat(r.poids_grammes || r.poids || 0) / 1000;
        prodAnnuelle[annee].count += 1;
        prodAnnuelle[annee].valeur += parseFloat(r.valeur || r.prix || 0);
      });

      const productionAnnuelle = Object.entries(prodAnnuelle).map(([annee, data]) => ({
        annee: parseInt(annee),
        kg: parseFloat(data.kg.toFixed(2)),
        nombre_recoltes: data.count,
        valeur: data.valeur,
        moyenne_g: data.count > 0 ? (data.kg * 1000 / data.count).toFixed(0) : 0
      })).sort((a, b) => a.annee - b.annee);

      // === Production mensuelle (pour l'année en cours) ===
      const productionMensuelle = [];
      const currentYear = new Date().getFullYear();
      for (let m = 1; m <= 12; m++) {
        const recoltesMonth = recoltes.filter(r => {
          if (!r.date_recolte) return false;
          const d = new Date(r.date_recolte);
          return d.getFullYear() === currentYear && d.getMonth() + 1 === m;
        });
        productionMensuelle.push({
          mois: new Date(2024, m - 1, 1).toLocaleDateString('fr-FR', { month: 'short' }),
          kg: recoltesMonth.reduce((sum, r) => sum + (parseFloat(r.poids_grammes || 0) / 1000), 0),
          count: recoltesMonth.length
        });
      }

      // === Interventions par type ===
      const interventionsByType = {};
      interventions.forEach(i => {
        const type = i.type_nom || 'Autre';
        if (!interventionsByType[type]) {
          interventionsByType[type] = { count: 0, cout: 0 };
        }
        interventionsByType[type].count += 1;
        interventionsByType[type].cout += parseFloat(i.cout) || 0;
      });

      const statsInterventions = Object.entries(interventionsByType).map(([type, data]) => ({
        type,
        count: data.count,
        cout: data.cout
      })).sort((a, b) => b.count - a.count);

      // === Expositions par arbre ===
      const expositionStats = {};
      recoltes.forEach(r => {
        const arbreId = r.arbre_id;
        if (!arbreId) return;
        
        if (!expositionStats[arbreId]) {
          const arbreInfo = arbres.find(a => a.id === arbreId) || {};
          expositionStats[arbreId] = {
            id: arbreId,
            numero: arbreInfo.numero || r.arbre_numero || `Arbre ${arbreId}`,
            espece: arbreInfo.espece || r.espece || '-',
            parcelle: arbreInfo.parcelle_nom || r.parcelle_nom || '-',
            total_recoltes: 0,
            expositions: {}
          };
          EXPOSITIONS.forEach(e => {
            expositionStats[arbreId].expositions[e.value] = { count: 0, poids: 0 };
          });
        }
        
        expositionStats[arbreId].total_recoltes += 1;
        
        if (r.exposition && expositionStats[arbreId].expositions[r.exposition]) {
          expositionStats[arbreId].expositions[r.exposition].count += 1;
          expositionStats[arbreId].expositions[r.exposition].poids += parseFloat(r.poids_grammes || 0);
        }
      });

      const statsExpositions = Object.values(expositionStats).map(stat => {
        const expositionsArray = Object.entries(stat.expositions).map(([expo, data]) => ({
          exposition: expo,
          count: data.count,
          poids: data.poids
        }));
        
        const expositionDominante = expositionsArray.reduce((max, curr) => 
          curr.count > max.count ? curr : max, 
          { exposition: '-', count: 0 }
        );
        
        const totalAvecExpo = expositionsArray.reduce((sum, e) => sum + e.count, 0);
        
        return {
          ...stat,
          expositionsArray,
          expositionDominante: expositionDominante.count > 0 ? expositionDominante.exposition : '-',
          nbExpositionDominante: expositionDominante.count,
          pourcentageDominante: totalAvecExpo > 0 ? ((expositionDominante.count / totalAvecExpo) * 100).toFixed(0) : 0
        };
      }).filter(s => s.total_recoltes > 0).sort((a, b) => b.total_recoltes - a.total_recoltes);

      setStats({
        parcelles: statsParParcelle,
        arbres: statsParArbre,
        ventes: statsVentes,
        productionAnnuelle,
        productionMensuelle,
        expositions: statsExpositions,
        interventions: statsInterventions,
        summary
      });
      setLoading(false);
    } catch (error) {
      console.error('Erreur lors du chargement des statistiques:', error);
      setLoading(false);
    }
  };

  // Années disponibles
  const anneesDisponibles = useMemo(() => {
    const annees = stats.productionAnnuelle.map(p => p.annee);
    return [...new Set(annees)].sort((a, b) => b - a);
  }, [stats.productionAnnuelle]);

  // Données globales d'exposition pour le graphique
  const globalExpositionData = EXPOSITIONS.map(expo => {
    const total = stats.expositions.reduce((sum, arbre) => {
      const expoData = arbre.expositionsArray.find(e => e.exposition === expo.value);
      return sum + (expoData ? expoData.count : 0);
    }, 0);
    return {
      name: expo.label,
      value: total,
      short: expo.short
    };
  }).filter(d => d.value > 0);

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

      {/* Navigation par onglets */}
      <div style={{ 
        marginBottom: '2rem', 
        display: 'flex', 
        gap: '0.5rem', 
        borderBottom: '2px solid #e0e0e0', 
        paddingBottom: '0.5rem', 
        flexWrap: 'wrap' 
      }}>
        <button 
          className={`btn ${selectedView === 'dashboard' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setSelectedView('dashboard')}
        >
          📊 Tableau de bord
        </button>
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
          className={`btn ${selectedView === 'expositions' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setSelectedView('expositions')}
        >
          🧭 Expositions
        </button>
        <button 
          className={`btn ${selectedView === 'interventions' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setSelectedView('interventions')}
        >
          🔧 Interventions
        </button>
        <button 
          className={`btn ${selectedView === 'ventes' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setSelectedView('ventes')}
        >
          💰 Ventes
        </button>
      </div>

      {/* Vue Tableau de bord */}
      {selectedView === 'dashboard' && (
        <>
          {/* Cartes de résumé */}
          <div className="stats-grid" style={{ marginBottom: '2rem' }}>
            <div className="card">
              <div className="card-title">🍄 Récoltes totales</div>
              <div className="card-value">{stats.summary.totalRecoltes}</div>
              <div style={{ fontSize: '0.85rem', color: '#666' }}>
                {(stats.summary.totalPoids / 1000).toFixed(2)} kg au total
              </div>
            </div>
            <div className="card">
              <div className="card-title">⚖️ Poids moyen</div>
              <div className="card-value">{stats.summary.moyennePoids.toFixed(0)} g</div>
              <div style={{ fontSize: '0.85rem', color: '#666' }}>
                par truffe récoltée
              </div>
            </div>
            <div className="card">
              <div className="card-title">💰 Valeur totale</div>
              <div className="card-value">{stats.summary.totalValeur.toFixed(0)} €</div>
              <div style={{ fontSize: '0.85rem', color: '#666' }}>
                de production
              </div>
            </div>
            <div className="card">
              <div className="card-title">🌳 Arbres productifs</div>
              <div className="card-value">{stats.summary.arbresProductifs}</div>
              <div style={{ fontSize: '0.85rem', color: '#666' }}>
                sur {stats.summary.totalArbres} arbres ({stats.summary.totalArbres > 0 ? ((stats.summary.arbresProductifs / stats.summary.totalArbres) * 100).toFixed(0) : 0}%)
              </div>
            </div>
            <div className="card">
              <div className="card-title">🗺️ Parcelles</div>
              <div className="card-value">{stats.summary.totalParcelles}</div>
              <div style={{ fontSize: '0.85rem', color: '#666' }}>
                en exploitation
              </div>
            </div>
            <div className="card">
              <div className="card-title">🔧 Interventions</div>
              <div className="card-value">{stats.summary.totalInterventions}</div>
              <div style={{ fontSize: '0.85rem', color: '#666' }}>
                {stats.summary.interventionsTerminees} terminées • {stats.summary.coutInterventions?.toFixed(0) || 0} € de coûts
              </div>
            </div>
          </div>

          {/* Graphiques résumés */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
            {/* Évolution annuelle */}
            {stats.productionAnnuelle && stats.productionAnnuelle.length > 0 && (
              <div style={{ background: 'white', padding: '1.5rem', borderRadius: '12px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
                <h4 style={{ color: '#2c5f2d', marginBottom: '1rem' }}>📈 Évolution annuelle</h4>
                <ResponsiveContainer width="100%" height={250}>
                  <AreaChart data={stats.productionAnnuelle}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="annee" />
                    <YAxis />
                    <Tooltip formatter={(value, name) => [name === 'kg' ? `${value} kg` : value, name === 'kg' ? 'Production' : 'Récoltes']} />
                    <Area type="monotone" dataKey="kg" stroke="#2c5f2d" fill="#97bc62" fillOpacity={0.6} name="kg" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Top 5 arbres */}
            {stats.arbres.length > 0 && (
              <div style={{ background: 'white', padding: '1.5rem', borderRadius: '12px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
                <h4 style={{ color: '#2c5f2d', marginBottom: '1rem' }}>🏆 Top 5 arbres producteurs</h4>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={stats.arbres.slice(0, 5)} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="numero" type="category" width={70} />
                    <Tooltip formatter={(value) => [`${(value / 1000).toFixed(2)} kg`, 'Production']} />
                    <Bar dataKey="poids_total_g" fill="#27ae60" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Répartition par parcelle */}
            {stats.parcelles.length > 0 && (
              <div style={{ background: 'white', padding: '1.5rem', borderRadius: '12px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
                <h4 style={{ color: '#2c5f2d', marginBottom: '1rem' }}>🗺️ Production par parcelle</h4>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={stats.parcelles.slice(0, 6).map(p => ({ name: p.parcelle, value: p.poids_total_g }))}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                      label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    >
                      {stats.parcelles.slice(0, 6).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => [`${(value / 1000).toFixed(2)} kg`, 'Production']} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Interventions par type */}
            {stats.interventions.length > 0 && (
              <div style={{ background: 'white', padding: '1.5rem', borderRadius: '12px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
                <h4 style={{ color: '#2c5f2d', marginBottom: '1rem' }}>🔧 Interventions par type</h4>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={stats.interventions.slice(0, 6)}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="type" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill="#3498db" name="Nombre" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </>
      )}

      {/* Vue Production */}
      {selectedView === 'production' && (
        <>
          {/* Filtre par année */}
          {anneesDisponibles.length > 1 && (
            <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <span style={{ fontWeight: '500', color: '#666' }}>Filtrer par année :</span>
              <select 
                value={selectedAnnee} 
                onChange={(e) => setSelectedAnnee(e.target.value)}
                style={{ padding: '0.5rem 1rem', borderRadius: '6px', border: '1px solid #ddd' }}
              >
                <option value="all">Toutes les années</option>
                {anneesDisponibles.map(annee => (
                  <option key={annee} value={annee}>{annee}</option>
                ))}
              </select>
            </div>
          )}

          {/* Évolution annuelle */}
          {stats.productionAnnuelle && stats.productionAnnuelle.length > 0 && (
            <div style={{ background: 'white', padding: '1.5rem', borderRadius: '12px', marginBottom: '2rem', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
              <h3 style={{ color: '#2c5f2d', marginBottom: '1rem' }}>📊 Évolution de la production annuelle</h3>
              <ResponsiveContainer width="100%" height={350}>
                <LineChart data={stats.productionAnnuelle}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="annee" />
                  <YAxis yAxisId="left" label={{ value: 'kg', angle: -90, position: 'insideLeft' }} />
                  <YAxis yAxisId="right" orientation="right" label={{ value: 'Récoltes', angle: 90, position: 'insideRight' }} />
                  <Tooltip />
                  <Legend />
                  <Line yAxisId="left" type="monotone" dataKey="kg" stroke="#2c5f2d" strokeWidth={3} name="Production (kg)" />
                  <Line yAxisId="right" type="monotone" dataKey="nombre_recoltes" stroke="#f39c12" strokeWidth={2} name="Nb récoltes" />
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
                    <th style={{ textAlign: 'center' }}>Nb récoltes</th>
                    <th style={{ textAlign: 'right' }}>Production</th>
                    <th style={{ textAlign: 'right' }}>Poids moyen</th>
                    <th style={{ textAlign: 'right' }}>Valeur</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.parcelles
                    .filter(p => selectedAnnee === 'all' || p.annee === parseInt(selectedAnnee))
                    .map((stat, idx) => (
                    <tr key={idx}>
                      <td><strong>{stat.parcelle}</strong></td>
                      <td>{stat.annee || '-'}</td>
                      <td style={{ textAlign: 'center' }}>{stat.nombre_recoltes || 0}</td>
                      <td style={{ textAlign: 'right' }}>{stat.poids_total_g ? (stat.poids_total_g / 1000).toFixed(2) : '0.00'} kg</td>
                      <td style={{ textAlign: 'right' }}>{stat.poids_moyen_g ? parseFloat(stat.poids_moyen_g).toFixed(0) : '0'} g</td>
                      <td style={{ textAlign: 'right' }}>{stat.valeur_totale ? parseFloat(stat.valeur_totale).toFixed(2) : '0.00'} €</td>
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
          <h3 style={{ color: '#2c5f2d', marginBottom: '1rem' }}>🌳 Top arbres producteurs</h3>
          {stats.arbres.length === 0 ? (
            <p style={{ color: '#999', padding: '1rem' }}>Aucune donnée disponible</p>
          ) : (
            <>
              <div style={{ background: 'white', padding: '1.5rem', borderRadius: '12px', marginBottom: '2rem', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={stats.arbres.slice(0, 15)} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" label={{ value: 'grammes', position: 'insideRight' }} />
                    <YAxis dataKey="numero" type="category" width={80} />
                    <Tooltip formatter={(value) => [`${(value / 1000).toFixed(2)} kg`, 'Production']} />
                    <Bar dataKey="poids_total_g" fill="#27ae60" name="Production (g)" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <table>
                <thead>
                  <tr>
                    <th style={{ width: '50px', textAlign: 'center' }}>#</th>
                    <th>Numéro</th>
                    <th>Espèce</th>
                    <th>Parcelle</th>
                    <th style={{ textAlign: 'center' }}>Nb récoltes</th>
                    <th style={{ textAlign: 'right' }}>Production</th>
                    <th style={{ textAlign: 'right' }}>Moyenne</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.arbres.slice(0, 30).map((stat, idx) => (
                    <tr key={stat.id}>
                      <td style={{ textAlign: 'center' }}>
                        {idx < 3 ? (
                          <span style={{ fontSize: '1.2rem' }}>
                            {idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉'}
                          </span>
                        ) : (
                          <span style={{ color: '#666' }}>{idx + 1}</span>
                        )}
                      </td>
                      <td><strong>{stat.numero}</strong></td>
                      <td>{stat.espece}</td>
                      <td>{stat.parcelle}</td>
                      <td style={{ textAlign: 'center' }}>{stat.nombre_recoltes || 0}</td>
                      <td style={{ textAlign: 'right' }}>
                        <strong>{stat.poids_total_g ? (stat.poids_total_g / 1000).toFixed(2) : '0.00'} kg</strong>
                      </td>
                      <td style={{ textAlign: 'right' }}>{stat.poids_moyen_g ? parseFloat(stat.poids_moyen_g).toFixed(0) : '0'} g</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </>
      )}

      {/* Vue Expositions */}
      {selectedView === 'expositions' && (
        <>
          <h3 style={{ color: '#2c5f2d', marginBottom: '1rem' }}>🧭 Statistiques des expositions de récolte</h3>
          
          {stats.expositions.length === 0 ? (
            <div style={{ 
              background: 'white', 
              padding: '2rem', 
              borderRadius: '12px', 
              textAlign: 'center',
              boxShadow: '0 2px 10px rgba(0,0,0,0.05)'
            }}>
              <p style={{ color: '#999', margin: 0 }}>
                Aucune donnée d'exposition disponible. Ajoutez l'exposition lors de l'enregistrement de vos récoltes.
              </p>
            </div>
          ) : (
            <>
              {/* Graphique global des expositions */}
              {globalExpositionData.length > 0 && (
                <div style={{ 
                  background: 'white', 
                  padding: '1.5rem', 
                  borderRadius: '12px', 
                  marginBottom: '2rem', 
                  boxShadow: '0 2px 10px rgba(0,0,0,0.05)' 
                }}>
                  <h4 style={{ color: '#2c5f2d', marginBottom: '1rem' }}>📊 Répartition globale des expositions</h4>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2rem', alignItems: 'center', justifyContent: 'center' }}>
                    <ResponsiveContainer width={300} height={300}>
                      <PieChart>
                        <Pie
                          data={globalExpositionData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                          outerRadius={100}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {globalExpositionData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={EXPOSURE_COLORS[entry.name] || '#999'} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                    
                    <div style={{ minWidth: '200px' }}>
                      <h5 style={{ marginBottom: '0.5rem', color: '#666' }}>Légende</h5>
                      {globalExpositionData.map((entry, index) => (
                        <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                          <span style={{ 
                            width: '16px', 
                            height: '16px', 
                            background: EXPOSURE_COLORS[entry.name] || '#999',
                            borderRadius: '3px'
                          }}></span>
                          <span>{entry.name}: {entry.value} récolte{entry.value > 1 ? 's' : ''}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Visuels des arbres */}
              <div style={{ 
                background: 'white', 
                padding: '1.5rem', 
                borderRadius: '12px', 
                marginBottom: '2rem', 
                boxShadow: '0 2px 10px rgba(0,0,0,0.05)' 
              }}>
                <h4 style={{ color: '#2c5f2d', marginBottom: '1rem' }}>🌳 Vue de dessus par arbre</h4>
                <p style={{ color: '#666', fontSize: '0.9rem', marginBottom: '1rem' }}>
                  La zone en <span style={{ color: '#e53935', fontWeight: 'bold' }}>rouge</span> indique l'exposition la plus fréquente pour chaque arbre.
                </p>
                
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', 
                  gap: '1rem' 
                }}>
                  {stats.expositions.slice(0, 12).map(arbre => (
                    <ArbreExpositionView
                      key={arbre.id}
                      arbreNumero={arbre.numero}
                      expositionStats={arbre.expositionsArray}
                    />
                  ))}
                </div>
                
                {stats.expositions.length > 12 && (
                  <p style={{ textAlign: 'center', color: '#666', marginTop: '1rem' }}>
                    ... et {stats.expositions.length - 12} autre(s) arbre(s)
                  </p>
                )}
              </div>

              {/* Tableau détaillé */}
              <h4 style={{ color: '#2c5f2d', marginTop: '2rem', marginBottom: '1rem' }}>📋 Détail par arbre</h4>
              <table>
                <thead>
                  <tr>
                    <th>Arbre</th>
                    <th>Parcelle</th>
                    <th style={{ textAlign: 'center' }}>Total récoltes</th>
                    <th>Exposition dominante</th>
                    <th style={{ textAlign: 'center' }}>Nb à cette expo</th>
                    <th style={{ textAlign: 'right' }}>%</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.expositions.map((stat) => (
                    <tr key={stat.id}>
                      <td><strong>{stat.numero}</strong></td>
                      <td>{stat.parcelle}</td>
                      <td style={{ textAlign: 'center' }}>{stat.total_recoltes}</td>
                      <td>
                        {stat.expositionDominante !== '-' ? (
                          <span style={{
                            padding: '0.25rem 0.75rem',
                            borderRadius: '12px',
                            background: EXPOSURE_COLORS[stat.expositionDominante] || '#e53935',
                            color: 'white',
                            fontSize: '0.85rem'
                          }}>
                            {stat.expositionDominante}
                          </span>
                        ) : '-'}
                      </td>
                      <td style={{ textAlign: 'center' }}>{stat.nbExpositionDominante || 0}</td>
                      <td style={{ textAlign: 'right' }}>
                        {stat.pourcentageDominante > 0 ? (
                          <span style={{ fontWeight: 'bold', color: '#2c5f2d' }}>
                            {stat.pourcentageDominante}%
                          </span>
                        ) : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </>
      )}

      {/* Vue Interventions */}
      {selectedView === 'interventions' && (
        <>
          <h3 style={{ color: '#2c5f2d', marginBottom: '1rem' }}>🔧 Statistiques des interventions</h3>
          
          {stats.interventions.length === 0 ? (
            <div style={{ 
              background: 'white', 
              padding: '2rem', 
              borderRadius: '12px', 
              textAlign: 'center',
              boxShadow: '0 2px 10px rgba(0,0,0,0.05)'
            }}>
              <p style={{ color: '#999', margin: 0 }}>
                Aucune donnée d'intervention disponible.
              </p>
            </div>
          ) : (
            <>
              {/* Cartes résumé */}
              <div className="stats-grid" style={{ marginBottom: '2rem' }}>
                <div className="card">
                  <div className="card-title">📋 Total interventions</div>
                  <div className="card-value">{stats.summary.totalInterventions}</div>
                </div>
                <div className="card">
                  <div className="card-title">✅ Terminées</div>
                  <div className="card-value" style={{ color: '#27ae60' }}>{stats.summary.interventionsTerminees}</div>
                </div>
                <div className="card">
                  <div className="card-title">💰 Coût total</div>
                  <div className="card-value">{stats.summary.coutInterventions?.toFixed(0) || 0} €</div>
                </div>
              </div>

              {/* Graphique par type */}
              <div style={{ background: 'white', padding: '1.5rem', borderRadius: '12px', marginBottom: '2rem', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
                <h4 style={{ color: '#2c5f2d', marginBottom: '1rem' }}>📊 Répartition par type</h4>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={stats.interventions}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="type" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="count" fill="#3498db" name="Nombre" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Tableau */}
              <table>
                <thead>
                  <tr>
                    <th>Type d'intervention</th>
                    <th style={{ textAlign: 'center' }}>Nombre</th>
                    <th style={{ textAlign: 'right' }}>Coût total</th>
                    <th style={{ textAlign: 'right' }}>Coût moyen</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.interventions.map((stat, idx) => (
                    <tr key={idx}>
                      <td><strong>{stat.type}</strong></td>
                      <td style={{ textAlign: 'center' }}>{stat.count}</td>
                      <td style={{ textAlign: 'right' }}>{stat.cout.toFixed(2)} €</td>
                      <td style={{ textAlign: 'right' }}>{stat.count > 0 ? (stat.cout / stat.count).toFixed(2) : '0.00'} €</td>
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
            <div style={{ 
              background: 'white', 
              padding: '2rem', 
              borderRadius: '12px', 
              textAlign: 'center',
              boxShadow: '0 2px 10px rgba(0,0,0,0.05)'
            }}>
              <p style={{ color: '#999', margin: 0 }}>
                Aucune donnée de ventes disponible.
              </p>
            </div>
          ) : (
            <>
              {/* Résumé */}
              <div className="stats-grid" style={{ marginBottom: '2rem' }}>
                <div className="card">
                  <div className="card-title">💰 CA total</div>
                  <div className="card-value">
                    {stats.ventes.reduce((sum, v) => sum + (parseFloat(v.chiffre_affaires) || 0), 0).toFixed(0)} €
                  </div>
                </div>
                <div className="card">
                  <div className="card-title">📦 Quantité vendue</div>
                  <div className="card-value">
                    {(stats.ventes.reduce((sum, v) => sum + (parseFloat(v.quantite_vendue_g) || 0), 0) / 1000).toFixed(2)} kg
                  </div>
                </div>
                <div className="card">
                  <div className="card-title">💵 Prix moyen/kg</div>
                  <div className="card-value">
                    {(() => {
                      const totalCA = stats.ventes.reduce((sum, v) => sum + (parseFloat(v.chiffre_affaires) || 0), 0);
                      const totalKg = stats.ventes.reduce((sum, v) => sum + (parseFloat(v.quantite_vendue_g) || 0), 0) / 1000;
                      return totalKg > 0 ? (totalCA / totalKg).toFixed(0) : 0;
                    })()} €
                  </div>
                </div>
              </div>

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
                    <th style={{ textAlign: 'center' }}>Nb ventes</th>
                    <th style={{ textAlign: 'right' }}>Quantité</th>
                    <th style={{ textAlign: 'right' }}>CA</th>
                    <th style={{ textAlign: 'right' }}>Prix moyen/kg</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.ventes.map((stat, idx) => (
                    <tr key={idx}>
                      <td><strong>{stat.mois}/{stat.annee}</strong></td>
                      <td style={{ textAlign: 'center' }}>{stat.nombre_ventes}</td>
                      <td style={{ textAlign: 'right' }}>{stat.quantite_vendue_g ? (stat.quantite_vendue_g / 1000).toFixed(2) : '0.00'} kg</td>
                      <td style={{ textAlign: 'right' }}><strong>{stat.chiffre_affaires ? parseFloat(stat.chiffre_affaires).toFixed(2) : '0.00'} €</strong></td>
                      <td style={{ textAlign: 'right' }}>{stat.prix_moyen_kg ? parseFloat(stat.prix_moyen_kg).toFixed(2) : '0.00'} €</td>
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
