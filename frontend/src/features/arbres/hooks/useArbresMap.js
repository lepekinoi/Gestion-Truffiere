import { useState } from 'react';

const DEFAULT_CENTER = [46.1464315, -0.1652445];
const DEFAULT_ZOOM = 16;

export default function useArbresMap({ parcelles }) {
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

  const [selectedParcelleCoords, setSelectedParcelleCoords] = useState(null);
  const [mapCenter, setMapCenter] = useState(DEFAULT_CENTER);
  const [mapZoom, setMapZoom] = useState(DEFAULT_ZOOM);
  const [mapKey, setMapKey] = useState(0);
  const [showMap, setShowMap] = useState(false);

  const handleParcelleChange = (parcelleId) => {
    setFormData(prev => ({ ...prev, parcelle_id: parcelleId }));
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
      handleParcelleChange(value);
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleMapClick = (latlng) => {
    setFormData(prev => ({
      ...prev,
      latitude: latlng.lat.toFixed(7),
      longitude: latlng.lng.toFixed(7)
    }));
  };

  const clearPosition = () => {
    setFormData(prev => ({ ...prev, latitude: '', longitude: '' }));
  };

  const getSelectedParcelleName = () => {
    if (!formData.parcelle_id) return null;
    const parcelle = parcelles.find(p => p.id === parseInt(formData.parcelle_id));
    return parcelle ? parcelle.nom : null;
  };

  return {
    formData,
    setFormData,
    selectedParcelleCoords,
    setSelectedParcelleCoords,
    mapCenter,
    setMapCenter,
    mapZoom,
    setMapZoom,
    mapKey,
    setMapKey,
    showMap,
    setShowMap,
    handleInputChange,
    handleMapClick,
    clearPosition,
    getSelectedParcelleName,
    DEFAULT_CENTER,
    DEFAULT_ZOOM
  };
}
