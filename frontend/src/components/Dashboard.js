import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  safeParseFloat,
  safeArray,
  formatWeight
} from '../utils/safeDataHandling';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area, ComposedChart } from 'recharts';

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

const YEAR_COLORS = {
  year1: '#2c5f2d',
  year2: '#667eea',
  year3: '#764ba2'
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
  const [parcelleHealth, setParcelleHealth] = useState([]);
  const [rentabiliteData, setRentabiliteData] = useState([]);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [availableYears, setAvailableYears] = useState([]);
  const [selectedYearsComparison, setSelectedYearsComparison] = useState([]);
  const [productionComparison, setProductionComparison] = useState([]);
  const [monthCalendar, setMonthCalendar] = useState([]);
  const [trendData, setTrendData] = useState({
    productionTrend: 0,
    avgPerRecolte: 0,
    productivityPerTree: 0
  });

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

  const calculateTrendData = (recoltes, recoltesMensuelles) => {
    const now = new Date();
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    // Production du mois vs mois dernier
    const thisMonthKey = `${thisMonth.getFullYear()}-${String(thisMonth.getMonth() + 1).padStart(2, '0')}`;
    const lastMonthKey = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, '0')}`;
    
    const thisMonthData = safeArray(recoltesMensuelles).find(item => item && item.mois === thisMonthKey);
    const lastMonthData = safeArray(recoltesMensuelles).find(item => item && item.mois === lastMonthKey);
    
    const thisMonthProd = thisMonthData ? safeParseFloat(thisMonthData.total_grammes, 0) : 0;
    const lastMonthProd = lastMonthData ? safeParseFloat(lastMonthData.total_grammes, 0) : 0;
    
    const productionTrend = lastMonthProd > 0 ? ((thisMonthProd - lastMonthProd) / lastMonthProd * 100) : 0;

    // Moyenne par récolte
    const avgPerRecolte = stats.recoltes.count > 0 ? safeParseFloat(stats.recoltes.totalGrammes, 0) / stats.recoltes.count : 0;

    // Productivité par arbre
    const productivityPerTree = stats.arbres.count > 0 ? safeParseFloat(stats.recoltes.totalGrammes, 0) / stats.arbres.count : 0;

    return {
      productionTrend: Math.round(productionTrend * 100) / 100,
      avgPerRecolte: Math.round(avgPerRecolte),
      productivityPerTree: Math.round(productivityPerTree)
    };
  };

  const buildMonthCalendar = (recoltes, interventions) => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    const calendar = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = new Date(year, month, day).toISOString().split('T')[0];
      const dayRecoltes = safeArray(recoltes).filter(r => r && r.date_recolte?.startsWith(dateStr));
      const dayInterventions = safeArray(interventions).filter(i => i && i.date_prevue?.startsWith(dateStr));
      
      calendar.push({
        day,
        recoltes: dayRecoltes,
        interventions: dayInterventions,
        hasActivity: dayRecoltes.length > 0 || dayInterventions.length > 0
      });
    }
    return calendar;
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

      // Production avec 3 années - PHASE 1
      const years = getAvailableYears(recoltesMensuellesRes.data);
      setAvailableYears(years);
      
      // Par défaut: 3 dernières années
      const defaultYears = years.slice(0, 3);
      setSelectedYearsComparison(defaultYears);
      if (!years.includes(selectedYear)) {
        setSelectedYear(years[0] || new Date().getFullYear());
      }

      const productionMensuelle = prepareProductionMensuelle(recoltesMensuellesRes.data, selectedYear);
      setProductionParMois(productionMensuelle);

      // Graphique comparaison années
      const comparisonData = prepareProductionComparison(recoltesMensuellesRes.data, defaultYears);
      setProductionComparison(comparisonData);

      // Production par parcelle avec détails
      const prodParParcelle = {};
      const ventesParParcelle = {};
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

      (ventesRes.data || []).forEach(vente => {
        if (!vente) return;
        const parcelle = vente.parcelle_nom || 'Non défini';
        if (!ventesParParcelle[parcelle]) {
          ventesParParcelle[parcelle] = 0;
        }
        ventesParParcelle[parcelle] += safeParseFloat(vente.montant_total, 0);
      });

      const prodParcelleArray = Object.entries(prodParParcelle)
        .map(([nom, data]) => ({
          nom,
          kg: parseFloat(data.kg.toFixed(2)),
          count: data.count
        }))
        .sort((a, b) => b.kg - a.kg);

      setProductionParParcelle(prodParcelleArray);

      // Santé des parcelles - PHASE 1
      const health = prodParcelleArray.map(p => {
        const totalProd = prodParcelleArray.reduce((sum, x) => sum + x.kg, 0);
        const percentage = totalProd > 0 ? (p.kg / totalProd) * 100 : 0;
        let status = 'Mauvais';
        if (percentage >= 15) status = 'Excellent';
        else if (percentage >= 10) status = 'Bon';
        else if (percentage >= 5) status = 'Moyen';
        return {
          nom: p.nom,
          production: p.kg,
          percentage,
          status
        };
      });
      setParcelleHealth(health);

      // Rentabilité par parcelle - PHASE 2
      const rentabilite = prodParcelleArray.map(p => {
        const ventes = ventesParParcelle[p.nom] || 0;
        const rentabilitePercent = p.kg > 0 ? ((ventes / p.kg) * 100).toFixed(2) : 0;
        return {
          nom: p.nom,
          production: p.kg,
          ventes: parseFloat(ventes.toFixed(2)),
          rentabilite: parseFloat(rentabilitePercent)
        };
      });
      setRentabiliteData(rentabilite);

      // Calendrier du mois - PHASE 2
      const calendar = buildMonthCalendar(recoltesRes.data, interventionsRes.data);
      setMonthCalendar(calendar);

      // Tendances - PHASE 1
      const trends = calculateTrendData(recoltesRes.data, recoltesMensuellesRes.data);
      setTrendData(trends);

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

  const prepareProductionComparison = (data, years) => {
    const months = ['jan', 'fév', 'mar', 'avr', 'mai', 'jun', 'jui', 'aoû', 'sep', 'oct', 'nov', 'déc'];
    const result = [];
    const safeData = safeArray(data);

    for (let i = 0; i < 12; i++) {
      const monthData = { mois: months[i] };
      years.forEach(year => {
        const key = `${year}-${String(i + 1).padStart(2, '0')}`;
        const found = safeData.find(item => item && item.mois === key);
        monthData[`year${year}`] = found ? safeParseFloat((found.total_grammes / 1000).toFixed(2), 0) : 0;
      });
      result.push(monthData);
    }
    return result;
  };

  const getHealthColor = (status) => {
    switch(status) {
      case 'Excellent': return '#27ae60';
      case 'Bon': return '#2196F3';
      case 'Moyen': return '#f39c12';
      case 'Mauvais': return '#e74c3c';
      default: return '#95a5a6';
    }
  };

  const getHealthIcon = (status) => {
    switch(status) {
      case 'Excellent': return '✨';
      case 'Bon': return '✅';
      case 'Moyen': return '⚠️';
      case 'Mauvais': return '❌';
      default: return '➖';
    }
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
      
      {/* SECTION 0: PATRIMOINE */}
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
      
      {/* SECTION 1: MÉTÉO */}
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

      {/* SECTION 2: ALERTES */}
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

      {/* SECTION 3: KPIs */}
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

      {/* SECTION 4: KPIs TENDANCE - PHASE 1 */}
      <section style={styles.trendSection}>
        <h3 style={styles.sectionTitle}>📊 Indicateurs de tendance</h3>
        <div style={styles.trendGrid}>
          <div style={styles.trendCard}>
            <div style={styles.trendIcon}>
              {trendData.productionTrend >= 0 ? '📈' : '📉'}
            </div>
            <div style={styles.trendContent}>
              <div style={{...styles.trendValue, color: trendData.productionTrend >= 0 ? COLORS.success : COLORS.danger}}>
                {trendData.productionTrend > 0 ? '+' : ''}{trendData.productionTrend}%
              </div>
              <div style={styles.trendLabel}>Tendance production</div>
              <div style={styles.trendMeta}>vs mois dernier</div>
            </div>
          </div>

          <div style={styles.trendCard}>
            <div style={styles.trendIcon}>⚖️</div>
            <div style={styles.trendContent}>
              <div style={styles.trendValue}>{trendData.avgPerRecolte} g</div>
              <div style={styles.trendLabel}>Moyenne par récolte</div>
              <div style={styles.trendMeta}>{stats.recoltes.count} récoltes</div>
            </div>
          </div>

          <div style={styles.trendCard}>
            <div style={styles.trendIcon}>🌳</div>
            <div style={styles.trendContent}>
              <div style={styles.trendValue}>{trendData.productivityPerTree} g</div>
              <div style={styles.trendLabel}>Productivité par arbre</div>
              <div style={styles.trendMeta}>{stats.arbres.count} arbres</div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 5: SANTÉ DES PARCELLES - PHASE 1 */}
      <section style={styles.chartSection}>
        <div style={styles.chartCardFull}>
          <h3 style={styles.chartTitle}>
            <span>🌳</span> État de santé des parcelles
          </h3>
          <div style={styles.healthGrid}>
            {parcelleHealth.map((parcelle, idx) => (
              <div key={idx} style={styles.healthCard}>
                <div style={styles.healthHeader}>
                  <span style={styles.healthIcon}>{getHealthIcon(parcelle.status)}</span>
                  <div style={styles.healthInfo}>
                    <div style={styles.healthName}>{parcelle.nom}</div>
                    <div style={{...styles.healthStatus, color: getHealthColor(parcelle.status)}}>
                      {parcelle.status}
                    </div>
                  </div>
                </div>
                <div style={styles.healthBar}>
                  <div style={{
                    ...styles.healthBarFill,
                    width: `${parcelle.percentage}%`,
                    backgroundColor: getHealthColor(parcelle.status)
                  }} />
                </div>
                <div style={styles.healthStats}>
                  <span>{parcelle.production} kg</span>
                  <span>{parcelle.percentage.toFixed(1)}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 6: PRODUCTION MULTI-ANNÉES - PHASE 1 */}
      <section style={styles.chartSection}>
        <div style={styles.chartCardFull}>
          <div style={styles.chartHeader}>
            <h3 style={styles.chartTitle}>
              <span>📈</span> Production - Comparaison années
            </h3>
            <div style={styles.yearToggleButtons}>
              {availableYears.slice(0, 5).map(year => (
                <button
                  key={year}
                  onClick={() => {
                    let newSelection = [...selectedYearsComparison];
                    if (newSelection.includes(year)) {
                      newSelection = newSelection.filter(y => y !== year);
                    } else {
                      newSelection.push(year);
                    }
                    setSelectedYearsComparison(newSelection.sort((a, b) => b - a));
                  }}
                  style={{
                    ...styles.toggleButton,
                    background: selectedYearsComparison.includes(year) ? COLORS.primary : '#e0e0e0',
                    color: selectedYearsComparison.includes(year) ? 'white' : COLORS.dark
                  }}
                >
                  {year}
                </button>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={350}>
            <LineChart data={productionComparison}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis dataKey="mois" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip contentStyle={styles.tooltipStyle} />
              <Legend />
              {selectedYearsComparison.map((year, idx) => (
                <Line
                  key={year}
                  type="monotone"
                  dataKey={`year${year}`}
                  stroke={Object.values(YEAR_COLORS)[idx % 3]}
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  name={`${year}`}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* SECTION 7: RENTABILITÉ PAR PARCELLE - PHASE 2 */}
      <section style={styles.chartSection}>
        <div style={styles.chartCardFull}>
          <h3 style={styles.chartTitle}>
            <span>💰</span> Rentabilité par parcelle
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={rentabiliteData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis dataKey="nom" tick={{ fontSize: 11 }} angle={-45} textAnchor="end" height={80} />
              <YAxis yAxisId="left" label={{ value: 'Production (kg)', angle: -90, position: 'insideLeft' }} />
              <YAxis yAxisId="right" orientation="right" label={{ value: 'Chiffre affaires (€)', angle: 90, position: 'insideRight' }} />
              <Tooltip contentStyle={styles.tooltipStyle} />
              <Legend />
              <Bar yAxisId="left" dataKey="production" fill={COLORS.primary} name="Production (kg)" />
              <Line yAxisId="right" type="monotone" dataKey="ventes" stroke={COLORS.success} strokeWidth={2} name="Chiffre affaires (€)" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* SECTION 8: CALENDRIER DU MOIS - PHASE 2 */}
      <section style={styles.chartSection}>
        <div style={styles.chartCardFull}>
          <h3 style={styles.chartTitle}>
            <span>📅</span> Calendrier du mois
          </h3>
          <div style={styles.calendar}>
            <div style={styles.calendarGrid}>
              {monthCalendar.map((day, idx) => (
                <div
                  key={idx}
                  style={{
                    ...styles.calendarDay,
                    ...(day.hasActivity ? styles.calendarDayActive : {})
                  }}
                >
                  <div style={styles.calendarDayNumber}>{day.day}</div>
                  {day.recoltes.length > 0 && (
                    <div style={styles.calendarActivity}>🍄 {day.recoltes.length}</div>
                  )}
                  {day.interventions.length > 0 && (
                    <div style={styles.calendarActivity}>🛠️ {day.interventions.length}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 9: PRODUCTION PAR PARCELLE */}
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

      {/* SECTION 10: PRODUCTION MENSUELLE */}
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
                <linearGradient id="colorProd" x1="0" y1="0" x2="0" y2="1": 