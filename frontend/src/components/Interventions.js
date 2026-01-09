import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { exportInterventionsPDF } from '../utils/pdfExport';
import { validateInterventionsCSV } from '../utils/csvImport';
import CSVImportModal from './CSVImportModal';
import { useColumnSettings, COLONNES_CONFIG } from '../hooks/useColumnSettings';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

function Interventions() {
  const [interventions, setInterventions] = useState([]);
  const [parcelles, setParcelles] = useState([]);
  const [arbres, setArbres] = useState([]);
  const [typesIntervention, setTypesIntervention] = useState([]);
  const [caveurs, setCaveurs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [editingIntervention, setEditingIntervention] = useState(null);
  const [filterStatut, setFilterStatut] = useState('all');
  const [message, setMessage] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Modal de confirmation
  const [confirmModal, setConfirmModal] = useState(null);
  
  // Avertissement doublon
  const [doublonWarning, setDoublonWarning] = useState(null);
  
  // Personnel par défaut (peut être configuré dans Paramètres)
  const [personnelDefaut, setPersonnelDefaut] = useState('');
  
  const [formData, setFormData] = useState({
    type_intervention_id: '',
    parcelle_id: '',
    arbre_ids: [],
    date_prevue: '',
    date_realisee: '',
    duree_minutes: '',
    personnel: '',
    caveur_id: '',
    description: '',
    cout: '',
    statut: 'Planifié',
    meteo: '',
    notes: ''
  });

  const { colonnesAffichees, colonnesExport, loading: loadingSettings } = useColumnSettings('interventions');

  useEffect(() => {
    loadData();
  }, []);

  const showMessage = (text, type = 'success') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 4000);
  };

  const loadData = async () => {
    try {
      const [interventionsRes, parcellesRes, arbresRes, typesRes, caveursRes] = await Promise.all([
        axios.get(`${API_URL}/interventions`),
        axios.get(`${API_URL}/parcelles`),
        axios.get(`${API_URL}/arbres`),
        axios.get(`${API_URL}/types-intervention`),
        axios.get(`${API_URL}/caveurs`).catch(() => ({ data: [] }))
      ]);
      setInterventions(interventionsRes.data);
      setParcelles(parcellesRes.data);
      setArbres(arbresRes.data);
      setTypesIntervention(typesRes.data);
      setCaveurs(caveursRes.data || []);
      
      // Charger le personnel par défaut depuis les paramètres
      try {
        const paramsRes = await axios.get(`${API_URL}/parametres`);
        const personnelParam = paramsRes.data.find(p => p.cle === 'personnel_defaut');
        if (personnelParam) {
          setPersonnelDefaut(personnelParam.valeur || '');
        }
      } catch (e) {
        console.log('Pas de paramètre personnel_defaut');
      }
      
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
    
    // Si on change le personnel (caveur), mettre à jour le champ personnel
    if (name === 'caveur_id' && value) {
      const caveur = caveurs.find(c => c.id === parseInt(value));
      if (caveur) {
        setFormData(prev => ({
          ...prev,
          caveur_id: value,
          personnel: caveur.nom
        }));
      }
    }
  };

  const handleArbresChange = (e) => {
    const selectedOptions = Array.from(e.target.selectedOptions, option => option.value);
    setFormData(prev => ({
      ...prev,
      arbre_ids: selectedOptions
    }));
  };

  // Vérifier les doublons d'intervention
  const checkDoublon = async () => {
    if (!formData.type_intervention_id || !formData.date_prevue || formData.arbre_ids.length === 0) {
      setDoublonWarning(null);
      return;
    }
    
    try {
      // Vérifier pour chaque arbre sélectionné
      for (const arbreId of formData.arbre_ids) {
        const params = {
          arbre_id: arbreId,
          type_intervention_id: formData.type_intervention_id,
          date_prevue: formData.date_prevue
        };
        
        // Exclure l'intervention en cours d'édition
        if (editingIntervention) {
          params.exclude_id = editingIntervention.id;
        }
        
        const response = await axios.get(`${API_URL}/interventions/check-doublon`, { params });
        
        if (response.data.exists) {
          const arbre = arbres.find(a => a.id === parseInt(arbreId));
          const typeInter = typesIntervention.find(t => t.id === parseInt(formData.type_intervention_id));
          setDoublonWarning({
            arbre: arbre?.numero || arbreId,
            type: typeInter?.nom || 'Intervention',
            date: new Date(formData.date_prevue).toLocaleDateString('fr-FR')
          });
          return;
        }
      }
      setDoublonWarning(null);
    } catch (error) {
      console.log('Erreur vérification doublon:', error);
      setDoublonWarning(null);
    }
  };

  // Vérifier les doublons quand les champs pertinents changent
  useEffect(() => {
    const timer = setTimeout(() => {
      checkDoublon();
    }, 500);
    return () => clearTimeout(timer);
  }, [formData.type_intervention_id, formData.date_prevue, formData.arbre_ids]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsProcessing(true);
    
    try {
      // Préparer les données à envoyer
      const dataToSend = { 
        type_intervention_id: formData.type_intervention_id ? parseInt(formData.type_intervention_id) : null,
        parcelle_id: formData.parcelle_id ? parseInt(formData.parcelle_id) : null,
        arbre_id: formData.arbre_ids.length > 0 ? parseInt(formData.arbre_ids[0]) : null,
        date_prevue: formData.date_prevue || null,
        date_realisee: formData.date_realisee || null,
        duree_minutes: formData.duree_minutes ? parseInt(formData.duree_minutes) : null,
        personnel: formData.personnel || null,
        description: formData.description || null,
        cout: formData.cout ? parseFloat(formData.cout) : null,
        statut: formData.statut || 'Planifié',
        meteo: formData.meteo || null,
        notes: formData.notes || null
      };

      if (editingIntervention) {
        // Mode édition - mise à jour
        await axios.put(`${API_URL}/interventions/${editingIntervention.id}`, dataToSend);
        showMessage('Intervention mise à jour avec succès !', 'success');
      } else {
        // Mode création
        if (formData.arbre_ids.length > 1) {
          // Créer une intervention pour chaque arbre sélectionné
          for (const arbreId of formData.arbre_ids) {
            await axios.post(`${API_URL}/interventions`, {
              ...dataToSend,
              arbre_id: parseInt(arbreId)
            });
          }
          showMessage(`${formData.arbre_ids.length} intervention(s) créée(s) avec succès !`, 'success');
        } else {
          await axios.post(`${API_URL}/interventions`, dataToSend);
          showMessage('Intervention créée avec succès !', 'success');
        }
      }
      loadData();
      closeModal();
    } catch (error) {
      console.error('Erreur lors de la sauvegarde:', error);
      const errorMsg = error.response?.data?.error || error.message || 'Erreur inconnue';
      showMessage(`Erreur lors de la sauvegarde: ${errorMsg}`, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleEdit = (intervention) => {
    setEditingIntervention(intervention);
    setDoublonWarning(null);
    
    // Trouver le caveur correspondant au personnel
    const caveur = caveurs.find(c => c.nom === intervention.personnel);
    
    setFormData({
      type_intervention_id: intervention.type_intervention_id ? intervention.type_intervention_id.toString() : '',
      parcelle_id: intervention.parcelle_id ? intervention.parcelle_id.toString() : '',
      arbre_ids: intervention.arbre_id ? [intervention.arbre_id.toString()] : [],
      date_prevue: intervention.date_prevue ? intervention.date_prevue.split('T')[0] : '',
      date_realisee: intervention.date_realisee ? intervention.date_realisee.split('T')[0] : '',
      duree_minutes: intervention.duree_minutes ? intervention.duree_minutes.toString() : '',
      personnel: intervention.personnel || '',
      caveur_id: caveur ? caveur.id.toString() : '',
      description: intervention.description || '',
      cout: intervention.cout ? intervention.cout.toString() : '',
      statut: intervention.statut || 'Planifié',
      meteo: intervention.meteo || '',
      notes: intervention.notes || ''
    });
    setShowModal(true);
  };

  const askDelete = (intervention) => {
    const typeName = typesIntervention.find(t => t.id === intervention.type_intervention_id)?.nom || 'Intervention';
    setConfirmModal({
      type: 'delete',
      item: intervention,
      title: 'Supprimer l\'intervention',
      message: `Êtes-vous sûr de vouloir supprimer l'intervention "${typeName}" du ${new Date(intervention.date_prevue).toLocaleDateString('fr-FR')} ?`,
      confirmText: 'Oui, supprimer',
      confirmColor: '#f44336'
    });
  };

  const doDelete = async (intervention) => {
    setIsProcessing(true);
    setConfirmModal(null);
    
    try {
      await axios.delete(`${API_URL}/interventions/${intervention.id}`);
      showMessage('Intervention supprimée avec succès !', 'success');
      loadData();
    } catch (error) {
      console.error('Erreur lors de la suppression:', error);
      showMessage('Erreur lors de la suppression de l\'intervention', 'error');
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
    setEditingIntervention(null);
    setDoublonWarning(null);
    const today = new Date().toISOString().split('T')[0];
    setFormData({
      type_intervention_id: '',
      parcelle_id: '',
      arbre_ids: [],
      date_prevue: today,
      date_realisee: '',
      duree_minutes: '',
      personnel: personnelDefaut,
      caveur_id: '',
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
    setDoublonWarning(null);
  };

  const handleImportCSV = async (validData) => {
    for (const intervention of validData) {
      await axios.post(`${API_URL}/interventions`, intervention);
    }
    loadData();
    showMessage(`${validData.length} intervention(s) importée(s) avec succès !`, 'success');
  };

  const handleExportPDF = () => {
    exportInterventionsPDF(filteredInterventions, parcelles, typesIntervention, colonnesExport);
  };

  // Filtrer les arbres par parcelle sélectionnée
  const arbresFiltered = formData.parcelle_id 
    ? arbres.filter(a => a.parcelle_id === parseInt(formData.parcelle_id))
    : arbres;

  const filteredInterventions = interventions
    .filter(i => filterStatut === 'all' || i.statut === filterStatut)
    .sort((a, b) => new Date(b.date_prevue) - new Date(a.date_prevue));

  const getStatutBadgeStyle = (statut) => {
    const styles = {
      'Planifié': { background: '#fff3cd', color: '#856404', border: '#ffc107' },
      'En cours': { background: '#cce5ff', color: '#004085', border: '#007bff' },
      'Terminé': { background: '#d4edda', color: '#155724', border: '#28a745' },
      'Annulé': { background: '#f8d7da', color: '#721c24', border: '#dc3545' }
    };
    return styles[statut] || styles['Planifié'];
  };

  const stats = {
    total: interventions.length,
    planifiees: interventions.filter(i => i.statut === 'Planifié').length,
    enCours: interventions.filter(i => i.statut === 'En cours').length,
    terminees: interventions.filter(i => i.statut === 'Terminé').length,
    coutTotal: interventions.filter(i => i.statut === 'Terminé').reduce((sum, i) => sum + parseFloat(i.cout || 0), 0)
  };

  const config = COLONNES_CONFIG.interventions;
  const colonnesValides = colonnesAffichees.filter(col => config[col]);

  const renderCell = (intervention, col) => {
    if (col === 'statut') {
      const style = getStatutBadgeStyle(intervention.statut);
      return (
        <span style={{
          padding: '0.3rem 0.75rem',
          borderRadius: '20px',
          fontSize: '0.85rem',
          fontWeight: '500',
          background: style.background,
          color: style.color,
          border: `1px solid ${style.border}`
        }}>
          {intervention.statut}
        </span>
      );
    }
    if (col === 'cout') {
      return intervention.cout ? `${parseFloat(intervention.cout).toFixed(2)} €` : '-';
    }
    if (col === 'type_nom') {
      const type = typesIntervention.find(t => t.id === intervention.type_intervention_id);
      return type?.nom || '-';
    }
    if (col === 'parcelle_nom') {
      const parcelle = parcelles.find(p => p.id === intervention.parcelle_id);
      return parcelle?.nom || '-';
    }
    if (col === 'arbre_numero') {
      const arbre = arbres.find(a => a.id === intervention.arbre_id);
      return arbre?.numero || 'Tous';
    }
    return config[col]?.render ? config[col].render(intervention, parcelles, arbres, typesIntervention) : (intervention[col] || '-');
  };

  if (loading || loadingSettings) return <div className="loading">Chargement des interventions...</div>;

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
                className="btn btn-secondary" 
                onClick={() => setConfirmModal(null)}
                style={{ padding: '0.75rem 1.5rem' }}
              >
                Annuler
              </button>
              <button 
                className="btn" 
                onClick={handleConfirm}
                style={{ 
                  padding: '0.75rem 1.5rem',
                  background: confirmModal.confirmColor || '#f44336',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer'
                }}
              >
                {confirmModal.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Message de notification */}
      {message && (
        <div style={{
          position: 'fixed',
          top: '1rem',
          right: '1rem',
          padding: '1rem 1.5rem',
          borderRadius: '8px',
          background: message.type === 'success' ? '#d4edda' : '#f8d7da',
          color: message.type === 'success' ? '#155724' : '#721c24',
          border: `1px solid ${message.type === 'success' ? '#c3e6cb' : '#f5c6cb'}`,
          zIndex: 9999,
          boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
          maxWidth: '400px'
        }}>
          {message.text}
        </div>
      )}

      <div className="page-header">
        <h2>🗓️ Gestion des Interventions</h2>
        <div className="header-actions">
          <button className="btn btn-secondary" onClick={() => setShowImportModal(true)}>
            📥 Importer CSV
          </button>
          <button className="btn btn-secondary" onClick={handleExportPDF}>
            🔄 Exporter PDF
          </button>
          <button className="btn btn-primary" onClick={openNewModal}>
            ➕ Nouvelle intervention
          </button>
        </div>
      </div>

      {/* Statistiques */}
      <div className="stats-container" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="stat-card" style={{ background: '#f8f9fa', padding: '1rem', borderRadius: '8px', textAlign: 'center' }}>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#2c5f2d' }}>{stats.total}</div>
          <div style={{ color: '#666', fontSize: '0.9rem' }}>Total</div>
        </div>
        <div className="stat-card" style={{ background: '#fff3cd', padding: '1rem', borderRadius: '8px', textAlign: 'center' }}>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#856404' }}>{stats.planifiees}</div>
          <div style={{ color: '#666', fontSize: '0.9rem' }}>Planifiées</div>
        </div>
        <div className="stat-card" style={{ background: '#cce5ff', padding: '1rem', borderRadius: '8px', textAlign: 'center' }}>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#004085' }}>{stats.enCours}</div>
          <div style={{ color: '#666', fontSize: '0.9rem' }}>En cours</div>
        </div>
        <div className="stat-card" style={{ background: '#d4edda', padding: '1rem', borderRadius: '8px', textAlign: 'center' }}>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#155724' }}>{stats.terminees}</div>
          <div style={{ color: '#666', fontSize: '0.9rem' }}>Terminées</div>
        </div>
        <div className="stat-card" style={{ background: '#e9ecef', padding: '1rem', borderRadius: '8px', textAlign: 'center' }}>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#495057' }}>{stats.coutTotal.toFixed(0)} €</div>
          <div style={{ color: '#666', fontSize: '0.9rem' }}>Coût total</div>
        </div>
      </div>

      {/* Filtres */}
      <div style={{ marginBottom: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        {['all', 'Planifié', 'En cours', 'Terminé', 'Annulé'].map(statut => (
          <button 
            key={statut}
            className={`btn ${filterStatut === statut ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFilterStatut(statut)}
            style={{ padding: '0.5rem 1rem' }}
          >
            {statut === 'all' ? 'Toutes' : statut}
          </button>
        ))}
      </div>

      {filteredInterventions.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🗓️</div>
          <p>Aucune intervention {filterStatut !== 'all' && `avec le statut "${filterStatut}"`}</p>
          <button className="btn btn-primary" onClick={openNewModal} style={{ marginTop: '1rem' }}>
            Planifier une intervention
          </button>
        </div>
      ) : (
        <table>
          <thead>
            <tr>
              {colonnesValides.map(col => (
                <th key={col} style={{ textAlign: config[col]?.align || 'left' }}>
                  {config[col]?.label || col}
                </th>
              ))}
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredInterventions.map(intervention => (
              <tr key={intervention.id}>
                {colonnesValides.map(col => (
                  <td key={col} style={{ textAlign: config[col]?.align || 'left' }}>
                    {renderCell(intervention, col)}
                  </td>
                ))}
                <td>
                  <button className="btn btn-secondary" onClick={() => handleEdit(intervention)} style={{ marginRight: '0.5rem', padding: '0.4rem 0.8rem' }}>
                    ✏️
                  </button>
                  <button className="btn btn-danger" onClick={() => askDelete(intervention)} style={{ padding: '0.4rem 0.8rem' }}>
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
              <h3>{editingIntervention ? 'Modifier l\'intervention' : 'Nouvelle intervention'}</h3>
              <button className="modal-close" onClick={closeModal}>✕</button>
            </div>
            
            {/* Avertissement doublon */}
            {doublonWarning && (
              <div style={{
                background: '#fff3cd',
                border: '1px solid #ffc107',
                borderRadius: '8px',
                padding: '1rem',
                marginBottom: '1rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem'
              }}>
                <span style={{ fontSize: '1.5rem' }}>↩️</span>
                <div>
                  <strong>Attention - Intervention similaire existante</strong>
                  <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.9rem', color: '#856404' }}>
                    Une intervention "{doublonWarning.type}" est déjà prévue pour l'arbre {doublonWarning.arbre} le {doublonWarning.date}.
                  </p>
                </div>
              </div>
            )}
            
            <form onSubmit={handleSubmit}>
              <h4 style={{ color: '#2c5f2d', marginBottom: '1rem', borderBottom: '2px solid #e0e0e0', paddingBottom: '0.5rem' }}>
                📋 Type et localisation
              </h4>
              <div className="form-grid">
                <div className="form-group">
                  <label>Type d'intervention *</label>
                  <select name="type_intervention_id" value={formData.type_intervention_id} onChange={handleInputChange} required>
                    <option value="">Sélectionner...</option>
                    {typesIntervention.map(type => (
                      <option key={type.id} value={type.id}>{type.nom}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Parcelle *</label>
                  <select name="parcelle_id" value={formData.parcelle_id} onChange={handleInputChange} required>
                    <option value="">Sélectionner...</option>
                    {parcelles.map(parcelle => (
                      <option key={parcelle.id} value={parcelle.id}>{parcelle.nom}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label>
                    Arbres concernés 
                    <span style={{ fontSize: '0.85rem', color: '#666', marginLeft: '0.5rem' }}>
                      (Ctrl+clic pour sélection multiple)
                    </span>
                  </label>
                  <select multiple value={formData.arbre_ids} onChange={handleArbresChange} style={{ height: '120px' }}>
                    {arbresFiltered.map(arbre => (
                      <option key={arbre.id} value={arbre.id}>
                        {arbre.numero} - {arbre.espece} ({arbre.etat})
                      </option>
                    ))}
                  </select>
                  {formData.arbre_ids.length > 0 && (
                    <small style={{ color: '#27ae60' }}>
                      {formData.arbre_ids.length} arbre(s) sélectionné(s)
                      {!editingIntervention && formData.arbre_ids.length > 1 && (
                        <span> - Une intervention sera créée pour chaque arbre</span>
                      )}
                    </small>
                  )}
                  {formData.arbre_ids.length === 0 && (
                    <small style={{ color: '#666' }}>
                      Laisser vide pour appliquer à tous les arbres de la parcelle
                    </small>
                  )}
                </div>
              </div>

              <h4 style={{ color: '#2c5f2d', marginTop: '1.5rem', marginBottom: '1rem', borderBottom: '2px solid #e0e0e0', paddingBottom: '0.5rem' }}>
                📅 Planification
              </h4>
              <div className="form-grid">
                <div className="form-group">
                  <label>Date prévue *</label>
                  <input type="date" name="date_prevue" value={formData.date_prevue} onChange={handleInputChange} required />
                </div>

                <div className="form-group">
                  <label>Date de réalisation</label>
                  <input type="date" name="date_realisee" value={formData.date_realisee} onChange={handleInputChange} />
                </div>

                <div className="form-group">
                  <label>Statut *</label>
                  <select name="statut" value={formData.statut} onChange={handleInputChange} required>
                    <option value="Planifié">📋 Planifié</option>
                    <option value="En cours">🔄 En cours</option>
                    <option value="Terminé">✅ Terminé</option>
                    <option value="Annulé">❌ Annulé</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Durée (minutes)</label>
                  <input type="number" name="duree_minutes" value={formData.duree_minutes} onChange={handleInputChange} placeholder="Ex: 120" />
                </div>
              </div>

              <h4 style={{ color: '#2c5f2d', marginTop: '1.5rem', marginBottom: '1rem', borderBottom: '2px solid #e0e0e0', paddingBottom: '0.5rem' }}>
                👷 Équipe et coûts
              </h4>
              <div className="form-grid">
                <div className="form-group">
                  <label>Caveur / Personnel</label>
                  {caveurs.length > 0 ? (
                    <select name="caveur_id" value={formData.caveur_id} onChange={handleInputChange}>
                      <option value="">Sélectionner un caveur...</option>
                      {caveurs.map(caveur => (
                        <option key={caveur.id} value={caveur.id}>
                          {caveur.nom} {caveur.specialite ? `(${caveur.specialite})` : ''}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input 
                      type="text" 
                      name="personnel" 
                      value={formData.personnel} 
                      onChange={handleInputChange} 
                      placeholder="Nom(s) des personnes" 
                    />
                  )}
                </div>

                {caveurs.length > 0 && (
                  <div className="form-group">
                    <label>Personnel (texte libre)</label>
                    <input 
                      type="text" 
                      name="personnel" 
                      value={formData.personnel} 
                      onChange={handleInputChange} 
                      placeholder="Ou saisir manuellement" 
                    />
                  </div>
                )}

                <div className="form-group">
                  <label>Coût (€)</label>
                  <input type="number" name="cout" value={formData.cout} onChange={handleInputChange} step="0.01" placeholder="Ex: 150.00" />
                </div>

                <div className="form-group">
                  <label>Conditions météo</label>
                  <select name="meteo" value={formData.meteo} onChange={handleInputChange}>
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
                <textarea name="description" value={formData.description} onChange={handleInputChange} placeholder="Détails de l'intervention à réaliser..." rows="3" />
              </div>

              <div className="form-group">
                <label>Notes et observations</label>
                <textarea name="notes" value={formData.notes} onChange={handleInputChange} placeholder="Remarques, résultats, problèmes rencontrés..." rows="3" />
              </div>

              <div className="modal-footer" style={{ display: 'flex', justifyContent: editingIntervention ? 'space-between' : 'flex-end', gap: '0.5rem' }}>
                {editingIntervention && (
                  <button 
                    type="button" 
                    className="btn btn-danger" 
                    onClick={() => {
                      closeModal();
                      askDelete(editingIntervention);
                    }}
                    disabled={isProcessing}
                    style={{ marginRight: 'auto' }}
                  >
                    🗑️ Supprimer
                  </button>
                )}
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button type="button" className="btn btn-secondary" onClick={closeModal}>Annuler</button>
                  <button type="submit" className="btn btn-primary" disabled={isProcessing}>
                    {isProcessing ? 'En cours...' : (editingIntervention ? 'Mettre à jour' : 'Planifier')}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      <CSVImportModal
        show={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImport={handleImportCSV}
        validateFunction={validateInterventionsCSV}
        type="interventions"
        title="Importer des interventions depuis CSV"
        dependencies={{ parcelles, typesIntervention, arbres }}
      />
    </div>
  );
}

export default Interventions;
