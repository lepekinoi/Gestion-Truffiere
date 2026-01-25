// ============================================================
// EspeceSelector.jsx - Sélecteur d'espèce avec autocomplete
// Composant réutilisable pour la sélection des espèces d'arbres
// ============================================================

import React, { useState, useEffect, useRef } from 'react';
import './EspeceSelector.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

const EspeceSelector = ({
  value = '',
  onChange = () => {},
  placeholder = 'Sélectionner une espèce...',
  disabled = false,
  required = false,
  showInfos = true,
  allowFreeText = true
}) => {
  const [especes, setEspeces] = useState([]);
  const [filteredEspeces, setFilteredEspeces] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value);
  const [selectedEspece, setSelectedEspece] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  // Charger les espèces au montage
  useEffect(() => {
    const loadEspeces = async () => {
      try {
        setLoading(true);
        const response = await fetch(`${API_URL}/especes?actif=true`);
        if (!response.ok) throw new Error('Erreur lors du chargement');
        
        const data = await response.json();
        setEspeces(data);
        setError(null);
      } catch (err) {
        console.error('Erreur chargement espèces:', err);
        setError('Impossible de charger les espèces');
      } finally {
        setLoading(false);
      }
    };
    
    loadEspeces();
  }, []);

  // Initialiser la valeur si elle change de l'extérieur
  useEffect(() => {
    if (value && value !== inputValue) {
      setInputValue(value);
      // Chercher l'espèce correspondante
      const found = especes.find(e => e.nom === value || e.code === value);
      if (found) {
        setSelectedEspece(found);
      }
    }
  }, [value, especes]);

  // Filtrer les espèces selon l'input
  // useEffect(() => {
    // if (!inputValue) {
      // setFilteredEspeces(especes);
      // return;
    // }

    // const searchLower = inputValue.toLowerCase();
    // const filtered = especes.filter(e => 
      // e.nom.toLowerCase().includes(searchLower) ||
      // e.code.toLowerCase().includes(searchLower) ||
      // e.nom_scientifique?.toLowerCase().includes(searchLower) ||
      // e.groupe_principal?.toLowerCase().includes(searchLower)
    // );
    
    // setFilteredEspeces(filtered);
  // }, [inputValue, especes]);
  


  // Fermer le dropdown au clic extérieur
  // useEffect(() => {
    // const handleClickOutside = (event) => {
      // if (containerRef.current && !containerRef.current.contains(event.target)) {
        // setIsOpen(false);
      // }
    // };

    // document.addEventListener('mousedown', handleClickOutside);
    // return () => document.removeEventListener('mousedown', handleClickOutside);
  // }, []);
  
  // TOUJOURS toutes les espèces (pas de filtre)
useEffect(() => {
  setFilteredEspeces(especes);
}, [especes]);

// NOUVEAU : Toggle au clic
const handleInputClick = () => {
  setIsOpen(!isOpen);
};

// SUPPRIME : handleInputChange, handleInputBlur (inutiles)

  // const handleInputChange = (e) => {
    // const val = e.target.value;
    // setInputValue(val);
    // setIsOpen(true);
    
    // Réinitialiser l'espèce sélectionnée si on change l'input
    // setSelectedEspece(null);
  // };

  const handleSelectEspece = (espece) => {
    setInputValue(espece.nom);
    setSelectedEspece(espece);
    setIsOpen(false);
    onChange(espece.nom); // Passer le nom complet au parent
  };

  // const handleInputBlur = () => {
    // Si allowFreeText est false et aucune espèce n'est sélectionnée, réinitialiser
    // if (!allowFreeText && !selectedEspece) {
      // if (inputValue && !especes.some(e => e.nom === inputValue || e.code === inputValue)) {
        // setInputValue('');
        // onChange('');
      // }
    // }
  // };

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setIsOpen(true);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div className="espece-selector" ref={containerRef}>
      <div className="espece-input-wrapper">
        <input
          // ref={inputRef}
          // type="text"
          // value={inputValue}
          // onChange={handleInputChange}
          // onBlur={handleInputBlur}
          // onKeyDown={handleKeyDown}
          // onFocus={() => setIsOpen(true)}
          // placeholder={placeholder}
          // disabled={disabled || loading}
          // required={required}
          // className="espece-input"
          // autoComplete="off"
		  ref={inputRef}
		  type="text"
		  value={inputValue || ''}  // Affiche nom sélectionné
		  readOnly  // ← CLÉ : interdit saisie
		  onClick={handleInputClick}  // ← Ouvre/ferme liste
		  onKeyDown={handleKeyDown}   // Garde flèches/Escape
		  placeholder={placeholder}
		  disabled={disabled || loading}
		  required={required}
		  className="espece-input"
		  autoComplete="off"		  
        />
        
        {inputValue && !loading && (
          <button
            className="espece-clear-btn"
            onClick={() => {
              setInputValue('');
              setSelectedEspece(null);
              onChange('');
              inputRef.current?.focus();
            }}
            type="button"
            title="Effacer"
          >
            ✕
          </button>
        )}
        
        {loading && <span className="espece-loader">⏳</span>}
        
        <span className={`espece-dropdown-icon ${isOpen ? 'open' : ''}`}>▼</span>
      </div>

      {/* Dropdown avec liste */}
      {isOpen && !loading && (
        <div className="espece-dropdown">
          {error ? (
            <div className="espece-error">
              ⚠️ {error}
            </div>
          ) : filteredEspeces.length === 0 ? (
            <div className="espece-no-results">
              {inputValue ? 'Aucune espèce trouvée' : 'Aucune espèce disponible'}
            </div>
          ) : (
            <ul className="espece-list">
              {filteredEspeces.map((espece) => (
                <li
                  key={espece.id}
                  className={`espece-item ${
                    selectedEspece?.id === espece.id ? 'selected' : ''
                  } ${
                    espece.est_espece_principale ? 'principal' : ''
                  }`}
                  onClick={() => handleSelectEspece(espece)}
                >
                  <div className="espece-item-header">
                    <span className="espece-nom">
                      {espece.nom}
                      {espece.est_espece_principale && <span className="badge-principal">★</span>}
                    </span>
                    <span className="espece-code">({espece.code})</span>
                  </div>
                  
                  {showInfos && (
                    <div className="espece-item-details">
                      {espece.nom_scientifique && (
                        <span className="detail-sci">
                          <em>{espece.nom_scientifique}</em>
                        </span>
                      )}
                      {espece.groupe_principal && (
                        <span className="detail-groupe">
                          {espece.groupe_principal}
                        </span>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Carte d'infos si une espèce est sélectionnée */}
      {showInfos && selectedEspece && !isOpen && (
        <div className="espece-info-card">
          <div className="info-row">
            <span className="info-label">Groupe:</span>
            <span className="info-value">{selectedEspece.groupe_principal}</span>
          </div>
          {selectedEspece.nom_scientifique && (
            <div className="info-row">
              <span className="info-label">Scientifique:</span>
              <span className="info-value info-sci">{selectedEspece.nom_scientifique}</span>
            </div>
          )}
          {selectedEspece.description && (
            <div className="info-row">
              <span className="info-label">Description:</span>
              <span className="info-value info-desc">{selectedEspece.description}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default EspeceSelector;
