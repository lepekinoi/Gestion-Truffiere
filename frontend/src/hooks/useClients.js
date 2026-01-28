// ============================================================
// useClients.js - Hook personnalisé pour la gestion des clients
// Version: 1.0 - Phase 3 Migration
// Date: 29 janvier 2026
// ============================================================

import { useState, useCallback } from 'react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

/**
 * Hook personnalisé pour gérer toute la logique métier des clients
 * 
 * @param {Function} showMessage - Fonction pour afficher les messages de notification
 * @param {Function} loadData - Fonction pour recharger toutes les données
 * @param {Function} setConfirmModal - Fonction pour afficher un modal de confirmation
 * @param {Function} setIsProcessing - Fonction pour indiquer un traitement en cours
 * 
 * @returns {Object} États et fonctions de gestion des clients
 */
export const useClients = ({ 
  showMessage, 
  loadData, 
  setConfirmModal, 
  setIsProcessing 
}) => {
  // ==================== ÉTATS ====================
  
  const [showClientModal, setShowClientModal] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [filterTypeClient, setFilterTypeClient] = useState('all');
  const [searchTermClient, setSearchTermClient] = useState('');
  const [selectedClientForTransactions, setSelectedClientForTransactions] = useState(null);
  const [clientTransactions, setClientTransactions] = useState({ commandes: [], ventes: [] });
  const [showTransactionsModal, setShowTransactionsModal] = useState(false);
  
  // État formulaire client
  const [clientFormData, setClientFormData] = useState({
    type: 'Particulier',
    nom: '',
    prenom: '',
    raison_sociale: '',
    email: '',
    telephone: '',
    adresse: '',
    code_postal: '',
    ville: '',
    pays: 'France',
    siret: '',
    notes: ''
  });
  
  // Pagination
  const [currentPageClients, setCurrentPageClients] = useState(1);
  const [itemsPerPageClients, setItemsPerPageClients] = useState(50);
  
  // Tri
  const [sortConfigClients, setSortConfigClients] = useState({ 
    key: null, 
    direction: 'asc' 
  });
  
  // ==================== FONCTIONS ====================
  
  /**
   * Gère les changements dans le formulaire client
   */
  const handleClientFormChange = useCallback((e) => {
    const { name, value } = e.target;
    setClientFormData(prev => ({ ...prev, [name]: value }));
  }, []);
  
  /**
   * Soumet le formulaire client (création ou modification)
   */
  const handleClientSubmit = useCallback(async (e) => {
    e.preventDefault();
    setIsProcessing(true);
    
    try {
      const dataToSend = { ...clientFormData };
      
      // Nettoyer les données selon le type
      if (dataToSend.type === 'Particulier') {
        dataToSend.raison_sociale = null;
        dataToSend.siret = null;
      } else {
        dataToSend.prenom = null;
      }
      
      if (editingClient) {
        // Mise à jour
        await axios.put(`${API_URL}/clients/${editingClient.id}`, dataToSend);
        showMessage('Client mis à jour avec succès !', 'success');
      } else {
        // Création
        await axios.post(`${API_URL}/clients`, dataToSend);
        showMessage('Client créé avec succès !', 'success');
      }
      
      await loadData();
      closeClientModal();
    } catch (error) {
      console.error('Erreur lors de la sauvegarde du client:', error);
      showMessage('Erreur lors de la sauvegarde', 'error');
    } finally {
      setIsProcessing(false);
    }
  }, [clientFormData, editingClient, showMessage, loadData, setIsProcessing]);
  
  /**
   * Ouvre le modal d'édition d'un client
   */
  const handleEditClient = useCallback((client) => {
    setEditingClient(client);
    setClientFormData({
      type: client.type || 'Particulier',
      nom: client.nom || '',
      prenom: client.prenom || '',
      raison_sociale: client.raison_sociale || '',
      email: client.email || '',
      telephone: client.telephone || '',
      adresse: client.adresse || '',
      code_postal: client.code_postal || '',
      ville: client.ville || '',
      pays: client.pays || 'France',
      siret: client.siret || '',
      notes: client.notes || ''
    });
    setShowClientModal(true);
  }, []);
  
  /**
   * Demande confirmation avant suppression
   */
  const askDeleteClient = useCallback((client) => {
    const clientName = client.type === 'Particulier'
      ? `${client.nom} ${client.prenom || ''}`
      : client.raison_sociale || client.nom;
      
    setConfirmModal({
      type: 'delete-client',
      item: client,
      title: 'Supprimer le client',
      message: `Êtes-vous sûr de vouloir supprimer le client ${clientName} ? Cette action est irréversible.`,
      confirmText: 'Oui, supprimer',
      confirmColor: '#f44336'
    });
  }, [setConfirmModal]);
  
  /**
   * Supprime un client
   */
  const doDeleteClient = useCallback(async (client) => {
    setIsProcessing(true);
    setConfirmModal(null);
    
    try {
      await axios.delete(`${API_URL}/clients/${client.id}`);
      showMessage('Client supprimé avec succès !', 'success');
      await loadData();
    } catch (error) {
      console.error('Erreur lors de la suppression du client:', error);
      showMessage('Erreur lors de la suppression', 'error');
    } finally {
      setIsProcessing(false);
    }
  }, [showMessage, loadData, setConfirmModal, setIsProcessing]);
  
  /**
   * Ouvre le modal de création d'un nouveau client
   */
  const openNewClientModal = useCallback(() => {
    setEditingClient(null);
    setClientFormData({
      type: 'Particulier',
      nom: '',
      prenom: '',
      raison_sociale: '',
      email: '',
      telephone: '',
      adresse: '',
      code_postal: '',
      ville: '',
      pays: 'France',
      siret: '',
      notes: ''
    });
    setShowClientModal(true);
  }, []);
  
  /**
   * Ferme le modal client
   */
  const closeClientModal = useCallback(() => {
    setShowClientModal(false);
    setEditingClient(null);
  }, []);
  
  /**
   * Affiche les transactions d'un client (commandes + ventes)
   */
  const viewClientTransactions = useCallback((client, commandes = [], ventes = []) => {
    setSelectedClientForTransactions(client);
    const clientCommandes = commandes.filter(c => c.client_id === client.id);
    const clientVentes = ventes.filter(v => v.client_id === client.id);
    setClientTransactions({ commandes: clientCommandes, ventes: clientVentes });
    setShowTransactionsModal(true);
  }, []);
  
  /**
   * Gère le tri des clients
   */
  const handleSortClients = useCallback((key) => {
    setSortConfigClients(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  }, []);
  
  /**
   * Réinitialise les filtres clients
   */
  const resetFilters = useCallback(() => {
    setFilterTypeClient('all');
    setSearchTermClient('');
    setCurrentPageClients(1);
  }, []);
  
  // ==================== RETURN ====================
  
  return {
    // États
    showClientModal,
    editingClient,
    filterTypeClient,
    searchTermClient,
    selectedClientForTransactions,
    clientTransactions,
    showTransactionsModal,
    clientFormData,
    currentPageClients,
    itemsPerPageClients,
    sortConfigClients,
    
    // Setters (pour les contrôles externes)
    setFilterTypeClient,
    setSearchTermClient,
    setCurrentPageClients,
    setItemsPerPageClients,
    setShowTransactionsModal,
    
    // Fonctions métier
    handleClientFormChange,
    handleClientSubmit,
    handleEditClient,
    askDeleteClient,
    doDeleteClient,
    openNewClientModal,
    closeClientModal,
    viewClientTransactions,
    handleSortClients,
    resetFilters
  };
};

export default useClients;
