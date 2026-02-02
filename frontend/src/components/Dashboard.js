import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  safeParseFloat,
  safeArray,
  formatWeight
} from '../utils/safeDataHandling';
import { isInSeason } from '../utils/seasonUtils';
import SeasonWidget from './dashboard/SeasonWidget';
import OffSeasonWidget from './dashboard/OffSeasonWidget';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area } from 'recharts';

const API_URL = process.env.REACT_APP_API_URL || 
  (process.env.NODE_ENV === 'production' 
    ? null
    : 'http://localhost:3001/api');

if (!API_URL) {
  throw new Error('REACT_APP_API_URL must be defined in production');
}

// Configuration Météo Concept
const METEO_CONFIG = {
  TOKEN: process.env.REACT_APP_METEO_CONCEPT_TOKEN || '',
  INSEE_CODE: '79170', // Lusseray
  LATITUDE: 46.1465496,
  LONGITUDE: -0.1639706,
  USE_METEO_CONCEPT: process.env.REACT_APP_USE_METEO_CONCEPT === 'true'
};

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
const getWeatherIcon = (code) => {
  // Codes Météo Concept
  if (typeof code === 'number') {
    if (code <= 2) return '☀️';
    if (code <= 4) return '⛅';
    if (code <= 6) return '☁️';
    if (code <= 9) return '🌧️';
    if (code <= 12) return '⛈️';
    if (code <= 15) return '❄️';
    if (code <= 19) return '🌫️';
    return '🌤️';
  }
  
  // Codes OpenWeatherMap (fallback)
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
  return iconMap[code] || '🌤️';
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
  
  // Météo (ancien système)
  const [weather, setWeather] = useState(null);
  const [forecast, setForecast] = useState([]);
  
  // Météo enrichie (Météo Concept)
  const [weatherEnriched, setWeatherEnriched] = useState(null);
  const [truffleAlerts, setTruffleAlerts] = useState([]);
  
  // Stock
  const [stockData, setStockData] = useState(null);
  
  // Alertes
  const [alertes, setAlertes] = useState({
    commandesEnAttente: 0,
    ventesEnAttente: 0
  });
  
  // KPIs de tendance
  const [kpis, setKpis] = useState({
    productionTendance: { valeur: 0, pct: 0, trend: 'stable' },
    moyenneParRecolte: { valeur: 0, unite: 'g' },
    productiviteParArbre: { valeur: 0, unite: 'g/arbre' }
  });

  // Alertes intelligentes
  const [intelligentAlertes, setIntelligentAlertes] = useState([]);
  
  // Listes pour les activités récentes
  const [recentRecoltes, setRecentRecoltes] = useState([]);
  const [interventionsAVenir, setInterventionsAVenir] = useState([]);
  const [commandesRecentes, setCommandesRecentes] = useState([]);
  
  // Données pour les graphiques
  const [productionParMois, setProductionParMois] = useState([]);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [availableYears, setAvailableYears] = useState([]);

  // Gestion dynamique des années
  const currentYear = new Date().getFullYear();
  const [selectedYearRange, setSelectedYearRange] = useState({
    start: currentYear - 2,
    end: currentYear,
    showAll: false
  });
  const [productionParMoisMultiAnnee, setProductionParMoisMultiAnnee] = useState({});
  const [selectedYears, setSelectedYears] = useState([]);
  const [recoltesData, setRecoltesData] = useState([]);
  const [recolteMensuellesBrutes, setRecolteMensuellesBrutes] = useState([]);

  // ==================== CHARGEMENT DES DONNÉES ====================
  useEffect(() => {
    loadDashboardData();
    // Charger météo enrichie si token disponible
    if (METEO_CONFIG.USE_METEO_CONCEPT && METEO_CONFIG.TOKEN) {
      loadWeatherEnriched();
    } else {
      loadWeather(); // Fallback OpenWeatherMap
    }
  }, []);

  // Initialiser selectedYearRange avec les 3 dernières années
  useEffect(() => {
    if (availableYears.length > 0) {
      const last3Years = availableYears.slice(0, 3);
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
  }, [availableYears.length]);

  useEffect(() => {
    if (availableYears.length > 0) {
      const filteredYears = selectedYearRange.showAll 
        ? availableYears 
        : availableYears.filter(y => y >= selectedYearRange.start && y <= selectedYearRange.end);
      setSelectedYears(filteredYears);
    }
  }, [selectedYearRange, availableYears]);

  useEffect(() => {
    if (recolteMensuellesBrutes.length > 0) {
      const parMois = Array.from({length: 12}, (_, i) => ({ 
        mois: i,
        production: 0, 
        count: 0 
      }));
      
      recolteMensuellesBrutes.forEach(item => {
        if (!item || !item.mois) return;
        
        const [year, month] = item.mois.split('-');
        const monthIndex = parseInt(month) - 1;
        
        if (monthIndex >= 0 && monthIndex < 12) {
          parMois[monthIndex].production += safeParseFloat(item.total_grammes, 0) / 1000;
          parMois[monthIndex].count += parseInt(item.nombre_recoltes) || 0;
        }
      });
      
      setProductionParMois(parMois);
    }
  }, [recolteMensuellesBrutes]);

  useEffect(() => {
    if (stats && stockData && (weather || weatherEnriched) && productionParMois.length > 0) {
      calculateTrends();
      calculateSmartAlertes();
    }
  }, [stats, stockData, weather, weatherEnriched, productionParMois, interventionsAVenir]);

  // ==================== MÉTÉO ENRICHIE (MÉTÉO CONCEPT) ====================
  const loadWeatherEnriched = async () => {
    try {
      const url = `https://api.meteo-concept.com/api/forecast/daily?token=${METEO_CONFIG.TOKEN}&insee=${METEO_CONFIG.INSEE_CODE}`;
      const res = await fetch(url);
      
      if (!res.ok) {
        console.error('Météo Concept API error:', res.status);
        loadWeather(); // Fallback
        return;
      }
      
      const data = await res.json();
      
      const processedForecast = data.forecast.map(day => ({
        date: new Date(day.datetime),
        day: day.day,
        temp_min: day.tmin,
        temp_max: day.tmax,
        rain_mm: day.rr10 || 0,
        rain_max_mm: day.rr1 || 0,
        rain_probability: day.probarain || 0,
        etp_mm: day.etp || 0,
        frost_probability: day.probafrost || 0,
        fog_probability: day.probafog || 0,
        sun_hours: day.sun_hours || 0,
        wind_speed: day.wind10m || 0,
        weather_code: day.weather || 0,
        humidity: estimateHumidity(day.probarain || 0),
        dew_point: calculateDewPoint(day.tmax, estimateHumidity(day.probarain || 0)),
        favorable: evaluateTruffleConditions(day)
      }));
      
      const today = processedForecast[0];
      const next7Days = processedForecast.slice(0, 7);
      const next14Days = processedForecast;
      
      const rainCumul7d = next7Days.reduce((sum, d) => sum + d.rain_mm, 0);
      const rainCumul14d = next14Days.reduce((sum, d) => sum + d.rain_mm, 0);
      const etpCumul7d = next7Days.reduce((sum, d) => sum + d.etp_mm, 0);
      const etpCumul14d = next14Days.reduce((sum, d) => sum + d.etp_mm, 0);
      const bilanHydrique7d = rainCumul7d - etpCumul7d;
      const bilanHydrique14d = rainCumul14d - etpCumul14d;
      const degreeDays = calculateDegreeDaysSeason();
      
      setWeatherEnriched({
        city: data.city?.name || 'Notre-Dame-des-Landes',
        today: today,
        forecast7d: next7Days,
        forecast14d: next14Days,
        aggregates: {
          rainCumul7d,
          rainCumul14d,
          etpCumul7d,
          etpCumul14d,
          bilanHydrique7d,
          bilanHydrique14d,
          degreeDays
        }
      });
      
      calculateTruffleAlerts(processedForecast, {
        rainCumul7d,
        rainCumul14d,
        bilanHydrique14d,
        degreeDays
      });
      
    } catch (err) {
      console.error('Erreur météo enrichie:', err);
      loadWeather(); // Fallback
    }
  };

  // ==================== CALCULS MÉTÉO ====================
  const calculateDewPoint = (temp, humidity) => {
    const a = 17.27;
    const b = 237.7;
    const alpha = ((a * temp) / (b + temp)) + Math.log(humidity / 100);
    return (b * alpha) / (a - alpha);
  };

  const estimateHumidity = (probaRain) => {
    return Math.min(100, 50 + (probaRain * 0.5));
  };

  const evaluateTruffleConditions = (day) => {
    let score = 0;
    
    if (day.tmin >= 10 && day.tmax <= 20) score += 3;
    else if (day.tmin >= 5 && day.tmax <= 25) score += 1;
    
    const rainMm = day.rr10 || day.rain_mm || 0;
    if (rainMm >= 5 && rainMm <= 15) score += 2;
    else if (rainMm > 0 && rainMm < 5) score += 1;
    
    if ((day.probafrost || day.frost_probability || 0) < 20) score += 1;
    
    if ((day.etp || day.etp_mm || 0) < 5) score += 1;
    
    return score >= 4;
  };

  const calculateDegreeDaysSeason = () => {
    const today = new Date();
    const year = today.getMonth() >= 8 ? today.getFullYear() : today.getFullYear() - 1;
    const seasonStart = new Date(year, 8, 1);
    const daysSinceSeason = Math.floor((today - seasonStart) / (1000 * 60 * 60 * 24));
    const avgTemp = 12;
    const baseTemp = 5;
    return Math.max(0, (avgTemp - baseTemp) * daysSinceSeason);
  };

  const calculateTruffleAlerts = (forecast, aggregates) => {
    const alerts = [];
    
    // Alerte sécheresse
    if (aggregates.bilanHydrique14d < -30) {
      alerts.push({
        type: 'drought_critical',
        severity: 'danger',
        title: '🚨 Déficit Hydrique Critique',
        message: `Bilan hydrique 14j: ${aggregates.bilanHydrique14d.toFixed(1)}mm`,
        details: [
          `Pluies cumulées: ${aggregates.rainCumul14d.toFixed(1)}mm`,
          `ETP cumulée: ${aggregates.etpCumul14d.toFixed(1)}mm`,
          'Irrigation recommandée si possible'
        ],
        action: 'Surveiller humidité du sol'
      });
    } else if (aggregates.bilanHydrique14d < -15) {
      alerts.push({
        type: 'drought_warning',
        severity: 'warning',
        title: '⚠️ Stress Hydrique Modéré',
        message: `Bilan hydrique 14j: ${aggregates.bilanHydrique14d.toFixed(1)}mm`,
        details: ['Déficit hydrique en développement']
      });
    }
    
    // Alerte gel
    const frostDays = forecast.slice(0, 7).filter(d => (d.frost_probability || 0) > 50);
    if (frostDays.length > 0) {
      const dates = frostDays.map(d => 
        d.date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
      ).join(', ');
      
      alerts.push({
        type: 'frost_risk',
        severity: 'danger',
        title: '❄️ Risque de Gel Confirmé',
        message: `Gel probable: ${dates}`,
        details: ['Température minimale < 0°C probable'],
        action: 'Protéger les jeunes plantations'
      });
    }
    
    // Alerte ETP élevée
    if (aggregates.etpCumul7d > 30) {
      alerts.push({
        type: 'high_etp',
        severity: 'warning',
        title: '☀️ Évapotranspiration Élevée',
        message: `ETP 7 jours: ${aggregates.etpCumul7d.toFixed(1)}mm`,
        details: ['Besoin en eau important']
      });
    }
    
    // Conditions favorables
    const favorableDays = forecast.slice(0, 7).filter(d => d.favorable);
    if (favorableDays.length >= 3) {
      alerts.push({
        type: 'favorable_period',
        severity: 'info',
        title: '✅ Période Favorable',
        message: `${favorableDays.length} jours favorables cette semaine`,
        details: ['Conditions météo optimales pour truffes']
      });
    }
    
    setTruffleAlerts(alerts);
  };

  // ==================== MÉTÉO STANDARD (FALLBACK) ====================
  const loadWeather = async () => {
    try {
      const API_KEY = 'bfa869b97ace2b1f8fd373765e64ed64';
      const location = 'Notre-Dame-des-Landes,FR';
      
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
          pressure: weatherData.main.pressure,
          visibility: (weatherData.visibility / 1000).toFixed(1),
          city: weatherData.name,
          rain_1h: weatherData.rain?.['1h'] || 0
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
              humidity: item.main.humidity
            });
          }
        });

        setForecast(dailyForecast.slice(0, 5));
      }
    } catch (err) {
      console.error('Erreur météo:', err);
    }
  };

  // ==================== RESTE DU CODE INCHANGÉ ====================
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

      setStockData(stockRes.data);
      setRecoltesData(recoltesRes.data || []);
      setRecolteMensuellesBrutes(recoltesMensuellesRes.data || []);

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

      const years = getAvailableYears(recoltesMensuellesRes.data);
      setAvailableYears(years);

      setLoading(false);
    } catch (err) {
      console.error('Erreur chargement:', err);
      setError('Impossible de charger les données');
      setLoading(false);
    }
  };

  const loadAllYearsData = async () => {
    try {
      const allData = {};
      for (const year of availableYears) {
        const res = await axios.get(`${API_URL}/stats/recoltes-mensuelles?year=${year}`).catch(() => ({ data: [] }));
        allData[year] = prepareProductionMensuelle(res.data, year);
      }
      setProductionParMoisMultiAnnee(allData);
    } catch (err) {
      console.error('Erreur chargement années:', err);
    }
  };

  const calculateTrends = () => {
    try {
      const thisMonth = new Date().getMonth();
      const lastMonth = thisMonth === 0 ? 11 : thisMonth - 1;

      const productionCeMois = productionParMois[thisMonth]?.production || 0;
      const productionMoisDernier = productionParMois[lastMonth]?.production || 0;
      
      const pct = productionMoisDernier > 0 
        ? Math.round(((productionCeMois - productionMoisDernier) / productionMoisDernier) * 100)
        : 0;

      const totalGrammes = stats.recoltes.totalGrammes || 0;
      const nbRecoltes = stats.recoltes.count || 1;
      const moyenneParRecolte = (totalGrammes / nbRecoltes).toFixed(0);

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

  const calculateSmartAlertes = () => {
    const alertes = [];

    try {
      const stockStatus = getStockStatus(stockData?.stock_disponible_grammes || 0);
      if (stockStatus.label === 'Critique' || stockStatus.label === 'Épuisé') {
        alertes.push({
          severity: 'danger',
          title: '🚨 Stock Critique',
          message: `Stock disponible: ${(stockData?.stock_disponible_grammes / 1000).toFixed(1)}kg`,
          action: 'Planifier une récolte'
        });
      }

      const upcomingInterventions = interventionsAVenir.filter(i => {
        const daysUntil = (new Date(i.date_prevue).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24);
        return daysUntil <= 3;
      });

      if (upcomingInterventions.length > 0) {
        alertes.push({
          severity: 'info',
          title: '🛠️ Interventions sous 3 jours',
          message: `${upcomingInterventions.length} intervention(s) prévue(s)`,
          details: upcomingInterventions.map(i => `${i.type_nom} - ${i.parcelle_nom}`)
        });
      }

      setIntelligentAlertes(alertes);
    } catch (err) {
      console.error('Erreur calcul alertes:', err);
    }
  };

  const getAvailableYears = (data) => {
    const years = new Set();
    safeArray(data).forEach(item => {
      if (item && item.mois) {
        const year = parseInt(item.mois.split('-')[0]);
        if (!isNaN(year)) years.add(year);
      }
    });
    return Array.from(years).sort((a, b) => b - a);
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

  const formatComparisonData = () => {
    const moisOrdre = [
      { nom: 'Juin', index: 6 }, { nom: 'Juil', index: 7 }, { nom: 'Aoû', index: 8 },
      { nom: 'Sep', index: 9 }, { nom: 'Oct', index: 10 }, { nom: 'Nov', index: 11 },
      { nom: 'Déc', index: 12 }, { nom: 'Jan', index: 1 }, { nom: 'Fév', index: 2 },
      { nom: 'Mar', index: 3 }, { nom: 'Avr', index: 4 }, { nom: 'Mai', index: 5 }
    ];
    
    const data = moisOrdre.map(({ nom, index }) => ({ mois: nom, monthIndex: index }));
    
    const filtered = recolteMensuellesBrutes.filter(item => {
      if (!item || !item.mois) return false;
      const [year] = item.mois.split('-').map(Number);
      return selectedYears.includes(year);
    });
    
    filtered.forEach(item => {
      const [year, month] = item.mois.split('-').map(Number);
      const production = safeParseFloat((item.total_grammes / 1000).toFixed(2), 0);
      const dataIndex = moisOrdre.findIndex(m => m.index === month);
      if (dataIndex !== -1 && data[dataIndex]) {
        data[dataIndex][`${year}`] = production;
      }
    });
    
    selectedYears.forEach(year => {
      data.forEach(row => {
        if (!row[`${year}`]) row[`${year}`] = 0;
      });
    });
    
    return data;
  };

  const toggleYearVisibility = (year) => {
    setSelectedYears(prev => 
      prev.includes(year) ? prev.filter(y => y !== year) : [...prev, year].sort((a, b) => b - a)
    );
  };

  const getYearColor = (year) => {
    const yearIndex = availableYears.indexOf(year);
    return COLORS.yearColors[yearIndex % COLORS.yearColors.length];
  };

  const getProductionParParcelleMultiAnnees = () => {
    const prodParParcelle = {};
    
    recoltesData.forEach(recolte => {
      if (!recolte || !recolte.date_recolte) return;
      
      const parcelle = recolte.parcelle_nom || 'Non défini';
      const year = new Date(recolte.date_recolte).getFullYear();
      const poids = safeParseFloat(recolte.poids_grammes, 0);
      
      if (year < selectedYearRange.start || year > selectedYearRange.end) return;
      if (!selectedYears.includes(year)) return;
      
      if (!prodParParcelle[parcelle]) prodParParcelle[parcelle] = {};
      if (!prodParParcelle[parcelle][year]) prodParParcelle[parcelle][year] = 0;
      prodParParcelle[parcelle][year] += poids / 1000;
    });
    
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

  const toggleShowAll = () => {
    setSelectedYearRange(prev => ({ ...prev, showAll: !prev.showAll }));
  };

  const handleStartYearChange = (e) => {
    setSelectedYearRange(prev => ({ ...prev, start: parseInt(e.target.value), showAll: false }));
  };

  const handleEndYearChange = (e) => {
    setSelectedYearRange(prev => ({ ...prev, end: parseInt(e.target.value), showAll: false }));
  };

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
    return directions[Math.round(deg / 22.5) % 16];
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

  // ==================== RENDU ====================
  if (loading) {
    return (
      <div style={styles.pageContainer}>
        <div style={styles.loadingContainer}>
          <div style={styles.loadingIcon}>🍄</div>
          <div style={styles.loadingText}>Chargement...</div>
          <div style={styles.loadingBar}><div style={styles.loadingProgress}></div></div>
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
          <button onClick={loadDashboardData} style={styles.retryButton}>Réessayer</button>
        </div>
      </div>
    );
  }

  const stockStatus = getStockStatus(stockData?.stock_disponible_grammes || 0);
  const riskLevel = getRiskLevel(weather);
  const productionParParcelleData = getProductionParParcelleMultiAnnees();

  return (
    <div style={styles.pageContainer}>
      
      {/* PATRIMOINE */}
      <section style={styles.patrimoneBanner}>
        <div style={styles.patrimoineContent}>
          <div style={styles.patrimoineStat}>
            <div style={styles.patrimoineIcon}>🌳</div>
            <div style={styles.patrimoineStatContent}>
              <div style={styles.patrimoineValue}>{stats.arbres.count}</div>
              <div style={styles.patrimoineLabel}>Arbres truffiers</div>
            </div>
          </div>
          <div style={styles.patrimoineDivider}></div>
          <div style={styles.patrimoineStat}>
            <div style={styles.patrimoineIcon}>📋</div>
            <div style={styles.patrimoineStatContent}>
              <div style={styles.patrimoineValue}>{stats.parcelles.count}</div>
              <div style={styles.patrimoineLabel}>Parcelles</div>
            </div>
          </div>
          <div style={styles.patrimoineDivider}></div>
          <div style={styles.patrimoineStat}>
            <div style={styles.patrimoineIcon}>📐</div>
            <div style={styles.patrimoineStatContent}>
              <div style={styles.patrimoineValue}>{stats.parcelles.surface.toFixed(2)}</div>
              <div style={styles.patrimoineLabel}>Hectares</div>
            </div>
          </div>
        </div>
      </section>
      
      {/* WIDGETS DE SAISON - Affichage conditionnel */}
      {isInSeason() ? (
        <SeasonWidget recoltesData={recoltesData} />
      ) : (
        <OffSeasonWidget recoltesData={recoltesData} />
      )}
      
      {/* MÉTÉO ENRICHIE (si disponible) */}
      {weatherEnriched && weatherEnriched.today && (
        <>
          <section style={styles.weatherBanner}>
            <div style={styles.weatherHeader}>
              <div style={styles.weatherMain}>
                <div style={styles.weatherIcon}>{getWeatherIcon(weatherEnriched.today.weather_code)}</div>
                <div style={styles.weatherTemp}>{weatherEnriched.today.temp_max}°C</div>
                <div style={styles.weatherDetails}>
                  <div style={styles.weatherCity}>📍 {weatherEnriched.city}</div>
                  <div style={styles.weatherDesc}>Météo Truffière</div>
                </div>
              </div>
              
              <div style={styles.weatherGrid}>
                <div style={styles.weatherMetric}>
                  <div style={styles.metricLabel}>Temp min/max</div>
                  <div style={styles.metricValue}>{weatherEnriched.today.temp_min}° / {weatherEnriched.today.temp_max}°</div>
                </div>
                <div style={styles.weatherMetric}>
                  <div style={styles.metricLabel}>Pluie</div>
                  <div style={styles.metricValue}>{weatherEnriched.today.rain_mm}mm</div>
                </div>
                <div style={styles.weatherMetric}>
                  <div style={styles.metricLabel}>ETP</div>
                  <div style={styles.metricValue}>{weatherEnriched.today.etp_mm.toFixed(1)}mm</div>
                </div>
                <div style={styles.weatherMetric}>
                  <div style={styles.metricLabel}>Risque gel</div>
                  <div style={styles.metricValue}>{weatherEnriched.today.frost_probability}%</div>
                </div>
                <div style={styles.weatherMetric}>
                  <div style={styles.metricLabel}>Bilan 14j</div>
                  <div style={{...styles.metricValue, color: weatherEnriched.aggregates.bilanHydrique14d < -15 ? COLORS.danger : COLORS.success}}>
                    {weatherEnriched.aggregates.bilanHydrique14d.toFixed(1)}mm
                  </div>
                </div>
                <div style={{...styles.weatherMetric, ...styles.riskMetric}}>
                  <div style={styles.metricLabel}>État</div>
                  <div style={{...styles.metricValue, color: weatherEnriched.today.favorable ? COLORS.success : COLORS.warning}}>
                    {weatherEnriched.today.favorable ? '✅ Favorable' : '⚠️ Surveiller'}
                  </div>
                </div>
              </div>
            </div>
            
            <div style={styles.weatherDivider}></div>
            
            <div style={styles.forecastSection}>
              <div style={styles.forecastTitle}>⛅ Prévisions 7 jours</div>
              <div style={styles.forecastContainer}>
                {weatherEnriched.forecast7d.map((day, idx) => (
                  <div key={idx} style={styles.forecastDay}>
                    <div style={styles.forecastDayName}>{getDayName(day.date)}</div>
                    <div style={styles.forecastIcon}>{getWeatherIcon(day.weather_code)}</div>
                    <div style={styles.forecastTemps}>
                      <span style={styles.tempMax}>{day.temp_max}°</span>
                      <span style={styles.tempMin}>{day.temp_min}°</span>
                    </div>
                    <div style={styles.forecastMeta}>
                      {day.rain_mm > 0 && (
                        <div style={styles.rainInfo}>🌧️ {day.rain_mm.toFixed(1)}mm</div>
                      )}
                      <div style={styles.humInfo}>ETP {day.etp_mm.toFixed(1)}mm</div>
                    </div>
                    {day.rain_probability > 0 && (
                      <div style={styles.forecastPop}>Pluie {day.rain_probability}%</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* INDICATEURS CRITIQUES TRUFFICULTURE */}
          <section style={{ marginBottom: '2rem' }}>
            <h2 style={styles.sectionTitle}><span>📊</span> Indicateurs Trufficulture (14 jours)</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
              <div style={styles.kpiCard}>
                <div style={{...styles.kpiIconWrapper, background: weatherEnriched.aggregates.bilanHydrique14d < -15 ? COLORS.danger + '20' : COLORS.success + '20'}}>
                  <span style={styles.kpiIcon}>💧</span>
                </div>
                <div style={styles.kpiContent}>
                  <div style={{...styles.kpiValue, color: weatherEnriched.aggregates.bilanHydrique14d < -15 ? COLORS.danger : COLORS.success}}>
                    {weatherEnriched.aggregates.bilanHydrique14d.toFixed(1)} mm
                  </div>
                  <div style={styles.kpiLabel}>Bilan Hydrique</div>
                </div>
                <div style={styles.kpiMeta}>
                  <span style={styles.kpiTag}>Pluie: {weatherEnriched.aggregates.rainCumul14d.toFixed(1)}mm</span>
                  <span style={styles.kpiTag}>ETP: {weatherEnriched.aggregates.etpCumul14d.toFixed(1)}mm</span>
                </div>
              </div>
              
              <div style={styles.kpiCard}>
                <div style={{...styles.kpiIconWrapper, background: COLORS.info + '20'}}>
                  <span style={styles.kpiIcon}>🌧️</span>
                </div>
                <div style={styles.kpiContent}>
                  <div style={{...styles.kpiValue, color: COLORS.info}}>
                    {weatherEnriched.aggregates.rainCumul7d.toFixed(1)} mm
                  </div>
                  <div style={styles.kpiLabel}>Précipitations 7j</div>
                </div>
              </div>
              
              <div style={styles.kpiCard}>
                <div style={{...styles.kpiIconWrapper, background: COLORS.warning + '20'}}>
                  <span style={styles.kpiIcon}>☀️</span>
                </div>
                <div style={styles.kpiContent}>
                  <div style={{...styles.kpiValue, color: COLORS.warning}}>
                    {weatherEnriched.aggregates.etpCumul7d.toFixed(1)} mm
                  </div>
                  <div style={styles.kpiLabel}>Évapotranspiration 7j</div>
                </div>
              </div>
              
              <div style={styles.kpiCard}>
                <div style={{...styles.kpiIconWrapper, background: COLORS.primary + '20'}}>
                  <span style={styles.kpiIcon}>🌡️</span>
                </div>
                <div style={styles.kpiContent}>
                  <div style={{...styles.kpiValue, color: COLORS.primary}}>
                    {weatherEnriched.aggregates.degreeDays.toFixed(0)}
                  </div>
                  <div style={styles.kpiLabel}>Degrés-Jours (base 5°C)</div>
                </div>
                <div style={styles.kpiMeta}>
                  <span style={styles.kpiTag}>Depuis septembre</span>
                </div>
              </div>
            </div>
          </section>
        </>
      )}

      {/* MÉTÉO STANDARD (Fallback si pas Météo Concept) */}
      {!weatherEnriched && weather && (
        <section style={styles.weatherBanner}>
          <div style={styles.weatherHeader}>
            <div style={styles.weatherMain}>
              <div style={styles.weatherIcon}>{getWeatherIcon(weather.icon)}</div>
              <div style={styles.weatherTemp}>{weather.temp}°C</div>
              <div style={styles.weatherDetails}>
                <div style={styles.weatherCity}>📍 {weather.city}</div>
                <div style={styles.weatherDesc}>{weather.description}</div>
              </div>
            </div>
            <div style={styles.weatherGrid}>
              <div style={styles.weatherMetric}>
                <div style={styles.metricLabel}>Ressenti</div>
                <div style={styles.metricValue}>{weather.feels_like}°C</div>
              </div>
              <div style={styles.weatherMetric}>
                <div style={styles.metricLabel}>Humidité</div>
                <div style={styles.metricValue}>{weather.humidity}%</div>
              </div>
              <div style={styles.weatherMetric}>
                <div style={styles.metricLabel}>Vent</div>
                <div style={styles.metricValue}>{weather.wind_speed} km/h</div>
              </div>
              <div style={{...styles.weatherMetric, ...styles.riskMetric}}>
                <div style={styles.metricLabel}>Risque</div>
                <div style={{...styles.metricValue, color: riskLevel.color}}>
                  {riskLevel.icon} {riskLevel.text}
                </div>
              </div>
            </div>
          </div>
          
          {forecast.length > 0 && (
            <>
              <div style={styles.weatherDivider}></div>
              <div style={styles.forecastSection}>
                <div style={styles.forecastTitle}>⛅ Prévisions 5 jours</div>
                <div style={styles.forecastContainer}>
                  {forecast.map((day, idx) => (
                    <div key={idx} style={styles.forecastDay}>
                      <div style={styles.forecastDayName}>{getDayName(day.date)}</div>
                      <div style={styles.forecastIcon}>{getWeatherIcon(day.icon)}</div>
                      <div style={styles.forecastTemps}>
                        <span style={styles.tempMax}>{day.temp_max}°</span>
                        <span style={styles.tempMin}>{day.temp_min}°</span>
                      </div>
                      {day.rain > 0 && (
                        <div style={styles.rainInfo}>🌧️ {day.rain.toFixed(1)}mm</div>
                      )}
                      {day.pop > 0 && (
                        <div style={styles.forecastPop}>Pluie {day.pop}%</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </section>
      )}

      {/* ALERTES TRUFFICULTURE */}
      {truffleAlerts.length > 0 && (
        <section style={{ marginBottom: '2rem' }}>
          <h2 style={styles.sectionTitle}><span>⚠️</span> Alertes Trufficulture</h2>
          <div style={{ background: 'white', padding: '1rem', borderRadius: '12px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
            {truffleAlerts.map((alert, idx) => <AlertCard key={idx} alert={alert} />)}
          </div>
        </section>
      )}

      {/* ALERTES INTELLIGENTES */}
      {intelligentAlertes.length > 0 && (
        <section style={{ marginBottom: '2rem' }}>
          <h2 style={styles.sectionTitle}><span>🔔</span> Alertes Système</h2>
          <div style={{ background: 'white', padding: '1rem', borderRadius: '12px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
            {intelligentAlertes.map((alert, idx) => <AlertCard key={idx} alert={alert} />)}
          </div>
        </section>
      )}

      {/* ALERTES STANDARDS */}
      {(alertes.commandesEnAttente > 0 || alertes.ventesEnAttente > 0) && (
        <section style={styles.alertsSection}>
          {alertes.commandesEnAttente > 0 && (
            <div style={styles.alertCard}>
              <span style={styles.alertIcon}>📦</span>
              <div style={styles.alertContent}>
                <strong>{alertes.commandesEnAttente} commande(s) en attente</strong>
              </div>
            </div>
          )}
          {alertes.ventesEnAttente > 0 && (
            <div style={{...styles.alertCard, ...styles.alertInfo}}>
              <span style={styles.alertIcon}>💳</span>
              <div style={styles.alertContent}>
                <strong>{alertes.ventesEnAttente} vente(s) en attente</strong>
              </div>
            </div>
          )}
        </section>
      )}

      {/* KPIs TENDANCE */}
      <section style={{ marginBottom: '2rem' }}>
        <h2 style={styles.sectionTitle}><span>🎯</span> Indicateurs Production</h2>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          <KPICard 
            title="Production du Mois"
            subtitle="Évolution vs mois dernier"
            valeur={kpis.productionTendance.valeur}
            unite="kg"
            pct={kpis.productionTendance.pct}
            trend={kpis.productionTendance.trend}
            icon="📊"
          />
          <KPICard 
            title="Moyenne par Récolte"
            subtitle="Poids moyen collecté"
            valeur={kpis.moyenneParRecolte.valeur}
            unite={kpis.moyenneParRecolte.unite}
            pct={null}
            trend="stable"
            icon="🎯"
          />
          <KPICard 
            title="Productivité par Arbre"
            subtitle="Rendement moyen"
            valeur={kpis.productiviteParArbre.valeur}
            unite={kpis.productiviteParArbre.unite}
            pct={null}
            trend="stable"
            icon="🌳"
          />
        </div>
      </section>

      {/* KPIs STANDARDS */}
      <section style={styles.kpiSection}>
        <div style={styles.kpiGrid}>
          <div style={{...styles.kpiCard, ...styles.kpiCardAccent}}>
            <div style={{...styles.kpiIconWrapper, background: 'rgba(255,255,255,0.2)'}}>
              <span style={styles.kpiIcon}>🍄</span>
            </div>
            <div style={styles.kpiContent}>
              <div style={{...styles.kpiValue, color: 'white'}}>
                {(stats.recoltes.totalGrammes / 1000).toFixed(2)} kg
              </div>
              <div style={styles.kpiLabel}>Production saison</div>
            </div>
            <div style={styles.kpiMeta}>
              <span style={{...styles.kpiTag, background: 'rgba(255,255,255,0.2)', color: 'white'}}>{stats.recoltes.count} récoltes</span>
            </div>
          </div>

          <div style={styles.kpiCard}>
            <div style={{...styles.kpiIconWrapper, background: stockStatus.color + '20'}}>
              <span style={styles.kpiIcon}>📦</span>
            </div>
            <div style={styles.kpiContent}>
              <div style={{...styles.kpiValue, color: stockStatus.color}}>
                {formatWeight(stockData?.stock_disponible_grammes || 0)}
              </div>
              <div style={styles.kpiLabel}>Stock disponible</div>
            </div>
            <div style={styles.kpiMeta}>
              <span style={{...styles.kpiStatus, background: stockStatus.color}}>{stockStatus.label}</span>
            </div>
          </div>

          <div style={styles.kpiCard}>
            <div style={{...styles.kpiIconWrapper, background: '#27ae6020'}}>
              <span style={styles.kpiIcon}>💰</span>
            </div>
            <div style={styles.kpiContent}>
              <div style={{...styles.kpiValue, color: COLORS.success}}>
                {stats.ventes.chiffreAffaires.toFixed(2)} €
              </div>
              <div style={styles.kpiLabel}>Chiffre d'affaires</div>
            </div>
            <div style={styles.kpiMeta}>
              <span style={styles.kpiTag}>{stats.ventes.count} ventes</span>
            </div>
          </div>

          <div style={styles.kpiCard}>
            <div style={{...styles.kpiIconWrapper, background: '#f39c1220'}}>
              <span style={styles.kpiIcon}>🛠️</span>
            </div>
            <div style={styles.kpiContent}>
              <div style={{...styles.kpiValue, color: stats.interventions.aVenir > 0 ? COLORS.warning : COLORS.success}}>
                {stats.interventions.aVenir}
              </div>
              <div style={styles.kpiLabel}>Interventions prévues</div>
            </div>
          </div>

          <div style={styles.kpiCard}>
            <div style={{...styles.kpiIconWrapper, background: '#3498db20'}}>
              <span style={styles.kpiIcon}>🛍</span>
            </div>
            <div style={styles.kpiContent}>
              <div style={{...styles.kpiValue, color: COLORS.info}}>
                {stats.commandes.enCours}
              </div>
              <div style={styles.kpiLabel}>Commandes en cours</div>
            </div>
          </div>
        </div>
      </section>

      {/* GRAPHIQUES (suite inchangée) */}
      {recolteMensuellesBrutes.length > 0 && (
        <section style={styles.chartSection}>
          <div style={styles.chartCardFull}>
            <div style={styles.chartHeader}>
              <h3 style={styles.chartTitle}>
                <span>📈</span> Comparaison Production Multi-Années {selectedYearRange.showAll ? '(Toutes)' : `(${selectedYearRange.start}-${selectedYearRange.end})`}
              </h3>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                {!selectedYearRange.showAll && (
                  <>
                    <label style={{ fontSize: '14px', fontWeight: '500', marginRight: '4px' }}>De:</label>
                    <select value={selectedYearRange.start} onChange={handleStartYearChange} style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #ddd', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}>
                      {availableYears.map(year => <option key={year} value={year}>{year}</option>)}
                    </select>
                    
                    <label style={{ fontSize: '14px', fontWeight: '500', marginLeft: '8px', marginRight: '4px' }}>À:</label>
                    <select value={selectedYearRange.end} onChange={handleEndYearChange} style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #ddd', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}>
                      {availableYears.map(year => <option key={year} value={year}>{year}</option>)}
                    </select>
                  </>
                )}
                
                <div style={{ width: '1px', height: '24px', background: '#ddd', margin: '0 8px' }}></div>
                
                <button onClick={toggleShowAll} style={{ backgroundColor: selectedYearRange.showAll ? COLORS.primary : '#e0e0e0', color: selectedYearRange.showAll ? 'white' : '#666', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '14px', transition: 'all 0.2s' }}>
                  {selectedYearRange.showAll ? '✓ Toutes les années' : '⊕ Afficher toutes'}
                </button>
                
                <div style={{ width: '1px', height: '24px', background: '#ddd', margin: '0 4px' }}></div>
                
                {availableYears.filter(y => selectedYears.includes(y)).map(year => (
                  <button key={year} onClick={() => toggleYearVisibility(year)} style={{ backgroundColor: selectedYears.includes(year) ? getYearColor(year) : '#e0e0e0', opacity: selectedYears.includes(year) ? 1 : 0.6, color: 'white', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '14px', transition: 'all 0.2s' }}>
                    {year}
                  </button>
                ))}
              </div>
            </div>
            <ResponsiveContainer width="100%" height={350}>
              <LineChart data={formatComparisonData()}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <XAxis dataKey="mois" tick={{ fontSize: 12 }} label={{ value: 'Mois (Saison: Juin-Mai)', position: 'insideBottom', offset: -5, fontSize: 14, fontWeight: 600 }} />
                <YAxis tick={{ fontSize: 12 }} label={{ value: 'Production (kg)', angle: -90, position: 'insideLeft', fontSize: 14, fontWeight: 600 }} />
                <Tooltip formatter={(value) => `${value} kg`} contentStyle={styles.tooltipStyle} />
                <Legend wrapperStyle={{ paddingTop: '10px' }} />
                {selectedYears.map(year => (
                  <Line key={year} type="monotone" dataKey={`${year}`} stroke={getYearColor(year)} strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      <section style={styles.chartSection}>
        <div style={styles.chartCardFull}>
          <div style={styles.chartHeader}>
            <h3 style={styles.chartTitle}>
              <span>📊</span> Production par Parcelle {selectedYearRange.showAll ? '(Toutes années)' : `(${selectedYearRange.start}-${selectedYearRange.end})`}
            </h3>
            <div style={styles.chartMeta}>
              <span style={styles.totalProduction}>
                Total: {productionParParcelleData.reduce((sum, p) => sum + p.total, 0).toFixed(2)} kg
              </span>
            </div>
          </div>
          {productionParParcelleData.length > 0 ? (
            <div style={styles.productionTableMultiYear}>
              <div style={styles.tableHeaderMultiYear}>
                <div style={{...styles.tableCell, flex: 2, fontWeight: '600'}}>Parcelle</div>
                {selectedYears.map(year => (
                  <div key={year} style={{...styles.tableCell, fontWeight: '600', color: getYearColor(year)}}>{year}</div>
                ))}
                <div style={{...styles.tableCell, fontWeight: '700', color: COLORS.primary}}>Total</div>
              </div>
              {productionParParcelleData.map((parcelle, idx) => (
                <div key={idx} style={styles.tableRowMultiYear}>
                  <div style={{...styles.tableCell, flex: 2, fontWeight: '500'}}>{parcelle.nom}</div>
                  {selectedYears.map(year => (
                    <div key={year} style={styles.tableCell}>
                      {parcelle[year] ? `${parcelle[year]} kg` : '-'}
                    </div>
                  ))}
                  <div style={{...styles.tableCell, fontWeight: '700', color: COLORS.primary}}>
                    {parcelle.total} kg
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={styles.noData}>Aucune récolte enregistrée</div>
          )}
        </div>
      </section>

      {/* ACTIVITÉS RÉCENTES */}
      <section style={styles.activitiesSection}>
        <h2 style={styles.sectionTitle}><span>📋</span> Activités récentes</h2>
        
        <div style={styles.activitiesGrid}>
          <div style={styles.activityCard}>
            <div style={styles.activityHeader}>
              <span style={styles.activityHeaderIcon}>🍄</span>
              <span>Dernières récoltes</span>
            </div>
            <div style={styles.activityList}>
              {recentRecoltes.length === 0 ? (
                <div style={styles.activityEmpty}>Aucune récolte</div>
              ) : (
                recentRecoltes.map(recolte => (
                  recolte && (
                    <div key={recolte.id} style={styles.activityItem}>
                      <div style={{...styles.activityDot, background: '#8e44ad'}}></div>
                      <div style={styles.activityContent}>
                        <div style={styles.activityDate}>{formatDateShort(recolte.date_recolte)}</div>
                        <div style={styles.activityTitle}>{recolte.parcelle_nom || 'Parcelle inconnue'}</div>
                        <div style={styles.activityMeta}>
                          {formatWeight(recolte.poids_grammes)}
                          {recolte.espece_nom && ` • ${recolte.espece_nom}`}
                        </div>
                      </div>
                    </div>
                  )
                ))
              )}
            </div>
          </div>

          <div style={styles.activityCard}>
            <div style={styles.activityHeader}>
              <span style={styles.activityHeaderIcon}>🛠️</span>
              <span>Prochaines interventions</span>
            </div>
            <div style={styles.activityList}>
              {interventionsAVenir.length === 0 ? (
                <div style={styles.activityEmpty}>Aucune intervention prévue</div>
              ) : (
                interventionsAVenir.map(inter => (
                  inter && (
                    <div key={inter.id} style={styles.activityItem}>
                      <div style={{...styles.activityDot, background: '#f39c12'}}></div>
                      <div style={styles.activityContent}>
                        <div style={styles.activityDate}>{formatDateShort(inter.date_prevue)}</div>
                        <div style={styles.activityTitle}>{inter.type_nom || 'Intervention'}</div>
                        <div style={styles.activityMeta}>
                          {inter.parcelle_nom}
                          {inter.description && ` • ${inter.description.substring(0, 30)}...`}
                        </div>
                      </div>
                    </div>
                  )
                ))
              )}
            </div>
          </div>

          <div style={styles.activityCard}>
            <div style={styles.activityHeader}>
              <span style={styles.activityHeaderIcon}>📦</span>
              <span>Commandes récentes</span>
            </div>
            <div style={styles.activityList}>
              {commandesRecentes.length === 0 ? (
                <div style={styles.activityEmpty}>Aucune commande</div>
              ) : (
                commandesRecentes.map(cmd => {
                  const statutColors = {
                    'En attente': '#f39c12',
                    'Confirmée': '#3498db',
                    'En préparation': '#9b59b6',
                    'Expédiée': '#1abc9c'
                  };
                  return cmd && (
                    <div key={cmd.id} style={styles.activityItem}>
                      <div style={{...styles.activityDot, background: statutColors[cmd.statut] || '#95a5a6'}}></div>
                      <div style={styles.activityContent}>
                        <div style={styles.activityDate}>{formatDateShort(cmd.date_commande)}</div>
                        <div style={styles.activityTitle}>{cmd.client_nom || 'Client'}</div>
                        <div style={styles.activityMeta}>
                          {cmd.statut}
                          {cmd.total_ttc && ` • ${cmd.total_ttc.toFixed(2)}€`}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

// ==================== STYLES ====================
const styles = {
  pageContainer: {
    padding: '1.5rem',
    maxWidth: '1600px',
    margin: '0 auto',
    backgroundColor: '#f5f5f5'
  },
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '60vh',
    gap: '1.5rem'
  },
  loadingIcon: {
    fontSize: '4rem',
    animation: 'pulse 2s ease-in-out infinite'
  },
  loadingText: {
    fontSize: '1.25rem',
    color: COLORS.muted,
    fontWeight: '600'
  },
  loadingBar: {
    width: '200px',
    height: '4px',
    backgroundColor: '#e0e0e0',
    borderRadius: '4px',
    overflow: 'hidden'
  },
  loadingProgress: {
    height: '100%',
    backgroundColor: COLORS.primary,
    animation: 'loading 1.5s ease-in-out infinite'
  },
  errorContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '60vh',
    gap: '1rem'
  },
  retryButton: {
    padding: '0.75rem 1.5rem',
    backgroundColor: COLORS.primary,
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '1rem',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'background-color 0.2s'
  },
  patrimoneBanner: {
    backgroundColor: 'white',
    borderRadius: '16px',
    padding: '2rem',
    marginBottom: '1.5rem',
    boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
    border: `2px solid ${COLORS.primary}20`
  },
  patrimoineContent: {
    display: 'flex',
    justifyContent: 'space-around',
    alignItems: 'center',
    gap: '2rem'
  },
  patrimoineStat: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    flex: 1
  },
  patrimoineIcon: {
    fontSize: '2.5rem'
  },
  patrimoineStatContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem'
  },
  patrimoineValue: {
    fontSize: '2rem',
    fontWeight: 'bold',
    color: COLORS.primary,
    lineHeight: 1
  },
  patrimoineLabel: {
    fontSize: '0.9rem',
    color: '#666',
    fontWeight: '500'
  },
  patrimoineDivider: {
    width: '2px',
    height: '60px',
    backgroundColor: '#e0e0e0'
  },
  sectionTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    fontSize: '1.4rem',
    fontWeight: '700',
    marginBottom: '1.25rem',
    color: COLORS.dark
  },
  weatherBanner: {
    backgroundColor: 'white',
    borderRadius: '16px',
    padding: '1.5rem',
    marginBottom: '1.5rem',
    boxShadow: '0 2px 12px rgba(0,0,0,0.06)'
  },
  weatherHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '1.5rem',
    marginBottom: '1rem',
    flexWrap: 'wrap'
  },
  weatherMain: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem'
  },
  weatherIcon: {
    fontSize: '3.5rem'
  },
  weatherTemp: {
    fontSize: '3rem',
    fontWeight: 'bold',
    color: COLORS.primary
  },
  weatherDetails: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem'
  },
  weatherCity: {
    fontSize: '1rem',
    fontWeight: '600',
    color: '#333'
  },
  weatherDesc: {
    fontSize: '0.9rem',
    color: '#666',
    textTransform: 'capitalize'
  },
  weatherGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
    gap: '1rem',
    flex: 1
  },
  weatherMetric: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
    padding: '0.75rem',
    backgroundColor: '#f8f9fa',
    borderRadius: '8px'
  },
  metricLabel: {
    fontSize: '0.75rem',
    color: '#666',
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  },
  metricValue: {
    fontSize: '1.1rem',
    fontWeight: 'bold',
    color: '#333'
  },
  riskMetric: {
    gridColumn: 'span 2'
  },
  weatherDivider: {
    height: '1px',
    backgroundColor: '#e0e0e0',
    margin: '1rem 0'
  },
  forecastSection: {
    marginTop: '1rem'
  },
  forecastTitle: {
    fontSize: '1.1rem',
    fontWeight: '600',
    marginBottom: '1rem',
    color: '#333'
  },
  forecastContainer: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))',
    gap: '0.75rem'
  },
  forecastDay: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '1rem 0.5rem',
    backgroundColor: '#f8f9fa',
    borderRadius: '10px',
    gap: '0.5rem'
  },
  forecastDayName: {
    fontSize: '0.85rem',
    fontWeight: '600',
    color: '#666'
  },
  forecastIcon: {
    fontSize: '2rem'
  },
  forecastTemps: {
    display: 'flex',
    gap: '0.5rem',
    alignItems: 'center'
  },
  tempMax: {
    fontSize: '1.1rem',
    fontWeight: 'bold',
    color: '#333'
  },
  tempMin: {
    fontSize: '0.9rem',
    color: '#999'
  },
  forecastMeta: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.25rem'
  },
  rainInfo: {
    fontSize: '0.75rem',
    color: COLORS.info,
    fontWeight: '500'
  },
  humInfo: {
    fontSize: '0.7rem',
    color: '#999'
  },
  forecastPop: {
    fontSize: '0.7rem',
    color: '#666',
    marginTop: '0.25rem'
  },
  alertsSection: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
    gap: '1rem',
    marginBottom: '2rem'
  },
  alertCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    padding: '1rem',
    backgroundColor: '#fff3cd',
    border: `2px solid ${COLORS.warning}`,
    borderRadius: '12px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
  },
  alertInfo: {
    backgroundColor: '#d1ecf1',
    border: `2px solid ${COLORS.info}`
  },
  alertIcon: {
    fontSize: '2rem'
  },
  alertContent: {
    flex: 1,
    fontSize: '0.95rem',
    fontWeight: '600',
    color: '#333'
  },
  kpiSection: {
    marginBottom: '2rem'
  },
  kpiGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '1rem'
  },
  kpiCard: {
    backgroundColor: 'white',
    padding: '1.25rem',
    borderRadius: '12px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
    border: '1px solid #e0e0e0',
    transition: 'transform 0.2s, box-shadow 0.2s'
  },
  kpiCardAccent: {
    background: `linear-gradient(135deg, ${COLORS.primary} 0%, ${COLORS.primaryLight} 100%)`,
    border: 'none'
  },
  kpiIconWrapper: {
    width: '48px',
    height: '48px',
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '0.75rem'
  },
  kpiIcon: {
    fontSize: '1.5rem'
  },
  kpiContent: {
    marginBottom: '0.5rem'
  },
  kpiValue: {
    fontSize: '1.75rem',
    fontWeight: 'bold',
    lineHeight: 1,
    marginBottom: '0.25rem'
  },
  kpiLabel: {
    fontSize: '0.85rem',
    color: '#666',
    fontWeight: '500'
  },
  kpiMeta: {
    display: 'flex',
    gap: '0.5rem',
    flexWrap: 'wrap'
  },
  kpiTag: {
    padding: '0.25rem 0.5rem',
    fontSize: '0.75rem',
    backgroundColor: '#f0f0f0',
    borderRadius: '4px',
    fontWeight: '500',
    color: '#666'
  },
  kpiStatus: {
    padding: '0.25rem 0.75rem',
    fontSize: '0.75rem',
    color: 'white',
    borderRadius: '12px',
    fontWeight: '600'
  },
  chartSection: {
    marginBottom: '2rem'
  },
  chartCardFull: {
    backgroundColor: 'white',
    padding: '1.5rem',
    borderRadius: '12px',
    boxShadow: '0 2px 12px rgba(0,0,0,0.06)'
  },
  chartHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1.5rem',
    flexWrap: 'wrap',
    gap: '1rem'
  },
  chartTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    fontSize: '1.1rem',
    fontWeight: '600',
    color: '#333',
    margin: 0
  },
  chartMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem'
  },
  totalProduction: {
    fontSize: '1.1rem',
    fontWeight: '700',
    color: COLORS.primary
  },
  tooltipStyle: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    border: `1px solid ${COLORS.primary}`,
    borderRadius: '8px',
    padding: '8px 12px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
  },
  productionTableMultiYear: {
    border: '1px solid #e0e0e0',
    borderRadius: '8px',
    overflow: 'hidden'
  },
  tableHeaderMultiYear: {
    display: 'flex',
    backgroundColor: '#f8f9fa',
    padding: '1rem',
    borderBottom: '2px solid #e0e0e0'
  },
  tableRowMultiYear: {
    display: 'flex',
    padding: '0.75rem 1rem',
    borderBottom: '1px solid #e0e0e0',
    transition: 'background-color 0.2s'
  },
  tableCell: {
    flex: 1,
    fontSize: '0.9rem',
    color: '#333',
    display: 'flex',
    alignItems: 'center'
  },
  noData: {
    textAlign: 'center',
    padding: '2rem',
    color: COLORS.muted,
    fontStyle: 'italic'
  },
  activitiesSection: {
    marginBottom: '2rem'
  },
  activitiesGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: '1rem'
  },
  activityCard: {
    backgroundColor: 'white',
    borderRadius: '12px',
    padding: '1.25rem',
    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
    border: '1px solid #e0e0e0'
  },
  activityHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    fontSize: '1rem',
    fontWeight: '600',
    marginBottom: '1rem',
    color: '#333'
  },
  activityHeaderIcon: {
    fontSize: '1.25rem'
  },
  activityList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem'
  },
  activityEmpty: {
    textAlign: 'center',
    padding: '1.5rem',
    color: COLORS.muted,
    fontStyle: 'italic',
    fontSize: '0.9rem'
  },
  activityItem: {
    display: 'flex',
    gap: '0.75rem',
    padding: '0.75rem',
    backgroundColor: '#f8f9fa',
    borderRadius: '8px',
    transition: 'background-color 0.2s'
  },
  activityDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    marginTop: '0.5rem',
    flexShrink: 0
  },
  activityContent: {
    flex: 1,
    minWidth: 0
  },
  activityDate: {
    fontSize: '0.75rem',
    color: '#999',
    fontWeight: '500',
    marginBottom: '0.25rem'
  },
  activityTitle: {
    fontSize: '0.9rem',
    fontWeight: '600',
    color: '#333',
    marginBottom: '0.25rem',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  activityMeta: {
    fontSize: '0.8rem',
    color: '#666'
  }
};

export default Dashboard;
