import React from 'react';
import { MapContainer, TileLayer, Marker, Polygon, LayersControl } from 'react-leaflet';
import { arbreIcon } from './ArbresMapPicker';
import MapClickHandler from './ArbresMapPicker';
import MapController from './ArbresMapPicker';

export default function ArbresFormModal({
  show,
  onClose,
  formData,
  setFormData,
  parcelles,
  selectedParcelleCoords,
  setSelectedParcelleCoords,
  mapCenter,
  setMapCenter,
  mapKey,
  setMapKey,
  showMap,
  setShowMap,
  handleInputChange,
  handleMapClick,
  clearPosition,
  getSelectedParcelleName,
  onSubmit
}) {
  if (!show) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '700px' }}>
        
        <div className="modal-header">
          <h3>{formData.id ? 'Modifier l’arbre' : 'Nouvel arbre'}</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); onSubmit(formData, formData.id, onClose); }}>
          
          {/* GRID FORM */}
          <div className="form-grid">
            <div className="form-group">
              <label>Parcelle *</label>
              <select name="parcelle_id" value={formData.parcelle_id} onChange={handleInputChange} required>
                <option value="">Sélectionner...</option>
                {parcelles.map(p => (
                  <option key={p.id} value={p.id}>{p.nom}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Numéro *</label>
              <input type="text" name="numero" value={formData.numero} onChange={handleInputChange} required />
            </div>

            <div className="form-group">
              <label>Espèce *</label>
              <select name="espece" value={formData.espece} onChange={handleInputChange} required>
                <option value="">Sélectionner...</option>
                <option value="Chênes vert (V)">Chênes vert (V)</option>
                <option value="Chêne pubescent (P)">Chêne pubescent (P)</option>
                <option value="Chênes Cerris (Cé)">Chênes Cerris (Cé)</option>
                <option value="Chêne pédonculé">Chêne pédonculé</option>
                <option value="Noisetier">Noisetier</option>
                <option value="Charmes (C)">Charmes (C)</option>
                <option value="Tilleul">Tilleul</option>
                <option value="Pin">Pin</option>
              </select>
            </div>

            <div className="form-group">
              <label>Variété</label>
              <select name="variete_truffe" value={formData.variete_truffe} onChange={handleInputChange}>
                <option value="">Sélectionner...</option>
                <option value="Tuber melanosporum">Tuber melanosporum</option>
                <option value="Tuber aestivum">Tuber aestivum</option>
                <option value="Tuber brumale">Tuber brumale</option>
                <option value="Tuber uncinatum">Tuber uncinatum</option>
              </select>
            </div>

            <div className="form-group">
              <label>Date plantation</label>
              <input type="date" name="date_plantation" value={formData.date_plantation} onChange={handleInputChange} />
            </div>

            <div className="form-group">
              <label>Porte-greffe</label>
              <input type="text" name="porte_greffe" value={formData.porte_greffe} onChange={handleInputChange} placeholder="Ex: Noisetier, Chêne..." />
            </div>

            <div className="form-group">
              <label>Rendement estimé (kg)</label>
              <input type="number" name="rendement_estimé" value={formData.rendement_estimé} onChange={handleInputChange} step="0.1" />
            </div>

            <div className="form-group">
              <label>Circonférence (cm)</label>
              <input type="number" name="circonference_cm" value={formData.circonference_cm} onChange={handleInputChange} step="0.1" />
            </div>

            <div className="form-group">
              <label>Hauteur (m)</label>
              <input type="number" name="hauteur_m" value={formData.hauteur_m} onChange={handleInputChange} step="0.1" />
            </div>
          </div>

          {/* GEOLOC */}
          <div style={{ marginTop: '1rem', padding: '1rem', background: '#f8f9fa', borderRadius: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <label style={{ fontWeight: '600' }}>📍 Géolocalisation</label>
              <button type="button" className="btn btn-secondary" onClick={() => setShowMap(!showMap)}>
                {showMap ? 'Masquer carte' : 'Afficher carte'}
              </button>
            </div>

            {showMap && (
              <div style={{ marginTop: '0.75rem' }}>
                <div style={{ height: '350px', borderRadius: '8px', overflow: 'hidden' }}>
                  <MapContainer key={mapKey} center={mapCenter} zoom={16} style={{ height: '100%', width: '100%' }}>
                    <LayersControl position="topright">
                      <LayersControl.BaseLayer checked name="Satellite">
                        <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" />
                      </LayersControl.BaseLayer>
                      <LayersControl.BaseLayer name="Plan">
                        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                      </LayersControl.BaseLayer>
                    </LayersControl>

                    <MapController bounds={selectedParcelleCoords} center={mapCenter} arbrePosition={formData.latitude && formData.longitude ? [parseFloat(formData.latitude), parseFloat(formData.longitude)] : null} />

                    <MapClickHandler onMapClick={handleMapClick} />

                    {selectedParcelleCoords && (
                      <Polygon positions={selectedParcelleCoords} pathOptions={{ color: '#ffff00', weight: 3, fillOpacity: 0.25 }} />
                    )}

                    {formData.latitude && formData.longitude && (
                      <Marker position={[parseFloat(formData.latitude), parseFloat(formData.longitude)]} icon={arbreIcon} />
                    )}
                  </MapContainer>
                </div>
              </div>
            )}
          </div>

          {/* NOTES */}
          <div className="form-group" style={{ marginTop: '1rem' }}>
            <label>Notes</label>
            <textarea name="notes" value={formData.notes} onChange={handleInputChange} rows="4" />
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Annuler</button>
            <button type="submit" className="btn btn-primary">
              {formData.id ? 'Mettre à jour' : 'Créer'}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
