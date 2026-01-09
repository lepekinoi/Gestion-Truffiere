import React, { useState, useEffect } from 'react';

function WeatherWidget({ location = "Saint-Philbert-de-Bouaine,FR" }) {
  const [weather, setWeather] = useState(null);
  const [forecast, setForecast] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForecast, setShowForecast] = useState(false);

  useEffect(() => {
    loadWeather();
    // Rafraîchir toutes les 30 minutes
    const interval = setInterval(loadWeather, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, [location]);

  const loadWeather = async () => {
    try {
      // Utiliser l'API OpenWeatherMap gratuite
      const API_KEY = 'bfa869b97ace2b1f8fd373765e64ed64'; // À remplacer
      
      // Si pas de clé API, utiliser des données de démonstration
      if (API_KEY === 'VOTRE_CLE_API_ICI') {
        setTimeout(() => {
          setWeather({
            temp: 12,
            feels_like: 10,
            humidity: 75,
            description: 'Nuageux',
            icon: '03d',
            wind_speed: 15,
            clouds: 60,
            pressure: 1013,
            sunrise: new Date().setHours(7, 30, 0),
            sunset: new Date().setHours(18, 45, 0)
          });
          
          // Prévisions simulées
          const today = new Date();
          setForecast([
            {
              date: new Date(today.getTime() + 24*60*60*1000),
              temp_min: 8,
              temp_max: 14,
              description: 'Partiellement nuageux',
              icon: '02d',
              humidity: 70,
              wind_speed: 12,
              pop: 20 // Probabilité de précipitation
            },
            {
              date: new Date(today.getTime() + 2*24*60*60*1000),
              temp_min: 10,
              temp_max: 16,
              description: 'Ensoleillé',
              icon: '01d',
              humidity: 65,
              wind_speed: 10,
              pop: 5
            },
            {
              date: new Date(today.getTime() + 3*24*60*60*1000),
              temp_min: 9,
              temp_max: 15,
              description: 'Pluie légère',
              icon: '10d',
              humidity: 85,
              wind_speed: 18,
              pop: 70
            },
            {
              date: new Date(today.getTime() + 4*24*60*60*1000),
              temp_min: 11,
              temp_max: 17,
              description: 'Nuageux',
              icon: '03d',
              humidity: 72,
              wind_speed: 14,
              pop: 30
            },
            {
              date: new Date(today.getTime() + 5*24*60*60*1000),
              temp_min: 12,
              temp_max: 18,
              description: 'Partiellement ensoleillé',
              icon: '02d',
              humidity: 68,
              wind_speed: 11,
              pop: 15
            }
          ]);
          setLoading(false);
        }, 500);
        return;
      }

      // Météo actuelle
      const weatherRes = await fetch(
        `https://api.openweathermap.org/data/2.5/weather?q=${location}&appid=${API_KEY}&units=metric&lang=fr`
      );

      if (!weatherRes.ok) {
        throw new Error('Erreur lors de la récupération de la météo');
      }

      const weatherData = await weatherRes.json();
      
      setWeather({
        temp: Math.round(weatherData.main.temp),
        feels_like: Math.round(weatherData.main.feels_like),
        humidity: weatherData.main.humidity,
        description: weatherData.weather[0].description,
        icon: weatherData.weather[0].icon,
        wind_speed: Math.round(weatherData.wind.speed * 3.6),
        clouds: weatherData.clouds.all,
        pressure: weatherData.main.pressure,
        sunrise: weatherData.sys.sunrise * 1000,
        sunset: weatherData.sys.sunset * 1000
      });

      // Prévisions 5 jours
      const forecastRes = await fetch(
        `https://api.openweathermap.org/data/2.5/forecast?q=${location}&appid=${API_KEY}&units=metric&lang=fr`
      );

      if (forecastRes.ok) {
        const forecastData = await forecastRes.json();
        
        // Regrouper par jour (prendre midi de chaque jour)
        const dailyForecast = [];
        const processedDays = new Set();
        
        forecastData.list.forEach(item => {
          const date = new Date(item.dt * 1000);
          const dayKey = date.toDateString();
          const hour = date.getHours();
          
          // Prendre la prévision de midi (12h) ou la plus proche
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
              pop: Math.round(item.pop * 100)
            });
          }
        });

        setForecast(dailyForecast.slice(0, 5));
      }

      setLoading(false);
    } catch (err) {
      console.error('Erreur météo:', err);
      setError(err.message);
      setLoading(false);
    }
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

  const getWindDirection = (speed) => {
    if (speed < 10) return 'Légère';
    if (speed < 25) return 'Modérée';
    if (speed < 40) return 'Forte';
    return 'Très forte';
  };

  const getTemperatureColor = (temp) => {
    if (temp < 0) return '#3498db';
    if (temp < 10) return '#5dade2';
    if (temp < 20) return '#f39c12';
    if (temp < 30) return '#e67e22';
    return '#e74c3c';
  };

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString('fr-FR', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const getDayName = (date) => {
    const today = new Date();
    const tomorrow = new Date(today.getTime() + 24*60*60*1000);
    
    if (date.toDateString() === today.toDateString()) return "Aujourd'hui";
    if (date.toDateString() === tomorrow.toDateString()) return "Demain";
    
    return date.toLocaleDateString('fr-FR', { weekday: 'short' });
  };

  if (loading) {
    return (
      <div style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        padding: '1.5rem',
        borderRadius: '12px',
        boxShadow: '0 4px 15px rgba(0,0,0,0.1)'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🌤️</div>
          <div>Chargement de la météo...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        padding: '1.5rem',
        borderRadius: '12px',
        boxShadow: '0 4px 15px rgba(0,0,0,0.1)'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>⚠️</div>
          <div style={{ fontSize: '0.9rem' }}>Météo indisponible</div>
          <div style={{ fontSize: '0.8rem', opacity: 0.8, marginTop: '0.5rem' }}>
            (Mode démo activé)
          </div>
        </div>
      </div>
    );
  }

  if (!weather) return null;

  return (
    <div style={{
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      color: 'white',
      padding: '1.5rem',
      borderRadius: '12px',
      boxShadow: '0 4px 15px rgba(0,0,0,0.1)',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* En-tête */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'flex-start',
        marginBottom: '1rem'
      }}>
        <div>
          <div style={{ fontSize: '0.9rem', opacity: 0.9, marginBottom: '0.25rem' }}>
            🌍 {location.split(',')[0]}
          </div>
          <div style={{ fontSize: '0.85rem', opacity: 0.7 }}>
            Maintenant
          </div>
        </div>
        <div style={{ fontSize: '3rem' }}>
          {getWeatherIcon(weather.icon)}
        </div>
      </div>

      {/* Température principale */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'baseline',
        marginBottom: '0.5rem'
      }}>
        <div style={{ 
          fontSize: '3.5rem', 
          fontWeight: 'bold',
          color: getTemperatureColor(weather.temp)
        }}>
          {weather.temp}°
        </div>
        <div style={{ 
          fontSize: '1.2rem', 
          marginLeft: '0.5rem',
          opacity: 0.8 
        }}>
          C
        </div>
      </div>

      {/* Description */}
      <div style={{ 
        fontSize: '1.1rem', 
        marginBottom: '1rem',
        textTransform: 'capitalize'
      }}>
        {weather.description}
      </div>

      {/* Détails */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: '0.75rem',
        fontSize: '0.9rem',
        marginBottom: '1rem'
      }}>
        <div style={{
          background: 'rgba(255, 255, 255, 0.15)',
          padding: '0.75rem',
          borderRadius: '8px',
          backdropFilter: 'blur(10px)'
        }}>
          <div style={{ opacity: 0.8, marginBottom: '0.25rem' }}>🌡️ Ressenti</div>
          <div style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>
            {weather.feels_like}°C
          </div>
        </div>

        <div style={{
          background: 'rgba(255, 255, 255, 0.15)',
          padding: '0.75rem',
          borderRadius: '8px',
          backdropFilter: 'blur(10px)'
        }}>
          <div style={{ opacity: 0.8, marginBottom: '0.25rem' }}>💧 Humidité</div>
          <div style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>
            {weather.humidity}%
          </div>
        </div>

        <div style={{
          background: 'rgba(255, 255, 255, 0.15)',
          padding: '0.75rem',
          borderRadius: '8px',
          backdropFilter: 'blur(10px)'
        }}>
          <div style={{ opacity: 0.8, marginBottom: '0.25rem' }}>💨 Vent</div>
          <div style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>
            {weather.wind_speed} km/h
          </div>
          <div style={{ fontSize: '0.75rem', opacity: 0.7 }}>
            {getWindDirection(weather.wind_speed)}
          </div>
        </div>

        <div style={{
          background: 'rgba(255, 255, 255, 0.15)',
          padding: '0.75rem',
          borderRadius: '8px',
          backdropFilter: 'blur(10px)'
        }}>
          <div style={{ opacity: 0.8, marginBottom: '0.25rem' }}>☁️ Nuages</div>
          <div style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>
            {weather.clouds}%
          </div>
        </div>
      </div>

      {/* Lever/Coucher du soleil */}
      {weather.sunrise && weather.sunset && (
        <div style={{
          display: 'flex',
          justifyContent: 'space-around',
          padding: '0.75rem',
          background: 'rgba(255, 255, 255, 0.1)',
          borderRadius: '8px',
          fontSize: '0.85rem',
          marginBottom: '1rem'
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ marginBottom: '0.25rem' }}>🌅 Lever</div>
            <div style={{ fontWeight: 'bold' }}>{formatTime(weather.sunrise)}</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ marginBottom: '0.25rem' }}>🌇 Coucher</div>
            <div style={{ fontWeight: 'bold' }}>{formatTime(weather.sunset)}</div>
          </div>
        </div>
      )}

      {/* Bouton pour afficher les prévisions */}
      <button
        onClick={() => setShowForecast(!showForecast)}
        style={{
          width: '100%',
          padding: '0.75rem',
          background: 'rgba(255, 255, 255, 0.2)',
          border: 'none',
          borderRadius: '8px',
          color: 'white',
          fontSize: '0.9rem',
          fontWeight: 'bold',
          cursor: 'pointer',
          marginBottom: '1rem',
          transition: 'all 0.3s',
          backdropFilter: 'blur(10px)'
        }}
        onMouseEnter={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.3)'}
        onMouseLeave={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.2)'}
      >
        {showForecast ? '▲ Masquer' : '▼ Prévisions 5 jours'}
      </button>

      {/* Prévisions 5 jours */}
      {showForecast && forecast.length > 0 && (
        <div style={{
          marginBottom: '1rem',
          animation: 'slideDown 0.3s ease'
        }}>
          <div style={{ 
            fontSize: '0.9rem', 
            fontWeight: 'bold', 
            marginBottom: '0.75rem',
            opacity: 0.9
          }}>
            📅 Prévisions
          </div>
          <div style={{
            display: 'grid',
            gap: '0.5rem'
          }}>
            {forecast.map((day, idx) => (
              <div
                key={idx}
                style={{
                  background: 'rgba(255, 255, 255, 0.15)',
                  padding: '0.75rem',
                  borderRadius: '8px',
                  backdropFilter: 'blur(10px)',
                  display: 'grid',
                  gridTemplateColumns: '80px 40px 1fr 80px 60px',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontSize: '0.85rem'
                }}
              >
                <div style={{ fontWeight: 'bold' }}>
                  {getDayName(day.date)}
                  <div style={{ fontSize: '0.75rem', opacity: 0.7 }}>
                    {day.date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                  </div>
                </div>
                
                <div style={{ fontSize: '1.5rem', textAlign: 'center' }}>
                  {getWeatherIcon(day.icon)}
                </div>
                
                <div style={{ 
                  fontSize: '0.75rem', 
                  opacity: 0.9,
                  textTransform: 'capitalize'
                }}>
                  {day.description}
                </div>
                
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontWeight: 'bold', fontSize: '1rem' }}>
                    {day.temp_max}°
                  </span>
                  <span style={{ opacity: 0.7, marginLeft: '0.25rem' }}>
                    {day.temp_min}°
                  </span>
                </div>
                
                <div style={{ 
                  textAlign: 'right',
                  fontSize: '0.8rem',
                  opacity: day.pop > 50 ? 1 : 0.6
                }}>
                  {day.pop > 0 && (
                    <>
                      💧 {day.pop}%
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Conseils pour la trufficulture */}
      <div style={{
        padding: '0.75rem',
        background: 'rgba(255, 255, 255, 0.1)',
        borderRadius: '8px',
        fontSize: '0.85rem',
        borderLeft: '3px solid rgba(255, 255, 255, 0.5)'
      }}>
        <div style={{ fontWeight: 'bold', marginBottom: '0.25rem' }}>
          💡 Conseil trufficulture
        </div>
        <div style={{ opacity: 0.9 }}>
          {weather.humidity > 70 && weather.temp > 5 && weather.temp < 25 
            ? "Conditions favorables pour le cavage ! 🍄"
            : weather.temp < 5
            ? "Température basse, surveillez le gel ❄️"
            : weather.humidity < 40
            ? "Air sec, pensez à l'irrigation 💧"
            : "Conditions normales pour vos truffières 🌳"
          }
        </div>
      </div>

      {/* Badge mode démo */}
      {weather.temp === 12 && (
        <div style={{
          position: 'absolute',
          top: '0.5rem',
          right: '0.5rem',
          background: 'rgba(255, 255, 255, 0.2)',
          padding: '0.25rem 0.5rem',
          borderRadius: '4px',
          fontSize: '0.7rem',
          opacity: 0.7
        }}>
          Mode démo
        </div>
      )}

      <style>{`
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}

export default WeatherWidget;