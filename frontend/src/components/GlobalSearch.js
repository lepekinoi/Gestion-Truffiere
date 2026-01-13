// ============================================================
// GlobalSearch.js - Composant de recherche globale
// ============================================================

import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

const CATEGORY_ICONS = {
  parcelles: '📋',
  arbres: '🌳',
  recoltes: '🍄',
  clients: '👥',
  ventes: '💰',
  commandes: '📦',
  interventions: '🛠️'
};

const CATEGORY_LABELS = {
  parcelles: 'Parcelles',
  arbres: 'Arbres',
  recoltes: 'Récoltes',
  clients: 'Clients',
  ventes: 'Ventes',
  commandes: 'Commandes',
  interventions: 'Interventions'
};

function GlobalSearch({ onNavigate }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const searchRef = useRef(null);
  const inputRef = useRef(null);
  const debounceRef = useRef(null);

  // Fermer lors d'un clic extérieur
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Raccourci clavier Ctrl+K pour ouvrir la recherche
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
      }
      if (e.key === 'Escape') {
        setIsOpen(false);
        inputRef.current?.blur();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Recherche avec debounce
  const performSearch = useCallback(async (query) => {
    if (!query || query.length < 2) {
      setResults([]);
      return;
    }

    setLoading(true);
    try {
      const response = await axios.get(`${API_URL}/search/global`, {
        params: { q: query }
      });
      setResults(response.data);
      setSelectedIndex(-1);
    } catch (error) {
      console.error('Erreur recherche:', error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Gérer la saisie avec debounce
  const handleInputChange = (e) => {
    const value = e.target.value;
    setSearchTerm(value);
    setIsOpen(true);

    // Debounce de 300ms
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      performSearch(value);
    }, 300);
  };

  // Navigation clavier dans les résultats
  const handleKeyDown = (e) => {
    if (!isOpen || results.length === 0) return;

    const totalResults = results.reduce((acc, cat) => acc + cat.items.length, 0);

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, totalResults - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, -1));
    } else if (e.key === 'Enter' && selectedIndex >= 0) {
      e.preventDefault();
      let currentIndex = 0;
      for (const category of results) {
        for (const item of category.items) {
          if (currentIndex === selectedIndex) {
            handleResultClick(category.category, item);
            return;
          }
          currentIndex++;
        }
      }
    }
  };

  // Clic sur un résultat
  const handleResultClick = (category, item) => {
    setIsOpen(false);
    setSearchTerm('');
    if (onNavigate) {
      onNavigate(category, item.id);
    }
  };

  // Grouper les résultats par catégorie
  const groupedResults = results.filter(cat => cat.items && cat.items.length > 0);

  return (
    <div className="global-search" ref={searchRef} style={styles.container}>
      <div style={styles.inputWrapper}>
        <span style={styles.searchIcon}>🔍</span>
        <input
          ref={inputRef}
          type="text"
          placeholder="Rechercher... (Ctrl+K)"
          value={searchTerm}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          style={styles.input}
        />
        {searchTerm && (
          <button
            onClick={() => {
              setSearchTerm('');
              setResults([]);
            }}
            style={styles.clearButton}
          >
            ✕
          </button>
        )}
      </div>

      {isOpen && (searchTerm.length >= 2 || loading) && (
        <div style={styles.dropdown}>
          {loading ? (
            <div style={styles.loading}>
              <div style={styles.spinner}></div>
              <span>Recherche en cours...</span>
            </div>
          ) : groupedResults.length > 0 ? (
            <div style={styles.results}>
              {(() => {
                let globalIndex = 0;
                return groupedResults.map((category) => (
                  <div key={category.category} style={styles.categoryGroup}>
                    <div style={styles.categoryHeader}>
                      <span>{CATEGORY_ICONS[category.category] || '📄'}</span>
                      <span>{CATEGORY_LABELS[category.category] || category.category}</span>
                      <span style={styles.count}>({category.items.length})</span>
                    </div>
                    {category.items.map((item) => {
                      const currentIndex = globalIndex++;
                      return (
                        <div
                          key={`${category.category}-${item.id}`}
                          onClick={() => handleResultClick(category.category, item)}
                          style={{
                            ...styles.resultItem,
                            ...(selectedIndex === currentIndex ? styles.resultItemSelected : {})
                          }}
                        >
                          <div style={styles.resultTitle}>{item.title}</div>
                          {item.subtitle && (
                            <div style={styles.resultSubtitle}>{item.subtitle}</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ));
              })()}
            </div>
          ) : searchTerm.length >= 2 ? (
            <div style={styles.noResults}>
              <span>😔</span>
              <span>Aucun résultat pour "{searchTerm}"</span>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    position: 'relative',
    width: '300px',
    marginRight: '20px'
  },
  inputWrapper: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center'
  },
  searchIcon: {
    position: 'absolute',
    left: '12px',
    fontSize: '14px',
    pointerEvents: 'none',
    opacity: 0.6
  },
  input: {
    width: '100%',
    padding: '8px 36px 8px 36px',
    border: '1px solid rgba(255,255,255,0.3)',
    borderRadius: '20px',
    fontSize: '14px',
    backgroundColor: 'rgba(255,255,255,0.1)',
    color: 'white',
    outline: 'none',
    transition: 'all 0.2s ease'
  },
  clearButton: {
    position: 'absolute',
    right: '12px',
    background: 'none',
    border: 'none',
    color: 'rgba(255,255,255,0.6)',
    cursor: 'pointer',
    fontSize: '12px',
    padding: '4px'
  },
  dropdown: {
    position: 'absolute',
    top: 'calc(100% + 8px)',
    left: 0,
    right: 0,
    backgroundColor: 'white',
    borderRadius: '12px',
    boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
    maxHeight: '400px',
    overflowY: 'auto',
    zIndex: 1000
  },
  loading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
    padding: '20px',
    color: '#666'
  },
  spinner: {
    width: '20px',
    height: '20px',
    border: '2px solid #f3f3f3',
    borderTop: '2px solid #8b5a2b',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite'
  },
  results: {
    padding: '8px 0'
  },
  categoryGroup: {
    marginBottom: '8px'
  },
  categoryHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 16px',
    fontSize: '12px',
    fontWeight: '600',
    color: '#666',
    textTransform: 'uppercase',
    backgroundColor: '#f8f9fa'
  },
  count: {
    color: '#999',
    fontWeight: 'normal'
  },
  resultItem: {
    padding: '10px 16px',
    cursor: 'pointer',
    transition: 'background-color 0.15s ease',
    borderLeft: '3px solid transparent'
  },
  resultItemSelected: {
    backgroundColor: '#f0f7ff',
    borderLeftColor: '#8b5a2b'
  },
  resultTitle: {
    fontSize: '14px',
    fontWeight: '500',
    color: '#333'
  },
  resultSubtitle: {
    fontSize: '12px',
    color: '#666',
    marginTop: '2px'
  },
  noResults: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
    padding: '30px',
    color: '#666'
  }
};

export default GlobalSearch;
