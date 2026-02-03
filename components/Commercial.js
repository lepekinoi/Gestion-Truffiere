// ============================================================
// Commercial.js - Module CRM Complet avec Améliorations
// Version: 2.0 FINALE CORRIGÉE ET COMPLÈTE
// Date: 18 janvier 2026
// Status: ✅ PRÊT À UTILISER
// ============================================================

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { exportCommandesPDF, exportVentesPDF, exportClientsPDF } from '../utils/pdfExport';
import { validateVentesCSV, validateClientsCSV } from '../utils/csvImport';
import CSVImportModal from './CSVImportModal';
import { useColumnSettings, COLONNES_CONFIG } from '../hooks/useColumnSettings';

// Imports Phase 2 - Composants UI
import StatsCard from './Commercial/components/StatsCard';
import StatusBadge from './Commercial/components/StatusBadge';
import PaginationControlsComponent from './Commercial/components/PaginationControls';
import ClientTile from './Commercial/components/ClientTile';
import { 
  STATUT_COLORS_COMMANDES as STATUT_COLORS_CMD, 
  STATUT_COLORS_VENTES as STATUT_COLORS_VT 
} from './Commercial/utils/constants';

// Hooks personnalisés
import { useClients } from '../hooks/useClients';
import { useCommandes } from '../hooks/useCommandes';
import { useVentes } from '../hooks/useVentes';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

// ============================================================
// CONFIGURATION
// ============================================================

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

const COLORS_PIE_CHART = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];
const TVA_RATE = 0.055;

// Types de clients avec emojis
const CLIENT_TYPES = {
  'Particulier': '👤',
  'Restaurant': '🍽️',
  'Grossiste': '📦',
  'Association': '🤝'
};

// ============================================================
// COMPOSANT PRINCIPAL
// ============================================================

function Commercial() {
  // ==================== ÉTATS ====================
  const [activeTab, setActiveTab] = useState('clients');
  
  // États clients
  const [clients, setClients] = useState([]);
  const [statsParType, setStatsParType] = useState([]);
  
  // États commandes
  const [commandes, setCommandes] = useState([]);

  
  // États ventes
  const [ventes, setVentes] = useState([]);
  const [showImportModal, setShowImportModal] = useState(false);

  const [filterRecolte, setFilterRecolte] = useState({ type: 'all', value: '' });
  
  // États généraux
  const [loading, setLoading] = useState(true);
  const [recoltes, setRecoltes] = useState([]);
  const [arbres, setArbres] = useState([]);
  const [showQuickClientModal, setShowQuickClientModal] = useState(false);
  const [message, setMessage] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [confirmModal, setConfirmModal] = useState(null);
  
  // ANALYTICS
  const [analyticsData, setAnalyticsData] = useState({
    caParMois: [],
    caParClient: [],
    ventesParStatut: [],
    commandesParStatut: [],
    topClients: []
  });
  
  
  const [newClientData, setNewClientData] = useState({
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
  
  // Custom hooks
  const { colonnesAffichees: colonnesClients, colonnesExport: colonnesExportClients, loading: loadingClientsSettings } = useColumnSettings('clients');
  const { colonnesAffichees: colonnesVentes, colonnesExport: colonnesExportVentes, loading: loadingVentesSettings } = useColumnSettings('ventes');
  
  // ==================== EFFECTS ====================
  
  useEffect(() => {
    loadData();
  }, []);
  
  useEffect(() => {
    if (ventes.length > 0 || commandes.length > 0) {
      calculateAnalytics();
    }
  }, [ventes, commandes, clients]);
  
  // ==================== FONCTIONS UTILITAIRES ====================
  
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
  
  const getClientName = (clientId) => {
    const client = clients.find(c => c.id === clientId);
    if (!client) return '-';
    return client.type === 'Particulier'
      ? `${client.nom} ${client.prenom || ''}`
      : client.raison_sociale || client.nom;
  };
  
    // ✅ Hook Clients
const {
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
  
  // Setters
  setFilterTypeClient,
  setSearchTermClient,
  setCurrentPageClients,
  setItemsPerPageClients,
  setShowTransactionsModal,
  
  // Fonctions
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
} = useClients({ 
  showMessage, 
  loadData, 
  setConfirmModal, 
  setIsProcessing 
});

// ==================== HOOK COMMANDES ====================
const {
  // États
  showCommandeModal,
  editingCommande,
  filterStatutCommande,
  commandeFormData,
  currentPageCommandes,
  itemsPerPageCommandes,
  sortConfigCommandes,
  
  // Setters
  setFilterStatutCommande,
  setCurrentPageCommandes,
  setCommandeFormData,
  
  // Fonctions
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
  resetFilters: resetFiltersCommandes
} = useCommandes({ 
  showMessage, 
  loadData, 
  setConfirmModal, 
  setIsProcessing,
  commandes
});

// ==================== HOOK VENTES ====================
const {
  // États
  showVenteModal,
  editingVente,
  filterStatutVente,
  filterTypeVente,
  venteFormData,
  currentPageVentes,
  itemsPerPageVentes,
  sortConfigVentes,
  
  // Setters
  setFilterStatutVente,
  setFilterTypeVente,
  setCurrentPageVentes,
  setItemsPerPageVentes,
  setVenteFormData,
  
  // Fonctions
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
  resetFilters: resetFiltersVentes
} = useVentes({ 
  showMessage, 
  loadData, 
  setConfirmModal, 
  setIsProcessing,
  ventes
});
  
  // ==================== ANALYTICS AVEC SAISON TRUFFE ====================
  
  const calculateAnalytics = () => {
    // Calcul de la saison de truffe (juin à juin)
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth();
    
    // Déterminer l'année de la saison actuelle
    let seasonStartYear;
    if (currentMonth >= 5) { // À partir de juin (mois 5)
      seasonStartYear = currentYear;
    } else {
      seasonStartYear = currentYear - 1;
    }
    
    const caParMois = {};
    
    // Créer 12 mois de saison (juin année N à juin année N+1)
    for (let i = 0; i < 12; i++) {
      const monthDate = new Date(seasonStartYear, 5 + i, 1); // Commence à juin (mois 5)
      const key = monthDate.toISOString().slice(0, 7); // YYYY-MM
      caParMois[key] = 0;
    }
    
    // Remplir avec les ventes payées
    ventes
      .filter(v => v.statut === 'Payée')
      .forEach(v => {
        const month = new Date(v.date_vente).toISOString().slice(0, 7);
        if (caParMois.hasOwnProperty(month)) {
          caParMois[month] += parseFloat(v.montant_total || 0);
        }
      });
    
    // Convertir en array trié chronologiquement
    const caParMoisArray = Object.entries(caParMois)
      .map(([month, ca]) => ({
        mois: new Date(month + '-01').toLocaleDateString('fr-FR', {
          month: 'short',
          year: 'numeric'
        }),
        ca: parseFloat(ca.toFixed(2))
      }));
    
    // CA par client
    const caParClient = {};
    ventes
      .filter(v => v.statut === 'Payée')
      .forEach(v => {
        const clientName = getClientName(v.client_id);
        caParClient[clientName] = caParClient[clientName] || 0;
        caParClient[clientName] += parseFloat(v.montant_total || 0);
      });
    
    const topClients = Object.entries(caParClient)
      .map(([client, ca]) => ({
        client,
        ca: parseFloat(ca.toFixed(2))
      }))
      .sort((a, b) => b.ca - a.ca)
      .slice(0, 10);
    
    // Ventes par statut
    const ventesParStatut = Object.entries(
      ventes.reduce((acc, v) => {
        acc[v.statut] = (acc[v.statut] || 0) + 1;
        return acc;
      }, {})
    ).map(([statut, count]) => ({ statut, count }));
    
    // Commandes par statut
    const commandesParStatut = Object.entries(
      commandes.reduce((acc, c) => {
        acc[c.statut] = (acc[c.statut] || 0) + 1;
        return acc;
      }, {})
    ).map(([statut, count]) => ({ statut, count }));
    
    setAnalyticsData({
      caParMois: caParMoisArray,
      topClients,
      ventesParStatut,
      commandesParStatut
    });
  };
  
  // ==================== FONCTIONS PARTAGÉES ====================
  
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
  
  // ==================== TRI & PAGINATION ====================
  
  const handleSort = (key, entity) => {
    let config, setConfig;
    if (entity === 'clients') {
      handleSortClients(key);
    } else if (entity === 'commandes') {
      handleSortCommandes(key); 
    } else {
      handleSortVentes(key);
    }
    
    setConfig({
      key,
      direction: config.key === key && config.direction === 'asc' ? 'desc' : 'asc'
    });
  };
  
  const sortData = (data, config) => {
    if (!config.key) return data;
    
    return [...data].sort((a, b) => {
      let aValue = a[config.key];
      let bValue = b[config.key];
      
      if (config.key.includes('date')) {
        aValue = new Date(aValue || 0);
        bValue = new Date(bValue || 0);
      }
      
      if (typeof aValue === 'number' || !isNaN(parseFloat(aValue))) {
        aValue = parseFloat(aValue || 0);
        bValue = parseFloat(bValue || 0);
      }
      
      if (aValue < bValue) return config.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return config.direction === 'asc' ? 1 : -1;
      return 0;
    });
  };
  
  const paginate = (data, currentPage, itemsPerPage) => {
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  return data.slice(startIndex, endIndex);
};
  
  const getTotalPages = (dataLength, itemsPerPage) => {
    return Math.ceil(dataLength / itemsPerPage);
  };
  
// Alias pour compatibilité
const PaginationControls = PaginationControlsComponent;

  
  // ==================== FILTRAGE ====================
  
  const filteredClients = clients.filter(client => {
    const matchType = filterTypeClient === 'all' || client.type === filterTypeClient;
    const searchLower = searchTermClient.toLowerCase();
    const matchSearch = !searchTermClient ||
      client.nom?.toLowerCase().includes(searchLower) ||
      client.prenom?.toLowerCase().includes(searchLower) ||
      client.raison_sociale?.toLowerCase().includes(searchLower) ||
      client.email?.toLowerCase().includes(searchLower) ||
      client.ville?.toLowerCase().includes(searchLower);
    return matchType && matchSearch;
  });
  
  const filteredCommandes = commandes.filter(c =>
    filterStatutCommande === 'all' || c.statut === filterStatutCommande
  );
  
  const filteredVentes = ventes.filter(v => {
    const matchStatut = filterStatutVente === 'all' || v.statut === filterStatutVente;
    const client = clients.find(c => c.id === v.client_id);
    const matchType = filterTypeVente === 'all' || (client && client.type === filterTypeVente);
    return matchStatut && matchType;
  });
  
  const sortedClients = sortData(filteredClients, sortConfigClients);
  const sortedCommandes = sortData(filteredCommandes, sortConfigCommandes);
  const sortedVentes = sortData(filteredVentes, sortConfigVentes);
  
  const paginatedClients = paginate(sortedClients, currentPageClients, itemsPerPageClients);
  const paginatedCommandes = paginate(sortedCommandes, currentPageCommandes, 50);
  const paginatedVentes = paginate(sortedVentes, currentPageVentes, itemsPerPageVentes);
  
  // ==================== STATISTIQUES ====================
  
  const statsClients = {
    total: clients.length,
    particuliers: clients.filter(c => c.type === 'Particulier').length,
    restaurants: clients.filter(c => c.type === 'Restaurant').length,
    grossistes: clients.filter(c => c.type === 'Grossiste').length,
    associations: clients.filter(c => c.type === 'Association').length
  };
  
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
    chiffreAffaires: ventes
      .filter(v => v.statut === 'Payée')
      .reduce((sum, v) => sum + parseFloat(v.montant_total || 0), 0)
  };
  
  // ==================== LOADING ====================
  
  if (loading || loadingClientsSettings || loadingVentesSettings) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
        <div>Chargement des données commerciales...</div>
      </div>
    );
  }
  
  // ==================== RENDER ====================
  
  return (
    <div className="commercial-container" style={{ padding: '20px', maxWidth: '1600px', margin: '0 auto' }}>
      {/* MESSAGE DE NOTIFICATION */}
      {message && (
        <div
          style={{
            position: 'fixed',
            top: '20px',
            right: '20px',
            zIndex: 10000,
            background: message.type === 'success' ? '#4caf50' : message.type === 'error' ? '#f44336' : '#ff9800',
            color: 'white',
            padding: '15px 20px',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
            animation: 'slideIn 0.3s ease-out'
          }}
        >
          {message.text}
        </div>
      )}
      
      {/* MODAL DE CONFIRMATION */}
      {confirmModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999
        }}>
          <div style={{
            background: 'white',
            padding: '30px',
            borderRadius: '12px',
            maxWidth: '500px',
            width: '90%'
          }}>
            <h3 style={{ marginTop: 0 }}>{confirmModal.title}</h3>
            <p>{confirmModal.message}</p>
            <div style={{
              display: 'flex',
              gap: '10px',
              justifyContent: 'flex-end',
              marginTop: '20px'
            }}>
              <button
                onClick={() => setConfirmModal(null)}
                style={{
                  padding: '10px 20px',
                  border: '1px solid #ddd',
                  borderRadius: '6px',
                  background: 'white',
                  cursor: 'pointer'
                }}
              >
                Annuler
              </button>
              <button
                onClick={handleConfirm}
                disabled={isProcessing}
                style={{
                  padding: '10px 20px',
                  border: 'none',
                  borderRadius: '6px',
                  background: confirmModal.confirmColor || '#f44336',
                  color: 'white',
                  cursor: isProcessing ? 'not-allowed' : 'pointer',
                  opacity: isProcessing ? 0.7 : 1
                }}
              >
                {isProcessing ? 'Traitement...' : confirmModal.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* ONGLETS PRINCIPAUX */}
      <div style={{
        display: 'flex',
        gap: '10px',
        marginBottom: '30px',
        borderBottom: '2px solid #e0e0e0',
        paddingBottom: '15px',
        flexWrap: 'wrap'
      }}>
        <button
          onClick={() => setActiveTab('clients')}
          style={{
            padding: '12px 24px',
            border: 'none',
            borderBottom: activeTab === 'clients' ? '3px solid #2196f3' : 'none',
            background: activeTab === 'clients' ? '#e3f2fd' : 'transparent',
            color: activeTab === 'clients' ? '#1976d2' : '#666',
            fontWeight: activeTab === 'clients' ? 600 : 400,
            cursor: 'pointer',
            transition: 'all 0.3s'
          }}
        >
          👥 Clients ({statsClients.total})
        </button>
        
        <button
          onClick={() => setActiveTab('commandes')}
          style={{
            padding: '12px 24px',
            border: 'none',
            borderBottom: activeTab === 'commandes' ? '3px solid #2196f3' : 'none',
            background: activeTab === 'commandes' ? '#e3f2fd' : 'transparent',
            color: activeTab === 'commandes' ? '#1976d2' : '#666',
            fontWeight: activeTab === 'commandes' ? 600 : 400,
            cursor: 'pointer',
            transition: 'all 0.3s'
          }}
        >
          📋 Commandes ({statsCommandes.total})
        </button>
        
        <button
          onClick={() => setActiveTab('ventes')}
          style={{
            padding: '12px 24px',
            border: 'none',
            borderBottom: activeTab === 'ventes' ? '3px solid #2196f3' : 'none',
            background: activeTab === 'ventes' ? '#e3f2fd' : 'transparent',
            color: activeTab === 'ventes' ? '#1976d2' : '#666',
            fontWeight: activeTab === 'ventes' ? 600 : 400,
            cursor: 'pointer',
            transition: 'all 0.3s'
          }}
        >
          🛍️ Ventes ({statsVentes.total})
        </button>

        <button
          onClick={() => setActiveTab('statut')}
          style={{
            padding: '12px 24px',
            border: 'none',
            borderBottom: activeTab === 'statut' ? '3px solid #2196f3' : 'none',
            background: activeTab === 'statut' ? '#e3f2fd' : 'transparent',
            color: activeTab === 'statut' ? '#1976d2' : '#666',
            fontWeight: activeTab === 'statut' ? 600 : 400,
            cursor: 'pointer',
            transition: 'all 0.3s'
          }}
        >
          📊 Statuts
        </button>
        
        <button
          onClick={() => setActiveTab('analytics')}
          style={{
            padding: '12px 24px',
            border: 'none',
            borderBottom: activeTab === 'analytics' ? '3px solid #2196f3' : 'none',
            background: activeTab === 'analytics' ? '#e3f2fd' : 'transparent',
            color: activeTab === 'analytics' ? '#1976d2' : '#666',
            fontWeight: activeTab === 'analytics' ? 600 : 400,
            cursor: 'pointer',
            transition: 'all 0.3s'
          }}
        >
          📈 Analytics
        </button>
      </div>
      
      {/* ============================================================ */}
      {/* ONGLET CLIENTS */}
      {/* ============================================================ */}
      {activeTab === 'clients' && (
        <div>
         {/* STATS CLIENTS */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '15px',
            marginBottom: '30px'
          }}>
            <StatsCard 
              label="TOTAL"
              value={statsClients.total}
              color="#2196f3"
            />
            <StatsCard 
              label="👤 PARTICULIERS"
              value={statsClients.particuliers}
              color="#4caf50"
            />
            <StatsCard 
              label="🍽️ RESTAURANTS"
              value={statsClients.restaurants}
              color="#ff9800"
            />
            <StatsCard 
              label="📦 GROSSISTES"
              value={statsClients.grossistes}
              color="#9c27b0"
            />
          </div>
          
          {/* CONTRÔLES CLIENTS */}
          <div style={{
            display: 'flex',
            gap: '15px',
            marginBottom: '20px',
            flexWrap: 'wrap',
            alignItems: 'center'
          }}>
            <button
              onClick={openNewClientModal}
              style={{
                padding: '10px 20px',
                background: '#2196f3',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: 600
              }}
            >
              ➕ Nouveau Client
            </button>
            
            <select
              value={filterTypeClient}
              onChange={(e) => {
                setFilterTypeClient(e.target.value);
                setCurrentPageClients(1);
              }}
              style={{
                padding: '10px 15px',
                border: '1px solid #ddd',
                borderRadius: '6px'
              }}
            >
              <option value="all">Tous les types</option>
              <option value="Particulier">👤 Particuliers</option>
              <option value="Restaurant">🍽️ Restaurants</option>
              <option value="Grossiste">📦 Grossistes</option>
              <option value="Association">🤝 Associations</option>
            </select>
            
            <input
              type="text"
              placeholder="Rechercher un client..."
              value={searchTermClient}
              onChange={(e) => {
                setSearchTermClient(e.target.value);
                setCurrentPageClients(1);
              }}
              style={{
                padding: '10px 15px',
                border: '1px solid #ddd',
                borderRadius: '6px',
                flex: '1',
                minWidth: '200px'
              }}
            />
          </div>
          
          {/* TABLEAU CLIENTS AVEC TUILES */}
          <div style={{
            background: 'white',
            borderRadius: '8px',
            padding: '20px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            marginBottom: '20px'
          }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: '15px'
            }}>
              {paginatedClients.length === 0 ? (
                <div style={{ gridColumn: '1 / -1', padding: '40px', textAlign: 'center', color: '#999' }}>
                  Aucun client trouvé
                </div>
              ) : (
                paginatedClients.map((client, idx) => (
                  <div
                    key={idx}
                    onClick={() => viewClientTransactions(client)}
                    style={{
                      background: '#f8f9fa',
                      border: '1px solid #e0e0e0',
                      borderRadius: '8px',
                      padding: '15px',
                      cursor: 'pointer',
                      transition: 'all 0.3s',
                      ':hover': { boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
                      e.currentTarget.style.transform = 'translateY(-2px)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.boxShadow = 'none';
                      e.currentTarget.style.transform = 'translateY(0)';
                    }}
                  >
                    <div style={{ fontSize: '24px', marginBottom: '8px' }}>
                      {CLIENT_TYPES[client.type] || '👤'}
                    </div>
                    <div style={{ fontWeight: 'bold', fontSize: '14px', marginBottom: '8px', color: '#333' }}>
                      {client.type === 'Particulier'
                        ? `${client.nom} ${client.prenom || ''}`
                        : client.raison_sociale || client.nom}
                    </div>
                    <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>
                      <span style={{ display: 'inline-block', padding: '2px 6px', background: '#e3f2fd', borderRadius: '3px', marginBottom: '4px' }}>
                        {client.type}
                      </span>
                    </div>
                    {client.email && <div style={{ fontSize: '11px', color: '#666', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>📧 {client.email}</div>}
                    {client.telephone && <div style={{ fontSize: '11px', color: '#666' }}>📞 {client.telephone}</div>}
                    {client.ville && <div style={{ fontSize: '11px', color: '#666' }}>📍 {client.ville}</div>}
                    
                    <div style={{ marginTop: '12px', display: 'flex', gap: '6px' }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditClient(client);
                        }}
                        style={{
                          flex: 1,
                          padding: '6px 10px',
                          background: '#ff9800',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '11px',
                          fontWeight: '600'
                        }}
                      >
                        ✏️ Modifier
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          askDeleteClient(client);
                        }}
                        style={{
                          flex: 1,
                          padding: '6px 10px',
                          background: '#f44336',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '11px',
                          fontWeight: '600'
                        }}
                      >
                        🗑️ Supprimer
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
          
          {/* PAGINATION */}
          <PaginationControls
            currentPage={currentPageClients}
            setCurrentPage={setCurrentPageClients}
            totalItems={sortedClients.length}
            itemsPerPage={itemsPerPageClients}
            setItemsPerPage={setItemsPerPageClients}
            entity="clients"
          />
        </div>
      )}
      
      {/* ============================================================ */}
      {/* ONGLET COMMANDES */}
      {/* ============================================================ */}
      {activeTab === 'commandes' && (
        <div>
          {/* STATS COMMANDES */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '15px',
            marginBottom: '30px'
          }}>
            <StatsCard 
              label="TOTAL"
              value={statsCommandes.total}
              color="#2196f3"
            />
            <StatsCard 
              label="EN ATTENTE"
              value={statsCommandes.enAttente}
              color="#ff9800"
            />
            <StatsCard 
              label="LIVRÉES"
              value={statsCommandes.livrees}
              color="#4caf50"
            />
            <StatsCard 
              label="MONTANT TOTAL"
              value={`${statsCommandes.montantTotal.toFixed(2)} €`}
              color="#9c27b0"
            />
          </div>
          
          {/* CONTRÔLES COMMANDES */}
          <div style={{
            display: 'flex',
            gap: '15px',
            marginBottom: '20px',
            flexWrap: 'wrap',
            alignItems: 'center'
          }}>
            <button
              onClick={openNewCommandeModal}
              style={{
                padding: '10px 20px',
                background: '#2196f3',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: 600
              }}
            >
              ➕ Nouvelle Commande
            </button>
            
            <select
              value={filterStatutCommande}
              onChange={(e) => {
                setFilterStatutCommande(e.target.value);
                setCurrentPageCommandes(1);
              }}
              style={{
                padding: '10px 15px',
                border: '1px solid #ddd',
                borderRadius: '6px'
              }}
            >
              <option value="all">Tous les statuts</option>
              <option value="En attente">En attente</option>
              <option value="Confirmée">Confirmée</option>
              <option value="En préparation">En préparation</option>
              <option value="Livrée">Livrée</option>
              <option value="Annulée">Annulée</option>
            </select>
          </div>
          
          {/* TABLEAU COMMANDES */}
          <div style={{
            background: 'white',
            borderRadius: '8px',
            padding: '20px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            overflowX: 'auto'
          }}>
            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '14px'
            }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e0e0e0', backgroundColor: '#f8f8f8' }}>
                  <th
                    onClick={() => handleSort('numero_commande', 'commandes')}
                    style={{
                      padding: '12px',
                      textAlign: 'left',
                      fontWeight: 600,
                      cursor: 'pointer',
                      userSelect: 'none'
                    }}
                  >
                    N° Commande
                  </th>
                  <th
                    onClick={() => handleSort('date_commande', 'commandes')}
                    style={{
                      padding: '12px',
                      textAlign: 'left',
                      fontWeight: 600,
                      cursor: 'pointer',
                      userSelect: 'none'
                    }}
                  >
                    Date
                  </th>
                  <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600 }}>Client</th>
                  <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600 }}>Quantité</th>
                  <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600 }}>Prix/kg</th>
                  <th
                    onClick={() => handleSort('montant_total', 'commandes')}
                    style={{
                      padding: '12px',
                      textAlign: 'left',
                      fontWeight: 600,
                      cursor: 'pointer',
                      userSelect: 'none'
                    }}
                  >
                    Total
                  </th>
                  <th
                    onClick={() => handleSort('statut', 'commandes')}
                    style={{
                      padding: '12px',
                      textAlign: 'left',
                      fontWeight: 600,
                      cursor: 'pointer',
                      userSelect: 'none'
                    }}
                  >
                    Statut
                  </th>
                  <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedCommandes.length === 0 ? (
                  <tr>
                    <td colSpan="8" style={{ padding: '20px', textAlign: 'center', color: '#999' }}>
                      Aucune commande
                    </td>
                  </tr>
                ) : (
                  paginatedCommandes.map((commande, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #e0e0e0' }}>
                      <td style={{ padding: '12px', fontWeight: '500' }}>
                        {commande.numero_commande || `CMD-${commande.id}`}
                      </td>
                      <td style={{ padding: '12px', color: '#666' }}>
                        {new Date(commande.date_commande).toLocaleDateString('fr-FR')}
                      </td>
                      <td style={{ padding: '12px', color: '#666' }}>
                        {getClientName(commande.client_id)}
                      </td>
                      <td style={{ padding: '12px', color: '#666' }}>
                        {parseFloat(commande.poids_grammes || 0).toFixed(0)} g
                      </td>
                      <td style={{ padding: '12px', color: '#666' }}>
                        {parseFloat(commande.prix_unitaire_kg || 0).toFixed(2)} €
                      </td>
                      <td style={{ padding: '12px', fontWeight: '600' }}>
                        {parseFloat(commande.montant_total || 0).toFixed(2)} €
                      </td>
                      <td style={{ padding: '12px' }}>
                        <StatusBadge 
                          statut={commande.statut}
                          type="commande"
                        />
                      </td>
                      <td style={{ padding: '12px' }}>
                        <button
                          onClick={() => handleEditCommande(commande)}
                          style={{
                            marginRight: '10px',
                            padding: '6px 12px',
                            background: '#ff9800',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '12px'
                          }}
                        >
                          Modifier
                        </button>
                        <button
                          onClick={() => askDeleteCommande(commande)}
                          style={{
                            padding: '6px 12px',
                            background: '#f44336',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '12px'
                          }}
                        >
                          Supprimer
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          
          {/* PAGINATION */}
          <PaginationControls
            currentPage={currentPageCommandes}
            setCurrentPage={setCurrentPageCommandes}
            totalItems={sortedCommandes.length}
            itemsPerPage={50}
            setItemsPerPage={() => {}}
            entity="commandes"
          />
        </div>
      )}
      
      {/* ============================================================ */}
      {/* ONGLET VENTES */}
      {/* ============================================================ */}
      {activeTab === 'ventes' && (
        <div>
          {/* STATS VENTES */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '15px',
            marginBottom: '30px'
          }}>
            <StatsCard 
              label="TOTAL"
              value={statsVentes.total}
              color="#2196f3"
            />
            <StatsCard 
              label="PAYÉES"
              value={statsVentes.payees}
              color="#4caf50"
            />
            <StatsCard 
              label="EN ATTENTE"
              value={statsVentes.enAttente}
              color="#ff9800"
            />
            <StatsCard 
              label="CA"
              value={`${statsVentes.chiffreAffaires.toFixed(2)} €`}
              color="#9c27b0"
            />
          </div>
          
          {/* CONTRÔLES VENTES */}
          <div style={{
            display: 'flex',
            gap: '15px',
            marginBottom: '20px',
            flexWrap: 'wrap',
            alignItems: 'center'
          }}>
            <button
              onClick={openNewVenteModal}
              style={{
                padding: '10px 20px',
                background: '#2196f3',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: 600
              }}
            >
              ➕ Nouvelle Vente
            </button>
            
            <select
              value={filterStatutVente}
              onChange={(e) => {
                setFilterStatutVente(e.target.value);
                setCurrentPageVentes(1);
              }}
              style={{
                padding: '10px 15px',
                border: '1px solid #ddd',
                borderRadius: '6px'
              }}
            >
              <option value="all">Tous les statuts</option>
              <option value="En attente">En attente</option>
              <option value="Payée">Payée</option>
              <option value="Annulée">Annulée</option>
            </select>

            <select
              value={filterTypeVente}
              onChange={(e) => {
                setFilterTypeVente(e.target.value);
                setCurrentPageVentes(1);
              }}
              style={{
                padding: '10px 15px',
                border: '1px solid #ddd',
                borderRadius: '6px'
              }}
            >
              <option value="all">Tous les clients</option>
              <option value="Particulier">👤 Particuliers</option>
              <option value="Restaurant">🍽️ Restaurants</option>
              <option value="Grossiste">📦 Grossistes</option>
              <option value="Association">🤝 Associations</option>
            </select>
          </div>
          
          {/* TABLEAU VENTES */}
          <div style={{
            background: 'white',
            borderRadius: '8px',
            padding: '20px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            overflowX: 'auto'
          }}>
            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '14px'
            }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e0e0e0', backgroundColor: '#f8f8f8' }}>
                  <th
                    onClick={() => handleSort('numero_facture', 'ventes')}
                    style={{
                      padding: '12px',
                      textAlign: 'left',
                      fontWeight: 600,
                      cursor: 'pointer',
                      userSelect: 'none'
                    }}
                  >
                    N° Facture
                  </th>
                  <th
                    onClick={() => handleSort('date_vente', 'ventes')}
                    style={{
                      padding: '12px',
                      textAlign: 'left',
                      fontWeight: 600,
                      cursor: 'pointer',
                      userSelect: 'none'
                    }}
                  >
                    Date
                  </th>
                  <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600 }}>Client</th>
                  <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600 }}>Quantité</th>
                  <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600 }}>Prix/kg</th>
                  <th
                    onClick={() => handleSort('montant_total', 'ventes')}
                    style={{
                      padding: '12px',
                      textAlign: 'left',
                      fontWeight: 600,
                      cursor: 'pointer',
                      userSelect: 'none'
                    }}
                  >
                    Total
                  </th>
                  <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600 }}>Paiement</th>
                  <th
                    onClick={() => handleSort('statut', 'ventes')}
                    style={{
                      padding: '12px',
                      textAlign: 'left',
                      fontWeight: 600,
                      cursor: 'pointer',
                      userSelect: 'none'
                    }}
                  >
                    Statut
                  </th>
                  <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedVentes.length === 0 ? (
                  <tr>
                    <td colSpan="8" style={{ padding: '20px', textAlign: 'center', color: '#999' }}>
                      Aucune vente
                    </td>
                  </tr>
                ) : (
                  paginatedVentes.map((vente, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #e0e0e0' }}>
                      <td style={{ padding: '12px', fontWeight: '500' }}>
                        {vente.numero_facture || '-'}
                      </td>
                      <td style={{ padding: '12px', color: '#666' }}>
                        {new Date(vente.date_vente).toLocaleDateString('fr-FR')}
                      </td>
                      <td style={{ padding: '12px', color: '#666' }}>
                        {getClientName(vente.client_id)}
                      </td>
                      <td style={{ padding: '12px', color: '#666' }}>
                        {parseFloat(vente.quantite_grammes || 0).toFixed(0)} g
                      </td>
                      <td style={{ padding: '12px', color: '#666' }}>
                        {parseFloat(vente.prix_unitaire_kg || 0).toFixed(2)} €
                      </td>
                      <td style={{ padding: '12px', fontWeight: '600' }}>
                        {parseFloat(vente.montant_total || 0).toFixed(2)} €
                      </td>
                      <td style={{ padding: '12px', color: '#666' }}>
                        {vente.mode_paiement || '-'}
                      </td>
                      <td style={{ padding: '12px' }}>
                        <StatusBadge 
                          statut={vente.statut}
                          type="vente"
                        />
                      </td>
                      <td style={{ padding: '12px' }}>
                        <button
                          onClick={() => handleEditVente(vente)}
                          style={{
                            marginRight: '10px',
                            padding: '6px 12px',
                            background: '#ff9800',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '12px'
                          }}
                        >
                          Modifier
                        </button>
                        <button
                          onClick={() => askDeleteVente(vente)}
                          style={{
                            padding: '6px 12px',
                            background: '#f44336',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '12px'
                          }}
                        >
                          Supprimer
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          
          {/* PAGINATION */}
          <PaginationControls
            currentPage={currentPageVentes}
            setCurrentPage={setCurrentPageVentes}
            totalItems={sortedVentes.length}
            itemsPerPage={itemsPerPageVentes}
            setItemsPerPage={setItemsPerPageVentes}
            entity="ventes"
          />
        </div>
      )}

      {/* ============================================================ */}
      {/* ONGLET STATUT (nouveau) */}
      {/* ============================================================ */}
      {activeTab === 'statut' && (
        <div>
          <h2 style={{ marginTop: 0 }}>📊 Analyse par Statut</h2>
          
          {/* Ventes par statut */}
          <div style={{
            marginBottom: '40px',
            background: 'white',
            padding: '20px',
            borderRadius: '8px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
          }}>
            <h3 style={{ marginTop: 0, marginBottom: '20px' }}>🥧 Ventes par Statut</h3>
            {analyticsData.ventesParStatut && analyticsData.ventesParStatut.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={analyticsData.ventesParStatut}
                    dataKey="count"
                    nameKey="statut"
                    cx="50%"
                    cy="50%"
                    fill="#8884d8"
                    label
                  >
                    {analyticsData.ventesParStatut.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS_PIE_CHART[index % COLORS_PIE_CHART.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
                Aucune donnée disponible
              </div>
            )}
          </div>
          
          {/* Commandes par statut */}
          <div style={{
            background: 'white',
            padding: '20px',
            borderRadius: '8px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
          }}>
            <h3 style={{ marginTop: 0, marginBottom: '20px' }}>📦 Commandes par Statut</h3>
            {analyticsData.commandesParStatut && analyticsData.commandesParStatut.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={analyticsData.commandesParStatut}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="statut" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="count" fill="#ff9800" name="Nombre de commandes" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
                Aucune donnée
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* ============================================================ */}
      {/* ONGLET ANALYTICS */}
      {/* ============================================================ */}
      {activeTab === 'analytics' && (
        <div style={{ padding: '20px' }}>
          <h2 style={{ marginTop: 0, fontSize: '28px', color: '#333' }}>📊 Tableau de Bord Analytique</h2>
          <p style={{ color: '#666', marginBottom: '30px' }}>Axe du temps : Saison de truffe (juin à juin)</p>
          
          {/* Graphique CA par mois */}
          <div style={{
            marginBottom: '40px',
            background: 'white',
            padding: '20px',
            borderRadius: '8px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
          }}>
            <h3 style={{ marginTop: 0, marginBottom: '20px' }}>📈 Évolution du Chiffre d'Affaires (Saison Truffe)</h3>
            {analyticsData.caParMois && analyticsData.caParMois.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={analyticsData.caParMois}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="mois" />
                  <YAxis />
                  <Tooltip formatter={(value) => `${value.toFixed(2)} €`} />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="ca"
                    stroke="#2196f3"
                    dot={{ fill: '#2196f3', r: 6 }}
                    activeDot={{ r: 8 }}
                    name="Chiffre d'Affaires (€)"
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
                Aucune vente payée pour générer le graphique
              </div>
            )}
          </div>
          
          {/* Top 10 Clients */}
          <div style={{
            background: 'white',
            padding: '20px',
            borderRadius: '8px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
          }}>
            <h3 style={{ marginTop: 0, marginBottom: '20px' }}>⭐ Top 10 Clients (CA)</h3>
            {analyticsData.topClients && analyticsData.topClients.length > 0 ? (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #e0e0e0', backgroundColor: '#f8f8f8' }}>
                    <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600 }}>Rang</th>
                    <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600 }}>Client</th>
                    <th style={{ padding: '12px', textAlign: 'right', fontWeight: 600 }}>CA (€)</th>
                  </tr>
                </thead>
                <tbody>
                  {analyticsData.topClients.map((client, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #e0e0e0' }}>
                      <td style={{ padding: '12px', fontWeight: 'bold' }}>{idx + 1}</td>
                      <td style={{ padding: '12px' }}>{client.client}</td>
                      <td style={{ padding: '12px', textAlign: 'right', fontWeight: 600 }}>
                        {client.ca.toFixed(2)} €
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
                Aucune donnée
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* ============================================================ */}
      {/* MODALS - STRUCTURE SIMPLIFIÉE */}
      {/* ============================================================ */}
      
      {/* MODAL CLIENT */}
      {showClientModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          overflow: 'auto',
          paddingTop: '20px',
          paddingBottom: '20px'
        }}>
          <div style={{
            background: 'white',
            padding: '30px',
            borderRadius: '12px',
            maxWidth: '600px',
            width: '90%',
            maxHeight: '90vh',
            overflow: 'auto'
          }}>
            <h2 style={{ marginTop: 0 }}>
              {editingClient ? 'Modifier le client' : 'Nouveau client'}
            </h2>
            
            <form onSubmit={handleClientSubmit}>
              {/* Type de client */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>
                  Type de client
                </label>
                <select
                  name="type"
                  value={clientFormData.type}
                  onChange={handleClientFormChange}
                  required
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #ddd',
                    borderRadius: '6px',
                    fontSize: '14px'
                  }}
                >
                  <option value="Particulier">Particulier</option>
                  <option value="Restaurant">Restaurant</option>
                  <option value="Grossiste">Grossiste</option>
                  <option value="Association">Association</option>
                </select>
              </div>
              
              {/* Champs conditionnels */}
              {clientFormData.type === 'Particulier' ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>Nom</label>
                    <input
                      type="text"
                      name="nom"
                      value={clientFormData.nom}
                      onChange={handleClientFormChange}
                      required
                      style={{
                        width: '100%',
                        padding: '10px',
                        border: '1px solid #ddd',
                        borderRadius: '6px',
                        fontSize: '14px'
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>Prénom</label>
                    <input
                      type="text"
                      name="prenom"
                      value={clientFormData.prenom}
                      onChange={handleClientFormChange}
                      style={{
                        width: '100%',
                        padding: '10px',
                        border: '1px solid #ddd',
                        borderRadius: '6px',
                        fontSize: '14px'
                      }}
                    />
                  </div>
                </div>
              ) : (
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>Raison sociale</label>
                  <input
                    type="text"
                    name="raison_sociale"
                    value={clientFormData.raison_sociale}
                    onChange={handleClientFormChange}
                    required
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '1px solid #ddd',
                      borderRadius: '6px',
                      fontSize: '14px'
                    }}
                  />
                </div>
              )}
              
              {/* Email & Téléphone */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '20px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>Email</label>
                  <input
                    type="email"
                    name="email"
                    value={clientFormData.email}
                    onChange={handleClientFormChange}
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '1px solid #ddd',
                      borderRadius: '6px',
                      fontSize: '14px'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>Téléphone</label>
                  <input
                    type="tel"
                    name="telephone"
                    value={clientFormData.telephone}
                    onChange={handleClientFormChange}
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '1px solid #ddd',
                      borderRadius: '6px',
                      fontSize: '14px'
                    }}
                  />
                </div>
              </div>
              
              {/* Adresse */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>Adresse</label>
                <input
                  type="text"
                  name="adresse"
                  value={clientFormData.adresse}
                  onChange={handleClientFormChange}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #ddd',
                    borderRadius: '6px',
                    fontSize: '14px'
                  }}
                />
              </div>
              
              {/* Code postal, Ville, Pays */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr', gap: '15px', marginBottom: '20px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>Code postal</label>
                  <input
                    type="text"
                    name="code_postal"
                    value={clientFormData.code_postal}
                    onChange={handleClientFormChange}
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '1px solid #ddd',
                      borderRadius: '6px',
                      fontSize: '14px'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>Ville</label>
                  <input
                    type="text"
                    name="ville"
                    value={clientFormData.ville}
                    onChange={handleClientFormChange}
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '1px solid #ddd',
                      borderRadius: '6px',
                      fontSize: '14px'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>Pays</label>
                  <input
                    type="text"
                    name="pays"
                    value={clientFormData.pays}
                    onChange={handleClientFormChange}
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '1px solid #ddd',
                      borderRadius: '6px',
                      fontSize: '14px'
                    }}
                  />
                </div>
              </div>
              
              {/* SIRET pour entreprises */}
              {clientFormData.type !== 'Particulier' && (
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>SIRET</label>
                  <input
                    type="text"
                    name="siret"
                    value={clientFormData.siret}
                    onChange={handleClientFormChange}
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '1px solid #ddd',
                      borderRadius: '6px',
                      fontSize: '14px'
                    }}
                  />
                </div>
              )}
              
              {/* Notes */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>Notes</label>
                <textarea
                  name="notes"
                  value={clientFormData.notes}
                  onChange={handleClientFormChange}
                  rows="3"
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #ddd',
                    borderRadius: '6px',
                    fontSize: '14px',
                    resize: 'vertical'
                  }}
                />
              </div>
              
              {/* Boutons */}
              <div style={{
                display: 'flex',
                gap: '10px',
                justifyContent: 'flex-end',
                marginTop: '30px'
              }}>
                <button
                  type="button"
                  onClick={closeClientModal}
                  style={{
                    padding: '12px 24px',
                    border: '1px solid #ddd',
                    borderRadius: '6px',
                    background: 'white',
                    cursor: 'pointer',
                    fontSize: '14px'
                  }}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isProcessing}
                  style={{
                    padding: '12px 24px',
                    border: 'none',
                    borderRadius: '6px',
                    background: '#2196f3',
                    color: 'white',
                    cursor: isProcessing ? 'not-allowed' : 'pointer',
                    fontSize: '14px',
                    fontWeight: 600,
                    opacity: isProcessing ? 0.7 : 1
                  }}
                >
                  {isProcessing ? 'Enregistrement...' : (editingClient ? 'Mettre à jour' : 'Créer')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      {/* MODAL COMMANDE - STRUCTURE SIMPLIFIÉE */}
      {showCommandeModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          overflow: 'auto',
          paddingTop: '20px',
          paddingBottom: '20px'
        }}>
          <div style={{
            background: 'white',
            padding: '30px',
            borderRadius: '12px',
            maxWidth: '600px',
            width: '90%',
            maxHeight: '90vh',
            overflow: 'auto'
          }}>
            <h2 style={{ marginTop: 0 }}>
              {editingCommande ? 'Modifier la commande' : 'Nouvelle commande'}
            </h2>
            
            <form onSubmit={handleCommandeSubmit}>
              {/* Client */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>Client</label>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <select
                    name="client_id"
                    value={commandeFormData.client_id}
                    onChange={handleCommandeInputChange}
                    required
                    style={{
                      flex: 1,
                      padding: '10px',
                      border: '1px solid #ddd',
                      borderRadius: '6px',
                      fontSize: '14px'
                    }}
                  >
                    <option value="">Sélectionner un client</option>
                    {clients.map(client => (
                      <option key={client.id} value={client.id}>
                        {client.type === 'Particulier'
                          ? `${client.nom} ${client.prenom}`
                          : client.raison_sociale || client.nom}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setShowQuickClientModal(true)}
                    style={{
                      padding: '10px 20px',
                      border: '1px solid #2196f3',
                      borderRadius: '6px',
                      background: 'white',
                      color: '#2196f3',
                      cursor: 'pointer',
                      fontSize: '14px'
                    }}
                  >
                    Créer
                  </button>
                </div>
              </div>
              
              {/* Dates */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '20px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>Date de commande</label>
                  <input
                    type="date"
                    name="date_commande"
                    value={commandeFormData.date_commande}
                    onChange={handleCommandeInputChange}
                    required
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '1px solid #ddd',
                      borderRadius: '6px',
                      fontSize: '14px'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>Date de livraison souhaitée</label>
                  <input
                    type="date"
                    name="date_livraison_demandee"
                    value={commandeFormData.date_livraison_demandee}
                    onChange={handleCommandeInputChange}
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '1px solid #ddd',
                      borderRadius: '6px',
                      fontSize: '14px'
                    }}
                  />
                </div>
              </div>
              
              {/* Poids et Prix */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>Poids (grammes)</label>
                  <input
                    type="number"
                    name="poids_grammes"
                    value={commandeFormData.poids_grammes}
                    onChange={handleCommandeInputChange}
                    required
                    min="0"
                    step="1"
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '1px solid #ddd',
                      borderRadius: '6px',
                      fontSize: '14px'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>Prix/kg (€)</label>
                  <input
                    type="number"
                    name="prix_unitaire_kg"
                    value={commandeFormData.prix_unitaire_kg}
                    onChange={handleCommandeInputChange}
                    required
                    min="0"
                    step="0.01"
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '1px solid #ddd',
                      borderRadius: '6px',
                      fontSize: '14px'
                    }}
                  />
                </div>
              </div>
              
              {/* Montant calculé */}
              <div style={{
                marginBottom: '20px',
                padding: '10px',
                background: '#f0f0f0',
                borderRadius: '6px'
              }}>
                <strong>Montant total estimé : {montantCalculeCommande()} €</strong>
              </div>
              
              {/* Statut */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>Statut</label>
                <select
                  name="statut"
                  value={commandeFormData.statut}
                  onChange={handleCommandeInputChange}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #ddd',
                    borderRadius: '6px',
                    fontSize: '14px'
                  }}
                >
                  <option value="En attente">En attente</option>
                  <option value="Confirmée">Confirmée</option>
                  <option value="En préparation">En préparation</option>
                  <option value="Livrée">Livrée</option>
                  <option value="Annulée">Annulée</option>
                </select>
              </div>
              
              {/* Boutons */}
              <div style={{
                display: 'flex',
                gap: '10px',
                justifyContent: 'flex-end',
                marginTop: '30px'
              }}>
                <button
                  type="button"
                  onClick={closeCommandeModal}
                  style={{
                    padding: '12px 24px',
                    border: '1px solid #ddd',
                    borderRadius: '6px',
                    background: 'white',
                    cursor: 'pointer',
                    fontSize: '14px'
                  }}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isProcessing}
                  style={{
                    padding: '12px 24px',
                    border: 'none',
                    borderRadius: '6px',
                    background: '#2196f3',
                    color: 'white',
                    cursor: isProcessing ? 'not-allowed' : 'pointer',
                    fontSize: '14px',
                    fontWeight: 600,
                    opacity: isProcessing ? 0.7 : 1
                  }}
                >
                  {isProcessing ? 'Enregistrement...' : (editingCommande ? 'Mettre à jour' : 'Créer')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      {/* MODAL VENTE */}
      {showVenteModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          overflow: 'auto',
          paddingTop: '20px',
          paddingBottom: '20px'
        }}>
          <div style={{
            background: 'white',
            padding: '30px',
            borderRadius: '12px',
            maxWidth: '600px',
            width: '90%',
            maxHeight: '90vh',
            overflow: 'auto'
          }}>
            <h2 style={{ marginTop: 0 }}>
              {editingVente ? 'Modifier la vente' : 'Nouvelle vente'}
            </h2>
            
            <form onSubmit={handleVenteSubmit}>
              {/* Client */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>Client</label>
                <select
                  name="client_id"
                  value={venteFormData.client_id}
                  onChange={handleVenteInputChange}
                  required
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #ddd',
                    borderRadius: '6px',
                    fontSize: '14px'
                  }}
                >
                  <option value="">Sélectionner un client</option>
                  {clients.map(client => (
                    <option key={client.id} value={client.id}>
                      {client.type === 'Particulier'
                        ? `${client.nom} ${client.prenom}`
                        : client.raison_sociale || client.nom}
                    </option>
                  ))}
                </select>
              </div>
              
              {/* Date */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>Date de vente</label>
                <input
                  type="date"
                  name="date_vente"
                  value={venteFormData.date_vente}
                  onChange={handleVenteInputChange}
                  required
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #ddd',
                    borderRadius: '6px',
                    fontSize: '14px'
                  }}
                />
              </div>
              
              {/* Quantité et Prix */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>Quantité (grammes)</label>
                  <input
                    type="number"
                    name="quantite_grammes"
                    value={venteFormData.quantite_grammes}
                    onChange={handleVenteInputChange}
                    required
                    min="0"
                    step="1"
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '1px solid #ddd',
                      borderRadius: '6px',
                      fontSize: '14px'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>Prix/kg (€)</label>
                  <input
                    type="number"
                    name="prix_unitaire_kg"
                    value={venteFormData.prix_unitaire_kg}
                    onChange={handleVenteInputChange}
                    required
                    min="0"
                    step="0.01"
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '1px solid #ddd',
                      borderRadius: '6px',
                      fontSize: '14px'
                    }}
                  />
                </div>
              </div>
              
              {/* Montant calculé */}
              <div style={{
                marginBottom: '20px',
                padding: '10px',
                background: '#f0f0f0',
                borderRadius: '6px'
              }}>
                <strong>Montant total estimé : {montantCalculeVente()} €</strong>
              </div>
              
              {/* Mode de paiement */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>Mode de paiement</label>
                <input
                  type="text"
                  name="mode_paiement"
                  value={venteFormData.mode_paiement}
                  onChange={handleVenteInputChange}
                  placeholder="ex: Carte bancaire, Espèces, Virement..."
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #ddd',
                    borderRadius: '6px',
                    fontSize: '14px'
                  }}
                />
              </div>
              
              {/* Numéro de facture */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>N° Facture</label>
                <input
                  type="text"
                  name="numero_facture"
                  value={venteFormData.numero_facture}
                  onChange={handleVenteInputChange}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #ddd',
                    borderRadius: '6px',
                    fontSize: '14px'
                  }}
                />
              </div>
              
              {/* Statut */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>Statut</label>
                <select
                  name="statut"
                  value={venteFormData.statut}
                  onChange={handleVenteInputChange}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #ddd',
                    borderRadius: '6px',
                    fontSize: '14px'
                  }}
                >
                  <option value="En attente">En attente</option>
                  <option value="Payée">Payée</option>
                  <option value="Annulée">Annulée</option>
                </select>
              </div>
              
              {/* Boutons */}
              <div style={{
                display: 'flex',
                gap: '10px',
                justifyContent: 'flex-end',
                marginTop: '30px'
              }}>
                <button
                  type="button"
                  onClick={closeVenteModal}
                  style={{
                    padding: '12px 24px',
                    border: '1px solid #ddd',
                    borderRadius: '6px',
                    background: 'white',
                    cursor: 'pointer',
                    fontSize: '14px'
                  }}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isProcessing}
                  style={{
                    padding: '12px 24px',
                    border: 'none',
                    borderRadius: '6px',
                    background: '#2196f3',
                    color: 'white',
                    cursor: isProcessing ? 'not-allowed' : 'pointer',
                    fontSize: '14px',
                    fontWeight: 600,
                    opacity: isProcessing ? 0.7 : 1
                  }}
                >
                  {isProcessing ? 'Enregistrement...' : (editingVente ? 'Mettre à jour' : 'Créer')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Commercial;