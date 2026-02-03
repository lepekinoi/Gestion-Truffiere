// ============================================================
// AchatsFournisseursPage.jsx - Module Achats et Fournisseurs
// Version: 2.5.1 - Phase 1 Refactoring
// Date: 3 février 2026
// Status: ✅ PRODUCTION READY - Composants extraits
// ============================================================

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

// ✅ PHASE 1: Imports des composants et constantes
import StatsCard from '../components/achats/StatsCard';
import StatusBadge from '../components/achats/StatusBadge';
import ConfirmModal from '../components/achats/ConfirmModal';
import {
  CALIBRES_TEXTE,
  QUALITES,
  MATURITES,
  convertirMmEnCalibreTexte,
  convertirCalibreTexteEnMm
} from '../components/achats/constants';

// ✅ PHASE 2: Imports des tabs
import FournisseursTab from '../components/achats/tabs/FournisseursTab';
import CommandesAchatsTab from '../components/achats/tabs/CommandesAchatsTab';
import StockTab from '../components/achats/tabs/StockTab';
import MargeTab from '../components/achats/tabs/MargeTab';


const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';


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
  // ✅ V7: État pour gérer les confirmations avec force_modify/force_delete
  const [pendingAction, setPendingAction] = useState(null);
  
  // Fournisseurs
  const [fournisseurs, setFournisseurs] = useState([]);
  const [showFournisseurModal, setShowFournisseurModal] = useState(false);
  const [editingFournisseur, setEditingFournisseur] = useState(null);
  const [filterRegion, setFilterRegion] = useState('all');
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

  const [zonesProduction, setZonesProduction] = useState([]);
  const [regionSelectionnee, setRegionSelectionnee] = useState('');
  const [regionsFournisseur, setRegionsFournisseur] = useState([]);
  
  // ==================== EFFECTS ====================
  
  useEffect(() => {
    loadData();
	loadZonesProduction();
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
  
	const loadZonesProduction = async () => {
	  try {
		const res = await axios.get(`${API_URL}/zones-production`);
		setZonesProduction(res.data);
		
		// Extraire les régions uniques
		const regionsUniques = [...new Set(res.data.map(z => z.region))].filter(Boolean).sort();
		setRegionsFournisseur(regionsUniques);
	  } catch (error) {
		console.warn('Zones non disponibles:', error);
	  }
	};
  
  const getZonesByRegion = (region) => {
	  if (!region) return [];
	  return zonesProduction.filter(z => z.region === region);
	};
	
const handleRegionChange = (e) => {
  const region = e.target.value;
  setRegionSelectionnee(region);
  // Réinitialiser la zone de production si la région change
  setFournisseurFormData(prev => ({ ...prev, zone_production: '' }));
};	

  
  const getFournisseurName = (fournisseurId) => {
    const fournisseur = fournisseurs.find(f => f.id === fournisseurId);
    return fournisseur ? fournisseur.nom : '-';
  };
  
      {/* ============================================================ */}
      {/* ONGLET FOURNISSEURS */}
      {/* ============================================================ */}
      {activeTab === 'fournisseurs' && (
        <FournisseursTab
          statsFournisseurs={statsFournisseurs}
          fournisseurs={fournisseurs}
          zonesProduction={zonesProduction}
          regionsFournisseur={regionsFournisseur}
          filterRegion={filterRegion}
          setFilterRegion={setFilterRegion}
          filterZone={filterZone}
          setFilterZone={setFilterZone}
          filterStatutFournisseur={filterStatutFournisseur}
          setFilterStatutFournisseur={setFilterStatutFournisseur}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          currentPageFournisseurs={currentPageFournisseurs}
          setCurrentPageFournisseurs={setCurrentPageFournisseurs}
          filteredFournisseurs={filteredFournisseurs}
          paginatedFournisseurs={paginatedFournisseurs}
          itemsPerPage={itemsPerPage}
          openNewFournisseurModal={openNewFournisseurModal}
          handleEditFournisseur={handleEditFournisseur}
          askDeleteFournisseur={askDeleteFournisseur}
          resetFiltersFournisseurs={resetFiltersFournisseurs}
          getZonesByRegion={getZonesByRegion}
        />
      )}
      
      {/* ============================================================ */}
      {/* ONGLET COMMANDES ACHATS */}
      {/* ============================================================ */}
      {activeTab === 'commandes' && (
        <CommandesAchatsTab
          statsCommandes={statsCommandes}
          commandes={commandes}
          fournisseurs={fournisseurs}
          filterStatutCommande={filterStatutCommande}
          setFilterStatutCommande={setFilterStatutCommande}
          currentPageCommandes={currentPageCommandes}
          setCurrentPageCommandes={setCurrentPageCommandes}
          filteredCommandes={filteredCommandes}
          paginatedCommandes={paginatedCommandes}
          itemsPerPage={itemsPerPage}
          openNewCommandeModal={openNewCommandeModal}
          handleEditCommande={handleEditCommande}
          askDeleteCommande={askDeleteCommande}
          getFournisseurName={getFournisseurName}
        />
      )}
      
      {/* ============================================================ */}
      {/* ONGLET STOCK */}
      {/* ============================================================ */}
      {activeTab === 'stock' && (
        <StockTab
          statsStock={statsStock}
          stock={stock}
          filterCalibre={filterCalibre}
          setFilterCalibre={setFilterCalibre}
          filterQualite={filterQualite}
          setFilterQualite={setFilterQualite}
          filteredStock={filteredStock}
        />
      )}
      
      {/* ============================================================ */}
      {/* ONGLET MARGE */}
      {/* ============================================================ */}
      {activeTab === 'marge' && (
        <MargeTab />
      )}

  
	// Fonction helper à ajouter
	const convertirCalibreEnMm = (calibreTexte) => {
	  const mapping = {
		'Petit (moins de 20g)': 20,
		'Moyen (20-50g)': 30,
		'Gros (50-100g)': 50,
		'Très gros (plus de 100g)': 70
	  };
	  return mapping[calibreTexte] || null;
	};
  
  const askDeleteCommande = (commande) => {
    const isStatutSensible = commande?.statut === 'Réceptionnée' || commande?.statut === 'Livrée';

    setConfirmModal({
      type: 'delete-commande',
      item: commande,
      title: 'Confirmer la suppression',
      message: isStatutSensible 
        ? `⚠️ ATTENTION: Cette commande est ${commande.statut}. Êtes-vous sûr de vouloir la supprimer définitivement ?`
        : `Êtes-vous sûr de vouloir supprimer la commande "${commande.numero_commande}" ?`,
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
		setConfirmModal(null);
	  } catch (error) {
		console.error('❌ Erreur suppression:', error);

		// ✅ V7: Gérer le code 409 (confirmation requise)
		if (error.response?.status === 409 && error.response?.data?.error === 'confirmation_required') {
		  // ✅ IMPORTANT: Ne pas créer un nouveau modal, REMPLACER l'actuel
		  setConfirmModal({
			type: 'delete-commande-force',
			item: commande,
			title: 'Confirmation requise',
			message: `⚠️ ${error.response.data.message}\n\nÊtes-vous sûr de vouloir continuer ?`,
			confirmText: 'Oui, supprimer quand même',
			confirmColor: '#d32f2f'
		  });
		  // ✅ Ne PAS mettre setIsProcessing(false) ici dans le finally
		  // pour garder le modal ouvert
		} else {
		  showMessage(error.response?.data?.error || 'Erreur lors de la suppression', 'error');
		  setConfirmModal(null);
		}
	  } finally {
		setIsProcessing(false); // ✅ Toujours remettre à false
	  }
	};

  // ✅ V7: Suppression forcée (après confirmation)
  const doDeleteCommandeForce = async (commande) => {
    setIsProcessing(true);
    try {
      await axios.delete(`${API_URL}/commandes-achats/${commande.id}?force_delete=true`);
      showMessage('✅ Commande supprimée avec succès', 'success');
      await loadData();
    } catch (error) {
      console.error('❌ Erreur suppression forcée:', error);
      showMessage(error.response?.data?.error || 'Erreur lors de la suppression', 'error');
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
    } else if (confirmModal.type === 'delete-commande-force') {
		// ✅ Pour la suppression forcée, utiliser confirmModal.item
		doDeleteCommandeForce(confirmModal.item);
    } else if (confirmModal.type === 'save-commande-force') {
		// ✅ Vérifier que pendingAction existe avant de l'utiliser
		if (pendingAction && pendingAction.data) {
			  handleCommandeSubmit(pendingAction.data, true);
			  setPendingAction(null);
		} else {
			  showMessage('Erreur: action en attente introuvable', 'error');
			  setConfirmModal(null);
		}
    }
  };  // ✅ 2 espaces
  
  // ==================== FILTRAGE & PAGINATION ====================
  
	const filteredFournisseurs = fournisseurs.filter(f => {
	  // Filtre par région
	  let matchRegion = filterRegion === 'all';
	  if (!matchRegion && f.zone_production) {
		const zone = zonesProduction.find(z => z.nom === f.zone_production);
		matchRegion = zone && zone.region === filterRegion;
	  }
	  
	  // Filtre par zone (si une région est sélectionnée)
	  const matchZone = filterZone === 'all' || f.zone_production === filterZone;
	  
	  const matchStatut = filterStatutFournisseur === 'all' || f.statut === filterStatutFournisseur;
	  const searchLower = searchTerm.toLowerCase();
	  const matchSearch = !searchTerm || 
		f.nom?.toLowerCase().includes(searchLower) || 
		f.email?.toLowerCase().includes(searchLower) || 
		f.ville?.toLowerCase().includes(searchLower);
	  
	  return matchRegion && matchZone && matchStatut && matchSearch;
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
  
	// Fonction de réinitialisation des filtres
	const resetFiltersFournisseurs = () => {
	  setFilterRegion('all');
	  setFilterZone('all');
	  setFilterStatutFournisseur('all');
	  setSearchTerm('');
	  setCurrentPageFournisseurs(1);
	  showMessage('🔄 Filtres réinitialisés', 'info');
	};
  
  
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
	<ConfirmModal
	  confirmModal={confirmModal}
	  onConfirm={handleConfirm}
	  onCancel={() => setConfirmModal(null)}
	  isProcessing={isProcessing}
	/>
     
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
			  label="🚀 ORIGINES APPRO" 
			  value={statsFournisseurs.zones} 
			  color="#ff9800"
			  subtitle="Zones géographiques des fournisseurs"
			/>
            <StatsCard
              label="🏆 CERTIFICATIONS"
              value={statsFournisseurs.certifies}
              color="#9c27b0"
            />
          </div>
          
			{/* CONTRÔLES FOURNISSEURS */}
			<div style={{ display: 'flex', gap: '15px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
				  <button 
					onClick={openNewFournisseurModal}
					style={{ 
					  padding: '10px 20px', 
					  background: '#2196f3', 
					  color: 'white', 
					  border: 'none', 
					  borderRadius: '6px', 
					  cursor: 'pointer', 
					  fontWeight: 600,
					  transition: 'background 0.2s'
					}}
					onMouseEnter={(e) => e.currentTarget.style.background = '#1976d2'}
					onMouseLeave={(e) => e.currentTarget.style.background = '#2196f3'}
				  >
					➕ Nouveau Fournisseur
				  </button>

				  {/* ✅ BOUTON RESET */}
				  <button 
					onClick={resetFiltersFournisseurs}
					title="Réinitialiser tous les filtres"
					style={{ 
					  padding: '10px 20px', 
					  background: '#9e9e9e', 
					  color: 'white', 
					  border: 'none', 
					  borderRadius: '6px', 
					  cursor: 'pointer', 
					  fontWeight: 600,
					  transition: 'background 0.2s'
					}}
					onMouseEnter={(e) => e.currentTarget.style.background = '#757575'}
					onMouseLeave={(e) => e.currentTarget.style.background = '#9e9e9e'}
				  >
					🔄 Réinitialiser filtres
				  </button>

				  {/* FILTRE PAR RÉGION */}
				  <select
					value={filterRegion}
					onChange={(e) => {
					  setFilterRegion(e.target.value);
					  setFilterZone('all');
					  setCurrentPageFournisseurs(1);
					}}
					style={{ 
					  padding: '10px 15px', 
					  border: '1px solid #ddd', 
					  borderRadius: '6px',
					  cursor: 'pointer'
					}}
				  >
					<option value="all">🗺️ Toutes les régions</option>
					{regionsFournisseur.map(region => (
					  <option key={region} value={region}>{region}</option>
					))}
				  </select>

				  {/* FILTRE PAR ZONE */}
				  <select
					value={filterZone}
					onChange={(e) => {
					  setFilterZone(e.target.value);
					  setCurrentPageFournisseurs(1);
					}}
					disabled={filterRegion === 'all'}
					style={{ 
					  padding: '10px 15px', 
					  border: '1px solid #ddd', 
					  borderRadius: '6px',
					  cursor: filterRegion === 'all' ? 'not-allowed' : 'pointer',
					  backgroundColor: filterRegion === 'all' ? '#f5f5f5' : 'white',
					  color: filterRegion === 'all' ? '#999' : '#333'
					}}
				  >
					<option value="all">
					  {filterRegion === 'all' ? '📍 Toutes les zones' : '📍 Toutes zones de la région'}
					</option>
					{filterRegion !== 'all' && getZonesByRegion(filterRegion).map(zone => (
					  <option key={zone.id} value={zone.nom}>
						{zone.nom}
					  </option>
					))}
				  </select>

				  {/* FILTRE PAR STATUT */}
				  <select
					value={filterStatutFournisseur}
					onChange={(e) => {
					  setFilterStatutFournisseur(e.target.value);
					  setCurrentPageFournisseurs(1);
					}}
					style={{ 
					  padding: '10px 15px', 
					  border: '1px solid #ddd', 
					  borderRadius: '6px',
					  cursor: 'pointer'
					}}
				  >
					<option value="all">⚡ Tous les statuts</option>
					<option value="Actif">✅ Actif</option>
					<option value="Inactif">❌ Inactif</option>
					<option value="Suspendu">⏸️ Suspendu</option>
				  </select>

				  {/* RECHERCHE */}
				  <input
					type="text"
					placeholder="🔍 Rechercher un fournisseur..."
					value={searchTerm}
					onChange={(e) => {
					  setSearchTerm(e.target.value);
					  setCurrentPageFournisseurs(1);
					}}
					style={{ 
					  padding: '10px 15px', 
					  border: '1px solid #ddd', 
					  borderRadius: '6px', 
					  flex: 1, 
					  minWidth: '200px',
					  fontSize: '14px'
					}}
				  />
			  
				  {/* ✅ INDICATEUR DE FILTRES ACTIFS */}
				  {(filterRegion !== 'all' || filterZone !== 'all' || filterStatutFournisseur !== 'all' || searchTerm) && (
					<div style={{ 
					  padding: '8px 12px', 
					  background: '#fff3cd', 
					  border: '1px solid #ffc107',
					  borderRadius: '6px',
					  fontSize: '13px',
					  color: '#856404',
					  fontWeight: 500
					}}>
					  🎯 Filtres actifs
					</div>
					)}
			</div>
  
		{/* TABLEAU FOURNISSEURS */}
		<div style={{ background: 'white', borderRadius: '8px', padding: '20px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
		  
			  {/* ✅ PAGINATION ET INFO AU-DESSUS */}
			  <div style={{ 
				display: 'flex', 
				justifyContent: 'space-between', 
				alignItems: 'center', 
				marginBottom: '15px', 
				paddingBottom: '15px', 
				borderBottom: '2px solid #e0e0e0' 
			  }}>
				<div style={{ color: '#666', fontSize: '14px' }}>
				  🧑‍🌾 <strong>{filteredFournisseurs.length}</strong> fournisseur(s) trouvé(s)
				  {filterRegion !== 'all' && ` • 🗺️ ${filterRegion}`}
				  {filterZone !== 'all' && ` • 📍 ${filterZone}`}
				</div>
			
				<div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
				  <button
					onClick={() => setCurrentPageFournisseurs(prev => Math.max(1, prev - 1))}
					disabled={currentPageFournisseurs === 1}
					style={{
					  padding: '8px 16px',
					  border: '1px solid #ddd',
					  borderRadius: '4px',
					  background: currentPageFournisseurs === 1 ? '#f5f5f5' : 'white',
					  cursor: currentPageFournisseurs === 1 ? 'not-allowed' : 'pointer',
					  opacity: currentPageFournisseurs === 1 ? 0.5 : 1,
					  fontWeight: 500
					}}
				  >
					← Précédent
				  </button>
				  
				  <span style={{ color: '#666', fontSize: '14px' }}>
					Page <strong>{currentPageFournisseurs}</strong> / <strong>{Math.ceil(filteredFournisseurs.length / itemsPerPage) || 1}</strong>
				  </span>
				  
				  <button
					onClick={() => setCurrentPageFournisseurs(prev => prev + 1)}
					disabled={currentPageFournisseurs >= Math.ceil(filteredFournisseurs.length / itemsPerPage)}
					style={{
					  padding: '8px 16px',
					  border: '1px solid #ddd',
					  borderRadius: '4px',
					  background: currentPageFournisseurs >= Math.ceil(filteredFournisseurs.length / itemsPerPage) ? '#f5f5f5' : 'white',
					  cursor: currentPageFournisseurs >= Math.ceil(filteredFournisseurs.length / itemsPerPage) ? 'not-allowed' : 'pointer',
					  opacity: currentPageFournisseurs >= Math.ceil(filteredFournisseurs.length / itemsPerPage) ? 0.5 : 1,
					  fontWeight: 500
					}}
				  >
					Suivant →
				  </button>
				</div>
			  </div>

			  {/* TABLEAU AVEC TRI */}
			  <div style={{ overflowX: 'auto' }}>
				<table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
				  <thead>
					<tr style={{ borderBottom: '2px solid #e0e0e0', backgroundColor: '#f8f8f8' }}>
					  <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600 }}>
						👤 Nom
					  </th>
					  
					  {/* ✅ NOUVELLE COLONNE RÉGION */}
					  <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600 }}>
						🗺️ Région
					  </th>
					  
					  <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600 }}>
						📍 Zone Production
					  </th>
					  
					  <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600 }}>
						📞 Contact
					  </th>
					  
					  <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600 }}>
						⚡ Statut
					  </th>
					  
					  <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600 }}>
						🏆 Certifications
					  </th>
					  
					  <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600 }}>
						⚙️ Actions
					  </th>
					</tr>
				  </thead>
				  <tbody>
					{paginatedFournisseurs.length === 0 ? (
					  <tr>
						<td colSpan="7" style={{ padding: '20px', textAlign: 'center', color: '#999' }}>
						  😔 Aucun fournisseur trouvé
						</td>
					  </tr>
					) : (
					  paginatedFournisseurs.map((fournisseur, idx) => {
						// ✅ Calculer la région depuis la zone
						const fournisseurRegion = fournisseur.zone_production 
						  ? (zonesProduction.find(z => z.nom === fournisseur.zone_production)?.region || '-')
						  : '-';
						
						return (
						  <tr 
							key={idx} 
							style={{ 
							  borderBottom: '1px solid #e0e0e0',
							  transition: 'background 0.2s'
							}}
							onMouseEnter={(e) => e.currentTarget.style.background = '#f9f9f9'}
							onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
						  >
							{/* Nom */}
							<td style={{ padding: '12px', fontWeight: 600, color: '#333' }}>
							  {fournisseur.nom}
							</td>
							
							{/* ✅ RÉGION */}
							<td style={{ padding: '12px', color: '#666', fontSize: '13px' }}>
							  {fournisseurRegion}
							</td>
							
							{/* Zone */}
							<td style={{ padding: '12px', color: '#666', fontSize: '13px' }}>
							  {fournisseur.zone_production || '-'}
							</td>
							
							{/* Contact */}
							<td style={{ padding: '12px', color: '#666', fontSize: '13px' }}>
							  {fournisseur.email ? (
								<a 
								  href={`mailto:${fournisseur.email}`} 
								  style={{ color: '#2196f3', textDecoration: 'none', display: 'block' }}
								>
								  📧 {fournisseur.email}
								</a>
							  ) : (
								<span style={{ color: '#999' }}>-</span>
							  )}
							  {fournisseur.telephone && (
								<div style={{ marginTop: '4px', color: '#666' }}>
								  📱 {fournisseur.telephone}
								</div>
							  )}
							</td>
							
							{/* Statut */}
							<td style={{ padding: '12px' }}>
							  <StatusBadge statut={fournisseur.statut || 'Actif'} type="fournisseur" />
							</td>
							
							{/* Certifications */}
							<td style={{ padding: '12px', color: '#666', fontSize: '13px' }}>
							  {fournisseur.certifications ? (
								<span>🏅 {fournisseur.certifications}</span>
							  ) : (
								<span style={{ color: '#999' }}>-</span>
							  )}
							</td>
							
							{/* Actions */}
							<td style={{ padding: '12px' }}>
							  <div style={{ display: 'flex', gap: '8px' }}>
								<button
								  onClick={() => handleEditFournisseur(fournisseur)}
								  title="Modifier le fournisseur"
								  style={{
									padding: '6px 12px',
									background: '#ff9800',
									color: 'white',
									border: 'none',
									borderRadius: '4px',
									cursor: 'pointer',
									fontSize: '12px',
									fontWeight: 500,
									transition: 'background 0.2s'
								  }}
								  onMouseEnter={(e) => e.currentTarget.style.background = '#f57c00'}
								  onMouseLeave={(e) => e.currentTarget.style.background = '#ff9800'}
								>
								  ✏️ Modifier
								</button>
								<button
								  onClick={() => askDeleteFournisseur(fournisseur)}
								  title="Supprimer le fournisseur"
								  style={{
									padding: '6px 12px',
									background: '#f44336',
									color: 'white',
									border: 'none',
									borderRadius: '4px',
									cursor: 'pointer',
									fontSize: '12px',
									fontWeight: 500,
									transition: 'background 0.2s'
								  }}
								  onMouseEnter={(e) => e.currentTarget.style.background = '#d32f2f'}
								  onMouseLeave={(e) => e.currentTarget.style.background = '#f44336'}
								>
								  🗑️ Supprimer
								</button>
							  </div>
							</td>
						  </tr>
						);
					  })
					)}
				  </tbody>
				</table>
			  </div>
		  
				{/* ✅ PAGINATION EN BAS AUSSI (optionnel) */}
				{filteredFournisseurs.length > itemsPerPage && (
				<div style={{ 
				  display: 'flex', 
				  justifyContent: 'center', 
				  alignItems: 'center', 
				  gap: '10px', 
				  marginTop: '20px',
				  paddingTop: '15px',
				  borderTop: '1px solid #e0e0e0'
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
					⬅️ Précédent
				  </button>
				  
				  <span style={{ color: '#666' }}>
					Page <strong>{currentPageFournisseurs}</strong> sur <strong>{Math.ceil(filteredFournisseurs.length / itemsPerPage) || 1}</strong>
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
					Suivant ➡️
				  </button>
				</div>
			)}
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
              
		{/* Zone Email */}
		<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '20px' }}>
		  {/* ✅ NOUVELLE VERSION - 2 SELECTS */}
		  <div>
			<label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>
			  Région
			</label>
			<select
			  value={regionSelectionnee}
			  onChange={handleRegionChange}
			  style={{
				width: '100%',
				padding: '10px',
				border: '1px solid #ddd',
				borderRadius: '6px',
				fontSize: '14px'
			  }}
			>
			  <option value="">Sélectionner une région...</option>
			  {regionsFournisseur.map(region => (
				<option key={region} value={region}>
				  {region}
				</option>
			  ))}
			</select>
		  </div>

		  <div>
			<label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>
			  Zone de production
			</label>
			<select
			  name="zone_production"
			  value={fournisseurFormData.zone_production}
			  onChange={handleFournisseurInputChange}
			  disabled={!regionSelectionnee}
			  size="8"
			  style={{
				width: '100%',
				padding: '10px',
				border: '1px solid #ddd',
				borderRadius: '6px',
				fontSize: '14px',
				height: '200px',
				overflowY: 'auto',
				cursor: !regionSelectionnee ? 'not-allowed' : 'pointer',
				backgroundColor: !regionSelectionnee ? '#f5f5f5' : 'white'
			  }}
			>
			  <option value="">Sélectionner...</option>
			  {getZonesByRegion(regionSelectionnee).map(zone => (
				<option key={zone.id} value={zone.nom}>
				  {zone.nom} ({zone.departements || zone.departement})
				</option>
			  ))}
			</select>
			{!regionSelectionnee && (
			  <small style={{ color: '#999', fontSize: '12px' }}>
				⬆️ Sélectionnez d'abord une région
			  </small>
			)}
		  </div>
		</div>

		{/* Email (déplacé seul sur la ligne suivante) */}
		<div style={{ marginBottom: '20px' }}>
		  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>
			Email
		  </label>
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
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: 600, fontSize: '14px' }}>⚡ Statut *</label>
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
                        value={nouvelleLigne.quantite_kg || ''}
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
                        value={nouvelleLigne.prix_achat_kg || ''}
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
                  // disabled={isProcessing || commandeLignes.length === 0}
				  disabled={isProcessing}
                  style={{
                    padding: '12px 24px',
                    border: 'none',
                    borderRadius: '6px',
                    // background: commandeLignes.length === 0 ? '#ccc' : '#2196f3',
					background: isProcessing ? '#ccc' : '#2196f3',
                    color: 'white',
                    // cursor: (isProcessing || commandeLignes.length === 0) ? 'not-allowed' : 'pointer',
					cursor: isProcessing ? 'not-allowed' : 'pointer',
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
