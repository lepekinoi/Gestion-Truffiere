import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

function Recoltes() {
  const [recoltes, setRecoltes] = useState([]);
  const [parcelles, setParcelles] = useState([]);
  const [arbres, setArbres] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingRecolte, setEditingRecolte] = useState(null);
  const [filterAnnee, setFilterAnnee] = useState(new Date().getFullYear());
  const [formData, setFormData] = useState({
    parcelle_id: '',
    arbre_id: '',
    date_recolte: '',
    poids_grammes: '',
    qualite: '',
    calibre: '',
    maturite: '',
    profondeur_cm: '',
    prix_kg: '',
    caveur: '',
    chien: '',
    conditions_meteo: '',
    temperature_sol: '',
    notes: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [recoltesRes, parcellesRes, arbresRes] = await Promise.all([
        axios.get(`${API_URL}/recoltes`),
        axios.get(`${API_URL}/parcelles`),
        axios.get(`${API_URL}/arbres`)
      ]);
      setRecoltes(recoltesRes.data);
      setParcelles(parcellesRes.data);
      setArbres(arbresRes.data);
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
      const dataToSend = { ...formData };
      if (!dataToSend.arbre_id) dataToSend.arbre_id = null;
      if (!dataToSend.profondeur_cm) dataToSend.profondeur_cm = null;
      if (!dataToSend.prix_kg) dataToSend.prix_kg = null;
      if (!dataToSend.temperature_sol) dataToSend.temperature_sol = null;

      if (editingRecolte) {
        await axios.put(`${API_URL}/recoltes/${editingRecolte.id}`, dataToSend);
      } else {
        await axios.post(`${API_URL}/recoltes`, dataToSend);
      }
      loadData();
      closeModal();
    } catch (error) {
      console.error('Erreur lors de la sauvegarde:', error);
      alert('Erreur lors de la sauvegarde de la récolte');
    }
  };

  const handleEdit = (recolte) => {
    setEditingRecolte(recolte);
    setFormData({
      parcelle_id: recolte.parcelle_id || '',
      arbre_id: recolte.arbre_id || '',
      date_recolte: recolte.date_recolte ? recolte.date_recolte.split('T')[0] : '',
      poids_grammes: recolte.poids_grammes || '',
      qualite: recolte.qualite || '',
      calibre: recolte.calibre || '',
      maturite: recolte.maturite || '',
      profondeur_cm: recolte.profondeur_cm || '',
      prix_kg: recolte.prix_kg || '',
      caveur: recolte.caveur || '',
      chien: recolte.chien || '',
      conditions_meteo: recolte.conditions_meteo || '',
      temperature_sol: recolte.temperature_sol || '',
      notes: recolte.notes || ''
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer cette récolte ?')) {
      try {
        await axios.delete(`${API_URL}/recoltes/${id}`);
        loadData();
      } catch (error) {
        console.error('Erreur lors de la suppression:', error);
        alert('Erreur lors de la suppression de la récolte');
      }
    }
  };

  const openNewModal = () => {
    setEditingRecolte(null);
    const today = new Date().toISOString().split('T')[0];
    setFormData({
      parcelle_id: '',
      arbre_id: '',
      date_recolte: today,
      poids_grammes: '',
      qualite: '',
      calibre: '',
      maturite: '',
      profondeur_cm: '',
      prix_kg: '',
      caveur: '',
      chien: '',
      conditions_meteo: '',
      temperature_sol: '',
      notes: ''
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingRecolte(null);
  };

  const getQualiteBadgeStyle = (qualite) => {
    const styles = {
      'Extra': { background: '#ffd700', color: '#000' },
      'Première': { background: '#d4edda', color: '#155724' },
      'Deuxième': { background: '#fff3cd', color: '#856404' },
      'Brossage': { background: '#e0e0e0', color: '#666' }
    };
    return styles[qualite] || { background: '#e0e0e0', color: '#666' };
  };

  // Filtrer par année
  const filteredRecoltes = recoltes.filter(recolte => {
    const annee = new Date(recolte.date_recolte).getFullYear();
    return filterAnnee === 'all' || annee === parseInt(filterAnnee);
  });

  // Statistiques
  const stats = {
    totalRecoltes: filteredRecoltes.length,
    poidsTotal: filteredRecoltes.reduce((sum, r) => sum + parseFloat(r.poids_grammes || 0), 0),
    poidsMoyen: filteredRecoltes.length > 0 
      ? filteredRecoltes.reduce((sum, r) => sum + parseFloat(r.poids_grammes || 0), 0) / filteredRecoltes.length 
      : 0,
    valeurEstimee: filteredRecoltes.reduce((sum, r) => {
      const poids = parseFloat(r.poids_grammes || 0);
      const prix = parseFloat(r.prix_kg || 0);
      return sum + (poids / 1000 * prix);
    }, 0)
  };

  // Années disponibles
  const anneesDisponibles = [...new Set(recoltes.map(r => new Date(r.date_recolte).getFullYear()))].sort((a, b) => b - a);

  if (loading) {
    return <div className="loading">Chargement des récoltes...</div>;
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h2>🍄 Gestion des récoltes</h2>
        <button className="btn btn-primary" onClick={openNewModal}>
          ➕ Nouvelle récolte
        </button>
      </div>

      {/* Statistiques */}
      <div className="card-grid" style={{ marginBottom: '2rem' }}>
        <div className="card">
          <div className="card-title">Nombre de récoltes</div>
          <div className="card-value">{stats.totalRecoltes}</div>
        </div>
        <div className="card">
          <div className="card-title">Production totale</div>
          <div className="card-value">{(stats.poidsTotal / 1000).toFixed(2)} <span style={{ fontSize: '1.5rem' }}>kg</span></div>
        </div>
        <div className="card">
          <div className="card-title">Poids moyen</div>
          <div className="card-value">{stats.poidsMoyen.toFixed(0)} <span style={{ fontSize: '1.5rem' }}>g</span></div>
        </div>
        <div className="card">
          <div className="card-title">Valeur estimée</div>
          <div className="card-value">{stats.valeurEstimee.toFixed(2)} <span style={{ fontSize: '1.5rem' }}>€</span></div>
        </div>
      </div>

      {/* Filtre par année */}
      <div style={{ marginBottom: '1rem', display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <strong>Filtrer par année :</strong>
        <button 
          className={`btn ${filterAnnee === 'all' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setFilterAnnee('all')}
          style={{ padding: '0.5rem 1rem' }}
        >
          Toutes
        </button>
        {anneesDisponibles.map(annee => (
          <button 
            key={annee}
            className={`btn ${filterAnnee === annee ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFilterAnnee(annee)}
            style={{ padding: '0.5rem 1rem' }}
          >
            {annee}
          </button>
        ))}
      </div>

      {filteredRecoltes.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🍄</div>
          <p>Aucune récolte enregistrée {filterAnnee !== 'all' && `pour l'année ${filterAnnee}`}</p>
          <button className="btn btn-primary" onClick={openNewModal} style={{ marginTop: '1rem' }}>
            Enregistrer ma première récolte
          </button>
        </div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Parcelle</th>
              <th>Arbre</th>
              <th>Poids</th>
              <th>Qualité</th>
              <th>Calibre</th>
              <th>Prix/kg</th>
              <th>Valeur</th>
              <th>Caveur</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredRecoltes
              .sort((a, b) => new Date(b.date_recolte) - new Date(a.date_recolte))
              .map(recolte => {
                const poids = parseFloat(recolte.poids_grammes || 0);
                const prix = parseFloat(recolte.prix_kg || 0);
                const valeur = (poids / 1000 * prix).toFixed(2);
                
                return (
                  <tr key={recolte.id}>
                    <td><strong>{new Date(recolte.date_recolte).toLocaleDateString('fr-FR')}</strong></td>
                    <td>{recolte.parcelle_nom || '-'}</td>
                    <td>{recolte.arbre_numero || '-'}</td>
                    <td>
                      <strong style={{ color: '#2c5f2d', fontSize: '1.1rem' }}>
                        {poids.toFixed(0)} g
                      </strong>
                    </td>
                    <td>
                      {recolte.qualite && (
                        <span style={{
                          padding: '0.25rem 0.75rem',
                          borderRadius: '12px',
                          fontSize: '0.85rem',
                          fontWeight: '500',
                          ...getQualiteBadgeStyle(recolte.qualite)
                        }}>
                          {recolte.qualite}
                        </span>
                      )}
                      {!recolte.qualite && '-'}
                    </td>
                    <td>{recolte.calibre || '-'}</td>
                    <td>{prix > 0 ? `${prix.toFixed(2)} €` : '-'}</td>
                    <td>
                      {prix > 0 && <strong style={{ color: '#27ae60' }}>{valeur} €</strong>}
                      {prix === 0 && '-'}
                    </td>
                    <td>{recolte.caveur || '-'}</td>
                    <td>
                      <button 
                        className="btn btn-secondary" 
                        onClick={() => handleEdit(recolte)}
                        style={{ marginRight: '0.5rem', padding: '0.4rem 0.8rem' }}
                      >
                        ✏️
                      </button>
                      <button 
                        className="btn btn-danger" 
                        onClick={() => handleDelete(recolte.id)}
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
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '800px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="modal-header">
              <h3>{editingRecolte ? 'Modifier la récolte' : 'Nouvelle récolte'}</h3>
              <button className="modal-close" onClick={closeModal}>✕</button>
            </div>
            
            <form onSubmit={handleSubmit}>
              <h4 style={{ color: '#2c5f2d', marginBottom: '1rem', borderBottom: '2px solid #e0e0e0', paddingBottom: '0.5rem' }}>
                📍 Localisation
              </h4>
              <div className="form-grid">
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
                  <label>Arbre (optionnel)</label>
                  <select
                    name="arbre_id"
                    value={formData.arbre_id}
                    onChange={handleInputChange}
                  >
                    <option value="">Non spécifié</option>
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
                  <label>Date de récolte *</label>
                  <input
                    type="date"
                    name="date_recolte"
                    value={formData.date_recolte}
                    onChange={handleInputChange}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Profondeur (cm)</label>
                  <input
                    type="number"
                    name="profondeur_cm"
                    value={formData.profondeur_cm}
                    onChange={handleInputChange}
                    placeholder="Ex: 15"
                  />
                </div>
              </div>

              <h4 style={{ color: '#2c5f2d', marginTop: '1.5rem', marginBottom: '1rem', borderBottom: '2px solid #e0e0e0', paddingBottom: '0.5rem' }}>
                ⚖️ Caractéristiques de la truffe
              </h4>
              <div className="form-grid">
                <div className="form-group">
                  <label>Poids (grammes) *</label>
                  <input
                    type="number"
                    name="poids_grammes"
                    value={formData.poids_grammes}
                    onChange={handleInputChange}
                    step="0.1"
                    required
                    placeholder="Ex: 45.5"
                  />
                </div>

                <div className="form-group">
                  <label>Qualité</label>
                  <select
                    name="qualite"
                    value={formData.qualite}
                    onChange={handleInputChange}
                  >
                    <option value="">Sélectionner...</option>
                    <option value="Extra">Extra</option>
                    <option value="Première">Première</option>
                    <option value="Deuxième">Deuxième</option>
                    <option value="Brossage">Brossage</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Calibre</label>
                  <select
                    name="calibre"
                    value={formData.calibre}
                    onChange={handleInputChange}
                  >
                    <option value="">Sélectionner...</option>
                    <option value="Petite">Petite (&lt; 20g)</option>
                    <option value="Moyenne">Moyenne (20-50g)</option>
                    <option value="Grosse">Grosse (&gt; 50g)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Maturité</label>
                  <select
                    name="maturite"
                    value={formData.maturite}
                    onChange={handleInputChange}
                  >
                    <option value="">Sélectionner...</option>
                    <option value="Parfaite">Parfaite</option>
                    <option value="Bonne">Bonne</option>
                    <option value="Moyenne">Moyenne</option>
                    <option value="Faible">Faible</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Prix au kg (€)</label>
                  <input
                    type="number"
                    name="prix_kg"
                    value={formData.prix_kg}
                    onChange={handleInputChange}
                    step="0.01"
                    placeholder="Ex: 800.00"
                  />
                </div>
              </div>

              <h4 style={{ color: '#2c5f2d', marginTop: '1.5rem', marginBottom: '1rem', borderBottom: '2px solid #e0e0e0', paddingBottom: '0.5rem' }}>
                👤 Équipe et conditions
              </h4>
              <div className="form-grid">
                <div className="form-group">
                  <label>Caveur</label>
                  <input
                    type="text"
                    name="caveur"
                    value={formData.caveur}
                    onChange={handleInputChange}
                    placeholder="Nom du caveur"
                  />
                </div>

                <div className="form-group">
                  <label>Chien</label>
                  <input
                    type="text"
                    name="chien"
                    value={formData.chien}
                    onChange={handleInputChange}
                    placeholder="Nom du chien"
                  />
                </div>

                <div className="form-group">
                  <label>Conditions météo</label>
                  <select
                    name="conditions_meteo"
                    value={formData.conditions_meteo}
                    onChange={handleInputChange}
                  >
                    <option value="">Sélectionner...</option>
                    <option value="Ensoleillé">☀️ Ensoleillé</option>
                    <option value="Nuageux">⛅ Nuageux</option>
                    <option value="Pluvieux">🌧️ Pluvieux</option>
                    <option value="Sec">🏜️ Sec</option>
                    <option value="Humide">💧 Humide</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Température du sol (°C)</label>
                  <input
                    type="number"
                    name="temperature_sol"
                    value={formData.temperature_sol}
                    onChange={handleInputChange}
                    step="0.1"
                    placeholder="Ex: 8.5"
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginTop: '1rem' }}>
                <label>Notes et observations</label>
                <textarea
                  name="notes"
                  value={formData.notes}
                  onChange={handleInputChange}
                  placeholder="Apparence, parfum, particularités, localisation précise..."
                  rows="4"
                />
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={closeModal}>
                  Annuler
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingRecolte ? 'Mettre à jour' : 'Enregistrer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Recoltes;