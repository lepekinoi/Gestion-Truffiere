import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { MapContainer, TileLayer, Marker, Polygon, useMapEvents, useMap, LayersControl } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { exportArbresPDF } from '../utils/pdfExport';
import { validateArbresCSV } from '../utils/csvImport';
import CSVImportModal from './CSVImportModal';
import { useColumnSettings, COLONNES_CONFIG } from '../hooks/useColumnSettings';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

// Coordonnées par défaut (même que Carte.js)
const DEFAULT_CENTER = [46.1464315, -0.1652445];
const DEFAULT_ZOOM = 16;

// Fix pour les icones Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Icone personnalisée pour l'arbre
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

// Composant pour gérer les clics sur la carte
function MapClickHandler({ onMapClick }) {
  useMapEvents({
    click: (e) => {
      onMapClick(e.latlng);
    }
  });
  return null;
}

// Composant pour contrôler le zoom et le centre de la carte (uniquement à l'initialisation)
function MapController({ bounds, center, zoom, mapKey, arbrePosition }) {
  const map = useMap();
  const initializedRef = useRef(false);
  
  useEffect(() => {
    // Réinitialiser quand mapKey change (changement de parcelle)
    initializedRef.current = false;
  }, [mapKey]);
  
  useEffect(() => {
    // Ne faire le zoom qu'une seule fois à l'initialisation
    if (initializedRef.current) return;
    
    // Priorité 1: Si l'arbre a une position, zoomer dessus
    if (arbrePosition && arbrePosition[0] && arbrePosition[1]) {
      map.setView(arbrePosition, 18);
      initializedRef.current = true;
    }
    // Priorité 2: Si la parcelle a des coordonnées, zoomer sur la parcelle
    else if (bounds && bounds.length > 0) {
      const leafletBounds = L.latLngBounds(bounds.map(coord => [coord[0], coord[1]]));
      map.fitBounds(leafletBounds, { padding: [50, 50], maxZoom: 18 });
      initializedRef.current = true;
    }
    // Priorité 3: Utiliser le centre par défaut
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
  
  // État pour le tooltip des interventions
  const [hoveredArbreId, setHoveredArbreId] = useState(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const [showModal, setShowModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [editingArbre, setEditingArbre] = useState(null);
  const [message, setMessage] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Modal de confirmation
  const [confirmModal, setConfirmModal] = useState(null);
  
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

  // État pour la corbeille
  const [showCorbeille, setShowCorbeille] = useState(false);
  const [arbresCorbeille, setArbresCorbeille] = useState([]);
  const [loadingCorbeille, setLoadingCorbeille] = useState(false);

  // État pour la mini-carte de géolocalisation
  const [showMap, setShowMap] = useState(false);
  const [mapCenter, setMapCenter] = useState(DEFAULT_CENTER);
  const [mapZoom, setMapZoom] = useState(DEFAULT_ZOOM);
  const [selectedParcelleCoords, setSelectedParcelleCoords] = useState(null);
  const [mapKey, setMapKey] = useState(0); // Pour forcer le re-render de la carte

  // Hook pour les paramètres de colonnes
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
      showMessage('Arbre restauré avec succès !', 'success');
      loadCorbeille();
      loadData();
    } catch (error) {
      console.error('Erreur lors de la restauration:', error);
      showMessage('Erreur lors de la restauration de l\'arbre', 'error');
    }
  };

  // Demander confirmation pour suppression définitive
  const askSupprimerDefinitivement = (arbre) => {
    setConfirmModal({
      type: 'delete-permanent',
      item: arbre,
      title: 'Suppression définitive',
      message: `Êtes-vous sûr de vouloir supprimer définitivement l'arbre "${arbre.numero}" ? Cette action est irréversible.`,
      confirmText: 'Oui, supprimer définitivement',
      confirmColor: '#f44336'
    });
  };

  // Exécuter la suppression définitive
  const doSupprimerDefinitivement = async (arbre) => {
    setIsProcessing(true);
    setConfirmModal(null);
    
    try {
      await axios.delete(`${API_URL}/arbres/corbeille/${arbre.id}`);
      showMessage('Arbre supprimé définitivement !', 'success');
      loadCorbeille();
    } catch (error) {
      console.error('Erreur lors de la suppression définitive:', error);
      showMessage('Erreur lors de la suppression définitive', 'error');
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
      message: `Êtes-vous sûr de vouloir vider la corbeille ? Tous les ${arbresCorbeille.length} arbre(s) supprimé(s) seront définitivement perdus.`,
      confirmText: 'Oui, vider la corbeille',
      confirmColor: '#f44336'
    });
  };

  // Exécuter le vidage de la corbeille
  const doViderCorbeille = async () => {
    setIsProcessing(true);
    setConfirmModal(null);
    
    try {
      await axios.delete(`${API_URL}/arbres/corbeille`);
      showMessage('Corbeille vidée !', 'success');
      loadCorbeille();
    } catch (error) {
      console.error('Erreur lors du vidage de la corbeille:', error);
      showMessage('Erreur lors du vidage de la corbeille', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  // Fonction pour obtenir le centre d'un polygone
  const getPolygonCenter = (coordinates) => {
    if (!coordinates || coordinates.length === 0) return null;
    const lats = coordinates.map(c => c[0]);
    const lngs = coordinates.map(c => c[1]);
    return [
      (Math.min(...lats) + Math.max(...lats)) / 2,
      (Math.min(...lngs) + Math.max(...lngs)) / 2
    ];
  };

  // Gérer le changement de parcelle
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
        showMessage('Arbre mis à  jour avec succès !', 'success');
      } else {
        await axios.post(`${API_URL}/arbres`, formData);
        showMessage('Arbre créé avec succès !', 'success');
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

  // Demander confirmation pour mettre à  la corbeille
  const askDelete = (arbre) => {
    setConfirmModal({
      type: 'delete',
      item: arbre,
      title: 'Mettre à  la corbeille',
      message: `Voulez-vous mettre l'arbre "${arbre.numero}" à  la corbeille ? Vous pourrez le restaurer plus tard.`,
      confirmText: 'Oui, mettre à  la corbeille',
      confirmColor: '#ff9800'
    });
  };

  // Exécuter la mise à  la corbeille
  const doDelete = async (arbre) => {
    setIsProcessing(true);
    setConfirmModal(null);
    
    try {
      await axios.delete(`${API_URL}/arbres/${arbre.id}`);
      showMessage('Arbre mis à  la corbeille', 'success');
      loadData();
    } catch (error) {
      console.error('Erreur lors de la suppression:', error);
      showMessage('Erreur lors de la suppression de l\'arbre', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  // Gérer la confirmation selon le type
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
      showMessage(`${validData.length} arbre(s) importé(s) avec succès !`, 'success');
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

  // Gérer le clic sur la carte pour placer l'arbre
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

  // Export PDF avec colonnes configurées
  const handleExportPDF = () => {
    exportArbresPDF(arbres, null, colonnesExport);
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

  // Fonction de rendu personnalisée pour les cellules spéciales
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

  // Obtenir le nom de la parcelle sélectionnée
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

  // Obtenir les interventions en cours ou prévues pour un arbre
  const getInterventionsForArbre = (arbreId) => {
    return interventions.filter(intervention => {
      // Vérifier si l'intervention concerne cet arbre
      if (intervention.arbre_id !== arbreId) return false;
      
      // Garder seulement les interventions planifiées ou en cours
      if (intervention.statut !== 'Planifié' && intervention.statut !== 'En cours') return false;
      
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

  // Vérifier si un arbre a des interventions en cours ou prévues
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
        <h2>Gestion des arbres truffiers</h2>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button 
            className="btn btn-secondary" 
            onClick={openCorbeille}
            title="Voir les arbres supprimés"
            style={{ 
              background: '#6c757d',
              position: 'relative'
            }}
          >
            🗑️ Corbeille
          </button>
          <button 
            className="btn btn-secondary" 
            onClick={() => setShowImportModal(true)}
            title="Importer des arbres depuis un fichier CSV"
          >
            📤 Importer CSV
          </button>
          <button 
            className="btn btn-secondary" 
            onClick={handleExportPDF}
            disabled={arbres.length === 0}
            title="Exporter la liste des arbres en PDF"
          >
            📄 Exporter PDF
          </button>
          <button className="btn btn-primary" onClick={openNewModal}>
            âž• Nouvel arbre
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
          <div className="card-title">En bon état</div>
          <div className="card-value" style={{ color: '#27ae60' }}>
            {arbres.filter(a => a.etat === 'Bon').length}
          </div>
        </div>
        <div className="card">
          <div className="card-title">À surveiller</div>
          <div className="card-value" style={{ color: '#f39c12' }}>
            {arbres.filter(a => a.etat === 'Moyen').length}
          </div>
        </div>
        <div className="card">
          <div className="card-title">En difficulté</div>
          <div className="card-value" style={{ color: '#e74c3c' }}>
            {arbres.filter(a => a.etat === 'Mauvais' || a.etat === 'Mort').length}
          </div>
        </div>
      </div>

      {/* Tableau */}
      {arbres.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🌳</div>
          <p>Aucun arbre enregistré</p>
          <button className="btn btn-primary" onClick={openNewModal} style={{ marginTop: '1rem' }}>
            Ajouter mon premier arbre
          </button>
        </div>
      ) : (
        <div style={{ position: 'relative' }}>
          <table>
            <thead>
              <tr>
                {colonnesValides.map(col => (
                  <th key={col} style={{ textAlign: config[col].align || 'left' }}>
                    {config[col].label}
                  </th>
                ))}
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {arbres.map(arbre => (
                <tr 
                  key={arbre.id}
                  onMouseEnter={(e) => handleMouseEnter(e, arbre.id)}
                  onMouseLeave={handleMouseLeave}
                  style={{ 
                    cursor: hasInterventions(arbre.id) ? 'help' : 'default',
                    position: 'relative'
                  }}
                >
                  {colonnesValides.map(col => (
                    <td key={col} style={{ textAlign: config[col].align || 'left' }}>
                      {col === 'numero' ? (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <strong>{config[col].render(arbre)}</strong>
                          {hasInterventions(arbre.id) && (
                            <span 
                              title="Interventions en cours ou prévues"
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                background: '#3498db',
                                color: 'white',
                                borderRadius: '50%',
                                width: '20px',
                                height: '20px',
                                fontSize: '0.75rem',
                                fontWeight: 'bold'
                              }}
                            >
                              🔧
                            </span>
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
                      ✏️
                    </button>
                    <button 
                      className="btn btn-danger" 
                      onClick={() => askDelete(arbre)}
                      style={{ padding: '0.4rem 0.8rem' }}
                    >
                      🗑️
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Tooltip des interventions */}
          {hoveredArbreId && (
            <div
              style={{
                position: 'fixed',
                left: tooltipPosition.x,
                top: tooltipPosition.y,
                background: 'white',
                border: '1px solid #ddd',
                borderRadius: '8px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                padding: '0.75rem 1rem',
                zIndex: 9999,
                maxWidth: '350px',
                minWidth: '250px'
              }}
            >
              <div style={{ 
                fontWeight: 'bold', 
                marginBottom: '0.5rem', 
                color: '#2c3e50',
                borderBottom: '1px solid #eee',
                paddingBottom: '0.5rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                🔧 Interventions prévues
              </div>
              {getInterventionsForArbre(hoveredArbreId).map((intervention, idx) => (
                <div 
                  key={intervention.id}
                  style={{ 
                    padding: '0.5rem 0',
                    borderBottom: idx < getInterventionsForArbre(hoveredArbreId).length - 1 ? '1px solid #f0f0f0' : 'none'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                    <span style={{ fontWeight: '500', color: '#34495e' }}>
                      {intervention.type_nom || 'Intervention'}
                    </span>
                    <span style={{
                      padding: '0.15rem 0.5rem',
                      borderRadius: '10px',
                      fontSize: '0.75rem',
                      fontWeight: '500',
                      ...getStatutInterventionStyle(intervention.statut)
                    }}>
                      {intervention.statut}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.85rem', color: '#7f8c8d' }}>
                    📆 {formatDateIntervention(intervention.date_prevue)}
                    {intervention.personnel && (
                      <span style={{ marginLeft: '0.75rem' }}>👤 {intervention.personnel}</span>
                    )}
                  </div>
                  {intervention.description && (
                    <div style={{ 
                      fontSize: '0.8rem', 
                      color: '#95a5a6', 
                      marginTop: '0.25rem',
                      fontStyle: 'italic'
                    }}>
                      {intervention.description.length > 60 
                        ? intervention.description.substring(0, 60) + '...' 
                        : intervention.description}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal de création/édition */}
      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '700px' }}>
            <div className="modal-header">
              <h3>{editingArbre ? 'Modifier l\'arbre' : 'Nouvel arbre'}</h3>
              <button className="modal-close" onClick={closeModal}>✕</button>
            </div>
            
            <form onSubmit={handleSubmit}>
              <div className="form-grid">
                <div className="form-group">
                  <label>Parcelle *</label>
                  <select
                    name="parcelle_id"
                    value={formData.parcelle_id}
                    onChange={handleInputChange}
                    required
                  >
                    <option value="">Sélectionner une parcelle...</option>
                    {parcelles.map(parcelle => (
                      <option key={parcelle.id} value={parcelle.id}>{parcelle.nom}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Numéro d'identification *</label>
                  <input
                    type="text"
                    name="numero"
                    value={formData.numero}
                    onChange={handleInputChange}
                    required
                    placeholder="Ex: A-001"
                  />
                </div>

                <div className="form-group">
                  <label>Espèce *</label>
                  <select
                    name="espece"
                    value={formData.espece}
                    onChange={handleInputChange}
                    required
                  >
                    <option value="">Sélectionner...</option>
                    <option value="Chêne vert">Chêne vert</option>
                    <option value="Chêne pubescent">Chêne pubescent</option>
                    <option value="Chêne pédonculé">Chêne pédonculé</option>
                    <option value="Noisetier">Noisetier</option>
                    <option value="Charme">Charme</option>
                    <option value="Tilleul">Tilleul</option>
                    <option value="Pin">Pin</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Variété de truffe associée</label>
                  <select
                    name="variete_truffe"
                    value={formData.variete_truffe}
                    onChange={handleInputChange}
                  >
                    <option value="">Sélectionner...</option>
                    <option value="Tuber melanosporum">Tuber melanosporum (Truffe noire)</option>
                    <option value="Tuber aestivum">Tuber aestivum (Truffe d'été)</option>
                    <option value="Tuber brumale">Tuber brumale (Truffe brumale)</option>
                    <option value="Tuber uncinatum">Tuber uncinatum (Truffe de Bourgogne)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Date de plantation</label>
                  <input
                    type="date"
                    name="date_plantation"
                    value={formData.date_plantation}
                    onChange={handleInputChange}
                  />
                </div>

                <div className="form-group">
                  <label>État de santé *</label>
                  <select
                    name="etat"
                    value={formData.etat}
                    onChange={handleInputChange}
                    required
                  >
                    <option value="Bon">Bon</option>
                    <option value="Moyen">Moyen</option>
                    <option value="Mauvais">Mauvais</option>
                    <option value="Mort">Mort</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Circonférence du tronc (cm)</label>
                  <input
                    type="number"
                    name="circonference_cm"
                    value={formData.circonference_cm}
                    onChange={handleInputChange}
                    step="0.1"
                    placeholder="Ex: 45.5"
                  />
                </div>

                <div className="form-group">
                  <label>Hauteur (mètres)</label>
                  <input
                    type="number"
                    name="hauteur_m"
                    value={formData.hauteur_m}
                    onChange={handleInputChange}
                    step="0.1"
                    placeholder="Ex: 3.5"
                  />
                </div>
              </div>

              {/* Section Géolocalisation */}
              <div style={{ 
                marginTop: '1rem', 
                padding: '1rem', 
                background: '#f8f9fa', 
                borderRadius: '8px',
                border: '1px solid #e9ecef'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <label style={{ fontWeight: '600', color: '#2c5f2d', margin: 0 }}>
                    📍 Géolocalisation
                  </label>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setShowMap(!showMap)}
                    style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
                  >
                    {showMap ? '🗺️ Masquer carte' : '🗺️ Afficher carte'}
                  </button>
                </div>

                {/* Info parcelle */}
                {formData.parcelle_id && (
                  <p style={{ fontSize: '0.85rem', color: '#666', marginBottom: '0.75rem', padding: '0.5rem', background: '#e8f5e9', borderRadius: '4px' }}>
                    {selectedParcelleCoords ? (
                      <>✔ Parcelle "<strong>{getSelectedParcelleName()}</strong>" géolocalisée - la carte zoomera automatiquement dessus</>
                    ) : (
                      <>↩️ Parcelle "<strong>{getSelectedParcelleName()}</strong>" non dessinée - position par défaut utilisée</>
                    )}
                  </p>
                )}

                {/* Affichage des coordonnées */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '0.5rem', alignItems: 'end' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label style={{ fontSize: '0.85rem' }}>Latitude</label>
                    <input
                      type="text"
                      name="latitude"
                      value={formData.latitude}
                      onChange={handleInputChange}
                      placeholder="Ex: 46.1464315"
                      style={{ fontSize: '0.9rem' }}
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label style={{ fontSize: '0.85rem' }}>Longitude</label>
                    <input
                      type="text"
                      name="longitude"
                      value={formData.longitude}
                      onChange={handleInputChange}
                      placeholder="Ex: -0.1652445"
                      style={{ fontSize: '0.9rem' }}
                    />
                  </div>
                  {(formData.latitude || formData.longitude) && (
                    <button
                      type="button"
                      onClick={clearPosition}
                      style={{ 
                        padding: '0.5rem', 
                        background: '#dc3545', 
                        color: 'white', 
                        border: 'none', 
                        borderRadius: '4px',
                        cursor: 'pointer',
                        height: '38px'
                      }}
                      title="Supprimer la position"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Mini-carte */}
                {showMap && (
                  <div style={{ marginTop: '0.75rem' }}>
                    <p style={{ fontSize: '0.85rem', color: '#666', marginBottom: '0.5rem' }}>
                      👆 Cliquez sur la carte pour positionner l'arbre
                      {selectedParcelleCoords && <span style={{ color: '#d4a600' }}> (zone jaune = parcelle)</span>}
                    </p>
                    <div style={{ height: '350px', borderRadius: '8px', overflow: 'hidden', border: '2px solid #ddd' }}>
                      <MapContainer
                        key={mapKey}
                        center={mapCenter || DEFAULT_CENTER}
                        zoom={DEFAULT_ZOOM}
                        style={{ height: '100%', width: '100%' }}
                      >
                        <LayersControl position="topright">
                          <LayersControl.BaseLayer checked name="Satellite">
                            <TileLayer
                              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                              maxZoom={19}
                            />
                          </LayersControl.BaseLayer>
                          <LayersControl.BaseLayer name="Plan">
                            <TileLayer
                              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                            />
                          </LayersControl.BaseLayer>
                          <LayersControl.BaseLayer name="Terrain">
                            <TileLayer
                              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}"
                              maxZoom={19}
                            />
                          </LayersControl.BaseLayer>
                          <LayersControl.BaseLayer name="Cadastre">
                            <TileLayer
                              url="https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png"
                              maxZoom={20}
                            />
                          </LayersControl.BaseLayer>
                        </LayersControl>
                        
                        {/* Contrôleur pour zoom sur parcelle ou arbre */}
                        <MapController 
                          bounds={selectedParcelleCoords}
                          center={mapCenter}
                          zoom={mapZoom}
                          mapKey={mapKey}
                          arbrePosition={formData.latitude && formData.longitude 
                            ? [parseFloat(formData.latitude), parseFloat(formData.longitude)]
                            : null
                          }
                        />
                        
                        <MapClickHandler onMapClick={handleMapClick} />
                        
                        {/* Polygone de la parcelle */}
                        {selectedParcelleCoords && (
                          <Polygon
                            positions={selectedParcelleCoords}
                            pathOptions={{
                              color: '#ffff00',
                              weight: 3,
                              fillColor: '#ffff00',
                              fillOpacity: 0.25
                            }}
                          />
                        )}
                        
                        {/* Marqueur de l'arbre */}
                        {formData.latitude && formData.longitude && (
                          <Marker 
                            position={[parseFloat(formData.latitude), parseFloat(formData.longitude)]}
                            icon={arbreIcon}
                          />
                        )}
                      </MapContainer>
                    </div>
                  </div>
                )}

                {formData.latitude && formData.longitude && (
                  <p style={{ fontSize: '0.8rem', color: '#27ae60', marginTop: '0.5rem', marginBottom: 0 }}>
                    ✔ Position définie : {parseFloat(formData.latitude).toFixed(5)}, {parseFloat(formData.longitude).toFixed(5)}
                  </p>
                )}
              </div>

              <div className="form-group" style={{ marginTop: '1rem' }}>
                <label>Notes et observations</label>
                <textarea
                  name="notes"
                  value={formData.notes}
                  onChange={handleInputChange}
                  placeholder="Observations, particularités, historique..."
                  rows="4"
                />
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={closeModal}>
                  Annuler
                </button>
                <button type="submit" className="btn btn-primary" disabled={isProcessing}>
                  {isProcessing ? 'En cours...' : (editingArbre ? 'Mettre à  jour' : 'Créer')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Corbeille */}
      {showCorbeille && (
        <div className="modal-overlay" onClick={() => setShowCorbeille(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '800px' }}>
            <div className="modal-header">
              <h3>🗑️ Corbeille - Arbres supprimés</h3>
              <button className="modal-close" onClick={() => setShowCorbeille(false)}>✕</button>
            </div>
            
            {loadingCorbeille ? (
              <div style={{ padding: '2rem', textAlign: 'center' }}>Chargement...</div>
            ) : arbresCorbeille.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#666' }}>
                <p>La corbeille est vide</p>
              </div>
            ) : (
              <>
                <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>{arbresCorbeille.length} arbre(s) dans la corbeille</span>
                  <button 
                    className="btn btn-danger"
                    onClick={askViderCorbeille}
                    style={{ padding: '0.5rem 1rem' }}
                  >
                    Vider la corbeille
                  </button>
                </div>
                <table>
                  <thead>
                    <tr>
                      <th>Numéro</th>
                      <th>Espèce</th>
                      <th>Parcelle</th>
                      <th>Supprimé le</th>
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
                          <button 
                            className="btn btn-primary"
                            onClick={() => handleRestaurer(arbre.id)}
                            style={{ marginRight: '0.5rem', padding: '0.4rem 0.8rem' }}
                          >
                            ↩️ Restaurer
                          </button>
                          <button 
                            className="btn btn-danger"
                            onClick={() => askSupprimerDefinitivement(arbre)}
                            style={{ padding: '0.4rem 0.8rem' }}
                          >
                            ✕ Supprimer
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
            
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowCorbeille(false)}>
                Fermer
              </button>
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
