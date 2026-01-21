import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { MapContainer, TileLayer, Polygon, Marker, Popup, useMap, useMapEvents, LayersControl } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { exportParcellesPDF } from '../utils/pdfExport';
import { validateParcellesCSV } from '../utils/csvImport';
import CSVImportModal from './CSVImportModal';
import { useColumnSettings, COLONNES_CONFIG } from '../hooks/useColumnSettings';
import WeatherWidget from './WeatherWidget';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const PARCELLE_COLORS = [
  '#27ae60', '#3498db', '#9b59b6', '#e67e22', '#1abc9c',
  '#e74c3c', '#f39c12', '#2ecc71', '#8e44ad', '#16a085'
];

// Icônes pour les arbres
const createArbreIcon = (etat) => {
  const colors = {
    'Bon': '#27ae60',
    'Moyen': '#f39c12',
    'Mauvais': '#e74c3c',
    'Mort': '#95a5a6'
  };
  
  return L.divIcon({
    className: 'custom-arbre-icon',
    html: `<div style="
      background-color: ${colors[etat] || '#27ae60'};
      width: 18px;
      height: 18px;
      border-radius: 50%;
      border: 2px solid white;
      box-shadow: 0 2px 5px rgba(0,0,0,0.3);
    "></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
    popupAnchor: [0, -9]
  });
};

// Composant pour gérer les clics sur la carte
function MapClickHandler({ onMapClick, mode }) {
  useMapEvents({
    click: (e) => {
      if (mode === 'draw-parcelle') {
        onMapClick(e.latlng);
      }
    }
  });
  return null;
}

function MapController({ bounds, selectedParcelleId, parcelles }) {
  const map = useMap();
  useEffect(() => {
    if (selectedParcelleId) {
      const parcelle = parcelles.find(p => p.id === selectedParcelleId);
      if (parcelle?.coordinates?.length > 0) {
        map.fitBounds(L.latLngBounds(parcelle.coordinates), { padding: [30, 30], maxZoom: 17 });
      }
    } else if (bounds) {
      map.fitBounds(bounds, { padding: [20, 20] });
    }
  }, [bounds, selectedParcelleId, parcelles, map]);
  return null;
}

function Parcelles() {
  const [parcelles, setParcelles] = useState([]);
  const [arbres, setArbres] = useState([]);
  const [interventions, setInterventions] = useState([]);
  const [recoltes, setRecoltes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [editingParcelle, setEditingParcelle] = useState(null);
  const [selectedParcelleId, setSelectedParcelleId] = useState(null);
  const [hoveredParcelleId, setHoveredParcelleId] = useState(null);
  const [mapBounds, setMapBounds] = useState(null);
  const [message, setMessage] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Mode édition carte
  const [editMode, setEditMode] = useState(null);
  const [drawingPoints, setDrawingPoints] = useState([]);
  const [isRedrawing, setIsRedrawing] = useState(false);
  const [parcelleToEdit, setParcelleToEdit] = useState(null);
  
  // Affichage des arbres sur la carte
  const [showArbres, setShowArbres] = useState(true);
  
  // Modal de confirmation (inspiré de Carte.js)
  const [confirmModal, setConfirmModal] = useState(null);
  
  // Pour la réaffectation des arbres
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [parcelleToDelete, setParcelleToDelete] = useState(null);
  const [reassignTargetId, setReassignTargetId] = useState('');

  // État pour afficher/masquer les détails d'arbres par espèce
  const [expandedParcelleId, setExpandedParcelleId] = useState(null);
  
  // ============ FILTRES ============
  const [filters, setFilters] = useState({
    search: '',
    type_sol: '',
    avecGeo: '',
    surfaceMin: '',
    surfaceMax: '',
    phMin: '',
    phMax: '',
    avecArbres: ''
  });
  const [showFilters, setShowFilters] = useState(false);
  
  const [formData, setFormData] = useState({
    nom: '', surface_ha: '', type_sol: '', ph_sol: '', notes: ''
  });

  const { colonnesAffichees, colonnesExport, loading: loadingSettings } = useColumnSettings('parcelles');

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    const parcellesAvecGeo = parcelles.filter(p => p.coordinates?.length > 0);
    if (parcellesAvecGeo.length > 0) {
      const allCoords = parcellesAvecGeo.flatMap(p => p.coordinates);
      setMapBounds(L.latLngBounds(allCoords));
    }
  }, [parcelles]);

  const showMessage = (text, type = 'success') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 4000);
  };

  const loadData = async () => {
    try {
      const [parcellesRes, arbresRes, interventionsRes, recoltesRes] = await Promise.all([
        axios.get(`${API_URL}/parcelles`),
        axios.get(`${API_URL}/arbres`),
        axios.get(`${API_URL}/interventions`),
        axios.get(`${API_URL}/recoltes`)
      ]);
      setParcelles(parcellesRes.data);
      setArbres(arbresRes.data);
      setInterventions(interventionsRes.data);
      setRecoltes(recoltesRes.data);
      setLoading(false);
    } catch (error) {
      console.error('Erreur:', error);
      showMessage('Erreur lors du chargement des données', 'error');
      setLoading(false);
    }
  };

  // Calculer les statistiques d'arbres par parcelle et par espèce
  const arbresParParcelle = useMemo(() => {
    const stats = {};
    parcelles.forEach(p => {
      const arbresDeParcellle = arbres.filter(a => a.parcelle_id === p.id);
      const parEspece = {};
      arbresDeParcellle.forEach(a => {
        const espece = a.espece || 'Non définie';
        if (!parEspece[espece]) {
          parEspece[espece] = { total: 0, etats: { Bon: 0, Moyen: 0, Mauvais: 0, Mort: 0 } };
        }
        parEspece[espece].total++;
        if (a.etat && parEspece[espece].etats[a.etat] !== undefined) {
          parEspece[espece].etats[a.etat]++;
        }
      });
      stats[p.id] = {
        total: arbresDeParcellle.length,
        parEspece
      };
    });
    return stats;
  }, [parcelles, arbres]);

  // ============ LOGIQUE DE FILTRAGE ============
  const parcellesFiltrees = useMemo(() => {
    return parcelles.filter(parcelle => {
      // Filtre recherche texte (nom, notes)
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const matchNom = parcelle.nom?.toLowerCase().includes(searchLower);
        const matchNotes = parcelle.notes?.toLowerCase().includes(searchLower);
        if (!matchNom && !matchNotes) return false;
      }
      
      // Filtre type de sol
      if (filters.type_sol && parcelle.type_sol !== filters.type_sol) {
        return false;
      }
      
      // Filtre géolocalisation
      if (filters.avecGeo === 'oui' && (!parcelle.coordinates || parcelle.coordinates.length === 0)) {
        return false;
      }
      if (filters.avecGeo === 'non' && parcelle.coordinates && parcelle.coordinates.length > 0) {
        return false;
      }
      
      // Filtre surface minimum
      if (filters.surfaceMin && parcelle.surface_ha) {
        if (parseFloat(parcelle.surface_ha) < parseFloat(filters.surfaceMin)) {
          return false;
        }
      }
      
      // Filtre surface maximum
      if (filters.surfaceMax && parcelle.surface_ha) {
        if (parseFloat(parcelle.surface_ha) > parseFloat(filters.surfaceMax)) {
          return false;
        }
      }
      
      // Filtre pH minimum
      if (filters.phMin && parcelle.ph_sol) {
        if (parseFloat(parcelle.ph_sol) < parseFloat(filters.phMin)) {
          return false;
        }
      }
      
      // Filtre pH maximum
      if (filters.phMax && parcelle.ph_sol) {
        if (parseFloat(parcelle.ph_sol) > parseFloat(filters.phMax)) {
          return false;
        }
      }
      
      // Filtre avec/sans arbres
      const nbArbres = arbresParParcelle[parcelle.id]?.total || 0;
      if (filters.avecArbres === 'oui' && nbArbres === 0) {
        return false;
      }
      if (filters.avecArbres === 'non' && nbArbres > 0) {
        return false;
      }
      
      return true;
    });
  }, [parcelles, filters, arbresParParcelle]);

  // Extraire les types de sol uniques pour le filtre
  const typesSolUniques = useMemo(() => {
    const types = new Set();
    parcelles.forEach(p => {
      if (p.type_sol) types.add(p.type_sol);
    });
    return Array.from(types).sort();
  }, [parcelles]);

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const resetFilters = () => {
    setFilters({
      search: '',
      type_sol: '',
      avecGeo: '',
      surfaceMin: '',
      surfaceMax: '',
      phMin: '',
      phMax: '',
      avecArbres: ''
    });
  };

  const activeFiltersCount = Object.values(filters).filter(v => v !== '').length;

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

const handleSubmit = async (e) => {
  e.preventDefault();
  
  // Validation
  if (!formData.nom || formData.nom.trim() === '') {
    showMessage('Le nom est obligatoire', 'error');
    return;
  }
  
  if (!formData.surface_ha || formData.surface_ha === '') {
    showMessage('La surface est obligatoire', 'error');
    return;
  }
  
  setIsProcessing(true);
  try {
    // 🔧 NETTOYAGE: Convertir '' en null
    const dataToSend = {
      nom: formData.nom.trim(),
      surface_ha: parseFloat(formData.surface_ha),
      type_sol: formData.type_sol && formData.type_sol.trim() !== '' ? formData.type_sol.trim() : null,
      ph_sol: formData.ph_sol && formData.ph_sol !== '' ? parseFloat(formData.ph_sol) : null,  // ← FIX
      notes: formData.notes && formData.notes.trim() !== '' ? formData.notes.trim() : null,
      coordinates: formData.coordinates || null
    };
    
    console.log('📤 Envoi:', dataToSend);
    
    if (editingParcelle) {
      await axios.put(`${API_URL}/parcelles/${editingParcelle.id}`, dataToSend);
      showMessage('Parcelle mise à jour !', 'success');
    } else {
      await axios.post(`${API_URL}/parcelles`, dataToSend);
      showMessage('Parcelle créée !', 'success');
    }
    
    loadData();
    closeModal();
    
  } catch (error) {
    console.error('❌ Erreur:', error);
    const errorMsg = error.response?.data?.details || error.response?.data?.error || 'Erreur lors de la sauvegarde';
    showMessage(errorMsg, 'error');
  } finally {
    setIsProcessing(false);
  }
};

  const handleEdit = (parcelle) => {
    setEditingParcelle(parcelle);
    setFormData({
      nom: parcelle.nom || '',
      surface_ha: parcelle.surface_ha || '',
      type_sol: parcelle.type_sol || '',
      ph_sol: parcelle.ph_sol || '',
      
      notes: parcelle.notes || ''
    });
    setShowModal(true);
  };

  // ============ GESTION DU DESSIN DES PARCELLES ============

  const handleMapClick = (latlng) => {
    if (editMode === 'draw-parcelle') {
      setDrawingPoints([...drawingPoints, [latlng.lat, latlng.lng]]);
    }
  };

  const handlePolygonClick = (e, parcelle) => {
    if (editMode === 'draw-parcelle') {
      e.originalEvent.stopPropagation();
      setDrawingPoints([...drawingPoints, [e.latlng.lat, e.latlng.lng]]);
    }
  };

  // Demander confirmation pour dessiner une parcelle
  const askDrawParcelle = (parcelle) => {
    if (parcelle.coordinates?.length > 0) {
      // La parcelle a déjà un tracé, demander confirmation pour redessiner
      setConfirmModal({
        type: 'redraw-parcelle',
        item: parcelle,
        title: 'Redessiner la parcelle',
        message: `Voulez-vous redessiner la parcelle "${parcelle.nom}" ? Le tracé actuel sera remplacé.`,
        confirmText: 'Oui, redessiner',
        confirmColor: '#ff9800'
      });
    } else {
      // Pas de tracé, démarrer directement le dessin
      startDrawing(parcelle, false);
    }
  };

  const startDrawing = (parcelle, isRedraw = false) => {
    setConfirmModal(null);
    setEditMode('draw-parcelle');
    setParcelleToEdit(parcelle);
    setDrawingPoints([]);
    setIsRedrawing(isRedraw);
    showMessage(`Mode dessin activé pour "${parcelle.nom}"`, 'success');
  };

  const doRedrawParcelle = (parcelle) => {
    startDrawing(parcelle, true);
  };

  // Demander confirmation pour supprimer le tracé d'une parcelle
  const askDeleteParcelleDessin = (parcelle) => {
    setConfirmModal({
      type: 'delete-dessin',
      item: parcelle,
      title: 'Supprimer le tracé',
      message: `Supprimer le tracé de "${parcelle.nom}" de la carte ? La parcelle sera conservée mais sans géolocalisation.`,
      confirmText: 'Oui, supprimer le tracé',
      confirmColor: '#f44336'
    });
  };

  const doDeleteParcelleDessin = async (parcelle) => {
    setIsProcessing(true);
    setConfirmModal(null);
    
    try {
      await axios.put(`${API_URL}/parcelles/${parcelle.id}`, {
        nom: parcelle.nom,
        surface_ha: parcelle.surface_ha,
        type_sol: parcelle.type_sol || '',
        ph_sol: parcelle.ph_sol || '',
        notes: parcelle.notes || '',
        coordinates: [],
        deleteGeometry: true
      });
      
      showMessage('Tracé supprimé !', 'success');
      await loadData();
    } catch (error) {
      console.error('Erreur:', error);
      showMessage('Erreur: ' + (error.response?.data?.error || error.message), 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  // Valider le dessin de parcelle
  const finalizeParcelle = async () => {
    if (drawingPoints.length < 3) {
      showMessage('Minimum 3 points requis', 'error');
      return;
    }
    
    if (!parcelleToEdit) {
      showMessage('Sélectionnez une parcelle', 'error');
      return;
    }

    setIsProcessing(true);
    
    try {
      await axios.put(`${API_URL}/parcelles/${parcelleToEdit.id}`, {
        nom: parcelleToEdit.nom,
        surface_ha: parcelleToEdit.surface_ha,
        type_sol: parcelleToEdit.type_sol || '',
        ph_sol: parcelleToEdit.ph_sol || '',
        notes: parcelleToEdit.notes || '',
        coordinates: drawingPoints
      });
      
      showMessage(isRedrawing ? 'Parcelle redessinée !' : 'Parcelle enregistrée !', 'success');
      cancelDrawing();
      await loadData();
    } catch (error) {
      console.error('Erreur:', error);
      showMessage('Erreur: ' + (error.response?.data?.error || error.message), 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const cancelDrawing = () => {
    setEditMode(null);
    setDrawingPoints([]);
    setParcelleToEdit(null);
    setIsRedrawing(false);
  };

  // ============ GESTION DES CONFIRMATIONS (style Carte.js) ============

  // Demander confirmation pour modifier une parcelle
  const askEditParcelle = (parcelle) => {
    setConfirmModal({
      type: 'edit-parcelle',
      item: parcelle,
      title: 'Modifier la parcelle',
      message: `Voulez-vous modifier les informations de la parcelle "${parcelle.nom}" ?`,
      confirmText: 'Oui, modifier',
      confirmColor: '#2196f3'
    });
  };

  // Vérifier les dépendances avant suppression
  const checkDependencies = (parcelleId) => {
    const arbresLies = arbres.filter(a => a.parcelle_id === parcelleId);
    const interventionsLiees = interventions.filter(i => i.parcelle_id === parcelleId);
    const recoltesLiees = recoltes.filter(r => r.parcelle_id === parcelleId);
    return { arbres: arbresLies, interventions: interventionsLiees, recoltes: recoltesLiees };
  };

  const askDelete = (parcelle) => {
    const deps = checkDependencies(parcelle.id);
    const hasArbres = deps.arbres.length > 0;
    const hasInterventions = deps.interventions.length > 0;
    const hasRecoltes = deps.recoltes.length > 0;
    
    if (hasArbres || hasInterventions || hasRecoltes) {
      // Il y a des dépendances, proposer la réaffectation
      setParcelleToDelete(parcelle);
      setShowReassignModal(true);
    } else {
      // Pas de dépendances, confirmer simplement la suppression
      setConfirmModal({
        type: 'delete',
        item: parcelle,
        title: 'Supprimer la parcelle',
        message: `Êtes-vous sûr de vouloir supprimer la parcelle "${parcelle.nom}" ?`,
        confirmText: 'Oui, supprimer',
        confirmColor: '#f44336'
      });
    }
  };

  const doDelete = async (parcelle, reassignToId = null) => {
    setIsProcessing(true);
    setConfirmModal(null);
    setShowReassignModal(false);
    
    try {
      // Si réaffectation demandée
      if (reassignToId) {
        const deps = checkDependencies(parcelle.id);
        
        // Réaffecter les arbres
        for (const arbre of deps.arbres) {
          await axios.put(`${API_URL}/arbres/${arbre.id}`, {
            ...arbre,
            parcelle_id: reassignToId
          });
        }
        
        // Réaffecter les interventions
        for (const intervention of deps.interventions) {
          await axios.put(`${API_URL}/interventions/${intervention.id}`, {
            ...intervention,
            parcelle_id: reassignToId
          });
        }
        
        // Réaffecter les récoltes
        for (const recolte of deps.recoltes) {
          await axios.put(`${API_URL}/recoltes/${recolte.id}`, {
            ...recolte,
            parcelle_id: reassignToId
          });
        }
        
        showMessage('Éléments réaffectés avec succès !', 'success');
      }
      
      // Supprimer la parcelle
      await axios.delete(`${API_URL}/parcelles/${parcelle.id}`);
      
      if (selectedParcelleId === parcelle.id) {
        setSelectedParcelleId(null);
      }
      
      showMessage('Parcelle supprimée !', 'success');
      loadData();
    } catch (error) {
      console.error('Erreur:', error);
      showMessage('Erreur lors de la suppression', 'error');
    } finally {
      setIsProcessing(false);
      setParcelleToDelete(null);
      setReassignTargetId('');
    }
  };

  // Gérer la confirmation selon le type
  const handleConfirm = () => {
    if (!confirmModal) return;
    
    switch (confirmModal.type) {
      case 'redraw-parcelle':
        doRedrawParcelle(confirmModal.item);
        break;
      case 'delete-dessin':
        doDeleteParcelleDessin(confirmModal.item);
        break;
      case 'edit-parcelle':
        setConfirmModal(null);
        handleEdit(confirmModal.item);
        break;
      case 'delete':
        doDelete(confirmModal.item);
        break;
      default:
        setConfirmModal(null);
    }
  };

  const handleReassignAndDelete = () => {
    if (parcelleToDelete) {
      doDelete(parcelleToDelete, reassignTargetId || null);
    }
  };

  const openNewModal = () => {
    setEditingParcelle(null);
    setFormData({ nom: '', surface_ha: '', type_sol: '', ph_sol: '', notes: '' });
    setShowModal(true);
  };

  const handleImportCSV = async (validData) => {
    try {
      for (const parcelle of validData) {
        await axios.post(`${API_URL}/parcelles`, parcelle);
      }
      loadData();
      showMessage(`${validData.length} parcelle(s) importée(s) !`, 'success');
    } catch (error) {
      throw new Error('Erreur lors de l\'import');
    }
  };

  const closeModal = () => { setShowModal(false); setEditingParcelle(null); };
  const handleSelectParcelle = (parcelleId) => { setSelectedParcelleId(prev => prev === parcelleId ? null : parcelleId); };
  const handleExportPDF = () => { exportParcellesPDF(parcelles, colonnesExport); };
  const getParcelleColor = (index) => PARCELLE_COLORS[index % PARCELLE_COLORS.length];

  // Toggle pour afficher/masquer les détails d'arbres par espèce
  const toggleArbreDetails = (parcelleId) => {
    setExpandedParcelleId(prev => prev === parcelleId ? null : parcelleId);
  };

  const config = COLONNES_CONFIG.parcelles;
  const colonnesValides = colonnesAffichees.filter(col => config[col]);
  const parcellesAvecGeo = parcellesFiltrees.filter(p => p.coordinates?.length > 0);
  const parcellesSansGeo = parcellesFiltrees.filter(p => !p.coordinates || p.coordinates.length === 0);
  const defaultCenter = [46.1464315, -0.1652445];

  // Arbres affectés à une parcelle et avec position GPS
  const arbresAffectesAvecPosition = arbres.filter(a => a.parcelle_id && a.latitude && a.longitude);

  if (loading || loadingSettings) return <div className="loading">Chargement...</div>;

  const selectedParcelle = parcelles.find(p => p.id === selectedParcelleId);
  
  // Pour le modal de réaffectation
  const depsToReassign = parcelleToDelete ? checkDependencies(parcelleToDelete.id) : null;
  const otherParcelles = parcelles.filter(p => p.id !== parcelleToDelete?.id);

  return (
    <div className="page-container">
      {/* Modal de confirmation (style Carte.js) */}
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

      {/* Modal de réaffectation avant suppression */}
      {showReassignModal && parcelleToDelete && depsToReassign && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000 }}>
          <div style={{ background: 'white', padding: '2rem', borderRadius: '12px', maxWidth: '550px', boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}>
            <h3 style={{ marginBottom: '1rem', color: '#e74c3c' }}>⚠️ Attention : éléments liés</h3>
            
            <p style={{ marginBottom: '1rem', color: '#666' }}>
              La parcelle "<strong>{parcelleToDelete.nom}</strong>" contient des éléments liés :
            </p>
            
            <ul style={{ marginBottom: '1.5rem', paddingLeft: '1.5rem', color: '#666' }}>
              {depsToReassign.arbres.length > 0 && (
                <li><strong>{depsToReassign.arbres.length}</strong> arbre(s)</li>
              )}
              {depsToReassign.interventions.length > 0 && (
                <li><strong>{depsToReassign.interventions.length}</strong> intervention(s)</li>
              )}
              {depsToReassign.recoltes.length > 0 && (
                <li><strong>{depsToReassign.recoltes.length}</strong> récolte(s)</li>
              )}
            </ul>
            
            <div style={{ marginBottom: '1.5rem', padding: '1rem', background: '#f8f9fa', borderRadius: '8px' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>
                Réaffecter les éléments à une autre parcelle (optionnel) :
              </label>
              <select 
                value={reassignTargetId} 
                onChange={(e) => setReassignTargetId(e.target.value)}
                style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ddd' }}
              >
                <option value="">Ne pas réaffecter (les éléments resteront sans parcelle)</option>
                {otherParcelles.map(p => (
                  <option key={p.id} value={p.id}>{p.nom}</option>
                ))}
              </select>
            </div>
            
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button 
                onClick={() => { setShowReassignModal(false); setParcelleToDelete(null); setReassignTargetId(''); }} 
                style={{ padding: '0.75rem 1.5rem', background: '#9e9e9e', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
              >
                Annuler
              </button>
              <button 
                onClick={handleReassignAndDelete} 
                disabled={isProcessing}
                style={{ padding: '0.75rem 1.5rem', background: '#f44336', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
              >
                {isProcessing ? 'En cours...' : (reassignTargetId ? 'Réaffecter et supprimer' : 'Supprimer quand même')}
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
        <h2>🌳 Gestion des parcelles</h2>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-secondary" onClick={() => setShowImportModal(true)}>📤 Importer CSV</button>
          <button className="btn btn-secondary" onClick={handleExportPDF} disabled={parcelles.length === 0}>📄 Exporter PDF</button>
          <button className="btn btn-primary" onClick={openNewModal}>➕ Nouvelle parcelle</button>
        </div>
      </div>

      {parcelles.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🌳</div>
          <p>Aucune parcelle enregistrée</p>
          <button className="btn btn-primary" onClick={openNewModal} style={{ marginTop: '1rem' }}>Créer ma première parcelle</button>
        </div>
      ) : (
        <>
          {/* Mode dessin parcelle */}
          {editMode === 'draw-parcelle' && (
            <div style={{
              background: isRedrawing ? '#fff3e0' : '#e3f2fd',
              padding: '1rem',
              borderRadius: '8px',
              marginBottom: '1rem',
              border: isRedrawing ? '2px solid #ff9800' : '2px solid #1565c0'
            }}>
              <strong>{isRedrawing ? '🔄 REDESSIN parcelle' : '✏️ Dessin parcelle'}</strong>
              <p style={{ margin: '0.5rem 0' }}>
                Parcelle : <strong>{parcelleToEdit?.nom}</strong> | Points : {drawingPoints.length}
                {isRedrawing && <span style={{ color: '#e65100', marginLeft: '1rem' }}>(Le tracé actuel sera remplacé)</span>}
              </p>
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button 
                  onClick={finalizeParcelle} 
                  disabled={drawingPoints.length < 3 || isProcessing}
                  style={{ 
                    padding: '0.5rem 1rem', 
                    background: drawingPoints.length >= 3 ? '#4caf50' : '#ccc', 
                    color: 'white', 
                    border: 'none', 
                    borderRadius: '4px', 
                    cursor: drawingPoints.length >= 3 ? 'pointer' : 'not-allowed'
                  }}
                >
                  {isProcessing ? 'Enregistrement...' : '✓ Valider le tracé'}
                </button>
                <button 
                  onClick={() => setDrawingPoints(drawingPoints.slice(0, -1))} 
                  disabled={drawingPoints.length === 0}
                  style={{ padding: '0.5rem 1rem', background: '#ff9800', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                >
                  ↩ Annuler dernier point
                </button>
                <button 
                  onClick={cancelDrawing}
                  style={{ padding: '0.5rem 1rem', background: '#f44336', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                >
                  ✕ Annuler le dessin
                </button>
              </div>
            </div>
          )}

          {/* ============ SECTION FILTRES ============ */}
          <div style={{ marginBottom: '1rem' }}>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="btn btn-secondary"
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '0.5rem',
                background: activeFiltersCount > 0 ? '#e3f2fd' : undefined,
                borderColor: activeFiltersCount > 0 ? '#1976d2' : undefined
              }}
            >
              🔍 Filtres {activeFiltersCount > 0 && `(${activeFiltersCount})`}
              <span style={{ fontSize: '0.8rem' }}>{showFilters ? '▲' : '▼'}</span>
            </button>
            
            {showFilters && (
              <div style={{ 
                marginTop: '0.75rem', 
                padding: '1rem', 
                background: 'white', 
                borderRadius: '8px', 
                border: '1px solid #ddd',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
              }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
                  {/* Recherche texte */}
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.85rem', fontWeight: '600' }}>
                      Recherche
                    </label>
                    <input
                      type="text"
                      name="search"
                      value={filters.search}
                      onChange={handleFilterChange}
                      placeholder="Nom, notes..."
                      style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ddd' }}
                    />
                  </div>
                  
                  {/* Type de sol */}
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.85rem', fontWeight: '600' }}>
                      Type de sol
                    </label>
                    <select
                      name="type_sol"
                      value={filters.type_sol}
                      onChange={handleFilterChange}
                      style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ddd' }}
                    >
                      <option value="">Tous</option>
                      {typesSolUniques.map(type => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                    </select>
                  </div>
                  
                  {/* Géolocalisation */}
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.85rem', fontWeight: '600' }}>
                      Géolocalisation
                    </label>
                    <select
                      name="avecGeo"
                      value={filters.avecGeo}
                      onChange={handleFilterChange}
                      style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ddd' }}
                    >
                      <option value="">Toutes</option>
                      <option value="oui">Avec tracé</option>
                      <option value="non">Sans tracé</option>
                    </select>
                  </div>
                  
                  {/* Avec arbres */}
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.85rem', fontWeight: '600' }}>
                      Arbres
                    </label>
                    <select
                      name="avecArbres"
                      value={filters.avecArbres}
                      onChange={handleFilterChange}
                      style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ddd' }}
                    >
                      <option value="">Toutes</option>
                      <option value="oui">Avec arbres</option>
                      <option value="non">Sans arbres</option>
                    </select>
                  </div>
                  
                  {/* Surface min/max */}
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.85rem', fontWeight: '600' }}>
                      Surface (ha)
                    </label>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <input
                        type="number"
                        name="surfaceMin"
                        value={filters.surfaceMin}
                        onChange={handleFilterChange}
                        placeholder="Min"
                        step="0.1"
                        min="0"
                        style={{ width: '50%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ddd' }}
                      />
                      <input
                        type="number"
                        name="surfaceMax"
                        value={filters.surfaceMax}
                        onChange={handleFilterChange}
                        placeholder="Max"
                        step="0.1"
                        min="0"
                        style={{ width: '50%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ddd' }}
                      />
                    </div>
                  </div>
                  
                  {/* pH min/max */}
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.85rem', fontWeight: '600' }}>
                      pH du sol
                    </label>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <input
                        type="number"
                        name="phMin"
                        value={filters.phMin}
                        onChange={handleFilterChange}
                        placeholder="Min"
                        step="0.1"
                        min="0"
                        max="14"
                        style={{ width: '50%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ddd' }}
                      />
                      <input
                        type="number"
                        name="phMax"
                        value={filters.phMax}
                        onChange={handleFilterChange}
                        placeholder="Max"
                        step="0.1"
                        min="0"
                        max="14"
                        style={{ width: '50%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ddd' }}
                      />
                    </div>
                  </div>
                </div>
                
                {/* Bouton réinitialiser */}
                <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.85rem', color: '#666' }}>
                    {parcellesFiltrees.length} / {parcelles.length} parcelle(s)
                  </span>
                  {activeFiltersCount > 0 && (
                    <button 
                      onClick={resetFilters}
                      style={{ 
                        padding: '0.5rem 1rem', 
                        background: '#ff5722', 
                        color: 'white', 
                        border: 'none', 
                        borderRadius: '4px', 
                        cursor: 'pointer',
                        fontSize: '0.85rem'
                      }}
                    >
                      ✕ Réinitialiser les filtres
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Carte et panneau */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: '1rem', marginBottom: '1rem' }}>
            {/* Carte */}
            <div style={{ height: '450px', borderRadius: '12px', overflow: 'hidden', border: '2px solid #e0e0e0' }}>
              <MapContainer center={defaultCenter} zoom={14} style={{ height: '100%', width: '100%' }}>
                <LayersControl position="topright">
                  <LayersControl.BaseLayer checked name="Satellite">
                    <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" maxZoom={19} />
                  </LayersControl.BaseLayer>
                  <LayersControl.BaseLayer name="Plan">
                    <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  </LayersControl.BaseLayer>
                </LayersControl>
                <MapController bounds={mapBounds} selectedParcelleId={selectedParcelleId} parcelles={parcelles} />
                <MapClickHandler onMapClick={handleMapClick} mode={editMode} />
                
                {/* Parcelles existantes (filtrées) */}
                {parcellesAvecGeo.map((parcelle, index) => (
                  <Polygon
                    key={parcelle.id}
                    positions={parcelle.coordinates}
                    pathOptions={{
                      color: getParcelleColor(index),
                      weight: selectedParcelleId === parcelle.id ? 4 : 2,
                      fillOpacity: hoveredParcelleId === parcelle.id || selectedParcelleId === parcelle.id ? 0.4 : 0.2
                    }}
                    eventHandlers={{
                      click: (e) => {
                        if (editMode === 'draw-parcelle') {
                          handlePolygonClick(e, parcelle);
                        } else {
                          handleSelectParcelle(parcelle.id);
                        }
                      },
                      mouseover: () => setHoveredParcelleId(parcelle.id),
                      mouseout: () => setHoveredParcelleId(null)
                    }}
                  >
                    {!editMode && (
                      <Popup>
                        <div style={{ minWidth: '200px' }}>
                          <h4 style={{ margin: '0 0 0.5rem 0', color: '#2c5f2d' }}>{parcelle.nom}</h4>
                          <p style={{ margin: '0.25rem 0' }}>{parcelle.surface_ha} ha</p>
                          {parcelle.type_sol && <p style={{ margin: '0.25rem 0', fontSize: '0.9rem' }}>Sol: {parcelle.type_sol}</p>}
                          <p style={{ margin: '0.25rem 0', fontSize: '0.9rem' }}>
                            <strong>Arbres: {arbresParParcelle[parcelle.id]?.total || 0}</strong>
                          </p>
                          {/* Détails par espèce */}
                          {arbresParParcelle[parcelle.id]?.total > 0 && (
                            <div style={{ fontSize: '0.85rem', marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid #eee' }}>
                              <strong>Par espèce :</strong>
                              {Object.entries(arbresParParcelle[parcelle.id].parEspece).map(([espece, data]) => (
                                <div key={espece} style={{ marginLeft: '0.5rem' }}>
                                  • {espece}: {data.total}
                                </div>
                              ))}
                            </div>
                          )}
                          <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            <button
                              onClick={() => askEditParcelle(parcelle)}
                              style={{ padding: '0.5rem', background: '#2196f3', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                            >
                              ✏️ Modifier
                            </button>
                            <button
                              onClick={() => askDrawParcelle(parcelle)}
                              style={{ padding: '0.5rem', background: '#ff9800', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                            >
                              🔄 Redessiner
                            </button>
                            <button
                              onClick={() => askDeleteParcelleDessin(parcelle)}
                              style={{ padding: '0.5rem', background: '#9e9e9e', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                            >
                              🗑️ Supprimer tracé
                            </button>
                            <button
                              onClick={() => askDelete(parcelle)}
                              style={{ padding: '0.5rem', background: '#f44336', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                            >
                              ❌ Supprimer parcelle
                            </button>
                          </div>
                        </div>
                      </Popup>
                    )}
                  </Polygon>
                ))}

                {/* Dessin en cours */}
                {editMode === 'draw-parcelle' && drawingPoints.length > 0 && (
                  <Polygon 
                    positions={drawingPoints}
                    pathOptions={{ color: isRedrawing ? '#ff9800' : '#00ffff', fillColor: isRedrawing ? '#ffcc80' : '#00ffff', fillOpacity: 0.3, weight: 3, dashArray: '10, 5' }}
                  />
                )}

                {/* Points de dessin */}
                {editMode === 'draw-parcelle' && drawingPoints.map((point, idx) => (
                  <Marker
                    key={idx}
                    position={point}
                    icon={L.divIcon({
                      html: `<div style="background:${isRedrawing ? '#ff9800' : '#00ffff'};width:16px;height:16px;border-radius:50%;border:2px solid white;text-align:center;font-size:10px;line-height:16px;color:${isRedrawing ? 'white' : 'black'};font-weight:bold;">${idx+1}</div>`,
                      iconSize: [16, 16],
                      iconAnchor: [8, 8]
                    })}
                  />
                ))}

                {/* Arbres affectés aux parcelles uniquement */}
                {showArbres && arbresAffectesAvecPosition.map(arbre => (
                  <Marker 
                    key={arbre.id} 
                    position={[parseFloat(arbre.latitude), parseFloat(arbre.longitude)]}
                    icon={createArbreIcon(arbre.etat)}
                  >
                    <Popup>
                      <div style={{ minWidth: '180px' }}>
                        <h4 style={{ margin: '0 0 0.5rem 0', color: '#2c5f2d' }}>{arbre.numero}</h4>
                        <p style={{ margin: '0.2rem 0', fontSize: '0.9rem' }}>{arbre.espece} - {arbre.etat}</p>
                        <p style={{ margin: '0.2rem 0', fontSize: '0.9rem' }}>Parcelle: {arbre.parcelle_nom || 'N/A'}</p>
                        {arbre.variete_truffe && <p style={{ margin: '0.2rem 0', fontSize: '0.85rem', color: '#666' }}>Truffe: {arbre.variete_truffe}</p>}
                      </div>
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
            </div>
            
            {/* Panneau latéral */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              
              {/* ✨ WIDGET MÉTÉO */}
              <WeatherWidget 
                inseeCode="79170"
                location="Lusseray,FR"
                showForecastByDefault={false}
                showIndicators={true}
              />
              
              {/* Options d'affichage */}
              <div style={{ background: 'white', borderRadius: '12px', padding: '1rem', border: '1px solid #ddd' }}>
                <h4 style={{ margin: '0 0 0.75rem 0', color: '#2c5f2d', borderBottom: '2px solid #e0e0e0', paddingBottom: '0.5rem' }}>
                  🎛️ Affichage carte
                </h4>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', cursor: 'pointer' }}>
                  <input 
                    type="checkbox" 
                    checked={showArbres} 
                    onChange={(e) => setShowArbres(e.target.checked)} 
                  />
                  <span>Afficher les arbres ({arbresAffectesAvecPosition.length})</span>
                </label>
                
                {/* Légende */}
                <div style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid #e0e0e0' }}>
                  <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.85rem', fontWeight: '600' }}>Légende arbres:</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', fontSize: '0.8rem' }}>
                    <span><span style={{ display: 'inline-block', width: '12px', height: '12px', borderRadius: '50%', background: '#27ae60', marginRight: '4px' }}></span>Bon</span>
                    <span><span style={{ display: 'inline-block', width: '12px', height: '12px', borderRadius: '50%', background: '#f39c12', marginRight: '4px' }}></span>Moyen</span>
                    <span><span style={{ display: 'inline-block', width: '12px', height: '12px', borderRadius: '50%', background: '#e74c3c', marginRight: '4px' }}></span>Mauvais</span>
                    <span><span style={{ display: 'inline-block', width: '12px', height: '12px', borderRadius: '50%', background: '#95a5a6', marginRight: '4px' }}></span>Mort</span>
                  </div>
                </div>
              </div>

              {/* Parcelles sans géolocalisation */}
              {parcellesSansGeo.length > 0 && (
                <div style={{ background: 'white', borderRadius: '12px', padding: '1rem', border: '2px solid #e67e22' }}>
                  <h4 style={{ margin: '0 0 0.75rem 0', color: '#e67e22', borderBottom: '2px solid #e67e22', paddingBottom: '0.5rem' }}>
                    📍 À dessiner ({parcellesSansGeo.length})
                  </h4>
                  <div style={{ maxHeight: '150px', overflowY: 'auto' }}>
                    {parcellesSansGeo.map(p => (
                      <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.4rem 0', borderBottom: '1px solid #eee' }}>
                        <span style={{ fontSize: '0.9rem' }}>○ {p.nom}</span>
                        <button 
                          onClick={() => askDrawParcelle(p)} 
                          style={{ padding: '0.25rem 0.5rem', background: '#4caf50', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}
                          disabled={editMode !== null}
                        >
                          Dessiner
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Détails parcelle sélectionnée */}
              {selectedParcelle && (
                <div style={{ background: 'white', borderRadius: '12px', padding: '1rem', border: '1px solid #ddd' }}>
                  <h3 style={{ color: '#2c5f2d', marginBottom: '1rem', borderBottom: '2px solid #e0e0e0', paddingBottom: '0.5rem' }}>
                    📍 {selectedParcelle.nom}
                  </h3>
                  <div style={{ fontSize: '0.9rem', color: '#666' }}>
                    <p><strong>Surface:</strong> {selectedParcelle.surface_ha || '-'} ha</p>
                    <p><strong>Type sol:</strong> {selectedParcelle.type_sol || '-'}</p>
                    <p><strong>pH:</strong> {selectedParcelle.ph_sol || '-'}</p>
                    <p><strong>Arbres:</strong> {arbresParParcelle[selectedParcelle.id]?.total || 0}</p>
                    
                    {/* Détails par espèce */}
                    {arbresParParcelle[selectedParcelle.id]?.total > 0 && (
                      <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: '#f8f9fa', borderRadius: '6px' }}>
                        <strong style={{ color: '#2c5f2d' }}>🌳 Répartition par espèce :</strong>
                        {Object.entries(arbresParParcelle[selectedParcelle.id].parEspece).map(([espece, data]) => (
                          <div key={espece} style={{ marginTop: '0.5rem', paddingLeft: '0.5rem' }}>
                            <div style={{ fontWeight: '500' }}>{espece}: {data.total}</div>
                            <div style={{ fontSize: '0.8rem', color: '#888', display: 'flex', gap: '0.5rem', marginLeft: '0.5rem' }}>
                              <span style={{ color: '#27ae60' }}>Bon: {data.etats.Bon}</span>
                              <span style={{ color: '#f39c12' }}>Moyen: {data.etats.Moyen}</span>
                              <span style={{ color: '#e74c3c' }}>Mauvais: {data.etats.Mauvais}</span>
                              <span style={{ color: '#95a5a6' }}>Mort: {data.etats.Mort}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {selectedParcelle.notes && <p style={{ marginTop: '0.5rem' }}><strong>Notes:</strong> {selectedParcelle.notes}</p>}
                  </div>
                  <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
                    <button className="btn btn-secondary" onClick={() => askEditParcelle(selectedParcelle)} style={{ flex: 1 }}>✏️ Modifier</button>
                    <button className="btn btn-danger" onClick={() => askDelete(selectedParcelle)} style={{ flex: 1 }}>🗑️ Supprimer</button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Tableau */}
          <div style={{ background: 'white', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', border: '1px solid #e0e0e0', overflow: 'hidden' }}>
            <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e0e0e0', background: '#f8f9fa', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1rem', color: '#2c5f2d' }}>
                📋 Liste des parcelles ({parcellesFiltrees.length}{parcellesFiltrees.length !== parcelles.length ? ` / ${parcelles.length}` : ''})
              </h3>
              {parcellesSansGeo.length > 0 && (
                <span style={{ fontSize: '0.85rem', color: '#e67e22', background: '#fff9e6', padding: '0.25rem 0.5rem', borderRadius: '4px' }}>
                  {parcellesSansGeo.length} sans géolocalisation
                </span>
              )}
            </div>
            
            <table>
              <thead>
                <tr>
                  <th style={{ width: '40px' }}></th>
                  {colonnesValides.map(col => (
                    <th key={col} style={{ textAlign: config[col].align || 'left' }}>{config[col].label}</th>
                  ))}
                  <th>Arbres</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {parcellesFiltrees.map((parcelle, index) => {
                  const hasGeo = parcelle.coordinates?.length > 0;
                  const isSelected = selectedParcelleId === parcelle.id;
                  const arbresCount = arbresParParcelle[parcelle.id]?.total || 0;
                  const isExpanded = expandedParcelleId === parcelle.id;
                  
                  return (
                    <React.Fragment key={parcelle.id}>
                      <tr 
                        onClick={() => hasGeo && handleSelectParcelle(parcelle.id)}
                        style={{ cursor: hasGeo ? 'pointer' : 'default', background: isSelected ? '#e8f5e9' : 'transparent' }}
                        onMouseEnter={() => hasGeo && setHoveredParcelleId(parcelle.id)}
                        onMouseLeave={() => setHoveredParcelleId(null)}
                      >
                        <td style={{ textAlign: 'center' }}>
                          {hasGeo ? (
                            <span style={{ display: 'inline-block', width: '16px', height: '16px', borderRadius: '3px', background: getParcelleColor(index), border: isSelected ? '2px solid #1a5f1a' : '1px solid rgba(0,0,0,0.2)' }}></span>
                          ) : (
                            <span style={{ color: '#999', fontSize: '0.9rem' }} title="Non géolocalisée">○</span>
                          )}
                        </td>
                        {colonnesValides.map(col => (
                          <td key={col} style={{ textAlign: config[col].align || 'left' }}>
                            {col === 'nom' ? <strong>{config[col].render(parcelle)}</strong> : config[col].render(parcelle)}
                          </td>
                        ))}
                        <td onClick={(e) => e.stopPropagation()}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ 
                              fontWeight: 'bold', 
                              color: arbresCount > 0 ? '#2c5f2d' : '#999',
                              minWidth: '30px'
                            }}>
                              {arbresCount}
                            </span>
                            {arbresCount > 0 && (
                              <button
                                onClick={() => toggleArbreDetails(parcelle.id)}
                                style={{
                                  padding: '0.2rem 0.5rem',
                                  background: isExpanded ? '#2c5f2d' : '#e8f5e9',
                                  color: isExpanded ? 'white' : '#2c5f2d',
                                  border: '1px solid #2c5f2d',
                                  borderRadius: '4px',
                                  cursor: 'pointer',
                                  fontSize: '0.75rem'
                                }}
                                title="Voir détails par espèce"
                              >
                                {isExpanded ? '▼' : '▶'} Détails
                              </button>
                            )}
                          </div>
                        </td>
                        <td onClick={(e) => e.stopPropagation()}>
                          <div style={{ display: 'flex', gap: '0.25rem' }}>
                            <button 
                              className="btn btn-secondary" 
                              onClick={() => askEditParcelle(parcelle)} 
                              style={{ padding: '0.4rem 0.6rem' }}
                              title="Modifier"
                            >
                              ✏️
                            </button>
                            <button 
                              className="btn btn-secondary" 
                              onClick={() => askDrawParcelle(parcelle)} 
                              style={{ padding: '0.4rem 0.6rem', background: hasGeo ? '#ff9800' : '#4caf50', color: 'white' }}
                              title={hasGeo ? "Redessiner" : "Dessiner"}
                              disabled={editMode !== null}
                            >
                              {hasGeo ? '🔄' : '✏️'}
                            </button>
                            <button 
                              className="btn btn-danger" 
                              onClick={() => askDelete(parcelle)} 
                              style={{ padding: '0.4rem 0.6rem' }}
                              title="Supprimer"
                            >
                              🗑️
                            </button>
                          </div>
                        </td>
                      </tr>
                      {/* Ligne de détails par espèce */}
                      {isExpanded && arbresCount > 0 && (
                        <tr>
                          <td colSpan={colonnesValides.length + 3} style={{ background: '#f8f9fa', padding: '0.75rem 1rem' }}>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
                              {Object.entries(arbresParParcelle[parcelle.id].parEspece).map(([espece, data]) => (
                                <div key={espece} style={{ 
                                  background: 'white', 
                                  padding: '0.75rem', 
                                  borderRadius: '8px', 
                                  border: '1px solid #ddd',
                                  minWidth: '180px'
                                }}>
                                  <div style={{ fontWeight: 'bold', color: '#2c5f2d', marginBottom: '0.5rem' }}>
                                    🌳 {espece}
                                  </div>
                                  <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{data.total} arbres</div>
                                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', fontSize: '0.8rem' }}>
                                    {data.etats.Bon > 0 && (
                                      <span style={{ background: '#d4edda', color: '#155724', padding: '0.15rem 0.4rem', borderRadius: '4px' }}>
                                        Bon: {data.etats.Bon}
                                      </span>
                                    )}
                                    {data.etats.Moyen > 0 && (
                                      <span style={{ background: '#fff3cd', color: '#856404', padding: '0.15rem 0.4rem', borderRadius: '4px' }}>
                                        Moyen: {data.etats.Moyen}
                                      </span>
                                    )}
                                    {data.etats.Mauvais > 0 && (
                                      <span style={{ background: '#f8d7da', color: '#721c24', padding: '0.15rem 0.4rem', borderRadius: '4px' }}>
                                        Mauvais: {data.etats.Mauvais}
                                      </span>
                                    )}
                                    {data.etats.Mort > 0 && (
                                      <span style={{ background: '#e0e0e0', color: '#666', padding: '0.15rem 0.4rem', borderRadius: '4px' }}>
                                        Mort: {data.etats.Mort}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Modal création/édition */}
      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingParcelle ? 'Modifier la parcelle' : 'Nouvelle parcelle'}</h3>
              <button className="modal-close" onClick={closeModal}>✕</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-grid">
                <div className="form-group">
                  <label>Nom *</label>
                  <input type="text" name="nom" value={formData.nom} onChange={handleInputChange} required placeholder="Ex: Parcelle Nord" />
                </div>
                <div className="form-group">
                  <label>Surface (ha) *</label>
					<input 
					  type="number" 
					  name="surface_ha" 
					  value={formData.surface_ha} 
					  onChange={handleInputChange} 
					  required
					  step="0.01" 
					  placeholder="Ex: 1.5" 
					/>
                </div>
                <div className="form-group">
                  <label>Type de sol</label>
                  <select name="type_sol" value={formData.type_sol} onChange={handleInputChange}>
                    <option value="">Sélectionner...</option>
                    <option value="Calcaire">Calcaire</option>
                    <option value="Argilo-calcaire">Argilo-calcaire</option>
                    <option value="Argileux">Argileux</option>
                    <option value="Sableux">Sableux</option>
                    <option value="Limoneux">Limoneux</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>pH du sol</label>
                  <input type="number" name="ph_sol" value={formData.ph_sol} onChange={handleInputChange} step="0.1" min="0" max="14" placeholder="Ex: 7.8" />
                </div>
              </div>
              <div className="form-group">
                <label>Notes</label>
                <textarea name="notes" value={formData.notes} onChange={handleInputChange} placeholder="Informations complémentaires..." />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={closeModal}>Annuler</button>
                <button type="submit" className="btn btn-primary" disabled={isProcessing}>
                  {isProcessing ? 'En cours...' : (editingParcelle ? 'Mettre à jour' : 'Créer')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <CSVImportModal
        show={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImport={handleImportCSV}
        validateFunction={validateParcellesCSV}
        type="parcelles"
        title="Importer des parcelles depuis CSV"
      />
    </div>
  );
}

export default Parcelles;