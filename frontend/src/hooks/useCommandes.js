// ============================================================
// useCommandes.js - Hook personnalisé pour la gestion des commandes
// Version: 1.0 - Phase 3 Migration
// Date: 29 janvier 2026
// ============================================================

import { useState, useCallback } from 'react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

/**
 * Hook personnalisé pour gérer toute la logique métier des commandes
 * 
 * @param {Function} showMessage - Fonction pour afficher les messages de notification
 * @param {Function} loadData - Fonction pour recharger toutes les données
 * @param {Function} setConfirmModal - Fonction pour afficher un modal de confirmation
 * @param {Function} setIsProcessing - Fonction pour indiquer un traitement en cours
 * @param {Array} commandes - Liste des commandes
 * 
 * @returns {Object} États et fonctions de gestion des commandes
 */
export const useCommandes = ({ 
  showMessage, 
  loadData, 
  setConfirmModal, 
  setIsProcessing,
  commandes = []
}) => {
  // ==================== ÉTATS ====================
  
  const [showCommandeModal, setShowCommandeModal] = useState(false);
  const [editingCommande, setEditingCommande] = useState(null);
  const [filterStatutCommande, setFilterStatutCommande] = useState('all');
  
  // État formulaire commande
  const [commandeFormData, setCommandeFormData] = useState({
    client_id: '',
    date_commande: new Date().toISOString().split('T')[0],
    date_livraison_demandee: '',
    poids_grammes: '',
    calibre: '',
    qualite: '',
    maturite: '',
    prix_unitaire_kg: '',
    statut: 'En attente',
    notes: ''
  });
  
  // Pagination
  const [currentPageCommandes, setCurrentPageCommandes] = useState(1);
  const itemsPerPageCommandes = 50; // Fixe pour les commandes
  
  // Tri
  const [sortConfigCommandes, setSortConfigCommandes] = useState({ 
    key: 'date_commande', 
    direction: 'desc' 
  });
  
  // ==================== FONCTIONS ====================
  
  /**
   * Gère les changements dans le formulaire commande
   */
  const handleCommandeInputChange = useCallback((e) => {
    const { name, value } = e.target;
    setCommandeFormData(prev => ({ ...prev, [name]: value }));
  }, []);
  
  /**
   * Soumet le formulaire commande (création ou modification)
   */
  const handleCommandeSubmit = useCallback(async (e) => {
    e.preventDefault();
    setIsProcessing(true);
    
    try {
      const dataToSend = { ...commandeFormData };
      
      // Nettoyer les données
      if (!dataToSend.client_id) {
        dataToSend.client_id = null;
      }
      
      if (editingCommande) {
        // Mise à jour
        await axios.put(`${API_URL}/commandes/${editingCommande.id}`, dataToSend);
        showMessage('Commande mise à jour avec succès !', 'success');
      } else {
        // Création - générer numéro si absent
        if (!dataToSend.numero_commande) {
          dataToSend.numero_commande = generateNumeroCommande();
        }
        await axios.post(`${API_URL}/commandes`, dataToSend);
        showMessage('Commande enregistrée avec succès !', 'success');
      }
      
      await loadData();
      closeCommandeModal();
    } catch (error) {
      console.error('Erreur lors de la sauvegarde de la commande:', error);
      showMessage('Erreur lors de la sauvegarde', 'error');
    } finally {
      setIsProcessing(false);
    }
  }, [commandeFormData, editingCommande, showMessage, loadData, setIsProcessing, commandes]);
  
  /**
   * Ouvre le modal d'édition d'une commande
   */
  const handleEditCommande = useCallback((commande) => {
    setEditingCommande(commande);
    setCommandeFormData({
      client_id: commande.client_id || '',
      date_commande: commande.date_commande ? commande.date_commande.split('T')[0] : '',
      date_livraison_demandee: commande.date_livraison_demandee ? commande.date_livraison_demandee.split('T')[0] : '',
      poids_grammes: commande.poids_grammes || '',
      calibre: commande.calibre || '',
      qualite: commande.qualite || '',
      maturite: commande.maturite || '',
      prix_unitaire_kg: commande.prix_unitaire_kg || '',
      statut: commande.statut || 'En attente',
      notes: commande.notes || ''
    });
    setShowCommandeModal(true);
  }, []);
  
  /**
   * Demande confirmation avant suppression
   */
  const askDeleteCommande = useCallback((commande) => {
    setConfirmModal({
      type: 'delete-commande',
      item: commande,
      title: 'Supprimer la commande',
      message: `Êtes-vous sûr de vouloir supprimer la commande ${commande.numero_commande || commande.id} ?`,
      confirmText: 'Oui, supprimer',
      confirmColor: '#f44336'
    });
  }, [setConfirmModal]);
  
  /**
   * Supprime une commande
   */
  const doDeleteCommande = useCallback(async (commande) => {
    setIsProcessing(true);
    setConfirmModal(null);
    
    try {
      await axios.delete(`${API_URL}/commandes/${commande.id}`);
      showMessage('Commande supprimée avec succès !', 'success');
      await loadData();
    } catch (error) {
      console.error('Erreur lors de la suppression de la commande:', error);
      showMessage('Erreur lors de la suppression', 'error');
    } finally {
      setIsProcessing(false);
    }
  }, [showMessage, loadData, setConfirmModal, setIsProcessing]);
  
  /**
   * Ouvre le modal de création d'une nouvelle commande
   */
  const openNewCommandeModal = useCallback(() => {
    setEditingCommande(null);
    setCommandeFormData({
      client_id: '',
      date_commande: new Date().toISOString().split('T')[0],
      date_livraison_demandee: '',
      poids_grammes: '',
      calibre: '',
      qualite: '',
      maturite: '',
      prix_unitaire_kg: '',
      statut: 'En attente',
      notes: ''
    });
    setShowCommandeModal(true);
  }, []);
  
  /**
   * Ferme le modal commande
   */
  const closeCommandeModal = useCallback(() => {
    setShowCommandeModal(false);
    setEditingCommande(null);
  }, []);
  
  /**
   * Génère un numéro de commande unique
   */
  const generateNumeroCommande = useCallback(() => {
    const year = new Date().getFullYear();
    const existingNumbers = commandes
      .filter(c => c.numero_commande && c.numero_commande.startsWith(`CMD-${year}`))
      .map(c => {
        const match = c.numero_commande.match(/CMD-(\d{4})-(\d+)/);
        return match ? parseInt(match[2]) : 0;
      });
    const nextNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 1;
    return `CMD-${year}-${String(nextNumber).padStart(3, '0')}`;
  }, [commandes]);
  
  /**
   * Calcule le montant total de la commande en cours
   */
  const montantCalculeCommande = useCallback(() => {
    const poids = parseFloat(commandeFormData.poids_grammes || 0);
    const prixKg = parseFloat(commandeFormData.prix_unitaire_kg || 0);
    return ((poids / 1000) * prixKg).toFixed(2);
  }, [commandeFormData]);
  
  /**
   * Gère le tri des commandes
   */
  const handleSortCommandes = useCallback((key) => {
    setSortConfigCommandes(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  }, []);
  
  /**
   * Réinitialise les filtres commandes
   */
  const resetFilters = useCallback(() => {
    setFilterStatutCommande('all');
    setCurrentPageCommandes(1);
  }, []);
  
  // ==================== RETURN ====================
  
  return {
    // États
    showCommandeModal,
    editingCommande,
    filterStatutCommande,
    commandeFormData,
    currentPageCommandes,
    itemsPerPageCommandes,
    sortConfigCommandes,
    
    // Setters (pour les contrôles externes)
    setFilterStatutCommande,
    setCurrentPageCommandes,
    setCommandeFormData,
    
    // Fonctions métier
    handleCommandeInputChange,
    handleCommandeSubmit,
    handleEditCommande,
    askDeleteCommande,
    doDeleteCommande,
    openNewCommandeModal,
    closeCommandeModal,
    generateNumeroCommande,
    montantCalculeCommande,
    handleSortCommandes,
    resetFilters
  };
};

export default useCommandes;
