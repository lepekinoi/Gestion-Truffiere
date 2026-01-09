import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

function Arbres() {
  const [arbres, setArbres] = useState([]);
  const [parcelles, setParcelles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingArbre, setEditingArbre] = useState(null);
  const [formData, setFormData] = useState({
    parcelle_id: '',
    numero: '',
    espece: '',
    variete_truffe: '',
    date_plantation: '',
    etat: 'Bon',
    circonference_cm: '',
    hauteur_m: '',
    notes: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [arbresRes, parcellesRes] = await Promise.all([
        axios.get(`${API_URL}/arbres`),
        axios.get(`${API_URL}/parcelles`)
      ]);
      setArbres(arbresRes.data);
      setParcelles(parcellesRes.data);
      setLoading(false);
    } catch (error) {
      console.error('Erreur lors du chargement:', error);
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
      if (editingArbre) {
        await axios.put(`${API_URL}/arbres/${editingArbre.id}`, formData);
      } else {
        await axios.post(`${API_URL}/arbres`, formData);
      }
      loadData();
      closeModal();
    } catch (error) {
      console.error('Erreur lors de la sauvegarde:', error);
      alert('Erreur lors de la sauvegarde de l\'arbre');
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
      notes: arbre.notes || ''
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer cet arbre ?')) {
      try {
        await axios.delete(`${API_URL}/arbres/${id}`);
        loadData();
      } catch (error) {
        console.error('Erreur lors de la suppression:', error);
        alert('Erreur lors de la suppression de l\'arbre');
      }
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
      notes: ''
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingArbre(null);
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

  if (loading) {
    return <div className="loading">Chargement des arbres...</div>;
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h2>🌳 Gestion des arbres truffiers</h2>
        <button className="btn btn-primary" onClick={openNewModal}>
          ➕ Nouvel arbre
        </button>
      </div>

      {/* Statistiques rapides */}
      <div className="card-grid" style={{ marginBottom: '2rem', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
        <div className="card">
          <div className="card-title">Total arbres</div>
          <div className="card-value">{arbres.length}</div>
        </div>
        <div className="card">
          <div className="card-title">État Bon</div>
          <div className="card-value" style={{ color: '#27ae60' }}>
            {arbres.filter(a => a.etat === 'Bon').length}
          </div>
        </div>
        <div className="card">
          <div className="card-title">État Moyen</div>
          <div className="card-value" style={{ color: '#f39c12' }}>
            {arbres.filter(a => a.etat === 'Moyen').length}
          </div>
        </div>
        <div className="card">
          <div className="card-title">À surveiller</div>
          <div className="card-value" style={{ color: '#e74c3c' }}>
            {arbres.filter(a => a.etat === 'Mauvais' || a.etat === 'Mort').length}
          </div>
        </div>
      </div>

      {arbres.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🌳</div>
          <p>Aucun arbre enregistré</p>
          <button className="btn btn-primary" onClick={openNewModal} style={{ marginTop: '1rem' }}>
            Planter mon premier arbre
          </button>
        </div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Numéro</th>
              <th>Parcelle</th>
              <th>Espèce</th>
              <th>Variété truffe</th>
              <th>Date plantation</th>
              <th>Âge</th>
              <th>État</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {arbres.map(arbre => {
              const age = arbre.date_plantation 
                ? new Date().getFullYear() - new Date(arbre.date_plantation).getFullYear()
                : '-';
              
              return (
                <tr key={arbre.id}>
                  <td><strong>{arbre.numero}</strong></td>
                  <td>{arbre.parcelle_nom || '-'}</td>
                  <td>{arbre.espece}</td>
                  <td>{arbre.variete_truffe || '-'}</td>
                  <td>{new Date(arbre.date_plantation).toLocaleDateString('fr-FR')}</td>
                  <td>{age} {age !== '-' && 'ans'}</td>
                  <td>
                    <span style={{
                      padding: '0.25rem 0.75rem',
                      borderRadius: '12px',
                      fontSize: '0.85rem',
                      fontWeight: '500',
                      ...getEtatBadgeStyle(arbre.etat)
                    }}>
                      {arbre.etat}
                    </span>
                  </td>
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
                      onClick={() => handleDelete(arbre.id)}
                      style={{ padding: '0.4rem 0.8rem' }}
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

      {/* Modal de création/édition */}
      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingArbre ? 'Modifier l\'arbre' : 'Nouvel arbre truffier'}</h3>
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
                      <option key={parcelle.id} value={parcelle.id}>
                        {parcelle.nom}
                      </option>
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
                    placeholder="Ex: A001, B012"
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
                    <option value="Chêne pubescent">Chêne pubescent</option>
                    <option value="Chêne vert">Chêne vert</option>
                    <option value="Chêne pédonculé">Chêne pédonculé</option>
                    <option value="Noisetier">Noisetier</option>
                    <option value="Tilleul">Tilleul</option>
                    <option value="Charme">Charme</option>
                    <option value="Autre">Autre</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Variété de truffe</label>
                  <select
                    name="variete_truffe"
                    value={formData.variete_truffe}
                    onChange={handleInputChange}
                  >
                    <option value="">Sélectionner...</option>
                    <option value="Tuber melanosporum">Tuber melanosporum (Truffe noire)</option>
                    <option value="Tuber aestivum">Tuber aestivum (Truffe d'été)</option>
                    <option value="Tuber uncinatum">Tuber uncinatum (Truffe de Bourgogne)</option>
                    <option value="Tuber brumale">Tuber brumale (Truffe brumale)</option>
                    <option value="Autre">Autre</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Date de plantation *</label>
                  <input
                    type="date"
                    name="date_plantation"
                    value={formData.date_plantation}
                    onChange={handleInputChange}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>État *</label>
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

              <div className="form-group">
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
                <button type="submit" className="btn btn-primary">
                  {editingArbre ? 'Mettre à jour' : 'Créer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Arbres;