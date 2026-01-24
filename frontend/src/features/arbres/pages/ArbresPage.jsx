// ============================================================
// ArbresPage.jsx - Gestion des arbres de la truffière
// Inspired by RecoltesPage - Même logique de filtres/recherche/pagination
// ============================================================

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../../../context/AuthContext';
import './ArbresPage.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

const PAGINATION_OPTIONS = [
  { value: 20, label: '20' },
  { value: 50, label: '50' },
  { value: 100, label: '100' },
  { value: 'all', label: 'Tous' }
];

function ArbresPage({ highlightId }) {
  const [arbres, setArbres] = useState([]);
  const [parcelles, setParcelles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingArbre, setEditingArbre] = useState(null);
  const [message, setMessage] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedArbres, setSelectedArbres] = useState(new Set());
  const { canWrite } = useAuth();
  
  // États de filtrage (comme Recoltes)
  const [filters, setFilters] = useState({
    search: '',
    parcelle: '',
    espece: '',
    etat_sanitaire: ''
  });

  // États de pagination
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);

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
      if (arbre) setCurrentPage(1);
    }
  }, [highlightId]);

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

  const handleFilterChange = (name, value) => {
    setFilters(prev => ({ ...prev, [name]: value }));
    setCurrentPage(1);
  };

  const resetFilters = () => {
    setFilters({
      search: '',
      parcelle: '',
      espece: '',
      etat_sanitaire: ''
    });
    setCurrentPage(1);
  };

  const hasActiveFilters = Object.values(filters).some(v => v !== '');

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

  // Filtrage avancé (comme Recoltes)
  const filteredArbres = arbres.filter(a => {
    // Filtre recherche textuelle
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      const matchNumero = a.numero?.toLowerCase().includes(searchLower);
      const matchEspece = a.espece?.toLowerCase().includes(searchLower);
      const matchVariete = a.variete_truffe?.toLowerCase().includes(searchLower);
      const matchNotes = a.notes?.toLowerCase().includes(searchLower);
      if (!matchNumero && !matchEspece && !matchVariete && !matchNotes) return false;
    }
    
    // Filtre par parcelle
    if (filters.parcelle && a.parcelle_id !== parseInt(filters.parcelle)) return false;
    
    // Filtre par espèce
    if (filters.espece && a.espece !== filters.espece) return false;
    
    // Filtre par état sanitaire
    if (filters.etat_sanitaire && a.etat_sanitaire !== filters.etat_sanitaire) return false;
    
    return true;
  }).sort((a, b) => {
    const numA = parseInt(a.numero?.replace(/\D/g, '') || '0');
    const numB = parseInt(b.numero?.replace(/\D/g, '') || '0');
    return numA - numB;
  });

  // Pagination (comme Recoltes)
  const totalArbres = filteredArbres.length;
  const totalPages = itemsPerPage === 'all' ? 1 : Math.ceil(totalArbres / itemsPerPage);
  
  const paginatedArbres = itemsPerPage === 'all' 
    ? filteredArbres 
    : filteredArbres.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handleItemsPerPageChange = (value) => {
    setItemsPerPage(value);
    setCurrentPage(1);
  };

  const getPageNumbers = () => {
    const pages = [];
    const maxVisiblePages = 5;
    
    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= 4; i++) pages.push(i);
        pages.push('...');
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1);
        pages.push('...');
        for (let i = totalPages - 3; i <= totalPages; i++) pages.push(i);
      } else {
        pages.push(1);
        pages.push('...');
        for (let i = currentPage - 1; i <= currentPage + 1; i++) pages.push(i);
        pages.push('...');
        pages.push(totalPages);
      }
    }
    return pages;
  };

  // États uniques pour les filtres
  const filterOptions = {
    especes: [...new Set(arbres.map(a => a.espece).filter(Boolean))].sort(),
    etats: [...new Set(arbres.map(a => a.etat_sanitaire).filter(Boolean))].sort()
  };

  const stats = {
    total: arbres.length,
    filtered: filteredArbres.length
  };

  // Sélection multiple
  const handleSelectArbre = (arbreId) => {
    setSelectedArbres(prev => {
      const newSet = new Set(prev);
      if (newSet.has(arbreId)) {
        newSet.delete(arbreId);
      } else {
        newSet.add(arbreId);
      }
      return newSet;
    });
  };

  const handleSelectAllPage = () => {
    if (isAllPageSelected) {
      setSelectedArbres(prev => {
        const newSet = new Set(prev);
        paginatedArbres.forEach(a => newSet.delete(a.id));
        return newSet;
      });
    } else {
      setSelectedArbres(prev => {
        const newSet = new Set(prev);
        paginatedArbres.forEach(a => newSet.add(a.id));
        return newSet;
      });
    }
  };

  const handleDeselectAll = () => {
    setSelectedArbres(new Set());
  };

  const handleSelectAllFiltered = () => {
    setSelectedArbres(new Set(filteredArbres.map(a => a.id)));
  };

  const askBulkDelete = async () => {
    if (window.confirm(`Êtes-vous sûr de vouloir supprimer ${selectedArbres.size} arbre(s) ?`)) {
      setIsProcessing(true);
      try {
        const ids = Array.from(selectedArbres);
        await Promise.all(ids.map(id => axios.delete(`${API_URL}/arbres/${id}`)));
        showMessage(`${ids.length} arbre(s) supprimé(s) avec succès !`, 'success');
        setSelectedArbres(new Set());
        loadData();
      } catch (error) {
        console.error('Erreur lors de la suppression groupée:', error);
        showMessage('Erreur lors de la suppression groupée', 'error');
      } finally {
        setIsProcessing(false);
      }
    }
  };

  const isAllPageSelected = paginatedArbres.length > 0 && paginatedArbres.every(a => selectedArbres.has(a.id));
  const isSomePageSelected = paginatedArbres.some(a => selectedArbres.has(a.id));

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
          <div style={{ flex: '1', minWidth: '250px', position: 'relative' }}>
            <input
              type="text"
              placeholder="🔍 Rechercher par numéro, espèce, variété, notes..."
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
            {filters.search && (
              <button
                onClick={() => handleFilterChange('search', '')}
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '1.2rem',
                  color: '#999'
                }}
              >
                ✕
              </button>
            )}
          </div>
          
          <button
            onClick={() => setShowFilters(!showFilters)}
            style={{
              padding: '0.75rem 1.25rem',
              border: hasActiveFilters ? '2px solid #2c5f2d' : '2px solid #e0e0e0',
              borderRadius: '8px',
              background: hasActiveFilters ? '#e8f5e9' : 'white',
              color: hasActiveFilters ? '#2c5f2d' : '#666',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontWeight: hasActiveFilters ? 'bold' : 'normal'
            }}
          >
            🌎 Filtres {hasActiveFilters && `(${Object.values(filters).filter(v => v !== '').length})`}
            <span style={{ fontSize: '0.8rem' }}>{showFilters ? '▲' : '▼'}</span>
          </button>
          
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

        {/* Panneau de filtres avancés */}
        {showFilters && (
          <div style={{ 
            marginTop: '1rem', 
            paddingTop: '1rem', 
            borderTop: '1px solid #eee',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            gap: '1rem'
          }}>
            <div>
              <label style={{ fontSize: '0.85rem', color: '#666', marginBottom: '0.25rem', display: 'block' }}>
                Parcelle
              </label>
              <select
                value={filters.parcelle}
                onChange={(e) => handleFilterChange('parcelle', e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid #ddd',
                  borderRadius: '6px',
                  background: filters.parcelle ? '#e8f5e9' : 'white'
                }}
              >
                <option value="">Toutes</option>
                {parcelles.map(p => (
                  <option key={p.id} value={p.id}>{p.nom}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ fontSize: '0.85rem', color: '#666', marginBottom: '0.25rem', display: 'block' }}>
                Espèce
              </label>
              <select
                value={filters.espece}
                onChange={(e) => handleFilterChange('espece', e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid #ddd',
                  borderRadius: '6px',
                  background: filters.espece ? '#e8f5e9' : 'white'
                }}
              >
                <option value="">Toutes</option>
                {filterOptions.especes.map(e => (
                  <option key={e} value={e}>{e}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ fontSize: '0.85rem', color: '#666', marginBottom: '0.25rem', display: 'block' }}>
                État sanitaire
              </label>
              <select
                value={filters.etat_sanitaire}
                onChange={(e) => handleFilterChange('etat_sanitaire', e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid #ddd',
                  borderRadius: '6px',
                  background: filters.etat_sanitaire ? '#e8f5e9' : 'white'
                }}
              >
                <option value="">Tous</option>
                <option value="Excellent">Excellent</option>
                <option value="Bon">Bon</option>
                <option value="Moyen">Moyen</option>
                <option value="Mauvais">Mauvais</option>
              </select>
            </div>
          </div>
        )}

        {/* Résumé des résultats */}
        {hasActiveFilters && (
          <div style={{ 
            marginTop: '1rem', 
            padding: '0.75rem', 
            background: '#f5f5f5', 
            borderRadius: '6px',
            fontSize: '0.9rem',
            color: '#666'
          }}>
            <strong>{filteredArbres.length}</strong> arbre{filteredArbres.length > 1 ? 's' : ''} trouvé{filteredArbres.length > 1 ? 's' : ''}
            {filteredArbres.length !== arbres.length && (
              <span> sur {arbres.length} au total</span>
            )}
          </div>
        )}
      </div>

      {/* Barre de sélection groupée */}
      {selectedArbres.size > 0 && (
        <div style={{
          background: '#e3f2fd',
          padding: '1rem',
          borderRadius: '12px',
          marginBottom: '1rem',
          border: '2px solid #1976d2',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <span style={{ fontWeight: 'bold', color: '#1976d2' }}>
              ✅ {selectedArbres.size} arbre(s) sélectionné(s)
            </span>
            <button
              onClick={handleDeselectAll}
              style={{
                padding: '0.4rem 0.8rem',
                background: 'transparent',
                border: '1px solid #1976d2',
                borderRadius: '6px',
                color: '#1976d2',
                cursor: 'pointer'
              }}
            >
              Tout désélectionner
            </button>
            {filteredArbres.length > selectedArbres.size && (
              <button
                onClick={handleSelectAllFiltered}
                style={{
                  padding: '0.4rem 0.8rem',
                  background: 'transparent',
                  border: '1px solid #1976d2',
                  borderRadius: '6px',
                  color: '#1976d2',
                  cursor: 'pointer'
                }}
              >
                Sélectionner les {filteredArbres.length} arbres filtrés
              </button>
            )}
          </div>
          <button
            onClick={askBulkDelete}
            className="btn btn-danger"
            style={{ padding: '0.5rem 1rem' }}
          >
            🗑️ Supprimer la sélection
          </button>
        </div>
      )}

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

      {/* Pagination et affichage */}
      {filteredArbres.length > 0 && (
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          marginBottom: '1rem',
          flexWrap: 'wrap',
          gap: '1rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontWeight: '500', color: '#666' }}>Afficher :</span>
            {PAGINATION_OPTIONS.map(option => (
              <button
                key={option.value}
                onClick={() => handleItemsPerPageChange(option.value)}
                style={{
                  padding: '0.4rem 0.8rem',
                  border: itemsPerPage === option.value ? '2px solid #2c5f2d' : '1px solid #ddd',
                  borderRadius: '6px',
                  background: itemsPerPage === option.value ? '#e8f5e9' : 'white',
                  color: itemsPerPage === option.value ? '#2c5f2d' : '#666',
                  fontWeight: itemsPerPage === option.value ? 'bold' : 'normal',
                  cursor: 'pointer'
                }}
              >
                {option.label}
              </button>
            ))}
          </div>
          
          {itemsPerPage !== 'all' && totalPages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                style={{
                  padding: '0.4rem 0.8rem',
                  border: '1px solid #ddd',
                  borderRadius: '6px',
                  background: currentPage === 1 ? '#f5f5f5' : 'white',
                  cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                  opacity: currentPage === 1 ? 0.5 : 1
                }}
              >
                ◀️
              </button>
              
              {getPageNumbers().map((page, idx) => (
                <button
                  key={idx}
                  onClick={() => page !== '...' && setCurrentPage(page)}
                  disabled={page === '...'}
                  style={{
                    padding: '0.4rem 0.8rem',
                    border: currentPage === page ? '2px solid #2c5f2d' : '1px solid #ddd',
                    borderRadius: '6px',
                    background: currentPage === page ? '#2c5f2d' : 'white',
                    color: currentPage === page ? 'white' : '#666',
                    fontWeight: currentPage === page ? 'bold' : 'normal',
                    cursor: page === '...' ? 'default' : 'pointer'
                  }}
                >
                  {page}
                </button>
              ))}
              
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                style={{
                  padding: '0.4rem 0.8rem',
                  border: '1px solid #ddd',
                  borderRadius: '6px',
                  background: currentPage === totalPages ? '#f5f5f5' : 'white',
                  cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                  opacity: currentPage === totalPages ? 0.5 : 1
                }}
              >
                ▶️
              </button>
              
              <span style={{ color: '#666', marginLeft: '0.5rem' }}>
                Page {currentPage} sur {totalPages}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Tableau */}
      {filteredArbres.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#888' }}>
          <p style={{ fontSize: '1.2rem' }}>Aucun arbre {hasActiveFilters ? 'correspondant aux filtres' : 'enregistré'}</p>
          <p>{hasActiveFilters ? 'Essayez de modifier vos critères de recherche' : 'Cliquez sur "Nouvel arbre" pour commencer'}</p>
        </div>
      ) : (
        <table>
          <thead>
            <tr>
              <th style={{ width: '40px', textAlign: 'center' }}>
                <input
                  type="checkbox"
                  checked={isAllPageSelected}
                  ref={el => el && (el.indeterminate = isSomePageSelected && !isAllPageSelected)}
                  onChange={handleSelectAllPage}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
              </th>
              <th>Numéro</th>
              <th>Parcelle</th>
              <th>Espèce</th>
              <th>Variété</th>
              <th style={{ textAlign: 'right' }}\Âge</th>
              <th>État</th>
              <th style={{ textAlign: 'right' }}>Rendement</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginatedArbres.map(arbre => (
              <tr 
                key={arbre.id}
                style={{ 
                  background: selectedArbres.has(arbre.id) ? '#e3f2fd' : 'transparent',
                  transition: 'background 0.2s'
                }}
              >
                <td style={{ textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    checked={selectedArbres.has(arbre.id)}
                    onChange={() => handleSelectArbre(arbre.id)}
                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                  />
                </td>
                <td><strong>{arbre.numero}</strong></td>
                <td>{parcelles.find(p => p.id === arbre.parcelle_id)?.nom || '-'}</td>
                <td>{arbre.espece || '-'}</td>
                <td style={{ fontSize: '0.9rem' }}>{arbre.variete_truffe || '-'}</td>
                <td style={{ textAlign: 'right' }}>{arbre.age_ans ? `${arbre.age_ans} ans` : '-'}</td>
                <td>
                  {arbre.etat_sanitaire ? (
                    <span style={{
                      padding: '0.25rem 0.5rem',
                      borderRadius: '12px',
                      background: '#e8f5e9',
                      color: '#2e7d32',
                      fontSize: '0.85rem',
                      fontWeight: '500'
                    }}>
                      {arbre.etat_sanitaire}
                    </span>
                  ) : '-'}
                </td>
                <td style={{ textAlign: 'right', color: '#8b4513', fontWeight: 'bold' }}>
                  {arbre.rendement_estimé ? `${arbre.rendement_estimé} kg` : '-'}
                </td>
                <td>
                  {canWrite() && (
                    <>
                      <button 
                        className="btn btn-secondary" 
                        onClick={() => handleEdit(arbre)}
                        style={{ marginRight: '0.5rem', padding: '0.4rem 0.8rem' }}
                        title="Modifier"
                      >
                        ✏️
                      </button>
                      <button 
                        className="btn btn-danger" 
                        onClick={() => handleDelete(arbre)}
                        style={{ padding: '0.4rem 0.8rem' }}
                        title="Supprimer"
                      >
                        🗑️
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Modal de création/édition */}
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
