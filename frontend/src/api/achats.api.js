// ============================================================================
// Frontend - Service API pour les Achats
// Communication avec le backend
// ============================================================================

import axios from 'axios';

const API = axios.create({
  baseURL: process.env.VUE_APP_API_URL || 'http://localhost:3000/api/v1'
});

// Ajouter le token d'authentification à chaque requête
API.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default {
  // ============================================================================
  // FOURNISSEURS TRUFFES
  // ============================================================================

  getFournisseurs(params = {}) {
    return API.get('/fournisseurs-truffes', { params })
      .then(res => res.data);
  },

  getFournisseur(id) {
    return API.get(`/fournisseurs-truffes/${id}`)
      .then(res => res.data);
  },

  createFournisseur(data) {
    return API.post('/fournisseurs-truffes', data)
      .then(res => res.data);
  },

  updateFournisseur(id, data) {
    return API.put(`/fournisseurs-truffes/${id}`, data)
      .then(res => res.data);
  },

  deleteFournisseur(id) {
    return API.delete(`/fournisseurs-truffes/${id}`)
      .then(res => res.data);
  },

  getContactsFournisseur(id) {
    return API.get(`/fournisseurs-truffes/${id}/contacts`)
      .then(res => res.data);
  },

  addContact(fournisseurId, data) {
    return API.post(`/fournisseurs-truffes/${fournisseurId}/contacts`, data)
      .then(res => res.data);
  },

  getPerformanceFournisseurs() {
    return API.get('/analytics/fournisseurs-performance')
      .then(res => res.data);
  },

  // ============================================================================
  // COMMANDES D'ACHAT
  // ============================================================================

  getCommandes(params = {}) {
    return API.get('/commandes-achat', { params })
      .then(res => res.data);
  },

  getCommande(id) {
    return API.get(`/commandes-achat/${id}`)
      .then(res => res.data);
  },

  createCommande(data) {
    return API.post('/commandes-achat', data)
      .then(res => res.data);
  },

  updateCommande(id, data) {
    return API.put(`/commandes-achat/${id}`, data)
      .then(res => res.data);
  },

  confirmerCommande(id) {
    return API.put(`/commandes-achat/${id}/confirmer`)
      .then(res => res.data);
  },

  receptionnerCommande(id, data) {
    return API.post(`/commandes-achat/${id}/receptionner`, data)
      .then(res => res.data);
  },

  // ============================================================================
  // STOCK DE TRUFFES ACHETÉES
  // ============================================================================

  getStock(params = {}) {
    return API.get('/stock-truffes-achetees', { params })
      .then(res => res.data);
  },

  getStockDisponible(params = {}) {
    return API.get('/stock-disponible', { params })
      .then(res => res.data);
  },

  getStockAlerte() {
    return API.get('/stock-alerte-limite')
      .then(res => res.data);
  },

  updateStock(id, data) {
    return API.put(`/stock-truffes-achetees/${id}`, data)
      .then(res => res.data);
  },

  // ============================================================================
  // ANALYTIQUE - MARGES
  // ============================================================================

  getMargeGlobale(params = {}) {
    return API.get('/analytics/marge-globale', { params })
      .then(res => res.data);
  },

  getMargeParCalibre() {
    return API.get('/analytics/marge-par-calibre')
      .then(res => res.data);
  },

  getFournisseurRentabilite() {
    return API.get('/analytics/fournisseurs-rentabilite')
      .then(res => res.data);
  },

  getCommandesEnRetard() {
    return API.get('/analytics/commandes-en-retard')
      .then(res => res.data);
  },

  getStatsDashboard() {
    return API.get('/analytics/stats-dashboard')
      .then(res => res.data);
  }
};