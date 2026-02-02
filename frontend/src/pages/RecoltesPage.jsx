import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { exportRecoltesPDF } from '../utils/pdfExport';
import { validateRecoltesCSV } from '../utils/csvImport';
import CSVImportModal from './CSVImportModal';
import { useColumnSettings, COLONNES_CONFIG } from '../hooks/useColumnSettings';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

// Options d'exposition autour de l'arbre
const EXPOSITIONS = [
  { value: 'Nord', label: '⬆️ Nord', short: 'N' },
  { value: 'Nord-Est', label: '↗️ Nord-Est', short: 'NE' },
  { value: 'Est', label: '➡️ Est', short: 'E' },
  { value: 'Sud-Est', label: '↘️ Sud-Est', short: 'SE' },
  { value: 'Sud', label: '⬇️ Sud', short: 'S' },
  { value: 'Sud-Ouest', label: '↙️ Sud-Ouest', short: 'SO' },
  { value: 'Ouest', label: '⬅️ Ouest', short: 'O' },
  { value: 'Nord-Ouest', label: '↖️ Nord-Ouest', short: 'NO' }
];

// Options de pagination
const PAGINATION_OPTIONS = [
  { value: 10, label: '10' },
  { value: 20, label: '20' },
  { value: 30, label: '30' },
  { value: 50, label: '50' },
  { value: 'all', label: 'Tous' }
];

// Configuration des qualités
const QUALITES_VENDABLES = ['Extra', 'Première catégorie', 'Deuxième catégorie'];
const QUALITES_NON_VENDABLES = ['Pourrie'];

function RecoltesPage() {
  const [recoltes, setRecoltes] = useState([]);
  const [parcelles, setParcelles] = useState([]);
  const [arbres, setArbres] = useState([]);
  const [caveurs, setCaveurs] = useState([]);
  const [chiens, setChiens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [editingRecolte, setEditingRecolte] = useState(null);
  const [filterAnnee, setFilterAnnee] = useState('all');
  const [message, setMessage] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Modal de confirmation
  const [confirmModal, setConfirmModal] = useState(null);
  
  // État pour la pagination
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);
  
  // États pour les filtres avancés
  const [filters, setFilters] = useState({
    search: '',
    parcelle: '',
    qualite: '',
    calibre: '',
    maturite: '',
    caveur: '',
    chien: '',
    exposition: '',
    dateDebut: '',
    dateFin: ''
  });
  const [showFilters, setShowFilters] = useState(false);
  
  // Sélection multiple
  const [selectedRecoltes, setSelectedRecoltes] = useState(new Set());
  
  // Recherche et filtre des récoltes existantes dans le modal
  const [showSearchPanel, setShowSearchPanel] = useState(false);
  const [searchFilters, setSearchFilters] = useState({
    parcelle_id: '',
    arbre_id: '',
    date_debut: '',
    date_fin: '',
    qualite: '',
    texte: ''
  });
  
  // Filtre de recherche pour les arbres dans le formulaire
  const [arbreSearchText, setArbreSearchText] = useState('');
  
  const [formData, setFormData] = useState({
    parcelle_id: '',
    arbre_id: '',
    date_recolte: '',
    poids_grammes: '',
    qualite: '',
    calibre: '',
    maturite: '',
    profondeur_cm: '',
    exposition: '',
    caveur: '',
    chien: '',
    conditions_meteo: '',
    temperature_sol: '',
    notes: ''
  });

  // Hook pour les paramètres de colonnes
  const { colonnesAffichees, colonnesExport, loading: loadingSettings } = useColumnSettings('recoltes');

  useEffect(() => {
    loadData();
  }, []);

  const showMessage = (text, type = 'success') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 4000);
  };

  const loadData = async () => {
    try {
      const [recoltesRes, parcellesRes, arbresRes, caveursRes, chiensRes] = await Promise.all([
        axios.get(`${API_URL}/recoltes`),
        axios.get(`${API_URL}/parcelles`),
        axios.get(`${API_URL}/arbres`),
        axios.get(`${API_URL}/caveurs`).catch(() => ({ data: [] })),
        axios.get(`${API_URL}/chiens`).catch(() => ({ data: [] }))
      ]);
      setRecoltes(recoltesRes.data);
      setParcelles(parcellesRes.data);
      setArbres(arbresRes.data);
      setCaveurs(caveursRes.data);
      setChiens(chiensRes.data);
      setLoading(false);
    } catch (error) {
      console.error('Erreur lors du chargement:', error);
      showMessage('Erreur lors du chargement des données', 'error');
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Si on change la parcelle, réinitialiser l'arbre et la recherche
    if (name === 'parcelle_id') {
      setFormData(prev => ({
        ...prev,
        arbre_id: ''
      }));
      setArbreSearchText('');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Vérification que l'arbre est sélectionné
    if (!formData.arbre_id) {
      showMessage('Veuillez sélectionner un arbre', 'error');
      return;
    }
    
    setIsProcessing(true);
    try {
      const dataToSend = { ...formData };
      // Ne pas envoyer les champs vides comme null
      Object.keys(dataToSend).forEach(key => {
        if (dataToSend[key] === '') {
          dataToSend[key] = null;
        }
      });

      if (editingRecolte) {
        await axios.put(`${API_URL}/recoltes/${editingRecolte.id}`, dataToSend);
        showMessage('Récolte mise à jour avec succès !', 'success');
      } else {
        await axios.post(`${API_URL}/recoltes`, dataToSend);
        showMessage('Récolte enregistrée avec succès !', 'success');
      }
      loadData();
      closeModal();
    } catch (error) {
      console.error('Erreur lors de la sauvegarde:', error);
      showMessage('Erreur lors de la sauvegarde de la récolte', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleEdit = (recolte) => {
    setEditingRecolte(recolte);
    setFormData({
      parcelle_id: recolte.parcelle_id || '',
      arbre_id: recolte.arbre_id || '',
      date_recolte: recolte.date_recolte ? recolte.date_recolte.split('T')[0] : '',
      poids_grammes: recolte.poids_grammes || '',
      qualite: recolte.qualite || '',
      calibre: recolte.calibre || '',
      maturite: recolte.maturite || '',
      profondeur_cm: recolte.profondeur_cm || '',
      exposition: recolte.exposition || '',
      caveur: recolte.caveur || '',
      chien: recolte.chien || '',
      conditions_meteo: recolte.conditions_meteo || '',
      temperature_sol: recolte.temperature_sol || '',
      notes: recolte.notes || ''
    });
    setShowModal(true);
  };

  const askDelete = (recolte) => {
    setConfirmModal({
      type: 'delete',
      item: recolte,
      title: 'Supprimer la récolte',
      message: `Êtes-vous sûr de vouloir supprimer la récolte du ${new Date(recolte.date_recolte).toLocaleDateString('fr-FR')} (${recolte.poids_grammes}g) ?`,
      confirmText: 'Oui, supprimer',
      confirmColor: '#f44336'
    });
  };

  const doDelete = async (recolte) => {
    setIsProcessing(true);
    setConfirmModal(null);
    
    try {
      await axios.delete(`${API_URL}/recoltes/${recolte.id}`);
      showMessage('Récolte supprimée avec succès !', 'success');
      loadData();
    } catch (error) {
      console.error('Erreur lors de la suppression:', error);
      showMessage('Erreur lors de la suppression de la récolte', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirm = () => {
    if (!confirmModal) return;
    if (confirmModal.type === 'delete') {
      doDelete(confirmModal.item);
    } else if (confirmModal.type === 'bulk-delete') {
      doBulkDelete();
    } else {
      setConfirmModal(null);
    }
  };

  const openNewModal = () => {
    setEditingRecolte(null);
    const today = new Date().toISOString().split('T')[0];
    setFormData({
      parcelle_id: '',
      arbre_id: '',
      date_recolte: today,
      poids_grammes: '',
      qualite: '',
      calibre: '',
      maturite: '',
      profondeur_cm: '',
      exposition: '',
      caveur: caveurs.length > 0 ? caveurs[0].nom : '',
      chien: chiens.length > 0 ? chiens[0].nom : '',
      conditions_meteo: '',
      temperature_sol: '',
      notes: ''
    });
    setShowModal(true);
  };

  const handleImportCSV = async (validData) => {
    try {
      for (const recolte of validData) {
        await axios.post(`${API_URL}/recoltes`, recolte);
      }
      loadData();
      showMessage(`${validData.length} récolte(s) importée(s) avec succès !`, 'success');
    } catch (error) {
      console.error('Erreur lors de l\'import:', error);
      throw new Error('Erreur lors de l\'import des récoltes');
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingRecolte(null);
    setShowSearchPanel(false);
    setArbreSearchText('');
    setSearchFilters({
      parcelle_id: '',
      arbre_id: '',
      date_debut: '',
      date_fin: '',
      qualite: '',
      texte: ''
    });
  };

  // Gestion des filtres de recherche
  const handleSearchFilterChange = (e) => {
    const { name, value } = e.target;
    setSearchFilters(prev => ({
      ...prev,
      [name]: value
    }));
    // Réinitialiser l'arbre si on change la parcelle
    if (name === 'parcelle_id') {
      setSearchFilters(prev => ({
        ...prev,
        arbre_id: ''
      }));
    }
  };

  // Filtrer les récoltes selon les critères de recherche
  const getFilteredSearchResults = () => {
    return recoltes.filter(r => {
      // Filtre par parcelle
      if (searchFilters.parcelle_id && r.parcelle_id !== parseInt(searchFilters.parcelle_id)) {
        return false;
      }
      // Filtre par arbre
      if (searchFilters.arbre_id && r.arbre_id !== parseInt(searchFilters.arbre_id)) {
        return false;
      }
      // Filtre par date début
      if (searchFilters.date_debut && r.date_recolte < searchFilters.date_debut) {
        return false;
      }
      // Filtre par date fin
      if (searchFilters.date_fin && r.date_recolte > searchFilters.date_fin) {
        return false;
      }
      // Filtre par qualité
      if (searchFilters.qualite && r.qualite !== searchFilters.qualite) {
        return false;
      }
      // Filtre texte libre (dans notes, caveur, chien)
      if (searchFilters.texte) {
        const searchLower = searchFilters.texte.toLowerCase();
        const matchNotes = r.notes && r.notes.toLowerCase().includes(searchLower);
        const matchCaveur = r.caveur && r.caveur.toLowerCase().includes(searchLower);
        const matchChien = r.chien && r.chien.toLowerCase().includes(searchLower);
        const matchParcelle = r.parcelle_nom && r.parcelle_nom.toLowerCase().includes(searchLower);
        const matchArbre = r.arbre_numero && r.arbre_numero.toLowerCase().includes(searchLower);
        if (!matchNotes && !matchCaveur && !matchChien && !matchParcelle && !matchArbre) {
          return false;
        }
      }
      return true;
    }).sort((a, b) => new Date(b.date_recolte) - new Date(a.date_recolte)).slice(0, 20);
  };

  // Copier les données d'une récolte existante dans le formulaire
  const copyFromRecolte = (recolte) => {
    setFormData(prev => ({
      ...prev,
      parcelle_id: recolte.parcelle_id || '',
      arbre_id: recolte.arbre_id || '',
      qualite: recolte.qualite || '',
      calibre: recolte.calibre || '',
      maturite: recolte.maturite || '',
      profondeur_cm: recolte.profondeur_cm || '',
      exposition: recolte.exposition || '',
      caveur: recolte.caveur || '',
      chien: recolte.chien || '',
      conditions_meteo: recolte.conditions_meteo || '',
      temperature_sol: recolte.temperature_sol || '',
      // Note: on ne copie pas la date, le poids et les notes
    }));
    setShowSearchPanel(false);
    showMessage('Données copiées ! Ajustez la date, le poids et les notes.', 'success');
  };

  // Arbres filtrés pour la recherche
  const arbresFilteredSearch = searchFilters.parcelle_id 
    ? arbres.filter(a => a.parcelle_id == searchFilters.parcelle_id)
    : arbres;

  // Export PDF avec colonnes configurées
  const handleExportPDF = () => {
    const annee = filterAnnee === 'all' ? null : parseInt(filterAnnee);
    exportRecoltesPDF(filteredRecoltes, annee, colonnesExport);
  };

  // Arbres filtrés par parcelle sélectionnée et par recherche texte
  const arbresFiltered = arbres.filter(a => {
    // Filtre par parcelle
    if (formData.parcelle_id && a.parcelle_id != formData.parcelle_id) {
      return false;
    }
    // Filtre par texte de recherche
    if (arbreSearchText) {
      const searchLower = arbreSearchText.toLowerCase();
      const matchNumero = a.numero && a.numero.toLowerCase().includes(searchLower);
      const matchEspece = a.espece && a.espece.toLowerCase().includes(searchLower);
      const matchVariete = a.variete_truffe && a.variete_truffe.toLowerCase().includes(searchLower);
      if (!matchNumero && !matchEspece && !matchVariete) {
        return false;
      }
    }
    return true;
  });

  // Obtenir les années disponibles
  const annees = [...new Set(recoltes.map(r => new Date(r.date_recolte).getFullYear()))].sort((a, b) => b - a);

  // Extraire les valeurs uniques pour les filtres
  const filterOptions = {
    qualites: [...new Set(recoltes.map(r => r.qualite).filter(Boolean))].sort(),
    calibres: [...new Set(recoltes.map(r => r.calibre).filter(Boolean))].sort(),
    maturites: [...new Set(recoltes.map(r => r.maturite).filter(Boolean))].sort(),
    caveurs: [...new Set(recoltes.map(r => r.caveur).filter(Boolean))].sort(),
    chiens: [...new Set(recoltes.map(r => r.chien).filter(Boolean))].sort(),
    expositions: [...new Set(recoltes.map(r => r.exposition).filter(Boolean))].sort()
  };

  // Gérer les changements de filtres
  const handleFilterChange = (name, value) => {
    setFilters(prev => ({ ...prev, [name]: value }));
    setCurrentPage(1);
  };

  // Réinitialiser tous les filtres
  const resetFilters = () => {
    setFilters({
      search: '',
      parcelle: '',
      qualite: '',
      calibre: '',
      maturite: '',
      caveur: '',
      chien: '',
      exposition: '',
      dateDebut: '',
      dateFin: ''
    });
    setFilterAnnee('all');
    setCurrentPage(1);
  };

  // Vérifier si des filtres sont actifs
  const hasActiveFilters = Object.values(filters).some(v => v !== '') || filterAnnee !== 'all';

  // Filtrage avancé des récoltes
  const filteredRecoltes = recoltes.filter(r => {
    // Filtre par année
    if (filterAnnee !== 'all') {
      const year = new Date(r.date_recolte).getFullYear();
      if (year !== parseInt(filterAnnee)) return false;
    }
    
    // Filtre recherche textuelle
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      const matchArbre = r.arbre_numero?.toLowerCase().includes(searchLower);
      const matchParcelle = r.parcelle_nom?.toLowerCase().includes(searchLower);
      const matchNotes = r.notes?.toLowerCase().includes(searchLower);
      const matchCaveur = r.caveur?.toLowerCase().includes(searchLower);
      const matchChien = r.chien?.toLowerCase().includes(searchLower);
      if (!matchArbre && !matchParcelle && !matchNotes && !matchCaveur && !matchChien) return false;
    }
    
    // Filtre par parcelle
    if (filters.parcelle && r.parcelle_id !== parseInt(filters.parcelle)) return false;
    
    // Filtre par qualité
    if (filters.qualite && r.qualite !== filters.qualite) return false;
    
    // Filtre par calibre
    if (filters.calibre && r.calibre !== filters.calibre) return false;
    
    // Filtre par maturité
    if (filters.maturite && r.maturite !== filters.maturite) return false;
    
    // Filtre par caveur
    if (filters.caveur && r.caveur !== filters.caveur) return false;
    
    // Filtre par chien
    if (filters.chien && r.chien !== filters.chien) return false;
    
    // Filtre par exposition
    if (filters.exposition && r.exposition !== filters.exposition) return false;
    
    // Filtre par date début
    if (filters.dateDebut && r.date_recolte < filters.dateDebut) return false;
    
    // Filtre par date fin
    if (filters.dateFin && r.date_recolte > filters.dateFin) return false;
    
    return true;
  }).sort((a, b) => new Date(b.date_recolte) - new Date(a.date_recolte));

  // Pagination
  const totalRecoltes = filteredRecoltes.length;
  const totalPages = itemsPerPage === 'all' ? 1 : Math.ceil(totalRecoltes / itemsPerPage);
  
  const paginatedRecoltes = itemsPerPage === 'all' 
    ? filteredRecoltes 
    : filteredRecoltes.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handleItemsPerPageChange = (value) => {
    setItemsPerPage(value);
    setCurrentPage(1);
  };

  const getPageNumbers = () => {
    const pages = [];
    const maxVisiblePages = 5;
    
    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= 4; i++) pages.push(i);
        pages.push('...');
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1);
        pages.push('...');
        for (let i = totalPages - 3; i <= totalPages; i++) pages.push(i);
      } else {
        pages.push(1);
        pages.push('...');
        for (let i = currentPage - 1; i <= currentPage + 1; i++) pages.push(i);
        pages.push('...');
        pages.push(totalPages);
      }
    }
    return pages;
  };

  // Sélection multiple - Fonctions
  const handleSelectRecolte = (recolteId) => {
    setSelectedRecoltes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(recolteId)) {
        newSet.delete(recolteId);
      } else {
        newSet.add(recolteId);
      }
      return newSet;
    });
  };

  const handleSelectAllPage = () => {
    if (isAllPageSelected) {
      setSelectedRecoltes(prev => {
        const newSet = new Set(prev);
        paginatedRecoltes.forEach(r => newSet.delete(r.id));
        return newSet;
      });
    } else {
      setSelectedRecoltes(prev => {
        const newSet = new Set(prev);
        paginatedRecoltes.forEach(r => newSet.add(r.id));
        return newSet;
      });
    }
  };

  const handleDeselectAll = () => {
    setSelectedRecoltes(new Set());
  };

  const handleSelectAllFiltered = () => {
    setSelectedRecoltes(new Set(filteredRecoltes.map(r => r.id)));
  };

  const askBulkDelete = () => {
    setConfirmModal({
      type: 'bulk-delete',
      item: null,
      title: 'Supprimer plusieurs récoltes',
      message: `Êtes-vous sûr de vouloir supprimer ${selectedRecoltes.size} récolte(s) ? Cette action est irréversible.`,
      confirmText: 'Oui, supprimer tout',
      confirmColor: '#f44336'
    });
  };

  const doBulkDelete = async () => {
    setIsProcessing(true);
    setConfirmModal(null);
    
    try {
      const ids = Array.from(selectedRecoltes);
      await Promise.all(ids.map(id => axios.delete(`${API_URL}/recoltes/${id}`)));
      showMessage(`${ids.length} récolte(s) supprimée(s) avec succès !`, 'success');
      setSelectedRecoltes(new Set());
      loadData();
    } catch (error) {
      console.error('Erreur lors de la suppression groupée:', error);
      showMessage('Erreur lors de la suppression groupée', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const isAllPageSelected = paginatedRecoltes.length > 0 && paginatedRecoltes.every(r => selectedRecoltes.has(r.id));
  const isSomePageSelected = paginatedRecoltes.some(r => selectedRecoltes.has(r.id));

  // Statistiques de base
  const stats = {
    total: filteredRecoltes.length,
    poidsTotal: filteredRecoltes.reduce((sum, r) => sum + parseFloat(r.poids_grammes || 0), 0),
    poidsSelection: Array.from(selectedRecoltes).reduce((sum, id) => {
      const r = recoltes.find(rec => rec.id === id);
      return sum + (r ? parseFloat(r.poids_grammes || 0) : 0);
    }, 0)
  };

  // Statistiques par qualité (vendable vs non vendable)
  const statsQualite = {
    vendable: {
      count: filteredRecoltes.filter(r => QUALITES_VENDABLES.includes(r.qualite)).length,
      poids: filteredRecoltes.filter(r => QUALITES_VENDABLES.includes(r.qualite)).reduce((sum, r) => sum + parseFloat(r.poids_grammes || 0), 0),
      extra: {
        count: filteredRecoltes.filter(r => r.qualite === 'Extra').length,
        poids: filteredRecoltes.filter(r => r.qualite === 'Extra').reduce((sum, r) => sum + parseFloat(r.poids_grammes || 0), 0)
      },
      premiere: {
        count: filteredRecoltes.filter(r => r.qualite === 'Première catégorie').length,
        poids: filteredRecoltes.filter(r => r.qualite === 'Première catégorie').reduce((sum, r) => sum + parseFloat(r.poids_grammes || 0), 0)
      },
      deuxieme: {
        count: filteredRecoltes.filter(r => r.qualite === 'Deuxième catégorie').length,
        poids: filteredRecoltes.filter(r => r.qualite === 'Deuxième catégorie').reduce((sum, r) => sum + parseFloat(r.poids_grammes || 0), 0)
      }
    },
    pourri: {
      count: filteredRecoltes.filter(r => r.qualite === 'Pourrie').length,
      poids: filteredRecoltes.filter(r => r.qualite === 'Pourrie').reduce((sum, r) => sum + parseFloat(r.poids_grammes || 0), 0)
    },
    nonClasse: {
      count: filteredRecoltes.filter(r => !r.qualite).length,
      poids: filteredRecoltes.filter(r => !r.qualite).reduce((sum, r) => sum + parseFloat(r.poids_grammes || 0), 0)
    }
  };

  // Configuration des colonnes pour l'affichage
  const config = COLONNES_CONFIG.recoltes;
  
  // Ajouter la colonne exposition à la config si elle n'existe pas
  const configWithExposition = {
    ...config,
    exposition: {
      label: 'Exposition',
      render: (r) => {
        const expo = EXPOSITIONS.find(e => e.value === r.exposition);
        return expo ? expo.label : r.exposition || '-';
      },
      align: 'center'
    }
  };
  
  const colonnesValides = colonnesAffichees.filter(col => configWithExposition[col]);

  // Fonction pour obtenir le libellé d'exposition avec emoji
  const getExpositionLabel = (value) => {
    const expo = EXPOSITIONS.find(e => e.value === value);
    return expo ? expo.label : value || '-';
  };

  // Fonction pour obtenir l'icône et la couleur selon la qualité
  const getQualiteStyle = (qualite) => {
    switch(qualite) {
      case 'Extra':
        return { icon: '⭐', bg: '#fff9c4', color: '#f9a825' };
      case 'Première catégorie':
        return { icon: '🥇', bg: '#c8e6c9', color: '#2e7d32' };
      case 'Deuxième catégorie':
        return { icon: '🥈', bg: '#bbdefb', color: '#1565c0' };
      case 'Pourrie':
        return { icon: '🗑️', bg: '#ffcdd2', color: '#c62828' };
      default:
        return { icon: '○', bg: '#f5f5f5', color: '#757575' };
    }
  };

  if (loading || loadingSettings) {
    return <div className="loading">Chargement des récoltes...</div>;
  }

  return (
    <div className="page-container">
      {/* Modal de confirmation */}
      {confirmModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000
        }}>
          <div style={{
            background: 'white',
            padding: '2rem',
            borderRadius: '12px',
            maxWidth: '420px',
            textAlign: 'center',
            boxShadow: '0 4px 20px rgba(0,0,0,0.3)'
          }}>
            <h3 style={{ marginBottom: '1rem', color: '#333' }}>{confirmModal.title}</h3>
            <p style={{ marginBottom: '1.5rem', color: '#666', lineHeight: '1.5' }}>
              {confirmModal.message}
            </p>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              <button
                onClick={handleConfirm}
                disabled={isProcessing}
                style={{
                  padding: '0.75rem 1.5rem',
                  background: confirmModal.confirmColor,
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: isProcessing ? 'wait' : 'pointer',
                  fontSize: '1rem',
                  fontWeight: 'bold',
                  opacity: isProcessing ? 0.7 : 1
                }}
              >
                {isProcessing ? 'En cours...' : confirmModal.confirmText}
              </button>
              <button
                onClick={() => setConfirmModal(null)}
                disabled={isProcessing}
                style={{
                  padding: '0.75rem 1.5rem',
                  background: '#9e9e9e',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '1rem'
                }}
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Message de notification */}
      {message && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          padding: '1rem 1.5rem',
          borderRadius: '8px',
          background: message.type === 'success' ? '#4caf50' : '#f44336',
          color: 'white',
          boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
          zIndex: 9999,
          animation: 'slideIn 0.3s ease'
        }}>
          {message.text}
        </div>
      )}

      <div className="page-header">
        <h2>🍄 Suivi des récoltes</h2>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button 
            className="btn btn-secondary" 
            onClick={() => setShowImportModal(true)}
            title="Importer des récoltes depuis un fichier CSV"
          >
            📥 Import CSV
          </button>
          <button className="btn btn-secondary" onClick={handleExportPDF}>
            📄 Export PDF
          </button>
          <button className="btn btn-primary" onClick={openNewModal}>
            ➕ Nouvelle récolte
          </button>
        </div>
      </div>

      {/* DASHBOARD QUALITÉ - 2 ZONES DISTINCTES */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: '2fr 1fr', 
        gap: '1rem', 
        marginBottom: '1.5rem' 
      }}>
        {/* Zone 1: Qualités VENDABLES (Extra, 1ère, 2ème) */}
        <div style={{
          background: 'linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%)',
          borderRadius: '16px',
          padding: '1.25rem',
          border: '2px solid #4caf50',
          boxShadow: '0 4px 12px rgba(76, 175, 80, 0.15)'
        }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '0.75rem', 
            marginBottom: '1rem',
            borderBottom: '2px solid rgba(76, 175, 80, 0.3)',
            paddingBottom: '0.75rem'
          }}>
            <span style={{ fontSize: '1.5rem' }}>✅</span>
            <h3 style={{ margin: 0, color: '#2e7d32', fontSize: '1.1rem' }}>Qualité Vendable</h3>
            <span style={{ 
              marginLeft: 'auto', 
              background: '#2e7d32', 
              color: 'white', 
              padding: '0.25rem 0.75rem', 
              borderRadius: '20px',
              fontSize: '0.9rem',
              fontWeight: 'bold'
            }}>
              {(statsQualite.vendable.poids / 1000).toFixed(2)} kg
            </span>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
            {/* Extra */}
            <div 
              style={{
                background: 'white',
                borderRadius: '12px',
                padding: '1rem',
                textAlign: 'center',
                cursor: 'pointer',
                border: filters.qualite === 'Extra' ? '3px solid #f9a825' : '2px solid #fff9c4',
                transition: 'all 0.2s',
                boxShadow: filters.qualite === 'Extra' ? '0 4px 12px rgba(249, 168, 37, 0.3)' : 'none'
              }}
              onClick={() => handleFilterChange('qualite', filters.qualite === 'Extra' ? '' : 'Extra')}
            >
              <div style={{ fontSize: '1.75rem', marginBottom: '0.25rem' }}>⭐</div>
              <div style={{ fontWeight: 'bold', color: '#f9a825', fontSize: '1.25rem' }}>
                {statsQualite.vendable.extra.count}
              </div>
              <div style={{ fontSize: '0.8rem', color: '#666' }}>Extra</div>
              <div style={{ 
                fontSize: '0.85rem', 
                fontWeight: '600', 
                color: '#8b4513',
                marginTop: '0.25rem'
              }}>
                {(statsQualite.vendable.extra.poids / 1000).toFixed(2)} kg
              </div>
            </div>
            
            {/* Première catégorie */}
            <div 
              style={{
                background: 'white',
                borderRadius: '12px',
                padding: '1rem',
                textAlign: 'center',
                cursor: 'pointer',
                border: filters.qualite === 'Première catégorie' ? '3px solid #2e7d32' : '2px solid #c8e6c9',
                transition: 'all 0.2s',
                boxShadow: filters.qualite === 'Première catégorie' ? '0 4px 12px rgba(46, 125, 50, 0.3)' : 'none'
              }}
              onClick={() => handleFilterChange('qualite', filters.qualite === 'Première catégorie' ? '' : 'Première catégorie')}
            >
              <div style={{ fontSize: '1.75rem', marginBottom: '0.25rem' }}>🥇</div>
              <div style={{ fontWeight: 'bold', color: '#2e7d32', fontSize: '1.25rem' }}>
                {statsQualite.vendable.premiere.count}
              </div>
              <div style={{ fontSize: '0.8rem', color: '#666' }}>1ère catégorie</div>
              <div style={{ 
                fontSize: '0.85rem', 
                fontWeight: '600', 
                color: '#8b4513',
                marginTop: '0.25rem'
              }}>
                {(statsQualite.vendable.premiere.poids / 1000).toFixed(2)} kg
              </div>
            </div>
            
            {/* Deuxième catégorie */}
            <div 
              style={{
                background: 'white',
                borderRadius: '12px',
                padding: '1rem',
                textAlign: 'center',
                cursor: 'pointer',
                border: filters.qualite === 'Deuxième catégorie' ? '3px solid #1565c0' : '2px solid #bbdefb',
                transition: 'all 0.2s',
                boxShadow: filters.qualite === 'Deuxième catégorie' ? '0 4px 12px rgba(21, 101, 192, 0.3)' : 'none'
              }}
              onClick={() => handleFilterChange('qualite', filters.qualite === 'Deuxième catégorie' ? '' : 'Deuxième catégorie')}
            >
              <div style={{ fontSize: '1.75rem', marginBottom: '0.25rem' }}>🥈</div>
              <div style={{ fontWeight: 'bold', color: '#1565c0', fontSize: '1.25rem' }}>
                {statsQualite.vendable.deuxieme.count}
              </div>
              <div style={{ fontSize: '0.8rem', color: '#666' }}>2ème catégorie</div>
              <div style={{ 
                fontSize: '0.85rem', 
                fontWeight: '600', 
                color: '#8b4513',
                marginTop: '0.25rem'
              }}>
                {(statsQualite.vendable.deuxieme.poids / 1000).toFixed(2)} kg
              </div>
            </div>
          </div>
        </div>

        {/* Zone 2: POURRI (Non vendable) */}
        <div style={{
          background: 'linear-gradient(135deg, #ffebee 0%, #ffcdd2 100%)',
          borderRadius: '16px',
          padding: '1.25rem',
          border: '2px solid #ef5350',
          boxShadow: '0 4px 12px rgba(239, 83, 80, 0.15)'
        }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '0.75rem', 
            marginBottom: '1rem',
            borderBottom: '2px solid rgba(239, 83, 80, 0.3)',
            paddingBottom: '0.75rem'
          }}>
            <span style={{ fontSize: '1.5rem' }}>❌</span>
            <h3 style={{ margin: 0, color: '#c62828', fontSize: '1.1rem' }}>Non Vendable</h3>
          </div>
          
          {/* Pourrie */}
          <div 
            style={{
              background: 'white',
              borderRadius: '12px',
              padding: '1rem',
              textAlign: 'center',
              cursor: 'pointer',
              border: filters.qualite === 'Pourrie' ? '3px solid #c62828' : '2px solid #ffcdd2',
              transition: 'all 0.2s',
              boxShadow: filters.qualite === 'Pourrie' ? '0 4px 12px rgba(198, 40, 40, 0.3)' : 'none'
            }}
            onClick={() => handleFilterChange('qualite', filters.qualite === 'Pourrie' ? '' : 'Pourrie')}
          >
            <div style={{ fontSize: '2rem', marginBottom: '0.25rem' }}>🗑️</div>
            <div style={{ fontWeight: 'bold', color: '#c62828', fontSize: '1.5rem' }}>
              {statsQualite.pourri.count}
            </div>
            <div style={{ fontSize: '0.9rem', color: '#666' }}>Pourrie</div>
            <div style={{ 
              fontSize: '1rem', 
              fontWeight: '600', 
              color: '#8b4513',
              marginTop: '0.25rem'
            }}>
              {(statsQualite.pourri.poids / 1000).toFixed(2)} kg
            </div>
          </div>

          {/* Non classé */}
          {statsQualite.nonClasse.count > 0 && (
            <div style={{
              marginTop: '0.75rem',
              padding: '0.5rem',
              background: 'rgba(255,255,255,0.7)',
              borderRadius: '8px',
              textAlign: 'center',
              fontSize: '0.85rem',
              color: '#666'
            }}>
              <span style={{ marginRight: '0.5rem' }}>○</span>
              {statsQualite.nonClasse.count} non classé(s) ({(statsQualite.nonClasse.poids / 1000).toFixed(2)} kg)
            </div>
          )}
        </div>
      </div>

      {/* Barre de sélection groupée */}
      {selectedRecoltes.size > 0 && (
        <div style={{
          background: '#e3f2fd',
          padding: '1rem',
          borderRadius: '12px',
          marginBottom: '1rem',
          border: '2px solid #1976d2',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <span style={{ fontWeight: 'bold', color: '#1976d2' }}>
              ✅ {selectedRecoltes.size} récolte(s) sélectionnée(s)
              {stats.poidsSelection > 0 && (
                <span style={{ marginLeft: '1rem', color: '#8b4513' }}>
                  ({(stats.poidsSelection / 1000).toFixed(2)} kg)
                </span>
              )}
            </span>
            <button
              onClick={handleDeselectAll}
              style={{
                padding: '0.4rem 0.8rem',
                background: 'transparent',
                border: '1px solid #1976d2',
                borderRadius: '6px',
                color: '#1976d2',
                cursor: 'pointer'
              }}
            >
              Tout désélectionner
            </button>
            {filteredRecoltes.length > selectedRecoltes.size && (
              <button
                onClick={handleSelectAllFiltered}
                style={{
                  padding: '0.4rem 0.8rem',
                  background: 'transparent',
                  border: '1px solid #1976d2',
                  borderRadius: '6px',
                  color: '#1976d2',
                  cursor: 'pointer'
                }}
              >
                Sélectionner les {filteredRecoltes.length} récoltes filtrées
              </button>
            )}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={askBulkDelete}
              className="btn btn-danger"
              style={{ padding: '0.5rem 1rem' }}
            >
              🗑️ Supprimer la sélection
            </button>
          </div>
        </div>
      )}

      {/* Barre de recherche et filtres */}
      <div style={{ 
        background: 'white', 
        padding: '1rem', 
        borderRadius: '12px', 
        marginBottom: '1rem',
        boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
      }}>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ flex: '1', minWidth: '250px', position: 'relative' }}>
            <input
              type="text"
              placeholder="🔍 Rechercher par arbre, parcelle, caveur, chien, notes..."
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              style={{
                width: '100%',
                padding: '0.75rem 1rem',
                border: '2px solid #e0e0e0',
                borderRadius: '8px',
                fontSize: '1rem'
              }}
            />
            {filters.search && (
              <button
                onClick={() => handleFilterChange('search', '')}
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '1.2rem',
                  color: '#999'
                }}
              >
                ✕
              </button>
            )}
          </div>
          
          <select 
            value={filterAnnee} 
            onChange={(e) => { setFilterAnnee(e.target.value); setCurrentPage(1); }}
            style={{ 
              padding: '0.75rem', 
              borderRadius: '8px', 
              border: filterAnnee !== 'all' ? '2px solid #2c5f2d' : '2px solid #e0e0e0',
              background: filterAnnee !== 'all' ? '#e8f5e9' : 'white'
            }}
          >
            <option value="all">📆 Toutes les saisons</option>
            {annees.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          
          <button
            onClick={() => setShowFilters(!showFilters)}
            style={{
              padding: '0.75rem 1.25rem',
              border: hasActiveFilters ? '2px solid #2c5f2d' : '2px solid #e0e0e0',
              borderRadius: '8px',
              background: hasActiveFilters ? '#e8f5e9' : 'white',
              color: hasActiveFilters ? '#2c5f2d' : '#666',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontWeight: hasActiveFilters ? 'bold' : 'normal'
            }}
          >
            🎛️ Filtres {hasActiveFilters && `(${Object.values(filters).filter(v => v !== '').length + (filterAnnee !== 'all' ? 1 : 0)})`}
            <span style={{ fontSize: '0.8rem' }}>{showFilters ? '▲' : '▼'}</span>
          </button>
          
          {hasActiveFilters && (
            <button
              onClick={resetFilters}
              style={{
                padding: '0.75rem 1rem',
                border: 'none',
                borderRadius: '8px',
                background: '#ffebee',
                color: '#c62828',
                cursor: 'pointer',
                fontWeight: '500'
              }}
            >
              ✕ Réinitialiser
            </button>
          )}
        </div>

        {/* Panneau de filtres avancés */}
        {showFilters && (
          <div style={{ 
            marginTop: '1rem', 
            paddingTop: '1rem', 
            borderTop: '1px solid #eee',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            gap: '1rem'
          }}>
            <div>
              <label style={{ fontSize: '0.85rem', color: '#666', marginBottom: '0.25rem', display: 'block' }}>
                Parcelle
              </label>
              <select
                value={filters.parcelle}
                onChange={(e) => handleFilterChange('parcelle', e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid #ddd',
                  borderRadius: '6px',
                  background: filters.parcelle ? '#e8f5e9' : 'white'
                }}
              >
                <option value="">Toutes</option>
                {parcelles.map(p => (
                  <option key={p.id} value={p.id}>{p.nom}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ fontSize: '0.85rem', color: '#666', marginBottom: '0.25rem', display: 'block' }}>
                Qualité
              </label>
              <select
                value={filters.qualite}
                onChange={(e) => handleFilterChange('qualite', e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid #ddd',
                  borderRadius: '6px',
                  background: filters.qualite ? '#e8f5e9' : 'white'
                }}
              >
                <option value="">Toutes</option>
                <option value="Extra">⭐ Extra</option>
                <option value="Première catégorie">🥇 Première</option>
                <option value="Deuxième catégorie">🥈 Deuxième</option>
                <option value="Pourrie">🗑️ Pourrie</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: '0.85rem', color: '#666', marginBottom: '0.25rem', display: 'block' }}>
                Calibre
              </label>
              <select
                value={filters.calibre}
                onChange={(e) => handleFilterChange('calibre', e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid #ddd',
                  borderRadius: '6px',
                  background: filters.calibre ? '#e8f5e9' : 'white'
                }}
              >
                <option value="">Tous</option>
                {filterOptions.calibres.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ fontSize: '0.85rem', color: '#666', marginBottom: '0.25rem', display: 'block' }}>
                Maturité
              </label>
              <select
                value={filters.maturite}
                onChange={(e) => handleFilterChange('maturite', e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid #ddd',
                  borderRadius: '6px',
                  background: filters.maturite ? '#e8f5e9' : 'white'
                }}
              >
                <option value="">Toutes</option>
                {filterOptions.maturites.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ fontSize: '0.85rem', color: '#666', marginBottom: '0.25rem', display: 'block' }}>
                Caveur
              </label>
              <select
                value={filters.caveur}
                onChange={(e) => handleFilterChange('caveur', e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid #ddd',
                  borderRadius: '6px',
                  background: filters.caveur ? '#e8f5e9' : 'white'
                }}
              >
                <option value="">Tous</option>
                {filterOptions.caveurs.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ fontSize: '0.85rem', color: '#666', marginBottom: '0.25rem', display: 'block' }}>
                Chien
              </label>
              <select
                value={filters.chien}
                onChange={(e) => handleFilterChange('chien', e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid #ddd',
                  borderRadius: '6px',
                  background: filters.chien ? '#e8f5e9' : 'white'
                }}
              >
                <option value="">Tous</option>
                {filterOptions.chiens.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ fontSize: '0.85rem', color: '#666', marginBottom: '0.25rem', display: 'block' }}>
                Exposition
              </label>
              <select
                value={filters.exposition}
                onChange={(e) => handleFilterChange('exposition', e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid #ddd',
                  borderRadius: '6px',
                  background: filters.exposition ? '#e8f5e9' : 'white'
                }}
              >
                <option value="">Toutes</option>
                {EXPOSITIONS.map(e => (
                  <option key={e.value} value={e.value}>{e.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ fontSize: '0.85rem', color: '#666', marginBottom: '0.25rem', display: 'block' }}>
                Date début
              </label>
              <input
                type="date"
                value={filters.dateDebut}
                onChange={(e) => handleFilterChange('dateDebut', e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid #ddd',
                  borderRadius: '6px',
                  background: filters.dateDebut ? '#e8f5e9' : 'white'
                }}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.85rem', color: '#666', marginBottom: '0.25rem', display: 'block' }}>
                Date fin
              </label>
              <input
                type="date"
                value={filters.dateFin}
                onChange={(e) => handleFilterChange('dateFin', e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid #ddd',
                  borderRadius: '6px',
                  background: filters.dateFin ? '#e8f5e9' : 'white'
                }}
              />
            </div>
          </div>
        )}

        {/* Résumé des résultats */}
        {hasActiveFilters && (
          <div style={{ 
            marginTop: '1rem', 
            padding: '0.75rem', 
            background: '#f5f5f5', 
            borderRadius: '6px',
            fontSize: '0.9rem',
            color: '#666'
          }}>
            <strong>{filteredRecoltes.length}</strong> récolte{filteredRecoltes.length > 1 ? 's' : ''} trouvée{filteredRecoltes.length > 1 ? 's' : ''} 
            {filteredRecoltes.length !== recoltes.length && (
              <span> sur {recoltes.length} au total</span>
            )}
            {filteredRecoltes.length > 0 && (
              <span> ➡ Total: <strong style={{ color: '#8b4513' }}>{(stats.poidsTotal / 1000).toFixed(2)} kg</strong></span>
            )}
          </div>
        )}
      </div>

      {/* Statistiques rapides */}
      <div className="stats-grid" style={{ marginBottom: '1rem' }}>
        <div className="card">
          <div className="card-title">Total récoltes</div>
          <div className="card-value">{filteredRecoltes.length}</div>
        </div>
        <div className="card">
          <div className="card-title">Poids total</div>
          <div className="card-value" style={{ color: '#8b4513' }}>
            {(stats.poidsTotal / 1000).toFixed(2)} <span style={{ fontSize: '1rem' }}>kg</span>
          </div>
        </div>
        <div className="card">
          <div className="card-title">Poids moyen</div>
          <div className="card-value">
            {filteredRecoltes.length > 0 
              ? (stats.poidsTotal / filteredRecoltes.length).toFixed(1) 
              : 0} <span style={{ fontSize: '1rem' }}>g</span>
          </div>
        </div>
        <div className="card">
          <div className="card-title">Années</div>
          <div className="card-value">{annees.length}</div>
        </div>
      </div>

      {/* Contrôles de pagination */}
      {filteredRecoltes.length > 0 && (
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          marginBottom: '1rem',
          flexWrap: 'wrap',
          gap: '1rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontWeight: '500', color: '#666' }}>Afficher :</span>
            {PAGINATION_OPTIONS.map(option => (
              <button
                key={option.value}
                onClick={() => handleItemsPerPageChange(option.value)}
                style={{
                  padding: '0.4rem 0.8rem',
                  border: itemsPerPage === option.value ? '2px solid #2c5f2d' : '1px solid #ddd',
                  borderRadius: '6px',
                  background: itemsPerPage === option.value ? '#e8f5e9' : 'white',
                  color: itemsPerPage === option.value ? '#2c5f2d' : '#666',
                  fontWeight: itemsPerPage === option.value ? 'bold' : 'normal',
                  cursor: 'pointer'
                }}
              >
                {option.label}
              </button>
            ))}
          </div>
          
          {itemsPerPage !== 'all' && totalPages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                style={{
                  padding: '0.4rem 0.8rem',
                  border: '1px solid #ddd',
                  borderRadius: '6px',
                  background: currentPage === 1 ? '#f5f5f5' : 'white',
                  cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                  opacity: currentPage === 1 ? 0.5 : 1
                }}
              >
                ◀️
              </button>
              
              {getPageNumbers().map((page, idx) => (
                <button
                  key={idx}
                  onClick={() => page !== '...' && setCurrentPage(page)}
                  disabled={page === '...'}
                  style={{
                    padding: '0.4rem 0.8rem',
                    border: currentPage === page ? '2px solid #2c5f2d' : '1px solid #ddd',
                    borderRadius: '6px',
                    background: currentPage === page ? '#2c5f2d' : 'white',
                    color: currentPage === page ? 'white' : '#666',
                    fontWeight: currentPage === page ? 'bold' : 'normal',
                    cursor: page === '...' ? 'default' : 'pointer'
                  }}
                >
                  {page}
                </button>
              ))}
              
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                style={{
                  padding: '0.4rem 0.8rem',
                  border: '1px solid #ddd',
                  borderRadius: '6px',
                  background: currentPage === totalPages ? '#f5f5f5' : 'white',
                  cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                  opacity: currentPage === totalPages ? 0.5 : 1
                }}
              >
                ▶️
              </button>
              
              <span style={{ color: '#666', marginLeft: '0.5rem' }}>
                Page {currentPage} sur {totalPages}
              </span>
            </div>
          )}
        </div>
      )}

      {filteredRecoltes.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#888' }}>
          <p style={{ fontSize: '1.2rem' }}>Aucune récolte {hasActiveFilters ? 'correspondant aux filtres' : 'enregistrée'}</p>
          <p>{hasActiveFilters ? 'Essayez de modifier vos critères de recherche' : 'Cliquez sur "Nouvelle récolte" pour commencer'}</p>
        </div>
      ) : (
        <table>
          <thead>
            <tr>
              <th style={{ width: '40px', textAlign: 'center' }}>
                <input
                  type="checkbox"
                  checked={isAllPageSelected}
                  ref={el => el && (el.indeterminate = isSomePageSelected && !isAllPageSelected)}
                  onChange={handleSelectAllPage}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
              </th>
              <th>Date</th>
              <th>Parcelle</th>
              <th>Arbre</th>
              <th style={{ textAlign: 'right' }}>Poids</th>
              <th style={{ textAlign: 'center' }}>Qualité</th>
              <th style={{ textAlign: 'center' }}>Calibre</th>
              <th style={{ textAlign: 'center' }}>Exposition</th>
              <th>Caveur / Chien</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginatedRecoltes.map(recolte => {
              const qualiteStyle = getQualiteStyle(recolte.qualite);
              return (
                <tr 
                  key={recolte.id}
                  style={{ 
                    background: selectedRecoltes.has(recolte.id) ? '#e3f2fd' : 'transparent',
                    transition: 'background 0.2s'
                  }}
                >
                  <td style={{ textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      checked={selectedRecoltes.has(recolte.id)}
                      onChange={() => handleSelectRecolte(recolte.id)}
                      style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                    />
                  </td>
                  <td>
                    <strong>{new Date(recolte.date_recolte).toLocaleDateString('fr-FR')}</strong>
                  </td>
                  <td>{recolte.parcelle_nom || '-'}</td>
                  <td>
                    <span style={{ 
                      padding: '0.2rem 0.5rem', 
                      background: '#f0f0f0', 
                      borderRadius: '4px',
                      fontFamily: 'monospace'
                    }}>
                      {recolte.arbre_numero || '-'}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <strong style={{ color: '#8b4513', fontSize: '1.1rem' }}>
                      {recolte.poids_grammes}g
                    </strong>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    {recolte.qualite ? (
                      <span style={{
                        padding: '0.25rem 0.5rem',
                        borderRadius: '12px',
                        background: qualiteStyle.bg,
                        color: qualiteStyle.color,
                        fontSize: '0.85rem',
                        fontWeight: '500'
                      }}>
                        {qualiteStyle.icon} {recolte.qualite === 'Première catégorie' ? '1ère' : 
                                              recolte.qualite === 'Deuxième catégorie' ? '2ème' : 
                                              recolte.qualite}
                      </span>
                    ) : '-'}
                  </td>
                  <td style={{ textAlign: 'center', fontSize: '0.85rem' }}>
                    {recolte.calibre ? recolte.calibre.split(' ')[0] : '-'}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    {recolte.exposition ? (
                      <span style={{
                        padding: '0.25rem 0.5rem',
                        borderRadius: '8px',
                        background: '#e8f5e9',
                        color: '#2e7d32',
                        fontSize: '0.9rem'
                      }}>
                        {getExpositionLabel(recolte.exposition)}
                      </span>
                    ) : '-'}
                  </td>
                  <td>
                    <div style={{ fontSize: '0.85rem' }}>
                      {recolte.caveur && <div>👤 {recolte.caveur}</div>}
                      {recolte.chien && <div>🐕 {recolte.chien}</div>}
                      {!recolte.caveur && !recolte.chien && '-'}
                    </div>
                  </td>
                  <td>
                    <button 
                      className="btn btn-secondary" 
                      onClick={() => handleEdit(recolte)}
                      style={{ marginRight: '0.5rem', padding: '0.4rem 0.8rem' }}
                      title="Modifier"
                    >
                      ✏️
                    </button>
                    <button 
                      className="btn btn-danger" 
                      onClick={() => askDelete(recolte)}
                      style={{ padding: '0.4rem 0.8rem' }}
                      title="Supprimer"
                    >
                      🗑️
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {/* Modal de création/édition - TODO: À compléter avec tout le JSX du formulaire */}
      {/* Le formulaire complet sera ajouté dans un prochain commit */}

      {/* Modal d'import CSV */}
      <CSVImportModal
        show={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImport={handleImportCSV}
        validateFunction={validateRecoltesCSV}
        type="recoltes"
        title="Importer des récoltes depuis CSV"
        dependencies={{ parcelles, arbres }}
      />
    </div>
  );
}

export default RecoltesPage;