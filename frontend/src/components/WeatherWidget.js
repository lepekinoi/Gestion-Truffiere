import React, { useState, useEffect, useCallback } from 'react';

// Configuration Météo Concept
const METEO_CONFIG = {
  TOKEN: process.env.REACT_APP_METEO_CONCEPT_TOKEN || '',
  USE_METEO_CONCEPT: process.env.REACT_APP_USE_METEO_CONCEPT === 'true',
  FALLBACK_API_KEY: 'bfa869b97ace2b1f8fd373765e64ed64',
  CACHE_DURATION: 2 * 60 * 60 * 1000, // 2 heures en millisecondes
  REFRESH_INTERVAL: 2 * 60 * 60 * 1000 // Rafraîchir toutes les 2 heures
};

function WeatherWidget({ 
  inseeCode = '79170', // Lusseray
  location = "Lusseray,FR",
  showForecastByDefault = false,
  showIndicators = false, // Afficher indicateurs trufficulture
  horizontal = true // NOUVEAU: mode horizontal par défaut pour sidebar
}) {
  const [weather, setWeather] = useState(null);
  const [enrichedData, setEnrichedData] = useState(null);
  const [forecast, setForecast] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForecast, setShowForecast] = useState(showForecastByDefault);
  const [usingMeteoConcept, setUsingMeteoConcept] = useState(false);
  const [alerts, setAlerts] = useState([]);
  const [lastUpdate, setLastUpdate] = useState(null);

  // Clé de cache pour localStorage
  const CACHE_KEY = `weather_cache_${inseeCode}_${location}`;

  // Charger depuis le cache
  const loadFromCache = useCallback(() => {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const data = JSON.parse(cached);
        const now = Date.now();
        
        // Vérifier si le cache est encore valide
        if (now - data.timestamp < METEO_CONFIG.CACHE_DURATION) {
          setWeather(data.weather);
          setEnrichedData(data.enrichedData);
          setForecast(data.forecast);
          setUsingMeteoConcept(data.usingMeteoConcept);
          setAlerts(data.alerts);
          setLastUpdate(new Date(data.timestamp));
          setLoading(false);
          return true;
        }
      }
    } catch (err) {
      console.warn('Erreur lecture cache:', err);
    }
    return false;
  }, [CACHE_KEY]);

  // Sauvegarder dans le cache
  const saveToCache = useCallback((data) => {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({
        ...data,
        timestamp: Date.now()
      }));
      setLastUpdate(new Date());
    } catch (err) {
      console.warn('Erreur écriture cache:', err);
    }
  }, [CACHE_KEY]);

  const loadWeather = useCallback(async (forceRefresh = false) => {
    // Essayer de charger depuis le cache si ce n'est pas un rafraîchissement forcé
    if (!forceRefresh && loadFromCache()) {
      return;
    }

    try {
      if (METEO_CONFIG.USE_METEO_CONCEPT && METEO_CONFIG.TOKEN) {
        await loadMeteoConcept();
      } else {
        await loadOpenWeatherMap();
      }
      setLoading(false);
    } catch (err) {
      console.error('Erreur météo:', err);
      setError(err.message);
      if (usingMeteoConcept) {
        await loadOpenWeatherMap();
      }
      setLoading(false);
    }
  }, [loadFromCache, usingMeteoConcept]);

  useEffect(() => {
    loadWeather();
    
    // Rafraîchissement automatique toutes les 2 heures (au lieu de 30 min)
    const interval = setInterval(() => {
      // Ne rafraîchir que si la page est visible
      if (!document.hidden) {
        loadWeather(true);
      }
    }, METEO_CONFIG.REFRESH_INTERVAL);
    
    // Rafraîchir quand la page redevient visible (si cache expiré)
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
          const data = JSON.parse(cached);
          if (Date.now() - data.timestamp >= METEO_CONFIG.CACHE_DURATION) {
            loadWeather(true);
          }
        }
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [loadWeather, CACHE_KEY]);

  // ==================== MÉTÉO CONCEPT ====================
  const loadMeteoConcept = async () => {
    const url = `https://api.meteo-concept.com/api/forecast/daily?token=${METEO_CONFIG.TOKEN}&insee=${inseeCode}`;
    const res = await fetch(url);
    
    if (!res.ok) throw new Error('Météo Concept API error');
    
    const data = await res.json();
    setUsingMeteoConcept(true);
    
    const processedForecast = data.forecast.map(day => ({
      date: new Date(day.datetime),
      day: day.day,
      temp_min: day.tmin,
      temp_max: day.tmax,
      rain_mm: day.rr10 || 0,
      rain_probability: day.probarain || 0,
      etp_mm: day.etp || 0,
      frost_probability: day.probafrost || 0,
      sun_hours: day.sun_hours || 0,
      wind_speed: day.wind10m || 0,
      weather_code: day.weather || 0,
      humidity: estimateHumidity(day.probarain || 0),
      favorable: evaluateTruffleConditions(day)
    }));
    
    const today = processedForecast[0];
    const next7Days = processedForecast.slice(0, 7);
    
    // Calculs agrégés
    const rainCumul7d = next7Days.reduce((sum, d) => sum + d.rain_mm, 0);
    const etpCumul7d = next7Days.reduce((sum, d) => sum + d.etp_mm, 0);
    const bilanHydrique7d = rainCumul7d - etpCumul7d;
    
    const weatherData = {
      temp: today.temp_max,
      temp_min: today.temp_min,
      feels_like: today.temp_max - 2,
      humidity: today.humidity,
      description: getWeatherDescription(today.weather_code),
      icon: today.weather_code,
      wind_speed: today.wind_speed,
      rain_mm: today.rain_mm,
      rain_probability: today.rain_probability,
      clouds: today.weather_code > 3 ? 75 : 25
    };
    
    const enriched = {
      etp_today: today.etp_mm,
      frost_probability: today.frost_probability,
      sun_hours: today.sun_hours,
      rainCumul7d,
      etpCumul7d,
      bilanHydrique7d,
      dew_point: calculateDewPoint(today.temp_max, today.humidity),
      favorable: today.favorable
    };
    
    setWeather(weatherData);
    setEnrichedData(enriched);
    setForecast(next7Days);
    
    // Calcul des alertes
    const newAlerts = [];
    if (bilanHydrique7d < -20) {
      newAlerts.push({
        type: 'drought',
        severity: 'warning',
        icon: '🌵',
        message: `Déficit: ${bilanHydrique7d.toFixed(1)}mm`
      });
    }
    const frostDays = next7Days.filter(d => (d.frost_probability || 0) > 50);
    if (frostDays.length > 0) {
      newAlerts.push({
        type: 'frost',
        severity: 'danger',
        icon: '❄️',
        message: `Gel: ${frostDays.length}j`
      });
    }
    const favorableDays = next7Days.filter(d => d.favorable);
    if (favorableDays.length >= 3) {
      newAlerts.push({
        type: 'favorable',
        severity: 'success',
        icon: '✅',
        message: `${favorableDays.length}j favorables`
      });
    }
    setAlerts(newAlerts);
    
    // Sauvegarder dans le cache
    saveToCache({
      weather: weatherData,
      enrichedData: enriched,
      forecast: next7Days,
      usingMeteoConcept: true,
      alerts: newAlerts
    });
  };

  // ==================== OPENWEATHERMAP (FALLBACK) ====================
  const loadOpenWeatherMap = async () => {
    setUsingMeteoConcept(false);
    
    const weatherRes = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?q=${location}&appid=${METEO_CONFIG.FALLBACK_API_KEY}&units=metric&lang=fr`
    );

    if (!weatherRes.ok) throw new Error('OpenWeatherMap API error');

    const weatherData = await weatherRes.json();
    
    const currentWeather = {
      temp: Math.round(weatherData.main.temp),
      temp_min: Math.round(weatherData.main.temp_min),
      feels_like: Math.round(weatherData.main.feels_like),
      humidity: weatherData.main.humidity,
      description: weatherData.weather[0].description,
      icon: weatherData.weather[0].icon,
      wind_speed: Math.round(weatherData.wind.speed * 3.6),
      clouds: weatherData.clouds.all,
      rain_mm: weatherData.rain?.['1h'] || 0
    };
    
    setWeather(currentWeather);

    // Prévisions
    const forecastRes = await fetch(
      `https://api.openweathermap.org/data/2.5/forecast?q=${location}&appid=${METEO_CONFIG.FALLBACK_API_KEY}&units=metric&lang=fr`
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
            temp_min: Math.round(item.main.temp_min),
            temp_max: Math.round(item.main.temp_max),
            description: item.weather[0].description,
            icon: item.weather[0].icon,
            humidity: item.main.humidity,
            wind_speed: Math.round(item.wind.speed * 3.6),
            rain_probability: Math.round(item.pop * 100),
            rain_mm: item.rain?.['3h'] || 0
          });
        }
      });

      setForecast(dailyForecast.slice(0, 5));
      
      // Sauvegarder dans le cache
      saveToCache({
        weather: currentWeather,
        enrichedData: null,
        forecast: dailyForecast.slice(0, 5),
        usingMeteoConcept: false,
        alerts: []
      });
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
    
    // Température idéale
    if (day.tmin >= 10 && day.tmax <= 20) score += 3;
    else if (day.tmin >= 5 && day.tmax <= 25) score += 1;
    
    // Pluie modérée
    const rainMm = day.rr10 || day.rain_mm || 0;
    if (rainMm >= 5 && rainMm <= 15) score += 2;
    else if (rainMm > 0 && rainMm < 5) score += 1;
    
    // Pas de gel
    if ((day.probafrost || day.frost_probability || 0) < 20) score += 1;
    
    // ETP faible
    if ((day.etp || day.etp_mm || 0) < 5) score += 1;
    
    return score >= 4;
  };

  const getWeatherDescription = (code) => {
    if (code <= 2) return 'Ensoleillé';
    if (code <= 4) return 'Partiellement nuageux';
    if (code <= 6) return 'Nuageux';
    if (code <= 9) return 'Pluie légère';
    if (code <= 12) return 'Pluie forte';
    if (code <= 15) return 'Neige';
    if (code <= 19) return 'Orage';
    return 'Brouillard';
  };

  // ==================== HELPERS ====================
  const getWeatherIcon = (code) => {
    // Météo Concept
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
    
    // OpenWeatherMap
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

  const getTemperatureColor = (temp) => {
    if (temp < 0) return '#3498db';
    if (temp < 10) return '#5dade2';
    if (temp < 20) return '#f39c12';
    if (temp < 30) return '#e67e22';
    return '#e74c3c';
  };

  const getDayName = (date) => {
    const today = new Date();
    const tomorrow = new Date(today.getTime() + 24*60*60*1000);
    
    if (date.toDateString() === today.toDateString()) return "Auj.";
    if (date.toDateString() === tomorrow.toDateString()) return "Dem.";
    
    return date.toLocaleDateString('fr-FR', { weekday: 'short' });
  };

  const getSeverityColor = (severity) => {
    if (severity === 'danger') return '#e74c3c';
    if (severity === 'warning') return '#f39c12';
    return '#27ae60';
  };

  const formatLastUpdate = () => {
    if (!lastUpdate) return '';
    const now = Date.now();
    const diff = now - lastUpdate.getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'À l\'instant';
    if (minutes < 60) return `Il y a ${minutes} min`;
    const hours = Math.floor(minutes / 60);
    return `Il y a ${hours}h`;
  };

  // ==================== RENDU ====================
  if (loading) {
    return (
      <div style={horizontal ? stylesH.container : styles.container}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: horizontal ? '1.5rem' : '2rem', marginBottom: '0.5rem' }}>🌤️</div>
          <div style={{ fontSize: '0.9rem' }}>Chargement météo...</div>
        </div>
      </div>
    );
  }

  if (error || !weather) {
    return (
      <div style={horizontal ? stylesH.container : styles.container}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: horizontal ? '1.5rem' : '2rem', marginBottom: '0.5rem' }}>⚠️</div>
          <div style={{ fontSize: '0.9rem' }}>Météo indisponible</div>
        </div>
      </div>
    );
  }

  // ==================== RENDU HORIZONTAL ====================
  if (horizontal) {
    return (
      <div style={stylesH.container}>
        {/* En-tête compact */}
        <div style={stylesH.header}>
          <div style={stylesH.headerLeft}>
            <span style={stylesH.icon}>{getWeatherIcon(weather.icon)}</span>
            <div>
              <div style={stylesH.temp}>{weather.temp}°C</div>
              <div style={stylesH.location}>{location.split(',')[0]}</div>
            </div>
          </div>
          <button
            onClick={() => loadWeather(true)}
            style={stylesH.refreshBtn}
            title="Actualiser"
            onMouseEnter={(e) => e.currentTarget.style.transform = 'rotate(180deg)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'rotate(0deg)'}
          >
            🔄
          </button>
        </div>

        {/* Infos principales en ligne */}
        <div style={stylesH.mainInfo}>
          <div style={stylesH.infoItem}>
            <span>💧 {weather.humidity}%</span>
          </div>
          <div style={stylesH.infoItem}>
            <span>💨 {weather.wind_speed} km/h</span>
          </div>
          <div style={stylesH.infoItem}>
            <span>🌡️ {weather.feels_like}°C</span>
          </div>
        </div>

        {/* Indicateurs trufficulture horizontaux */}
        {showIndicators && enrichedData && usingMeteoConcept && (
          <div style={stylesH.indicators}>
            <div style={stylesH.indicator}>
              <span style={stylesH.indicatorLabel}>Bilan 7j</span>
              <span style={{
                ...stylesH.indicatorValue,
                color: enrichedData.bilanHydrique7d < -15 ? '#e74c3c' : '#27ae60'
              }}>
                {enrichedData.bilanHydrique7d.toFixed(1)}mm
              </span>
            </div>
            <div style={stylesH.indicator}>
              <span style={stylesH.indicatorLabel}>ETP</span>
              <span style={stylesH.indicatorValue}>
                {enrichedData.etp_today.toFixed(1)}mm
              </span>
            </div>
            <div style={stylesH.indicator}>
              <span style={stylesH.indicatorLabel}>Gel</span>
              <span style={{
                ...stylesH.indicatorValue,
                color: enrichedData.frost_probability > 50 ? '#e74c3c' : '#27ae60'
              }}>
                {enrichedData.frost_probability}%
              </span>
            </div>
            <div style={stylesH.indicator}>
              <span style={stylesH.indicatorLabel}>État</span>
              <span style={stylesH.indicatorValue}>
                {enrichedData.favorable ? '✅' : '⚠️'}
              </span>
            </div>
          </div>
        )}

        {/* Alertes */}
        {alerts.length > 0 && (
          <div style={stylesH.alerts}>
            {alerts.map((alert, idx) => (
              <div key={idx} style={stylesH.alert}>
                <span>{alert.icon}</span>
                <span style={{ fontSize: '0.75rem' }}>{alert.message}</span>
              </div>
            ))}
          </div>
        )}

        {/* Footer avec dernière mise à jour */}
        <div style={stylesH.footer}>
          <span style={stylesH.updateTime}>
            {formatLastUpdate()}
          </span>
          <span style={stylesH.source}>
            {usingMeteoConcept ? '🛰️ Météo Concept' : '🌐 OWM'}
          </span>
        </div>
      </div>
    );
  }

  // ==================== RENDU VERTICAL (mode classique) ====================
  return (
    <div style={styles.container}>
      {/* Badge API source */}
      <div style={styles.apiBadge}>
        {usingMeteoConcept ? '🛰️ Météo Concept' : '🌐 OpenWeatherMap'}
      </div>

      {/* En-tête */}
      <div style={styles.header}>
        <div>
          <div style={styles.locationText}>
            🌍 {location.split(',')[0]}
          </div>
          <div style={styles.nowText}>Maintenant</div>
        </div>
        <div style={styles.mainIcon}>
          {getWeatherIcon(weather.icon)}
        </div>
      </div>

      {/* Température principale */}
      <div style={styles.tempContainer}>
        <div style={{
          ...styles.tempMain,
          color: getTemperatureColor(weather.temp)
        }}>
          {weather.temp}°
        </div>
        <div style={styles.tempUnit}>C</div>
      </div>

      {/* Description */}
      <div style={styles.description}>
        {weather.description}
      </div>

      {/* Alertes trufficulture */}
      {alerts.length > 0 && (
        <div style={styles.alertsContainer}>
          {alerts.map((alert, idx) => (
            <div 
              key={idx} 
              style={{
                ...styles.alert,
                borderColor: getSeverityColor(alert.severity)
              }}
            >
              <span style={{ fontSize: '1.2rem', marginRight: '0.5rem' }}>{alert.icon}</span>
              <span style={{ fontSize: '0.85rem' }}>{alert.message}</span>
            </div>
          ))}
        </div>
      )}

      {/* Indicateurs enrichis (Météo Concept) */}
      {showIndicators && enrichedData && usingMeteoConcept && (
        <div style={styles.enrichedGrid}>
          <div style={styles.enrichedCard}>
            <div style={styles.enrichedLabel}>💧 Bilan 7j</div>
            <div style={{
              ...styles.enrichedValue,
              color: enrichedData.bilanHydrique7d < -15 ? '#e74c3c' : '#27ae60'
            }}>
              {enrichedData.bilanHydrique7d.toFixed(1)}mm
            </div>
          </div>
          
          <div style={styles.enrichedCard}>
            <div style={styles.enrichedLabel}>☀️ ETP</div>
            <div style={styles.enrichedValue}>
              {enrichedData.etp_today.toFixed(1)}mm
            </div>
          </div>
          
          <div style={styles.enrichedCard}>
            <div style={styles.enrichedLabel}>❄️ Gel</div>
            <div style={{
              ...styles.enrichedValue,
              color: enrichedData.frost_probability > 50 ? '#e74c3c' : '#27ae60'
            }}>
              {enrichedData.frost_probability}%
            </div>
          </div>
          
          <div style={styles.enrichedCard}>
            <div style={styles.enrichedLabel}>🍄 État</div>
            <div style={{
              ...styles.enrichedValue,
              color: enrichedData.favorable ? '#27ae60' : '#f39c12'
            }}>
              {enrichedData.favorable ? '✅' : '⚠️'}
            </div>
          </div>
        </div>
      )}

      {/* Détails météo standard */}
      <div style={styles.detailsGrid}>
        <div style={styles.detailCard}>
          <div style={styles.detailLabel}>🌡️ Ressenti</div>
          <div style={styles.detailValue}>{weather.feels_like}°C</div>
        </div>

        <div style={styles.detailCard}>
          <div style={styles.detailLabel}>💧 Humidité</div>
          <div style={styles.detailValue}>{weather.humidity}%</div>
        </div>

        <div style={styles.detailCard}>
          <div style={styles.detailLabel}>💨 Vent</div>
          <div style={styles.detailValue}>{weather.wind_speed} km/h</div>
        </div>

        <div style={styles.detailCard}>
          <div style={styles.detailLabel}>☁️ Nuages</div>
          <div style={styles.detailValue}>{weather.clouds}%</div>
        </div>
      </div>

      {/* Bouton prévisions */}
      {forecast.length > 0 && (
        <>
          <button
            onClick={() => setShowForecast(!showForecast)}
            style={styles.forecastButton}
            onMouseEnter={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.3)'}
            onMouseLeave={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.2)'}
          >
            {showForecast ? '▲ Masquer' : `▼ Prévisions ${usingMeteoConcept ? '7' : '5'} jours`}
          </button>

          {/* Prévisions */}
          {showForecast && (
            <div style={styles.forecastContainer}>
              {forecast.map((day, idx) => (
                <div key={idx} style={styles.forecastDay}>
                  <div style={styles.forecastDayName}>
                    {getDayName(day.date)}
                    <div style={styles.forecastDate}>
                      {day.date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                    </div>
                  </div>
                  
                  <div style={styles.forecastIcon}>
                    {getWeatherIcon(day.icon || day.weather_code)}
                  </div>
                  
                  <div style={styles.forecastDesc}>
                    {day.description || getWeatherDescription(day.weather_code)}
                  </div>
                  
                  <div style={styles.forecastTemp}>
                    <span style={styles.tempMax}>{day.temp_max}°</span>
                    <span style={styles.tempMin}>{day.temp_min}°</span>
                  </div>
                  
                  {day.rain_probability > 0 && (
                    <div style={styles.forecastRain}>
                      💧 {day.rain_probability}%
                    </div>
                  )}
                  
                  {usingMeteoConcept && day.favorable && (
                    <div style={styles.favorableBadge}>✅ Favorable</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Conseil trufficulture */}
      <div style={styles.adviceCard}>
        <div style={styles.adviceTitle}>💡 Conseil trufficulture</div>
        <div style={styles.adviceText}>
          {enrichedData?.favorable
            ? "Conditions idéales pour le cavage ! 🍄"
            : weather.temp < 5
            ? "Température basse, surveillez le gel ❄️"
            : weather.humidity < 40
            ? "Air sec, pensez à l'irrigation 💧"
            : enrichedData?.bilanHydrique7d < -15
            ? "Déficit hydrique, surveillez l'humidité du sol 🌵"
            : "Conditions normales pour vos truffières 🌳"
          }
        </div>
      </div>

      {/* Dernière mise à jour */}
      {lastUpdate && (
        <div style={styles.updateFooter}>
          {formatLastUpdate()}
        </div>
      )}

      <style>{`
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

// ==================== STYLES HORIZONTAUX ====================
const stylesH = {
  container: {
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: 'white',
    padding: '1rem',
    borderRadius: '12px',
    boxShadow: '0 4px 16px rgba(102, 126, 234, 0.2)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '0.75rem'
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem'
  },
  icon: {
    fontSize: '2.5rem'
  },
  temp: {
    fontSize: '1.8rem',
    fontWeight: 'bold',
    lineHeight: 1
  },
  location: {
    fontSize: '0.75rem',
    opacity: 0.8,
    marginTop: '0.15rem'
  },
  refreshBtn: {
    background: 'rgba(255, 255, 255, 0.2)',
    border: 'none',
    borderRadius: '50%',
    width: '32px',
    height: '32px',
    cursor: 'pointer',
    fontSize: '1rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'transform 0.3s',
  },
  mainInfo: {
    display: 'flex',
    justifyContent: 'space-around',
    marginBottom: '0.75rem',
    padding: '0.5rem',
    background: 'rgba(255, 255, 255, 0.1)',
    borderRadius: '8px'
  },
  infoItem: {
    fontSize: '0.85rem',
    fontWeight: '500'
  },
  indicators: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '0.5rem',
    marginBottom: '0.75rem'
  },
  indicator: {
    flex: 1,
    background: 'rgba(255, 255, 255, 0.15)',
    padding: '0.5rem',
    borderRadius: '8px',
    textAlign: 'center'
  },
  indicatorLabel: {
    display: 'block',
    fontSize: '0.65rem',
    opacity: 0.8,
    marginBottom: '0.2rem'
  },
  indicatorValue: {
    display: 'block',
    fontSize: '0.9rem',
    fontWeight: 'bold'
  },
  alerts: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.5rem',
    marginBottom: '0.75rem'
  },
  alert: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.35rem',
    padding: '0.35rem 0.6rem',
    background: 'rgba(255, 255, 255, 0.15)',
    borderRadius: '12px',
    fontSize: '0.75rem'
  },
  footer: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '0.7rem',
    opacity: 0.7,
    paddingTop: '0.5rem',
    borderTop: '1px solid rgba(255, 255, 255, 0.2)'
  },
  updateTime: {
    fontStyle: 'italic'
  },
  source: {
    fontWeight: '500'
  }
};

// ==================== STYLES VERTICAUX ====================
const styles = {
  container: {
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: 'white',
    padding: '1.5rem',
    borderRadius: '16px',
    boxShadow: '0 8px 32px rgba(102, 126, 234, 0.3)',
    position: 'relative',
    overflow: 'hidden'
  },
  apiBadge: {
    position: 'absolute',
    top: '0.75rem',
    right: '0.75rem',
    background: 'rgba(255, 255, 255, 0.2)',
    backdropFilter: 'blur(10px)',
    padding: '0.35rem 0.75rem',
    borderRadius: '20px',
    fontSize: '0.7rem',
    fontWeight: '600',
    opacity: 0.9
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '1rem'
  },
  locationText: {
    fontSize: '0.95rem',
    opacity: 0.95,
    marginBottom: '0.25rem',
    fontWeight: '500'
  },
  nowText: {
    fontSize: '0.8rem',
    opacity: 0.7
  },
  mainIcon: {
    fontSize: '3.5rem'
  },
  tempContainer: {
    display: 'flex',
    alignItems: 'baseline',
    marginBottom: '0.5rem'
  },
  tempMain: {
    fontSize: '4rem',
    fontWeight: '700',
    lineHeight: 1
  },
  tempUnit: {
    fontSize: '1.5rem',
    marginLeft: '0.5rem',
    opacity: 0.8
  },
  description: {
    fontSize: '1.2rem',
    marginBottom: '1rem',
    textTransform: 'capitalize',
    fontWeight: '500'
  },
  alertsContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
    marginBottom: '1rem'
  },
  alert: {
    display: 'flex',
    alignItems: 'center',
    padding: '0.6rem 0.75rem',
    background: 'rgba(255, 255, 255, 0.15)',
    backdropFilter: 'blur(10px)',
    borderRadius: '10px',
    borderLeft: '4px solid',
    fontSize: '0.9rem',
    fontWeight: '500'
  },
  enrichedGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '0.75rem',
    marginBottom: '1rem'
  },
  enrichedCard: {
    background: 'rgba(255, 255, 255, 0.15)',
    backdropFilter: 'blur(10px)',
    padding: '0.75rem',
    borderRadius: '12px',
    textAlign: 'center'
  },
  enrichedLabel: {
    fontSize: '0.75rem',
    opacity: 0.85,
    marginBottom: '0.35rem',
    fontWeight: '500'
  },
  enrichedValue: {
    fontSize: '1.2rem',
    fontWeight: '700'
  },
  detailsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '0.75rem',
    marginBottom: '1rem'
  },
  detailCard: {
    background: 'rgba(255, 255, 255, 0.15)',
    backdropFilter: 'blur(10px)',
    padding: '0.75rem',
    borderRadius: '10px'
  },
  detailLabel: {
    opacity: 0.8,
    marginBottom: '0.25rem',
    fontSize: '0.85rem'
  },
  detailValue: {
    fontSize: '1.1rem',
    fontWeight: '600'
  },
  forecastButton: {
    width: '100%',
    padding: '0.85rem',
    background: 'rgba(255, 255, 255, 0.2)',
    backdropFilter: 'blur(10px)',
    border: 'none',
    borderRadius: '10px',
    color: 'white',
    fontSize: '0.95rem',
    fontWeight: '600',
    cursor: 'pointer',
    marginBottom: '1rem',
    transition: 'all 0.3s'
  },
  forecastContainer: {
    display: 'grid',
    gap: '0.75rem',
    marginBottom: '1rem',
    animation: 'slideDown 0.3s ease'
  },
  forecastDay: {
    background: 'rgba(255, 255, 255, 0.15)',
    backdropFilter: 'blur(10px)',
    padding: '0.85rem',
    borderRadius: '12px',
    display: 'grid',
    gridTemplateColumns: '80px 40px 1fr 80px',
    alignItems: 'center',
    gap: '0.75rem',
    fontSize: '0.9rem'
  },
  forecastDayName: {
    fontWeight: '600'
  },
  forecastDate: {
    fontSize: '0.75rem',
    opacity: 0.7,
    marginTop: '0.15rem'
  },
  forecastIcon: {
    fontSize: '1.8rem',
    textAlign: 'center'
  },
  forecastDesc: {
    fontSize: '0.8rem',
    opacity: 0.9,
    textTransform: 'capitalize'
  },
  forecastTemp: {
    textAlign: 'right'
  },
  tempMax: {
    fontWeight: '700',
    fontSize: '1.1rem'
  },
  tempMin: {
    opacity: 0.7,
    marginLeft: '0.35rem'
  },
  forecastRain: {
    fontSize: '0.8rem',
    opacity: 0.9,
    gridColumn: '4'
  },
  favorableBadge: {
    fontSize: '0.7rem',
    background: 'rgba(39, 174, 96, 0.3)',
    padding: '0.25rem 0.5rem',
    borderRadius: '12px',
    gridColumn: '3 / 5',
    textAlign: 'center',
    fontWeight: '600',
    marginTop: '0.25rem'
  },
  adviceCard: {
    padding: '0.85rem',
    background: 'rgba(255, 255, 255, 0.15)',
    backdropFilter: 'blur(10px)',
    borderRadius: '12px',
    borderLeft: '4px solid rgba(255, 255, 255, 0.5)'
  },
  adviceTitle: {
    fontWeight: '600',
    marginBottom: '0.4rem',
    fontSize: '0.9rem'
  },
  adviceText: {
    opacity: 0.95,
    fontSize: '0.9rem',
    lineHeight: 1.4
  },
  updateFooter: {
    marginTop: '1rem',
    paddingTop: '0.75rem',
    borderTop: '1px solid rgba(255, 255, 255, 0.2)',
    textAlign: 'center',
    fontSize: '0.75rem',
    opacity: 0.7,
    fontStyle: 'italic'
  }
};

export default WeatherWidget;