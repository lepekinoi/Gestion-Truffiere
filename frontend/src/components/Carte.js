import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { MapContainer, TileLayer, Marker, Popup, Polygon, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

// Fix pour les icônes Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

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
      width: 20px;
      height: 20px;
      border-radius: 50%;
      border: 2px solid white;
      box-shadow: 0 2px 5px rgba(0,0,0,0.3);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 10px;
    ">🌳</div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
    popupAnchor: [0, -10]
  });
};

// Composant pour gérer les clics sur la carte
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
  const [mapCenter, setMapCenter] = useState([46.1464315, -0.1652445]); // Lusseray
  const [mapZoom, setMapZoom] = useState(14);
  
  // Mode d'édition
  const [editMode, setEditMode] = useState(null); // null, 'draw-parcelle', 'place-arbre'
  const [selectedParcelle, setSelectedParcelle] = useState(null);
  const [drawingPoints, setDrawingPoints] = useState([]);
  const [selectedArbre, setSelectedArbre] = useState(null);
  const [newArbrePosition, setNewArbrePosition] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [parcellesRes, arbresRes] = await Promise.all([
        axios.get(`${API_URL}/parcelles`),
        axios.get(`${API_URL}/arbres`)
      ]);
      setParcelles(parcellesRes.data);
      setArbres(arbresRes.data);
      setLoading(false);
      
      // Centrer sur la première parcelle qui a une géométrie
      const parcelleAvecGeo = parcellesRes.data.find(p => p.coordinates && p.coordinates.length > 0);
      if (parcelleAvecGeo && parcelleAvecGeo.coordinates.length > 0) {
        const firstCoord = parcelleAvecGeo.coordinates[0];
        setMapCenter([firstCoord[0], firstCoord[1]]);
      }
    } catch (error) {
      console.error('Erreur lors du chargement:', error);
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

  const finalizeParcelle = async () => {
    if (drawingPoints.length < 3) {
      alert('Vous devez placer au moins 3 points pour dessiner une parcelle');
      return;
    }
    
    if (!selectedParcelle) {
      alert('Veuillez sélectionner une parcelle');
      return;
    }

    try {
      await axios.put(`${API_URL}/parcelles/${selectedParcelle}`, {
        coordinates: drawingPoints
      });
      
      alert('Parcelle géolocalisée avec succès !');
      setEditMode(null);
      setDrawingPoints([]);
      setSelectedParcelle(null);
      loadData();
    } catch (error) {
      console.error('Erreur:', error);
      alert('Erreur lors de la sauvegarde');
    }
  };

  const finalizeArbre = async () => {
    if (!newArbrePosition) {
      alert('Cliquez sur la carte pour placer l\'arbre');
      return;
    }
    
    if (!selectedArbre) {
      alert('Veuillez sélectionner un arbre');
      return;
    }

    try {
      const arbre = arbres.find(a => a.id === parseInt(selectedArbre));
      await axios.put(`${API_URL}/arbres/${selectedArbre}`, {
        ...arbre,
        latitude: newArbrePosition[0],
        longitude: newArbrePosition[1]
      });
      
      alert('Arbre placé avec succès !');
      setEditMode(null);
      setNewArbrePosition(null);
      setSelectedArbre(null);
      loadData();
    } catch (error) {
      console.error('Erreur:', error);
      alert('Erreur lors de la sauvegarde');
    }
  };

  const cancelEdit = () => {
    setEditMode(null);
    setDrawingPoints([]);
    setSelectedParcelle(null);
    setNewArbrePosition(null);
    setSelectedArbre(null);
  };

  // Stats
  const parcellesAvecGeo = parcelles.filter(p => p.coordinates && p.coordinates.length > 0);
  const parcellesSansGeo = parcelles.filter(p => !p.coordinates || p.coordinates.length === 0);
  const arbresAvecPosition = arbres.filter(a => a.latitude && a.longitude);
  const arbresSansPosition = arbres.filter(a => !a.latitude || !a.longitude);

  if (loading) {
    return <div className="loading">Chargement de la carte...</div>;
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h2>🗺️ Cartographie de la truffière</h2>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {!editMode && (
            <>
              <button 
                className="btn btn-primary"
                onClick={() => setEditMode('draw-parcelle')}
              >
                📐 Dessiner une parcelle
              </button>
              <button 
                className="btn btn-secondary"
                onClick={() => setEditMode('place-arbre')}
              >
                🌳 Placer un arbre
              </button>
            </>
          )}
          {editMode && (
            <button 
              className="btn btn-danger"
              onClick={cancelEdit}
            >
              ❌ Annuler
            </button>
          )}
        </div>
      </div>

      {/* Instructions selon le mode */}
      {editMode === 'draw-parcelle' && (
        <div style={{
          background: '#e3f2fd',
          padding: '1rem',
          borderRadius: '8px',
          marginBottom: '1rem',
          border: '2px solid #1565c0'
        }}>
          <strong>📐 Mode dessin de parcelle</strong>
          <p style={{ margin: '0.5rem 0' }}>
            1. Cliquez sur la carte pour placer les coins de votre parcelle<br/>
            2. Le polygone se ferme automatiquement<br/>
            3. Points placés : <strong>{drawingPoints.length}</strong>
          </p>
          
          <div className="form-group" style={{ marginTop: '1rem' }}>
            <label>Sélectionner la parcelle à géolocaliser :</label>
            <select
              value={selectedParcelle || ''}
              onChange={(e) => setSelectedParcelle(e.target.value)}
              style={{ width: '100%', padding: '0.7rem', borderRadius: '8px', border: '2px solid #e0e0e0' }}
            >
              <option value="">-- Choisir une parcelle --</option>
              {parcellesSansGeo.map(parcelle => (
                <option key={parcelle.id} value={parcelle.id}>
                  {parcelle.nom} ({parcelle.surface_ha} ha)
                </option>
              ))}
            </select>
          </div>

          <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
            <button 
              className="btn btn-primary"
              onClick={finalizeParcelle}
              disabled={drawingPoints.length < 3 || !selectedParcelle}
            >
              ✅ Valider la parcelle
            </button>
            <button 
              className="btn btn-secondary"
              onClick={() => setDrawingPoints([])}
            >
              🔄 Recommencer
            </button>
          </div>
        </div>
      )}

      {editMode === 'place-arbre' && (
        <div style={{
          background: '#f0f7f0',
          padding: '1rem',
          borderRadius: '8px',
          marginBottom: '1rem',
          border: '2px solid #2c5f2d'
        }}>
          <strong>🌳 Mode placement d'arbre</strong>
          <p style={{ margin: '0.5rem 0' }}>
            Cliquez sur la carte pour placer l'arbre (idéalement dans une parcelle)
          </p>
          
          <div className="form-group" style={{ marginTop: '1rem' }}>
            <label>Sélectionner l'arbre à placer :</label>
            <select
              value={selectedArbre || ''}
              onChange={(e) => setSelectedArbre(e.target.value)}
              style={{ width: '100%', padding: '0.7rem', borderRadius: '8px', border: '2px solid #e0e0e0' }}
            >
              <option value="">-- Choisir un arbre --</option>
              {arbresSansPosition.map(arbre => (
                <option key={arbre.id} value={arbre.id}>
                  {arbre.numero} - {arbre.espece} ({arbre.parcelle_nom})
                </option>
              ))}
            </select>
          </div>

          {newArbrePosition && (
            <p style={{ margin: '0.5rem 0', color: '#27ae60' }}>
              📍 Position : {newArbrePosition[0].toFixed(6)}, {newArbrePosition[1].toFixed(6)}
            </p>
          )}

          <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
            <button 
              className="btn btn-primary"
              onClick={finalizeArbre}
              disabled={!newArbrePosition || !selectedArbre}
            >
              ✅ Valider la position
            </button>
            <button 
              className="btn btn-secondary"
              onClick={() => setNewArbrePosition(null)}
            >
              🔄 Replacer
            </button>
          </div>
        </div>
      )}

      {/* Statistiques */}
      <div className="card-grid" style={{ marginBottom: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
        <div className="card">
          <div className="card-title">Parcelles sur carte</div>
          <div className="card-value" style={{ color: '#27ae60' }}>{parcellesAvecGeo.length}/{parcelles.length}</div>
        </div>
        <div className="card">
          <div className="card-title">Arbres placés</div>
          <div className="card-value" style={{ color: '#27ae60' }}>{arbresAvecPosition.length}/{arbres.length}</div>
        </div>
        <div className="card">
          <div className="card-title">À géolocaliser</div>
          <div className="card-value" style={{ color: '#e74c3c' }}>
            {parcellesSansGeo.length} parcelles, {arbresSansPosition.length} arbres
          </div>
        </div>
      </div>

      {/* Légende */}
      <div style={{ 
        marginBottom: '1rem', 
        padding: '1rem', 
        background: 'white', 
        borderRadius: '8px',
        border: '1px solid #e0e0e0'
      }}>
        <strong>Légende : </strong>
        <span style={{ marginLeft: '1rem' }}>
          <span style={{ color: '#27ae60', fontWeight: 'bold' }}>● Bon</span>
          <span style={{ marginLeft: '1rem', color: '#f39c12', fontWeight: 'bold' }}>● Moyen</span>
          <span style={{ marginLeft: '1rem', color: '#e74c3c', fontWeight: 'bold' }}>● Mauvais</span>
          <span style={{ marginLeft: '1rem', color: '#95a5a6', fontWeight: 'bold' }}>● Mort</span>
        </span>
      </div>

      {/* Carte */}
      <div style={{ 
        height: '600px', 
        borderRadius: '12px', 
        overflow: 'hidden',
        border: '2px solid #e0e0e0',
        marginBottom: '2rem'
      }}>
        <MapContainer 
          center={mapCenter} 
          zoom={mapZoom} 
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          />
          
          <MapClickHandler onMapClick={handleMapClick} mode={editMode} />
          
          {/* Afficher les parcelles géolocalisées */}
          {parcellesAvecGeo.map(parcelle => (
            <Polygon 
              key={parcelle.id}
              positions={parcelle.coordinates}
              pathOptions={{
                color: '#2c5f2d',
                fillColor: '#97bc62',
                fillOpacity: 0.3,
                weight: 3
              }}
            >
              <Popup>
                <div>
                  <h3 style={{ margin: '0 0 0.5rem 0', color: '#2c5f2d' }}>
                    {parcelle.nom}
                  </h3>
                  <p style={{ margin: '0.25rem 0' }}>
                    <strong>Surface :</strong> {parcelle.surface_ha} ha
                  </p>
                  {parcelle.type_sol && (
                    <p style={{ margin: '0.25rem 0' }}>
                      <strong>Sol :</strong> {parcelle.type_sol}
                    </p>
                  )}
                  {parcelle.ph_sol && (
                    <p style={{ margin: '0.25rem 0' }}>
                      <strong>pH :</strong> {parcelle.ph_sol}
                    </p>
                  )}
                </div>
              </Popup>
            </Polygon>
          ))}

          {/* Polygone en cours de dessin */}
          {editMode === 'draw-parcelle' && drawingPoints.length > 0 && (
            <Polygon 
              positions={drawingPoints}
              pathOptions={{
                color: '#1565c0',
                fillColor: '#64b5f6',
                fillOpacity: 0.4,
                weight: 2,
                dashArray: '5, 5'
              }}
            />
          )}

          {/* Afficher les arbres géolocalisés */}
          {arbresAvecPosition.map(arbre => (
            <Marker 
              key={arbre.id} 
              position={[arbre.latitude, arbre.longitude]}
              icon={createArbreIcon(arbre.etat)}
            >
              <Popup>
                <div style={{ minWidth: '180px' }}>
                  <h4 style={{ margin: '0 0 0.5rem 0', color: '#2c5f2d' }}>
                    🌳 {arbre.numero}
                  </h4>
                  <p style={{ margin: '0.25rem 0', fontSize: '0.9rem' }}>
                    <strong>Espèce :</strong> {arbre.espece}
                  </p>
                  <p style={{ margin: '0.25rem 0', fontSize: '0.9rem' }}>
                    <strong>Parcelle :</strong> {arbre.parcelle_nom}
                  </p>
                  <p style={{ margin: '0.25rem 0', fontSize: '0.9rem' }}>
                    <strong>État :</strong> <span style={{ 
                      color: arbre.etat === 'Bon' ? '#27ae60' : 
                             arbre.etat === 'Moyen' ? '#f39c12' : 
                             arbre.etat === 'Mauvais' ? '#e74c3c' : '#95a5a6'
                    }}>{arbre.etat}</span>
                  </p>
                  {arbre.variete_truffe && (
                    <p style={{ margin: '0.25rem 0', fontSize: '0.9rem' }}>
                      <strong>Truffe :</strong> {arbre.variete_truffe}
                    </p>
                  )}
                </div>
              </Popup>
            </Marker>
          ))}

          {/* Marqueur temporaire pour le nouvel arbre */}
          {editMode === 'place-arbre' && newArbrePosition && (
            <Marker 
              position={newArbrePosition}
              icon={L.divIcon({
                className: 'temp-marker',
                html: '<div style="background: red; width: 25px; height: 25px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.5); animation: pulse 1s infinite;"></div>',
                iconSize: [25, 25],
                iconAnchor: [12, 12]
              })}
            >
              <Popup>
                <strong>📍 Nouvelle position</strong>
              </Popup>
            </Marker>
          )}
        </MapContainer>
      </div>

      {/* Listes des éléments à géolocaliser */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
        {/* Parcelles sans géolocalisation */}
        {parcellesSansGeo.length > 0 && (
          <div>
            <h3 style={{ color: '#2c5f2d', marginBottom: '1rem' }}>
              ⚠️ Parcelles à dessiner ({parcellesSansGeo.length})
            </h3>
            <table>
              <thead>
                <tr>
                  <th>Nom</th>
                  <th>Surface</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {parcellesSansGeo.map(parcelle => (
                  <tr key={parcelle.id}>
                    <td><strong>{parcelle.nom}</strong></td>
                    <td>{parcelle.surface_ha} ha</td>
                    <td>
                      <button 
                        className="btn btn-secondary"
                        onClick={() => {
                          setEditMode('draw-parcelle');
                          setSelectedParcelle(parcelle.id.toString());
                        }}
                        style={{ padding: '0.4rem 0.8rem' }}
                      >
                        📐 Dessiner
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Arbres sans position */}
        {arbresSansPosition.length > 0 && (
          <div>
            <h3 style={{ color: '#2c5f2d', marginBottom: '1rem' }}>
              ⚠️ Arbres à placer ({arbresSansPosition.length})
            </h3>
            <table>
              <thead>
                <tr>
                  <th>Numéro</th>
                  <th>Parcelle</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {arbresSansPosition.slice(0, 10).map(arbre => (
                  <tr key={arbre.id}>
                    <td><strong>{arbre.numero}</strong></td>
                    <td>{arbre.parcelle_nom}</td>
                    <td>
                      <button 
                        className="btn btn-secondary"
                        onClick={() => {
                          setEditMode('place-arbre');
                          setSelectedArbre(arbre.id.toString());
                        }}
                        style={{ padding: '0.4rem 0.8rem' }}
                      >
                        🌳 Placer
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {arbresSansPosition.length > 10 && (
              <p style={{ color: '#666', marginTop: '0.5rem', fontSize: '0.9rem' }}>
                ... et {arbresSansPosition.length - 10} autres arbres
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default Carte;