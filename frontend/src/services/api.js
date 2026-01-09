// ============================================================
// services/api.js
// Service API avec gestion automatique des tokens JWT
// ============================================================

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

// Clés de stockage
const ACCESS_TOKEN_KEY = 'truffiere_access_token';
const REFRESH_TOKEN_KEY = 'truffiere_refresh_token';
const USER_KEY = 'truffiere_user';

// ============================================================
// GESTION DES TOKENS
// ============================================================

export const getAccessToken = () => localStorage.getItem(ACCESS_TOKEN_KEY);
export const getRefreshToken = () => localStorage.getItem(REFRESH_TOKEN_KEY);
export const getStoredUser = () => {
  const user = localStorage.getItem(USER_KEY);
  return user ? JSON.parse(user) : null;
};

export const setTokens = (accessToken, refreshToken, user) => {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  if (refreshToken) {
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  }
  if (user) {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }
};

export const clearTokens = () => {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
};

// ============================================================
// RAFRAÎCHISSEMENT AUTOMATIQUE DU TOKEN
// ============================================================

let isRefreshing = false;
let refreshSubscribers = [];

const subscribeTokenRefresh = (callback) => {
  refreshSubscribers.push(callback);
};

const onTokenRefreshed = (newToken) => {
  refreshSubscribers.forEach(callback => callback(newToken));
  refreshSubscribers = [];
};

const refreshAccessToken = async () => {
  const refreshToken = getRefreshToken();
  
  if (!refreshToken) {
    throw new Error('No refresh token');
  }

  const response = await fetch(`${API_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken })
  });

  if (!response.ok) {
    clearTokens();
    throw new Error('Refresh failed');
  }

  const data = await response.json();
  setTokens(data.accessToken, null, null);
  return data.accessToken;
};

// ============================================================
// FONCTION FETCH AVEC AUTH
// ============================================================

export const apiFetch = async (endpoint, options = {}) => {
  const url = endpoint.startsWith('http') ? endpoint : `${API_URL}${endpoint}`;
  
  // Ajouter le token d'accès
  const accessToken = getAccessToken();
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  };
  
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  let response = await fetch(url, { ...options, headers });

  // Si token expiré, tenter un refresh
  if (response.status === 401) {
    const errorData = await response.json().catch(() => ({}));
    
    if (errorData.code === 'TOKEN_EXPIRED' && getRefreshToken()) {
      // Éviter les refreshs multiples simultanés
      if (!isRefreshing) {
        isRefreshing = true;
        
        try {
          const newToken = await refreshAccessToken();
          isRefreshing = false;
          onTokenRefreshed(newToken);
          
          // Réessayer la requête avec le nouveau token
          headers['Authorization'] = `Bearer ${newToken}`;
          response = await fetch(url, { ...options, headers });
        } catch (err) {
          isRefreshing = false;
          clearTokens();
          window.location.href = '/'; // Rediriger vers login
          throw err;
        }
      } else {
        // Attendre que le refresh soit terminé
        return new Promise((resolve, reject) => {
          subscribeTokenRefresh(async (newToken) => {
            headers['Authorization'] = `Bearer ${newToken}`;
            try {
              const retryResponse = await fetch(url, { ...options, headers });
              resolve(retryResponse);
            } catch (err) {
              reject(err);
            }
          });
        });
      }
    } else {
      // Pas de refresh token ou autre erreur 401
      clearTokens();
      window.location.href = '/';
      throw new Error('Authentication required');
    }
  }

  return response;
};

// ============================================================
// HELPERS API
// ============================================================

export const api = {
  get: async (endpoint) => {
    const response = await apiFetch(endpoint);
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Erreur réseau' }));
      throw new Error(error.error || 'Erreur lors de la requête');
    }
    return response.json();
  },

  post: async (endpoint, data) => {
    const response = await apiFetch(endpoint, {
      method: 'POST',
      body: JSON.stringify(data)
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Erreur réseau' }));
      throw new Error(error.error || 'Erreur lors de la requête');
    }
    return response.json();
  },

  put: async (endpoint, data) => {
    const response = await apiFetch(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Erreur réseau' }));
      throw new Error(error.error || 'Erreur lors de la requête');
    }
    return response.json();
  },

  delete: async (endpoint) => {
    const response = await apiFetch(endpoint, { method: 'DELETE' });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Erreur réseau' }));
      throw new Error(error.error || 'Erreur lors de la requête');
    }
    return response.json();
  }
};

// ============================================================
// FONCTIONS D'AUTHENTIFICATION
// ============================================================

export const authApi = {
  login: async (email, password) => {
    const response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Erreur de connexion');
    }

    setTokens(data.accessToken, data.refreshToken, data.user);
    return data;
  },

  logout: async () => {
    const refreshToken = getRefreshToken();
    
    try {
      await apiFetch('/auth/logout', {
        method: 'POST',
        body: JSON.stringify({ refreshToken })
      });
    } catch (err) {
      console.error('Erreur logout:', err);
    } finally {
      clearTokens();
    }
  },

  logoutAll: async () => {
    try {
      await apiFetch('/auth/logout-all', { method: 'POST' });
    } catch (err) {
      console.error('Erreur logout-all:', err);
    } finally {
      clearTokens();
    }
  },

  getMe: async () => {
    return api.get('/auth/me');
  },

  changePassword: async (currentPassword, newPassword) => {
    return api.post('/auth/change-password', { currentPassword, newPassword });
  },

  // Admin uniquement
  getUsers: async () => {
    return api.get('/auth/users');
  },

  createUser: async (userData) => {
    return api.post('/auth/register', userData);
  },

  updateUser: async (id, userData) => {
    return api.put(`/auth/users/${id}`, userData);
  },

  deleteUser: async (id) => {
    return api.delete(`/auth/users/${id}`);
  },

  resetUserPassword: async (id, newPassword) => {
    return api.post(`/auth/users/${id}/reset-password`, { newPassword });
  },

  unlockUser: async (id) => {
    return api.post(`/auth/users/${id}/unlock`, {});
  }
};

export default api;
