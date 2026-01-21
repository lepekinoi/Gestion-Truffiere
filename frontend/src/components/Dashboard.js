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
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [availableYears, setAvailableYears] = useState([]);

  // ==================== CHARGEMENT DES DONNÉES ====================
  useEffect(() => {
    loadDashboardData();
    loadWeather();
  }, [selectedYear]);

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

      setStockData(stockRes.data);

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

      // Production avec 3 années
      const years = getAvailableYears(recoltesMensuellesRes.data);
      setAvailableYears(years);
      if (!years.includes(selectedYear)) {
        setSelectedYear(years[0] || new Date().getFullYear());
      }

      const productionMensuelle = prepareProductionMensuelle(recoltesMensuellesRes.data, selectedYear);
      setProductionParMois(productionMensuelle);

      // Production par parcelle avec détails
      const prodParParcelle = {};
      (recoltesRes.data || []).forEach(recolte => {
        if (!recolte) return;
        const parcelle = recolte.parcelle_nom || 'Non défini';
        const poids = safeParseFloat(recolte.poids_grammes, 0);
        if (!prodParParcelle[parcelle]) {
          prodParParcelle[parcelle] = { kg: 0, count: 0 };
        }
        prodParParcelle[parcelle].kg += poids / 1000;
        prodParParcelle[parcelle].count += 1;
      });

      setProductionParParcelle(
        Object.entries(prodParParcelle)
          .map(([nom, data]) => ({
            nom,
            kg: parseFloat(data.kg.toFixed(2)),
            count: data.count
          }))
          .sort((a, b) => b.kg - a.kg)
      );

      setLoading(false);
    } catch (err) {
      console.error('Erreur lors du chargement du tableau de bord:', err);
      setError('Impossible de charger les données du tableau de bord');
      setLoading(false);
    }
  };

  const getAvailableYears = (data) => {
    const years = new Set();
    const now = new Date();
    
    // Ajouter les 3 dernières années par défaut
    for (let i = 0; i < 3; i++) {
      years.add(now.getFullYear() - i);
    }
    
    // Ajouter les années des données
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

  // ==================== RENDU PRINCIPAL ====================
  return (
    <div style={styles.pageContainer}>
      
      {/* ═══════════════════════════════════════════════════════════════
          SECTION 1: BANNIÈRE MÉTÉO PROFESSIONNELLE AMÉLIORÉE
      ═══════════════════════════════════════════════════════════════ */}
      {weather && (
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
                <div style={styles.windDir}>{getWindDirection(weather.wind_deg)}</div>
              </div>
              <div style={styles.weatherMetric}>
                <div style={styles.metricLabel}>Pression</div>
                <div style={styles.metricValue}>{weather.pressure} mb</div>
              </div>
              <div style={styles.weatherMetric}>
                <div style={styles.metricLabel}>Visibilité</div>
                <div style={styles.metricValue}>{weather.visibility} km</div>
              </div>
              <div style={{...styles.weatherMetric, ...styles.riskMetric}}>
                <div style={styles.metricLabel}>Risque</div>
                <div style={{...styles.metricValue, color: riskLevel.color}}>
                  {riskLevel.icon} {riskLevel.text}
                </div>
              </div>
            </div>
          </div>
          
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
                  <div style={styles.forecastMeta}>
                    {day.rain > 0 && (
                      <div style={styles.rainInfo}>🌧️ {day.rain.toFixed(1)}mm</div>
                    )}
                    <div style={styles.humInfo}>💧 {day.humidity}%</div>
                  </div>
                  {day.pop > 0 && (
                    <div style={styles.forecastPop}>Pluie {day.pop}%</div>
                  )}
                </div>
              ))}
            </div>
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
          SECTION 4: PRODUCTION PAR PARCELLE (POSITIONNÉ PLUS HAUT)
      ═══════════════════════════════════════════════════════════════ */}
      <section style={styles.chartSection}>
        <div style={styles.chartCardFull}>
          <div style={styles.chartHeader}>
            <h3 style={styles.chartTitle}>
              <span>📊</span> Production par parcelle
            </h3>
            <div style={styles.chartMeta}>
              <span style={styles.totalProduction}>
                Total: {productionParParcelle.reduce((sum, p) => sum + p.kg, 0).toFixed(2)} kg
              </span>
            </div>
          </div>
          {productionParParcelle.length > 0 ? (
            <div style={styles.productionTable}>
              <div style={styles.tableHeader}>
                <div style={{...styles.tableCell, flex: 2}}>Parcelle</div>
                <div style={styles.tableCell}>Production (kg)</div>
                <div style={styles.tableCell}>Récoltes</div>
                <div style={styles.tableCell}>Moyenne/Récolte</div>
              </div>
              {productionParParcelle.map((parcelle, idx) => {
                const moyenne = parcelle.count > 0 ? (parcelle.kg * 1000 / parcelle.count).toFixed(0) : 0;
                const percentage = productionParParcelle.reduce((sum, p) => sum + p.kg, 0) > 0
                  ? ((parcelle.kg / productionParParcelle.reduce((sum, p) => sum + p.kg, 0)) * 100).toFixed(1)
                  : 0;
                return (
                  <div key={idx} style={styles.tableRow}>
                    <div style={{...styles.tableCell, flex: 2, fontWeight: '500'}}>{parcelle.nom}</div>
                    <div style={{...styles.tableCell, color: COLORS.primary, fontWeight: '600'}}>
                      {parcelle.kg} kg
                      <span style={styles.percentage}>({percentage}%)</span>
                    </div>
                    <div style={styles.tableCell}>{parcelle.count}</div>
                    <div style={styles.tableCell}>{moyenne} g</div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={styles.noData}>Aucune récolte enregistrée</div>
          )}
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          SECTION 5: PRODUCTION AVEC SÉLECTEUR D'ANNÉE
      ═══════════════════════════════════════════════════════════════ */}
      <section style={styles.chartSection}>
        <div style={styles.chartCardFull}>
          <div style={styles.chartHeader}>
            <h3 style={styles.chartTitle}>
              <span>📈</span> Production mensuelle
            </h3>
            <div style={styles.yearSelector}>
              <label style={styles.yearLabel}>Année:</label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                style={styles.yearSelect}
              >
                {availableYears.map(year => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={productionParMois}>
              <defs>
                <linearGradient id="colorProd" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={COLORS.primary} stopOpacity={0.3}/>
                  <stop offset="95%" stopColor={COLORS.primary} stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis dataKey="mois" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip 
                formatter={(value) => [`${value} kg`, 'Production']}
                contentStyle={styles.tooltipStyle}
              />
              <Area 
                type="monotone" 
                dataKey="production" 
                stroke={COLORS.primary}
                strokeWidth={3}
                fill="url(#colorProd)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          SECTION 6: TIMELINE ACTIVITÉS RÉCENTES
      ═══════════════════════════════════════════════════════════════ */}
      <section style={styles.activitiesSection}>
        <h2 style={styles.sectionTitle}>
          <span>📋</span> Activités récentes
        </h2>
        
        <div style={styles.activitiesGrid}>
          {/* Dernières récoltes */}
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
                        <div style={styles.activityDate}>
                          {formatDateShort(recolte.date_recolte)}
                        </div>
                        <div style={styles.activityInfo}>
                          {recolte.parcelle_nom || '-'} • 
                          <strong> {safeParseFloat(recolte.poids_grammes, 0).toFixed(0)} g</strong>
                        </div>
                        {recolte.qualite && (
                          <div style={styles.activityQuality}>{recolte.qualite}</div>
                        )}
                      </div>
                    </div>
                  )
                ))
              )}
            </div>
          </div>
          {/* Interventions à venir */}
          <div style={styles.activityCard}>
            <div style={styles.activityHeader}>
              <span style={styles.activityHeaderIcon}>🛠️</span>
              <span>Interventions à venir</span>
            </div>
            <div style={styles.activityList}>
              {interventionsAVenir.length === 0 ? (
                <div style={styles.activityEmpty}>Aucune intervention planifiée</div>
              ) : (
                interventionsAVenir.map(intervention => (
                  intervention && (
                    <div key={intervention.id} style={styles.activityItem}>
                      <div style={{...styles.activityDot, background: intervention?.type_couleur || '#e67e22'}}></div>
                      <div style={styles.activityContent}>
                        <div style={styles.activityDate}>
                          {formatDateShort(intervention?.date_prevue)}
                        </div>
                        <div style={styles.activityBadge}>
                          <span style={{
                            ...styles.typeBadge,
                            background: intervention?.type_couleur || '#ccc'
                          }}>
                            {intervention?.type_nom}
                          </span>
                        </div>
                        <div style={styles.activityInfo}>
                          {intervention?.parcelle_nom || '-'}
                        </div>
                      </div>
                    </div>
                  )
                ))
              )}
            </div>
          </div>
          {/* Commandes en cours */}
          <div style={styles.activityCard}>
            <div style={styles.activityHeader}>
              <span style={styles.activityHeaderIcon}>📦</span>
              <span>Commandes en cours</span>
            </div>
            <div style={styles.activityList}>
              {commandesRecentes.length === 0 ? (
                <div style={styles.activityEmpty}>Aucune commande</div>
              ) : (
                commandesRecentes.map(commande => (
                  commande && (
                    <div key={commande.id} style={styles.activityItem}>
                      <div style={{...styles.activityDot, background: '#3498db'}}></div>
                      <div style={styles.activityContent}>
                        <div style={styles.activityHeader2}>
                          <span>{commande?.numero_commande || `CMD-${commande?.id}`}</span>
                          <span style={{
                            ...styles.statusBadge,
                            background: commande?.statut === 'En attente' ? '#fff3cd' : '#cce5ff',
                            color: commande?.statut === 'En attente' ? '#856404' : '#004085'
                          }}>
                            {commande?.statut}
                          </span>
                        </div>
                        <div style={styles.activityInfo}>
                          {safeParseFloat(commande?.poids_grammes || 0, 0).toFixed(0)} g • 
                          <strong> {safeParseFloat(commande?.montant_total || 0, 0).toFixed(2)} €</strong>
                        </div>
                      </div>
                    </div>
                  )
                ))
              )}
            </div>
          </div>
        </div>
      </section>

      <style>{`
        @keyframes loadingPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        @keyframes loadingBar {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
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

  // Loading & Error
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
  },

  // Weather Banner - AMÉLIORÉ
  weatherBanner: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.5rem',
    padding: '1.5rem 2rem',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    borderRadius: '16px',
    color: 'white',
    marginBottom: '1.5rem',
    boxShadow: '0 4px 20px rgba(102, 126, 234, 0.3)'
  },
  weatherHeader: {
    display: 'flex',
    gap: '2rem',
    alignItems: 'flex-start',
    justifyContent: 'space-between'
  },
  weatherMain: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    flex: 0
  },
  weatherIcon: {
    fontSize: '3rem'
  },
  weatherTemp: {
    fontSize: '2.5rem',
    fontWeight: '700'
  },
  weatherDetails: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem'
  },
  weatherCity: {
    fontSize: '0.9rem',
    opacity: 0.9
  },
  weatherDesc: {
    fontSize: '1rem',
    textTransform: 'capitalize',
    fontWeight: '500'
  },
  weatherGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))',
    gap: '1rem',
    flex: 1
  },
  weatherMetric: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '0.75rem',
    background: 'rgba(255,255,255,0.1)',
    borderRadius: '12px',
    fontSize: '0.85rem'
  },
  metricLabel: {
    fontSize: '0.75rem',
    opacity: 0.8,
    marginBottom: '0.25rem'
  },
  metricValue: {
    fontSize: '1.1rem',
    fontWeight: '600'
  },
  windDir: {
    fontSize: '0.75rem',
    opacity: 0.8,
    marginTop: '0.25rem'
  },
  riskMetric: {
    background: 'rgba(255,255,255,0.15)'
  },
  weatherDivider: {
    height: '1px',
    background: 'rgba(255,255,255,0.3)',
    width: '100%'
  },
  forecastSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem'
  },
  forecastTitle: {
    fontSize: '0.95rem',
    fontWeight: '600',
    opacity: 0.9
  },
  forecastContainer: {
    display: 'flex',
    gap: '1rem',
    justifyContent: 'space-between',
    overflowX: 'auto'
  },
  forecastDay: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.25rem',
    padding: '0.75rem',
    background: 'rgba(255,255,255,0.1)',
    borderRadius: '12px',
    minWidth: '90px',
    fontSize: '0.85rem'
  },
  forecastDayName: {
    fontSize: '0.8rem',
    fontWeight: '600',
    textTransform: 'capitalize'
  },
  forecastIcon: {
    fontSize: '1.75rem'
  },
  forecastTemps: {
    display: 'flex',
    gap: '0.5rem',
    fontSize: '0.85rem'
  },
  tempMax: {
    fontWeight: '600'
  },
  tempMin: {
    opacity: 0.7
  },
  forecastMeta: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.25rem',
    fontSize: '0.8rem',
    marginTop: '0.25rem'
  },
  rainInfo: {
    color: '#87ceeb'
  },
  humInfo: {
    opacity: 0.9
  },
  forecastPop: {
    fontSize: '0.75rem',
    opacity: 0.8,
    fontWeight: '500'
  },

  // Alerts
  alertsSection: {
    display: 'flex',
    gap: '1rem',
    marginBottom: '1.5rem',
    flexWrap: 'wrap'
  },
  alertCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    padding: '1rem 1.5rem',
    background: '#fff3cd',
    border: '1px solid #ffc107',
    borderRadius: '12px',
    flex: '1 1 280px'
  },
  alertInfo: {
    background: '#d1ecf1',
    borderColor: '#17a2b8'
  },
  alertIcon: {
    fontSize: '2rem'
  },
  alertContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem'
  },

  // KPI Section
  kpiSection: {
    marginBottom: '2rem'
  },
  kpiGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '1.25rem'
  },
  kpiCard: {
    background: 'white',
    borderRadius: '16px',
    padding: '1.5rem',
    boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
    transition: 'transform 0.2s, box-shadow 0.2s',
    cursor: 'default'
  },
  kpiCardAccent: {
    background: `linear-gradient(135deg, ${COLORS.primary} 0%, ${COLORS.primaryLight} 100%)`,
    color: 'white'
  },
  kpiIconWrapper: {
    width: '48px',
    height: '48px',
    borderRadius: '12px',
    background: '#f5f5f5',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  kpiIcon: {
    fontSize: '1.5rem'
  },
  kpiContent: {
    flex: 1
  },
  kpiValue: {
    fontSize: '2rem',
    fontWeight: '700',
    lineHeight: 1.2
  },
  kpiLabel: {
    fontSize: '0.9rem',
    opacity: 0.8,
    marginTop: '0.25rem'
  },
  kpiMeta: {
    display: 'flex',
    gap: '0.5rem',
    flexWrap: 'wrap'
  },
  kpiTag: {
    fontSize: '0.8rem',
    padding: '0.25rem 0.5rem',
    background: '#f0f0f0',
    borderRadius: '6px',
    opacity: 0.9
  },
  kpiStatus: {
    fontSize: '0.75rem',
    padding: '0.25rem 0.75rem',
    borderRadius: '12px',
    color: 'white',
    fontWeight: '500'
  },

  // Chart Section
  chartSection: {
    marginBottom: '2rem'
  },
  chartCardFull: {
    background: 'white',
    borderRadius: '16px',
    padding: '1.5rem',
    boxShadow: '0 2px 12px rgba(0,0,0,0.06)'
  },
  chartHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1rem'
  },
  chartTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    margin: 0,
    color: COLORS.primary,
    fontSize: '1.1rem',
    fontWeight: '600'
  },
  chartMeta: {
    display: 'flex',
    gap: '1rem',
    alignItems: 'center'
  },
  totalProduction: {
    fontSize: '0.95rem',
    fontWeight: '500',
    color: COLORS.primary,
    padding: '0.5rem 1rem',
    background: '#f0f7f0',
    borderRadius: '8px'
  },
  yearSelector: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem'
  },
  yearLabel: {
    fontSize: '0.9rem',
    fontWeight: '500',
    color: COLORS.dark
  },
  yearSelect: {
    padding: '0.5rem 0.75rem',
    borderRadius: '6px',
    border: `1px solid ${COLORS.primary}`,
    fontSize: '0.9rem',
    cursor: 'pointer',
    background: 'white',
    color: COLORS.dark
  },
  productionTable: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem'
  },
  tableHeader: {
    display: 'grid',
    gridTemplateColumns: '2fr 1.5fr 1fr 1.5fr',
    gap: '1rem',
    padding: '1rem',
    background: '#f8f9fa',
    borderRadius: '8px',
    fontWeight: '600',
    fontSize: '0.9rem',
    color: COLORS.dark,
    borderBottom: `2px solid ${COLORS.primary}`
  },
  tableRow: {
    display: 'grid',
    gridTemplateColumns: '2fr 1.5fr 1fr 1.5fr',
    gap: '1rem',
    padding: '1rem',
    borderBottom: '1px solid #eee',
    alignItems: 'center',
    fontSize: '0.95rem',
    transition: 'background 0.2s'
  },
  tableCell: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem'
  },
  percentage: {
    fontSize: '0.8rem',
    color: COLORS.muted,
    marginLeft: '0.5rem'
  },
  tooltipStyle: {
    background: 'white',
    border: '1px solid #eee',
    borderRadius: '8px',
    boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
  },
  noData: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '200px',
    color: COLORS.muted
  },

  // Activities Section
  activitiesSection: {
    marginBottom: '2rem'
  },
  sectionTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    margin: '0 0 1.25rem 0',
    color: COLORS.primary,
    fontSize: '1.25rem',
    fontWeight: '600'
  },
  activitiesGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '1.5rem'
  },
  activityCard: {
    background: 'white',
    borderRadius: '16px',
    overflow: 'hidden',
    boxShadow: '0 2px 12px rgba(0,0,0,0.06)'
  },
  activityHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '1rem 1.25rem',
    background: '#f8f9fa',
    fontWeight: '600',
    color: COLORS.dark
  },
  activityHeaderIcon: {
    fontSize: '1.25rem'
  },
  activityList: {
    padding: '1rem'
  },
  activityEmpty: {
    padding: '1rem',
    textAlign: 'center',
    color: COLORS.muted
  },
  activityItem: {
    display: 'flex',
    gap: '0.75rem',
    padding: '0.75rem 0',
    borderBottom: '1px solid #f0f0f0'
  },
  activityDot: {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    marginTop: '0.3rem',
    flexShrink: 0
  },
  activityContent: {
    flex: 1
  },
  activityDate: {
    fontWeight: '600',
    fontSize: '0.9rem',
    marginBottom: '0.25rem'
  },
  activityInfo: {
    fontSize: '0.85rem',
    color: '#666'
  },
  activityQuality: {
    fontSize: '0.8rem',
    color: COLORS.muted,
    marginTop: '0.25rem'
  },
  activityBadge: {
    marginBottom: '0.25rem'
  },
  typeBadge: {
    display: 'inline-block',
    padding: '0.15rem 0.5rem',
    borderRadius: '4px',
    color: 'white',
    fontSize: '0.75rem'
  },
  activityHeader2: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '0.25rem',
    fontWeight: '500'
  },
  statusBadge: {
    fontSize: '0.7rem',
    padding: '0.15rem 0.5rem',
    borderRadius: '10px'
  }
};

// Media queries via inline check (pour responsive)
if (typeof window !== 'undefined' && window.innerWidth < 768) {
  styles.weatherHeader.flexDirection = 'column';
  styles.forecastContainer.display = 'grid';
  styles.forecastContainer.gridTemplateColumns = 'repeat(2, 1fr)';
  styles.weatherDivider.display = 'none';
  styles.chartsGrid = { gridTemplateColumns: '1fr' };
  styles.activitiesGrid.gridTemplateColumns = '1fr';
}

export default Dashboard;