import React, { useState, useEffect, useRef, useMemo } from 'react';
import axios from 'axios';
import { MapContainer, TileLayer, Marker, Polygon, useMapEvents, useMap, LayersControl } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { exportArbresPDF } from '../utils/pdfExport';
import { validateArbresCSV } from '../utils/csvImport';
import CSVImportModal from './CSVImportModal';
import { useColumnSettings, COLONNES_CONFIG } from '../hooks/useColumnSettings';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

// Coordonnees par defaut (meme que Carte.js)
const DEFAULT_CENTER = [46.1464315, -0.1652445];
const DEFAULT_ZOOM = 16;

// Options de pagination
const PAGINATION_OPTIONS = [
  { value: 10, label: '10' },
  { value: 20, label: '20' },
  { value: 30, label: '30' },
  { value: 50, label: '50' },
  { value: 'all', label: 'Tous' }
];

// Fix pour les icones Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Icone personnalisee pour l'arbre
const arbreIcon = L.divIcon({
  className: 'custom-arbre-icon',
  html: `<div style="
    background-color: #27ae60;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    border: 3px solid white;
    box-shadow: 0 2px 6px rgba(0,0,0,0.4);
  "></div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

// Composant pour gerer les clics sur la carte
function MapClickHandler({ onMapClick }) {
  useMapEvents({
    click: (e) => {
      onMapClick(e.latlng);
    }
  });
  return null;
}

// Composant pour controler le zoom et le centre de la carte (uniquement a l'initialisation)
function MapController({ bounds, center, zoom, mapKey, arbrePosition }) {
  const map = useMap();
  const initializedRef = useRef(false);
  
  useEffect(() => {
    // Reinitialiser quand mapKey change (changement de parcelle)
    initializedRef.current = false;
  }, [mapKey]);
  
  useEffect(() => {
    // Ne faire le zoom qu'une seule fois a l'initialisation
    if (initializedRef.current) return;
    
    // Priorite 1: Si l'arbre a une position, zoomer dessus
    if (arbrePosition && arbrePosition[0] && arbrePosition[1]) {
      map.setView(arbrePosition, 18);
      initializedRef.current = true;
    }
    // Priorite 2: Si la parcelle a des coordonnees, zoomer sur la parcelle
    else if (bounds && bounds.length > 0) {
      const leafletBounds = L.latLngBounds(bounds.map(coord => [coord[0], coord[1]]));
      map.fitBounds(leafletBounds, { padding: [50, 50], maxZoom: 18 });
      initializedRef.current = true;
    }
    // Priorite 3: Utiliser le centre par defaut
    else if (center) {
      map.setView(center, zoom || DEFAULT_ZOOM);
      initializedRef.current = true;
    }
  }, [bounds, center, zoom, map, arbrePosition]);
  
  return null;
}


function Arbres() {
  const [arbres, setArbres] = useState([]);
  const [parcelles, setParcelles] = useState([]);
  const [interventions, setInterventions] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Etat pour le tooltip des interventions
  const [hoveredArbreId, setHoveredArbreId] = useState(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const [showModal, setShowModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [editingArbre, setEditingArbre] = useState(null);
  const [message, setMessage] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Modal de confirmation
  const [confirmModal, setConfirmModal] = useState(null);
  
  // Etat pour la pagination
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);
  
  // Etats pour les filtres
  const [filters, setFilters] = useState({
    search: '',
    parcelle: '',
    espece: '',
    etat: '',
    variete_truffe: '',
    avecPosition: ''
  });
  const [showFilters, setShowFilters] = useState(false);
  
  const [formData, setFormData] = useState({
    parcelle_id: '',
    numero: '',
    espece: '',
    variete_truffe: '',
    date_plantation: '',
    etat: 'Bon',
    circonference_cm: '',
    hauteur_m: '',
    latitude: '',
    longitude: '',
    notes: ''
  });

  // Etat pour la corbeille
  const [showCorbeille, setShowCorbeille] = useState(false);
  const [arbresCorbeille, setArbresCorbeille] = useState([]);
  const [loadingCorbeille, setLoadingCorbeille] = useState(false);

  // Etat pour la mini-carte de geolocalisation
  const [showMap, setShowMap] = useState(false);
  const [mapCenter, setMapCenter] = useState(DEFAULT_CENTER);
  const [mapZoom, setMapZoom] = useState(DEFAULT_ZOOM);
  const [selectedParcelleCoords, setSelectedParcelleCoords] = useState(null);
  const [mapKey, setMapKey] = useState(0); // Pour forcer le re-render de la carte

  // ============ SELECTION MULTIPLE ============
  const [selectedArbres, setSelectedArbres] = useState(new Set());
  const [showBulkEditModal, setShowBulkEditModal] = useState(false);
  const [bulkEditData, setBulkEditData] = useState({
    espece: '',
    variete_truffe: '',
    date_plantation: '',
    etat: '',
    circonference_cm: '',
    hauteur_m: ''
  });

  // Hook pour les parametres de colonnes
  const { colonnesAffichees, colonnesExport, loading: loadingSettings } = useColumnSettings('arbres');

  useEffect(() => {
    loadData();
  }, []);

  const showMessage = (text, type = 'success') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 4000);
  };

  const loadData = async () => {
    try {
      const [arbresRes, parcellesRes, interventionsRes] = await Promise.all([
        axios.get(`${API_URL}/arbres`),
        axios.get(`${API_URL}/parcelles`),
        axios.get(`${API_URL}/interventions`)
      ]);
      setArbres(arbresRes.data);
      setParcelles(parcellesRes.data);
      setInterventions(interventionsRes.data);
      setLoading(false);
    } catch (error) {
      console.error('Erreur lors du chargement:', error);
      setLoading(false);
    }
  };

  // Extraire les valeurs uniques pour les filtres
  const filterOptions = useMemo(() => {
    const especes = [...new Set(arbres.map(a => a.espece).filter(Boolean))].sort();
    const etats = [...new Set(arbres.map(a => a.etat).filter(Boolean))].sort();
    const varietes = [...new Set(arbres.map(a => a.variete_truffe).filter(Boolean))].sort();
    return { especes, etats, varietes };
  }, [arbres]);

  // Filtrer les arbres selon les criteres
  const filteredArbres = useMemo(() => {
    return arbres.filter(arbre => {
      // Filtre recherche textuelle (numero, notes)
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const matchNumero = arbre.numero?.toLowerCase().includes(searchLower);
        const matchNotes = arbre.notes?.toLowerCase().includes(searchLower);
        const matchEspece = arbre.espece?.toLowerCase().includes(searchLower);
        const matchParcelle = arbre.parcelle_nom?.toLowerCase().includes(searchLower);
        if (!matchNumero && !matchNotes && !matchEspece && !matchParcelle) return false;
      }
      
      // Filtre par parcelle
      if (filters.parcelle && arbre.parcelle_id !== parseInt(filters.parcelle)) {
        return false;
      }
      
      // Filtre par espece
      if (filters.espece && arbre.espece !== filters.espece) {
        return false;
      }
      
      // Filtre par etat
      if (filters.etat && arbre.etat !== filters.etat) {
        return false;
      }
      
      // Filtre par variete de truffe
      if (filters.variete_truffe && arbre.variete_truffe !== filters.variete_truffe) {
        return false;
      }
      
      // Filtre par position GPS
      if (filters.avecPosition === 'oui' && (!arbre.latitude || !arbre.longitude)) {
        return false;
      }
      if (filters.avecPosition === 'non' && (arbre.latitude && arbre.longitude)) {
        return false;
      }
      
      return true;
    });
  }, [arbres, filters]);

  // Gerer les changements de filtres
  const handleFilterChange = (name, value) => {
    setFilters(prev => ({ ...prev, [name]: value }));
    setCurrentPage(1); // Revenir a la premiere page lors d'un changement de filtre
  };

  // Reinitialiser tous les filtres
  const resetFilters = () => {
    setFilters({
      search: '',
      parcelle: '',
      espece: '',
      etat: '',
      variete_truffe: '',
      avecPosition: ''
    });
    setCurrentPage(1);
  };

  // Verifier si des filtres sont actifs
  const hasActiveFilters = Object.values(filters).some(v => v !== '');

  // Charger les arbres de la corbeille
  const loadCorbeille = async () => {
    setLoadingCorbeille(true);
    try {
      const response = await axios.get(`${API_URL}/arbres/corbeille`);
      setArbresCorbeille(response.data);
    } catch (error) {
      console.error('Erreur lors du chargement de la corbeille:', error);
      setArbresCorbeille([]);
    }
    setLoadingCorbeille(false);
  };

  // Ouvrir la corbeille
  const openCorbeille = () => {
    loadCorbeille();
    setShowCorbeille(true);
  };

  // Restaurer un arbre depuis la corbeille
  const handleRestaurer = async (id) => {
    try {
      await axios.post(`${API_URL}/arbres/corbeille/${id}/restaurer`);
      showMessage('Arbre restaure avec succes !', 'success');
      loadCorbeille();
      loadData();
    } catch (error) {
      console.error('Erreur lors de la restauration:', error);
      showMessage('Erreur lors de la restauration de l\'arbre', 'error');
    }
  };

  // Demander confirmation pour suppression definitive
  const askSupprimerDefinitivement = (arbre) => {
    setConfirmModal({
      type: 'delete-permanent',
      item: arbre,
      title: 'Suppression definitive',
      message: `Etes-vous sur de vouloir supprimer definitivement l\'arbre "${arbre.numero}" ? Cette action est irreversible.`,
      confirmText: 'Oui, supprimer definitivement',
      confirmColor: '#f44336'
    });
  };

  // Executer la suppression definitive
  const doSupprimerDefinitivement = async (arbre) => {
    setIsProcessing(true);
    setConfirmModal(null);
    
    try {
      await axios.delete(`${API_URL}/arbres/corbeille/${arbre.id}`);
      showMessage('Arbre supprime definitivement !', 'success');
      loadCorbeille();
    } catch (error) {
      console.error('Erreur lors de la suppression definitive:', error);
      showMessage('Erreur lors de la suppression definitive', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  // Demander confirmation pour vider la corbeille
  const askViderCorbeille = () => {
    setConfirmModal({
      type: 'vider-corbeille',
      item: null,
      title: 'Vider la corbeille',
      message: `Etes-vous sur de vouloir vider la corbeille ? Tous les ${arbresCorbeille.length} arbre(s) supprime(s) seront definitivement perdus.`,
      confirmText: 'Oui, vider la corbeille',
      confirmColor: '#f44336'
    });
  };

  // Executer le vidage de la corbeille
  const doViderCorbeille = async () => {
    setIsProcessing(true);
    setConfirmModal(null);
    
    try {
      await axios.delete(`${API_URL}/arbres/corbeille`);
      showMessage('Corbeille videe !', 'success');
      loadCorbeille();
    } catch (error) {
      console.error('Erreur lors du vidage de la corbeille:', error);
      showMessage('Erreur lors du vidage de la corbeille', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  // Gerer le changement de parcelle
  const handleParcelleChange = (e) => {
    const parcelleId = e.target.value;
    setFormData(prev => ({
      ...prev,
      parcelle_id: parcelleId
    }));

    if (parcelleId) {
      const parcelle = parcelles.find(p => p.id === parseInt(parcelleId));
      if (parcelle && parcelle.coordinates && parcelle.coordinates.length > 0) {
        setSelectedParcelleCoords(parcelle.coordinates);
        setMapCenter(null);
      } else {
        setSelectedParcelleCoords(null);
        setMapCenter(DEFAULT_CENTER);
      }
      setMapKey(prev => prev + 1);
    } else {
      setSelectedParcelleCoords(null);
      setMapCenter(DEFAULT_CENTER);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (name === 'parcelle_id') {
      handleParcelleChange(e);
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsProcessing(true);
    
    try {
      if (editingArbre) {
        await axios.put(`${API_URL}/arbres/${editingArbre.id}`, formData);
        showMessage('Arbre mis a jour avec succes !', 'success');
      } else {
        await axios.post(`${API_URL}/arbres`, formData);
        showMessage('Arbre cree avec succes !', 'success');
      }
      loadData();
      closeModal();
    } catch (error) {
      console.error('Erreur lors de la sauvegarde:', error);
      showMessage('Erreur lors de la sauvegarde de l\'arbre', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleEdit = (arbre) => {
    setEditingArbre(arbre);
    setFormData({
      parcelle_id: arbre.parcelle_id || '',
      numero: arbre.numero || '',
      espece: arbre.espece || '',
      variete_truffe: arbre.variete_truffe || '',
      date_plantation: arbre.date_plantation ? arbre.date_plantation.split('T')[0] : '',
      etat: arbre.etat || 'Bon',
      circonference_cm: arbre.circonference_cm || '',
      hauteur_m: arbre.hauteur_m || '',
      latitude: arbre.latitude || '',
      longitude: arbre.longitude || '',
      notes: arbre.notes || ''
    });
    
    // Configurer la carte pour la parcelle de l'arbre
    if (arbre.parcelle_id) {
      const parcelle = parcelles.find(p => p.id === arbre.parcelle_id);
      if (parcelle && parcelle.coordinates && parcelle.coordinates.length > 0) {
        setSelectedParcelleCoords(parcelle.coordinates);
        if (arbre.latitude && arbre.longitude) {
          setMapCenter([parseFloat(arbre.latitude), parseFloat(arbre.longitude)]);
        } else {
          setMapCenter(null);
        }
      } else {
        setSelectedParcelleCoords(null);
        if (arbre.latitude && arbre.longitude) {
          setMapCenter([parseFloat(arbre.latitude), parseFloat(arbre.longitude)]);
        } else {
          setMapCenter(DEFAULT_CENTER);
        }
      }
    } else {
      setSelectedParcelleCoords(null);
      setMapCenter(DEFAULT_CENTER);
    }
    
    setMapKey(prev => prev + 1);
    setShowMap(false);
    setShowModal(true);
  };

  // Demander confirmation pour mettre a la corbeille
  const askDelete = (arbre) => {
    setConfirmModal({
      type: 'delete',
      item: arbre,
      title: 'Mettre a la corbeille',
      message: `Voulez-vous mettre l\'arbre "${arbre.numero}" a la corbeille ? Vous pourrez le restaurer plus tard.`,
      confirmText: 'Oui, mettre a la corbeille',
      confirmColor: '#ff9800'
    });
  };

  // Executer la mise a la corbeille
  const doDelete = async (arbre) => {
    setIsProcessing(true);
    setConfirmModal(null);
    
    try {
      await axios.delete(`${API_URL}/arbres/${arbre.id}`);
      showMessage('Arbre mis a la corbeille', 'success');
      loadData();
    } catch (error) {
      console.error('Erreur lors de la suppression:', error);
      showMessage('Erreur lors de la suppression de l\'arbre', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  // ============ SELECTION MULTIPLE - FONCTIONS ============
  
  // Gerer la selection d'un arbre
  const handleSelectArbre = (arbreId) => {
    setSelectedArbres(prev => {
      const newSet = new Set(prev);
      if (newSet.has(arbreId)) {
        newSet.delete(arbreId);
      } else {
        newSet.add(arbreId);
      }
      return newSet;
    });
  };

  // Selectionner/Deselectionner tous les arbres de la page courante
  const handleSelectAllPage = () => {
    const pageArbreIds = paginatedArbres.map(a => a.id);
    const allSelected = pageArbreIds.every(id => selectedArbres.has(id));
    
    setSelectedArbres(prev => {
      const newSet = new Set(prev);
      if (allSelected) {
        pageArbreIds.forEach(id => newSet.delete(id));
      } else {
        pageArbreIds.forEach(id => newSet.add(id));
      }
      return newSet;
    });
  };

  // Selectionner tous les arbres filtres
  const handleSelectAllFiltered = () => {
    const allIds = filteredArbres.map(a => a.id);
    setSelectedArbres(new Set(allIds));
  };

  // Deselectionner tout
  const handleDeselectAll = () => {
    setSelectedArbres(new Set());
  };

  // Ouvrir le modal de modification groupee
  const openBulkEditModal = () => {
    setBulkEditData({
      espece: '',
      variete_truffe: '',
      date_plantation: '',
      etat: '',
      circonference_cm: '',
      hauteur_m: ''
    });
    setShowBulkEditModal(true);
  };

  // Gerer les changements dans le formulaire de modification groupee
  const handleBulkEditChange = (e) => {
    const { name, value } = e.target;
    setBulkEditData(prev => ({ ...prev, [name]: value }));
  };

  // Appliquer les modifications groupees
  const handleBulkEditSubmit = async () => {
    if (selectedArbres.size === 0) return;
    
    setIsProcessing(true);
    
    try {
      const updates = {};
      if (bulkEditData.espece) updates.espece = bulkEditData.espece;
      if (bulkEditData.variete_truffe) updates.variete_truffe = bulkEditData.variete_truffe;
      if (bulkEditData.date_plantation) updates.date_plantation = bulkEditData.date_plantation;
      if (bulkEditData.etat) updates.etat = bulkEditData.etat;
      if (bulkEditData.circonference_cm) updates.circonference_cm = bulkEditData.circonference_cm;
      if (bulkEditData.hauteur_m) updates.hauteur_m = bulkEditData.hauteur_m;

      if (Object.keys(updates).length === 0) {
        showMessage('Aucune modification a appliquer', 'error');
        setIsProcessing(false);
        return;
      }

      let successCount = 0;
      let errorCount = 0;

      for (const arbreId of selectedArbres) {
        const arbre = arbres.find(a => a.id === arbreId);
        if (arbre) {
          try {
            await axios.put(`${API_URL}/arbres/${arbreId}`, {
              ...arbre,
              ...updates
            });
            successCount++;
          } catch (error) {
            console.error(`Erreur pour l'arbre ${arbreId}:`, error);
            errorCount++;
          }
        }
      }

      if (errorCount === 0) {
        showMessage(`${successCount} arbre(s) modifie(s) avec succes !`, 'success');
      } else {
        showMessage(`${successCount} modifie(s), ${errorCount} erreur(s)`, 'error');
      }

      loadData();
      setShowBulkEditModal(false);
      setSelectedArbres(new Set());
    } catch (error) {
      console.error('Erreur lors de la modification groupee:', error);
      showMessage('Erreur lors de la modification groupee', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  // Demander confirmation pour suppression groupee
  const askBulkDelete = () => {
    setConfirmModal({
      type: 'bulk-delete',
      item: null,
      title: 'Suppression groupee',
      message: `Voulez-vous mettre ${selectedArbres.size} arbre(s) a la corbeille ? Vous pourrez les restaurer plus tard.`,
      confirmText: 'Oui, mettre a la corbeille',
      confirmColor: '#ff9800'
    });
  };

  // Executer la suppression groupee
  const doBulkDelete = async () => {
    setIsProcessing(true);
    setConfirmModal(null);
    
    try {
      let successCount = 0;
      let errorCount = 0;

      for (const arbreId of selectedArbres) {
        try {
          await axios.delete(`${API_URL}/arbres/${arbreId}`);
          successCount++;
        } catch (error) {
          console.error(`Erreur pour l'arbre ${arbreId}:`, error);
          errorCount++;
        }
      }

      if (errorCount === 0) {
        showMessage(`${successCount} arbre(s) mis a la corbeille !`, 'success');
      } else {
        showMessage(`${successCount} supprime(s), ${errorCount} erreur(s)`, 'error');
      }

      loadData();
      setSelectedArbres(new Set());
    } catch (error) {
      console.error('Erreur lors de la suppression groupee:', error);
      showMessage('Erreur lors de la suppression groupee', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  // Gerer la confirmation selon le type
  const handleConfirm = () => {
    if (!confirmModal) return;
    
    switch (confirmModal.type) {
      case 'delete':
        doDelete(confirmModal.item);
        break;
      case 'delete-permanent':
        doSupprimerDefinitivement(confirmModal.item);
        break;
      case 'vider-corbeille':
        doViderCorbeille();
        break;
      case 'bulk-delete':
        doBulkDelete();
        break;
      default:
        setConfirmModal(null);
    }
  };

  const openNewModal = () => {
    setEditingArbre(null);
    setFormData({
      parcelle_id: '',
      numero: '',
      espece: '',
      variete_truffe: '',
      date_plantation: '',
      etat: 'Bon',
      circonference_cm: '',
      hauteur_m: '',
      latitude: '',
      longitude: '',
      notes: ''
    });
    setSelectedParcelleCoords(null);
    setMapCenter(DEFAULT_CENTER);
    setMapKey(prev => prev + 1);
    setShowMap(false);
    setShowModal(true);
  };

  const handleImportCSV = async (validData) => {
    try {
      for (const arbre of validData) {
        await axios.post(`${API_URL}/arbres`, arbre);
      }
      loadData();
      showMessage(`${validData.length} arbre(s) importe(s) avec succes !`, 'success');
    } catch (error) {
      console.error('Erreur lors de l\'import:', error);
      throw new Error('Erreur lors de l\'import des arbres');
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingArbre(null);
    setShowMap(false);
    setSelectedParcelleCoords(null);
  };

  // Gerer le clic sur la carte pour placer l'arbre
  const handleMapClick = (latlng) => {
    setFormData(prev => ({
      ...prev,
      latitude: latlng.lat.toFixed(7),
      longitude: latlng.lng.toFixed(7)
    }));
  };

  // Supprimer la position de l'arbre
  const clearPosition = () => {
    setFormData(prev => ({
      ...prev,
      latitude: '',
      longitude: ''
    }));
  };

  // Export PDF avec colonnes configurees
  const handleExportPDF = () => {
    exportArbresPDF(filteredArbres, null, colonnesExport);
  };

  const getEtatBadgeStyle = (etat) => {
    const styles = {
      'Bon': { background: '#d4edda', color: '#155724' },
      'Moyen': { background: '#fff3cd', color: '#856404' },
      'Mauvais': { background: '#f8d7da', color: '#721c24' },
      'Mort': { background: '#e0e0e0', color: '#666' }
    };
    return styles[etat] || styles['Bon'];
  };

  // Configuration des colonnes pour l'affichage
  const config = COLONNES_CONFIG.arbres;
  const colonnesValides = colonnesAffichees.filter(col => config[col]);

  // Fonction de rendu personnalisee pour les cellules speciales
  const renderCell = (arbre, col) => {
    if (col === 'etat') {
      return (
        <span style={{
          padding: '0.25rem 0.75rem',
          borderRadius: '12px',
          fontSize: '0.85rem',
          fontWeight: '500',
          ...getEtatBadgeStyle(arbre.etat)
        }}>
          {arbre.etat}
        </span>
      );
    }
    if (col === 'numero') {
      return <strong>{config[col].render(arbre)}</strong>;
    }
    return config[col].render(arbre);
  };

  // Obtenir le nom de la parcelle selectionnee
  const getSelectedParcelleName = () => {
    if (!formData.parcelle_id) return null;
    const parcelle = parcelles.find(p => p.id === parseInt(formData.parcelle_id));
    return parcelle ? parcelle.nom : null;
  };

  // Formater la date de suppression
  const formatDateSuppression = (dateStr) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Obtenir les interventions en cours ou prevues pour un arbre
  const getInterventionsForArbre = (arbreId) => {
    return interventions.filter(intervention => {
      if (intervention.arbre_id !== arbreId) return false;
      if (intervention.statut !== 'Planifie' && intervention.statut !== 'En cours') return false;
      return true;
    }).sort((a, b) => new Date(a.date_prevue) - new Date(b.date_prevue));
  };

  // Formater la date pour l'affichage dans le tooltip
  const formatDateIntervention = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric'
    });
  };

  // Gestion du survol pour afficher le tooltip
  const handleMouseEnter = (e, arbreId) => {
    const interventionsArbre = getInterventionsForArbre(arbreId);
    if (interventionsArbre.length > 0) {
      const rect = e.currentTarget.getBoundingClientRect();
      setTooltipPosition({ 
        x: rect.left + window.scrollX, 
        y: rect.bottom + window.scrollY + 5 
      });
      setHoveredArbreId(arbreId);
    }
  };

  const handleMouseLeave = () => {
    setHoveredArbreId(null);
  };

  // Verifier si un arbre a des interventions en cours ou prevues
  const hasInterventions = (arbreId) => {
    return getInterventionsForArbre(arbreId).length > 0;
  };

  // Obtenir le badge de statut pour intervention
  const getStatutInterventionStyle = (statut) => {
    if (statut === 'En cours') {
      return { background: '#fff3cd', color: '#856404' };
    }
    return { background: '#cce5ff', color: '#004085' };
  };

  // ===== PAGINATION =====
  const totalArbres = filteredArbres.length;
  const totalPages = itemsPerPage === 'all' ? 1 : Math.ceil(totalArbres / itemsPerPage);
  
  const paginatedArbres = itemsPerPage === 'all' 
    ? filteredArbres 
    : filteredArbres.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handleItemsPerPageChange = (value) => {
    setItemsPerPage(value);
    setCurrentPage(1);
  };

  const getPageNumbers = () => {
    const pages = [];
    const maxVisiblePages = 5;
    
    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
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

  // Verifier si tous les arbres de la page sont selectionnes
  const isAllPageSelected = paginatedArbres.length > 0 && paginatedArbres.every(a => selectedArbres.has(a.id));
  const isSomePageSelected = paginatedArbres.some(a => selectedArbres.has(a.id));

  if (loading || loadingSettings) {
    return <div className="loading">Chargement des arbres...</div>;
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

      {/* Message notification */}
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

      <div className="page-header">
        <h2>🌳 Gestion des arbres truffiers</h2>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button 
            className="btn btn-secondary" 
            onClick={openCorbeille}
            title="Voir les arbres supprimes"
            style={{ background: '#6c757d' }}
          >
            Corbeille
          </button>
          <button 
            className="btn btn-secondary" 
            onClick={() => setShowImportModal(true)}
            title="Importer des arbres depuis un fichier CSV"
          >
            Importer CSV
          </button>
          <button 
            className="btn btn-secondary" 
            onClick={handleExportPDF}
            disabled={filteredArbres.length === 0}
            title="Exporter la liste des arbres en PDF"
          >
            Exporter PDF
          </button>
          <button className="btn btn-primary" onClick={openNewModal}>
            Nouvel arbre
          </button>
        </div>
      </div>

      {/* Statistiques */}
      <div className="stats-grid">
        <div className="card">
          <div className="card-title">Total arbres</div>
          <div className="card-value">{arbres.length}</div>
        </div>
        <div className="card">
          <div className="card-title">En bon etat</div>
          <div className="card-value" style={{ color: '#27ae60' }}>
            {arbres.filter(a => a.etat === 'Bon').length}
          </div>
        </div>
        <div className="card">
          <div className="card-title">A surveiller</div>
          <div className="card-value" style={{ color: '#f39c12' }}>
            {arbres.filter(a => a.etat === 'Moyen').length}
          </div>
        </div>
        <div className="card">
          <div className="card-title">En difficulte</div>
          <div className="card-value" style={{ color: '#e74c3c' }}>
            {arbres.filter(a => a.etat === 'Mauvais' || a.etat === 'Mort').length}
          </div>
        </div>
      </div>

      {/* Barre de selection groupee */}
      {selectedArbres.size > 0 && (
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
              {selectedArbres.size} arbre(s) selectionnee(s)
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
              Tout deselectionner
            </button>
            {filteredArbres.length > selectedArbres.size && (
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
                Selectionner les {filteredArbres.length} arbres filtres
              </button>
            )}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={openBulkEditModal}
              className="btn btn-primary"
              style={{ padding: '0.5rem 1rem' }}
            >
              Modifier la selection
            </button>
            <button
              onClick={askBulkDelete}
              className="btn btn-danger"
              style={{ padding: '0.5rem 1rem' }}
            >
              Supprimer la selection
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
              placeholder="Rechercher par numero, espece, parcelle, notes..."
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
              </button>
            )}
          </div>
          
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
            Filtres {hasActiveFilters && `(${Object.values(filters).filter(v => v !== '').length})`}
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
              Reinitialiser
            </button>
          )}
        </div>

        {/* Panneau de filtres avances */}
        {showFilters && (
          <div style={{ 
            marginTop: '1rem', 
            paddingTop: '1rem', 
            borderTop: '1px solid #eee',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
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
                <option value="">Toutes les parcelles</option>
                {parcelles.map(p => (
                  <option key={p.id} value={p.id}>{p.nom}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ fontSize: '0.85rem', color: '#666', marginBottom: '0.25rem', display: 'block' }}>
                Espece
              </label>
              <select
                value={filters.espece}
                onChange={(e) => handleFilterChange('espece', e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid #ddd',
                  borderRadius: '6px',
                  background: filters.espece ? '#e8f5e9' : 'white'
                }}
              >
                <option value="">Toutes les especes</option>
                {filterOptions.especes.map(e => (
                  <option key={e} value={e}>{e}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ fontSize: '0.85rem', color: '#666', marginBottom: '0.25rem', display: 'block' }}>
                Etat de sante
              </label>
              <select
                value={filters.etat}
                onChange={(e) => handleFilterChange('etat', e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid #ddd',
                  borderRadius: '6px',
                  background: filters.etat ? '#e8f5e9' : 'white'
                }}
              >
                <option value="">Tous les etats</option>
                <option value="Bon">Bon</option>
                <option value="Moyen">Moyen</option>
                <option value="Mauvais">Mauvais</option>
                <option value="Mort">Mort</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: '0.85rem', color: '#666', marginBottom: '0.25rem', display: 'block' }}>
                Variete de truffe
              </label>
              <select
                value={filters.variete_truffe}
                onChange={(e) => handleFilterChange('variete_truffe', e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid #ddd',
                  borderRadius: '6px',
                  background: filters.variete_truffe ? '#e8f5e9' : 'white'
                }}
              >
                <option value="">Toutes les varietes</option>
                {filterOptions.varietes.map(v => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ fontSize: '0.85rem', color: '#666', marginBottom: '0.25rem', display: 'block' }}>
                Position GPS
              </label>
              <select
                value={filters.avecPosition}
                onChange={(e) => handleFilterChange('avecPosition', e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid #ddd',
                  borderRadius: '6px',
                  background: filters.avecPosition ? '#e8f5e9' : 'white'
                }}
              >
                <option value="">Tous</option>
                <option value="oui">Avec position</option>
                <option value="non">Sans position</option>
              </select>
            </div>
          </div>
        )}

        {/* Resume des resultats */}
        {hasActiveFilters && (
          <div style={{ 
            marginTop: '1rem', 
            padding: '0.75rem', 
            background: '#f5f5f5', 
            borderRadius: '6px',
            fontSize: '0.9rem',
            color: '#666'
          }}>
            <strong>{filteredArbres.length}</strong> arbre{filteredArbres.length > 1 ? 's' : ''} trouve{filteredArbres.length > 1 ? 's' : ''} 
            {filteredArbres.length !== arbres.length && (
              <span> sur {arbres.length} au total</span>
            )}
          </div>
        )}
      </div>

      {/* Controles de pagination */}
      {filteredArbres.length > 0 && (
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
          
          {itemsPerPage !== 'all' && (
            <div style={{ color: '#666', fontSize: '0.9rem' }}>
              Affichage de {((currentPage - 1) * itemsPerPage) + 1} a {Math.min(currentPage * itemsPerPage, totalArbres)} sur {totalArbres} arbres
            </div>
          )}
        </div>
      )}

      {/* Tableau */}
      {filteredArbres.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">{hasActiveFilters ? '' : ''}</div>
          <p>
            {hasActiveFilters 
              ? 'Aucun arbre ne correspond aux criteres de recherche' 
              : 'Aucun arbre enregistre'}
          </p>
          {hasActiveFilters ? (
            <button className="btn btn-secondary" onClick={resetFilters} style={{ marginTop: '1rem' }}>
              Reinitialiser les filtres
            </button>
          ) : (
            <button className="btn btn-primary" onClick={openNewModal} style={{ marginTop: '1rem' }}>
              Ajouter mon premier arbre
            </button>
          )}
        </div>
      ) : (
        <div style={{ position: 'relative' }}>
          <table>
            <thead>
              <tr>
                <th style={{ width: '40px', textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    checked={isAllPageSelected}
                    ref={el => {
                      if (el) el.indeterminate = isSomePageSelected && !isAllPageSelected;
                    }}
                    onChange={handleSelectAllPage}
                    title={isAllPageSelected ? 'Deselectionner tous' : 'Selectionner tous'}
                    style={{ cursor: 'pointer', width: '18px', height: '18px' }}
                  />
                </th>
                {colonnesValides.map(col => (
                  <th key={col} style={{ textAlign: config[col].align || 'left' }}>
                    {config[col].label}
                  </th>
                ))}
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedArbres.map(arbre => (
                <tr 
                  key={arbre.id}
                  onMouseEnter={(e) => handleMouseEnter(e, arbre.id)}
                  onMouseLeave={handleMouseLeave}
                  style={{ 
                    cursor: hasInterventions(arbre.id) ? 'help' : 'default',
                    background: selectedArbres.has(arbre.id) ? '#e3f2fd' : 'transparent'
                  }}
                >
                  <td style={{ textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      checked={selectedArbres.has(arbre.id)}
                      onChange={() => handleSelectArbre(arbre.id)}
                      onClick={(e) => e.stopPropagation()}
                      style={{ cursor: 'pointer', width: '18px', height: '18px' }}
                    />
                  </td>
                  {colonnesValides.map(col => (
                    <td key={col} style={{ textAlign: config[col].align || 'left' }}>
                      {col === 'numero' ? (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <strong>{config[col].render(arbre)}</strong>
                          {hasInterventions(arbre.id) && (
                            <span 
                              title="Interventions en cours ou prevues"
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                background: '#3498db',
                                color: 'white',
                                borderRadius: '50%',
                                width: '20px',
                                height: '20px',
                                fontSize: '0.75rem'
                              }}
                            ></span>
                          )}
                        </span>
                      ) : renderCell(arbre, col)}
                    </td>
                  ))}
                  <td>
                    <button 
                      className="btn btn-secondary" 
                      onClick={() => handleEdit(arbre)}
                      style={{ marginRight: '0.5rem', padding: '0.4rem 0.8rem' }}
                    >
                      Editer
                    </button>
                    <button 
                      className="btn btn-danger" 
                      onClick={() => askDelete(arbre)}
                      style={{ padding: '0.4rem 0.8rem' }}
                    >
                      Supprimer
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination */}
          {itemsPerPage !== 'all' && totalPages > 1 && (
            <div style={{ 
              display: 'flex', 
              justifyContent: 'center', 
              alignItems: 'center', 
              gap: '0.5rem',
              marginTop: '1.5rem',
              paddingTop: '1rem',
              borderTop: '1px solid #eee'
            }}>
              <button onClick={() => setCurrentPage(1)} disabled={currentPage === 1}
                style={{ padding: '0.5rem 0.75rem', border: '1px solid #ddd', borderRadius: '6px', background: currentPage === 1 ? '#f5f5f5' : 'white', cursor: currentPage === 1 ? 'not-allowed' : 'pointer' }}>debut</button>
              <button onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} disabled={currentPage === 1}
                style={{ padding: '0.5rem 0.75rem', border: '1px solid #ddd', borderRadius: '6px', background: currentPage === 1 ? '#f5f5f5' : 'white', cursor: currentPage === 1 ? 'not-allowed' : 'pointer' }}>
                precedent
              </button>
              
              {getPageNumbers().map((page, idx) => (
                <button key={idx} onClick={() => page !== '...' && setCurrentPage(page)} disabled={page === '...'}
                  style={{ padding: '0.5rem 0.9rem', border: currentPage === page ? '2px solid #2c5f2d' : '1px solid #ddd', borderRadius: '6px', background: currentPage === page ? '#2c5f2d' : 'white', color: currentPage === page ? 'white' : (page === '...' ? '#999' : '#333'), fontWeight: currentPage === page ? 'bold' : 'normal', cursor: page === '...' ? 'default' : 'pointer', minWidth: '40px' }}>
                  {page}
                </button>
              ))}
              
              <button onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} disabled={currentPage === totalPages}
                style={{ padding: '0.5rem 0.75rem', border: '1px solid #ddd', borderRadius: '6px', background: currentPage === totalPages ? '#f5f5f5' : 'white', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer' }}>
                suivant
              </button>
              <button onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages}
                style={{ padding: '0.5rem 0.75rem', border: '1px solid #ddd', borderRadius: '6px', background: currentPage === totalPages ? '#f5f5f5' : 'white', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer' }}>fin</button>
            </div>
          )}

          {/* Tooltip des interventions */}
          {hoveredArbreId && (
            <div style={{ position: 'fixed', left: tooltipPosition.x, top: tooltipPosition.y, background: 'white', border: '1px solid #ddd', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', padding: '0.75rem 1rem', zIndex: 9999, maxWidth: '350px', minWidth: '250px' }}>
              <div style={{ fontWeight: 'bold', marginBottom: '0.5rem', color: '#2c3e50', borderBottom: '1px solid #eee', paddingBottom: '0.5rem' }}>
                Interventions prevues
              </div>
              {getInterventionsForArbre(hoveredArbreId).map((intervention, idx) => (
                <div key={intervention.id} style={{ padding: '0.5rem 0', borderBottom: idx < getInterventionsForArbre(hoveredArbreId).length - 1 ? '1px solid #f0f0f0' : 'none' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                    <span style={{ fontWeight: '500', color: '#34495e' }}>{intervention.type_nom || 'Intervention'}</span>
                    <span style={{ padding: '0.15rem 0.5rem', borderRadius: '10px', fontSize: '0.75rem', fontWeight: '500', ...getStatutInterventionStyle(intervention.statut) }}>{intervention.statut}</span>
                  </div>
                  <div style={{ fontSize: '0.85rem', color: '#7f8c8d' }}>
                    {formatDateIntervention(intervention.date_prevue)}
                    {intervention.personnel && <span style={{ marginLeft: '0.75rem' }}>Personnel: {intervention.personnel}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal de creation/edition */}
      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '700px' }}>
            <div className="modal-header">
              <h3>{editingArbre ? 'Modifier l\'arbre' : 'Nouvel arbre'}</h3>
              <button className="modal-close" onClick={closeModal}>X</button>
            </div>
            
            <form onSubmit={handleSubmit}>
              <div className="form-grid">
                <div className="form-group">
                  <label>Parcelle *</label>
                  <select name="parcelle_id" value={formData.parcelle_id} onChange={handleInputChange} required>
                    <option value="">Selectionner une parcelle...</option>
                    {parcelles.map(parcelle => (
                      <option key={parcelle.id} value={parcelle.id}>{parcelle.nom}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Numero d'identification *</label>
                  <input type="text" name="numero" value={formData.numero} onChange={handleInputChange} required placeholder="Ex: A-001" />
                </div>

                <div className="form-group">
                  <label>Espece *</label>
                  <select name="espece" value={formData.espece} onChange={handleInputChange} required>
                    <option value="">Selectionner...</option>
                    <option value="Chenes vert (V)">Chenes vert (V)</option>
                    <option value="Chene pubescent (P)">Chene pubescent (P)</option>
                    <option value="Chenes Cerris (Ce)">Chenes Cerris (Ce)</option>
                    <option value="Chene pedoncule">Chene pedoncule</option>
                    <option value="Noisetier">Noisetier</option>
                    <option value="Charmes (C)">Charmes (C)</option>
                    <option value="Tilleul">Tilleul</option>
                    <option value="Pin">Pin</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Variete de truffe associee</label>
                  <select name="variete_truffe" value={formData.variete_truffe} onChange={handleInputChange}>
                    <option value="">Selectionner...</option>
                    <option value="Tuber melanosporum">Tuber melanosporum (Truffe noire)</option>
                    <option value="Tuber aestivum">Tuber aestivum (Truffe d'ete)</option>
                    <option value="Tuber brumale">Tuber brumale (Truffe brumale)</option>
                    <option value="Tuber uncinatum">Tuber uncinatum (Truffe de Bourgogne)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Date de plantation</label>
                  <input type="date" name="date_plantation" value={formData.date_plantation} onChange={handleInputChange} />
                </div>

                <div className="form-group">
                  <label>Etat de sante *</label>
                  <select name="etat" value={formData.etat} onChange={handleInputChange} required>
                    <option value="Bon">Bon</option>
                    <option value="Moyen">Moyen</option>
                    <option value="Mauvais">Mauvais</option>
                    <option value="Mort">Mort</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Circonference du tronc (cm)</label>
                  <input type="number" name="circonference_cm" value={formData.circonference_cm} onChange={handleInputChange} step="0.1" placeholder="Ex: 45.5" />
                </div>

                <div className="form-group">
                  <label>Hauteur (metres)</label>
                  <input type="number" name="hauteur_m" value={formData.hauteur_m} onChange={handleInputChange} step="0.1" placeholder="Ex: 3.5" />
                </div>
              </div>

              {/* Section Geolocalisation */}
              <div style={{ marginTop: '1rem', padding: '1rem', background: '#f8f9fa', borderRadius: '8px', border: '1px solid #e9ecef' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <label style={{ fontWeight: '600', color: '#2c5f2d', margin: 0 }}>Geolocalisation</label>
                  <button type="button" className="btn btn-secondary" onClick={() => setShowMap(!showMap)} style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}>
                    {showMap ? 'Masquer carte' : 'Afficher carte'}
                  </button>
                </div>

                {formData.parcelle_id && (
                  <p style={{ fontSize: '0.85rem', color: '#666', marginBottom: '0.75rem', padding: '0.5rem', background: '#e8f5e9', borderRadius: '4px' }}>
                    {selectedParcelleCoords ? (
                      <>Parcelle "<strong>{getSelectedParcelleName()}</strong>" geolocalise</>
                    ) : (
                      <>Parcelle "<strong>{getSelectedParcelleName()}</strong>" non dessinee</>
                    )}
                  </p>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '0.5rem', alignItems: 'end' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label style={{ fontSize: '0.85rem' }}>Latitude</label>
                    <input type="text" name="latitude" value={formData.latitude} onChange={handleInputChange} placeholder="Ex: 46.1464315" style={{ fontSize: '0.9rem' }} />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label style={{ fontSize: '0.85rem' }}>Longitude</label>
                    <input type="text" name="longitude" value={formData.longitude} onChange={handleInputChange} placeholder="Ex: -0.1652445" style={{ fontSize: '0.9rem' }} />
                  </div>
                  {(formData.latitude || formData.longitude) && (
                    <button type="button" onClick={clearPosition} style={{ padding: '0.5rem', background: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', height: '38px' }} title="Supprimer la position">X</button>
                  )}
                </div>

                {showMap && (
                  <div style={{ marginTop: '0.75rem' }}>
                    <p style={{ fontSize: '0.85rem', color: '#666', marginBottom: '0.5rem' }}>
                      Cliquez sur la carte pour positionner l'arbre
                      {selectedParcelleCoords && <span style={{ color: '#d4a600' }}> (zone jaune = parcelle)</span>}
                    </p>
                    <div style={{ height: '350px', borderRadius: '8px', overflow: 'hidden', border: '2px solid #ddd' }}>
                      <MapContainer key={mapKey} center={mapCenter || DEFAULT_CENTER} zoom={DEFAULT_ZOOM} style={{ height: '100%', width: '100%' }}>
                        <LayersControl position="topright">
                          <LayersControl.BaseLayer checked name="Satellite">
                            <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" maxZoom={19} />
                          </LayersControl.BaseLayer>
                          <LayersControl.BaseLayer name="Plan">
                            <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                          </LayersControl.BaseLayer>
                        </LayersControl>
                        <MapController bounds={selectedParcelleCoords} center={mapCenter} zoom={mapZoom} mapKey={mapKey} arbrePosition={formData.latitude && formData.longitude ? [parseFloat(formData.latitude), parseFloat(formData.longitude)] : null} />
                        <MapClickHandler onMapClick={handleMapClick} />
                        {selectedParcelleCoords && <Polygon positions={selectedParcelleCoords} pathOptions={{ color: '#ffff00', weight: 3, fillColor: '#ffff00', fillOpacity: 0.25 }} />}
                        {formData.latitude && formData.longitude && <Marker position={[parseFloat(formData.latitude), parseFloat(formData.longitude)]} icon={arbreIcon} />}
                      </MapContainer>
                    </div>
                  </div>
                )}

                {formData.latitude && formData.longitude && (
                  <p style={{ fontSize: '0.8rem', color: '#27ae60', marginTop: '0.5rem', marginBottom: 0 }}>
                    Position definie : {parseFloat(formData.latitude).toFixed(5)}, {parseFloat(formData.longitude).toFixed(5)}
                  </p>
                )}
              </div>

              <div className="form-group" style={{ marginTop: '1rem' }}>
                <label>Notes et observations</label>
                <textarea name="notes" value={formData.notes} onChange={handleInputChange} placeholder="Observations, particularites, historique..." rows="4" />
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={closeModal}>Annuler</button>
                <button type="submit" className="btn btn-primary" disabled={isProcessing}>
                  {isProcessing ? 'En cours...' : (editingArbre ? 'Mettre a jour' : 'Creer')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de modification groupee */}
      {showBulkEditModal && (
        <div className="modal-overlay" onClick={() => setShowBulkEditModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h3>Modifier {selectedArbres.size} arbre(s)</h3>
              <button className="modal-close" onClick={() => setShowBulkEditModal(false)}>X</button>
            </div>
            
            <div style={{ padding: '1rem', background: '#fff3e0', borderRadius: '8px', marginBottom: '1rem' }}>
              <p style={{ margin: 0, color: '#e65100' }}>
                <strong>Attention :</strong> Seuls les champs remplis seront modifies. Les champs vides seront ignores.
              </p>
            </div>

            <div className="form-grid">
              <div className="form-group">
                <label>Espece</label>
                <select name="espece" value={bulkEditData.espece} onChange={handleBulkEditChange}>
                  <option value="">-- Ne pas modifier --</option>
                  <option value="Chenes vert (V)">Chenes vert (V)</option>
                  <option value="Chene pubescent (P)">Chene pubescent (P)</option>
                  <option value="Chenes Cerris (Ce)">Chenes Cerris (Ce)</option>
                  <option value="Chene pedoncule">Chene pedoncule</option>
                  <option value="Noisetier">Noisetier</option>
                  <option value="Charmes (C)">Charmes (C)</option>
                  <option value="Tilleul">Tilleul</option>
                  <option value="Pin">Pin</option>
                </select>
              </div>

              <div className="form-group">
                <label>Variete de truffe</label>
                <select name="variete_truffe" value={bulkEditData.variete_truffe} onChange={handleBulkEditChange}>
                  <option value="">-- Ne pas modifier --</option>
                  <option value="Tuber melanosporum">Tuber melanosporum (Truffe noire)</option>
                  <option value="Tuber aestivum">Tuber aestivum (Truffe d'ete)</option>
                  <option value="Tuber brumale">Tuber brumale (Truffe brumale)</option>
                  <option value="Tuber uncinatum">Tuber uncinatum (Truffe de Bourgogne)</option>
                </select>
              </div>

              <div className="form-group">
                <label>Date de plantation</label>
                <input 
                  type="date" 
                  name="date_plantation" 
                  value={bulkEditData.date_plantation} 
                  onChange={handleBulkEditChange}
                />
              </div>

              <div className="form-group">
                <label>Etat de sante</label>
                <select name="etat" value={bulkEditData.etat} onChange={handleBulkEditChange}>
                  <option value="">-- Ne pas modifier --</option>
                  <option value="Bon">Bon</option>
                  <option value="Moyen">Moyen</option>
                  <option value="Mauvais">Mauvais</option>
                  <option value="Mort">Mort</option>
                </select>
              </div>

              <div className="form-group">
                <label>Circonference du tronc (cm)</label>
                <input 
                  type="number" 
                  name="circonference_cm" 
                  value={bulkEditData.circonference_cm} 
                  onChange={handleBulkEditChange}
                  step="0.1" 
                  placeholder="Laisser vide pour ne pas modifier"
                />
              </div>

              <div className="form-group">
                <label>Hauteur (metres)</label>
                <input 
                  type="number" 
                  name="hauteur_m" 
                  value={bulkEditData.hauteur_m} 
                  onChange={handleBulkEditChange}
                  step="0.1" 
                  placeholder="Laisser vide pour ne pas modifier"
                />
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setShowBulkEditModal(false)}>
                Annuler
              </button>
              <button 
                type="button" 
                className="btn btn-primary" 
                onClick={handleBulkEditSubmit}
                disabled={isProcessing}
              >
                {isProcessing ? 'En cours...' : `Appliquer a ${selectedArbres.size} arbre(s)`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Corbeille */}
      {showCorbeille && (
        <div className="modal-overlay" onClick={() => setShowCorbeille(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '800px' }}>
            <div className="modal-header">
              <h3>Corbeille - Arbres supprimes</h3>
              <button className="modal-close" onClick={() => setShowCorbeille(false)}>X</button>
            </div>
            
            {loadingCorbeille ? (
              <div style={{ padding: '2rem', textAlign: 'center' }}>Chargement...</div>
            ) : arbresCorbeille.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#666' }}>La corbeille est vide</div>
            ) : (
              <>
                <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>{arbresCorbeille.length} arbre(s) dans la corbeille</span>
                  <button className="btn btn-danger" onClick={askViderCorbeille} style={{ padding: '0.5rem 1rem' }}>Vider la corbeille</button>
                </div>
                <table>
                  <thead>
                    <tr>
                      <th>Numero</th>
                      <th>Espece</th>
                      <th>Parcelle</th>
                      <th>Supprime le</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {arbresCorbeille.map(arbre => (
                      <tr key={arbre.id}>
                        <td><strong>{arbre.numero}</strong></td>
                        <td>{arbre.espece}</td>
                        <td>{arbre.parcelle_nom || '-'}</td>
                        <td>{formatDateSuppression(arbre.deleted_at)}</td>
                        <td>
                          <button className="btn btn-primary" onClick={() => handleRestaurer(arbre.id)} style={{ marginRight: '0.5rem', padding: '0.4rem 0.8rem' }}>Restaurer</button>
                          <button className="btn btn-danger" onClick={() => askSupprimerDefinitivement(arbre)} style={{ padding: '0.4rem 0.8rem' }}>Supprimer</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
            
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowCorbeille(false)}>Fermer</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal d'import CSV */}
      <CSVImportModal
        show={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImport={handleImportCSV}
        validateFunction={validateArbresCSV}
        type="arbres"
        title="Importer des arbres depuis CSV"
        dependencies={{ parcelles }}
      />
    </div>
  );
}

export default Arbres;