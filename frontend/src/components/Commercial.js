import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { exportCommandesPDF, exportVentesPDF, exportClientsPDF } from '../utils/pdfExport';
import { validateVentesCSV, validateClientsCSV } from '../utils/csvImport';
import CSVImportModal from './CSVImportModal';
import { useColumnSettings, COLONNES_CONFIG } from '../hooks/useColumnSettings';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

const STATUT_COLORS_COMMANDES = {
  'En attente': { background: '#fff3cd', color: '#856404', border: '#ffc107' },
  'Confirmée': { background: '#cce5ff', color: '#004085', border: '#007bff' },
  'En préparation': { background: '#d4edda', color: '#155724', border: '#28a745' },
  'Livrée': { background: '#d1ecf1', color: '#0c5460', border: '#17a2b8' },
  'Annulée': { background: '#f8d7da', color: '#721c24', border: '#dc3545' }
};

const STATUT_COLORS_VENTES = {
  'En attente': { background: '#fff3cd', color: '#856404', border: '#ffc107' },
  'Payée': { background: '#d4edda', color: '#155724', border: '#28a745' },
  'Annulée': { background: '#f8d7da', color: '#721c24', border: '#dc3545' }
};

function Commercial() {
  const [activeTab, setActiveTab] = useState('clients');
  
  // États clients
  const [clients, setClients] = useState([]);
  const [showClientModal, setShowClientModal] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [filterTypeClient, setFilterTypeClient] = useState('all');
  const [searchTermClient, setSearchTermClient] = useState('');
  const [statsParType, setStatsParType] = useState([]);
  const [selectedClientForTransactions, setSelectedClientForTransactions] = useState(null);
  const [clientTransactions, setClientTransactions] = useState({ commandes: [], ventes: [] });
  const [showTransactionsModal, setShowTransactionsModal] = useState(false);
  
  // États commandes
  const [commandes, setCommandes] = useState([]);
  const [showCommandeModal, setShowCommandeModal] = useState(false);
  const [editingCommande, setEditingCommande] = useState(null);
  const [filterStatutCommande, setFilterStatutCommande] = useState('all');
  
  // États ventes
  const [ventes, setVentes] = useState([]);
  const [showVenteModal, setShowVenteModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showClientImportModal, setShowClientImportModal] = useState(false);
  const [editingVente, setEditingVente] = useState(null);
  const [filterStatutVente, setFilterStatutVente] = useState('all');
  const [filterRecolte, setFilterRecolte] = useState({ type: 'all', value: '' });
  
  // États partagés
  const [recoltes, setRecoltes] = useState([]);
  const [arbres, setArbres] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showQuickClientModal, setShowQuickClientModal] = useState(false);
  const [message, setMessage] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [confirmModal, setConfirmModal] = useState(null);
  
  // Formulaire client
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
  
  // Formulaires commandes/ventes
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
  
  const [venteFormData, setVenteFormData] = useState({
    client_id: '',
    recolte_id: '',
    date_vente: '',
    quantite_grammes: '',
    prix_unitaire_kg: '',
    mode_paiement: '',
    statut: 'En attente',
    numero_facture: '',
    notes: ''
  });
  
  const [newClientData, setNewClientData] = useState({
    type: 'Particulier', nom: '', prenom: '', raison_sociale: '',
    email: '', telephone: '', adresse: '', code_postal: '',
    ville: '', pays: 'France', siret: '', notes: ''
  });

  const { colonnesAffichees: colonnesClients, colonnesExport: colonnesExportClients, loading: loadingClientsSettings } = useColumnSettings('clients');
  const { colonnesAffichees: colonnesVentes, colonnesExport: colonnesExportVentes, loading: loadingVentesSettings } = useColumnSettings('ventes');

  useEffect(() => { loadData(); }, []);

  const showMessage = (text, type = 'success') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 4000);
  };

  const loadData = async () => {
    try {
      const [commandesRes, ventesRes, clientsRes, recoltesRes, arbresRes, statsRes] = await Promise.all([
        axios.get(`${API_URL}/commandes`),
        axios.get(`${API_URL}/ventes`),
        axios.get(`${API_URL}/clients`),
        axios.get(`${API_URL}/recoltes`),
        axios.get(`${API_URL}/arbres`),
        axios.get(`${API_URL}/clients/stats/by-type`).catch(() => ({ data: [] }))
      ]);
      setCommandes(commandesRes.data);
      setVentes(ventesRes.data);
      setClients(clientsRes.data);
      setRecoltes(recoltesRes.data);
      setArbres(arbresRes.data);
      setStatsParType(statsRes.data);
      setLoading(false);
    } catch (error) {
      console.error('Erreur:', error);
      showMessage('Erreur lors du chargement des données', 'error');
      setLoading(false);
    }
  };

  // ======================= FONCTIONS CLIENTS =======================

  const handleClientFormChange = (e) => {
    const { name, value } = e.target;
    setClientFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleClientSubmit = async (e) => {
    e.preventDefault();
    setIsProcessing(true);
    try {
      const dataToSend = { ...clientFormData };
      if (dataToSend.type === 'Particulier') {
        dataToSend.raison_sociale = null;
        dataToSend.siret = null;
      } else {
        dataToSend.prenom = null;
      }
      if (editingClient) {
        await axios.put(`${API_URL}/clients/${editingClient.id}`, dataToSend);
        showMessage('Client mis à jour avec succès !', 'success');
      } else {
        await axios.post(`${API_URL}/clients`, dataToSend);
        showMessage('Client créé avec succès !', 'success');
      }
      loadData();
      closeClientModal();
    } catch (error) {
      showMessage('Erreur lors de la sauvegarde', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleEditClient = (client) => {
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
  };

  const askDeleteClient = (client) => {
    const clientName = client.type === 'Particulier' 
      ? `${client.nom} ${client.prenom || ''}` 
      : client.raison_sociale || client.nom;
    
    setConfirmModal({
      type: 'delete-client',
      item: client,
      title: 'Supprimer le client',
      message: `Êtes-vous sûr de vouloir supprimer le client "${clientName}" ? Cette action est irréversible.`,
      confirmText: 'Oui, supprimer',
      confirmColor: '#f44336'
    });
  };

  const doDeleteClient = async (client) => {
    setIsProcessing(true);
    setConfirmModal(null);
    
    try {
      await axios.delete(`${API_URL}/clients/${client.id}`);
      showMessage('Client supprimé avec succès !', 'success');
      loadData();
    } catch (error) {
      showMessage('Erreur lors de la suppression', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const viewClientTransactions = (client) => {
    setSelectedClientForTransactions(client);
    const clientCommandes = commandes.filter(c => c.client_id === client.id);
    const clientVentes = ventes.filter(v => v.client_id === client.id);
    setClientTransactions({ commandes: clientCommandes, ventes: clientVentes });
    setShowTransactionsModal(true);
  };

  const openNewClientModal = () => {
    setEditingClient(null);
    setClientFormData({ 
      type: 'Particulier', nom: '', prenom: '', raison_sociale: '', 
      email: '', telephone: '', adresse: '', code_postal: '', 
      ville: '', pays: 'France', siret: '', notes: '' 
    });
    setShowClientModal(true);
  };

  const closeClientModal = () => {
    setShowClientModal(false);
    setEditingClient(null);
  };

  const handleImportClientsCSV = async (validData) => {
    for (const client of validData) await axios.post(`${API_URL}/clients`, client);
    loadData();
    showMessage(`${validData.length} client(s) importé(s) avec succès !`, 'success');
  };

  const handleExportClientsPDF = () => {
    const config = COLONNES_CONFIG.clients;
    exportClientsPDF(filteredClients, colonnesExportClients);
  };

  const getTypeBadgeStyle = (type) => {
    const styles = { 
      'Particulier': { background: '#e3f2fd', color: '#1565c0' }, 
      'Restaurant': { background: '#fff3e0', color: '#e65100' }, 
      'Grossiste': { background: '#f3e5f5', color: '#7b1fa2' } 
    };
    return styles[type] || styles['Particulier'];
  };

  const filteredClients = clients.filter(client => {
    const matchType = filterTypeClient === 'all' || client.type === filterTypeClient;
    const searchLower = searchTermClient.toLowerCase();
    const matchSearch = !searchTermClient || 
      (client.nom && client.nom.toLowerCase().includes(searchLower)) ||
      (client.prenom && client.prenom.toLowerCase().includes(searchLower)) ||
      (client.raison_sociale && client.raison_sociale.toLowerCase().includes(searchLower)) ||
      (client.email && client.email.toLowerCase().includes(searchLower)) ||
      (client.ville && client.ville.toLowerCase().includes(searchLower));
    return matchType && matchSearch;
  });

  const statsClients = {
    total: clients.length,
    particuliers: clients.filter(c => c.type === 'Particulier').length,
    restaurants: clients.filter(c => c.type === 'Restaurant').length,
    grossistes: clients.filter(c => c.type === 'Grossiste').length
  };

  const configClients = COLONNES_CONFIG.clients;
  const colonnesValidesClients = colonnesClients.filter(col => configClients[col]);

  const renderClientCell = (client, col) => {
    if (col === 'type') {
      return (
        <span style={{ padding: '0.25rem 0.75rem', borderRadius: '12px', fontSize: '0.85rem', fontWeight: '500', ...getTypeBadgeStyle(client.type) }}>
          {client.type}
        </span>
      );
    }
    if (col === 'nom') return <strong>{configClients[col].render(client)}</strong>;
    return configClients[col].render(client);
  };

  // ======================= FONCTIONS COMMANDES =======================
  
  const handleCommandeInputChange = (e) => {
    const { name, value } = e.target;
    setCommandeFormData(prev => ({ ...prev, [name]: value }));
  };

  const generateNumeroFacture = () => {
    const year = new Date().getFullYear();
    const existingNumbers = ventes
      .filter(v => v.numero_facture && v.numero_facture.startsWith(`FACT-${year}`))
      .map(v => {
        const match = v.numero_facture.match(/FACT-\d{4}-(\d+)/);
        return match ? parseInt(match[1]) : 0;
      });
    const nextNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 1;
    return `FACT-${year}-${String(nextNumber).padStart(3, '0')}`;
  };

  const generateNumeroCommande = () => {
    const year = new Date().getFullYear();
    const existingNumbers = commandes
      .filter(c => c.numero_commande && c.numero_commande.startsWith(`CMD-${year}`))
      .map(c => {
        const match = c.numero_commande.match(/CMD-\d{4}-(\d+)/);
        return match ? parseInt(match[1]) : 0;
      });
    const nextNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 1;
    return `CMD-${year}-${String(nextNumber).padStart(3, '0')}`;
  };

  const createVenteFromCommande = async (commande) => {
    try {
      const existingVente = ventes.find(v => v.commande_id === commande.id);
      if (existingVente) {
        showMessage('Une vente existe déjà pour cette commande', 'info');
        return;
      }

      const numeroCommandeLabel = commande.numero_commande || `CMD-${commande.id}`;
      
      const venteData = {
        client_id: commande.client_id,
        commande_id: commande.id,
        date_vente: new Date().toISOString().split('T')[0],
        quantite_grammes: commande.poids_grammes,
        prix_unitaire_kg: commande.prix_unitaire_kg,
        mode_paiement: '',
        statut: 'En attente',
        numero_facture: generateNumeroFacture(),
        notes: `Vente issue de la commande ${numeroCommandeLabel}`
      };
      
      await axios.post(`${API_URL}/ventes`, venteData);
      showMessage('✖ Vente créée automatiquement !', 'success');
      
      const ventesRes = await axios.get(`${API_URL}/ventes`);
      setVentes(ventesRes.data);
    } catch (error) {
      console.error('Erreur création vente:', error);
      showMessage('La vente n\'a pas pu être créée automatiquement', 'error');
    }
  };

  const handleCommandeSubmit = async (e) => {
    e.preventDefault();
    setIsProcessing(true);
    try {
      const dataToSend = { ...commandeFormData };
      if (!dataToSend.client_id) dataToSend.client_id = null;
      
      if (!editingCommande && !dataToSend.numero_commande) {
        dataToSend.numero_commande = generateNumeroCommande();
      }
      
      const previousStatut = editingCommande ? editingCommande.statut : null;
      
      if (editingCommande) {
        await axios.put(`${API_URL}/commandes/${editingCommande.id}`, dataToSend);
        showMessage('Commande mise à jour avec succès !', 'success');
        
        if (dataToSend.statut === 'Livrée' && previousStatut !== 'Livrée') {
          await createVenteFromCommande({ ...editingCommande, ...dataToSend });
        }
      } else {
        const response = await axios.post(`${API_URL}/commandes`, dataToSend);
        showMessage('Commande enregistrée avec succès !', 'success');
        
        if (dataToSend.statut === 'Livrée') {
          await createVenteFromCommande(response.data);
        }
      }
      loadData();
      closeCommandeModal();
    } catch (error) {
      console.error('Erreur:', error);
      showMessage('Erreur lors de la sauvegarde', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleEditCommande = (commande) => {
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
  };

  const askDeleteCommande = (commande) => {
    setConfirmModal({
      type: 'delete-commande',
      item: commande,
      title: 'Supprimer la commande',
      message: `Êtes-vous sûr de vouloir supprimer la commande ${commande.numero_commande || '#' + commande.id} ?`,
      confirmText: 'Oui, supprimer',
      confirmColor: '#f44336'
    });
  };

  const doDeleteCommande = async (commande) => {
    setIsProcessing(true);
    setConfirmModal(null);
    try {
      await axios.delete(`${API_URL}/commandes/${commande.id}`);
      showMessage('Commande supprimée avec succès !', 'success');
      loadData();
    } catch (error) {
      console.error('Erreur:', error);
      showMessage('Erreur lors de la suppression', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const openNewCommandeModal = () => {
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
  };

  const closeCommandeModal = () => {
    setShowCommandeModal(false);
    setEditingCommande(null);
  };

  const montantCalculeCommande = () => {
    const poids = parseFloat(commandeFormData.poids_grammes) || 0;
    const prixKg = parseFloat(commandeFormData.prix_unitaire_kg) || 0;
    return ((poids / 1000) * prixKg).toFixed(2);
  };

  // ======================= FONCTIONS VENTES =======================

  const handleVenteInputChange = (e) => {
    const { name, value } = e.target;
    setVenteFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleVenteSubmit = async (e) => {
    e.preventDefault();
    
    if (!venteFormData.recolte_id) {
      showMessage('La récolte est obligatoire pour enregistrer une vente', 'error');
      return;
    }
    
    setIsProcessing(true);
    try {
      const dataToSend = { ...venteFormData };
      
      if (editingVente) {
        await axios.put(`${API_URL}/ventes/${editingVente.id}`, dataToSend);
        showMessage('Vente mise à jour avec succès !', 'success');
      } else {
        await axios.post(`${API_URL}/ventes`, dataToSend);
        showMessage('Vente enregistrée avec succès !', 'success');
      }
      loadData();
      closeVenteModal();
    } catch (error) {
      console.error('Erreur:', error);
      showMessage('Erreur lors de la sauvegarde: ' + (error.response?.data?.error || error.message), 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleEditVente = (vente) => {
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
  };

  const askDeleteVente = (vente) => {
    setConfirmModal({
      type: 'delete-vente',
      item: vente,
      title: 'Supprimer la vente',
      message: `Êtes-vous sûr de vouloir supprimer la vente ${vente.numero_facture || '#' + vente.id} ?`,
      confirmText: 'Oui, supprimer',
      confirmColor: '#f44336'
    });
  };

  const doDeleteVente = async (vente) => {
    setIsProcessing(true);
    setConfirmModal(null);
    try {
      await axios.delete(`${API_URL}/ventes/${vente.id}`);
      showMessage('Vente supprimée avec succès !', 'success');
      loadData();
    } catch (error) {
      console.error('Erreur:', error);
      showMessage('Erreur lors de la suppression', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const openNewVenteModal = () => {
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
  };

  const closeVenteModal = () => {
    setShowVenteModal(false);
    setEditingVente(null);
  };

  const montantCalculeVente = () => {
    const poids = parseFloat(venteFormData.quantite_grammes) || 0;
    const prixKg = parseFloat(venteFormData.prix_unitaire_kg) || 0;
    return ((poids / 1000) * prixKg).toFixed(2);
  };

  const getFilteredRecoltes = () => {
    if (filterRecolte.type === 'all') return recoltes;
    if (filterRecolte.type === 'date') {
      return recoltes.filter(r => r.date_recolte && r.date_recolte.startsWith(filterRecolte.value));
    }
    if (filterRecolte.type === 'arbre') {
      return recoltes.filter(r => {
        const arbre = arbres.find(a => a.id === r.arbre_id);
        return arbre && arbre.numero.toLowerCase().includes(filterRecolte.value.toLowerCase());
      });
    }
    return recoltes;
  };

  // ======================= FONCTIONS PARTAGÉES =======================

  const handleQuickClientInputChange = (e) => {
    const { name, value } = e.target;
    setNewClientData(prev => ({ ...prev, [name]: value }));
  };

  const handleCreateQuickClient = async (e) => {
    e.preventDefault();
    setIsProcessing(true);
    
    try {
      const dataToSend = { ...newClientData };
      if (dataToSend.type === 'Particulier') {
        dataToSend.raison_sociale = null;
        dataToSend.siret = null;
      } else {
        dataToSend.prenom = null;
      }

      const response = await axios.post(`${API_URL}/clients`, dataToSend);
      const newClient = response.data;
      
      await loadData();
      
      if (activeTab === 'commandes') {
        setCommandeFormData(prev => ({ ...prev, client_id: newClient.id }));
      } else if (activeTab === 'ventes') {
        setVenteFormData(prev => ({ ...prev, client_id: newClient.id }));
      }
      
      setShowQuickClientModal(false);
      setNewClientData({
        type: 'Particulier', nom: '', prenom: '', raison_sociale: '',
        email: '', telephone: '', adresse: '', code_postal: '',
        ville: '', pays: 'France', siret: '', notes: ''
      });
      showMessage('Client créé avec succès !', 'success');
    } catch (error) {
      console.error('Erreur:', error);
      showMessage('Erreur lors de la création du client', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirm = () => {
    if (!confirmModal) return;
    if (confirmModal.type === 'delete-client') {
      doDeleteClient(confirmModal.item);
    } else if (confirmModal.type === 'delete-commande') {
      doDeleteCommande(confirmModal.item);
    } else if (confirmModal.type === 'delete-vente') {
      doDeleteVente(confirmModal.item);
    } else {
      setConfirmModal(null);
    }
  };

  const handleImportVentesCSV = async (data) => {
    setIsProcessing(true);
    try {
      let successCount = 0;
      for (const item of data) {
        try {
          await axios.post(`${API_URL}/ventes`, item);
          successCount++;
        } catch (e) {
          console.error('Erreur import ligne:', e);
        }
      }
      showMessage(`Import terminé : ${successCount}/${data.length} ventes importées`, 'success');
      loadData();
      setShowImportModal(false);
    } catch (error) {
      console.error('Erreur import:', error);
      showMessage('Erreur lors de l\'import', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const getClientName = (clientId) => {
    const client = clients.find(c => c.id === clientId);
    if (!client) return '-';
    return client.type === 'Particulier' 
      ? `${client.nom} ${client.prenom || ''}` 
      : client.raison_sociale || client.nom;
  };

  // Filtrage
  const filteredCommandes = commandes.filter(c => 
    filterStatutCommande === 'all' || c.statut === filterStatutCommande
  );
  
  const filteredVentes = ventes.filter(v => 
    filterStatutVente === 'all' || v.statut === filterStatutVente
  );

  // Statistiques
  const statsCommandes = {
    total: commandes.length,
    enAttente: commandes.filter(c => c.statut === 'En attente').length,
    livrees: commandes.filter(c => c.statut === 'Livrée').length,
    montantTotal: commandes.reduce((sum, c) => sum + parseFloat(c.montant_total || 0), 0)
  };

  const statsVentes = {
    total: ventes.length,
    payees: ventes.filter(v => v.statut === 'Payée').length,
    enAttente: ventes.filter(v => v.statut === 'En attente').length,
    chiffreAffaires: ventes.filter(v => v.statut === 'Payée').reduce((sum, v) => sum + parseFloat(v.montant_total || 0), 0)
  };

  if (loading || loadingClientsSettings || loadingVentesSettings) {
    return <div className="loading">Chargement des données commerciales...</div>;
  }

  return (
    <div className="page-container">
      {/* Message de notification */}
      {message && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          padding: '1rem 1.5rem',
          borderRadius: '8px',
          background: message.type === 'error' ? '#f44336' : '#4caf50',
          color: 'white',
          fontWeight: 'bold',
          zIndex: 9999,
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
        }}>
          {message.text}
        </div>
      )}

      {/* Modal de confirmation */}
      {confirmModal && (
        <div className="modal-overlay" onClick={() => setConfirmModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '450px', textAlign: 'center' }}>
            <h3 style={{ marginBottom: '1rem', color: '#333' }}>{confirmModal.title}</h3>
            <p style={{ marginBottom: '1.5rem', color: '#666' }}>{confirmModal.message}</p>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              <button className="btn btn-secondary" onClick={() => setConfirmModal(null)}>Annuler</button>
              <button 
                className="btn" 
                onClick={handleConfirm}
                style={{ background: confirmModal.confirmColor, color: 'white', border: 'none' }}
              >
                {confirmModal.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="page-header">
        <h2>💼 Gestion Commerciale</h2>
      </div>

      {/* Onglets */}
      <div style={{ display: 'flex', gap: '0', marginBottom: '2rem', borderBottom: '3px solid #e0e0e0' }}>
        <button
          onClick={() => setActiveTab('clients')}
          style={{
            padding: '1rem 2rem',
            background: activeTab === 'clients' ? '#2c5f2d' : 'transparent',
            color: activeTab === 'clients' ? 'white' : '#2c5f2d',
            border: 'none',
            cursor: 'pointer',
            fontSize: '1.1rem',
            fontWeight: activeTab === 'clients' ? 'bold' : 'normal',
            borderTopLeftRadius: '8px',
            borderTopRightRadius: '8px',
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}
        >
          👥 Clients
          <span style={{
            background: activeTab === 'clients' ? 'rgba(255,255,255,0.2)' : '#2c5f2d20',
            padding: '0.2rem 0.5rem',
            borderRadius: '12px',
            fontSize: '0.85rem'
          }}>
            {clients.length}
          </span>
        </button>
        <button
          onClick={() => setActiveTab('commandes')}
          style={{
            padding: '1rem 2rem',
            background: activeTab === 'commandes' ? '#2c5f2d' : 'transparent',
            color: activeTab === 'commandes' ? 'white' : '#2c5f2d',
            border: 'none',
            cursor: 'pointer',
            fontSize: '1.1rem',
            fontWeight: activeTab === 'commandes' ? 'bold' : 'normal',
            borderTopLeftRadius: '8px',
            borderTopRightRadius: '8px',
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}
        >
          📦 Commandes
          <span style={{
            background: activeTab === 'commandes' ? 'rgba(255,255,255,0.2)' : '#2c5f2d20',
            padding: '0.2rem 0.5rem',
            borderRadius: '12px',
            fontSize: '0.85rem'
          }}>
            {commandes.length}
          </span>
        </button>
        <button
          onClick={() => setActiveTab('ventes')}
          style={{
            padding: '1rem 2rem',
            background: activeTab === 'ventes' ? '#2c5f2d' : 'transparent',
            color: activeTab === 'ventes' ? 'white' : '#2c5f2d',
            border: 'none',
            cursor: 'pointer',
            fontSize: '1.1rem',
            fontWeight: activeTab === 'ventes' ? 'bold' : 'normal',
            borderTopLeftRadius: '8px',
            borderTopRightRadius: '8px',
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}
        >
          💰 Ventes
          <span style={{
            background: activeTab === 'ventes' ? 'rgba(255,255,255,0.2)' : '#2c5f2d20',
            padding: '0.2rem 0.5rem',
            borderRadius: '12px',
            fontSize: '0.85rem'
          }}>
            {ventes.length}
          </span>
        </button>
      </div>

      {/* ======================= CONTENU CLIENTS ======================= */}
      {activeTab === 'clients' && (
        <>
          {/* Boutons d'action clients */}
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', justifyContent: 'flex-end' }}>
            <button className="btn btn-secondary" onClick={() => setShowClientImportModal(true)}>📤 Importer CSV</button>
            <button className="btn btn-secondary" onClick={handleExportClientsPDF} disabled={filteredClients.length === 0}>🔄 Exporter PDF</button>
            <button className="btn btn-primary" onClick={openNewClientModal}>➕ Nouveau client</button>
          </div>

          {/* Stats clients */}
          <div className="card-grid" style={{ marginBottom: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
            <div className="card"><div className="card-title">Total</div><div className="card-value">{statsClients.total}</div></div>
            <div className="card"><div className="card-title">Particuliers</div><div className="card-value" style={{ color: '#1565c0' }}>{statsClients.particuliers}</div></div>
            <div className="card"><div className="card-title">Restaurants</div><div className="card-value" style={{ color: '#e65100' }}>{statsClients.restaurants}</div></div>
            <div className="card"><div className="card-title">Grossistes</div><div className="card-value" style={{ color: '#7b1fa2' }}>{statsClients.grossistes}</div></div>
          </div>

          {/* Stats chiffrées par type */}
          {statsParType.length > 0 && (
            <div style={{ 
              marginBottom: '2rem', 
              padding: '1rem', 
              background: '#f5f5f5', 
              borderRadius: '8px',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
              gap: '1rem'
            }}>
              <h4 style={{ gridColumn: '1 / -1', margin: '0 0 0.5rem 0', color: '#2c5f2d' }}>💰 Récapitulatif par type de client</h4>
              {statsParType.map(stat => (
                <div key={stat.type} style={{ 
                  background: 'white', 
                  padding: '1rem', 
                  borderRadius: '8px',
                  borderLeft: `4px solid ${getTypeBadgeStyle(stat.type).color}`
                }}>
                  <div style={{ fontWeight: 'bold', marginBottom: '0.5rem', ...getTypeBadgeStyle(stat.type) }}>
                    {stat.type}s ({stat.nb_clients})
                  </div>
                  <div style={{ fontSize: '0.9rem', color: '#666' }}>
                    <div>📦 Commandes: <strong>{parseFloat(stat.total_commandes || 0).toFixed(2)} €</strong></div>
                    <div>💰 Ventes: <strong>{parseFloat(stat.total_ventes || 0).toFixed(2)} €</strong></div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Filtres clients */}
          <div style={{ marginBottom: '1rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {['all', 'Particulier', 'Restaurant', 'Grossiste'].map(type => (
                <button key={type} className={`btn ${filterTypeClient === type ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setFilterTypeClient(type)} style={{ padding: '0.5rem 1rem' }}>
                  {type === 'all' ? 'Tous' : type + 's'}
                </button>
              ))}
            </div>
            <input type="text" placeholder="🔍 Rechercher..." value={searchTermClient} onChange={(e) => setSearchTermClient(e.target.value)} style={{ padding: '0.5rem 1rem', border: '1px solid #ddd', borderRadius: '8px', minWidth: '200px' }} />
          </div>

          {/* Liste clients */}
          {filteredClients.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">👥</div>
              <p>Aucun client trouvé</p>
              <button className="btn btn-primary" onClick={openNewClientModal} style={{ marginTop: '1rem' }}>Ajouter un client</button>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  {colonnesValidesClients.map(col => <th key={col} style={{ textAlign: configClients[col].align || 'left' }}>{configClients[col].label}</th>)}
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredClients.map(client => (
                  <tr key={client.id}>
                    {colonnesValidesClients.map(col => <td key={col} style={{ textAlign: configClients[col].align || 'left' }}>{renderClientCell(client, col)}</td>)}
                    <td>
                      <button 
                        className="btn btn-secondary" 
                        onClick={() => viewClientTransactions(client)} 
                        style={{ marginRight: '0.5rem', padding: '0.4rem 0.8rem' }}
                        title="Voir les transactions"
                      >
                        📊
                      </button>
                      <button className="btn btn-secondary" onClick={() => handleEditClient(client)} style={{ marginRight: '0.5rem', padding: '0.4rem 0.8rem' }}>✏️</button>
                      <button className="btn btn-danger" onClick={() => askDeleteClient(client)} style={{ padding: '0.4rem 0.8rem' }}>🗑️</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}

      {/* ======================= CONTENU COMMANDES ======================= */}
      {activeTab === 'commandes' && (
        <>
          {/* Statistiques commandes */}
          <div className="stats-grid" style={{ marginBottom: '1.5rem' }}>
            <div className="stat-card">
              <div className="stat-label">Total commandes</div>
              <div className="stat-value">{statsCommandes.total}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">En attente</div>
              <div className="stat-value" style={{ color: '#f39c12' }}>{statsCommandes.enAttente}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Livrées</div>
              <div className="stat-value" style={{ color: '#27ae60' }}>{statsCommandes.livrees}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Montant total</div>
              <div className="stat-value">{statsCommandes.montantTotal.toFixed(2)} €</div>
            </div>
          </div>

          {/* Filtres et boutons commandes */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {['all', 'En attente', 'Confirmée', 'En préparation', 'Livrée', 'Annulée'].map(statut => (
                <button
                  key={statut}
                  className={`btn ${filterStatutCommande === statut ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setFilterStatutCommande(statut)}
                  style={{ padding: '0.5rem 1rem' }}
                >
                  {statut === 'all' ? 'Tous' : statut}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className="btn btn-secondary" onClick={() => exportCommandesPDF(filteredCommandes, clients)}>🔄 Export PDF</button>
              <button className="btn btn-primary" onClick={openNewCommandeModal}>➕ Nouvelle commande</button>
            </div>
          </div>

          {/* Liste commandes */}
          {filteredCommandes.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📦</div>
              <p>Aucune commande trouvée</p>
              <button className="btn btn-primary" onClick={openNewCommandeModal} style={{ marginTop: '1rem' }}>Créer une commande</button>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>N° Commande</th>
                  <th>Date</th>
                  <th>Client</th>
                  <th>Quantité</th>
                  <th>Prix/kg</th>
                  <th>Total</th>
                  <th>Statut</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredCommandes.map(commande => {
                  const statutStyle = STATUT_COLORS_COMMANDES[commande.statut] || {};
                  return (
                    <tr key={commande.id}>
                      <td><strong>{commande.numero_commande || `CMD-${commande.id}`}</strong></td>
                      <td>{new Date(commande.date_commande).toLocaleDateString('fr-FR')}</td>
                      <td>{getClientName(commande.client_id)}</td>
                      <td>{parseFloat(commande.poids_grammes || 0).toFixed(0)} g</td>
                      <td>{parseFloat(commande.prix_unitaire_kg || 0).toFixed(2)} €</td>
                      <td style={{ fontWeight: 'bold' }}>{parseFloat(commande.montant_total || 0).toFixed(2)} €</td>
                      <td>
                        <span style={{
                          padding: '0.25rem 0.75rem',
                          borderRadius: '12px',
                          fontSize: '0.85rem',
                          fontWeight: '500',
                          background: statutStyle.background,
                          color: statutStyle.color,
                          border: `1px solid ${statutStyle.border}`
                        }}>
                          {commande.statut}
                        </span>
                      </td>
                      <td>
                        <button className="btn btn-secondary" onClick={() => handleEditCommande(commande)} style={{ marginRight: '0.5rem', padding: '0.4rem 0.8rem' }}>✏️</button>
                        <button className="btn btn-danger" onClick={() => askDeleteCommande(commande)} style={{ padding: '0.4rem 0.8rem' }}>🗑️</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </>
      )}

      {/* ======================= CONTENU VENTES ======================= */}
      {activeTab === 'ventes' && (
        <>
          {/* Statistiques ventes */}
          <div className="stats-grid" style={{ marginBottom: '1.5rem' }}>
            <div className="stat-card">
              <div className="stat-label">Total ventes</div>
              <div className="stat-value">{statsVentes.total}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Payées</div>
              <div className="stat-value" style={{ color: '#27ae60' }}>{statsVentes.payees}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">En attente</div>
              <div className="stat-value" style={{ color: '#f39c12' }}>{statsVentes.enAttente}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">CA (payées)</div>
              <div className="stat-value">{statsVentes.chiffreAffaires.toFixed(2)} €</div>
            </div>
          </div>

          {/* Filtres et boutons ventes */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {['all', 'En attente', 'Payée', 'Annulée'].map(statut => (
                <button
                  key={statut}
                  className={`btn ${filterStatutVente === statut ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setFilterStatutVente(statut)}
                  style={{ padding: '0.5rem 1rem' }}
                >
                  {statut === 'all' ? 'Tous' : statut}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className="btn btn-secondary" onClick={() => setShowImportModal(true)}>📤 Importer CSV</button>
              <button className="btn btn-secondary" onClick={() => exportVentesPDF(filteredVentes, clients, colonnesExportVentes)}>🔄 Export PDF</button>
              <button className="btn btn-primary" onClick={openNewVenteModal}>➕ Nouvelle vente</button>
            </div>
          </div>

          {/* Liste ventes */}
          {filteredVentes.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">💰</div>
              <p>Aucune vente trouvée</p>
              <button className="btn btn-primary" onClick={openNewVenteModal} style={{ marginTop: '1rem' }}>Enregistrer une vente</button>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>N° Facture</th>
                  <th>Date</th>
                  <th>Client</th>
                  <th>Quantité</th>
                  <th>Prix/kg</th>
                  <th>Total</th>
                  <th>Paiement</th>
                  <th>Statut</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredVentes.map(vente => {
                  const statutStyle = STATUT_COLORS_VENTES[vente.statut] || {};
                  return (
                    <tr key={vente.id}>
                      <td><strong>{vente.numero_facture || '-'}</strong></td>
                      <td>{new Date(vente.date_vente).toLocaleDateString('fr-FR')}</td>
                      <td>{getClientName(vente.client_id)}</td>
                      <td>{parseFloat(vente.quantite_grammes || 0).toFixed(0)} g</td>
                      <td>{parseFloat(vente.prix_unitaire_kg || 0).toFixed(2)} €</td>
                      <td style={{ fontWeight: 'bold' }}>{parseFloat(vente.montant_total || 0).toFixed(2)} €</td>
                      <td>{vente.mode_paiement || '-'}</td>
                      <td>
                        <span style={{
                          padding: '0.25rem 0.75rem',
                          borderRadius: '12px',
                          fontSize: '0.85rem',
                          fontWeight: '500',
                          background: statutStyle.background,
                          color: statutStyle.color,
                          border: `1px solid ${statutStyle.border}`
                        }}>
                          {vente.statut}
                        </span>
                      </td>
                      <td>
                        <button className="btn btn-secondary" onClick={() => handleEditVente(vente)} style={{ marginRight: '0.5rem', padding: '0.4rem 0.8rem' }}>✏️</button>
                        <button className="btn btn-danger" onClick={() => askDeleteVente(vente)} style={{ padding: '0.4rem 0.8rem' }}>🗑️</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </>
      )}

      {/* ======================= MODALS ======================= */}

      {/* Modal création/édition client */}
      {showClientModal && (
        <div className="modal-overlay" onClick={closeClientModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '700px' }}>
            <div className="modal-header">
              <h3>{editingClient ? 'Modifier le client' : 'Nouveau client'}</h3>
              <button className="modal-close" onClick={closeClientModal}>✕</button>
            </div>
            <form onSubmit={handleClientSubmit}>
              <div className="form-group">
                <label>Type *</label>
                <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                  {['Particulier', 'Restaurant', 'Grossiste'].map(type => (
                    <label key={type} style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                      <input type="radio" name="type" value={type} checked={clientFormData.type === type} onChange={handleClientFormChange} style={{ marginRight: '0.5rem' }} />
                      <span>{type}</span>
                    </label>
                  ))}
                </div>
              </div>
              {clientFormData.type === 'Particulier' ? (
                <div className="form-grid">
                  <div className="form-group"><label>Nom *</label><input type="text" name="nom" value={clientFormData.nom} onChange={handleClientFormChange} required /></div>
                  <div className="form-group"><label>Prénom</label><input type="text" name="prenom" value={clientFormData.prenom} onChange={handleClientFormChange} /></div>
                </div>
              ) : (
                <div className="form-grid">
                  <div className="form-group"><label>Raison sociale *</label><input type="text" name="raison_sociale" value={clientFormData.raison_sociale} onChange={handleClientFormChange} required /></div>
                  <div className="form-group"><label>Contact</label><input type="text" name="nom" value={clientFormData.nom} onChange={handleClientFormChange} /></div>
                  <div className="form-group"><label>SIRET</label><input type="text" name="siret" value={clientFormData.siret} onChange={handleClientFormChange} maxLength="14" /></div>
                </div>
              )}
              <div className="form-grid">
                <div className="form-group"><label>Email</label><input type="email" name="email" value={clientFormData.email} onChange={handleClientFormChange} /></div>
                <div className="form-group"><label>Téléphone</label><input type="tel" name="telephone" value={clientFormData.telephone} onChange={handleClientFormChange} /></div>
              </div>
              <div className="form-group"><label>Adresse</label><input type="text" name="adresse" value={clientFormData.adresse} onChange={handleClientFormChange} /></div>
              <div className="form-grid">
                <div className="form-group"><label>Code postal</label><input type="text" name="code_postal" value={clientFormData.code_postal} onChange={handleClientFormChange} maxLength="5" /></div>
                <div className="form-group"><label>Ville</label><input type="text" name="ville" value={clientFormData.ville} onChange={handleClientFormChange} /></div>
                <div className="form-group"><label>Pays</label><input type="text" name="pays" value={clientFormData.pays} onChange={handleClientFormChange} /></div>
              </div>
              <div className="form-group"><label>Notes</label><textarea name="notes" value={clientFormData.notes} onChange={handleClientFormChange} rows="3" /></div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={closeClientModal}>Annuler</button>
                <button type="submit" className="btn btn-primary" disabled={isProcessing}>
                  {isProcessing ? 'En cours...' : (editingClient ? 'Mettre à jour' : 'Créer')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal des transactions client */}
      {showTransactionsModal && selectedClientForTransactions && (
        <div className="modal-overlay" onClick={() => setShowTransactionsModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '800px', maxHeight: '80vh', overflow: 'auto' }}>
            <div className="modal-header">
              <h3>
                📊 Transactions de {selectedClientForTransactions.type === 'Particulier' 
                  ? `${selectedClientForTransactions.nom} ${selectedClientForTransactions.prenom || ''}` 
                  : selectedClientForTransactions.raison_sociale || selectedClientForTransactions.nom}
              </h3>
              <button className="modal-close" onClick={() => setShowTransactionsModal(false)}>✕</button>
            </div>

            <div style={{ padding: '1rem' }}>
              {/* Résumé */}
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
                gap: '1rem', 
                marginBottom: '1.5rem' 
              }}>
                <div style={{ background: '#e3f2fd', padding: '1rem', borderRadius: '8px', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.9rem', color: '#1565c0' }}>📦 Commandes</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{clientTransactions.commandes.length}</div>
                  <div style={{ fontSize: '1rem', color: '#27ae60' }}>
                    {clientTransactions.commandes.reduce((sum, c) => sum + parseFloat(c.montant_total || 0), 0).toFixed(2)} €
                  </div>
                </div>
                <div style={{ background: '#e8f5e9', padding: '1rem', borderRadius: '8px', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.9rem', color: '#2e7d32' }}>💰 Ventes</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{clientTransactions.ventes.length}</div>
                  <div style={{ fontSize: '1rem', color: '#27ae60' }}>
                    {clientTransactions.ventes.reduce((sum, v) => sum + parseFloat(v.montant_total || 0), 0).toFixed(2)} €
                  </div>
                </div>
              </div>

              {/* Commandes */}
              <h4 style={{ color: '#2c5f2d', marginBottom: '0.5rem' }}>📦 Commandes ({clientTransactions.commandes.length})</h4>
              {clientTransactions.commandes.length === 0 ? (
                <p style={{ color: '#888', fontStyle: 'italic' }}>Aucune commande</p>
              ) : (
                <table style={{ marginBottom: '1.5rem' }}>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>N° Commande</th>
                      <th>Quantité</th>
                      <th>Montant</th>
                      <th>Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clientTransactions.commandes.slice(0, 10).map(cmd => (
                      <tr key={cmd.id}>
                        <td>{new Date(cmd.date_commande).toLocaleDateString('fr-FR')}</td>
                        <td>{cmd.numero_commande}</td>
                        <td>{parseFloat(cmd.poids_grammes || 0).toFixed(0)} g</td>
                        <td style={{ fontWeight: 'bold' }}>{parseFloat(cmd.montant_total || 0).toFixed(2)} €</td>
                        <td>{cmd.statut}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {/* Ventes */}
              <h4 style={{ color: '#2c5f2d', marginBottom: '0.5rem' }}>💰 Ventes ({clientTransactions.ventes.length})</h4>
              {clientTransactions.ventes.length === 0 ? (
                <p style={{ color: '#888', fontStyle: 'italic' }}>Aucune vente</p>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>N° Facture</th>
                      <th>Quantité</th>
                      <th>Montant</th>
                      <th>Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clientTransactions.ventes.slice(0, 10).map(vente => (
                      <tr key={vente.id}>
                        <td>{new Date(vente.date_vente).toLocaleDateString('fr-FR')}</td>
                        <td>{vente.numero_facture || '-'}</td>
                        <td>{parseFloat(vente.quantite_grammes || 0).toFixed(0)} g</td>
                        <td style={{ fontWeight: 'bold' }}>{parseFloat(vente.montant_total || 0).toFixed(2)} €</td>
                        <td>{vente.statut}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="modal-footer">
              <button className="btn btn-primary" onClick={() => setShowTransactionsModal(false)}>Fermer</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal commande */}
      {showCommandeModal && (
        <div className="modal-overlay" onClick={closeCommandeModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '700px' }}>
            <div className="modal-header">
              <h3>{editingCommande ? 'Modifier la commande' : 'Nouvelle commande'}</h3>
              <button className="modal-close" onClick={closeCommandeModal}>✕</button>
            </div>
            
            <form onSubmit={handleCommandeSubmit}>
              <h4 style={{ color: '#2c5f2d', marginBottom: '1rem', borderBottom: '2px solid #e0e0e0', paddingBottom: '0.5rem' }}>👤 Client</h4>
              <div className="form-group">
                <label>Client</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <select name="client_id" value={commandeFormData.client_id} onChange={handleCommandeInputChange} style={{ flex: 1 }}>
                    <option value="">Sélectionner...</option>
                    {clients.map(client => (
                      <option key={client.id} value={client.id}>
                        {client.type === 'Particulier' ? `${client.nom} ${client.prenom || ''}` : client.raison_sociale || client.nom}
                      </option>
                    ))}
                  </select>
                  <button type="button" className="btn btn-secondary" onClick={() => setShowQuickClientModal(true)} style={{ padding: '0.5rem 0.75rem' }}>➕</button>
                </div>
              </div>

              <h4 style={{ color: '#2c5f2d', marginTop: '1.5rem', marginBottom: '1rem', borderBottom: '2px solid #e0e0e0', paddingBottom: '0.5rem' }}>📦 Dates</h4>
              <div className="form-grid">
                <div className="form-group">
                  <label>Date de commande *</label>
                  <input type="date" name="date_commande" value={commandeFormData.date_commande} onChange={handleCommandeInputChange} required />
                </div>
                <div className="form-group">
                  <label>Date de livraison souhaitée</label>
                  <input type="date" name="date_livraison_demandee" value={commandeFormData.date_livraison_demandee} onChange={handleCommandeInputChange} />
                </div>
              </div>

              <h4 style={{ color: '#2c5f2d', marginTop: '1.5rem', marginBottom: '1rem', borderBottom: '2px solid #e0e0e0', paddingBottom: '0.5rem' }}>🍄 Produit</h4>
              <div className="form-grid">
                <div className="form-group">
                  <label>Quantité (g) *</label>
                  <input type="number" name="poids_grammes" value={commandeFormData.poids_grammes} onChange={handleCommandeInputChange} step="0.1" required />
                </div>
                <div className="form-group">
                  <label>Calibre</label>
                  <select name="calibre" value={commandeFormData.calibre} onChange={handleCommandeInputChange}>
                    <option value="">Indifférent</option>
                    <option value="Petit">Petit (&lt;20g)</option>
                    <option value="Moyen">Moyen (20-50g)</option>
                    <option value="Gros">Gros (&gt;50g)</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Qualité</label>
                  <select name="qualite" value={commandeFormData.qualite} onChange={handleCommandeInputChange}>
                    <option value="">Indifférent</option>
                    <option value="Extra">Extra</option>
                    <option value="1ère catégorie">1ère catégorie</option>
                    <option value="2ème catégorie">2ème catégorie</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Maturité</label>
                  <select name="maturite" value={commandeFormData.maturite} onChange={handleCommandeInputChange}>
                    <option value="">Indifférent</option>
                    <option value="Jeune">Jeune</option>
                    <option value="Mature">Mature</option>
                    <option value="Très mûre">Très mûre</option>
                  </select>
                </div>
              </div>

              <h4 style={{ color: '#2c5f2d', marginTop: '1.5rem', marginBottom: '1rem', borderBottom: '2px solid #e0e0e0', paddingBottom: '0.5rem' }}>💶 Tarification</h4>
              <div className="form-grid">
                <div className="form-group">
                  <label>Prix/kg (€) *</label>
                  <input type="number" name="prix_unitaire_kg" value={commandeFormData.prix_unitaire_kg} onChange={handleCommandeInputChange} step="0.01" required />
                </div>
                <div className="form-group">
                  <label>Total TTC</label>
                  <input type="text" value={`${montantCalculeCommande()} €`} disabled style={{ background: '#f0f7f0', fontWeight: 'bold', color: '#27ae60' }} />
                </div>
                <div className="form-group">
                  <label>Statut *</label>
                  <select name="statut" value={commandeFormData.statut} onChange={handleCommandeInputChange} required>
                    <option value="En attente">En attente</option>
                    <option value="Confirmée">Confirmée</option>
                    <option value="En préparation">En préparation</option>
                    <option value="Livrée">Livrée</option>
                    <option value="Annulée">Annulée</option>
                  </select>
                </div>
              </div>

              <div className="form-group" style={{ marginTop: '1rem' }}>
                <label>Notes</label>
                <textarea name="notes" value={commandeFormData.notes} onChange={handleCommandeInputChange} rows="3" />
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={closeCommandeModal}>Annuler</button>
                <button type="submit" className="btn btn-primary" disabled={isProcessing}>
                  {isProcessing ? 'En cours...' : (editingCommande ? 'Mettre à jour' : 'Enregistrer')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal vente */}
      {showVenteModal && (
        <div className="modal-overlay" onClick={closeVenteModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '700px' }}>
            <div className="modal-header">
              <h3>{editingVente ? 'Modifier la vente' : 'Nouvelle vente'}</h3>
              <button className="modal-close" onClick={closeVenteModal}>✕</button>
            </div>
            
            <form onSubmit={handleVenteSubmit}>
              <h4 style={{ color: '#2c5f2d', marginBottom: '1rem', borderBottom: '2px solid #e0e0e0', paddingBottom: '0.5rem' }}>👤 Client</h4>
              <div className="form-group">
                <label>Client *</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <select name="client_id" value={venteFormData.client_id} onChange={handleVenteInputChange} required style={{ flex: 1 }}>
                    <option value="">Sélectionner...</option>
                    {clients.map(client => (
                      <option key={client.id} value={client.id}>
                        {client.type === 'Particulier' ? `${client.nom} ${client.prenom || ''}` : client.raison_sociale || client.nom}
                      </option>
                    ))}
                  </select>
                  <button type="button" className="btn btn-secondary" onClick={() => setShowQuickClientModal(true)} style={{ padding: '0.5rem 0.75rem' }}>➕</button>
                </div>
              </div>
              
              <h4 style={{ color: '#2c5f2d', marginTop: '1.5rem', marginBottom: '1rem', borderBottom: '2px solid #e0e0e0', paddingBottom: '0.5rem' }}>🍄 Récolte</h4>
              
              <div className="form-group">
                <label>Récolte associée * <span style={{ color: '#e74c3c', fontSize: '0.85rem' }}>(obligatoire)</span></label>
                <select name="recolte_id" value={venteFormData.recolte_id} onChange={handleVenteInputChange} required>
                  <option value="">Sélectionner une récolte...</option>
                  {getFilteredRecoltes().sort((a, b) => new Date(b.date_recolte) - new Date(a.date_recolte)).map(r => {
                    const arbre = arbres.find(a => a.id === r.arbre_id);
                    return (
                      <option key={r.id} value={r.id}>
                        {new Date(r.date_recolte).toLocaleDateString('fr-FR')} - {parseFloat(r.poids_grammes).toFixed(0)}g
                        {arbre && ` - ${arbre.numero}`}
                      </option>
                    );
                  })}
                </select>
              </div>
              
              <div className="form-grid">
                <div className="form-group">
                  <label>Date de vente *</label>
                  <input type="date" name="date_vente" value={venteFormData.date_vente} onChange={handleVenteInputChange} required />
                </div>
                
                <div className="form-group">
                  <label>N° Facture</label>
                  <input 
                    type="text" 
                    name="numero_facture" 
                    value={venteFormData.numero_facture} 
                    onChange={handleVenteInputChange} 
                    placeholder="FACT-2025-001" 
                  />
                </div>
              </div>
              
              <h4 style={{ color: '#2c5f2d', marginTop: '1.5rem', marginBottom: '1rem', borderBottom: '2px solid #e0e0e0', paddingBottom: '0.5rem' }}>💶 Montant</h4>
              <div className="form-grid">
                <div className="form-group">
                  <label>Quantité (g) *</label>
                  <input type="number" name="quantite_grammes" value={venteFormData.quantite_grammes} onChange={handleVenteInputChange} step="0.1" required />
                </div>
                <div className="form-group">
                  <label>Prix/kg (€) *</label>
                  <input type="number" name="prix_unitaire_kg" value={venteFormData.prix_unitaire_kg} onChange={handleVenteInputChange} step="0.01" required />
                </div>
                <div className="form-group">
                  <label>Total TTC</label>
                  <input type="text" value={`${montantCalculeVente()} €`} disabled style={{ background: '#f0f7f0', fontWeight: 'bold', color: '#27ae60' }} />
                </div>
              </div>
              
              <h4 style={{ color: '#2c5f2d', marginTop: '1.5rem', marginBottom: '1rem', borderBottom: '2px solid #e0e0e0', paddingBottom: '0.5rem' }}>💳 Paiement</h4>
              <div className="form-grid">
                <div className="form-group">
                  <label>Mode de paiement</label>
                  <select name="mode_paiement" value={venteFormData.mode_paiement} onChange={handleVenteInputChange}>
                    <option value="">Sélectionner...</option>
                    <option value="Espèces">💵 Espèces</option>
                    <option value="Chèque">📝 Chèque</option>
                    <option value="Virement">🏦 Virement</option>
                    <option value="CB">💳 Carte bancaire</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Statut *</label>
                  <select name="statut" value={venteFormData.statut} onChange={handleVenteInputChange} required>
                    <option value="En attente">En attente</option>
                    <option value="Payée">Payée</option>
                    <option value="Annulée">Annulée</option>
                  </select>
                </div>
              </div>
              
              <div className="form-group" style={{ marginTop: '1rem' }}>
                <label>Notes</label>
                <textarea name="notes" value={venteFormData.notes} onChange={handleVenteInputChange} rows="3" />
              </div>
              
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={closeVenteModal}>Annuler</button>
                <button type="submit" className="btn btn-primary" disabled={isProcessing}>
                  {isProcessing ? 'En cours...' : (editingVente ? 'Mettre à jour' : 'Enregistrer')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal création rapide client */}
      {showQuickClientModal && (
        <div className="modal-overlay" onClick={() => setShowQuickClientModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <div className="modal-header"><h3>➕ Nouveau client</h3><button className="modal-close" onClick={() => setShowQuickClientModal(false)}>✕</button></div>
            <form onSubmit={handleCreateQuickClient}>
              <div className="form-group">
                <label>Type *</label>
                <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                  {['Particulier', 'Restaurant', 'Grossiste'].map(type => (
                    <label key={type} style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                      <input type="radio" name="type" value={type} checked={newClientData.type === type} onChange={handleQuickClientInputChange} style={{ marginRight: '0.5rem' }} />{type}
                    </label>
                  ))}
                </div>
              </div>
              {newClientData.type === 'Particulier' ? (
                <div className="form-grid">
                  <div className="form-group"><label>Nom *</label><input type="text" name="nom" value={newClientData.nom} onChange={handleQuickClientInputChange} required /></div>
                  <div className="form-group"><label>Prénom</label><input type="text" name="prenom" value={newClientData.prenom} onChange={handleQuickClientInputChange} /></div>
                </div>
              ) : (
                <div className="form-grid">
                  <div className="form-group"><label>Raison sociale *</label><input type="text" name="raison_sociale" value={newClientData.raison_sociale} onChange={handleQuickClientInputChange} required /></div>
                  <div className="form-group"><label>Contact</label><input type="text" name="nom" value={newClientData.nom} onChange={handleQuickClientInputChange} /></div>
                </div>
              )}
              <div className="form-grid">
                <div className="form-group"><label>Email</label><input type="email" name="email" value={newClientData.email} onChange={handleQuickClientInputChange} /></div>
                <div className="form-group"><label>Téléphone</label><input type="tel" name="telephone" value={newClientData.telephone} onChange={handleQuickClientInputChange} /></div>
              </div>
              <div className="form-grid">
                <div className="form-group"><label>Ville</label><input type="text" name="ville" value={newClientData.ville} onChange={handleQuickClientInputChange} /></div>
                <div className="form-group"><label>Code postal</label><input type="text" name="code_postal" value={newClientData.code_postal} onChange={handleQuickClientInputChange} maxLength="5" /></div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowQuickClientModal(false)}>Annuler</button>
                <button type="submit" className="btn btn-primary" disabled={isProcessing}>{isProcessing ? 'En cours...' : 'Créer'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modals d'import CSV */}
      <CSVImportModal show={showImportModal} onClose={() => setShowImportModal(false)} onImport={handleImportVentesCSV} validateFunction={validateVentesCSV} type="ventes" title="Importer des ventes" dependencies={{ clients }} />
      <CSVImportModal show={showClientImportModal} onClose={() => setShowClientImportModal(false)} onImport={handleImportClientsCSV} validateFunction={validateClientsCSV} type="clients" title="Importer des clients" />
    </div>
  );
}

export default Commercial;
