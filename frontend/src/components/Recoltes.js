import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { exportRecoltesPDF } from '../utils/pdfExport';
import { validateRecoltesCSV } from '../utils/csvImport';
import CSVImportModal from './CSVImportModal';
import { useColumnSettings, COLONNES_CONFIG } from '../hooks/useColumnSettings';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

function Recoltes() {
  const [recoltes, setRecoltes] = useState([]);
  const [parcelles, setParcelles] = useState([]);
  const [arbres, setArbres] = useState([]);
  const [caveurs, setCaveurs] = useState([]);
  const [chiens, setChiens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [editingRecolte, setEditingRecolte] = useState(null);
  const [filterAnnee, setFilterAnnee] = useState('all');
  const [message, setMessage] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Modal de confirmation
  const [confirmModal, setConfirmModal] = useState(null);
  
  const [formData, setFormData] = useState({
    parcelle_id: '',
    arbre_id: '',
    date_recolte: '',
    poids_grammes: '',
    qualite: '',
    calibre: '',
    maturite: '',
    profondeur_cm: '',
    caveur: '',
    chien: '',
    conditions_meteo: '',
    temperature_sol: '',
    notes: ''
  });

  // Hook pour les paramètres de colonnes
  const { colonnesAffichees, colonnesExport, loading: loadingSettings } = useColumnSettings('recoltes');

  useEffect(() => {
    loadData();
  }, []);

  const showMessage = (text, type = 'success') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 4000);
  };

  const loadData = async () => {
    try {
      const [recoltesRes, parcellesRes, arbresRes, caveursRes, chiensRes] = await Promise.all([
        axios.get(`${API_URL}/recoltes`),
        axios.get(`${API_URL}/parcelles`),
        axios.get(`${API_URL}/arbres`),
        axios.get(`${API_URL}/caveurs`).catch(() => ({ data: [] })),
        axios.get(`${API_URL}/chiens`).catch(() => ({ data: [] }))
      ]);
      setRecoltes(recoltesRes.data);
      setParcelles(parcellesRes.data);
      setArbres(arbresRes.data);
      setCaveurs(caveursRes.data);
      setChiens(chiensRes.data);
      setLoading(false);
    } catch (error) {
      console.error('Erreur lors du chargement:', error);
      showMessage('Erreur lors du chargement des données', 'error');
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Si on change la parcelle, réinitialiser l'arbre
    if (name === 'parcelle_id') {
      setFormData(prev => ({
        ...prev,
        arbre_id: ''
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Vérification que l'arbre est sélectionné
    if (!formData.arbre_id) {
      showMessage('Veuillez sélectionner un arbre', 'error');
      return;
    }
    
    setIsProcessing(true);
    try {
      const dataToSend = { ...formData };
      // Ne pas envoyer les champs vides comme null
      Object.keys(dataToSend).forEach(key => {
        if (dataToSend[key] === '') {
          dataToSend[key] = null;
        }
      });

      if (editingRecolte) {
        await axios.put(`${API_URL}/recoltes/${editingRecolte.id}`, dataToSend);
        showMessage('Récolte mise à jour avec succès !', 'success');
      } else {
        await axios.post(`${API_URL}/recoltes`, dataToSend);
        showMessage('Récolte enregistrée avec succès !', 'success');
      }
      loadData();
      closeModal();
    } catch (error) {
      console.error('Erreur lors de la sauvegarde:', error);
      showMessage('Erreur lors de la sauvegarde de la récolte', 'error');
    } finally {
      setIsProcessing(false);
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
      caveur: recolte.caveur || '',
      chien: recolte.chien || '',
      conditions_meteo: recolte.conditions_meteo || '',
      temperature_sol: recolte.temperature_sol || '',
      notes: recolte.notes || ''
    });
    setShowModal(true);
  };

  const askDelete = (recolte) => {
    setConfirmModal({
      type: 'delete',
      item: recolte,
      title: 'Supprimer la récolte',
      message: `Êtes-vous sûr de vouloir supprimer la récolte du ${new Date(recolte.date_recolte).toLocaleDateString('fr-FR')} (${recolte.poids_grammes}g) ?`,
      confirmText: 'Oui, supprimer',
      confirmColor: '#f44336'
    });
  };

  const doDelete = async (recolte) => {
    setIsProcessing(true);
    setConfirmModal(null);
    
    try {
      await axios.delete(`${API_URL}/recoltes/${recolte.id}`);
      showMessage('Récolte supprimée avec succès !', 'success');
      loadData();
    } catch (error) {
      console.error('Erreur lors de la suppression:', error);
      showMessage('Erreur lors de la suppression de la récolte', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirm = () => {
    if (!confirmModal) return;
    if (confirmModal.type === 'delete') {
      doDelete(confirmModal.item);
    } else {
      setConfirmModal(null);
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
      caveur: caveurs.length > 0 ? caveurs[0].nom : '',
      chien: chiens.length > 0 ? chiens[0].nom : '',
      conditions_meteo: '',
      temperature_sol: '',
      notes: ''
    });
    setShowModal(true);
  };

  const handleImportCSV = async (validData) => {
    try {
      for (const recolte of validData) {
        await axios.post(`${API_URL}/recoltes`, recolte);
      }
      loadData();
      showMessage(`${validData.length} récolte(s) importée(s) avec succès !`, 'success');
    } catch (error) {
      console.error('Erreur lors de l\'import:', error);
      throw new Error('Erreur lors de l\'import des récoltes');
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingRecolte(null);
  };

  // Export PDF avec colonnes configurées
  const handleExportPDF = () => {
    const annee = filterAnnee === 'all' ? null : parseInt(filterAnnee);
    exportRecoltesPDF(filteredRecoltes, annee, colonnesExport);
  };

  // Arbres filtrés par parcelle sélectionnée
  const arbresFiltered = formData.parcelle_id 
    ? arbres.filter(a => a.parcelle_id == formData.parcelle_id)
    : arbres;

  // Obtenir les années disponibles
  const annees = [...new Set(recoltes.map(r => new Date(r.date_recolte).getFullYear()))].sort((a, b) => b - a);

  // Filtrage
  const filteredRecoltes = filterAnnee === 'all' 
    ? recoltes 
    : recoltes.filter(r => new Date(r.date_recolte).getFullYear() === parseInt(filterAnnee));

  // Statistiques
  const stats = {
    total: filteredRecoltes.length,
    poidsTotal: filteredRecoltes.reduce((sum, r) => sum + parseFloat(r.poids_grammes || 0), 0)
  };

  // Configuration des colonnes pour l'affichage
  const config = COLONNES_CONFIG.recoltes;
  const colonnesValides = colonnesAffichees.filter(col => config[col]);

  if (loading || loadingSettings) {
    return <div className="loading">Chargement des récoltes...</div>;
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
        <h2>🍄 Suivi des récoltes</h2>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button 
            className="btn btn-secondary" 
            onClick={() => setShowImportModal(true)}
            title="Importer des récoltes depuis un fichier CSV"
          >
            📤 Importer CSV
          </button>
          <button 
            className="btn btn-secondary" 
            onClick={handleExportPDF}
            disabled={filteredRecoltes.length === 0}
            title="Exporter les récoltes en PDF"
          >
            📄 Exporter PDF
          </button>
          <button className="btn btn-primary" onClick={openNewModal}>
            ➕ Nouvelle récolte
          </button>
        </div>
      </div>

      {/* Statistiques */}
      <div className="card-grid" style={{ marginBottom: '2rem' }}>
        <div className="card">
          <div className="card-title">Nombre de récoltes</div>
          <div className="card-value">{stats.total}</div>
        </div>
        <div className="card">
          <div className="card-title">Poids total</div>
          <div className="card-value">{(stats.poidsTotal / 1000).toFixed(2)} <span style={{ fontSize: '1.5rem' }}>kg</span></div>
        </div>
        <div className="card">
          <div className="card-title">Poids moyen</div>
          <div className="card-value">
            {stats.total > 0 ? (stats.poidsTotal / stats.total).toFixed(0) : 0} <span style={{ fontSize: '1.5rem' }}>g</span>
          </div>
        </div>
      </div>

      {/* Filtres par année */}
      <div style={{ marginBottom: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ marginRight: '0.5rem', fontWeight: 'bold' }}>Filtrer par année :</span>
        <button 
          className={`btn ${filterAnnee === 'all' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setFilterAnnee('all')}
          style={{ padding: '0.5rem 1rem' }}
        >
          Toutes
        </button>
        {annees.map(annee => (
          <button 
            key={annee}
            className={`btn ${filterAnnee === annee.toString() ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFilterAnnee(annee.toString())}
            style={{ padding: '0.5rem 1rem' }}
          >
            {annee}
          </button>
        ))}
      </div>

      {filteredRecoltes.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🍄</div>
          <p>Aucune récolte enregistrée {filterAnnee !== 'all' && `pour ${filterAnnee}`}</p>
          <button className="btn btn-primary" onClick={openNewModal} style={{ marginTop: '1rem' }}>
            Enregistrer ma première récolte
          </button>
        </div>
      ) : (
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
            {filteredRecoltes
              .sort((a, b) => new Date(b.date_recolte) - new Date(a.date_recolte))
              .map(recolte => (
                <tr key={recolte.id}>
                  {colonnesValides.map(col => (
                    <td key={col} style={{ textAlign: config[col].align || 'left' }}>
                      {col === 'poids_grammes' ? <strong>{config[col].render(recolte)}</strong> : config[col].render(recolte)}
                    </td>
                  ))}
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
                      onClick={() => askDelete(recolte)}
                      style={{ padding: '0.4rem 0.8rem' }}
                    >
                      🗑️
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
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '700px' }}>
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
                  <select name="parcelle_id" value={formData.parcelle_id} onChange={handleInputChange} required>
                    <option value="">Sélectionner...</option>
                    {parcelles.map(p => <option key={p.id} value={p.id}>{p.nom}</option>)}
                  </select>
                </div>

                <div className="form-group">
                  <label>Arbre * <span style={{ color: '#e74c3c', fontSize: '0.85rem' }}>(obligatoire)</span></label>
                  <select name="arbre_id" value={formData.arbre_id} onChange={handleInputChange} required>
                    <option value="">Sélectionner un arbre...</option>
                    {arbresFiltered.map(a => <option key={a.id} value={a.id}>{a.numero} - {a.espece}</option>)}
                  </select>
                  {!formData.parcelle_id && (
                    <small style={{ color: '#888' }}>Sélectionnez d'abord une parcelle</small>
                  )}
                </div>
              </div>

              <h4 style={{ color: '#2c5f2d', marginTop: '1.5rem', marginBottom: '1rem', borderBottom: '2px solid #e0e0e0', paddingBottom: '0.5rem' }}>
                📅 Date et poids
              </h4>
              <div className="form-grid">
                <div className="form-group">
                  <label>Date de récolte *</label>
                  <input type="date" name="date_recolte" value={formData.date_recolte} onChange={handleInputChange} required />
                </div>

                <div className="form-group">
                  <label>Poids (grammes) *</label>
                  <input type="number" name="poids_grammes" value={formData.poids_grammes} onChange={handleInputChange} step="0.1" required placeholder="Ex: 45.5" />
                </div>

                <div className="form-group">
                  <label>Profondeur (cm)</label>
                  <input type="number" name="profondeur_cm" value={formData.profondeur_cm} onChange={handleInputChange} placeholder="Ex: 15" />
                </div>
              </div>

              <h4 style={{ color: '#2c5f2d', marginTop: '1.5rem', marginBottom: '1rem', borderBottom: '2px solid #e0e0e0', paddingBottom: '0.5rem' }}>
                🍄 Caractéristiques
              </h4>
              <div className="form-grid">
                <div className="form-group">
                  <label>Qualité</label>
                  <select name="qualite" value={formData.qualite} onChange={handleInputChange}>
                    <option value="">Sélectionner...</option>
                    <option value="Extra">Extra</option>
                    <option value="Première catégorie">Première catégorie</option>
                    <option value="Deuxième catégorie">Deuxième catégorie</option>
                    <option value="Tout venant">Tout venant</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Calibre</label>
                  <select name="calibre" value={formData.calibre} onChange={handleInputChange}>
                    <option value="">Sélectionner...</option>
                    <option value="Petit (moins de 20g)">Petit (moins de 20g)</option>
                    <option value="Moyen (20-50g)">Moyen (20-50g)</option>
                    <option value="Gros (50-100g)">Gros (50-100g)</option>
                    <option value="Très gros (plus de 100g)">Très gros (plus de 100g)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Maturité</label>
                  <select name="maturite" value={formData.maturite} onChange={handleInputChange}>
                    <option value="">Sélectionner...</option>
                    <option value="Immature">Immature</option>
                    <option value="À point">À point</option>
                    <option value="Mature">Mature</option>
                    <option value="Très mature">Très mature</option>
                  </select>
                </div>
              </div>

              <h4 style={{ color: '#2c5f2d', marginTop: '1.5rem', marginBottom: '1rem', borderBottom: '2px solid #e0e0e0', paddingBottom: '0.5rem' }}>
                🐕 Équipe de cavage
              </h4>
              <div className="form-grid">
                <div className="form-group">
                  <label>Caveur</label>
                  <select name="caveur" value={formData.caveur} onChange={handleInputChange}>
                    <option value="">Sélectionner...</option>
                    {caveurs.map(c => <option key={c.id} value={c.nom}>{c.nom}</option>)}
                  </select>
                  {caveurs.length === 0 && (
                    <small style={{ color: '#888' }}>Ajoutez des caveurs dans Paramètres</small>
                  )}
                </div>

                <div className="form-group">
                  <label>Chien</label>
                  <select name="chien" value={formData.chien} onChange={handleInputChange}>
                    <option value="">Sélectionner...</option>
                    {chiens.map(c => <option key={c.id} value={c.nom}>{c.nom} {c.race ? `(${c.race})` : ''}</option>)}
                  </select>
                  {chiens.length === 0 && (
                    <small style={{ color: '#888' }}>Ajoutez des chiens dans Paramètres</small>
                  )}
                </div>
              </div>

              <h4 style={{ color: '#2c5f2d', marginTop: '1.5rem', marginBottom: '1rem', borderBottom: '2px solid #e0e0e0', paddingBottom: '0.5rem' }}>
                🌤️ Conditions
              </h4>
              <div className="form-grid">
                <div className="form-group">
                  <label>Conditions météo</label>
                  <select name="conditions_meteo" value={formData.conditions_meteo} onChange={handleInputChange}>
                    <option value="">Sélectionner...</option>
                    <option value="Ensoleillé">☀️ Ensoleillé</option>
                    <option value="Nuageux">⛅ Nuageux</option>
                    <option value="Couvert">☁️ Couvert</option>
                    <option value="Pluvieux">🌧️ Pluvieux</option>
                    <option value="Brumeux">🌫️ Brumeux</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Température du sol (°C)</label>
                  <input type="number" name="temperature_sol" value={formData.temperature_sol} onChange={handleInputChange} step="0.1" placeholder="Ex: 12.5" />
                </div>
              </div>

              <div className="form-group" style={{ marginTop: '1rem' }}>
                <label>Notes</label>
                <textarea name="notes" value={formData.notes} onChange={handleInputChange} placeholder="Observations..." rows="3" />
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={closeModal}>Annuler</button>
                <button type="submit" className="btn btn-primary" disabled={isProcessing}>
                  {isProcessing ? 'En cours...' : (editingRecolte ? 'Mettre à jour' : 'Enregistrer')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal d'import CSV */}
      <CSVImportModal
        show={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImport={handleImportCSV}
        validateFunction={validateRecoltesCSV}
        type="recoltes"
        title="Importer des récoltes depuis CSV"
        dependencies={{ parcelles, arbres }}
      />
    </div>
  );
}

export default Recoltes;
