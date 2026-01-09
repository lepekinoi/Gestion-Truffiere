import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { MapContainer, TileLayer, Marker, Popup, Polygon, useMapEvents, LayersControl } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

// Fix pour les icones Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Icones pour les arbres
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
      width: 20px;
      height: 20px;
      border-radius: 50%;
      border: 2px solid white;
      box-shadow: 0 2px 5px rgba(0,0,0,0.3);
    "></div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
    popupAnchor: [0, -10]
  });
};

// Composant pour gerer les clics sur la carte
function MapClickHandler({ onMapClick, mode }) {
  useMapEvents({
    click: (e) => {
      if (mode === 'draw-parcelle' || mode === 'place-arbre') {
        onMapClick(e.latlng);
      }
    }
  });
  return null;
}

function Carte() {
  const [parcelles, setParcelles] = useState([]);
  const [arbres, setArbres] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mapCenter, setMapCenter] = useState([46.1464315, -0.1652445]);
  const [mapZoom, setMapZoom] = useState(16);
  
  // Mode d'edition
  const [editMode, setEditMode] = useState(null);
  const [selectedParcelle, setSelectedParcelle] = useState(null);
  const [drawingPoints, setDrawingPoints] = useState([]);
  const [selectedArbre, setSelectedArbre] = useState(null);
  const [newArbrePosition, setNewArbrePosition] = useState(null);
  const [isRedrawing, setIsRedrawing] = useState(false);
  const [message, setMessage] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Modal de confirmation
  const [confirmModal, setConfirmModal] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const showMessage = (text, type = 'success') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 4000);
  };

  const loadData = async () => {
    try {
      const [parcellesRes, arbresRes] = await Promise.all([
        axios.get(`${API_URL}/parcelles`),
        axios.get(`${API_URL}/arbres`)
      ]);
      setParcelles(parcellesRes.data);
      setArbres(arbresRes.data);
      setLoading(false);
      
      const parcelleAvecGeo = parcellesRes.data.find(p => p.coordinates && p.coordinates.length > 0);
      if (parcelleAvecGeo && parcelleAvecGeo.coordinates.length > 0) {
        const firstCoord = parcelleAvecGeo.coordinates[0];
        setMapCenter([firstCoord[0], firstCoord[1]]);
      }
    } catch (error) {
      console.error('Erreur lors du chargement:', error);
      showMessage('Erreur lors du chargement', 'error');
      setLoading(false);
    }
  };

  const handleMapClick = (latlng) => {
    if (editMode === 'draw-parcelle') {
      setDrawingPoints([...drawingPoints, [latlng.lat, latlng.lng]]);
    } else if (editMode === 'place-arbre') {
      setNewArbrePosition([latlng.lat, latlng.lng]);
    }
  };

  const handlePolygonClick = (e, parcelle) => {
    if (editMode === 'place-arbre') {
      e.originalEvent.stopPropagation();
      setNewArbrePosition([e.latlng.lat, e.latlng.lng]);
    } else if (editMode === 'draw-parcelle') {
      e.originalEvent.stopPropagation();
      setDrawingPoints([...drawingPoints, [e.latlng.lat, e.latlng.lng]]);
    }
  };

  // ============ ACTIONS PARCELLES ============

  // Demander confirmation pour redessiner parcelle
  const askRedrawParcelle = (parcelle) => {
    console.log('askRedrawParcelle:', parcelle.nom);
    setConfirmModal({
      type: 'redraw-parcelle',
      item: parcelle,
      title: 'Redessiner la parcelle',
      message: `Voulez-vous redessiner la parcelle "${parcelle.nom}" ? Le trace actuel sera remplace.`,
      confirmText: 'Oui, redessiner',
      confirmColor: '#ff9800'
    });
  };

  // Executer le redessin
  const doRedrawParcelle = (parcelle) => {
    console.log('doRedrawParcelle:', parcelle.nom);
    setConfirmModal(null);
    setEditMode('draw-parcelle');
    setSelectedParcelle(parcelle.id.toString());
    setDrawingPoints([]);
    setIsRedrawing(true);
    showMessage(`Mode redessin active pour "${parcelle.nom}"`, 'success');
  };

  // Demander confirmation pour supprimer dessin parcelle
  const askDeleteParcelleDessin = (parcelle) => {
    console.log('askDeleteParcelleDessin:', parcelle.nom);
    setConfirmModal({
      type: 'delete-parcelle',
      item: parcelle,
      title: 'Supprimer le dessin',
      message: `Supprimer le trace de "${parcelle.nom}" de la carte ? La parcelle sera conservee mais sans geolocalisation.`,
      confirmText: 'Oui, supprimer le trace',
      confirmColor: '#f44336'
    });
  };

  // Executer la suppression du dessin parcelle
  const doDeleteParcelleDessin = async (parcelle) => {
    console.log('doDeleteParcelleDessin:', parcelle.nom);
    
    setIsProcessing(true);
    setConfirmModal(null);
    showMessage('Suppression du trace...', 'success');
    
    try {
      // Envoyer avec deleteGeometry = true pour supprimer la geometrie
      // Si le serveur ne supporte pas, on envoie coordinates vide
      await axios.put(`${API_URL}/parcelles/${parcelle.id}`, {
        nom: parcelle.nom,
        surface_ha: parcelle.surface_ha,
        type_sol: parcelle.type_sol || '',
        ph_sol: parcelle.ph_sol || '',
        exposition: parcelle.exposition || '',
        notes: parcelle.notes || '',
        coordinates: [],
        deleteGeometry: true
      });
      
      showMessage('Trace supprime !', 'success');
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
    
    if (!selectedParcelle) {
      showMessage('Selectionnez une parcelle', 'error');
      return;
    }

    setIsProcessing(true);
    
    try {
      const parcelle = parcelles.find(p => p.id === parseInt(selectedParcelle));
      
      if (!parcelle) {
        showMessage('Parcelle non trouvee', 'error');
        setIsProcessing(false);
        return;
      }

      await axios.put(`${API_URL}/parcelles/${selectedParcelle}`, {
        nom: parcelle.nom,
        surface_ha: parcelle.surface_ha,
        type_sol: parcelle.type_sol || '',
        ph_sol: parcelle.ph_sol || '',
        exposition: parcelle.exposition || '',
        notes: parcelle.notes || '',
        coordinates: drawingPoints
      });
      
      showMessage(isRedrawing ? 'Parcelle redessinee !' : 'Parcelle enregistree !', 'success');
      cancelEdit();
      await loadData();
    } catch (error) {
      console.error('Erreur:', error);
      showMessage('Erreur: ' + (error.response?.data?.error || error.message), 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  // ============ ACTIONS ARBRES ============

  // Demander confirmation pour supprimer position arbre
  const askDeleteArbre = (arbre) => {
    console.log('askDeleteArbre:', arbre.numero);
    setConfirmModal({
      type: 'delete-arbre',
      item: arbre,
      title: 'Retirer de la carte',
      message: `Retirer l'arbre "${arbre.numero}" de la carte ? Il restera dans la base mais sans position.`,
      confirmText: 'Oui, retirer',
      confirmColor: '#f44336'
    });
  };

  // Executer la suppression position arbre
  const doDeleteArbrePlacement = async (arbre) => {
    console.log('doDeleteArbrePlacement:', arbre.numero);
    
    setIsProcessing(true);
    setConfirmModal(null);
    showMessage('Suppression de la position...', 'success');
    
    try {
      await axios.put(`${API_URL}/arbres/${arbre.id}`, {
        parcelle_id: arbre.parcelle_id,
        numero: arbre.numero,
        espece: arbre.espece,
        variete_truffe: arbre.variete_truffe || null,
        date_plantation: arbre.date_plantation || null,
        etat: arbre.etat,
        circonference_cm: arbre.circonference_cm || null,
        hauteur_m: arbre.hauteur_m || null,
        latitude: null,
        longitude: null,
        notes: arbre.notes || ''
      });
      
      showMessage('Position supprimee !', 'success');
      await loadData();
      
    } catch (error) {
      console.error('Erreur:', error);
      showMessage('Erreur: ' + (error.response?.data?.error || error.message), 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  // Demander confirmation pour deplacer arbre
  const askMoveArbre = (arbre) => {
    console.log('askMoveArbre:', arbre.numero);
    setConfirmModal({
      type: 'move-arbre',
      item: arbre,
      title: 'Deplacer l\'arbre',
      message: `Deplacer l'arbre "${arbre.numero}" ? Cliquez ensuite sur la carte pour la nouvelle position.`,
      confirmText: 'Oui, deplacer',
      confirmColor: '#2196f3'
    });
  };

  // Executer le deplacement arbre
  const doMoveArbre = (arbre) => {
    console.log('doMoveArbre:', arbre.numero);
    setConfirmModal(null);
    setEditMode('place-arbre');
    setSelectedArbre(arbre.id.toString());
    setNewArbrePosition(null);
    showMessage('Cliquez sur la carte pour la nouvelle position', 'success');
  };

  // Valider position arbre
  const finalizeArbre = async () => {
    if (!newArbrePosition) {
      showMessage('Cliquez sur la carte', 'error');
      return;
    }
    
    if (!selectedArbre) {
      showMessage('Selectionnez un arbre', 'error');
      return;
    }

    setIsProcessing(true);
    
    try {
      const arbre = arbres.find(a => a.id === parseInt(selectedArbre));
      
      await axios.put(`${API_URL}/arbres/${selectedArbre}`, {
        parcelle_id: arbre.parcelle_id,
        numero: arbre.numero,
        espece: arbre.espece,
        variete_truffe: arbre.variete_truffe || null,
        date_plantation: arbre.date_plantation || null,
        etat: arbre.etat,
        circonference_cm: arbre.circonference_cm || null,
        hauteur_m: arbre.hauteur_m || null,
        latitude: newArbrePosition[0],
        longitude: newArbrePosition[1],
        notes: arbre.notes || ''
      });
      
      showMessage('Arbre positionne !', 'success');
      cancelEdit();
      await loadData();
    } catch (error) {
      console.error('Erreur:', error);
      showMessage('Erreur: ' + (error.response?.data?.error || error.message), 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  // ============ UTILITAIRES ============

  const cancelEdit = () => {
    setEditMode(null);
    setDrawingPoints([]);
    setSelectedParcelle(null);
    setNewArbrePosition(null);
    setSelectedArbre(null);
    setIsRedrawing(false);
  };

  // Gerer la confirmation selon le type
  const handleConfirm = () => {
    if (!confirmModal) return;
    
    switch (confirmModal.type) {
      case 'redraw-parcelle':
        doRedrawParcelle(confirmModal.item);
        break;
      case 'delete-parcelle':
        doDeleteParcelleDessin(confirmModal.item);
        break;
      case 'delete-arbre':
        doDeleteArbrePlacement(confirmModal.item);
        break;
      case 'move-arbre':
        doMoveArbre(confirmModal.item);
        break;
      default:
        setConfirmModal(null);
    }
  };

  // Stats
  const parcellesAvecGeo = parcelles.filter(p => p.coordinates && p.coordinates.length > 0);
  const parcellesSansGeo = parcelles.filter(p => !p.coordinates || p.coordinates.length === 0);
  const arbresAvecPosition = arbres.filter(a => a.latitude && a.longitude);
  const arbresSansPosition = arbres.filter(a => !a.latitude || !a.longitude);

  if (loading) {
    return <div className="loading">Chargement...</div>;
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

      {/* Header */}
      <div className="page-header">
        <h2>Cartographie de la truffiere</h2>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {!editMode && (
            <>
              <button className="btn btn-primary" onClick={() => setEditMode('draw-parcelle')}>
                Dessiner parcelle
              </button>
              <button className="btn btn-secondary" onClick={() => setEditMode('place-arbre')}>
                Placer arbre
              </button>
            </>
          )}
          {editMode && (
            <button className="btn btn-danger" onClick={cancelEdit}>
              Annuler
            </button>
          )}
        </div>
      </div>

      {/* Mode dessin parcelle */}
      {editMode === 'draw-parcelle' && (
        <div style={{
          background: isRedrawing ? '#fff3e0' : '#e3f2fd',
          padding: '1rem',
          borderRadius: '8px',
          marginBottom: '1rem',
          border: isRedrawing ? '2px solid #ff9800' : '2px solid #1565c0'
        }}>
          <strong>{isRedrawing ? 'REDESSIN parcelle' : 'Dessin parcelle'}</strong>
          <p style={{ margin: '0.5rem 0' }}>
            Cliquez sur la carte pour placer les points. <strong>{drawingPoints.length} point(s)</strong> (min 3)
          </p>
          
          {!isRedrawing && (
            <select
              value={selectedParcelle || ''}
              onChange={(e) => setSelectedParcelle(e.target.value)}
              style={{ width: '100%', padding: '0.5rem', marginBottom: '0.5rem', borderRadius: '4px' }}
            >
              <option value="">-- Choisir parcelle --</option>
              {parcelles.map(p => (
                <option key={p.id} value={p.id}>{p.nom} ({p.surface_ha} ha)</option>
              ))}
            </select>
          )}
          
          {isRedrawing && <p style={{ fontWeight: 'bold', color: '#e65100' }}>Parcelle: {parcelles.find(p => p.id === parseInt(selectedParcelle))?.nom}</p>}

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn btn-primary" onClick={finalizeParcelle} disabled={drawingPoints.length < 3 || !selectedParcelle || isProcessing}>
              {isProcessing ? 'Enregistrement...' : 'Valider le trace'}
            </button>
            <button className="btn btn-secondary" onClick={() => setDrawingPoints([])}>
              Effacer points
            </button>
          </div>
        </div>
      )}

      {/* Mode placement arbre */}
      {editMode === 'place-arbre' && (
        <div style={{
          background: '#e8f5e9',
          padding: '1rem',
          borderRadius: '8px',
          marginBottom: '1rem',
          border: '2px solid #2e7d32'
        }}>
          <strong>Placement arbre</strong>
          <p style={{ margin: '0.5rem 0' }}>
            Position: {newArbrePosition ? `${newArbrePosition[0].toFixed(5)}, ${newArbrePosition[1].toFixed(5)}` : 'Cliquez sur la carte...'}
          </p>
          
          <select
            value={selectedArbre || ''}
            onChange={(e) => setSelectedArbre(e.target.value)}
            style={{ width: '100%', padding: '0.5rem', marginBottom: '0.5rem', borderRadius: '4px' }}
          >
            <option value="">-- Choisir arbre --</option>
            <optgroup label="Non places">
              {arbresSansPosition.map(a => (
                <option key={a.id} value={a.id}>{a.numero} - {a.parcelle_nom}</option>
              ))}
            </optgroup>
            <optgroup label="Deja places">
              {arbresAvecPosition.map(a => (
                <option key={a.id} value={a.id}>{a.numero} - {a.parcelle_nom}</option>
              ))}
            </optgroup>
          </select>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn btn-primary" onClick={finalizeArbre} disabled={!newArbrePosition || !selectedArbre || isProcessing}>
              {isProcessing ? 'Enregistrement...' : 'Valider position'}
            </button>
            <button className="btn btn-secondary" onClick={() => setNewArbrePosition(null)}>
              Reset position
            </button>
          </div>
        </div>
      )}

      {/* CARTE */}
      <div style={{ height: '550px', borderRadius: '12px', overflow: 'hidden', border: '2px solid #ccc', marginBottom: '1rem' }}>
        <MapContainer center={mapCenter} zoom={mapZoom} style={{ height: '100%', width: '100%' }}>
          <LayersControl position="topright">
            <LayersControl.BaseLayer checked name="Satellite">
              <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" maxZoom={19} />
            </LayersControl.BaseLayer>
            <LayersControl.BaseLayer name="Plan">
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            </LayersControl.BaseLayer>
            <LayersControl.BaseLayer name="Terrain">
              <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}" maxZoom={19} />
            </LayersControl.BaseLayer>
            <LayersControl.BaseLayer name="Cadastre">
              <TileLayer url="https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png" maxZoom={20} />
            </LayersControl.BaseLayer>
          </LayersControl>
          
          <MapClickHandler onMapClick={handleMapClick} mode={editMode} />
          
          {/* Parcelles */}
          {parcellesAvecGeo
            .filter(p => !(isRedrawing && p.id === parseInt(selectedParcelle)))
            .map(parcelle => (
            <Polygon 
              key={parcelle.id}
              positions={parcelle.coordinates}
              pathOptions={{ color: '#ffff00', fillColor: '#ffff00', fillOpacity: 0.2, weight: 3 }}
              eventHandlers={{ click: (e) => handlePolygonClick(e, parcelle) }}
            >
              {!editMode && (
                <Popup>
                  <div style={{ minWidth: '200px' }}>
                    <h4 style={{ margin: '0 0 0.5rem 0', color: '#2c5f2d' }}>{parcelle.nom}</h4>
                    <p style={{ margin: '0.25rem 0' }}>{parcelle.surface_ha} ha</p>
                    {parcelle.type_sol && <p style={{ margin: '0.25rem 0', fontSize: '0.9rem' }}>Sol: {parcelle.type_sol}</p>}
                    <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <button
                        onClick={() => askRedrawParcelle(parcelle)}
                        style={{ padding: '0.5rem', background: '#ff9800', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                      >
                        Redessiner
                      </button>
                      <button
                        onClick={() => askDeleteParcelleDessin(parcelle)}
                        style={{ padding: '0.5rem', background: '#f44336', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                      >
                        Supprimer le trace
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

          {/* Arbres */}
          {arbresAvecPosition.map(arbre => (
            <Marker 
              key={arbre.id} 
              position={[parseFloat(arbre.latitude), parseFloat(arbre.longitude)]}
              icon={createArbreIcon(arbre.etat)}
            >
              <Popup>
                <div style={{ minWidth: '200px' }}>
                  <h4 style={{ margin: '0 0 0.5rem 0', color: '#2c5f2d' }}>{arbre.numero}</h4>
                  <p style={{ margin: '0.2rem 0', fontSize: '0.9rem' }}>{arbre.espece} - {arbre.etat}</p>
                  <p style={{ margin: '0.2rem 0', fontSize: '0.9rem' }}>Parcelle: {arbre.parcelle_nom}</p>
                  <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <button
                      onClick={() => askMoveArbre(arbre)}
                      style={{ padding: '0.5rem', background: '#2196f3', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                    >
                      Deplacer
                    </button>
                    <button
                      onClick={() => askDeleteArbre(arbre)}
                      style={{ padding: '0.5rem', background: '#f44336', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                    >
                      Retirer de la carte
                    </button>
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}

          {/* Nouveau marqueur */}
          {editMode === 'place-arbre' && newArbrePosition && (
            <Marker 
              position={newArbrePosition}
              icon={L.divIcon({
                html: '<div style="background:#ff0000;width:22px;height:22px;border-radius:50%;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.4);"></div>',
                iconSize: [22, 22],
                iconAnchor: [11, 11]
              })}
            />
          )}
        </MapContainer>
      </div>

      {/* Stats */}
      <div className="stats-grid" style={{ marginBottom: '1rem' }}>
        <div className="card">
          <div className="card-title">Parcelles dessinees</div>
          <div className="card-value" style={{ color: '#27ae60' }}>{parcellesAvecGeo.length} / {parcelles.length}</div>
        </div>
        <div className="card">
          <div className="card-title">Arbres places</div>
          <div className="card-value" style={{ color: '#27ae60' }}>{arbresAvecPosition.length} / {arbres.length}</div>
        </div>
        <div className="card">
          <div className="card-title">Reste a faire</div>
          <div className="card-value" style={{ color: '#e74c3c' }}>{parcellesSansGeo.length} parc. / {arbresSansPosition.length} arb.</div>
        </div>
      </div>

      {/* Legende */}
      <div style={{ marginBottom: '1rem', padding: '0.75rem 1rem', background: 'white', borderRadius: '8px', border: '1px solid #ddd' }}>
        <strong>Legende: </strong>
        <span style={{ color: '#27ae60', fontWeight: 'bold', marginLeft: '1rem' }}>● Bon</span>
        <span style={{ color: '#f39c12', fontWeight: 'bold', marginLeft: '0.75rem' }}>● Moyen</span>
        <span style={{ color: '#e74c3c', fontWeight: 'bold', marginLeft: '0.75rem' }}>● Mauvais</span>
        <span style={{ color: '#95a5a6', fontWeight: 'bold', marginLeft: '0.75rem' }}>● Mort</span>
      </div>

      {/* Tableaux */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
        
        {/* Parcelles a dessiner */}
        {parcellesSansGeo.length > 0 && (
          <div className="card" style={{ padding: '1rem' }}>
            <h4 style={{ color: '#e74c3c', marginBottom: '0.75rem', borderBottom: '2px solid #e74c3c', paddingBottom: '0.5rem' }}>
              Parcelles a dessiner ({parcellesSansGeo.length})
            </h4>
            <div style={{ maxHeight: '180px', overflowY: 'auto' }}>
              {parcellesSansGeo.map(p => (
                <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0', borderBottom: '1px solid #eee' }}>
                  <span>○ {p.nom} ({p.surface_ha} ha)</span>
                  <button 
                    onClick={() => { setEditMode('draw-parcelle'); setSelectedParcelle(p.id.toString()); setIsRedrawing(false); }} 
                    style={{ padding: '0.3rem 0.6rem', background: '#4caf50', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                  >
                    Dessiner
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Parcelles dessinees */}
        {parcellesAvecGeo.length > 0 && (
          <div className="card" style={{ padding: '1rem' }}>
            <h4 style={{ color: '#27ae60', marginBottom: '0.75rem', borderBottom: '2px solid #27ae60', paddingBottom: '0.5rem' }}>
              Parcelles dessinees ({parcellesAvecGeo.length})
            </h4>
            <div style={{ maxHeight: '180px', overflowY: 'auto' }}>
              {parcellesAvecGeo.map(p => (
                <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0', borderBottom: '1px solid #eee' }}>
                  <span>● {p.nom}</span>
                  <div style={{ display: 'flex', gap: '0.25rem' }}>
                    <button onClick={() => askRedrawParcelle(p)} style={{ padding: '0.25rem 0.5rem', background: '#ff9800', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem' }}>
                      Redess.
                    </button>
                    <button onClick={() => askDeleteParcelleDessin(p)} style={{ padding: '0.25rem 0.5rem', background: '#f44336', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem' }}>
                      Suppr.
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Arbres a placer */}
        {arbresSansPosition.length > 0 && (
          <div className="card" style={{ padding: '1rem' }}>
            <h4 style={{ color: '#e74c3c', marginBottom: '0.75rem', borderBottom: '2px solid #e74c3c', paddingBottom: '0.5rem' }}>
              Arbres a placer ({arbresSansPosition.length})
            </h4>
            <div style={{ maxHeight: '180px', overflowY: 'auto' }}>
              {arbresSansPosition.slice(0, 20).map(a => (
                <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0', borderBottom: '1px solid #eee' }}>
                  <span>○ {a.numero} <small style={{ color: '#888' }}>({a.parcelle_nom})</small></span>
                  <button 
                    onClick={() => { setEditMode('place-arbre'); setSelectedArbre(a.id.toString()); }} 
                    style={{ padding: '0.3rem 0.6rem', background: '#4caf50', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                  >
                    Placer
                  </button>
                </div>
              ))}
              {arbresSansPosition.length > 20 && <p style={{ color: '#888', textAlign: 'center', marginTop: '0.5rem' }}>+{arbresSansPosition.length - 20} autres</p>}
            </div>
          </div>
        )}

        {/* Arbres places */}
        {arbresAvecPosition.length > 0 && (
          <div className="card" style={{ padding: '1rem' }}>
            <h4 style={{ color: '#27ae60', marginBottom: '0.75rem', borderBottom: '2px solid #27ae60', paddingBottom: '0.5rem' }}>
              Arbres places ({arbresAvecPosition.length})
            </h4>
            <div style={{ maxHeight: '180px', overflowY: 'auto' }}>
              {arbresAvecPosition.slice(0, 20).map(a => (
                <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0', borderBottom: '1px solid #eee' }}>
                  <span>● {a.numero}</span>
                  <div style={{ display: 'flex', gap: '0.25rem' }}>
                    <button onClick={() => askMoveArbre(a)} style={{ padding: '0.25rem 0.5rem', background: '#2196f3', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem' }}>
                      Depl.
                    </button>
                    <button onClick={() => askDeleteArbre(a)} style={{ padding: '0.25rem 0.5rem', background: '#f44336', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem' }}>
                      Retir.
                    </button>
                  </div>
                </div>
              ))}
              {arbresAvecPosition.length > 20 && <p style={{ color: '#888', textAlign: 'center', marginTop: '0.5rem' }}>+{arbresAvecPosition.length - 20} autres</p>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Carte;
