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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({
    parcelles: { count: 0, surface: 0 },
    arbres: { count: 0, parEtat: [] },
    recoltes: { totalGrammes: 0, count: 0 },
    ventes: { chiffreAffaires: 0, count: 0 },
    interventions: { aVenir: 0 },
    commandes: { enCours: 0 }
  });
  const [weather, setWeather] = useState(null);
  const [forecast, setForecast] = useState([]);
  const [stockData, setStockData] = useState(null);
  const [alertes, setAlertes] = useState({ commandesEnAttente: 0, ventesEnAttente: 0 });
  const [productionParMois, setProductionParMois] = useState([]);
  const [productionParParcelle, setProductionParParcelle] = useState([]);
  const [parcelleHealth, setParcelleHealth] = useState([]);
  const [rentabiliteData, setRentabiliteData] = useState([]);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [availableYears, setAvailableYears] = useState([]);
  const [selectedYearsComparison, setSelectedYearsComparison] = useState([]);
  const [productionComparison, setProductionComparison] = useState([]);
  const [monthCalendar, setMonthCalendar] = useState([]);
  const [trendData, setTrendData] = useState({ productionTrend: 0, avgPerRecolte: 0, productivityPerTree: 0 });

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
    const thisMonthKey = `${thisMonth.getFullYear()}-${String(thisMonth.getMonth() + 1).padStart(2, '0')}`;
    const lastMonthKey = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, '0')}`;
    const thisMonthData = safeArray(recoltesMensuelles).find(item => item && item.mois === thisMonthKey);
    const lastMonthData = safeArray(recoltesMensuelles).find(item => item && item.mois === lastMonthKey);
    const thisMonthProd = thisMonthData ? safeParseFloat(thisMonthData.total_grammes, 0) : 0;
    const lastMonthProd = lastMonthData ? safeParseFloat(lastMonthData.total_grammes, 0) : 0;
    const productionTrend = lastMonthProd > 0 ? ((thisMonthProd - lastMonthProd) / lastMonthProd * 100) : 0;
    const avgPerRecolte = stats.recoltes.count > 0 ? safeParseFloat(stats.recoltes.totalGrammes, 0) / stats.recoltes.count : 0;
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
      const [recoltesRes, interventionsRes, commandesRes, ventesRes, recoltesMensuellesRes, stockRes] = await Promise.allSettled([
        axios.get(`${API_URL}/recoltes`).catch(() => ({ data: [] })),
        axios.get(`${API_URL}/interventions`).catch(() => ({ data: [] })),
        axios.get(`${API_URL}/commandes`).catch(() => ({ data: [] })),
        axios.get(`${API_URL}/ventes`).catch(() => ({ data: [] })),
        axios.get(`${API_URL}/stats/recoltes-mensuelles`).catch(() => ({ data: [] })),
        axios.get(`${API_URL}/stock`).catch(() => ({ data: { stock_disponible_grammes: 0 } }))
      ]).then(results => results.map(r => r.status === 'fulfilled' ? r.value : { data: [] }));
      setStockData(stockRes.data);
      const commandesEnAttente = safeArray(commandesRes.data).filter(c => c && (c.statut === 'En attente' || c.statut === 'Confirmée')).length;
      const ventesEnAttente = safeArray(ventesRes.data).filter(v => v && v.statut === 'En attente').length;
      setAlertes({ commandesEnAttente, ventesEnAttente });
      const prodParParcelle = {};
      const ventesParParcelle = {};
      (recoltesRes.data || []).forEach(recolte => {
        if (!recolte) return;
        const parcelle = recolte.parcelle_nom || 'Non défini';
        const poids = safeParseFloat(recolte.poids_grammes, 0);
        if (!prodParParcelle[parcelle]) prodParParcelle[parcelle] = { kg: 0, count: 0 };
        prodParParcelle[parcelle].kg += poids / 1000;
        prodParParcelle[parcelle].count += 1;
      });
      (ventesRes.data || []).forEach(vente => {
        if (!vente) return;
        const parcelle = vente.parcelle_nom || 'Non défini';
        if (!ventesParParcelle[parcelle]) ventesParParcelle[parcelle] = 0;
        ventesParParcelle[parcelle] += safeParseFloat(vente.montant_total, 0);
      });
      const prodParcelleArray = Object.entries(prodParParcelle)
        .map(([nom, data]) => ({ nom, kg: parseFloat(data.kg.toFixed(2)), count: data.count }))
        .sort((a, b) => b.kg - a.kg);
      setProductionParParcelle(prodParcelleArray);
      const health = prodParcelleArray.map(p => {
        const totalProd = prodParcelleArray.reduce((sum, x) => sum + x.kg, 0);
        const percentage = totalProd > 0 ? (p.kg / totalProd) * 100 : 0;
        let status = 'Mauvais';
        if (percentage >= 15) status = 'Excellent';
        else if (percentage >= 10) status = 'Bon';
        else if (percentage >= 5) status = 'Moyen';
        return { nom: p.nom, production: p.kg, percentage, status };
      });
      setParcelleHealth(health);
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
      const calendar = buildMonthCalendar(recoltesRes.data, interventionsRes.data);
      setMonthCalendar(calendar);
      const years = getAvailableYears(recoltesMensuellesRes.data);
      setAvailableYears(years);
      const defaultYears = years.slice(0, 3);
      setSelectedYearsComparison(defaultYears);
      if (!years.includes(selectedYear)) setSelectedYear(years[0] || new Date().getFullYear());
      const productionMensuelle = prepareProductionMensuelle(recoltesMensuellesRes.data, selectedYear);
      setProductionParMois(productionMensuelle);
      const comparisonData = prepareProductionComparison(recoltesMensuellesRes.data, defaultYears);
      setProductionComparison(comparisonData);
      const trends = calculateTrendData(recoltesRes.data, recoltesMensuellesRes.data);
      setTrendData(trends);
      setLoading(false);
    } catch (err) {
      console.error('Erreur lors du chargement:', err);
      setError('Impossible de charger les données du tableau de bord');
      setLoading(false);
    }
  };

  const getAvailableYears = (data) => {
    const years = new Set();
    const now = new Date();
    for (let i = 0; i < 3; i++) years.add(now.getFullYear() - i);
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
    const colorMap = { 'Excellent': '#27ae60', 'Bon': '#2196F3', 'Moyen': '#f39c12', 'Mauvais': '#e74c3c' };
    return colorMap[status] || '#95a5a6';
  };

  const getHealthIcon = (status) => {
    const iconMap = { 'Excellent': '✨', 'Bon': '✅', 'Moyen': '⚠️', 'Mauvais': '❌' };
    return iconMap[status] || '➖';
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
    const temp = weather.temp, humidity = weather.humidity, rain = weather.rain_1h || 0;
    if (rain > 1) return { text: 'Pluie', color: COLORS.danger, icon: '🌧️' };
    if (temp < 5) return { text: 'Gel', color: COLORS.danger, icon: '❄️' };
    if (temp > 25 && humidity < 40) return { text: 'Stress hydrique', color: COLORS.warning, icon: '🔥' };
    if (humidity > 80) return { text: 'Humidité haute', color: COLORS.info, icon: '💧' };
    return { text: 'Normal', color: COLORS.success, icon: '✅' };
  };

  if (loading) {
    return (
      <div style={styles.pageContainer}>
        <div style={styles.loadingContainer}>
          <div style={styles.loadingIcon}>🍄</div>
          <div>Chargement...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.pageContainer}>
        <div style={styles.errorContainer}>
          <span>⚠️</span>
          <p>{error}</p>
          <button onClick={loadDashboardData}>Réessayer</button>
        </div>
      </div>
    );
  }

  const stockStatus = getStockStatus(stockData?.stock_disponible_grammes || 0);
  const riskLevel = getRiskLevel(weather);

  return (
    <div style={styles.pageContainer}>
      <section style={styles.patrimoneBanner}>
        <div style={styles.patrimoineContent}>
          <div style={styles.patrimoineStat}>
            <span>🌳</span>
            <div>
              <div style={styles.patrimoineValue}>{stats.arbres.count}</div>
              <div>Arbres truffiers</div>
            </div>
          </div>
          <div style={styles.patrimoineStat}>
            <span>📋</span>
            <div>
              <div style={styles.patrimoineValue}>{stats.parcelles.count}</div>
              <div>Parcelles</div>
            </div>
          </div>
          <div style={styles.patrimoineStat}>
            <span>📐</span>
            <div>
              <div style={styles.patrimoineValue}>{stats.parcelles.surface.toFixed(2)}</div>
              <div>Hectares</div>
            </div>
          </div>
        </div>
      </section>

      {weather && (
        <section style={styles.weatherBanner}>
          <div style={styles.weatherMain}>
            <div style={styles.weatherIcon}>{getWeatherIcon(weather.icon)}</div>
            <div>{weather.temp}°C</div>
            <div>{weather.description}</div>
          </div>
          <div style={styles.weatherGrid}>
            <div>Ressenti: {weather.feels_like}°C</div>
            <div>Humidité: {weather.humidity}%</div>
            <div>Vent: {weather.wind_speed} km/h</div>
            <div>Pression: {weather.pressure} mb</div>
          </div>
        </section>
      )}

      <section style={styles.kpiSection}>
        <div style={styles.kpiGrid}>
          <div style={{...styles.kpiCard, ...styles.kpiCardAccent}}>
            <span>🍄</span>
            <div>
              <div style={{...styles.kpiValue, color: 'white'}}>{(stats.recoltes.totalGrammes / 1000).toFixed(2)} kg</div>
              <div>Production</div>
            </div>
          </div>
          <div style={styles.kpiCard}>
            <span>📦</span>
            <div>
              <div style={{...styles.kpiValue, color: stockStatus.color}}>{formatWeight(stockData?.stock_disponible_grammes || 0)}</div>
              <div>Stock</div>
            </div>
          </div>
          <div style={styles.kpiCard}>
            <span>💰</span>
            <div>
              <div style={{...styles.kpiValue, color: COLORS.success}}>{stats.ventes.chiffreAffaires.toFixed(2)} €</div>
              <div>Chiffre d'affaires</div>
            </div>
          </div>
        </div>
      </section>

      <section style={styles.trendSection}>
        <h3>Indicateurs de tendance</h3>
        <div style={styles.trendGrid}>
          <div style={styles.trendCard}>
            <div>{trendData.productionTrend >= 0 ? '📈' : '📉'}</div>
            <div>
              <div style={{color: trendData.productionTrend >= 0 ? COLORS.success : COLORS.danger}}>
                {trendData.productionTrend > 0 ? '+' : ''}{trendData.productionTrend}%
              </div>
              <div>Tendance production</div>
            </div>
          </div>
          <div style={styles.trendCard}>
            <div>⚖️</div>
            <div>
              <div>{trendData.avgPerRecolte} g</div>
              <div>Moyenne/récolte</div>
            </div>
          </div>
          <div style={styles.trendCard}>
            <div>🌳</div>
            <div>
              <div>{trendData.productivityPerTree} g</div>
              <div>Productivité/arbre</div>
            </div>
          </div>
        </div>
      </section>

      <section style={styles.chartSection}>
        <h3>Santé des parcelles</h3>
        <div style={styles.healthGrid}>
          {parcelleHealth.map((parcelle, idx) => (
            <div key={idx} style={styles.healthCard}>
              <div>{getHealthIcon(parcelle.status)} {parcelle.nom}</div>
              <div style={{...styles.healthStatus, color: getHealthColor(parcelle.status)}}>{parcelle.status}</div>
              <div style={styles.healthBar}>
                <div style={{
                  ...styles.healthBarFill,
                  width: `${parcelle.percentage}%`,
                  backgroundColor: getHealthColor(parcelle.status)
                }} />
              </div>
              <div>{parcelle.production} kg - {parcelle.percentage.toFixed(1)}%</div>
            </div>
          ))}
        </div>
      </section>

      <section style={styles.chartSection}>
        <h3>Production - Comparaison années</h3>
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
        <ResponsiveContainer width="100%" height={350}>
          <LineChart data={productionComparison}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
            <XAxis dataKey="mois" />
            <YAxis />
            <Tooltip />
            <Legend />
            {selectedYearsComparison.map((year) => (
              <Line key={year} type="monotone" dataKey={`year${year}`} stroke={COLORS.primary} strokeWidth={2} name={`${year}`} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </section>

      <section style={styles.chartSection}>
        <h3>Rentabilité par parcelle</h3>
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={rentabiliteData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
            <XAxis dataKey="nom" />
            <YAxis yAxisId="left" />
            <YAxis yAxisId="right" orientation="right" />
            <Tooltip />
            <Legend />
            <Bar yAxisId="left" dataKey="production" fill={COLORS.primary} name="Production (kg)" />
            <Line yAxisId="right" type="monotone" dataKey="ventes" stroke={COLORS.success} strokeWidth={2} name="Ventes (€)" />
          </ComposedChart>
        </ResponsiveContainer>
      </section>

      <section style={styles.chartSection}>
        <h3>Calendrier du mois</h3>
        <div style={styles.calendar}>
          <div style={styles.calendarGrid}>
            {monthCalendar.map((day, idx) => (
              <div key={idx} style={{...styles.calendarDay, ...(day.hasActivity ? styles.calendarDayActive : {})}}>
                <div>{day.day}</div>
                {day.recoltes.length > 0 && <div>🍄 {day.recoltes.length}</div>}
                {day.interventions.length > 0 && <div>🛠️ {day.interventions.length}</div>}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={styles.chartSection}>
        <h3>Production par parcelle</h3>
        <div style={styles.productionTable}>
          <div style={styles.tableHeader}>
            <div>Parcelle</div>
            <div>Production (kg)</div>
            <div>Récoltes</div>
            <div>Moy/Récolte</div>
          </div>
          {productionParParcelle.map((parcelle, idx) => {
            const moyenne = parcelle.count > 0 ? (parcelle.kg * 1000 / parcelle.count).toFixed(0) : 0;
            return (
              <div key={idx} style={styles.tableRow}>
                <div>{parcelle.nom}</div>
                <div style={{color: COLORS.primary}}>{parcelle.kg} kg</div>
                <div>{parcelle.count}</div>
                <div>{moyenne} g</div>
              </div>
            );
          })}
        </div>
      </section>

      <section style={styles.chartSection}>
        <h3>Production mensuelle</h3>
        <select value={selectedYear} onChange={(e) => setSelectedYear(parseInt(e.target.value))} style={styles.yearSelect}>
          {availableYears.map(year => (<option key={year} value={year}>{year}</option>))}
        </select>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={productionParMois}>
            <defs>
              <linearGradient id="colorProd" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={COLORS.primary} stopOpacity={0.8}/>
                <stop offset="95%" stopColor={COLORS.primary} stopOpacity={0.1}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
            <XAxis dataKey="mois" />
            <YAxis />
            <Tooltip />
            <Area type="monotone" dataKey="production" stroke={COLORS.primary} fillOpacity={1} fill="url(#colorProd)" />
          </AreaChart>
        </ResponsiveContainer>
      </section>
    </div>
  );
}

const styles = {
  pageContainer: { padding: '20px', backgroundColor: '#f5f5f5', minHeight: '100vh' },
  patrimoneBanner: { backgroundColor: COLORS.primary, color: 'white', padding: '20px', borderRadius: '8px', marginBottom: '20px' },
  patrimoineContent: { display: 'flex', justifyContent: 'space-around', alignItems: 'center', gap: '20px' },
  patrimoineStat: { display: 'flex', alignItems: 'center', gap: '15px' },
  patrimoineValue: { fontSize: '24px', fontWeight: 'bold' },
  weatherBanner: { backgroundColor: '#e3f2fd', padding: '20px', borderRadius: '8px', marginBottom: '20px' },
  weatherMain: { display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '10px' },
  weatherIcon: { fontSize: '48px' },
  weatherGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '10px' },
  kpiSection: { marginBottom: '20px' },
  kpiGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' },
  kpiCard: { backgroundColor: 'white', padding: '15px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', display: 'flex', alignItems: 'center', gap: '15px' },
  kpiCardAccent: { backgroundColor: COLORS.primary, color: 'white' },
  kpiValue: { fontSize: '20px', fontWeight: 'bold' },
  trendSection: { backgroundColor: 'white', padding: '20px', borderRadius: '8px', marginBottom: '20px' },
  trendGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '15px', marginTop: '15px' },
  trendCard: { padding: '15px', backgroundColor: '#f9f9f9', borderRadius: '8px', borderLeft: `4px solid ${COLORS.primary}` },
  chartSection: { backgroundColor: 'white', padding: '20px', borderRadius: '8px', marginBottom: '20px' },
  healthGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginTop: '15px' },
  healthCard: { padding: '15px', backgroundColor: '#f9f9f9', borderRadius: '8px', border: '1px solid #ddd' },
  healthStatus: { fontSize: '12px', fontWeight: 'bold' },
  healthBar: { height: '8px', backgroundColor: '#e0e0e0', borderRadius: '4px', marginTop: '8px', overflow: 'hidden' },
  healthBarFill: { height: '100%', transition: 'width 0.3s' },
  yearToggleButtons: { display: 'flex', gap: '10px', marginBottom: '15px' },
  toggleButton: { padding: '8px 16px', borderRadius: '4px', border: 'none', cursor: 'pointer', fontSize: '14px' },
  calendar: { marginTop: '15px' },
  calendarGrid: { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '5px' },
  calendarDay: { padding: '10px', backgroundColor: '#f9f9f9', borderRadius: '4px', border: '1px solid #ddd', minHeight: '80px', fontSize: '12px' },
  calendarDayActive: { backgroundColor: '#e8f5e9', borderColor: COLORS.success },
  productionTable: { marginTop: '15px' },
  tableHeader: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', fontWeight: 'bold', padding: '10px', backgroundColor: '#f0f0f0', borderRadius: '4px' },
  tableRow: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', padding: '10px', borderBottom: '1px solid #eee' },
  yearSelect: { padding: '8px', borderRadius: '4px', border: '1px solid #ccc' },
  loadingContainer: { textAlign: 'center', marginTop: '50px' },
  errorContainer: { textAlign: 'center', marginTop: '50px', color: COLORS.danger },
  tooltipStyle: { backgroundColor: 'white', border: `1px solid ${COLORS.primary}`, borderRadius: '4px', padding: '10px' }
};

export default Dashboard;