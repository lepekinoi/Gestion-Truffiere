// ============================================================
// services/axiosConfig.js
// Configuration globale d'Axios avec gestion automatique des tokens
// VERSION AVEC ROTATION AUTOMATIQUE DES REFRESH TOKENS
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
// AVEC ROTATION AUTOMATIQUE DES REFRESH TOKENS
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
      
      // ⚠️ GESTION DES ERREURS DE SÉCURITÉ (ROTATION)
      if (error.response?.data?.code === 'SECURITY_BREACH' || 
          error.response?.data?.code === 'TOKEN_REUSE_DETECTED') {
        console.error('🚨 ALERTE SÉCURITÉ: Réutilisation de token détectée!');
        alert(
          'Sécurité : Une activité suspecte a été détectée sur votre compte. ' +
          'Vous allez être déconnecté. Veuillez vous reconnecter.'
        );
        clearAndRedirect();
        return Promise.reject(error);
      }
      
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
          console.warn('⚠️ Aucun refresh token disponible');
          clearAndRedirect();
          return Promise.reject(error);
        }

        try {
          console.log('🔄 Rafraîchissement du token...');
          
          const response = await axios.post(`${API_URL}/auth/refresh`, {
            refreshToken
          }, {
            _retry: true // Éviter la boucle infinie
          });

          // ✅ CRITIQUE: Récupérer le NOUVEAU refresh token
          const { accessToken, refreshToken: newRefreshToken } = response.data;
          
          if (!newRefreshToken) {
            console.error('❌ Erreur: L\'API n\'a pas retourné de nouveau refresh token');
            console.warn('⚠️ Vérifiez que le backend implémente la rotation des tokens');
            // On continue quand même avec l'ancien comportement
          }
          
          // 🔐 Sauvegarder le nouveau access token
          localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
          
          // 🔄 ROTATION: Sauvegarder le NOUVEAU refresh token
          if (newRefreshToken) {
            localStorage.setItem(REFRESH_TOKEN_KEY, newRefreshToken);
            console.log('✅ Nouveau refresh token sauvegardé');
          }
          
          // Mettre à jour le header par défaut
          axios.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
          
          // Traiter la queue des requêtes en attente
          processQueue(null, accessToken);
          
          // Relancer la requête originale
          originalRequest.headers['Authorization'] = `Bearer ${accessToken}`;
          return axios(originalRequest);

        } catch (refreshError) {
          console.error('❌ Erreur lors du refresh:', refreshError.response?.data || refreshError.message);
          
          // Vérifier si c'est une erreur de sécurité
          if (refreshError.response?.data?.code === 'SECURITY_BREACH' ||
              refreshError.response?.data?.code === 'TOKEN_REUSE_DETECTED') {
            alert(
              'Sécurité : Une activité suspecte a été détectée. ' +
              'Vous allez être déconnecté.'
            );
          }
          
          processQueue(refreshError, null);
          clearAndRedirect();
          return Promise.reject(refreshError);
        } finally {
          isRefreshing = false;
        }
      }

      // ⚠️ GESTION DES ERREURS DE LIMITE DE ROTATION
      if (error.response?.data?.code === 'MAX_ROTATION_EXCEEDED') {
        console.warn('⚠️ Limite de rotation atteinte');
        alert('Trop de rafraîchissements de session. Veuillez vous reconnecter.');
        clearAndRedirect();
        return Promise.reject(error);
      }

      // Autre erreur 401 (token invalide, pas de token, etc.)
      if (error.response?.data?.code !== 'INVALID_CREDENTIALS') {
        console.warn('⚠️ Erreur d\'authentification:', error.response?.data?.code);
        clearAndRedirect();
      }
    }

    return Promise.reject(error);
  }
);

// Fonction pour nettoyer et rediriger
function clearAndRedirect() {
  console.log('🚪 Déconnexion et nettoyage des tokens');
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
