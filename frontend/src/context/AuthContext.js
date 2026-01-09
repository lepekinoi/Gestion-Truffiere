// ============================================================
// context/AuthContext.js
// Contexte React pour la gestion de l'authentification
// ============================================================

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authApi, getStoredUser, getAccessToken, clearTokens } from '../services/api';

// Créer le contexte
const AuthContext = createContext(null);

// Hook personnalisé pour utiliser le contexte
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth doit être utilisé dans un AuthProvider');
  }
  return context;
};

// Provider du contexte
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Vérifier l'authentification au chargement
  useEffect(() => {
    const checkAuth = async () => {
      const token = getAccessToken();
      const storedUser = getStoredUser();

      if (token && storedUser) {
        try {
          // Vérifier que le token est encore valide
          const freshUser = await authApi.getMe();
          setUser(freshUser);
        } catch (err) {
          console.error('Token invalide:', err);
          clearTokens();
          setUser(null);
        }
      }
      
      setLoading(false);
    };

    checkAuth();
  }, []);

  // Connexion
  const login = useCallback(async (email, password) => {
    setError(null);
    setLoading(true);

    try {
      const data = await authApi.login(email, password);
      setUser(data.user);
      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Déconnexion
  const logout = useCallback(async () => {
    setLoading(true);
    
    try {
      await authApi.logout();
    } catch (err) {
      console.error('Erreur logout:', err);
    } finally {
      setUser(null);
      setLoading(false);
    }
  }, []);

  // Déconnexion de tous les appareils
  const logoutAll = useCallback(async () => {
    setLoading(true);
    
    try {
      await authApi.logoutAll();
    } catch (err) {
      console.error('Erreur logout-all:', err);
    } finally {
      setUser(null);
      setLoading(false);
    }
  }, []);

  // Rafraîchir les infos utilisateur
  const refreshUser = useCallback(async () => {
    try {
      const freshUser = await authApi.getMe();
      setUser(freshUser);
      return freshUser;
    } catch (err) {
      console.error('Erreur refresh user:', err);
      throw err;
    }
  }, []);

  // Changer le mot de passe
  const changePassword = useCallback(async (currentPassword, newPassword) => {
    try {
      await authApi.changePassword(currentPassword, newPassword);
      // Après changement de mot de passe, déconnecter
      await logout();
    } catch (err) {
      throw err;
    }
  }, [logout]);

  // Vérifier si l'utilisateur a un rôle spécifique
  const hasRole = useCallback((roles) => {
    if (!user) return false;
    if (typeof roles === 'string') {
      return user.role === roles;
    }
    return roles.includes(user.role);
  }, [user]);

  // Vérifier si l'utilisateur peut écrire (pas readonly)
  const canWrite = useCallback(() => {
    return user && user.role !== 'readonly';
  }, [user]);

  // Vérifier si admin
  const isAdmin = useCallback(() => {
    return user && user.role === 'admin';
  }, [user]);

  // Valeur du contexte
  const value = {
    user,
    loading,
    error,
    isAuthenticated: !!user,
    login,
    logout,
    logoutAll,
    refreshUser,
    changePassword,
    hasRole,
    canWrite,
    isAdmin
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
