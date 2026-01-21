import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  safeParseFloat,
  safeArray,
  formatWeight
} from '../utils/safeDataHandling';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area } from 'recharts';

const API_URL = process.env.REACT_APP_API_URL || 
  (process.env.NODE_ENV === 'production' 
    ? null
    : 'http://localhost:3001/api');

if (!API_URL) {
  throw new Error('REACT_APP_API_URL must be defined in production');
}

// Couleurs cohérentes
const COLORS = {
  primary: '#2c5f2d',
  primaryLight: '#4a8b4c',
  accent: '#8b5a2b',
  success: '#27ae60',
  warning: '#f39c12',
  danger: '#e74c3c',
  info: '#3498db',
  muted: '#95a5a6',
  dark: '#2c3e50',
  light: '#ecf0f1',
  yearColors: ['#2c5f2d', '#4a8b4c', '#8b5a2b', '#3498db', '#e74c3c', '#9b59b6', '#16a085', '#f39c12']
};

// ==================== COMPOSANT KPI CARD ====================
const KPICard = ({ title, valeur, unite, pct, trend, icon, subtitle }) => {
  const getTrendIcon = () => {
    if (trend === 'up') return '📈';
    if (trend === 'down') return '📉';
    return '➡️';
  };

  const getTrendColor = () => {
    if (trend === 'up') return COLORS.success;
    if (trend === 'down') return COLORS.danger;
    return COLORS.muted;
  };

  return (
    <div style={{
      backgroundColor: '#fff',
      border: `2px solid ${getTrendColor()}`,
      borderRadius: '12px',
      padding: '1.25rem',
      minWidth: '220px',
      flex: 1,
      boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
      transition: 'transform 0.2s, box-shadow 0.2s'
    }}>
      <div style={{ fontSize: '28px', marginBottom: '8px' }}>{icon}</div>
      <h4 style={{ margin: '0 0 6px 0', fontSize: '13px', color: '#666', fontWeight: '500' }}>{title}</h4>
      {subtitle && <p style={{ margin: '0 0 8px 0', fontSize: '11px', color: '#999' }}>{subtitle}</p>}
      <div style={{ fontSize: '32px', fontWeight: 'bold', color: COLORS.primary, lineHeight: 1 }}>
        {valeur} <span style={{ fontSize: '18px', color: '#999', fontWeight: 'normal' }}>{unite}</span>
      </div>
      {pct !== null && pct !== undefined && (
        <div style={{ 
          marginTop: '10px', 
          fontSize: '14px', 
          color: getTrendColor(),
          fontWeight: '600',
          display: 'flex',
          alignItems: 'center',
          gap: '4px'
        }}>
          {getTrendIcon()} {pct > 0 ? '+' : ''}{pct}% vs mois dernier
        </div>
      )}
    </div>
  );
};

// ==================== COMPOSANT ALERTE ====================
const AlertCard = ({ alert }) => {
  const severityColors = {
    danger: COLORS.danger,
    warning: COLORS.warning,
    info: COLORS.info
  };

  const severityBg = {
    danger: '#fee',
    warning: '#fff3cd',
    info: '#d1ecf1'
  };

  return (
    <div style={{
      backgroundColor: severityBg[alert.severity] || '#f8f9fa',
      border: `2px solid ${severityColors[alert.severity]}`,
      borderLeft: `6px solid ${severityColors[alert.severity]}`,
      borderRadius: '8px',
      padding: '14px 16px',
      marginBottom: '12px',
      boxShadow: '0 2px 6px rgba(0,0,0,0.08)'
    }}>
      <div style={{ fontWeight: 'bold', marginBottom: '4px', fontSize: '15px', color: '#333' }}>
        {alert.title}
      </div>
      <div style={{ fontSize: '14px', color: '#666', marginBottom: alert.details ? '8px' : '0' }}>
        {alert.message}
      </div>
      {alert.details && alert.details.length > 0 && (
        <ul style={{ margin: '8px 0 0 0', paddingLeft: '20px', fontSize: '13px' }}>
          {alert.details.map((detail, idx) => (
            <li key={idx} style={{ color: '#555', marginBottom: '3px' }}>{detail}</li>
          ))}
        </ul>
      )}
      {alert.action && (
        <button style={{
          backgroundColor: severityColors[alert.severity],
          color: 'white',
          border: 'none',
          padding: '6px 14px',
          borderRadius: '5px',
          cursor: 'pointer',
          fontSize: '13px',
          marginTop: '10px',
          fontWeight: '500'
        }}>
          {alert.action}
        </button>
      )}
    </div>
  );
};

// Icônes météo
const getWeatherIcon = (iconCode) => {
  const iconMap = {
    '01d': '☀️', '01n': '🌙',
    '02d': '⛅', '02n': '☁️',
    '03d': '☁️', '03n': '☁️',
    '04d': '☁️', '04n': '☁️',
    '09d': '🌧️', '09n': '🌧️',
    '10d': '🌦️', '10n': '🌧️',
    '11d': '⛈️', '11n': '⛈️',
    '13d': '❄️', '13n': '❄️',
    '50d': '🌫️', '50n': '🌫️'
  };
  return iconMap[iconCode] || '🌤️';
};

function Dashboard() {
  // ==================== ÉTATS ====================
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Statistiques principales
  const [stats, setStats] = useState({
    parcelles: { count: 0, surface: 0 },
    arbres: { count: 0, parEtat: [] },
    recoltes: { totalGrammes: 0, count: 0 },
    ventes: { chiffreAffaires: 0, count: 0 },
    interventions: { aVenir: 0 },
    commandes: { enCours: 0 }
  });
  
  // Météo
  const [weather, setWeather] = useState(null);
  const [forecast, setForecast] = useState([]);
  
  // Stock
  const [stockData, setStockData] = useState(null);
  
  // Alertes
  const [alertes, setAlertes] = useState({
    commandesEnAttente: 0,
    ventesEnAttente: 0
  });
  
  // 🆕 PHASE 1: KPIs de tendance
  const [kpis, setKpis] = useState({
    productionTendance: { valeur: 0, pct: 0, trend: 'stable' },
    moyenneParRecolte: { valeur: 0, unite: 'g' },
    productiviteParArbre: { valeur: 0, unite: 'g/arbre' }
  });

  // 🆕 PHASE 1: Alertes intelligentes
  const [intelligentAlertes, setIntelligentAlertes] = useState([]);
  
  // Listes pour les activités récentes
  const [recentRecoltes, setRecentRecoltes] = useState([]);
  const [interventionsAVenir, setInterventionsAVenir] = useState([]);
  const [commandesRecentes, setCommandesRecentes] = useState([]);
  
  // Données pour les graphiques
  const [productionParMois, setProductionParMois] = useState([]);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [availableYears, setAvailableYears] = useState([]);

  // 🆕 PHASE 1 AMÉLIORÉ: Gestion dynamique des années
  const currentYear = new Date().getFullYear();
  const [selectedYearRange, setSelectedYearRange] = useState({
    start: currentYear - 2,
    end: currentYear,
    showAll: false
  });
  const [productionParMoisMultiAnnee, setProductionParMoisMultiAnnee] = useState({});
  const [selectedYears, setSelectedYears] = useState([]);
  const [recoltesData, setRecoltesData] = useState([]);

  // ==================== CHARGEMENT DES DONNÉES ====================
  useEffect(() => {
    loadDashboardData();
    loadWeather();
  }, []);

  // 🆕 ✅ FIX: Initialiser selectedYearRange avec les 3 dernières années DE DONNÉES
  useEffect(() => {
    console.log('🐛 DEBUG LOG 5: availableYears après setState:', availableYears);
    if (availableYears.length > 0) {
      // Prendre les 3 dernières années disponibles dans les données
      const last3Years = availableYears.slice(0, 3);
      console.log('🐛 DEBUG LOG 6: last3Years calculé:', last3Years);
      const minYear = Math.min(...last3Years);
      const maxYear = Math.max(...last3Years);
      
      setSelectedYearRange({
        start: minYear,
        end: maxYear,
        showAll: false
      });
      
      loadAllYearsData();
      setSelectedYears(last3Years);
    }
  }, [availableYears.length]); // Déclencher seulement quand availableYears change

  // 🆕 Mettre à jour selectedYears quand selectedYearRange change
  useEffect(() => {
    if (availableYears.length > 0) {
      const filteredYears = selectedYearRange.showAll 
        ? availableYears 
        : availableYears.filter(y => y >= selectedYearRange.start && y <= selectedYearRange.end);
      setSelectedYears(filteredYears);
    }
  }, [selectedYearRange, availableYears]);

  // Calculer KPIs et alertes quand les données changent
  useEffect(() => {
    if (stats && stockData && weather && productionParMois.length > 0) {
      calculateTrends();
      calculateSmartAlertes();
    }
  }, [stats, stockData, weather, productionParMois, interventionsAVenir]);

  const loadWeather = async () => {
    try {
      const API_KEY = 'bfa869b97ace2b1f8fd373765e64ed64';
      const location = 'Lusseray,FR';
      
      const weatherRes = await fetch(
        `https://api.openweathermap.org/data/2.5/weather?q=${location}&appid=${API_KEY}&units=metric&lang=fr`
      );

      if (weatherRes.ok) {
        const weatherData = await weatherRes.json();
        setWeather({
          temp: Math.round(weatherData.main.temp),
          feels_like: Math.round(weatherData.main.feels_like),
          humidity: weatherData.main.humidity,
          description: weatherData.weather[0].description,
          icon: weatherData.weather[0].icon,
          wind_speed: Math.round(weatherData.wind.speed * 3.6),
          wind_deg: weatherData.wind.deg,
          clouds: weatherData.clouds.all,
          pressure: weatherData.main.pressure,
          visibility: (weatherData.visibility / 1000).toFixed(1),
          city: weatherData.name,
          rain_1h: weatherData.rain?.['1h'] || 0,
          sunrise: new Date(weatherData.sys.sunrise * 1000),
          sunset: new Date(weatherData.sys.sunset * 1000)
        });
      }

      const forecastRes = await fetch(
        `https://api.openweathermap.org/data/2.5/forecast?q=${location}&appid=${API_KEY}&units=metric&lang=fr`
      );

      if (forecastRes.ok) {
        const forecastData = await forecastRes.json();
        const dailyForecast = [];
        const processedDays = new Set();
        
        forecastData.list.forEach(item => {
          const date = new Date(item.dt * 1000);
          const dayKey = date.toDateString();
          const hour = date.getHours();
          
          if (!processedDays.has(dayKey) && (hour >= 11 && hour <= 14)) {
            processedDays.add(dayKey);
            dailyForecast.push({
              date: date,
              temp_max: Math.round(item.main.temp_max),
              temp_min: Math.round(item.main.temp_min),
              icon: item.weather[0].icon,
              pop: Math.round(item.pop * 100),
              rain: item.rain?.['3h'] || 0,
              humidity: item.main.humidity,
              wind_speed: Math.round(item.wind.speed * 3.6),
              description: item.weather[0].description
            });
          }
        });

        setForecast(dailyForecast.slice(0, 5));
      }
    } catch (err) {
      console.error('Erreur météo:', err);
    }
  };

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      const statsRes = await axios.get(`${API_URL}/stats/dashboard`);
      setStats(statsRes.data);

      const [
        recoltesRes,
        interventionsRes,
        commandesRes,
        ventesRes,
        recoltesMensuellesRes,
        stockRes
      ] = await Promise.allSettled([
        axios.get(`${API_URL}/recoltes`).catch(() => ({ data: [] })),
        axios.get(`${API_URL}/interventions`).catch(() => ({ data: [] })),
        axios.get(`${API_URL}/commandes`).catch(() => ({ data: [] })),
        axios.get(`${API_URL}/ventes`).catch(() => ({ data: [] })),
        axios.get(`${API_URL}/stats/recoltes-mensuelles`).catch(() => ({ data: [] })),
        axios.get(`${API_URL}/stock`).catch(() => ({ data: { stock_disponible_grammes: 0 } }))
      ]).then(results => results.map(r => r.status === 'fulfilled' ? r.value : { data: [] }));

      // 🐛 DEBUG LOG 1: Données brutes
      console.log('🐛 DEBUG LOG 1: recoltesMensuellesRes.data =', recoltesMensuellesRes.data);

      setStockData(stockRes.data);
      setRecoltesData(recoltesRes.data || []); // 🆕 Stocker pour calculs par parcelle

      const commandesEnAttente = safeArray(commandesRes.data).filter(c =>
        c && (c.statut === 'En attente' || c.statut === 'Confirmée')
      ).length;
      const ventesEnAttente = safeArray(ventesRes.data).filter(v =>
        v && v.statut === 'En attente'
      ).length;
      setAlertes({ commandesEnAttente, ventesEnAttente });

      const sortedRecoltes = safeArray(recoltesRes.data)
        .filter(r => r)
        .sort((a, b) => new Date(b.date_recolte || 0) - new Date(a.date_recolte || 0))
        .slice(0, 5);

      setRecentRecoltes(sortedRecoltes);

      const today = new Date();
      const sortedInterventions = safeArray(interventionsRes.data)
        .filter(i => i && new Date(i.date_prevue) >= today && i.statut === 'Planifié')
        .sort((a, b) => new Date(a.date_prevue) - new Date(b.date_prevue))
        .slice(0, 5);
      setInterventionsAVenir(sortedInterventions);

      const sortedCommandes = safeArray(commandesRes.data)
        .filter(c => c && c.statut !== 'Annulée' && c.statut !== 'Livrée')
        .sort((a, b) => new Date(b.date_commande) - new Date(a.date_commande))
        .slice(0, 5);
      setCommandesRecentes(sortedCommandes);

      // Production avec années disponibles
      const years = getAvailableYears(recoltesMensuellesRes.data);
      console.log('🐛 DEBUG LOG 4b: years retourné par getAvailableYears =', years);
      setAvailableYears(years);

      setLoading(false);
    } catch (err) {
      console.error('Erreur lors du chargement du tableau de bord:', err);
      setError('Impossible de charger les données du tableau de bord');
      setLoading(false);
    }
  };

  // 🆕 Charger les données pour toutes les années
  const loadAllYearsData = async () => {
    try {
      const allData = {};
      for (const year of availableYears) {
        const res = await axios.get(`${API_URL}/stats/recoltes-mensuelles?year=${year}`).catch(() => ({ data: [] }));
        allData[year] = prepareProductionMensuelle(res.data, year);
      }
      setProductionParMoisMultiAnnee(allData);
      console.log('🐛 DEBUG LOG 7: productionParMoisMultiAnnee chargé =', allData);
    } catch (err) {
      console.error('Erreur chargement données multi-années:', err);
    }
  };

  // Calculer les KPIs de tendance
  const calculateTrends = () => {
    try {
      const thisMonth = new Date().getMonth();
      const lastMonth = thisMonth === 0 ? 11 : thisMonth - 1;

      const productionCeMois = productionParMois[thisMonth]?.production || 0;
      const productionMoisDernier = productionParMois[lastMonth]?.production || 0;
      
      const pct = productionMoisDernier > 0 
        ? Math.round(((productionCeMois - productionMoisDernier) / productionMoisDernier) * 100)
        : 0;

      // Moyenne par récolte
      const totalGrammes = stats.recoltes.totalGrammes || 0;
      const nbRecoltes = stats.recoltes.count || 1;
      const moyenneParRecolte = (totalGrammes / nbRecoltes).toFixed(0);

      // Productivité par arbre
      const nbArbres = stats.arbres.count || 1;
      const productiviteParArbre = (totalGrammes / nbArbres).toFixed(2);

      setKpis({
        productionTendance: { 
          valeur: productionCeMois.toFixed(1),
          pct: pct,
          trend: pct > 0 ? 'up' : pct < 0 ? 'down' : 'stable'
        },
        moyenneParRecolte: { valeur: moyenneParRecolte, unite: 'g' },
        productiviteParArbre: { valeur: productiviteParArbre, unite: 'g/arbre' }
      });
    } catch (err) {
      console.error('Erreur calcul tendances:', err);
    }
  };

  // Calculer les alertes intelligentes
  const calculateSmartAlertes = () => {
    const alertes = [];

    try {
      const today = new Date();

      // 1. Stock critique
      const stockStatus = getStockStatus(stockData?.stock_disponible_grammes || 0);
      if (stockStatus.label === 'Critique' || stockStatus.label === 'Épuisé') {
        alertes.push({
          type: 'stock_critique',
          severity: 'danger',
          title: '🚨 Stock Critique',
          message: `Stock disponible: ${(stockData?.stock_disponible_grammes / 1000).toFixed(1)}kg`,
          action: 'Planifier une récolte d\'urgence'
        });
      }

      // 2. Interventions urgentes (< 3 jours)
      const upcomingInterventions = interventionsAVenir.filter(i => {
        const daysUntil = (new Date(i.date_prevue).getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
        return daysUntil <= 3 && i.statut === 'Planifié';
      });

      if (upcomingInterventions.length > 0) {
        alertes.push({
          type: 'interventions_urgentes',
          severity: 'info',
          title: '🛠️ Interventions prévues sous 3 jours',
          message: `${upcomingInterventions.length} intervention(s) à faire dans les 3 prochains jours`,
          details: upcomingInterventions.map(i => `${i.type_nom || 'Intervention'} - ${i.parcelle_nom}`)
        });
      }

      // 3. Conditions météo défavorables
      if (weather && getRiskLevel(weather).text !== 'Normal') {
        const risk = getRiskLevel(weather);
        alertes.push({
          type: 'meteo',
          severity: risk.text === 'Pluie' || risk.text === 'Gel' ? 'danger' : 'warning',
          title: `${risk.icon} Condition météo défavorable`,
          message: `Risque: ${risk.text} - Température: ${weather.temp}°C, Humidité: ${weather.humidity}%`,
          action: 'Protéger les parcelles'
        });
      }

      // 4. Production en retard (saison automne/hiver)
      const thisMonth = today.getMonth();
      if (thisMonth >= 8 && thisMonth <= 11) { // Sept-Déc
        const avgProduction = productionParMois.reduce((a, b) => a + (b.production || 0), 0) / 12;
        const thisMonthProduction = productionParMois[thisMonth]?.production || 0;
        
        if (thisMonthProduction < avgProduction * 0.7 && avgProduction > 0) {
          alertes.push({
            type: 'retard_production',
            severity: 'warning',
            title: '⚠️ Production en retard',
            message: `Production du mois: ${thisMonthProduction.toFixed(1)}kg vs moyenne: ${avgProduction.toFixed(1)}kg`,
            action: 'Vérifier l\'état des parcelles'
          });
        }
      }

      setIntelligentAlertes(alertes);
    } catch (err) {
      console.error('Erreur calcul alertes:', err);
    }
  };

  // ✅ FIX: Ne récupérer QUE les années avec des données réelles
  const getAvailableYears = (data) => {
    console.log('🐛 DEBUG LOG 2: getAvailableYears - data en entrée =', data);
    
    const years = new Set();
    
    // Extraire les années des données de récoltes mensuelles
    safeArray(data).forEach((item, index) => {
      if (item && item.mois) {
        const year = parseInt(item.mois.split('-')[0]);
        console.log(`🐛 DEBUG LOG 3: Item ${index} - mois: ${item.mois}, année extraite: ${year}`);
        if (!isNaN(year)) years.add(year);
      }
    });
    
    console.log('🐛 DEBUG LOG 4a: years Set final =', years);
    
    // Retourner triées du plus récent au plus ancien
    const result = Array.from(years).sort((a, b) => b - a);
    console.log('🐛 DEBUG LOG 4b: years array trié =', result);
    return result;
  };

  const prepareProductionMensuelle = (data, year) => {
    const result = [];
    const safeData = safeArray(data);
    
    for (let i = 0; i < 12; i++) {
      const d = new Date(year, i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const moisNom = d.toLocaleDateString('fr-FR', { month: 'short' });
      
      const found = safeData.find(item => item && item.mois === key);
      result.push({
        mois: moisNom,
        production: found ? safeParseFloat((found.total_grammes / 1000).toFixed(2), 0) : 0
      });
    }
    
    return result;
  };

  // 🆕 Formater les données pour comparaison multi-années
  const formatComparisonData = () => {
    const monthKeys = ['01','02','03','04','05','06','07','08','09','10','11','12'];
    return monthKeys.map((month, idx) => {
      const moisNom = new Date(2024, idx, 1).toLocaleDateString('fr-FR', { month: 'short' });
      const row = { mois: moisNom };
      
      selectedYears.forEach(year => {
        const data = productionParMoisMultiAnnee[year] || [];
        row[`${year}`] = data[idx]?.production || 0;
      });
      return row;
    });
  };

  // 🆕 Toggle visibilité d'une année
  const toggleYearVisibility = (year) => {
    setSelectedYears(prev => 
      prev.includes(year) 
        ? prev.filter(y => y !== year)
        : [...prev, year].sort((a, b) => b - a)
    );
  };

  // 🆕 Couleur par année
  const getYearColor = (year) => {
    const yearIndex = availableYears.indexOf(year);
    return COLORS.yearColors[yearIndex % COLORS.yearColors.length];
  };

  // 🆕 NOUVEAU: Calculer production par parcelle avec colonnes par année
  const getProductionParParcelleMultiAnnees = () => {
    const prodParParcelle = {};
    
    // Grouper par parcelle et année
    recoltesData.forEach(recolte => {
      if (!recolte || !recolte.date_recolte) return;
      
      const parcelle = recolte.parcelle_nom || 'Non défini';
      const year = new Date(recolte.date_recolte).getFullYear();
      const poids = safeParseFloat(recolte.poids_grammes, 0);
      
      // Filtrer par années sélectionnées
      if (!selectedYears.includes(year)) return;
      
      if (!prodParParcelle[parcelle]) {
        prodParParcelle[parcelle] = {};
      }
      if (!prodParParcelle[parcelle][year]) {
        prodParParcelle[parcelle][year] = 0;
      }
      
      prodParParcelle[parcelle][year] += poids / 1000; // Convertir en kg
    });
    
    // Formater pour le tableau
    return Object.entries(prodParParcelle).map(([nom, annees]) => {
      const row = { nom };
      let total = 0;
      
      selectedYears.forEach(year => {
        const valeur = annees[year] || 0;
        row[year] = parseFloat(valeur.toFixed(2));
        total += valeur;
      });
      
      row.total = parseFloat(total.toFixed(2));
      return row;
    }).sort((a, b) => b.total - a.total);
  };

  // 🆕 Toggle "Afficher toutes les années"
  const toggleShowAll = () => {
    setSelectedYearRange(prev => ({
      ...prev,
      showAll: !prev.showAll
    }));
  };

  // ==================== FONCTIONS UTILITAIRES ====================
  const formatDateShort = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '-';
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  };

  const getDayName = (date) => {
    const today = new Date();
    const tomorrow = new Date(today.getTime() + 24*60*60*1000);
    
    if (date.toDateString() === today.toDateString()) return "Auj.";
    if (date.toDateString() === tomorrow.toDateString()) return "Dem.";
    
    return date.toLocaleDateString('fr-FR', { weekday: 'short' });
  };

  const getStockStatus = (grammes) => {
    if (grammes <= 0) return { label: 'Épuisé', color: COLORS.danger };
    if (grammes < 100) return { label: 'Critique', color: COLORS.danger };
    if (grammes < 500) return { label: 'Faible', color: COLORS.warning };
    if (grammes < 1000) return { label: 'Moyen', color: COLORS.info };
    return { label: 'Bon', color: COLORS.success };
  };

  const getWindDirection = (deg) => {
    const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    const index = Math.round(deg / 22.5) % 16;
    return directions[index];
  };

  const getRiskLevel = (weather) => {
    if (!weather) return { text: '-', color: COLORS.success, icon: '✅' };
    
    const temp = weather.temp;
    const humidity = weather.humidity;
    const rain = weather.rain_1h || 0;
    
    if (rain > 1) return { text: 'Pluie', color: COLORS.danger, icon: '🌧️' };
    if (temp < 5) return { text: 'Gel', color: COLORS.danger, icon: '❄️' };
    if (temp > 25 && humidity < 40) return { text: 'Stress hydrique', color: COLORS.warning, icon: '🔥' };
    if (humidity > 80) return { text: 'Humidité haute', color: COLORS.info, icon: '💧' };
    
    return { text: 'Normal', color: COLORS.success, icon: '✅' };
  };

  // ==================== RENDU CONDITIONNEL ====================
  if (loading) {
    return (
      <div style={styles.pageContainer}>
        <div style={styles.loadingContainer}>
          <div style={styles.loadingIcon}>🍄</div>
          <div style={styles.loadingText}>Chargement du tableau de bord...</div>
          <div style={styles.loadingBar}>
            <div style={styles.loadingProgress}></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.pageContainer}>
        <div style={styles.errorContainer}>
          <span style={{ fontSize: '3rem' }}>⚠️</span>
          <p style={{ color: COLORS.danger }}>{error}</p>
          <button onClick={loadDashboardData} style={styles.retryButton}>
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  const stockStatus = getStockStatus(stockData?.stock_disponible_grammes || 0);
  const riskLevel = getRiskLevel(weather);
  const productionParParcelleData = getProductionParParcelleMultiAnnees();

  // ==================== RENDU PRINCIPAL ====================
  return (
    <div style={styles.pageContainer}>
      <div style={{
        padding: '1rem',
        background: '#fff3cd',
        border: '2px solid #ff9800',
        borderRadius: '8px',
        marginBottom: '1rem'
      }}>
        <strong>🐛 MODE DEBUG ACTIVÉ</strong> - Ouvrez la console du navigateur (F12) pour voir les logs
      </div>
      
      {/* ... reste du code identique ... */}
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <h3>Dashboard en mode DEBUG</h3>
        <p>Consultez la console navigateur pour les logs de débogage</p>
      </div>
    </div>
  );
}

// ==================== STYLES ====================
const styles = {
  pageContainer: {
    padding: '1.5rem',
    maxWidth: '1600px',
    margin: '0 auto',
    fontFamily: "'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif"
  },
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '60vh',
    gap: '1rem'
  },
  loadingIcon: {
    fontSize: '4rem',
    animation: 'loadingPulse 1.5s ease-in-out infinite'
  },
  loadingText: {
    color: COLORS.muted,
    fontSize: '1.1rem'
  },
  loadingBar: {
    width: '200px',
    height: '4px',
    background: '#eee',
    borderRadius: '4px',
    overflow: 'hidden'
  },
  loadingProgress: {
    width: '100%',
    height: '100%',
    background: `linear-gradient(90deg, ${COLORS.primary}, ${COLORS.primaryLight})`,
    animation: 'loadingBar 1.5s ease-in-out infinite'
  },
  errorContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '50vh',
    gap: '1rem'
  },
  retryButton: {
    padding: '0.75rem 1.5rem',
    background: COLORS.primary,
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '1rem'
  }
};

export default Dashboard;