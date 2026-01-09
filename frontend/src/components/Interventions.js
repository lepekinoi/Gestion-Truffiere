import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

function Interventions() {
  const [interventions, setInterventions] = useState([]);
  const [parcelles, setParcelles] = useState([]);
  const [arbres, setArbres] = useState([]);
  const [typesIntervention, setTypesIntervention] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingIntervention, setEditingIntervention] = useState(null);
  const [filterStatut, setFilterStatut] = useState('all');
  const [formData, setFormData] = useState({
    type_intervention_id: '',
    parcelle_id: '',
    arbre_id: '',
    date_prevue: '',
    date_realisee: '',
    duree_minutes: '',
    personnel: '',
    description: '',
    cout: '',
    statut: 'Planifié',
    meteo: '',
    notes: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [interventionsRes, parcellesRes, arbresRes, typesRes] = await Promise.all([
        axios.get(`${API_URL}/interventions`),
        axios.get(`${API_URL}/parcelles`),
        axios.get(`${API_URL}/arbres`),
        axios.get(`${API_URL}/types-intervention`)
      ]);
      setInterventions(interventionsRes.data);
      setParcelles(parcellesRes.data);
      setArbres(arbresRes.data);
      setTypesIntervention(typesRes.data);
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
      // Nettoyer les champs vides
      const dataToSend = { ...formData };
      if (!dataToSend.arbre_id) dataToSend.arbre_id = null;
      if (!dataToSend.date_realisee) dataToSend.date_realisee = null;
      if (!dataToSend.duree_minutes) dataToSend.duree_minutes = null;
      if (!dataToSend.cout) dataToSend.cout = null;

      if (editingIntervention) {
        await axios.put(`${API_URL}/interventions/${editingIntervention.id}`, dataToSend);
      } else {
        await axios.post(`${API_URL}/interventions`, dataToSend);
      }
      loadData();
      closeModal();
    } catch (error) {
      console.error('Erreur lors de la sauvegarde:', error);
      alert('Erreur lors de la sauvegarde de l\'intervention');
    }
  };

  const handleEdit = (intervention) => {
    setEditingIntervention(intervention);
    setFormData({
      type_intervention_id: intervention.type_intervention_id || '',
      parcelle_id: intervention.parcelle_id || '',
      arbre_id: intervention.arbre_id || '',
      date_prevue: intervention.date_prevue ? intervention.date_prevue.split('T')[0] : '',
      date_realisee: intervention.date_realisee ? intervention.date_realisee.split('T')[0] : '',
      duree_minutes: intervention.duree_minutes || '',
      personnel: intervention.personnel || '',
      description: intervention.description || '',
      cout: intervention.cout || '',
      statut: intervention.statut || 'Planifié',
      meteo: intervention.meteo || '',
      notes: intervention.notes || ''
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer cette intervention ?')) {
      try {
        await axios.delete(`${API_URL}/interventions/${id}`);
        loadData();
      } catch (error) {
        console.error('Erreur lors de la suppression:', error);
        alert('Erreur lors de la suppression de l\'intervention');
      }
    }
  };

  const openNewModal = () => {
    setEditingIntervention(null);
    const today = new Date().toISOString().split('T')[0];
    setFormData({
      type_intervention_id: '',
      parcelle_id: '',
      arbre_id: '',
      date_prevue: today,
      date_realisee: '',
      duree_minutes: '',
      personnel: '',
      description: '',
      cout: '',
      statut: 'Planifié',
      meteo: '',
      notes: ''
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingIntervention(null);
  };

  const getStatutBadgeStyle = (statut) => {
    const styles = {
      'Planifié': { background: '#e3f2fd', color: '#1565c0' },
      'En cours': { background: '#fff3e0', color: '#e65100' },
      'Terminé': { background: '#d4edda', color: '#155724' },
      'Annulé': { background: '#f8d7da', color: '#721c24' }
    };
    return styles[statut] || styles['Planifié'];
  };

  const isInterventionPast = (datePrevue) => {
    return new Date(datePrevue) < new Date();
  };

  const filteredInterventions = interventions.filter(intervention => {
    if (filterStatut === 'all') return true;
    return intervention.statut === filterStatut;
  });

  if (loading) {
    return <div className="loading">Chargement des interventions...</div>;
  }

  const stats = {
    total: interventions.length,
    planifie: interventions.filter(i => i.statut === 'Planifié').length,
    enCours: interventions.filter(i => i.statut === 'En cours').length,
    termine: interventions.filter(i => i.statut === 'Terminé').length,
    enRetard: interventions.filter(i => i.statut === 'Planifié' && isInterventionPast(i.date_prevue)).length
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h2>🛠️ Planning des interventions</h2>
        <button className="btn btn-primary" onClick={openNewModal}>
          ➕ Nouvelle intervention
        </button>
      </div>

      {/* Statistiques */}
      <div className="card-grid" style={{ marginBottom: '2rem', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
        <div className="card">
          <div className="card-title">Total</div>
          <div className="card-value">{stats.total}</div>
        </div>
        <div className="card">
          <div className="card-title">Planifiées</div>
          <div className="card-value" style={{ color: '#1565c0' }}>{stats.planifie}</div>
        </div>
        <div className="card">
          <div className="card-title">En cours</div>
          <div className="card-value" style={{ color: '#e65100' }}>{stats.enCours}</div>
        </div>
        <div className="card">
          <div className="card-title">Terminées</div>
          <div className="card-value" style={{ color: '#155724' }}>{stats.termine}</div>
        </div>
        <div className="card">
          <div className="card-title">En retard</div>
          <div className="card-value" style={{ color: '#e74c3c' }}>{stats.enRetard}</div>
        </div>
      </div>

      {/* Filtres */}
      <div style={{ marginBottom: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <button 
          className={`btn ${filterStatut === 'all' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setFilterStatut('all')}
          style={{ padding: '0.5rem 1rem' }}
        >
          Toutes
        </button>
        <button 
          className={`btn ${filterStatut === 'Planifié' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setFilterStatut('Planifié')}
          style={{ padding: '0.5rem 1rem' }}
        >
          Planifiées
        </button>
        <button 
          className={`btn ${filterStatut === 'En cours' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setFilterStatut('En cours')}
          style={{ padding: '0.5rem 1rem' }}
        >
          En cours
        </button>
        <button 
          className={`btn ${filterStatut === 'Terminé' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setFilterStatut('Terminé')}
          style={{ padding: '0.5rem 1rem' }}
        >
          Terminées
        </button>
      </div>

      {filteredInterventions.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🛠️</div>
          <p>Aucune intervention {filterStatut !== 'all' && `avec le statut "${filterStatut}"`}</p>
          <button className="btn btn-primary" onClick={openNewModal} style={{ marginTop: '1rem' }}>
            Planifier une intervention
          </button>
        </div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Date prévue</th>
              <th>Type</th>
              <th>Parcelle</th>
              <th>Arbre</th>
              <th>Statut</th>
              <th>Personnel</th>
              <th>Description</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredInterventions.map(intervention => {
              const isPast = isInterventionPast(intervention.date_prevue);
              const isLate = intervention.statut === 'Planifié' && isPast;
              
              return (
                <tr key={intervention.id} style={isLate ? { backgroundColor: '#fff3cd' } : {}}>
                  <td>
                    <strong>{new Date(intervention.date_prevue).toLocaleDateString('fr-FR')}</strong>
                    {isLate && <span style={{ color: '#e74c3c', marginLeft: '0.5rem' }}>⚠️ En retard</span>}
                  </td>
                  <td>
                    <span style={{
                      display: 'inline-block',
                      padding: '0.25rem 0.5rem',
                      borderRadius: '4px',
                      backgroundColor: intervention.type_couleur || '#ccc',
                      color: 'white',
                      fontSize: '0.85rem',
                      fontWeight: '500'
                    }}>
                      {intervention.type_nom}
                    </span>
                  </td>
                  <td>{intervention.parcelle_nom || '-'}</td>
                  <td>{intervention.arbre_numero || '-'}</td>
                  <td>
                    <span style={{
                      padding: '0.25rem 0.75rem',
                      borderRadius: '12px',
                      fontSize: '0.85rem',
                      fontWeight: '500',
                      ...getStatutBadgeStyle(intervention.statut)
                    }}>
                      {intervention.statut}
                    </span>
                  </td>
                  <td>{intervention.personnel || '-'}</td>
                  <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {intervention.description || '-'}
                  </td>
                  <td>
                    <button 
                      className="btn btn-secondary" 
                      onClick={() => handleEdit(intervention)}
                      style={{ marginRight: '0.5rem', padding: '0.4rem 0.8rem' }}
                    >
                      ✏️
                    </button>
                    <button 
                      className="btn btn-danger" 
                      onClick={() => handleDelete(intervention.id)}
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
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '700px' }}>
            <div className="modal-header">
              <h3>{editingIntervention ? 'Modifier l\'intervention' : 'Nouvelle intervention'}</h3>
              <button className="modal-close" onClick={closeModal}>✕</button>
            </div>
            
            <form onSubmit={handleSubmit}>
              <div className="form-grid">
                <div className="form-group">
                  <label>Type d'intervention *</label>
                  <select
                    name="type_intervention_id"
                    value={formData.type_intervention_id}
                    onChange={handleInputChange}
                    required
                  >
                    <option value="">Sélectionner...</option>
                    {typesIntervention.map(type => (
                      <option key={type.id} value={type.id}>
                        {type.nom}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Parcelle *</label>
                  <select
                    name="parcelle_id"
                    value={formData.parcelle_id}
                    onChange={handleInputChange}
                    required
                  >
                    <option value="">Sélectionner...</option>
                    {parcelles.map(parcelle => (
                      <option key={parcelle.id} value={parcelle.id}>
                        {parcelle.nom}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Arbre spécifique (optionnel)</label>
                  <select
                    name="arbre_id"
                    value={formData.arbre_id}
                    onChange={handleInputChange}
                  >
                    <option value="">Tous les arbres de la parcelle</option>
                    {arbres
                      .filter(a => !formData.parcelle_id || a.parcelle_id == formData.parcelle_id)
                      .map(arbre => (
                        <option key={arbre.id} value={arbre.id}>
                          {arbre.numero} - {arbre.espece}
                        </option>
                      ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Date prévue *</label>
                  <input
                    type="date"
                    name="date_prevue"
                    value={formData.date_prevue}
                    onChange={handleInputChange}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Date de réalisation</label>
                  <input
                    type="date"
                    name="date_realisee"
                    value={formData.date_realisee}
                    onChange={handleInputChange}
                  />
                </div>

                <div className="form-group">
                  <label>Statut *</label>
                  <select
                    name="statut"
                    value={formData.statut}
                    onChange={handleInputChange}
                    required
                  >
                    <option value="Planifié">Planifié</option>
                    <option value="En cours">En cours</option>
                    <option value="Terminé">Terminé</option>
                    <option value="Annulé">Annulé</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Durée (minutes)</label>
                  <input
                    type="number"
                    name="duree_minutes"
                    value={formData.duree_minutes}
                    onChange={handleInputChange}
                    placeholder="Ex: 120"
                  />
                </div>

                <div className="form-group">
                  <label>Personnel</label>
                  <input
                    type="text"
                    name="personnel"
                    value={formData.personnel}
                    onChange={handleInputChange}
                    placeholder="Nom(s) des personnes"
                  />
                </div>

                <div className="form-group">
                  <label>Coût (€)</label>
                  <input
                    type="number"
                    name="cout"
                    value={formData.cout}
                    onChange={handleInputChange}
                    step="0.01"
                    placeholder="Ex: 150.00"
                  />
                </div>

                <div className="form-group">
                  <label>Conditions météo</label>
                  <select
                    name="meteo"
                    value={formData.meteo}
                    onChange={handleInputChange}
                  >
                    <option value="">Sélectionner...</option>
                    <option value="Ensoleillé">☀️ Ensoleillé</option>
                    <option value="Nuageux">⛅ Nuageux</option>
                    <option value="Pluvieux">🌧️ Pluvieux</option>
                    <option value="Orageux">⛈️ Orageux</option>
                    <option value="Neigeux">❄️ Neigeux</option>
                    <option value="Venteux">💨 Venteux</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Description de l'intervention</label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  placeholder="Détails de l'intervention à réaliser..."
                  rows="3"
                />
              </div>

              <div className="form-group">
                <label>Notes et observations</label>
                <textarea
                  name="notes"
                  value={formData.notes}
                  onChange={handleInputChange}
                  placeholder="Remarques, résultats, problèmes rencontrés..."
                  rows="3"
                />
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={closeModal}>
                  Annuler
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingIntervention ? 'Mettre à jour' : 'Planifier'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Interventions;