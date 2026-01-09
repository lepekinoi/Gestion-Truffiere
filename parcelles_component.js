import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

function Parcelles() {
  const [parcelles, setParcelles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingParcelle, setEditingParcelle] = useState(null);
  const [formData, setFormData] = useState({
    nom: '',
    surface_ha: '',
    type_sol: '',
    ph_sol: '',
    exposition: '',
    notes: ''
  });

  useEffect(() => {
    loadParcelles();
  }, []);

  const loadParcelles = async () => {
    try {
      const response = await axios.get(`${API_URL}/parcelles`);
      setParcelles(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Erreur lors du chargement des parcelles:', error);
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingParcelle) {
        await axios.put(`${API_URL}/parcelles/${editingParcelle.id}`, formData);
      } else {
        await axios.post(`${API_URL}/parcelles`, formData);
      }
      loadParcelles();
      closeModal();
    } catch (error) {
      console.error('Erreur lors de la sauvegarde:', error);
      alert('Erreur lors de la sauvegarde de la parcelle');
    }
  };

  const handleEdit = (parcelle) => {
    setEditingParcelle(parcelle);
    setFormData({
      nom: parcelle.nom || '',
      surface_ha: parcelle.surface_ha || '',
      type_sol: parcelle.type_sol || '',
      ph_sol: parcelle.ph_sol || '',
      exposition: parcelle.exposition || '',
      notes: parcelle.notes || ''
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer cette parcelle ?')) {
      try {
        await axios.delete(`${API_URL}/parcelles/${id}`);
        loadParcelles();
      } catch (error) {
        console.error('Erreur lors de la suppression:', error);
        alert('Erreur lors de la suppression de la parcelle');
      }
    }
  };

  const openNewModal = () => {
    setEditingParcelle(null);
    setFormData({
      nom: '',
      surface_ha: '',
      type_sol: '',
      ph_sol: '',
      exposition: '',
      notes: ''
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingParcelle(null);
  };

  if (loading) {
    return <div className="loading">Chargement des parcelles...</div>;
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h2>🗺️ Gestion des parcelles</h2>
        <button className="btn btn-primary" onClick={openNewModal}>
          ➕ Nouvelle parcelle
        </button>
      </div>

      {parcelles.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🗺️</div>
          <p>Aucune parcelle enregistrée</p>
          <button className="btn btn-primary" onClick={openNewModal} style={{ marginTop: '1rem' }}>
            Créer ma première parcelle
          </button>
        </div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Nom</th>
              <th>Surface (ha)</th>
              <th>Type de sol</th>
              <th>pH</th>
              <th>Exposition</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {parcelles.map(parcelle => (
              <tr key={parcelle.id}>
                <td><strong>{parcelle.nom}</strong></td>
                <td>{parcelle.surface_ha ? `${parseFloat(parcelle.surface_ha).toFixed(2)} ha` : '-'}</td>
                <td>{parcelle.type_sol || '-'}</td>
                <td>{parcelle.ph_sol || '-'}</td>
                <td>{parcelle.exposition || '-'}</td>
                <td>
                  <button 
                    className="btn btn-secondary" 
                    onClick={() => handleEdit(parcelle)}
                    style={{ marginRight: '0.5rem' }}
                  >
                    ✏️ Modifier
                  </button>
                  <button 
                    className="btn btn-danger" 
                    onClick={() => handleDelete(parcelle.id)}
                  >
                    🗑️ Supprimer
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Modal de création/édition */}
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
                  <input
                    type="text"
                    name="nom"
                    value={formData.nom}
                    onChange={handleInputChange}
                    required
                    placeholder="Ex: Parcelle Nord"
                  />
                </div>

                <div className="form-group">
                  <label>Surface (hectares)</label>
                  <input
                    type="number"
                    name="surface_ha"
                    value={formData.surface_ha}
                    onChange={handleInputChange}
                    step="0.01"
                    placeholder="Ex: 1.5"
                  />
                </div>

                <div className="form-group">
                  <label>Type de sol</label>
                  <select
                    name="type_sol"
                    value={formData.type_sol}
                    onChange={handleInputChange}
                  >
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
                  <input
                    type="number"
                    name="ph_sol"
                    value={formData.ph_sol}
                    onChange={handleInputChange}
                    step="0.1"
                    min="0"
                    max="14"
                    placeholder="Ex: 7.8"
                  />
                </div>

                <div className="form-group">
                  <label>Exposition</label>
                  <select
                    name="exposition"
                    value={formData.exposition}
                    onChange={handleInputChange}
                  >
                    <option value="">Sélectionner...</option>
                    <option value="Nord">Nord</option>
                    <option value="Nord-Est">Nord-Est</option>
                    <option value="Est">Est</option>
                    <option value="Sud-Est">Sud-Est</option>
                    <option value="Sud">Sud</option>
                    <option value="Sud-Ouest">Sud-Ouest</option>
                    <option value="Ouest">Ouest</option>
                    <option value="Nord-Ouest">Nord-Ouest</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Notes</label>
                <textarea
                  name="notes"
                  value={formData.notes}
                  onChange={handleInputChange}
                  placeholder="Informations complémentaires..."
                />
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={closeModal}>
                  Annuler
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingParcelle ? 'Mettre à jour' : 'Créer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Parcelles;