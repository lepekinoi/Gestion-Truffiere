// ============================================================
// ArbresPage.jsx - Gestion des arbres de la truffière
// ============================================================

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../../../context/AuthContext';
import './ArbresPage.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

function ArbresPage({ highlightId }) {
  const [arbres, setArbres] = useState([]);
  const [parcelles, setParcelles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingArbre, setEditingArbre] = useState(null);
  const [message, setMessage] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedArbre, setSelectedArbre] = useState(null);
  const [filters, setFilters] = useState({ search: '', parcelle: '' });
  const { canWrite } = useAuth();
  
  const [formData, setFormData] = useState({
    parcelle_id: '',
    numero: '',
    espece: '',
    variete_truffe: '',
    age_ans: '',
    porte_greffe: '',
    date_plantation: '',
    etat_sanitaire: '',
    rendement_estimé: '',
    notes: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (highlightId) {
      const arbre = arbres.find(a => a.id === highlightId);
      if (arbre) setSelectedArbre(arbre);
    }
  }, [highlightId, arbres]);

  const showMessage = (text, type = 'success') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 4000);
  };

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
      showMessage('Erreur lors du chargement des données', 'error');
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.numero) {
      showMessage('Le numéro de l\'arbre est obligatoire', 'error');
      return;
    }
    
    setIsProcessing(true);
    try {
      if (editingArbre) {
        await axios.put(`${API_URL}/arbres/${editingArbre.id}`, formData);
        showMessage('Arbre mis à jour avec succès !', 'success');
      } else {
        await axios.post(`${API_URL}/arbres`, formData);
        showMessage('Arbre enregistré avec succès !', 'success');
      }
      loadData();
      closeModal();
    } catch (error) {
      console.error('Erreur lors de la sauvegarde:', error);
      showMessage('Erreur lors de la sauvegarde', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleEdit = (arbre) => {
    setEditingArbre(arbre);
    setFormData({
      parcelle_id: arbre.parcelle_id || '',
      numero: arbre.numero || '',
      espece: arbre.espece || '',
      variete_truffe: arbre.variete_truffe || '',
      age_ans: arbre.age_ans || '',
      porte_greffe: arbre.porte_greffe || '',
      date_plantation: arbre.date_plantation ? arbre.date_plantation.split('T')[0] : '',
      etat_sanitaire: arbre.etat_sanitaire || '',
      rendement_estimé: arbre.rendement_estimé || '',
      notes: arbre.notes || ''
    });
    setShowModal(true);
  };

  const handleDelete = async (arbre) => {
    if (window.confirm(`Êtes-vous sûr de vouloir supprimer l'arbre ${arbre.numero} ?`)) {
      setIsProcessing(true);
      try {
        await axios.delete(`${API_URL}/arbres/${arbre.id}`);
        showMessage('Arbre supprimé avec succès !', 'success');
        loadData();
        if (selectedArbre?.id === arbre.id) setSelectedArbre(null);
      } catch (error) {
        console.error('Erreur lors de la suppression:', error);
        showMessage('Erreur lors de la suppression', 'error');
      } finally {
        setIsProcessing(false);
      }
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingArbre(null);
    setFormData({
      parcelle_id: '',
      numero: '',
      espece: '',
      variete_truffe: '',
      age_ans: '',
      porte_greffe: '',
      date_plantation: '',
      etat_sanitaire: '',
      rendement_estimé: '',
      notes: ''
    });
  };

  const openNewModal = () => {
    setEditingArbre(null);
    setFormData({
      parcelle_id: '',
      numero: '',
      espece: '',
      variete_truffe: '',
      age_ans: '',
      porte_greffe: '',
      date_plantation: '',
      etat_sanitaire: '',
      rendement_estimé: '',
      notes: ''
    });
    setShowModal(true);
  };

  const handleFilterChange = (name, value) => {
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const resetFilters = () => {
    setFilters({ search: '', parcelle: '' });
  };

  const hasActiveFilters = filters.search !== '' || filters.parcelle !== '';

  // Filtrer les arbres
  const filteredArbres = arbres.filter(a => {
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      const matchNumero = a.numero?.toLowerCase().includes(searchLower);
      const matchEspece = a.espece?.toLowerCase().includes(searchLower);
      const matchVariete = a.variete_truffe?.toLowerCase().includes(searchLower);
      if (!matchNumero && !matchEspece && !matchVariete) return false;
    }
    
    if (filters.parcelle && a.parcelle_id !== parseInt(filters.parcelle)) return false;
    
    return true;
  }).sort((a, b) => {
    // Trier par numéro d'arbre
    const numA = parseInt(a.numero?.replace(/\D/g, '') || '0');
    const numB = parseInt(b.numero?.replace(/\D/g, '') || '0');
    return numA - numB;
  });

  const stats = {
    total: arbres.length,
    filtered: filteredArbres.length
  };

  if (loading) {
    return <div className="loading">Chargement des arbres...</div>;
  }

  return (
    <div className="page-container">
      {/* Message de notification */}
      {message && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          padding: '1rem 1.5rem',
          borderRadius: '8px',
          background: message.type === 'success' ? '#4caf50' : '#f44336',
          color: 'white',
          boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
          zIndex: 9999,
          animation: 'slideIn 0.3s ease'
        }}>
          {message.text}
        </div>
      )}

      <div className="page-header">
        <h2>🌳 Gestion des Arbres</h2>
        {canWrite() && (
          <button className="btn btn-primary" onClick={openNewModal}>
            ➕ Nouvel arbre
          </button>
        )}
      </div>

      {/* Barre de recherche et filtres */}
      <div style={{ 
        background: 'white', 
        padding: '1rem', 
        borderRadius: '12px', 
        marginBottom: '1rem',
        boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
      }}>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ flex: '1', minWidth: '250px' }}>
            <input
              type="text"
              placeholder="🔍 Rechercher par numéro, espèce, variété..."
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              style={{
                width: '100%',
                padding: '0.75rem 1rem',
                border: '2px solid #e0e0e0',
                borderRadius: '8px',
                fontSize: '1rem'
              }}
            />
          </div>
          
          <select 
            value={filters.parcelle} 
            onChange={(e) => handleFilterChange('parcelle', e.target.value)}
            style={{
              padding: '0.75rem',
              borderRadius: '8px',
              border: filters.parcelle ? '2px solid #2c5f2d' : '2px solid #e0e0e0',
              background: filters.parcelle ? '#e8f5e9' : 'white'
            }}
          >
            <option value="">📦 Toutes les parcelles</option>
            {parcelles.map(p => <option key={p.id} value={p.id}>{p.nom}</option>)}
          </select>
          
          {hasActiveFilters && (
            <button
              onClick={resetFilters}
              style={{
                padding: '0.75rem 1rem',
                border: 'none',
                borderRadius: '8px',
                background: '#ffebee',
                color: '#c62828',
                cursor: 'pointer',
                fontWeight: '500'
              }}
            >
              ✕ Réinitialiser
            </button>
          )}
        </div>
      </div>

      {/* Statistiques rapides */}
      <div className="stats-grid" style={{ marginBottom: '1rem' }}>
        <div className="card">
          <div className="card-title">Total arbres</div>
          <div className="card-value">{stats.total}</div>
        </div>
        {hasActiveFilters && (
          <div className="card">
            <div className="card-title">Résultats</div>
            <div className="card-value">{stats.filtered}</div>
          </div>
        )}
      </div>

      {/* Contenu principal */}
      {filteredArbres.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#888' }}>
          <p style={{ fontSize: '1.2rem' }}>Aucun arbre trouvé</p>
          <p>{hasActiveFilters ? 'Essayez de modifier vos critères de recherche' : 'Cliquez sur "Nouvel arbre" pour commencer'}</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
          {filteredArbres.map(arbre => (
            <div 
              key={arbre.id}
              style={{
                background: selectedArbre?.id === arbre.id ? '#e8f5e9' : 'white',
                border: selectedArbre?.id === arbre.id ? '2px solid #2c5f2d' : '1px solid #e0e0e0',
                borderRadius: '12px',
                padding: '1rem',
                cursor: 'pointer',
                transition: 'all 0.2s',
                boxShadow: selectedArbre?.id === arbre.id ? '0 4px 12px rgba(46, 125, 50, 0.2)' : '0 2px 4px rgba(0,0,0,0.05)'
              }}
              onClick={() => setSelectedArbre(arbre)}
            >
              <h3 style={{ marginTop: 0, color: '#2c5f2d' }}>🌳 {arbre.numero}</h3>
              
              <div style={{ fontSize: '0.9rem', color: '#666', marginBottom: '0.5rem' }}>
                <p style={{ margin: '0.25rem 0' }}><strong>Espèce:</strong> {arbre.espece || '-'}</p>
                <p style={{ margin: '0.25rem 0' }}><strong>Variété:</strong> {arbre.variete_truffe || '-'}</p>
                <p style={{ margin: '0.25rem 0' }}><strong>Parcelle:</strong> {parcelles.find(p => p.id === arbre.parcelle_id)?.nom || '-'}</p>
                <p style={{ margin: '0.25rem 0' }}><strong>Âge:</strong> {arbre.age_ans ? `${arbre.age_ans} ans` : '-'}</p>
                <p style={{ margin: '0.25rem 0' }}><strong>État:</strong> {arbre.etat_sanitaire || '-'}</p>
              </div>
              
              {canWrite() && (
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEdit(arbre);
                    }}
                    className="btn btn-secondary"
                    style={{ flex: 1, padding: '0.4rem' }}
                  >
                    ✏️ Modifier
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(arbre);
                    }}
                    className="btn btn-danger"
                    style={{ flex: 1, padding: '0.4rem' }}
                  >
                    🗑️ Supprimer
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Détails de l'arbre sélectionné */}
      {selectedArbre && (
        <div style={{
          marginTop: '2rem',
          padding: '1.5rem',
          background: '#f8f9fa',
          borderRadius: '12px',
          border: '2px solid #2c5f2d'
        }}>
          <h3 style={{ color: '#2c5f2d', marginTop: 0 }}>📋 Détails de l'arbre {selectedArbre.numero}</h3>
          
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
            gap: '1rem'
          }}>
            <div>
              <strong>Numéro:</strong>
              <p style={{ margin: '0.5rem 0 0 0' }}>{selectedArbre.numero}</p>
            </div>
            <div>
              <strong>Espèce:</strong>
              <p style={{ margin: '0.5rem 0 0 0' }}>{selectedArbre.espece || '-'}</p>
            </div>
            <div>
              <strong>Variété:</strong>
              <p style={{ margin: '0.5rem 0 0 0' }}>{selectedArbre.variete_truffe || '-'}</p>
            </div>
            <div>
              <strong>Parcelle:</strong>
              <p style={{ margin: '0.5rem 0 0 0' }}>{parcelles.find(p => p.id === selectedArbre.parcelle_id)?.nom || '-'}</p>
            </div>
            <div>
              <strong>Âge:</strong>
              <p style={{ margin: '0.5rem 0 0 0' }}>{selectedArbre.age_ans ? `${selectedArbre.age_ans} ans` : '-'}</p>
            </div>
            <div>
              <strong>Porte-greffe:</strong>
              <p style={{ margin: '0.5rem 0 0 0' }}>{selectedArbre.porte_greffe || '-'}</p>
            </div>
            <div>
              <strong>Date plantation:</strong>
              <p style={{ margin: '0.5rem 0 0 0' }}>
                {selectedArbre.date_plantation ? new Date(selectedArbre.date_plantation).toLocaleDateString('fr-FR') : '-'}
              </p>
            </div>
            <div>
              <strong>État sanitaire:</strong>
              <p style={{ margin: '0.5rem 0 0 0' }}>{selectedArbre.etat_sanitaire || '-'}</p>
            </div>
            <div>
              <strong>Rendement estimé:</strong>
              <p style={{ margin: '0.5rem 0 0 0' }}>{selectedArbre.rendement_estimé || '-'}</p>
            </div>
          </div>
          
          {selectedArbre.notes && (
            <div style={{ marginTop: '1rem', padding: '1rem', background: 'white', borderRadius: '8px' }}>
              <strong>Notes:</strong>
              <p style={{ margin: '0.5rem 0 0 0' }}>{selectedArbre.notes}</p>
            </div>
          )}
        </div>
      )}

      {/* Modal */}
      {showModal && canWrite() && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h3>{editingArbre ? 'Modifier l\'arbre' : 'Nouvel arbre'}</h3>
              <button className="modal-close" onClick={closeModal}>✕</button>
            </div>
            
            <form onSubmit={handleSubmit}>
              <div className="form-grid">
                <div className="form-group">
                  <label>Parcelle *</label>
                  <select name="parcelle_id" value={formData.parcelle_id} onChange={handleInputChange} required>
                    <option value="">Sélectionner...</option>
                    {parcelles.map(p => <option key={p.id} value={p.id}>{p.nom}</option>)}
                  </select>
                </div>

                <div className="form-group">
                  <label>Numéro *</label>
                  <input type="text" name="numero" value={formData.numero} onChange={handleInputChange} required placeholder="Ex: A-001" />
                </div>
              </div>

              <div className="form-grid">
                <div className="form-group">
                  <label>Espèce</label>
                  <input type="text" name="espece" value={formData.espece} onChange={handleInputChange} placeholder="Ex: Noisetier" />
                </div>

                <div className="form-group">
                  <label>Variété de truffe</label>
                  <input type="text" name="variete_truffe" value={formData.variete_truffe} onChange={handleInputChange} placeholder="Ex: Truffe noire du Périgord" />
                </div>
              </div>

              <div className="form-grid">
                <div className="form-group">
                  <label>Âge (ans)</label>
                  <input type="number" name="age_ans" value={formData.age_ans} onChange={handleInputChange} />
                </div>

                <div className="form-group">
                  <label>Porte-greffe</label>
                  <input type="text" name="porte_greffe" value={formData.porte_greffe} onChange={handleInputChange} />
                </div>
              </div>

              <div className="form-grid">
                <div className="form-group">
                  <label>Date de plantation</label>
                  <input type="date" name="date_plantation" value={formData.date_plantation} onChange={handleInputChange} />
                </div>

                <div className="form-group">
                  <label>État sanitaire</label>
                  <select name="etat_sanitaire" value={formData.etat_sanitaire} onChange={handleInputChange}>
                    <option value="">Sélectionner...</option>
                    <option value="Excellent">Excellent</option>
                    <option value="Bon">Bon</option>
                    <option value="Moyen">Moyen</option>
                    <option value="Mauvais">Mauvais</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Rendement estimé (kg/an)</label>
                <input type="number" name="rendement_estimé" value={formData.rendement_estimé} onChange={handleInputChange} step="0.1" />
              </div>

              <div className="form-group">
                <label>Notes</label>
                <textarea name="notes" value={formData.notes} onChange={handleInputChange} placeholder="Observations..." rows="3" />
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={closeModal}>Annuler</button>
                <button type="submit" className="btn btn-primary" disabled={isProcessing}>
                  {isProcessing ? 'En cours...' : (editingArbre ? 'Mettre à jour' : 'Enregistrer')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default ArbresPage;
