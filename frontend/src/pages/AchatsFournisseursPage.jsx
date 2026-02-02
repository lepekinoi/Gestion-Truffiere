// ============================================================
// AchatsFournisseursPage.jsx - Module Achats et Fournisseurs
// Version: 2.5.0 - ENUMs + Statut + Emojis (PRODUCTION)
// Date: 2 février 2026 - 01h35
// Status: ✅ PRODUCTION READY - Migration DB effectuée
// ============================================================

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

// ============================================================
// CONFIGURATION
// ============================================================

const STATUT_FOURNISSEUR_COLORS = {
  'Actif': { background: '#d4edda', color: '#155724', border: '#28a745' },
  'Inactif': { background: '#f8d7da', color: '#721c24', border: '#dc3545' },
  'Suspendu': { background: '#fff3cd', color: '#856404', border: '#ffc107' }
};

const STATUT_COMMANDE_COLORS = {
  'En attente': { background: '#fff3cd', color: '#856404', border: '#ffc107' },
  'Confirmée': { background: '#cce5ff', color: '#004085', border: '#007bff' },
  'Expédiée': { background: '#d1ecf1', color: '#0c5460', border: '#17a2b8' },
  'Livrée': { background: '#d4edda', color: '#155724', border: '#28a745' },
  'Réceptionnée': { background: '#d4edda', color: '#155724', border: '#28a745' },
  'Annulée': { background: '#f8d7da', color: '#721c24', border: '#dc3545' }
};

const COLORS_PIE_CHART = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

// ✅ NOUVEAUX ENUMS HARMONISÉS AVEC LA BASE PostgreSQL ET RÉCOLTES
const CALIBRES_TEXTE = [
  'Petit (moins de 20g)',
  'Moyen (20-50g)',
  'Gros (50-100g)',
  'Très gros (plus de 100g)'
];

const QUALITES = [
  'Extra',
  'Première catégorie',
  'Deuxième catégorie',
  'Pourrie'
];

const MATURITES = [
  'Immature',
  'À point',
  'Mature',
  'Très mature'
];

// ============================================================
// COMPOSANTS UI RÉUTILISABLES
// ============================================================

const StatsCard = ({ label, value, color }) => (
  <div style={{
    background: 'white',
    padding: '20px',
    borderRadius: '8px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    textAlign: 'center'
  }}>
    <div style={{ fontSize: '12px', color: '#666', marginBottom: '10px', fontWeight: '600' }}>
      {label}
    </div>
    <div style={{ fontSize: '32px', fontWeight: 'bold', color: color }}>
      {value}
    </div>
  </div>
);

const StatusBadge = ({ statut, type }) => {
  const colors = type === 'fournisseur' ? STATUT_FOURNISSEUR_COLORS : STATUT_COMMANDE_COLORS;
  const style = colors[statut] || { background: '#e0e0e0', color: '#666' };
  
  return (
    <span style={{
      display: 'inline-block',
      padding: '4px 10px',
      borderRadius: '4px',
      fontSize: '12px',
      fontWeight: '600',
      backgroundColor: style.background,
      color: style.color
    }}>
      {statut}
    </span>
  );
};

// ============================================================
// COMPOSANT PRINCIPAL
// ============================================================

function AchatsFournisseursPage() {
  // ==================== ÉTATS ====================
  const [activeTab, setActiveTab] = useState('fournisseurs');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [confirmModal, setConfirmModal] = useState(null);
  
  // Fournisseurs
  const [fournisseurs, setFournisseurs] = useState([]);
  const [showFournisseurModal, setShowFournisseurModal] = useState(false);
  const [editingFournisseur, setEditingFournisseur] = useState(null);
  const [filterZone, setFilterZone] = useState('all');
  const [filterStatutFournisseur, setFilterStatutFournisseur] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPageFournisseurs, setCurrentPageFournisseurs] = useState(1);
  const [fournisseurFormData, setFournisseurFormData] = useState({
    nom: '',
    zone_production: '',
    email: '',
    telephone: '',
    adresse: '',
    code_postal: '',
    ville: '',
    pays: 'France',
    certifications: '',
    statut: 'Actif',
    prix_moyen_kg: '',
    notes: ''
  });
  
  // Commandes d'achat
  const [commandes, setCommandes] = useState([]);
  const [showCommandeModal, setShowCommandeModal] = useState(false);
  const [editingCommande, setEditingCommande] = useState(null);
  const [filterStatutCommande, setFilterStatutCommande] = useState('all');
  const [currentPageCommandes, setCurrentPageCommandes] = useState(1);
  const [commandeFormData, setCommandeFormData] = useState({
    fournisseur_id: '',
    date_commande: new Date().toISOString().split('T')[0],
    date_livraison_prevue: '',
    statut: 'En attente',
    notes: ''
  });
  
  // NOUVEAU: Gestion des lignes de commande
  const [commandeLignes, setCommandeLignes] = useState([]);
  const [nouvelleLigne, setNouvelleLigne] = useState({
    calibre: '',
    qualite: '',
    maturite: 'À point', // Valeur par défaut conforme
    quantite_kg: '',
    prix_achat_kg: '',
    notes: ''
  });
  // NOUVEAU: État pour l'édition de ligne
  const [editingLigneIndex, setEditingLigneIndex] = useState(null);

  
  // Stock
  const [stock, setStock] = useState([]);
  const [filterCalibre, setFilterCalibre] = useState('all');
  const [filterQualite, setFilterQualite] = useState('all');
  
  // Marges
  const [margeData, setMargeData] = useState({
    globale: {},
    parCalibre: [],
    parFournisseur: []
  });
  
  // ==================== EFFECTS ====================
  
  useEffect(() => {
    loadData();
  }, []);
  
  // ==================== FONCTIONS UTILITAIRES ====================
  
  const showMessage = (text, type = 'success') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 4000);
  };
  
  const loadData = async () => {
    try {
      setLoading(true);
      const [fournisseursRes, commandesRes, stockRes] = await Promise.all([
        axios.get(`${API_URL}/fournisseurs`).catch(() => ({ data: [] })),
        axios.get(`${API_URL}/commandes-achats`).catch(() => ({ data: [] })),
        axios.get(`${API_URL}/stock-disponible`).catch(() => ({ data: [] }))
      ]);
      
      setFournisseurs(Array.isArray(fournisseursRes.data) ? fournisseursRes.data : fournisseursRes.data.data || []);
      setCommandes(Array.isArray(commandesRes.data) ? commandesRes.data : commandesRes.data.data || []);
      setStock(Array.isArray(stockRes.data) ? stockRes.data : stockRes.data.data || []);
      
      // Charger les marges si disponible
      try {
        const margeRes = await axios.get(`${API_URL}/marge-globale`);
        setMargeData(prev => ({ ...prev, globale: margeRes.data }));
      } catch (error) {
        console.warn('Marges non disponibles:', error.message);
      }
      
      setLoading(false);
    } catch (error) {
      console.error('Erreur chargement:', error);
      showMessage('Erreur lors du chargement des données', 'error');
      setLoading(false);
    }
  };
  
  const getFournisseurName = (fournisseurId) => {
    const fournisseur = fournisseurs.find(f => f.id === fournisseurId);
    return fournisseur ? fournisseur.nom : '-';
  };
  
  // ==================== GESTION FOURNISSEURS ====================
  
  const openNewFournisseurModal = () => {
    setEditingFournisseur(null);
    setFournisseurFormData({
      nom: '',
      zone_production: '',
      email: '',
      telephone: '',
      adresse: '',
      code_postal: '',
      ville: '',
      pays: 'France',
      certifications: '',
      statut: 'Actif',
      prix_moyen_kg: '',
      notes: ''
    });
    setShowFournisseurModal(true);
  };
  
  const handleEditFournisseur = (fournisseur) => {
    setEditingFournisseur(fournisseur);
    setFournisseurFormData({ ...fournisseur });
    setShowFournisseurModal(true);
  };
  
  const handleFournisseurInputChange = (e) => {
    const { name, value } = e.target;
    setFournisseurFormData(prev => ({ ...prev, [name]: value }));
  };
  
  const handleFournisseurSubmit = async (e) => {
    e.preventDefault();
    setIsProcessing(true);
    
    try {
      if (editingFournisseur) {
        await axios.put(`${API_URL}/fournisseurs/${editingFournisseur.id}`, fournisseurFormData);
        showMessage('Fournisseur modifié avec succès !', 'success');
      } else {
        await axios.post(`${API_URL}/fournisseurs`, fournisseurFormData);
        showMessage('Fournisseur créé avec succès !', 'success');
      }
      
      await loadData();
      setShowFournisseurModal(false);
    } catch (error) {
      console.error('Erreur:', error);
      showMessage('Erreur lors de l\'enregistrement', 'error');
    } finally {
      setIsProcessing(false);
    }
  };
  
  const askDeleteFournisseur = (fournisseur) => {
    setConfirmModal({
      type: 'delete-fournisseur',
      item: fournisseur,
      title: 'Confirmer la suppression',
      message: `Êtes-vous sûr de vouloir supprimer le fournisseur "${fournisseur.nom}" ?`,
      confirmText: 'Supprimer',
      confirmColor: '#f44336'
    });
  };
  
  const doDeleteFournisseur = async (fournisseur) => {
    setIsProcessing(true);
    try {
      await axios.delete(`${API_URL}/fournisseurs/${fournisseur.id}`);
      showMessage('Fournisseur supprimé avec succès', 'success');
      await loadData();
    } catch (error) {
      console.error('Erreur:', error);
      showMessage('Erreur lors de la suppression', 'error');
    } finally {
      setIsProcessing(false);
      setConfirmModal(null);
    }
  };
  
  // ==================== GESTION COMMANDES ====================
  
  const openNewCommandeModal = () => {
    setEditingCommande(null);
    setCommandeFormData({
      fournisseur_id: '',
      date_commande: new Date().toISOString().split('T')[0],
      date_livraison_prevue: '',
      statut: 'En attente',
      notes: ''
    });
    setCommandeLignes([]);
    setNouvelleLigne({
      calibre: '',
      qualite: '',
      maturite: 'À point',
      quantite_kg: '',
      prix_achat_kg: '',
      notes: ''
    });
    setShowCommandeModal(true);
  };
  
  const handleEditCommande = async (commande) => {
    setEditingCommande(commande);
    setCommandeFormData({
      fournisseur_id: commande.fournisseur_id,
      date_commande: commande.date_commande?.split('T')[0] || '',
      date_livraison_prevue: commande.date_livraison_prevue?.split('T')[0] || '',
      statut: commande.statut || 'En attente',
      notes: commande.notes || ''
    });

    try {
      const response = await axios.get(`${API_URL}/commandes-achats/${commande.id}`);
      if (response.data && response.data.lignes) {
        setCommandeLignes(response.data.lignes);
        console.log(`✅ ${response.data.lignes.length} ligne(s) chargée(s)`);
      } else {
        setCommandeLignes([]);
      }
    } catch (error) {
      console.error('Erreur chargement lignes:', error);
      showMessage('Impossible de charger les lignes de commande', 'error');
      setCommandeLignes([]);
    }

    setEditingLigneIndex(null);
    setNouvelleLigne({
      calibre: '',
      qualite: '',
      maturite: 'À point',
      quantite_kg: '',
      prix_achat_kg: '',
      notes: ''
    });

    setShowCommandeModal(true);
  };
  
  const handleCommandeInputChange = (e) => {
    const { name, value } = e.target;
    setCommandeFormData(prev => ({ ...prev, [name]: value }));
  };
  
  // NOUVEAU: Gestion des lignes de commande
  const handleNouvelleLigneChange = (e) => {
    const { name, value } = e.target;
    setNouvelleLigne(prev => ({ ...prev, [name]: value }));
  };
  const handleKeyDownLigne = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      ajouterLigne();
    }
  };

  
    const ajouterLigne = () => {
    if (!nouvelleLigne.calibre || !nouvelleLigne.qualite || !nouvelleLigne.quantite_kg || !nouvelleLigne.prix_achat_kg) {
      showMessage('Veuillez remplir tous les champs obligatoires de la ligne', 'error');
      return;
    }

    if (editingLigneIndex !== null) {
      setCommandeLignes(prev => prev.map((ligne, i) => 
        i === editingLigneIndex ? { ...nouvelleLigne } : ligne
      ));
      showMessage('Ligne modifiée !', 'success');
      setEditingLigneIndex(null);
    } else {
      setCommandeLignes(prev => [...prev, { ...nouvelleLigne }]);
      showMessage('Ligne ajoutée !', 'success');
    }

    setNouvelleLigne({
      calibre: '',
      qualite: '',
      maturite: 'À point',
      quantite_kg: '',
      prix_achat_kg: '',
      notes: ''
    });
  };
  
  const modifierLigne = (index) => {
    const ligne = commandeLignes[index];
    setNouvelleLigne({ ...ligne });
    setEditingLigneIndex(index);
    showMessage('Ligne chargée pour modification', 'info');
  };

  const annulerEditionLigne = () => {
    setNouvelleLigne({
      calibre: '',
      qualite: '',
      maturite: 'À point',
      quantite_kg: '',
      prix_achat_kg: '',
      notes: ''
    });
    setEditingLigneIndex(null);
    showMessage('Édition annulée', 'info');
  };

  const supprimerLigne = (index) => {
    if (editingLigneIndex === index) {
      annulerEditionLigne();
    } else if (editingLigneIndex !== null && editingLigneIndex > index) {
      setEditingLigneIndex(editingLigneIndex - 1);
    }
    setCommandeLignes(prev => prev.filter((_, i) => i !== index));
    showMessage('Ligne supprimée', 'info');
  };
  
  const calculerMontantTotal = () => {
    return commandeLignes.reduce((sum, ligne) => {
      return sum + (parseFloat(ligne.quantite_kg) * parseFloat(ligne.prix_achat_kg));
    }, 0);
  };
  
  const handleCommandeSubmit = async (e) => {
    e.preventDefault();
    
    if (commandeLignes.length === 0) {
      showMessage('Veuillez ajouter au moins une ligne de commande', 'error');
      return;
    }
    
    setIsProcessing(true);
    
    try {
      const dataToSend = {
        ...commandeFormData,
        lignes: commandeLignes
      };
      
      console.log('Envoi des données:', dataToSend);
      
      if (editingCommande) {
        await axios.put(`${API_URL}/commandes-achats/${editingCommande.id}`, dataToSend);
        showMessage('Commande modifiée avec succès !', 'success');
      } else {
        await axios.post(`${API_URL}/commandes-achats`, dataToSend);
        showMessage('Commande créée avec succès !', 'success');
      }
      
      await loadData();
      setShowCommandeModal(false);
    } catch (error) {
      console.error('Erreur:', error);
      showMessage(error.response?.data?.error || 'Erreur lors de l\'enregistrement', 'error');
    } finally {
      setIsProcessing(false);
    }
  };
  
  const askDeleteCommande = (commande) => {
    setConfirmModal({
      type: 'delete-commande',
      item: commande,
      title: 'Confirmer la suppression',
      message: `Êtes-vous sûr de vouloir supprimer la commande "${commande.numero_commande}" ?`,
      confirmText: 'Supprimer',
      confirmColor: '#f44336'
    });
  };
  
  const doDeleteCommande = async (commande) => {
    setIsProcessing(true);
    try {
      await axios.delete(`${API_URL}/commandes-achats/${commande.id}`);
      showMessage('Commande supprimée avec succès', 'success');
      await loadData();
    } catch (error) {
      console.error('Erreur:', error);
      showMessage('Erreur lors de la suppression', 'error');
    } finally {
      setIsProcessing(false);
      setConfirmModal(null);
    }
  };
  
  // ==================== MODAL CONFIRMATION ====================
  
  const handleConfirm = () => {
    if (!confirmModal) return;
    
    if (confirmModal.type === 'delete-fournisseur') {
      doDeleteFournisseur(confirmModal.item);
    } else if (confirmModal.type === 'delete-commande') {
      doDeleteCommande(confirmModal.item);
    }
  };
  
  // ==================== FILTRAGE & PAGINATION ====================
  
  const filteredFournisseurs = fournisseurs.filter(f => {
    const matchZone = filterZone === 'all' || f.zone_production === filterZone;
    const matchStatut = filterStatutFournisseur === 'all' || f.statut === filterStatutFournisseur;
    const searchLower = searchTerm.toLowerCase();
    const matchSearch = !searchTerm ||
      f.nom?.toLowerCase().includes(searchLower) ||
      f.email?.toLowerCase().includes(searchLower) ||
      f.ville?.toLowerCase().includes(searchLower);
    return matchZone && matchStatut && matchSearch;
  });
  
  const filteredCommandes = commandes.filter(c =>
    filterStatutCommande === 'all' || c.statut === filterStatutCommande
  );
  
  const filteredStock = stock.filter(s => {
    const matchCalibre = filterCalibre === 'all' || s.calibre === parseInt(filterCalibre);
    const matchQualite = filterQualite === 'all' || s.qualite === filterQualite;
    return matchCalibre && matchQualite;
  });
  
  const itemsPerPage = 20;
  const paginatedFournisseurs = filteredFournisseurs.slice(
    (currentPageFournisseurs - 1) * itemsPerPage,
    currentPageFournisseurs * itemsPerPage
  );
  
  const paginatedCommandes = filteredCommandes.slice(
    (currentPageCommandes - 1) * itemsPerPage,
    currentPageCommandes * itemsPerPage
  );
  
  // ==================== STATISTIQUES ====================
  
  const statsFournisseurs = {
    total: fournisseurs.length,
    actifs: fournisseurs.filter(f => f.statut === 'Actif').length,
    zones: new Set(fournisseurs.map(f => f.zone_production).filter(Boolean)).size,
    certifies: fournisseurs.filter(f => f.certifications).length
  };
  
  const statsCommandes = {
    total: commandes.length,
    enAttente: commandes.filter(c => c.statut === 'En attente').length,
    livrees: commandes.filter(c => c.statut === 'Livrée' || c.statut === 'Réceptionnée').length,
    montantTotal: commandes.reduce((sum, c) => sum + parseFloat(c.montant_total || 0), 0)
  };
  
  const statsStock = {
    totalKg: stock.reduce((sum, s) => sum + parseFloat(s.quantite_kg_stock || 0), 0),
    nbLots: stock.length,
    alertes: stock.filter(s => {
      if (!s.date_limite_consommation) return false;
      const jours = Math.floor((new Date(s.date_limite_consommation) - new Date()) / (1000 * 60 * 60 * 24));
      return jours <= 7;
    }).length
  };
  
  // ==================== LOADING ====================
  
  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
        <div>Chargement des données d'achats...</div>
      </div>
    );
  }
  
  // ==================== RENDER ====================
  
  return (
    <div className="achats-container" style={{ padding: '20px', maxWidth: '1600px', margin: '0 auto' }}>
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
      
      {/* EN-TÊTE */}
      <div style={{ marginBottom: '30px' }}>
        <h1 style={{ margin: 0, fontSize: '28px', color: '#333' }}>
          🛒 Gestion des Achats de Truffes
        </h1>
        <p style={{ margin: '5px 0 0 0', color: '#666', fontSize: '14px' }}>
          Gestion complète des fournisseurs, commandes d'achat, stock et marges
        </p>
      </div>
      
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
          onClick={() => setActiveTab('fournisseurs')}
          style={{
            padding: '12px 24px',
            border: 'none',
            borderBottom: activeTab === 'fournisseurs' ? '3px solid #2196f3' : 'none',
            background: activeTab === 'fournisseurs' ? '#e3f2fd' : 'transparent',
            color: activeTab === 'fournisseurs' ? '#1976d2' : '#666',
            fontWeight: activeTab === 'fournisseurs' ? 600 : 400,
            cursor: 'pointer',
            transition: 'all 0.3s'
          }}
        >
          👥 Fournisseurs ({statsFournisseurs.total})
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
          📦 Commandes ({statsCommandes.total})
        </button>
        
        <button
          onClick={() => setActiveTab('stock')}
          style={{
            padding: '12px 24px',
            border: 'none',
            borderBottom: activeTab === 'stock' ? '3px solid #2196f3' : 'none',
            background: activeTab === 'stock' ? '#e3f2fd' : 'transparent',
            color: activeTab === 'stock' ? '#1976d2' : '#666',
            fontWeight: activeTab === 'stock' ? 600 : 400,
            cursor: 'pointer',
            transition: 'all 0.3s'
          }}
        >
          📊 Stock ({statsStock.nbLots})
        </button>
        
        <button
          onClick={() => setActiveTab('marge')}
          style={{
            padding: '12px 24px',
            border: 'none',
            borderBottom: activeTab === 'marge' ? '3px solid #2196f3' : 'none',
            background: activeTab === 'marge' ? '#e3f2fd' : 'transparent',
            color: activeTab === 'marge' ? '#1976d2' : '#666',
            fontWeight: activeTab === 'marge' ? 600 : 400,
            cursor: 'pointer',
            transition: 'all 0.3s'
          }}
        >
          💰 Marge & Rentabilité
        </button>
      </div>
      
      {/* ============================================================ */}
      {/* ONGLET FOURNISSEURS */}
      {/* ============================================================ */}
      {activeTab === 'fournisseurs' && (
        <div>
          {/* STATS FOURNISSEURS */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '15px',
            marginBottom: '30px'
          }}>
            <StatsCard
              label="✅ FOURNISSEURS ACTIFS"
              value={statsFournisseurs.actifs}
              color="#28a745"
            />
            <StatsCard
              label="👥 TOUS LES FOURNISSEURS"
              value={statsFournisseurs.total}
              color="#2196f3"
            />
            <StatsCard
              label="🗺️ ZONES COUVERTES"
              value={statsFournisseurs.zones}
              color="#ff9800"
            />
            <StatsCard
              label="🏆 CERTIFICATIONS"
              value={statsFournisseurs.certifies}
              color="#9c27b0"
            />
          </div>
          
          {/* CONTRÔLES FOURNISSEURS */}
          <div style={{
            display: 'flex',
            gap: '15px',
            marginBottom: '20px',
            flexWrap: 'wrap',
            alignItems: 'center'
          }}>
            <button
              onClick={openNewFournisseurModal}
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
              ➕ Nouveau Fournisseur
            </button>
            
            <select
              value={filterZone}
              onChange={(e) => {
                setFilterZone(e.target.value);
                setCurrentPageFournisseurs(1);
              }}
              style={{
                padding: '10px 15px',
                border: '1px solid #ddd',
                borderRadius: '6px'
              }}
            >
              <option value="all">Toutes les zones</option>
              <option value="Drôme">Drôme</option>
              <option value="Vaucluse">Vaucluse</option>
              <option value="Var">Var</option>
              <option value="Alpes-de-Haute-Provence">Alpes-de-Haute-Provence</option>
            </select>
            
            <select
              value={filterStatutFournisseur}
              onChange={(e) => {
                setFilterStatutFournisseur(e.target.value);
                setCurrentPageFournisseurs(1);
              }}
              style={{
                padding: '10px 15px',
                border: '1px solid #ddd',
                borderRadius: '6px'
              }}
            >
              <option value="all">Tous les statuts</option>
              <option value="Actif">Actif</option>
              <option value="Inactif">Inactif</option>
              <option value="Suspendu">Suspendu</option>
            </select>
            
            <input
              type="text"
              placeholder="Rechercher un fournisseur..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPageFournisseurs(1);
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
          
          {/* TABLEAU FOURNISSEURS */}
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
                  <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600 }}>Nom</th>
                  <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600 }}>Zone</th>
                  <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600 }}>Contact</th>
                  <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600 }}>Statut</th>
                  <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600 }}>🏆 Certifications</th>
                  <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedFournisseurs.length === 0 ? (
                  <tr>
                    <td colSpan="6" style={{ padding: '20px', textAlign: 'center', color: '#999' }}>
                      Aucun fournisseur trouvé
                    </td>
                  </tr>
                ) : (
                  paginatedFournisseurs.map((fournisseur, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #e0e0e0' }}>
                      <td style={{ padding: '12px', fontWeight: '500' }}>
                        {fournisseur.nom}
                      </td>
                      <td style={{ padding: '12px', color: '#666' }}>
                        {fournisseur.zone_production || '-'}
                      </td>
                      <td style={{ padding: '12px', color: '#666' }}>
                        {fournisseur.email ? (
                          <a href={`mailto:${fournisseur.email}`} style={{ color: '#2196f3', textDecoration: 'none' }}>
                            {fournisseur.email}
                          </a>
                        ) : '-'}
                        {fournisseur.telephone && <div>{fournisseur.telephone}</div>}
                      </td>
                      <td style={{ padding: '12px' }}>
                        <StatusBadge statut={fournisseur.statut || 'Actif'} type="fournisseur" />
                      </td>
                      <td style={{ padding: '12px', color: '#666' }}>
                        {fournisseur.certifications || '-'}
                      </td>
                      <td style={{ padding: '12px' }}>
                        <button
                          onClick={() => handleEditFournisseur(fournisseur)}
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
                          onClick={() => askDeleteFournisseur(fournisseur)}
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
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '10px',
            marginTop: '20px'
          }}>
            <button
              onClick={() => setCurrentPageFournisseurs(prev => Math.max(1, prev - 1))}
              disabled={currentPageFournisseurs === 1}
              style={{
                padding: '8px 16px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                background: 'white',
                cursor: currentPageFournisseurs === 1 ? 'not-allowed' : 'pointer',
                opacity: currentPageFournisseurs === 1 ? 0.5 : 1
              }}
            >
              ← Précédent
            </button>
            <span style={{ color: '#666' }}>
              Page {currentPageFournisseurs} sur {Math.ceil(filteredFournisseurs.length / itemsPerPage) || 1}
            </span>
            <button
              onClick={() => setCurrentPageFournisseurs(prev => prev + 1)}
              disabled={currentPageFournisseurs >= Math.ceil(filteredFournisseurs.length / itemsPerPage)}
              style={{
                padding: '8px 16px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                background: 'white',
                cursor: currentPageFournisseurs >= Math.ceil(filteredFournisseurs.length / itemsPerPage) ? 'not-allowed' : 'pointer',
                opacity: currentPageFournisseurs >= Math.ceil(filteredFournisseurs.length / itemsPerPage) ? 0.5 : 1
              }}
            >
              Suivant →
            </button>
          </div>
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
              <option value="Expédiée">Expédiée</option>
              <option value="Livrée">Livrée</option>
              <option value="Réceptionnée">Réceptionnée</option>
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
                  <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600 }}>N° Commande</th>
                  <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600 }}>Fournisseur</th>
                  <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600 }}>Date</th>
                  <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600 }}>Livraison prévue</th>
                  <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600 }}>Montant</th>
                  <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600 }}>Statut</th>
                  <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedCommandes.length === 0 ? (
                  <tr>
                    <td colSpan="7" style={{ padding: '20px', textAlign: 'center', color: '#999' }}>
                      Aucune commande
                    </td>
                  </tr>
                ) : (
                  paginatedCommandes.map((commande, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #e0e0e0' }}>
                      <td style={{ padding: '12px', fontWeight: '500' }}>
                        {commande.numero_commande}
                      </td>
                      <td style={{ padding: '12px', color: '#666' }}>
                        {getFournisseurName(commande.fournisseur_id)}
                      </td>
                      <td style={{ padding: '12px', color: '#666' }}>
                        {commande.date_commande ? new Date(commande.date_commande).toLocaleDateString('fr-FR') : '-'}
                      </td>
                      <td style={{ padding: '12px', color: '#666' }}>
                        {commande.date_livraison_prevue ? new Date(commande.date_livraison_prevue).toLocaleDateString('fr-FR') : '-'}
                      </td>
                      <td style={{ padding: '12px', fontWeight: '600' }}>
                        {parseFloat(commande.montant_total || 0).toFixed(2)} €
                      </td>
                      <td style={{ padding: '12px' }}>
                        <StatusBadge statut={commande.statut} type="commande" />
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
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '10px',
            marginTop: '20px'
          }}>
            <button
              onClick={() => setCurrentPageCommandes(prev => Math.max(1, prev - 1))}
              disabled={currentPageCommandes === 1}
              style={{
                padding: '8px 16px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                background: 'white',
                cursor: currentPageCommandes === 1 ? 'not-allowed' : 'pointer',
                opacity: currentPageCommandes === 1 ? 0.5 : 1
              }}
            >
              ← Précédent
            </button>
            <span style={{ color: '#666' }}>
              Page {currentPageCommandes} sur {Math.ceil(filteredCommandes.length / itemsPerPage) || 1}
            </span>
            <button
              onClick={() => setCurrentPageCommandes(prev => prev + 1)}
              disabled={currentPageCommandes >= Math.ceil(filteredCommandes.length / itemsPerPage)}
              style={{
                padding: '8px 16px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                background: 'white',
                cursor: currentPageCommandes >= Math.ceil(filteredCommandes.length / itemsPerPage) ? 'not-allowed' : 'pointer',
                opacity: currentPageCommandes >= Math.ceil(filteredCommandes.length / itemsPerPage) ? 0.5 : 1
              }}
            >
              Suivant →
            </button>
          </div>
        </div>
      )}
      
      {/* ============================================================ */}
      {/* ONGLET STOCK */}
      {/* ============================================================ */}
      {activeTab === 'stock' && (
        <div>
          {/* STATS STOCK */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '15px',
            marginBottom: '30px'
          }}>
            <StatsCard
              label="STOCK TOTAL"
              value={`${statsStock.totalKg.toFixed(1)} kg`}
              color="#2196f3"
            />
            <StatsCard
              label="NOMBRE DE LOTS"
              value={statsStock.nbLots}
              color="#4caf50"
            />
            <StatsCard
              label="⚠️ ALERTES"
              value={statsStock.alertes}
              color="#f44336"
            />
          </div>
          
          {/* CONTRÔLES STOCK */}
          <div style={{
            display: 'flex',
            gap: '15px',
            marginBottom: '20px',
            flexWrap: 'wrap',
            alignItems: 'center'
          }}>
            <select
              value={filterCalibre}
              onChange={(e) => setFilterCalibre(e.target.value)}
              style={{
                padding: '10px 15px',
                border: '1px solid #ddd',
                borderRadius: '6px'
              }}
            >
              <option value="all">Tous calibres</option>
              <option value="20">Extra (20-30mm)</option>
              <option value="30">1ère (30-50mm)</option>
              <option value="50">2e (>50mm)</option>
            </select>
            
            <select
              value={filterQualite}
              onChange={(e) => setFilterQualite(e.target.value)}
              style={{
                padding: '10px 15px',
                border: '1px solid #ddd',
                borderRadius: '6px'
              }}
            >
              <option value="all">Toutes qualités</option>
              <option value="Extra">Extra</option>
              <option value="1ère">1ère</option>
              <option value="2e">2e</option>
            </select>
          </div>
          
          {/* TABLEAU STOCK */}
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
                  <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600 }}>Calibre</th>
                  <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600 }}>Qualité</th>
                  <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600 }}>🌱 Maturité</th>
                  <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600 }}>Quantité</th>
                  <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600 }}>Conservation</th>
                  <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600 }}>Localisation</th>
                  <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600 }}>Limite consommation</th>
                </tr>
              </thead>
              <tbody>
                {filteredStock.length === 0 ? (
                  <tr>
                    <td colSpan="7" style={{ padding: '20px', textAlign: 'center', color: '#999' }}>
                      Aucun stock disponible
                    </td>
                  </tr>
                ) : (
                  filteredStock.map((item, idx) => {
                    const jours = item.date_limite_consommation
                      ? Math.floor((new Date(item.date_limite_consommation) - new Date()) / (1000 * 60 * 60 * 24))
                      : null;
                    const isAlerte = jours !== null && jours <= 7;
                    
                    return (
                      <tr key={idx} style={{ borderBottom: '1px solid #e0e0e0', background: isAlerte ? '#fff3cd' : 'white' }}>
                        <td style={{ padding: '12px', fontWeight: '500' }}>
                          {item.calibre}
                        </td>
                        <td style={{ padding: '12px', color: '#666' }}>
                          {item.qualite}
                        </td>
                        <td style={{ padding: '12px', color: '#666' }}>
                          {item.maturite || '-'}
                        </td>
                        <td style={{ padding: '12px', fontWeight: '600' }}>
                          {parseFloat(item.quantite_kg_stock || 0).toFixed(2)} kg
                        </td>
                        <td style={{ padding: '12px', color: '#666' }}>
                          {item.conservation || '-'}
                        </td>
                        <td style={{ padding: '12px', color: '#666' }}>
                          {item.localisation_storage || '-'}
                        </td>
                        <td style={{ padding: '12px', color: isAlerte ? '#f44336' : '#666', fontWeight: isAlerte ? '600' : '400' }}>
                          {item.date_limite_consommation
                            ? `${new Date(item.date_limite_consommation).toLocaleDateString('fr-FR')}${isAlerte ? ` (${jours}j)` : ''}`
                            : '-'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          
          {/* ALERTES */}
          {statsStock.alertes > 0 && (
            <div style={{
              marginTop: '20px',
              padding: '15px',
              background: '#fff3cd',
              border: '1px solid #ffc107',
              borderRadius: '6px',
              color: '#856404'
            }}>
              <strong>⚠️ Attention :</strong> {statsStock.alertes} lot(s) avec une date limite de consommation approchant (≤ 7 jours)
            </div>
          )}
        </div>
      )}
      
      {/* ============================================================ */}
      {/* ONGLET MARGE */}
      {/* ============================================================ */}
      {activeTab === 'marge' && (
        <div>
          <h2 style={{ marginTop: 0 }}>💰 Analyse de Marge & Rentabilité</h2>
          <div style={{
            background: 'white',
            padding: '20px',
            borderRadius: '8px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            textAlign: 'center',
            color: '#999'
          }}>
            <p>Fonctionnalité d'analyse de marge en cours de développement</p>
            <p style={{ fontSize: '12px' }}>
              Les calculs de marge nécessitent des données complémentaires sur les achats et les ventes
            </p>
          </div>
        </div>
      )}
      
      {/* ============================================================ */}
      {/* MODALS */}
      {/* ============================================================ */}
      
      {/* MODAL FOURNISSEUR */}
      {showFournisseurModal && (
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
              {editingFournisseur ? 'Modifier le fournisseur' : 'Nouveau fournisseur'}
            </h2>
            
            <form onSubmit={handleFournisseurSubmit}>
              {/* Nom */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>🏢 Nom *</label>
                <input
                  type="text"
                  name="nom"
                  value={fournisseurFormData.nom}
                  onChange={handleFournisseurInputChange}
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
              
              {/* Zone & Email */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '20px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>🗺️ Zone production</label>
                  <select
                    name="zone_production"
                    value={fournisseurFormData.zone_production}
                    onChange={handleFournisseurInputChange}
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '1px solid #ddd',
                      borderRadius: '6px',
                      fontSize: '14px'
                    }}
                  >
                    <option value="">Sélectionner...</option>
                    <option value="Drôme">Drôme</option>
                    <option value="Vaucluse">Vaucluse</option>
                    <option value="Var">Var</option>
                    <option value="Alpes-de-Haute-Provence">Alpes-de-Haute-Provence</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>📧 Email</label>
                  <input
                    type="email"
                    name="email"
                    value={fournisseurFormData.email}
                    onChange={handleFournisseurInputChange}
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
              
              {/* Téléphone & Statut */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '20px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>📱 Téléphone</label>
                  <input
                    type="tel"
                    name="telephone"
                    value={fournisseurFormData.telephone}
                    onChange={handleFournisseurInputChange}
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
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>⚡ Statut</label>
                  <select
                    name="statut"
                    value={fournisseurFormData.statut}
                    onChange={handleFournisseurInputChange}
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '1px solid #ddd',
                      borderRadius: '6px',
                      fontSize: '14px'
                    }}
                  >
                    <option value="Actif">Actif</option>
                    <option value="Inactif">Inactif</option>
                    <option value="Suspendu">Suspendu</option>
                  </select>
                </div>
              </div>
              
              {/* Adresse */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>📍 Adresse</label>
                <input
                  type="text"
                  name="adresse"
                  value={fournisseurFormData.adresse}
                  onChange={handleFournisseurInputChange}
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
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>📮 Code postal</label>
                  <input
                    type="text"
                    name="code_postal"
                    value={fournisseurFormData.code_postal}
                    onChange={handleFournisseurInputChange}
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
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>🏙️ Ville</label>
                  <input
                    type="text"
                    name="ville"
                    value={fournisseurFormData.ville}
                    onChange={handleFournisseurInputChange}
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
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>🌍 Pays</label>
                  <input
                    type="text"
                    name="pays"
                    value={fournisseurFormData.pays}
                    onChange={handleFournisseurInputChange}
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
              
              {/* Certifications */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>🏆 Certifications</label>
                <input
                  type="text"
                  name="certifications"
                  value={fournisseurFormData.certifications}
                  onChange={handleFournisseurInputChange}
                  placeholder="ex: Bio, IGP, AOP..."
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #ddd',
                    borderRadius: '6px',
                    fontSize: '14px'
                  }}
                />
              </div>
              
              {/* Notes */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>📝 Notes</label>
                <textarea
                  name="notes"
                  value={fournisseurFormData.notes}
                  onChange={handleFournisseurInputChange}
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
                  onClick={() => setShowFournisseurModal(false)}
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
                  {isProcessing ? 'Enregistrement...' : (editingFournisseur ? 'Mettre à jour' : 'Créer')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      {/* MODAL COMMANDE AVEC GESTION DES LIGNES */}
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
            maxWidth: '900px',
            width: '95%',
            maxHeight: '90vh',
            overflow: 'auto'
          }}>
            <h2 style={{ marginTop: 0 }}>
              {editingCommande ? 'Modifier la commande' : 'Nouvelle commande d\'achat'}
            </h2>
            
            <form onSubmit={handleCommandeSubmit}>
              {/* SECTION 1: Informations générales */}
              <div style={{
                background: '#f5f5f5',
                padding: '15px',
                borderRadius: '8px',
                marginBottom: '20px'
              }}>
                <h3 style={{ margin: '0 0 15px 0', fontSize: '16px' }}>📄 Informations générales</h3>
                
                {/* Fournisseur */}
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: 600, fontSize: '14px' }}>👤 Fournisseur *</label>
                  <select
                    name="fournisseur_id"
                    value={commandeFormData.fournisseur_id}
                    onChange={handleCommandeInputChange}
                    required
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '1px solid #ddd',
                      borderRadius: '6px',
                      fontSize: '14px'
                    }}
                  >
                    <option value="">Sélectionner un fournisseur</option>
                    {fournisseurs.filter(f => f.statut === 'Actif').map(f => (
                      <option key={f.id} value={f.id}>{f.nom}</option>
                    ))}
                  </select>
                </div>
                
                {/* Dates */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: 600, fontSize: '14px' }}>📅 Date commande *</label>
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
                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: 600, fontSize: '14px' }}>Livraison prévue</label>
                    <input
                      type="date"
                      name="date_livraison_prevue"
                      value={commandeFormData.date_livraison_prevue}
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

                {/* Statut */}
                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: 600, fontSize: '14px' }}>
                    ⚡ Statut *
                  </label>
                  <select
                    name="statut"
                    value={commandeFormData.statut}
                    onChange={handleCommandeInputChange}
                    required
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
                    <option value="Expédiée">Expédiée</option>
                    <option value="Livrée">Livrée</option>
                    <option value="Réceptionnée">Réceptionnée</option>
                    <option value="Annulée">Annulée</option>
                  </select>
                </div>
                
                {/* Notes */}
                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: 600, fontSize: '14px' }}>📝 Notes</label>
                  <textarea
                    name="notes"
                    value={commandeFormData.notes}
                    onChange={handleCommandeInputChange}
                    rows="2"
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
              </div>
              
              {/* SECTION 2: Lignes de commande */}
              <div style={{
                border: '2px solid #2196f3',
                borderRadius: '8px',
                padding: '15px',
                marginBottom: '20px'
              }}>
                <h3 style={{ margin: '0 0 15px 0', fontSize: '16px', color: '#2196f3' }}>📋 Lignes de commande ({commandeLignes.length})</h3>
                
                {/* Formulaire d'ajout de ligne */}
                <div style={{
                  background: '#e3f2fd',
                  padding: '15px',
                  borderRadius: '6px',
                  marginBottom: '15px'
                }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '5px', fontWeight: 600, fontSize: '12px' }}>Calibre (mm) *</label>
                      <select
                        name="calibre"
                        value={nouvelleLigne.calibre}
                        onChange={handleNouvelleLigneChange}
                        onKeyDown={handleKeyDownLigne}
                        style={{
                          width: '100%',
                          padding: '8px',
                          border: '1px solid #ddd',
                          borderRadius: '4px',
                          fontSize: '13px'
                        }}
                      >
                        <option value="">Sélectionner</option>
                        {CALIBRES_TEXTE.map(c => (
                          <option key={c} value={c}>{c}mm</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '5px', fontWeight: 600, fontSize: '12px' }}>⭐ Qualité *</label>
                      <select
                        name="qualite"
                        value={nouvelleLigne.qualite}
                        onChange={handleNouvelleLigneChange}
                        onKeyDown={handleKeyDownLigne}
                        style={{
                          width: '100%',
                          padding: '8px',
                          border: '1px solid #ddd',
                          borderRadius: '4px',
                          fontSize: '13px'
                        }}
                      >
                        <option value="">Sélectionner</option>
                        {QUALITES.map(q => (
                          <option key={q} value={q}>{q}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '5px', fontWeight: 600, fontSize: '12px' }}>🌱 Maturité</label>
                      <select
                        name="maturite"
                        value={nouvelleLigne.maturite}
                        onChange={handleNouvelleLigneChange}
                        onKeyDown={handleKeyDownLigne}
                        style={{
                          width: '100%',
                          padding: '8px',
                          border: '1px solid #ddd',
                          borderRadius: '4px',
                          fontSize: '13px'
                        }}
                      >
                        {MATURITES.map(m => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr', gap: '10px', marginBottom: '10px' }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '5px', fontWeight: 600, fontSize: '12px' }}>⚖️ Quantité (kg) *</label>
                      <input
                        type="number"
                        name="quantite_kg"
                        value={nouvelleLigne.quantite_kg}
                        onChange={handleNouvelleLigneChange}
                        onKeyDown={handleKeyDownLigne}
                        min="0"
                        step="0.01"
                        style={{
                          width: '100%',
                          padding: '8px',
                          border: '1px solid #ddd',
                          borderRadius: '4px',
                          fontSize: '13px'
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '5px', fontWeight: 600, fontSize: '12px' }}>💰 Prix/kg (€) *</label>
                      <input
                        type="number"
                        name="prix_achat_kg"
                        value={nouvelleLigne.prix_achat_kg}
                        onChange={handleNouvelleLigneChange}
                        onKeyDown={handleKeyDownLigne}
                        min="0"
                        step="0.01"
                        style={{
                          width: '100%',
                          padding: '8px',
                          border: '1px solid #ddd',
                          borderRadius: '4px',
                          fontSize: '13px'
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '5px', fontWeight: 600, fontSize: '12px' }}>Notes ligne</label>
                      <input
                        type="text"
                        name="notes"
                        value={nouvelleLigne.notes}
                        onChange={handleNouvelleLigneChange}
                        onKeyDown={handleKeyDownLigne}
                        style={{
                          width: '100%',
                          padding: '8px',
                          border: '1px solid #ddd',
                          borderRadius: '4px',
                          fontSize: '13px'
                        }}
                      />
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={ajouterLigne}
                    style={{
                      flex: editingLigneIndex === null ? 1 : 2,
                      padding: '12px',
                      background: editingLigneIndex === null ? '#2196f3' : '#ff9800',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: 600
                    }}
                  >
                    {editingLigneIndex === null ? '➕ Ajouter la ligne' : '✏️ Mettre à jour la ligne'}
                  </button>
                  {editingLigneIndex !== null && (
                    <button
                      type="button"
                      onClick={annulerEditionLigne}
                      style={{
                        flex: 1,
                        padding: '12px',
                        background: '#9e9e9e',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '14px',
                        fontWeight: 600
                      }}
                    >
                      ❌ Annuler
                    </button>
                  )}
                </div>
                </div>
                
                {/* Liste des lignes ajoutées */}
                {commandeLignes.length === 0 ? (
                  <div style={{
                    textAlign: 'center',
                    padding: '30px',
                    color: '#999',
                    background: '#f9f9f9',
                    borderRadius: '6px'
                  }}>
                    ⚠️ Aucune ligne de commande ajoutée. Veuillez ajouter au moins une ligne.
                  </div>
                ) : (
                  <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                    <table style={{
                      width: '100%',
                      borderCollapse: 'collapse',
                      fontSize: '13px'
                    }}>
                      <thead>
                        <tr style={{ background: '#f5f5f5', borderBottom: '2px solid #ddd' }}>
                          <th style={{ padding: '8px', textAlign: 'left' }}>Calibre</th>
                          <th style={{ padding: '8px', textAlign: 'left' }}>Qualité</th>
                          <th style={{ padding: '8px', textAlign: 'left' }}>🌱 Maturité</th>
                          <th style={{ padding: '8px', textAlign: 'right' }}>Qte (kg)</th>
                          <th style={{ padding: '8px', textAlign: 'right' }}>Prix/kg</th>
                          <th style={{ padding: '8px', textAlign: 'right' }}>Total</th>
                          <th style={{ padding: '8px', textAlign: 'center' }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {commandeLignes.map((ligne, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid #e0e0e0' }}>
                            <td style={{ padding: '8px' }}>{ligne.calibre}</td>
                            <td style={{ padding: '8px' }}>{ligne.qualite}</td>
                            <td style={{ padding: '8px', fontSize: '11px', color: '#666' }}>{ligne.maturite}</td>
                            <td style={{ padding: '8px', textAlign: 'right', fontWeight: 600 }}>{ligne.quantite_kg}</td>
                            <td style={{ padding: '8px', textAlign: 'right' }}>{parseFloat(ligne.prix_achat_kg).toFixed(2)}€</td>
                            <td style={{ padding: '8px', textAlign: 'right', fontWeight: 600, color: '#2196f3' }}>
                              {(parseFloat(ligne.quantite_kg) * parseFloat(ligne.prix_achat_kg)).toFixed(2)}€
                            </td>
                            <td style={{ padding: '8px', textAlign: 'center' }}>
                              <button
                                type="button"
                                onClick={() => modifierLigne(idx)}
                                style={{
                                  marginRight: '5px',
                                  padding: '4px 8px',
                                  background: editingLigneIndex === idx ? '#4caf50' : '#ff9800',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '4px',
                                  cursor: 'pointer',
                                  fontSize: '12px'
                                }}
                              >
                                {editingLigneIndex === idx ? '✓' : '✏️'}
                              </button>
                              <button
                                type="button"
                                onClick={() => supprimerLigne(idx)}
                                style={{
                                  padding: '4px 8px',
                                  background: '#f44336',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '4px',
                                  cursor: 'pointer',
                                  fontSize: '12px'
                                }}
                              >
                                ❌
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr style={{ background: '#f5f5f5', fontWeight: 'bold', borderTop: '2px solid #ddd' }}>
                          <td colSpan="5" style={{ padding: '10px', textAlign: 'right' }}>TOTAL COMMANDE:</td>
                          <td style={{ padding: '10px', textAlign: 'right', fontSize: '16px', color: '#2196f3' }}>
                            {calculerMontantTotal().toFixed(2)}€
                          </td>
                          <td></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>
              
              {/* Boutons */}
              <div style={{
                display: 'flex',
                gap: '10px',
                justifyContent: 'flex-end',
                marginTop: '20px'
              }}>
                <button
                  type="button"
                  onClick={() => setShowCommandeModal(false)}
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
                  disabled={isProcessing || commandeLignes.length === 0}
                  style={{
                    padding: '12px 24px',
                    border: 'none',
                    borderRadius: '6px',
                    background: commandeLignes.length === 0 ? '#ccc' : '#2196f3',
                    color: 'white',
                    cursor: (isProcessing || commandeLignes.length === 0) ? 'not-allowed' : 'pointer',
                    fontSize: '14px',
                    fontWeight: 600,
                    opacity: (isProcessing || commandeLignes.length === 0) ? 0.7 : 1
                  }}
                >
                  {isProcessing ? 'Enregistrement...' : (editingCommande ? 'Mettre à jour' : 'Créer la commande')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default AchatsFournisseursPage;