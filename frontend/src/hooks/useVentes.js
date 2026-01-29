// ============================================================
// useVentes.js - Hook personnalisé pour la gestion des ventes
// Version: 1.0 - Phase 3 Migration FINALE
// Date: 29 janvier 2026
// ============================================================

import { useState, useCallback } from 'react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

/**
 * Hook personnalisé pour gérer toute la logique métier des ventes
 * 
 * @param {Function} showMessage - Fonction pour afficher les messages de notification
 * @param {Function} loadData - Fonction pour recharger toutes les données
 * @param {Function} setConfirmModal - Fonction pour afficher un modal de confirmation
 * @param {Function} setIsProcessing - Fonction pour indiquer un traitement en cours
 * @param {Array} ventes - Liste des ventes
 * 
 * @returns {Object} États et fonctions de gestion des ventes
 */
export const useVentes = ({ 
  showMessage, 
  loadData, 
  setConfirmModal, 
  setIsProcessing,
  ventes = []
}) => {
  // ==================== ÉTATS ====================
  
  const [showVenteModal, setShowVenteModal] = useState(false);
  const [editingVente, setEditingVente] = useState(null);
  const [filterStatutVente, setFilterStatutVente] = useState('all');
  const [filterTypeVente, setFilterTypeVente] = useState('all');
  
  // État formulaire vente
  const [venteFormData, setVenteFormData] = useState({
    client_id: '',
    recolte_id: '',
    date_vente: new Date().toISOString().split('T')[0],
    quantite_grammes: '',
    prix_unitaire_kg: '',
    mode_paiement: '',
    statut: 'En attente',
    numero_facture: '',
    notes: ''
  });
  
  // Pagination
  const [currentPageVentes, setCurrentPageVentes] = useState(1);
  const [itemsPerPageVentes, setItemsPerPageVentes] = useState(20);
  
  // Tri
  const [sortConfigVentes, setSortConfigVentes] = useState({ 
    key: 'date_vente', 
    direction: 'desc' 
  });
  
  // ==================== FONCTIONS ====================
  
  /**
   * Gère les changements dans le formulaire vente
   */
  const handleVenteInputChange = useCallback((e) => {
    const { name, value } = e.target;
    setVenteFormData(prev => ({ ...prev, [name]: value }));
  }, []);
  
  /**
   * Soumet le formulaire vente (création ou modification)
   */
  const handleVenteSubmit = useCallback(async (e) => {
    e.preventDefault();
    setIsProcessing(true);
    
    try {
      const dataToSend = { ...venteFormData };
      
      // Nettoyer les données
      if (!dataToSend.recolte_id) {
        dataToSend.recolte_id = null;
      }
      
      if (editingVente) {
        // Mise à jour
        await axios.put(`${API_URL}/ventes/${editingVente.id}`, dataToSend);
        showMessage('Vente mise à jour avec succès !', 'success');
      } else {
        // Création
        await axios.post(`${API_URL}/ventes`, dataToSend);
        showMessage('Vente enregistrée avec succès !', 'success');
      }
      
      await loadData();
      closeVenteModal();
    } catch (error) {
      console.error('Erreur lors de la sauvegarde de la vente:', error);
      showMessage('Erreur lors de la sauvegarde', 'error');
    } finally {
      setIsProcessing(false);
    }
  }, [venteFormData, editingVente, showMessage, loadData, setIsProcessing]);
  
  /**
   * Ouvre le modal d'édition d'une vente
   */
  const handleEditVente = useCallback((vente) => {
    setEditingVente(vente);
    setVenteFormData({
      client_id: vente.client_id || '',
      recolte_id: vente.recolte_id || '',
      date_vente: vente.date_vente ? vente.date_vente.split('T')[0] : '',
      quantite_grammes: vente.quantite_grammes || '',
      prix_unitaire_kg: vente.prix_unitaire_kg || '',
      mode_paiement: vente.mode_paiement || '',
      statut: vente.statut || 'En attente',
      numero_facture: vente.numero_facture || '',
      notes: vente.notes || ''
    });
    setShowVenteModal(true);
  }, []);
  
  /**
   * Demande confirmation avant suppression
   */
  const askDeleteVente = useCallback((vente) => {
    setConfirmModal({
      type: 'delete-vente',
      item: vente,
      title: 'Supprimer la vente',
      message: `Êtes-vous sûr de vouloir supprimer la vente ${vente.numero_facture || vente.id} ?`,
      confirmText: 'Oui, supprimer',
      confirmColor: '#f44336'
    });
  }, [setConfirmModal]);
  
  /**
   * Supprime une vente
   */
  const doDeleteVente = useCallback(async (vente) => {
    setIsProcessing(true);
    setConfirmModal(null);
    
    try {
      await axios.delete(`${API_URL}/ventes/${vente.id}`);
      showMessage('Vente supprimée avec succès !', 'success');
      await loadData();
    } catch (error) {
      console.error('Erreur lors de la suppression de la vente:', error);
      showMessage('Erreur lors de la suppression', 'error');
    } finally {
      setIsProcessing(false);
    }
  }, [showMessage, loadData, setConfirmModal, setIsProcessing]);
  
  /**
   * Ouvre le modal de création d'une nouvelle vente
   */
  const openNewVenteModal = useCallback(() => {
    setEditingVente(null);
    const today = new Date().toISOString().split('T')[0];
    setVenteFormData({
      client_id: '',
      recolte_id: '',
      date_vente: today,
      quantite_grammes: '',
      prix_unitaire_kg: '',
      mode_paiement: '',
      statut: 'En attente',
      numero_facture: generateNumeroFacture(),
      notes: ''
    });
    setShowVenteModal(true);
  }, [ventes]);
  
  /**
   * Ferme le modal vente
   */
  const closeVenteModal = useCallback(() => {
    setShowVenteModal(false);
    setEditingVente(null);
  }, []);
  
  /**
   * Génère un numéro de facture unique
   */
  const generateNumeroFacture = useCallback(() => {
    const year = new Date().getFullYear();
    const existingNumbers = ventes
      .filter(v => v.numero_facture && v.numero_facture.startsWith(`FACT-${year}`))
      .map(v => {
        const match = v.numero_facture.match(/FACT-(\d{4})-(\d+)/);
        return match ? parseInt(match[2]) : 0;
      });
    const nextNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 1;
    return `FACT-${year}-${String(nextNumber).padStart(3, '0')}`;
  }, [ventes]);
  
  /**
   * Calcule le montant total de la vente en cours
   */
  const montantCalculeVente = useCallback(() => {
    const poids = parseFloat(venteFormData.quantite_grammes || 0);
    const prixKg = parseFloat(venteFormData.prix_unitaire_kg || 0);
    return ((poids / 1000) * prixKg).toFixed(2);
  }, [venteFormData]);
  
  /**
   * Gère le tri des ventes
   */
  const handleSortVentes = useCallback((key) => {
    setSortConfigVentes(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  }, []);
  
  /**
   * Réinitialise les filtres ventes
   */
  const resetFilters = useCallback(() => {
    setFilterStatutVente('all');
    setFilterTypeVente('all');
    setCurrentPageVentes(1);
  }, []);
  
  // ==================== RETURN ====================
  
  return {
    // États
    showVenteModal,
    editingVente,
    filterStatutVente,
    filterTypeVente,
    venteFormData,
    currentPageVentes,
    itemsPerPageVentes,
    sortConfigVentes,
    
    // Setters (pour les contrôles externes)
    setFilterStatutVente,
    setFilterTypeVente,
    setCurrentPageVentes,
    setItemsPerPageVentes,
    setVenteFormData,
    
    // Fonctions métier
    handleVenteInputChange,
    handleVenteSubmit,
    handleEditVente,
    askDeleteVente,
    doDeleteVente,
    openNewVenteModal,
    closeVenteModal,
    generateNumeroFacture,
    montantCalculeVente,
    handleSortVentes,
    resetFilters
  };
};

export default useVentes;
