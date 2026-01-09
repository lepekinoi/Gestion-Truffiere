// ============================================================
// services/axiosConfig.js
// Configuration globale d'Axios avec gestion automatique des tokens
// ============================================================

import axios from 'axios';

// Clés de stockage (mêmes que dans api.js)
const ACCESS_TOKEN_KEY = 'truffiere_access_token';
const REFRESH_TOKEN_KEY = 'truffiere_refresh_token';

// URL de l'API
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

// Variable pour éviter les refresh multiples
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// ============================================================
// INTERCEPTEUR DE REQUÊTE
// Ajoute automatiquement le token à chaque requête
// ============================================================

axios.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem(ACCESS_TOKEN_KEY);
    
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// ============================================================
// INTERCEPTEUR DE RÉPONSE
// Gère le refresh automatique du token si expiré
// ============================================================

axios.interceptors.response.use(
  (response) => {
    // Réponse OK, on la retourne telle quelle
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    // Si erreur 401 et pas déjà en train de retry
    if (error.response?.status === 401 && !originalRequest._retry) {
      
      // Si c'est une erreur de token expiré
      if (error.response?.data?.code === 'TOKEN_EXPIRED') {
        
        if (isRefreshing) {
          // Attendre que le refresh soit terminé
          return new Promise((resolve, reject) => {
            failedQueue.push({ resolve, reject });
          })
            .then(token => {
              originalRequest.headers['Authorization'] = `Bearer ${token}`;
              return axios(originalRequest);
            })
            .catch(err => Promise.reject(err));
        }

        originalRequest._retry = true;
        isRefreshing = true;

        const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);

        if (!refreshToken) {
          // Pas de refresh token, déconnecter
          clearAndRedirect();
          return Promise.reject(error);
        }

        try {
          const response = await axios.post(`${API_URL}/auth/refresh`, {
            refreshToken
          }, {
            _retry: true // Éviter la boucle infinie
          });

          const { accessToken } = response.data;
          
          // Sauvegarder le nouveau token
          localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
          
          // Mettre à jour le header par défaut
          axios.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
          
          // Traiter la queue des requêtes en attente
          processQueue(null, accessToken);
          
          // Relancer la requête originale
          originalRequest.headers['Authorization'] = `Bearer ${accessToken}`;
          return axios(originalRequest);

        } catch (refreshError) {
          processQueue(refreshError, null);
          clearAndRedirect();
          return Promise.reject(refreshError);
        } finally {
          isRefreshing = false;
        }
      }

      // Autre erreur 401 (token invalide, pas de token, etc.)
      if (error.response?.data?.code !== 'INVALID_CREDENTIALS') {
        clearAndRedirect();
      }
    }

    return Promise.reject(error);
  }
);

// Fonction pour nettoyer et rediriger
function clearAndRedirect() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem('truffiere_user');
  
  // Rediriger vers la page de login (recharge la page)
  if (window.location.pathname !== '/') {
    window.location.href = '/';
  }
}

// Exporter axios configuré
export default axios;
