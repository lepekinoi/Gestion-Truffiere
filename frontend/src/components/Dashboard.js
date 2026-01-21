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
  light: '#ecf0f1'
};

const ETAT_COLORS = {
  'Bon': COLORS.success,
  'Moyen': COLORS.warning,
  'Mauvais': COLORS.danger,
  'Mort': COLORS.muted
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
    loadWeather();
  }, []);

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
          clouds: weatherData.clouds.all,
          city: weatherData.name
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
              pop: Math.round(item.pop * 100)
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


      setStockData(stockRes.data);

      const commandesEnAttente = safeArray(commandesRes.data).filter(c => // ✅
        c && (c.statut === 'En attente' || c.statut === 'Confirmée') // ✅
      ).length;
      const ventesEnAttente = safeArray(ventesRes.data).filter(v => // ✅
        v && v.statut === 'En attente' // ✅
      ).length;
      setAlertes({ commandesEnAttente, ventesEnAttente });

      const sortedRecoltes = safeArray(recoltesRes.data) // ✅ Safe array
        .filter(r => r) // ✅ Filter null
        .sort((a, b) => new Date(b.date_recolte || 0) - new Date(a.date_recolte || 0))
        .slice(0, 5);


      setRecentRecoltes(sortedRecoltes);

      const today = new Date();
      const sortedInterventions = safeArray(interventionsRes.data) // ✅
        .filter(i => i && new Date(i.date_prevue) >= today && i.statut === 'Planifié') // ✅
        .sort((a, b) => new Date(a.date_prevue) - new Date(b.date_prevue))
        .slice(0, 5);
      setInterventionsAVenir(sortedInterventions);

      const sortedCommandes = safeArray(commandesRes.data) // ✅
        .filter(c => c && c.statut !== 'Annulée' && c.statut !== 'Livrée') // ✅
        .sort((a, b) => new Date(b.date_commande) - new Date(a.date_commande))
        .slice(0, 5);
      setCommandesRecentes(sortedCommandes);

      const productionMensuelle = prepareProductionMensuelle(recoltesMensuellesRes.data);
      setProductionParMois(productionMensuelle);

      const prodParParcelle = {};
      (recoltesRes.data || []).forEach(recolte => {
        if (!recolte) return; // ✅ Protection
        const parcelle = recolte.parcelle_nom || 'Non défini';
        const poids = safeParseFloat(recolte.poids_grammes, 0); // ✅ Utility
        if (!prodParParcelle[parcelle]) prodParParcelle[parcelle] = 0;
        prodParParcelle[parcelle] += poids / 1000;
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

  const prepareProductionMensuelle = (data) => {
  const now = new Date();
  const result = [];
  const safeData = safeArray(data); // ✅ Protection
  
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const moisNom = d.toLocaleDateString('fr-FR', { month: 'short' });
    
    const found = safeData.find(item => item && item.mois === key); // ✅
    result.push({
      mois: moisNom,
      production: found ? safeParseFloat((found.total_grammes / 1000).toFixed(2), 0) : 0 // ✅
    });
  }
  
  return result;
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

  // ==================== RENDU PRINCIPAL ====================
  return (
    <div style={styles.pageContainer}>
      
      {/* ═══════════════════════════════════════════════════════════════
          SECTION 1: BANNIÈRE MÉTÉO HORIZONTALE
      ═══════════════════════════════════════════════════════════════ */}
      {weather && (
        <section style={styles.weatherBanner}>
          <div style={styles.weatherMain}>
            <div style={styles.weatherIcon}>{getWeatherIcon(weather.icon)}</div>
            <div style={styles.weatherTemp}>{weather.temp}°C</div>
            <div style={styles.weatherDetails}>
              <div style={styles.weatherCity}>📍 {weather.city}</div>
              <div style={styles.weatherDesc}>{weather.description}</div>
              <div style={styles.weatherMeta}>
                <span>💧 {weather.humidity}%</span>
                <span>💨 {weather.wind_speed} km/h</span>
              </div>
            </div>
          </div>
          
          <div style={styles.weatherDivider}></div>
          
          <div style={styles.forecastContainer}>
            {forecast.map((day, idx) => (
              <div key={idx} style={styles.forecastDay}>
                <div style={styles.forecastDayName}>{getDayName(day.date)}</div>
                <div style={styles.forecastIcon}>{getWeatherIcon(day.icon)}</div>
                <div style={styles.forecastTemps}>
                  <span style={styles.tempMax}>{day.temp_max}°</span>
                  <span style={styles.tempMin}>{day.temp_min}°</span>
                </div>
                {day.pop > 0 && (
                  <div style={styles.forecastPop}>💧{day.pop}%</div>
                )}
              </div>
            ))}
          </div>
          
          <div style={styles.weatherTip}>
            <span style={styles.tipIcon}>💡</span>
            <span>
              {weather.humidity > 70 && weather.temp > 5 && weather.temp < 25 
                ? "Conditions favorables pour le cavage !"
                : weather.temp < 5
                ? "Surveillez le gel"
                : weather.humidity < 40
                ? "Pensez à l'irrigation"
                : "Conditions normales"
              }
            </span>
          </div>
        </section>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          SECTION 2: ALERTES (si présentes)
      ═══════════════════════════════════════════════════════════════ */}
      {(alertes.commandesEnAttente > 0 || alertes.ventesEnAttente > 0) && (
        <section style={styles.alertsSection}>
          {alertes.commandesEnAttente > 0 && (
            <div style={styles.alertCard}>
              <span style={styles.alertIcon}>📦</span>
              <div style={styles.alertContent}>
                <strong>{alertes.commandesEnAttente} commande(s) en attente</strong>
                <span>À traiter dans Commercial</span>
              </div>
            </div>
          )}
          {alertes.ventesEnAttente > 0 && (
            <div style={{...styles.alertCard, ...styles.alertInfo}}>
              <span style={styles.alertIcon}>💳</span>
              <div style={styles.alertContent}>
                <strong>{alertes.ventesEnAttente} vente(s) en attente</strong>
                <span>Paiement à suivre</span>
              </div>
            </div>
          )}
        </section>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          SECTION 3: KPIs - Cartes visuelles
      ═══════════════════════════════════════════════════════════════ */}
      <section style={styles.kpiSection}>
        <div style={styles.kpiGrid}>
          {/* Patrimoine */}
          <div style={styles.kpiCard}>
            <div style={styles.kpiIconWrapper}>
              <span style={styles.kpiIcon}>🌳</span>
            </div>
            <div style={styles.kpiContent}>
              <div style={styles.kpiValue}>{stats.arbres.count}</div>
              <div style={styles.kpiLabel}>Arbres truffiers</div>
            </div>
            <div style={styles.kpiMeta}>
              <span style={styles.kpiTag}>
                📋 {stats.parcelles.count} parcelles
              </span>
              <span style={styles.kpiTag}>
                📐 {stats.parcelles.surface.toFixed(2)} ha
              </span>
            </div>
          </div>

          {/* Production */}
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

          {/* Stock */}
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
              <span style={{...styles.kpiStatus, background: stockStatus.color}}>
                {stockStatus.label}
              </span>
            </div>
          </div>

          {/* Chiffre d'affaires */}
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

          {/* Interventions */}
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

          {/* Commandes */}
          <div style={styles.kpiCard}>
            <div style={{...styles.kpiIconWrapper, background: '#3498db20'}}>
              <span style={styles.kpiIcon}>🛒</span>
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

      {/* ═══════════════════════════════════════════════════════════════
          SECTION 4: GRAPHIQUE PRODUCTION + ÉTAT ARBRES
      ═══════════════════════════════════════════════════════════════ */}
      <section style={styles.chartsSection}>
        <div style={styles.chartsGrid}>
          {/* Graphique production mensuelle */}
          <div style={styles.chartCard}>
            <h3 style={styles.chartTitle}>
              <span>📈</span> Production des 12 derniers mois
            </h3>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={productionParMois}>
                <defs>
                  <linearGradient id="colorProd" x1="0" y1="0" x2="0" y2="1": 