// ============================================================
// Commercial.js - Module CRM Complet avec Améliorations
// Version: 2.0 FINALE (avec pagination, tri, graphiques, exports + TOUS LES MODAUX)
// Date: 14 janvier 2026
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

// ============================================================
// COMPOSANT PRINCIPAL
// ============================================================

function Commercial() {
  // ==================== ÉTATS ====================

  const [activeTab, setActiveTab] = useState('clients');
  const [showAnalytics, setShowAnalytics] = useState(false);

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

  // PAGINATION
  const [currentPageClients, setCurrentPageClients] = useState(1);
  const [currentPageCommandes, setCurrentPageCommandes] = useState(1);
  const [currentPageVentes, setCurrentPageVentes] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);

  // TRI
  const [sortConfigClients, setSortConfigClients] = useState({ key: null, direction: 'asc' });
  const [sortConfigCommandes, setSortConfigCommandes] = useState({ key: 'date_commande', direction: 'desc' });
  const [sortConfigVentes, setSortConfigVentes] = useState({ key: 'date_vente', direction: 'desc' });

  // ANALYTICS
  const [analyticsData, setAnalyticsData] = useState({
    caParMois: [],
    caParClient: [],
    ventesParStatut: [],
    commandesParStatut: [],
    topClients: []
  });
 

  // Formulaires
  const [clientFormData, setClientFormData] = useState({
    type: 'Particulier', nom: '', prenom: '', raison_sociale: '',
    email: '', telephone: '', adresse: '', code_postal: '',
    ville: '', pays: 'France', siret: '', notes: ''
  });

  const [commandeFormData, setCommandeFormData] = useState({
    client_id: '', date_commande: new Date().toISOString().split('T')[0],
    date_livraison_demandee: '', poids_grammes: '', calibre: '',
    qualite: '', maturite: '', prix_unitaire_kg: '',
    statut: 'En attente', notes: ''
  });

  const [venteFormData, setVenteFormData] = useState({
    client_id: '', recolte_id: '', date_vente: new Date().toISOString().split('T')[0],
    quantite_grammes: '', prix_unitaire_kg: '', mode_paiement: '',
    statut: 'En attente', numero_facture: '', notes: ''
  });

  const [newClientData, setNewClientData] = useState({
    type: 'Particulier', nom: '', prenom: '', raison_sociale: '',
    email: '', telephone: '', adresse: '', code_postal: '',
    ville: '', pays: 'France', siret: '', notes: ''
  });

  // Custom hooks
  const { 
    colonnesAffichees: colonnesClients, 
    colonnesExport: colonnesExportClients, 
    loading: loadingClientsSettings 
  } = useColumnSettings('clients');

  const { 
    colonnesAffichees: colonnesVentes, 
    colonnesExport: colonnesExportVentes, 
    loading: loadingVentesSettings 
  } = useColumnSettings('ventes');

  // ==================== EFFECTS ====================

  useEffect(() => { loadData(); }, []);

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

  // ==================== ANALYTICS ====================

const calculateAnalytics = () => {
  // CA par mois (12 derniers mois)
  const caParMois = {};
  ventes.filter(v => v.statut === 'Payée').forEach(v => {
    const month = new Date(v.date_vente).toISOString().slice(0, 7);
    caParMois[month] = (caParMois[month] || 0) + parseFloat(v.montant_total || 0);
  });

  const caParMoisArray = Object.entries(caParMois)
    .map(([month, ca]) => ({
      mois: new Date(month + '-01').toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' }),
      ca: parseFloat(ca.toFixed(2))
    }))
    .sort((a, b) => a.mois.localeCompare(b.mois))
    .slice(-12);

  // CA par client
  const caParClient = {};
  ventes.filter(v => v.statut === 'Payée').forEach(v => {
    const clientName = getClientName(v.client_id);
    caParClient[clientName] = (caParClient[clientName] || 0) + parseFloat(v.montant_total || 0);
  });

  const topClients = Object.entries(caParClient)
    .map(([client, ca]) => ({ client, ca: parseFloat(ca.toFixed(2)) }))
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


  // ==================== TRI ====================

  const handleSort = (key, entity) => {
    let config, setConfig;

    if (entity === 'clients') {
      config = sortConfigClients;
      setConfig = setSortConfigClients;
    } else if (entity === 'commandes') {
      config = sortConfigCommandes;
      setConfig = setSortConfigCommandes;
    } else {
      config = sortConfigVentes;
      setConfig = setSortConfigVentes;
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

  // ==================== PAGINATION ====================

  const paginate = (data, currentPage) => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return data.slice(startIndex, endIndex);
  };

  const getTotalPages = (dataLength) => {
    return Math.ceil(dataLength / itemsPerPage);
  };

  const PaginationControls = ({ currentPage, setCurrentPage, totalItems, entity }) => {
    const totalPages = getTotalPages(totalItems);

    if (totalPages <= 1) return null;

    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: '20px',
        padding: '15px',
        background: '#f8f9fa',
        borderRadius: '8px'
      }}>
        <div style={{ fontSize: '14px', color: '#666' }}>
          Affichage {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, totalItems)} sur {totalItems}
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button onClick={() => setCurrentPage(1)} disabled={currentPage === 1}
            style={{ padding: '6px 12px', border: '1px solid #ddd', borderRadius: '4px',
              background: currentPage === 1 ? '#f0f0f0' : 'white',
              cursor: currentPage === 1 ? 'not-allowed' : 'pointer' }}>
            ««
          </button>

          <button onClick={() => setCurrentPage(currentPage - 1)} disabled={currentPage === 1}
            style={{ padding: '6px 12px', border: '1px solid #ddd', borderRadius: '4px',
              background: currentPage === 1 ? '#f0f0f0' : 'white',
              cursor: currentPage === 1 ? 'not-allowed' : 'pointer' }}>
            «
          </button>

          <span style={{ padding: '0 15px', fontWeight: 600 }}>
            Page {currentPage} / {totalPages}
          </span>

          <button onClick={() => setCurrentPage(currentPage + 1)} disabled={currentPage === totalPages}
            style={{ padding: '6px 12px', border: '1px solid #ddd', borderRadius: '4px',
              background: currentPage === totalPages ? '#f0f0f0' : 'white',
              cursor: currentPage === totalPages ? 'not-allowed' : 'pointer' }}>
            »
          </button>

          <button onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages}
            style={{ padding: '6px 12px', border: '1px solid #ddd', borderRadius: '4px',
              background: currentPage === totalPages ? '#f0f0f0' : 'white',
              cursor: currentPage === totalPages ? 'not-allowed' : 'pointer' }}>
            »»
          </button>

          <select value={itemsPerPage}
            onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
            style={{ marginLeft: '20px', padding: '6px 12px', border: '1px solid #ddd', borderRadius: '4px' }}>
            <option value={25}>25 / page</option>
            <option value={50}>50 / page</option>
            <option value={100}>100 / page</option>
            <option value={200}>200 / page</option>
          </select>
        </div>
      </div>
    );
  };

  // ==================== EXPORT & EMAIL ====================

  const exportComptable = () => {
    const data = ventes.filter(v => v.statut === 'Payée').map(v => {
      const montantTTC = parseFloat(v.montant_total || 0);
      const montantHT = montantTTC / (1 + TVA_RATE);
      const montantTVA = montantTTC - montantHT;

      return {
        'Date': new Date(v.date_vente).toLocaleDateString('fr-FR'),
        'N° Facture': v.numero_facture || '',
        'Client': getClientName(v.client_id),
        'Montant HT': montantHT.toFixed(2) + ' €',
        'TVA 5.5%': montantTVA.toFixed(2) + ' €',
        'Montant TTC': montantTTC.toFixed(2) + ' €',
        'Mode paiement': v.mode_paiement || '',
        'Quantité': v.quantite_grammes + ' g'
      };
    });

    const headers = Object.keys(data[0]);
    const csv = [headers.join(';'), ...data.map(row => headers.map(h => row[h]).join(';'))].join('\n');

    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `export-comptable-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();

    showMessage('Export comptable téléchargé avec succès !', 'success');
  };

  const sendCommandeConfirmation = async (commande) => {
    const client = clients.find(c => c.id === commande.client_id);

    if (!client || !client.email) {
      showMessage('Le client n\'a pas d\'adresse email', 'warning');
      return;
    }

    setIsProcessing(true);

    try {
      await axios.post(`${API_URL}/emails/send`, {
        to: client.email,
        subject: `Confirmation de commande ${commande.numero_commande}`,
        template: 'commande-confirmation',
        data: {
          commande: {
            numero: commande.numero_commande,
            date: new Date(commande.date_commande).toLocaleDateString('fr-FR'),
            poids: commande.poids_grammes,
            montant: commande.montant_total
          },
          client: { nom: getClientName(commande.client_id) }
        }
      });

      showMessage('✉️ Email de confirmation envoyé avec succès !', 'success');
    } catch (error) {
      console.error('Erreur envoi email:', error);
      showMessage('Erreur lors de l\'envoi de l\'email', 'error');
    } finally {
      setIsProcessing(false);
    }
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
      showMessage('✔ Vente créée automatiquement !', 'success');

      const ventesRes = await axios.get(`${API_URL}/ventes`);
      setVentes(ventesRes.data);
    } catch (error) {
      console.error('Erreur création vente:', error);
      showMessage('La vente n\'a pas pu être créée automatiquement', 'error');
    }
  };

  // ==================== FONCTIONS CLIENTS ====================

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
    for (const client of validData) {
      await axios.post(`${API_URL}/clients`, client);
    }
    loadData();
    showMessage(`${validData.length} client(s) importé(s) avec succès !`, 'success');
  };

  const handleExportClientsPDF = () => {
    exportClientsPDF(filteredClients, colonnesExportClients);
  };

  const getTypeBadgeStyle = (type) => {
    const styles = {
      'Particulier': { background: '#e3f2fd', color: '#1565c0' },
      'Restaurant': { background: '#fff3e0', color: '#e65100' },
      'Grossiste': { background: '#f3e5f5', color: '#7b1fa2' },
      'Association': { background: '#e8f5e9', color: '#2e7d32' }
    };
    return styles[type] || styles['Particulier'];
  };

  // ==================== FONCTIONS COMMANDES ====================

  const handleCommandeInputChange = (e) => {
    const { name, value } = e.target;
    setCommandeFormData(prev => ({ ...prev, [name]: value }));
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

  // ==================== FONCTIONS VENTES ====================

  const handleVenteInputChange = (e) => {
    const { name, value } = e.target;
    setVenteFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleVenteSubmit = async (e) => {
    e.preventDefault();
    setIsProcessing(true);

    try {
      const dataToSend = { ...venteFormData };

      if (!dataToSend.recolte_id) {
        dataToSend.recolte_id = null;
      }

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

  // ==================== FILTRAGE & TRI ====================

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

  const filteredCommandes = commandes.filter(c =>
    filterStatutCommande === 'all' || c.statut === filterStatutCommande
  );

  const filteredVentes = ventes.filter(v =>
    filterStatutVente === 'all' || v.statut === filterStatutVente
  );

  const sortedClients = sortData(filteredClients, sortConfigClients);
  const sortedCommandes = sortData(filteredCommandes, sortConfigCommandes);
  const sortedVentes = sortData(filteredVentes, sortConfigVentes);

  const paginatedClients = paginate(sortedClients, currentPageClients);
  const paginatedCommandes = paginate(sortedCommandes, currentPageCommandes);
  const paginatedVentes = paginate(sortedVentes, currentPageVentes);

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
    chiffreAffaires: ventes.filter(v => v.statut === 'Payée').reduce((sum, v) => sum + parseFloat(v.montant_total || 0), 0)
  };

  // ==================== RENDER CONFIG ====================

  const configClients = COLONNES_CONFIG.clients;
  const colonnesValidesClients = colonnesClients.filter(col => configClients[col]);

  const renderClientCell = (client, col) => {
    if (col === 'type') {
      return (
        <span style={{
          ...getTypeBadgeStyle(client.type),
          padding: '4px 8px',
          borderRadius: '4px',
          fontSize: '12px',
          fontWeight: 600
        }}>
          {client.type}
        </span>
      );
    }

    if (col === 'nom') {
      return <strong>{configClients[col].render(client)}</strong>;
    }

    return configClients[col].render(client);
  };

  const SortIcon = ({ column, currentSort }) => {
    if (currentSort.key !== column) {
      return <span style={{ opacity: 0.3, marginLeft: '4px' }}>⇅</span>;
    }
    return <span style={{ marginLeft: '4px' }}>{currentSort.direction === 'asc' ? '↑' : '↓'}</span>;
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
    <div className="commercial-container">
      {/* MESSAGE DE NOTIFICATION */}
      {message && (
        <div style={{
          position: 'fixed', top: '20px', right: '20px', zIndex: 10000,
          background: message.type === 'success' ? '#4caf50' : message.type === 'error' ? '#f44336' : '#ff9800',
          color: 'white', padding: '15px 20px', borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.2)', animation: 'slideIn 0.3s ease-out'
        }}>
          {message.text}
        </div>
      )}

      {/* MODAL DE CONFIRMATION */}
      {confirmModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', zIndex: 9999
        }}>
          <div style={{
            background: 'white', padding: '30px', borderRadius: '12px',
            maxWidth: '500px', width: '90%'
          }}>
            <h3 style={{ marginTop: 0 }}>{confirmModal.title}</h3>
            <p>{confirmModal.message}</p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button onClick={() => setConfirmModal(null)}
                style={{
                  padding: '10px 20px', border: '1px solid #ddd', borderRadius: '6px',
                  background: 'white', cursor: 'pointer'
                }}>
                Annuler
              </button>
              <button onClick={handleConfirm} disabled={isProcessing}
                style={{
                  padding: '10px 20px', border: 'none', borderRadius: '6px',
                  background: confirmModal.confirmColor || '#f44336', color: 'white',
                  cursor: isProcessing ? 'not-allowed' : 'pointer',
                  opacity: isProcessing ? 0.7 : 1
                }}>
                {isProcessing ? 'Traitement...' : confirmModal.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* MODAL CLIENT */}
      {showClientModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', zIndex: 9999, overflow: 'auto'
        }}>
          <div style={{
            background: 'white', padding: '30px', borderRadius: '12px',
            maxWidth: '800px', width: '90%', maxHeight: '90vh', overflow: 'auto'
          }}>
            <h2 style={{ marginTop: 0 }}>
              {editingClient ? '✏️ Modifier le client' : '➕ Nouveau client'}
            </h2>

            <form onSubmit={handleClientSubmit}>
              {/* Type de client */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>
                  Type de client *
                </label>
                <select
                  name="type"
                  value={clientFormData.type}
                  onChange={handleClientFormChange}
                  required
                  style={{
                    width: '100%', padding: '10px', border: '1px solid #ddd',
                    borderRadius: '6px', fontSize: '14px'
                  }}
                >
                  <option value="Particulier">Particulier</option>
                  <option value="Restaurant">Restaurant</option>
                  <option value="Grossiste">Grossiste</option>
                  <option value="Association">Association</option>
                </select>
              </div>

              {/* Champs conditionnels selon le type */}
              {clientFormData.type === 'Particulier' ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>
                      Nom *
                    </label>
                    <input
                      type="text"
                      name="nom"
                      value={clientFormData.nom}
                      onChange={handleClientFormChange}
                      required
                      style={{
                        width: '100%', padding: '10px', border: '1px solid #ddd',
                        borderRadius: '6px', fontSize: '14px'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>
                      Prénom
                    </label>
                    <input
                      type="text"
                      name="prenom"
                      value={clientFormData.prenom}
                      onChange={handleClientFormChange}
                      style={{
                        width: '100%', padding: '10px', border: '1px solid #ddd',
                        borderRadius: '6px', fontSize: '14px'
                      }}
                    />
                  </div>
                </div>
              ) : (
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>
                    Raison sociale *
                  </label>
                  <input
                    type="text"
                    name="raison_sociale"
                    value={clientFormData.raison_sociale}
                    onChange={handleClientFormChange}
                    required
                    style={{
                      width: '100%', padding: '10px', border: '1px solid #ddd',
                      borderRadius: '6px', fontSize: '14px'
                    }}
                  />
                </div>
              )}

              {/* Email & Téléphone */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginTop: '15px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>
                    Email
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={clientFormData.email}
                    onChange={handleClientFormChange}
                    style={{
                      width: '100%', padding: '10px', border: '1px solid #ddd',
                      borderRadius: '6px', fontSize: '14px'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>
                    Téléphone
                  </label>
                  <input
                    type="tel"
                    name="telephone"
                    value={clientFormData.telephone}
                    onChange={handleClientFormChange}
                    style={{
                      width: '100%', padding: '10px', border: '1px solid #ddd',
                      borderRadius: '6px', fontSize: '14px'
                    }}
                  />
                </div>
              </div>

              {/* Adresse */}
              <div style={{ marginTop: '15px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>
                  Adresse
                </label>
                <input
                  type="text"
                  name="adresse"
                  value={clientFormData.adresse}
                  onChange={handleClientFormChange}
                  style={{
                    width: '100%', padding: '10px', border: '1px solid #ddd',
                    borderRadius: '6px', fontSize: '14px'
                  }}
                />
              </div>

              {/* Code postal, Ville, Pays */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr', gap: '15px', marginTop: '15px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>
                    Code postal
                  </label>
                  <input
                    type="text"
                    name="code_postal"
                    value={clientFormData.code_postal}
                    onChange={handleClientFormChange}
                    style={{
                      width: '100%', padding: '10px', border: '1px solid #ddd',
                      borderRadius: '6px', fontSize: '14px'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>
                    Ville
                  </label>
                  <input
                    type="text"
                    name="ville"
                    value={clientFormData.ville}
                    onChange={handleClientFormChange}
                    style={{
                      width: '100%', padding: '10px', border: '1px solid #ddd',
                      borderRadius: '6px', fontSize: '14px'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>
                    Pays
                  </label>
                  <input
                    type="text"
                    name="pays"
                    value={clientFormData.pays}
                    onChange={handleClientFormChange}
                    style={{
                      width: '100%', padding: '10px', border: '1px solid #ddd',
                      borderRadius: '6px', fontSize: '14px'
                    }}
                  />
                </div>
              </div>

              {/* SIRET (pour entreprises) */}
              {clientFormData.type !== 'Particulier' && (
                <div style={{ marginTop: '15px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>
                    SIRET
                  </label>
                  <input
                    type="text"
                    name="siret"
                    value={clientFormData.siret}
                    onChange={handleClientFormChange}
                    style={{
                      width: '100%', padding: '10px', border: '1px solid #ddd',
                      borderRadius: '6px', fontSize: '14px'
                    }}
                  />
                </div>
              )}

              {/* Notes */}
              <div style={{ marginTop: '15px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>
                  Notes
                </label>
                <textarea
                  name="notes"
                  value={clientFormData.notes}
                  onChange={handleClientFormChange}
                  rows={3}
                  style={{
                    width: '100%', padding: '10px', border: '1px solid #ddd',
                    borderRadius: '6px', fontSize: '14px', resize: 'vertical'
                  }}
                />
              </div>

              {/* Boutons */}
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '30px' }}>
                <button
                  type="button"
                  onClick={closeClientModal}
                  style={{
                    padding: '12px 24px', border: '1px solid #ddd', borderRadius: '6px',
                    background: 'white', cursor: 'pointer', fontSize: '14px'
                  }}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isProcessing}
                  style={{
                    padding: '12px 24px', border: 'none', borderRadius: '6px',
                    background: '#2196f3', color: 'white', cursor: isProcessing ? 'not-allowed' : 'pointer',
                    fontSize: '14px', fontWeight: 600, opacity: isProcessing ? 0.7 : 1
                  }}
                >
                  {isProcessing ? 'Enregistrement...' : editingClient ? 'Mettre à jour' : 'Créer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL COMMANDE */}
      {showCommandeModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', zIndex: 9999, overflow: 'auto'
        }}>
          <div style={{
            background: 'white', padding: '30px', borderRadius: '12px',
            maxWidth: '800px', width: '90%', maxHeight: '90vh', overflow: 'auto'
          }}>
            <h2 style={{ marginTop: 0 }}>
              {editingCommande ? '✏️ Modifier la commande' : '➕ Nouvelle commande'}
            </h2>

            <form onSubmit={handleCommandeSubmit}>
              {/* Client */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>
                  Client *
                </label>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <select
                    name="client_id"
                    value={commandeFormData.client_id}
                    onChange={handleCommandeInputChange}
                    required
                    style={{
                      flex: 1, padding: '10px', border: '1px solid #ddd',
                      borderRadius: '6px', fontSize: '14px'
                    }}
                  >
                    <option value="">Sélectionner un client</option>
                    {clients.map(client => (
                      <option key={client.id} value={client.id}>
                        {client.type === 'Particulier' 
                          ? `${client.nom} ${client.prenom || ''}` 
                          : client.raison_sociale || client.nom}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setShowQuickClientModal(true)}
                    style={{
                      padding: '10px 20px', border: '1px solid #2196f3', borderRadius: '6px',
                      background: 'white', color: '#2196f3', cursor: 'pointer', fontSize: '14px'
                    }}
                  >
                    + Créer
                  </button>
                </div>
              </div>

              {/* Dates */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>
                    Date de commande *
                  </label>
                  <input
                    type="date"
                    name="date_commande"
                    value={commandeFormData.date_commande}
                    onChange={handleCommandeInputChange}
                    required
                    style={{
                      width: '100%', padding: '10px', border: '1px solid #ddd',
                      borderRadius: '6px', fontSize: '14px'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>
                    Date de livraison souhaitée
                  </label>
                  <input
                    type="date"
                    name="date_livraison_demandee"
                    value={commandeFormData.date_livraison_demandee}
                    onChange={handleCommandeInputChange}
                    style={{
                      width: '100%', padding: '10px', border: '1px solid #ddd',
                      borderRadius: '6px', fontSize: '14px'
                    }}
                  />
                </div>
              </div>

              {/* Poids et Prix */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginTop: '15px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>
                    Poids (grammes) *
                  </label>
                  <input
                    type="number"
                    name="poids_grammes"
                    value={commandeFormData.poids_grammes}
                    onChange={handleCommandeInputChange}
                    required
                    min="0"
                    step="1"
                    style={{
                      width: '100%', padding: '10px', border: '1px solid #ddd',
                      borderRadius: '6px', fontSize: '14px'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>
                    Prix unitaire (€/kg) *
                  </label>
                  <input
                    type="number"
                    name="prix_unitaire_kg"
                    value={commandeFormData.prix_unitaire_kg}
                    onChange={handleCommandeInputChange}
                    required
                    min="0"
                    step="0.01"
                    style={{
                      width: '100%', padding: '10px', border: '1px solid #ddd',
                      borderRadius: '6px', fontSize: '14px'
                    }}
                  />
                </div>
              </div>

              {/* Montant calculé */}
              {(commandeFormData.poids_grammes && commandeFormData.prix_unitaire_kg) && (
                <div style={{
                  marginTop: '15px', padding: '15px', background: '#f8f9fa',
                  borderRadius: '6px', textAlign: 'center'
                }}>
                  <strong style={{ fontSize: '18px', color: '#2196f3' }}>
                    Montant total : {montantCalculeCommande()} €
                  </strong>
                </div>
              )}

              {/* Caractéristiques */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px', marginTop: '15px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>
                    Calibre
                  </label>
                  <input
                    type="text"
                    name="calibre"
                    value={commandeFormData.calibre}
                    onChange={handleCommandeInputChange}
                    placeholder="Ex: 1ère catégorie"
                    style={{
                      width: '100%', padding: '10px', border: '1px solid #ddd',
                      borderRadius: '6px', fontSize: '14px'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>
                    Qualité
                  </label>
                  <input
                    type="text"
                    name="qualite"
                    value={commandeFormData.qualite}
                    onChange={handleCommandeInputChange}
                    placeholder="Ex: Extra"
                    style={{
                      width: '100%', padding: '10px', border: '1px solid #ddd',
                      borderRadius: '6px', fontSize: '14px'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>
                    Maturité
                  </label>
                  <input
                    type="text"
                    name="maturite"
                    value={commandeFormData.maturite}
                    onChange={handleCommandeInputChange}
                    placeholder="Ex: À point"
                    style={{
                      width: '100%', padding: '10px', border: '1px solid #ddd',
                      borderRadius: '6px', fontSize: '14px'
                    }}
                  />
                </div>
              </div>

              {/* Statut */}
              <div style={{ marginTop: '15px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>
                  Statut *
                </label>
                <select
                  name="statut"
                  value={commandeFormData.statut}
                  onChange={handleCommandeInputChange}
                  required
                  style={{
                    width: '100%', padding: '10px', border: '1px solid #ddd',
                    borderRadius: '6px', fontSize: '14px'
                  }}
                >
                  <option value="En attente">En attente</option>
                  <option value="Confirmée">Confirmée</option>
                  <option value="En préparation">En préparation</option>
                  <option value="Livrée">Livrée</option>
                  <option value="Annulée">Annulée</option>
                </select>
              </div>

              {/* Notes */}
              <div style={{ marginTop: '15px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>
                  Notes
                </label>
                <textarea
                  name="notes"
                  value={commandeFormData.notes}
                  onChange={handleCommandeInputChange}
                  rows={3}
                  style={{
                    width: '100%', padding: '10px', border: '1px solid #ddd',
                    borderRadius: '6px', fontSize: '14px', resize: 'vertical'
                  }}
                />
              </div>

              {/* Boutons */}
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '30px' }}>
                <button
                  type="button"
                  onClick={closeCommandeModal}
                  style={{
                    padding: '12px 24px', border: '1px solid #ddd', borderRadius: '6px',
                    background: 'white', cursor: 'pointer', fontSize: '14px'
                  }}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isProcessing}
                  style={{
                    padding: '12px 24px', border: 'none', borderRadius: '6px',
                    background: '#2196f3', color: 'white', cursor: isProcessing ? 'not-allowed' : 'pointer',
                    fontSize: '14px', fontWeight: 600, opacity: isProcessing ? 0.7 : 1
                  }}
                >
                  {isProcessing ? 'Enregistrement...' : editingCommande ? 'Mettre à jour' : 'Créer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL VENTE */}
      {showVenteModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', zIndex: 9999, overflow: 'auto'
        }}>
          <div style={{
            background: 'white', padding: '30px', borderRadius: '12px',
            maxWidth: '800px', width: '90%', maxHeight: '90vh', overflow: 'auto'
          }}>
            <h2 style={{ marginTop: 0 }}>
              {editingVente ? '✏️ Modifier la vente' : '➕ Nouvelle vente'}
            </h2>

            <form onSubmit={handleVenteSubmit}>
              {/* Client */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>
                  Client *
                </label>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <select
                    name="client_id"
                    value={venteFormData.client_id}
                    onChange={handleVenteInputChange}
                    required
                    style={{
                      flex: 1, padding: '10px', border: '1px solid #ddd',
                      borderRadius: '6px', fontSize: '14px'
                    }}
                  >
                    <option value="">Sélectionner un client</option>
                    {clients.map(client => (
                      <option key={client.id} value={client.id}>
                        {client.type === 'Particulier' 
                          ? `${client.nom} ${client.prenom || ''}` 
                          : client.raison_sociale || client.nom}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setShowQuickClientModal(true)}
                    style={{
                      padding: '10px 20px', border: '1px solid #2196f3', borderRadius: '6px',
                      background: 'white', color: '#2196f3', cursor: 'pointer', fontSize: '14px'
                    }}
                  >
                    + Créer
                  </button>
                </div>
              </div>

              {/* Récolte (optionnel) */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>
                  Récolte (optionnel)
                </label>
                <select
                  name="recolte_id"
                  value={venteFormData.recolte_id}
                  onChange={handleVenteInputChange}
                  style={{
                    width: '100%', padding: '10px', border: '1px solid #ddd',
                    borderRadius: '6px', fontSize: '14px'
                  }}
                >
                  <option value="">Aucune récolte associée</option>
                  {recoltes.map(r => (
                    <option key={r.id} value={r.id}>
                      Récolte du {new Date(r.date_recolte).toLocaleDateString('fr-FR')} - {r.poids_grammes}g
                    </option>
                  ))}
                </select>
              </div>

              {/* Date et Numéro de facture */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>
                    Date de vente *
                  </label>
                  <input
                    type="date"
                    name="date_vente"
                    value={venteFormData.date_vente}
                    onChange={handleVenteInputChange}
                    required
                    style={{
                      width: '100%', padding: '10px', border: '1px solid #ddd',
                      borderRadius: '6px', fontSize: '14px'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>
                    N° Facture
                  </label>
                  <input
                    type="text"
                    name="numero_facture"
                    value={venteFormData.numero_facture}
                    onChange={handleVenteInputChange}
                    placeholder="Auto-généré si vide"
                    style={{
                      width: '100%', padding: '10px', border: '1px solid #ddd',
                      borderRadius: '6px', fontSize: '14px'
                    }}
                  />
                </div>
              </div>

              {/* Quantité et Prix */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginTop: '15px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>
                    Quantité (grammes) *
                  </label>
                  <input
                    type="number"
                    name="quantite_grammes"
                    value={venteFormData.quantite_grammes}
                    onChange={handleVenteInputChange}
                    required
                    min="0"
                    step="1"
                    style={{
                      width: '100%', padding: '10px', border: '1px solid #ddd',
                      borderRadius: '6px', fontSize: '14px'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>
                    Prix unitaire (€/kg) *
                  </label>
                  <input
                    type="number"
                    name="prix_unitaire_kg"
                    value={venteFormData.prix_unitaire_kg}
                    onChange={handleVenteInputChange}
                    required
                    min="0"
                    step="0.01"
                    style={{
                      width: '100%', padding: '10px', border: '1px solid #ddd',
                      borderRadius: '6px', fontSize: '14px'
                    }}
                  />
                </div>
              </div>

              {/* Montant calculé */}
              {(venteFormData.quantite_grammes && venteFormData.prix_unitaire_kg) && (
                <div style={{
                  marginTop: '15px', padding: '15px', background: '#f8f9fa',
                  borderRadius: '6px', textAlign: 'center'
                }}>
                  <strong style={{ fontSize: '18px', color: '#2196f3' }}>
                    Montant total : {montantCalculeVente()} €
                  </strong>
                </div>
              )}

              {/* Mode de paiement et Statut */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginTop: '15px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>
                    Mode de paiement
                  </label>
                  <select
                    name="mode_paiement"
                    value={venteFormData.mode_paiement}
                    onChange={handleVenteInputChange}
                    style={{
                      width: '100%', padding: '10px', border: '1px solid #ddd',
                      borderRadius: '6px', fontSize: '14px'
                    }}
                  >
                    <option value="">Sélectionner</option>
                    <option value="Espèces">Espèces</option>
                    <option value="Chèque">Chèque</option>
                    <option value="Virement">Virement</option>
                    <option value="Carte bancaire">Carte bancaire</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>
                    Statut *
                  </label>
                  <select
                    name="statut"
                    value={venteFormData.statut}
                    onChange={handleVenteInputChange}
                    required
                    style={{
                      width: '100%', padding: '10px', border: '1px solid #ddd',
                      borderRadius: '6px', fontSize: '14px'
                    }}
                  >
                    <option value="En attente">En attente</option>
                    <option value="Payée">Payée</option>
                    <option value="Annulée">Annulée</option>
                  </select>
                </div>
              </div>

              {/* Notes */}
              <div style={{ marginTop: '15px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>
                  Notes
                </label>
                <textarea
                  name="notes"
                  value={venteFormData.notes}
                  onChange={handleVenteInputChange}
                  rows={3}
                  style={{
                    width: '100%', padding: '10px', border: '1px solid #ddd',
                    borderRadius: '6px', fontSize: '14px', resize: 'vertical'
                  }}
                />
              </div>

              {/* Boutons */}
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '30px' }}>
                <button
                  type="button"
                  onClick={closeVenteModal}
                  style={{
                    padding: '12px 24px', border: '1px solid #ddd', borderRadius: '6px',
                    background: 'white', cursor: 'pointer', fontSize: '14px'
                  }}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isProcessing}
                  style={{
                    padding: '12px 24px', border: 'none', borderRadius: '6px',
                    background: '#2196f3', color: 'white', cursor: isProcessing ? 'not-allowed' : 'pointer',
                    fontSize: '14px', fontWeight: 600, opacity: isProcessing ? 0.7 : 1
                  }}
                >
                  {isProcessing ? 'Enregistrement...' : editingVente ? 'Mettre à jour' : 'Créer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL CRÉATION RAPIDE CLIENT */}
      {showQuickClientModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', zIndex: 10000, overflow: 'auto'
        }}>
          <div style={{
            background: 'white', padding: '30px', borderRadius: '12px',
            maxWidth: '600px', width: '90%', maxHeight: '90vh', overflow: 'auto'
          }}>
            <h2 style={{ marginTop: 0 }}>⚡ Création rapide de client</h2>

            <form onSubmit={handleCreateQuickClient}>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>
                  Type *
                </label>
                <select
                  name="type"
                  value={newClientData.type}
                  onChange={handleQuickClientInputChange}
                  required
                  style={{
                    width: '100%', padding: '10px', border: '1px solid #ddd',
                    borderRadius: '6px', fontSize: '14px'
                  }}
                >
                  <option value="Particulier">Particulier</option>
                  <option value="Restaurant">Restaurant</option>
                  <option value="Grossiste">Grossiste</option>
                  <option value="Association">Association</option>
                </select>
              </div>

              {newClientData.type === 'Particulier' ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>
                      Nom *
                    </label>
                    <input
                      type="text"
                      name="nom"
                      value={newClientData.nom}
                      onChange={handleQuickClientInputChange}
                      required
                      style={{
                        width: '100%', padding: '10px', border: '1px solid #ddd',
                        borderRadius: '6px', fontSize: '14px'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>
                      Prénom
                    </label>
                    <input
                      type="text"
                      name="prenom"
                      value={newClientData.prenom}
                      onChange={handleQuickClientInputChange}
                      style={{
                        width: '100%', padding: '10px', border: '1px solid #ddd',
                        borderRadius: '6px', fontSize: '14px'
                      }}
                    />
                  </div>
                </div>
              ) : (
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>
                    Raison sociale *
                  </label>
                  <input
                    type="text"
                    name="raison_sociale"
                    value={newClientData.raison_sociale}
                    onChange={handleQuickClientInputChange}
                    required
                    style={{
                      width: '100%', padding: '10px', border: '1px solid #ddd',
                      borderRadius: '6px', fontSize: '14px'
                    }}
                  />
                </div>
              )}

              <div style={{ marginTop: '15px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>
                  Email
                </label>
                <input
                  type="email"
                  name="email"
                  value={newClientData.email}
                  onChange={handleQuickClientInputChange}
                  style={{
                    width: '100%', padding: '10px', border: '1px solid #ddd',
                    borderRadius: '6px', fontSize: '14px'
                  }}
                />
              </div>

              <div style={{ marginTop: '15px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>
                  Téléphone
                </label>
                <input
                  type="tel"
                  name="telephone"
                  value={newClientData.telephone}
                  onChange={handleQuickClientInputChange}
                  style={{
                    width: '100%', padding: '10px', border: '1px solid #ddd',
                    borderRadius: '6px', fontSize: '14px'
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '30px' }}>
                <button
                  type="button"
                  onClick={() => setShowQuickClientModal(false)}
                  style={{
                    padding: '12px 24px', border: '1px solid #ddd', borderRadius: '6px',
                    background: 'white', cursor: 'pointer', fontSize: '14px'
                  }}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isProcessing}
                  style={{
                    padding: '12px 24px', border: 'none', borderRadius: '6px',
                    background: '#2196f3', color: 'white', cursor: isProcessing ? 'not-allowed' : 'pointer',
                    fontSize: '14px', fontWeight: 600, opacity: isProcessing ? 0.7 : 1
                  }}
                >
                  {isProcessing ? 'Création...' : 'Créer et associer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL TRANSACTIONS CLIENT */}
      {showTransactionsModal && selectedClientForTransactions && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', zIndex: 9999, overflow: 'auto'
        }}>
          <div style={{
            background: 'white', padding: '30px', borderRadius: '12px',
            maxWidth: '1000px', width: '90%', maxHeight: '90vh', overflow: 'auto'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
              <h2 style={{ margin: 0 }}>
                📊 Transactions de {selectedClientForTransactions.type === 'Particulier' 
                  ? `${selectedClientForTransactions.nom} ${selectedClientForTransactions.prenom || ''}` 
                  : selectedClientForTransactions.raison_sociale || selectedClientForTransactions.nom}
              </h2>
              <button
                onClick={() => setShowTransactionsModal(false)}
                style={{
                  padding: '8px 16px', border: '1px solid #ddd', borderRadius: '6px',
                  background: 'white', cursor: 'pointer', fontSize: '14px'
                }}
              >
                ✖ Fermer
              </button>
            </div>

            {/* Statistiques */}
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '15px', marginBottom: '30px'
            }}>
              <div style={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white', padding: '20px', borderRadius: '12px'
              }}>
                <div style={{ fontSize: '14px', opacity: 0.9 }}>Commandes</div>
                <div style={{ fontSize: '28px', fontWeight: 700, marginTop: '10px' }}>
                  {clientTransactions.commandes.length}
                </div>
              </div>

              <div style={{
                background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
                color: 'white', padding: '20px', borderRadius: '12px'
              }}>
                <div style={{ fontSize: '14px', opacity: 0.9 }}>Ventes</div>
                <div style={{ fontSize: '28px', fontWeight: 700, marginTop: '10px' }}>
                  {clientTransactions.ventes.length}
                </div>
              </div>

              <div style={{
                background: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
                color: 'white', padding: '20px', borderRadius: '12px'
              }}>
                <div style={{ fontSize: '14px', opacity: 0.9 }}>CA Total</div>
                <div style={{ fontSize: '28px', fontWeight: 700, marginTop: '10px' }}>
                  {clientTransactions.ventes
                    .filter(v => v.statut === 'Payée')
                    .reduce((sum, v) => sum + parseFloat(v.montant_total || 0), 0)
                    .toFixed(2)} €
                </div>
              </div>
            </div>

            {/* Commandes */}
            <div style={{ marginBottom: '30px' }}>
              <h3>📦 Commandes ({clientTransactions.commandes.length})</h3>
              {clientTransactions.commandes.length === 0 ? (
                <p style={{ color: '#999', textAlign: 'center', padding: '20px' }}>
                  Aucune commande
                </p>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#f8f9fa', borderBottom: '2px solid #e0e0e0' }}>
                        <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600 }}>Date</th>
                        <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600 }}>N° Commande</th>
                        <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600 }}>Quantité</th>
                        <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600 }}>Montant</th>
                        <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600 }}>Statut</th>
                      </tr>
                    </thead>
                    <tbody>
                      {clientTransactions.commandes.map(c => (
                        <tr key={c.id} style={{ borderBottom: '1px solid #e0e0e0' }}>
                          <td style={{ padding: '12px' }}>
                            {new Date(c.date_commande).toLocaleDateString('fr-FR')}
                          </td>
                          <td style={{ padding: '12px', fontWeight: 600 }}>
                            {c.numero_commande || `CMD-${c.id}`}
                          </td>
                          <td style={{ padding: '12px' }}>
                            {parseFloat(c.poids_grammes || 0).toFixed(0)} g
                          </td>
                          <td style={{ padding: '12px', fontWeight: 600 }}>
                            {parseFloat(c.montant_total || 0).toFixed(2)} €
                          </td>
                          <td style={{ padding: '12px' }}>
                            <span style={{
                              ...STATUT_COLORS_COMMANDES[c.statut],
                              padding: '4px 8px', borderRadius: '4px',
                              fontSize: '12px', fontWeight: 600
                            }}>
                              {c.statut}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Ventes */}
            <div>
              <h3>💰 Ventes ({clientTransactions.ventes.length})</h3>
              {clientTransactions.ventes.length === 0 ? (
                <p style={{ color: '#999', textAlign: 'center', padding: '20px' }}>
                  Aucune vente
                </p>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#f8f9fa', borderBottom: '2px solid #e0e0e0' }}>
                        <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600 }}>Date</th>
                        <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600 }}>N° Facture</th>
                        <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600 }}>Quantité</th>
                        <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600 }}>Montant</th>
                        <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600 }}>Paiement</th>
                        <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600 }}>Statut</th>
                      </tr>
                    </thead>
                    <tbody>
                      {clientTransactions.ventes.map(v => (
                        <tr key={v.id} style={{ borderBottom: '1px solid #e0e0e0' }}>
                          <td style={{ padding: '12px' }}>
                            {new Date(v.date_vente).toLocaleDateString('fr-FR')}
                          </td>
                          <td style={{ padding: '12px', fontWeight: 600 }}>
                            {v.numero_facture || '-'}
                          </td>
                          <td style={{ padding: '12px' }}>
                            {parseFloat(v.quantite_grammes || 0).toFixed(0)} g
                          </td>
                          <td style={{ padding: '12px', fontWeight: 600 }}>
                            {parseFloat(v.montant_total || 0).toFixed(2)} €
                          </td>
                          <td style={{ padding: '12px' }}>
                            {v.mode_paiement || '-'}
                          </td>
                          <td style={{ padding: '12px' }}>
                            <span style={{
                              ...STATUT_COLORS_VENTES[v.statut],
                              padding: '4px 8px', borderRadius: '4px',
                              fontSize: '12px', fontWeight: 600
                            }}>
                              {v.statut}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* MODAUX CSV IMPORT */}
      {showClientImportModal && (
        <CSVImportModal
          isOpen={showClientImportModal}
          onClose={() => setShowClientImportModal(false)}
          onImport={handleImportClientsCSV}
          validateFunction={validateClientsCSV}
          title="Importer des clients depuis CSV"
          templateColumns={['type', 'nom', 'prenom', 'raison_sociale', 'email', 'telephone', 'adresse', 'code_postal', 'ville', 'pays', 'siret', 'notes']}
        />
      )}

      {showImportModal && (
        <CSVImportModal
          isOpen={showImportModal}
          onClose={() => setShowImportModal(false)}
          onImport={handleImportVentesCSV}
          validateFunction={validateVentesCSV}
          title="Importer des ventes depuis CSV"
          templateColumns={['client_id', 'date_vente', 'quantite_grammes', 'prix_unitaire_kg', 'mode_paiement', 'statut', 'numero_facture', 'notes']}
        />
      )}

      {/* HEADER */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px'
      }}>
        <h1 style={{ margin: 0 }}>💼 Module Commercial</h1>

        <div style={{ display: 'flex', gap: '10px' }}>
          {activeTab === 'clients' && (
            <>
              <button onClick={() => setShowClientImportModal(true)}
                style={{
                  padding: '10px 20px', border: '1px solid #ddd', borderRadius: '6px',
                  background: 'white', cursor: 'pointer'
                }}>
                📥 Importer CSV
              </button>
              <button onClick={handleExportClientsPDF}
                style={{
                  padding: '10px 20px', border: '1px solid #ddd', borderRadius: '6px',
                  background: 'white', cursor: 'pointer'
                }}>
                📄 Export PDF
              </button>
            </>
          )}

          {activeTab === 'ventes' && (
            <>
              <button onClick={() => setShowImportModal(true)}
                style={{
                  padding: '10px 20px', border: '1px solid #ddd', borderRadius: '6px',
                  background: 'white', cursor: 'pointer'
                }}>
                📥 Importer CSV
              </button>
              <button onClick={exportComptable}
                style={{
                  padding: '10px 20px', border: '1px solid #ddd', borderRadius: '6px',
                  background: '#4caf50', color: 'white', cursor: 'pointer'
                }}>
                📊 Export Comptable
              </button>
            </>
          )}
        </div>
      </div>

      {/* TABS */}
      <div style={{
        display: 'flex', gap: '10px', marginBottom: '30px', borderBottom: '2px solid #e0e0e0'
      }}>
        <button onClick={() => setActiveTab('clients')}
          style={{
            padding: '12px 24px', border: 'none',
            borderBottom: activeTab === 'clients' ? '3px solid #2196f3' : 'none',
            background: activeTab === 'clients' ? '#e3f2fd' : 'transparent',
            color: activeTab === 'clients' ? '#1976d2' : '#666',
            fontWeight: activeTab === 'clients' ? 600 : 400,
            cursor: 'pointer', transition: 'all 0.3s'
          }}>
          👥 Clients ({statsClients.total})
        </button>

        <button onClick={() => setActiveTab('commandes')}
          style={{
            padding: '12px 24px', border: 'none',
            borderBottom: activeTab === 'commandes' ? '3px solid #2196f3' : 'none',
            background: activeTab === 'commandes' ? '#e3f2fd' : 'transparent',
            color: activeTab === 'commandes' ? '#1976d2' : '#666',
            fontWeight: activeTab === 'commandes' ? 600 : 400,
            cursor: 'pointer', transition: 'all 0.3s'
          }}>
          📦 Commandes ({statsCommandes.total})
        </button>

        <button onClick={() => setActiveTab('ventes')}
          style={{
            padding: '12px 24px', border: 'none',
            borderBottom: activeTab === 'ventes' ? '3px solid #2196f3' : 'none',
            background: activeTab === 'ventes' ? '#e3f2fd' : 'transparent',
            color: activeTab === 'ventes' ? '#1976d2' : '#666',
            fontWeight: activeTab === 'ventes' ? 600 : 400,
            cursor: 'pointer', transition: 'all 0.3s'
          }}>
          💰 Ventes ({statsVentes.total})
        </button>

		<button 
		  onClick={() => setActiveTab('analytics')}
		  style={{
			padding: '12px 24px', border: 'none',
			borderBottom: activeTab === 'analytics' ? '3px solid #2196f3' : 'none',
			background: activeTab === 'analytics' ? '#e3f2fd' : 'transparent',
			color: activeTab === 'analytics' ? '#1976d2' : '#666',
			fontWeight: activeTab === 'analytics' ? 600 : 400,
			cursor: 'pointer', transition: 'all 0.3s'
		  }}
		>
		  📊 Analytics
		</button>

      </div>

      {/* CONTENU - ONGLET CLIENTS */}
      {activeTab === 'clients' && (
        <div>
          {/* STATISTIQUES */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '15px', marginBottom: '30px'
          }}>
            <div style={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white', padding: '20px', borderRadius: '12px'
            }}>
              <div style={{ fontSize: '14px', opacity: 0.9 }}>Total Clients</div>
              <div style={{ fontSize: '32px', fontWeight: 700, marginTop: '10px' }}>{statsClients.total}</div>
            </div>

            <div style={{
              background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
              color: 'white', padding: '20px', borderRadius: '12px'
            }}>
              <div style={{ fontSize: '14px', opacity: 0.9 }}>Particuliers</div>
              <div style={{ fontSize: '32px', fontWeight: 700, marginTop: '10px' }}>{statsClients.particuliers}</div>
            </div>

            <div style={{
              background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
              color: 'white', padding: '20px', borderRadius: '12px'
            }}>
              <div style={{ fontSize: '14px', opacity: 0.9 }}>Restaurants</div>
              <div style={{ fontSize: '32px', fontWeight: 700, marginTop: '10px' }}>{statsClients.restaurants}</div>
            </div>

            <div style={{
              background: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
              color: 'white', padding: '20px', borderRadius: '12px'
            }}>
              <div style={{ fontSize: '14px', opacity: 0.9 }}>Grossistes</div>
              <div style={{ fontSize: '32px', fontWeight: 700, marginTop: '10px' }}>{statsClients.grossistes}</div>
            </div>
          </div>

          {/* FILTRES */}
          <div style={{
            background: 'white', padding: '20px', borderRadius: '12px',
            marginBottom: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
          }}>
            <div style={{ display: 'flex', gap: '15px', alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '250px' }}>
                <input type="text" placeholder="🔍 Rechercher (nom, email, ville...)"
                  value={searchTermClient}
                  onChange={(e) => { setSearchTermClient(e.target.value); setCurrentPageClients(1); }}
                  style={{
                    width: '100%', padding: '10px 15px', border: '1px solid #ddd',
                    borderRadius: '6px', fontSize: '14px'
                  }}
                />
              </div>

              <select value={filterTypeClient}
                onChange={(e) => { setFilterTypeClient(e.target.value); setCurrentPageClients(1); }}
                style={{
                  padding: '10px 15px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px'
                }}>
                <option value="all">Tous les types</option>
                <option value="Particulier">Particuliers</option>
                <option value="Restaurant">Restaurants</option>
                <option value="Grossiste">Grossistes</option>
                <option value="Association">Associations</option>
              </select>

              <button onClick={openNewClientModal}
                style={{
                  padding: '10px 20px', border: 'none', borderRadius: '6px',
                  background: '#2196f3', color: 'white', fontWeight: 600,
                  cursor: 'pointer', whiteSpace: 'nowrap'
                }}>
                + Nouveau client
              </button>
            </div>
          </div>

          {/* TABLEAU */}
          <div style={{
            background: 'white', borderRadius: '12px', overflow: 'hidden',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
          }}>
            {filteredClients.length === 0 ? (
              <div style={{ padding: '60px 20px', textAlign: 'center', color: '#999' }}>
                Aucun client trouvé
              </div>
            ) : (
              <>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#f8f9fa' }}>
                        {colonnesValidesClients.map(col => (
                          <th key={col} onClick={() => handleSort(col, 'clients')}
                            style={{
                              padding: '15px', textAlign: 'left', fontWeight: 600,
                              borderBottom: '2px solid #e0e0e0', cursor: 'pointer', userSelect: 'none'
                            }}>
                            {configClients[col].label}
                            <SortIcon column={col} currentSort={sortConfigClients} />
                          </th>
                        ))}
                        <th style={{
                          padding: '15px', textAlign: 'center', fontWeight: 600,
                          borderBottom: '2px solid #e0e0e0'
                        }}>
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedClients.map(client => (
                        <tr key={client.id} style={{ borderBottom: '1px solid #e0e0e0' }}>
                          {colonnesValidesClients.map(col => (
                            <td key={col} style={{ padding: '15px' }}>
                              {renderClientCell(client, col)}
                            </td>
                          ))}
                          <td style={{ padding: '15px', textAlign: 'center' }}>
                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                              <button onClick={() => viewClientTransactions(client)}
                                style={{
                                  padding: '6px 12px', border: '1px solid #2196f3', borderRadius: '4px',
                                  background: 'white', color: '#2196f3', cursor: 'pointer', fontSize: '12px'
                                }} title="Voir les transactions">
                                📊
                              </button>
                              <button onClick={() => handleEditClient(client)}
                                style={{
                                  padding: '6px 12px', border: '1px solid #4caf50', borderRadius: '4px',
                                  background: 'white', color: '#4caf50', cursor: 'pointer', fontSize: '12px'
                                }} title="Modifier">
                                ✏️
                              </button>
                              <button onClick={() => askDeleteClient(client)}
                                style={{
                                  padding: '6px 12px', border: '1px solid #f44336', borderRadius: '4px',
                                  background: 'white', color: '#f44336', cursor: 'pointer', fontSize: '12px'
                                }} title="Supprimer">
                                🗑️
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <PaginationControls
                  currentPage={currentPageClients}
                  setCurrentPage={setCurrentPageClients}
                  totalItems={sortedClients.length}
                  entity="clients"
                />
              </>
            )}
          </div>
        </div>
      )}

      {/* CONTENU - ONGLET COMMANDES */}
      {activeTab === 'commandes' && (
        <div>
          {/* STATISTIQUES */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '15px', marginBottom: '30px'
          }}>
            <div style={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white', padding: '20px', borderRadius: '12px'
            }}>
              <div style={{ fontSize: '14px', opacity: 0.9 }}>Total Commandes</div>
              <div style={{ fontSize: '32px', fontWeight: 700, marginTop: '10px' }}>{statsCommandes.total}</div>
            </div>

            <div style={{
              background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
              color: 'white', padding: '20px', borderRadius: '12px'
            }}>
              <div style={{ fontSize: '14px', opacity: 0.9 }}>En attente</div>
              <div style={{ fontSize: '32px', fontWeight: 700, marginTop: '10px' }}>{statsCommandes.enAttente}</div>
            </div>

            <div style={{
              background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
              color: 'white', padding: '20px', borderRadius: '12px'
            }}>
              <div style={{ fontSize: '14px', opacity: 0.9 }}>Livrées</div>
              <div style={{ fontSize: '32px', fontWeight: 700, marginTop: '10px' }}>{statsCommandes.livrees}</div>
            </div>

            <div style={{
              background: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
              color: 'white', padding: '20px', borderRadius: '12px'
            }}>
              <div style={{ fontSize: '14px', opacity: 0.9 }}>Montant Total</div>
              <div style={{ fontSize: '32px', fontWeight: 700, marginTop: '10px' }}>
                {statsCommandes.montantTotal.toFixed(2)} €
              </div>
            </div>
          </div>

          {/* FILTRES */}
          <div style={{
            background: 'white', padding: '20px', borderRadius: '12px',
            marginBottom: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
          }}>
            <div style={{ display: 'flex', gap: '15px', alignItems: 'center', flexWrap: 'wrap' }}>
              <select value={filterStatutCommande}
                onChange={(e) => { setFilterStatutCommande(e.target.value); setCurrentPageCommandes(1); }}
                style={{
                  padding: '10px 15px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px'
                }}>
                <option value="all">Tous les statuts</option>
                <option value="En attente">En attente</option>
                <option value="Confirmée">Confirmée</option>
                <option value="En préparation">En préparation</option>
                <option value="Livrée">Livrée</option>
                <option value="Annulée">Annulée</option>
              </select>

              <button onClick={openNewCommandeModal}
                style={{
                  padding: '10px 20px', border: 'none', borderRadius: '6px',
                  background: '#2196f3', color: 'white', fontWeight: 600,
                  cursor: 'pointer', marginLeft: 'auto'
                }}>
                + Nouvelle commande
              </button>
            </div>
          </div>

          {/* TABLEAU */}
          <div style={{
            background: 'white', borderRadius: '12px', overflow: 'hidden',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
          }}>
            {filteredCommandes.length === 0 ? (
              <div style={{ padding: '60px 20px', textAlign: 'center', color: '#999' }}>
                Aucune commande trouvée
              </div>
            ) : (
              <>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#f8f9fa' }}>
                        <th onClick={() => handleSort('numero_commande', 'commandes')}
                          style={{ padding: '15px', textAlign: 'left', fontWeight: 600,
                            borderBottom: '2px solid #e0e0e0', cursor: 'pointer' }}>
                          N° Commande
                          <SortIcon column="numero_commande" currentSort={sortConfigCommandes} />
                        </th>
                        <th onClick={() => handleSort('date_commande', 'commandes')}
                          style={{ padding: '15px', textAlign: 'left', fontWeight: 600,
                            borderBottom: '2px solid #e0e0e0', cursor: 'pointer' }}>
                          Date
                          <SortIcon column="date_commande" currentSort={sortConfigCommandes} />
                        </th>
                        <th onClick={() => handleSort('client_id', 'commandes')}
                          style={{ padding: '15px', textAlign: 'left', fontWeight: 600,
                            borderBottom: '2px solid #e0e0e0', cursor: 'pointer' }}>
                          Client
                          <SortIcon column="client_id" currentSort={sortConfigCommandes} />
                        </th>
                        <th style={{ padding: '15px', textAlign: 'left', fontWeight: 600,
                          borderBottom: '2px solid #e0e0e0' }}>
                          Quantité
                        </th>
                        <th style={{ padding: '15px', textAlign: 'left', fontWeight: 600,
                          borderBottom: '2px solid #e0e0e0' }}>
                          Prix/kg
                        </th>
                        <th onClick={() => handleSort('montant_total', 'commandes')}
                          style={{ padding: '15px', textAlign: 'left', fontWeight: 600,
                            borderBottom: '2px solid #e0e0e0', cursor: 'pointer' }}>
                          Total
                          <SortIcon column="montant_total" currentSort={sortConfigCommandes} />
                        </th>
                        <th onClick={() => handleSort('statut', 'commandes')}
                          style={{ padding: '15px', textAlign: 'left', fontWeight: 600,
                            borderBottom: '2px solid #e0e0e0', cursor: 'pointer' }}>
                          Statut
                          <SortIcon column="statut" currentSort={sortConfigCommandes} />
                        </th>
                        <th style={{ padding: '15px', textAlign: 'center', fontWeight: 600,
                          borderBottom: '2px solid #e0e0e0' }}>
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedCommandes.map(commande => (
                        <tr key={commande.id} style={{ borderBottom: '1px solid #e0e0e0' }}>
                          <td style={{ padding: '15px', fontWeight: 600 }}>
                            {commande.numero_commande || `CMD-${commande.id}`}
                          </td>
                          <td style={{ padding: '15px' }}>
                            {new Date(commande.date_commande).toLocaleDateString('fr-FR')}
                          </td>
                          <td style={{ padding: '15px' }}>
                            {getClientName(commande.client_id)}
                          </td>
                          <td style={{ padding: '15px' }}>
                            {parseFloat(commande.poids_grammes || 0).toFixed(0)} g
                          </td>
                          <td style={{ padding: '15px' }}>
                            {parseFloat(commande.prix_unitaire_kg || 0).toFixed(2)} €
                          </td>
                          <td style={{ padding: '15px', fontWeight: 600 }}>
                            {parseFloat(commande.montant_total || 0).toFixed(2)} €
                          </td>
                          <td style={{ padding: '15px' }}>
                            <span style={{
                              ...STATUT_COLORS_COMMANDES[commande.statut],
                              padding: '4px 8px', borderRadius: '4px',
                              fontSize: '12px', fontWeight: 600
                            }}>
                              {commande.statut}
                            </span>
                          </td>
                          <td style={{ padding: '15px', textAlign: 'center' }}>
                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                              {commande.statut !== 'Annulée' && (
                                <button onClick={() => sendCommandeConfirmation(commande)}
                                  style={{
                                    padding: '6px 12px', border: '1px solid #2196f3', borderRadius: '4px',
                                    background: 'white', color: '#2196f3', cursor: 'pointer', fontSize: '12px'
                                  }} title="Envoyer email">
                                  ✉️
                                </button>
                              )}
                              <button onClick={() => handleEditCommande(commande)}
                                style={{
                                  padding: '6px 12px', border: '1px solid #4caf50', borderRadius: '4px',
                                  background: 'white', color: '#4caf50', cursor: 'pointer', fontSize: '12px'
                                }} title="Modifier">
                                ✏️
                              </button>
                              <button onClick={() => askDeleteCommande(commande)}
                                style={{
                                  padding: '6px 12px', border: '1px solid #f44336', borderRadius: '4px',
                                  background: 'white', color: '#f44336', cursor: 'pointer', fontSize: '12px'
                                }} title="Supprimer">
                                🗑️
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <PaginationControls
                  currentPage={currentPageCommandes}
                  setCurrentPage={setCurrentPageCommandes}
                  totalItems={sortedCommandes.length}
                  entity="commandes"
                />
              </>
            )}
          </div>
        </div>
      )}

      {/* CONTENU - ONGLET VENTES */}
      {activeTab === 'ventes' && (
        <div>
          {/* STATISTIQUES */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '15px', marginBottom: '30px'
          }}>
            <div style={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white', padding: '20px', borderRadius: '12px'
            }}>
              <div style={{ fontSize: '14px', opacity: 0.9 }}>Total Ventes</div>
              <div style={{ fontSize: '32px', fontWeight: 700, marginTop: '10px' }}>{statsVentes.total}</div>
            </div>

            <div style={{
              background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
              color: 'white', padding: '20px', borderRadius: '12px'
            }}>
              <div style={{ fontSize: '14px', opacity: 0.9 }}>Payées</div>
              <div style={{ fontSize: '32px', fontWeight: 700, marginTop: '10px' }}>{statsVentes.payees}</div>
            </div>

            <div style={{
              background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
              color: 'white', padding: '20px', borderRadius: '12px'
            }}>
              <div style={{ fontSize: '14px', opacity: 0.9 }}>En attente</div>
              <div style={{ fontSize: '32px', fontWeight: 700, marginTop: '10px' }}>{statsVentes.enAttente}</div>
            </div>

            <div style={{
              background: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
              color: 'white', padding: '20px', borderRadius: '12px'
            }}>
              <div style={{ fontSize: '14px', opacity: 0.9 }}>Chiffre d'Affaires</div>
              <div style={{ fontSize: '32px', fontWeight: 700, marginTop: '10px' }}>
                {statsVentes.chiffreAffaires.toFixed(2)} €
              </div>
            </div>
          </div>

          {/* FILTRES */}
          <div style={{
            background: 'white', padding: '20px', borderRadius: '12px',
            marginBottom: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
          }}>
            <div style={{ display: 'flex', gap: '15px', alignItems: 'center', flexWrap: 'wrap' }}>
              <select value={filterStatutVente}
                onChange={(e) => { setFilterStatutVente(e.target.value); setCurrentPageVentes(1); }}
                style={{
                  padding: '10px 15px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px'
                }}>
                <option value="all">Tous les statuts</option>
                <option value="En attente">En attente</option>
                <option value="Payée">Payée</option>
                <option value="Annulée">Annulée</option>
              </select>

              <button onClick={openNewVenteModal}
                style={{
                  padding: '10px 20px', border: 'none', borderRadius: '6px',
                  background: '#2196f3', color: 'white', fontWeight: 600,
                  cursor: 'pointer', marginLeft: 'auto'
                }}>
                + Nouvelle vente
              </button>
            </div>
          </div>

          {/* TABLEAU */}
          <div style={{
            background: 'white', borderRadius: '12px', overflow: 'hidden',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
          }}>
            {filteredVentes.length === 0 ? (
              <div style={{ padding: '60px 20px', textAlign: 'center', color: '#999' }}>
                Aucune vente trouvée
              </div>
            ) : (
              <>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#f8f9fa' }}>
                        <th onClick={() => handleSort('numero_facture', 'ventes')}
                          style={{ padding: '15px', textAlign: 'left', fontWeight: 600,
                            borderBottom: '2px solid #e0e0e0', cursor: 'pointer' }}>
                          N° Facture
                          <SortIcon column="numero_facture" currentSort={sortConfigVentes} />
                        </th>
                        <th onClick={() => handleSort('date_vente', 'ventes')}
                          style={{ padding: '15px', textAlign: 'left', fontWeight: 600,
                            borderBottom: '2px solid #e0e0e0', cursor: 'pointer' }}>
                          Date
                          <SortIcon column="date_vente" currentSort={sortConfigVentes} />
                        </th>
                        <th style={{ padding: '15px', textAlign: 'left', fontWeight: 600,
                          borderBottom: '2px solid #e0e0e0' }}>
                          Client
                        </th>
                        <th style={{ padding: '15px', textAlign: 'left', fontWeight: 600,
                          borderBottom: '2px solid #e0e0e0' }}>
                          Quantité
                        </th>
                        <th style={{ padding: '15px', textAlign: 'left', fontWeight: 600,
                          borderBottom: '2px solid #e0e0e0' }}>
                          Prix/kg
                        </th>
                        <th onClick={() => handleSort('montant_total', 'ventes')}
                          style={{ padding: '15px', textAlign: 'left', fontWeight: 600,
                            borderBottom: '2px solid #e0e0e0', cursor: 'pointer' }}>
                          Total
                          <SortIcon column="montant_total" currentSort={sortConfigVentes} />
                        </th>
                        <th style={{ padding: '15px', textAlign: 'left', fontWeight: 600,
                          borderBottom: '2px solid #e0e0e0' }}>
                          Paiement
                        </th>
                        <th onClick={() => handleSort('statut', 'ventes')}
                          style={{ padding: '15px', textAlign: 'left', fontWeight: 600,
                            borderBottom: '2px solid #e0e0e0', cursor: 'pointer' }}>
                          Statut
                          <SortIcon column="statut" currentSort={sortConfigVentes} />
                        </th>
                        <th style={{ padding: '15px', textAlign: 'center', fontWeight: 600,
                          borderBottom: '2px solid #e0e0e0' }}>
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedVentes.map(vente => (
                        <tr key={vente.id} style={{ borderBottom: '1px solid #e0e0e0' }}>
                          <td style={{ padding: '15px', fontWeight: 600 }}>
                            {vente.numero_facture || '-'}
                          </td>
                          <td style={{ padding: '15px' }}>
                            {new Date(vente.date_vente).toLocaleDateString('fr-FR')}
                          </td>
                          <td style={{ padding: '15px' }}>
                            {getClientName(vente.client_id)}
                          </td>
                          <td style={{ padding: '15px' }}>
                            {parseFloat(vente.quantite_grammes || 0).toFixed(0)} g
                          </td>
                          <td style={{ padding: '15px' }}>
                            {parseFloat(vente.prix_unitaire_kg || 0).toFixed(2)} €
                          </td>
                          <td style={{ padding: '15px', fontWeight: 600 }}>
                            {parseFloat(vente.montant_total || 0).toFixed(2)} €
                          </td>
                          <td style={{ padding: '15px' }}>
                            {vente.mode_paiement || '-'}
                          </td>
                          <td style={{ padding: '15px' }}>
                            <span style={{
                              ...STATUT_COLORS_VENTES[vente.statut],
                              padding: '4px 8px', borderRadius: '4px',
                              fontSize: '12px', fontWeight: 600
                            }}>
                              {vente.statut}
                            </span>
                          </td>
                          <td style={{ padding: '15px', textAlign: 'center' }}>
                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                              <button onClick={() => handleEditVente(vente)}
                                style={{
                                  padding: '6px 12px', border: '1px solid #4caf50', borderRadius: '4px',
                                  background: 'white', color: '#4caf50', cursor: 'pointer', fontSize: '12px'
                                }} title="Modifier">
                                ✏️
                              </button>
                              <button onClick={() => askDeleteVente(vente)}
                                style={{
                                  padding: '6px 12px', border: '1px solid #f44336', borderRadius: '4px',
                                  background: 'white', color: '#f44336', cursor: 'pointer', fontSize: '12px'
                                }} title="Supprimer">
                                🗑️
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <PaginationControls
                  currentPage={currentPageVentes}
                  setCurrentPage={setCurrentPageVentes}
                  totalItems={sortedVentes.length}
                  entity="ventes"
                />
              </>
            )}
          </div>
        </div>
      )}

      {/* CONTENU - ONGLET ANALYTICS */}
      {activeTab === 'analytics' && (
        <div>
          <h2 style={{ marginBottom: '30px' }}>📊 Tableau de Bord Analytique</h2>

          {/* CA PAR MOIS */}
          <div style={{
            background: 'white', padding: '30px', borderRadius: '12px',
            marginBottom: '30px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
          }}>
            <h3 style={{ marginTop: 0 }}>Évolution du Chiffre d'Affaires (12 derniers mois)</h3>
            {analyticsData.caParMois.length > 0 ? (
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={analyticsData.caParMois}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="mois" />
                  <YAxis />
                  <Tooltip formatter={(value) => `${value.toFixed(2)} €`} />
                  <Legend />
                  <Line type="monotone" dataKey="ca" stroke="#2196f3" strokeWidth={3}
                    name="CA (€)" dot={{ fill: '#2196f3', r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p style={{ textAlign: 'center', color: '#999', padding: '40px' }}>
                Aucune vente payée pour générer le graphique
              </p>
            )}
          </div>

          {/* TOP 10 CLIENTS */}
          <div style={{
            background: 'white', padding: '30px', borderRadius: '12px',
            marginBottom: '30px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
          }}>
            <h3 style={{ marginTop: 0 }}>Top 10 Clients par CA</h3>
            {analyticsData.topClients.length > 0 ? (
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={analyticsData.topClients} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="client" type="category" width={150} />
                  <Tooltip formatter={(value) => `${value.toFixed(2)} €`} />
                  <Legend />
                  <Bar dataKey="ca" fill="#4caf50" name="CA (€)" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p style={{ textAlign: 'center', color: '#999', padding: '40px' }}>
                Aucune donnée disponible
              </p>
            )}
          </div>

          {/* RÉPARTITION PAR STATUT */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '30px'
          }}>
            <div style={{
              background: 'white', padding: '30px', borderRadius: '12px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
            }}>
              <h3 style={{ marginTop: 0 }}>Répartition des Ventes</h3>
              {analyticsData.ventesParStatut.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie data={analyticsData.ventesParStatut} dataKey="count" nameKey="statut"
                      cx="50%" cy="50%" outerRadius={100} label>
                      {analyticsData.ventesParStatut.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS_PIE_CHART[index % COLORS_PIE_CHART.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p style={{ textAlign: 'center', color: '#999' }}>Aucune donnée</p>
              )}
            </div>

            <div style={{
              background: 'white', padding: '30px', borderRadius: '12px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
            }}>
              <h3 style={{ marginTop: 0 }}>Répartition des Commandes</h3>
              {analyticsData.commandesParStatut.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie data={analyticsData.commandesParStatut} dataKey="count" nameKey="statut"
                      cx="50%" cy="50%" outerRadius={100} label>
                      {analyticsData.commandesParStatut.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS_PIE_CHART[index % COLORS_PIE_CHART.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p style={{ textAlign: 'center', color: '#999' }}>Aucune donnée</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Commercial;
