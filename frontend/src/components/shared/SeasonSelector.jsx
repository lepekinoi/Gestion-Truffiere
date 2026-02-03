import React from 'react';
import { 
  getAvailableSeasons, 
  detectIncompleteSeason, 
  formatSeasonLabel,
  getSeasonColor,
  SEASON_COLORS
} from '../../utils/seasonUtils';

/**
 * Sélecteur de saisons truffières avec support multi-sélection
 * 
 * @param {Object} props
 * @param {Array} props.recoltesData - Données des récoltes
 * @param {string|Array} props.value - Saison(s) sélectionnée(s)
 * @param {Function} props.onChange - Callback au changement
 * @param {boolean} props.multiple - Activer la multi-sélection
 * @param {boolean} props.showAll - Afficher l'option "Toutes les saisons"
 * @param {string} props.label - Libellé du sélecteur
 */
function SeasonSelector({ 
  recoltesData = [], 
  value, 
  onChange, 
  multiple = false,
  showAll = true,
  label = '🍃 Saison'
}) {
  const availableSeasons = getAvailableSeasons(recoltesData);
  
  // Gérer la valeur comme tableau pour faciliter la logique
  const selectedSeasons = multiple 
    ? (Array.isArray(value) ? value : [value]).filter(Boolean)
    : [value].filter(Boolean);

 // Simple sélection : dropdown classique
if (!multiple) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
      <label style={{ 
        fontSize: '0.85rem', 
        fontWeight: '500', 
        color: '#2c5f2d',
        display: 'block'
      }}>
        {label}
      </label>
      <select
        value={value || 'all'}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: '100%',
          padding: '0.75rem',
          border: '1px solid #ddd',
          borderRadius: '6px',
          fontSize: '0.95rem',
          background: value && value !== 'all' ? '#e8f5e9' : 'white',
          cursor: 'pointer',
          outline: 'none'
        }}
      >
        {showAll && <option value="all">✨ Toutes les saisons</option>}
        {availableSeasons.map(season => {
          const completeness = detectIncompleteSeason(season, recoltesData);
          const monthNames = { 1:'Jan', 2:'Fév', 3:'Mar', 9:'Sep', 10:'Oct', 11:'Nov', 12:'Déc' };
          
          // Affichage détaillé dans les options du dropdown
          const fullLabel = completeness.isComplete 
            ? season 
            : `${season} ⚠️ (${completeness.coverage}% - ${completeness.monthsPresent.map(m => monthNames[m]).join(', ')})`;
          
          return (
            <option key={season} value={season}>
              {fullLabel}
            </option>
          );
        })}
      </select>
    </div>
  );
}


  // Multi-sélection : checkboxes avec badges
  const handleToggle = (season) => {
    const newSelection = selectedSeasons.includes(season)
      ? selectedSeasons.filter(s => s !== season)
      : [...selectedSeasons, season];
    onChange(newSelection);
  };

  const handleSelectAll = () => {
    onChange(availableSeasons);
  };

  const handleClearAll = () => {
    onChange([]);
  };

  return (
    <div style={{ 
      background: 'white', 
      padding: '1rem', 
      borderRadius: '12px',
      border: '2px solid #e0e0e0'
    }}>
      {/* En-tête avec boutons de contrôle */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '1rem',
        paddingBottom: '0.75rem',
        borderBottom: '1px solid #eee'
      }}>
        <span style={{ fontWeight: '600', color: '#333', fontSize: '1rem' }}>
          {label}
        </span>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={handleSelectAll}
            disabled={selectedSeasons.length === availableSeasons.length}
            style={{
              padding: '0.25rem 0.75rem',
              border: '1px solid #2c5f2d',
              borderRadius: '6px',
              background: 'white',
              color: '#2c5f2d',
              fontSize: '0.8rem',
              cursor: selectedSeasons.length === availableSeasons.length ? 'not-allowed' : 'pointer',
              opacity: selectedSeasons.length === availableSeasons.length ? 0.5 : 1
            }}
          >
            ✓ Tout
          </button>
          <button
            onClick={handleClearAll}
            disabled={selectedSeasons.length === 0}
            style={{
              padding: '0.25rem 0.75rem',
              border: '1px solid #999',
              borderRadius: '6px',
              background: 'white',
              color: '#666',
              fontSize: '0.8rem',
              cursor: selectedSeasons.length === 0 ? 'not-allowed' : 'pointer',
              opacity: selectedSeasons.length === 0 ? 0.5 : 1
            }}
          >
            ✕ Aucune
          </button>
        </div>
      </div>

      {/* Compteur de sélection */}
      {selectedSeasons.length > 0 && (
        <div style={{
          marginBottom: '0.75rem',
          padding: '0.5rem',
          background: '#e8f5e9',
          borderRadius: '6px',
          fontSize: '0.85rem',
          color: '#2c5f2d',
          fontWeight: '500',
          textAlign: 'center'
        }}>
          {selectedSeasons.length} saison{selectedSeasons.length > 1 ? 's' : ''} sélectionnée{selectedSeasons.length > 1 ? 's' : ''}
        </div>
      )}

      {/* Liste des saisons avec checkboxes */}
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        gap: '0.5rem',
        maxHeight: '300px',
        overflowY: 'auto'
      }}>
        {availableSeasons.length === 0 ? (
          <div style={{ 
            textAlign: 'center', 
            padding: '1rem', 
            color: '#999',
            fontSize: '0.9rem'
          }}>
            Aucune saison disponible
          </div>
        ) : (
          availableSeasons.map((season, index) => {
            const completeness = detectIncompleteSeason(season, recoltesData);
            const isSelected = selectedSeasons.includes(season);
            const color = SEASON_COLORS[index % SEASON_COLORS.length];
            
            return (
              <label
                key={season}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.75rem',
                  borderRadius: '8px',
                  border: isSelected ? `2px solid ${color}` : '2px solid #f0f0f0',
                  background: isSelected ? `${color}15` : 'white',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  userSelect: 'none'
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.background = '#f9f9f9';
                    e.currentTarget.style.borderColor = '#ddd';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.background = 'white';
                    e.currentTarget.style.borderColor = '#f0f0f0';
                  }
                }}
              >
                {/* Checkbox */}
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => handleToggle(season)}
                  style={{
                    width: '18px',
                    height: '18px',
                    cursor: 'pointer',
                    accentColor: color
                  }}
                />

                {/* Indicateur de couleur */}
                <div style={{
                  width: '12px',
                  height: '12px',
                  borderRadius: '50%',
                  background: color,
                  flexShrink: 0
                }} />

                {/* Nom de la saison */}
                <span style={{ 
                  fontWeight: isSelected ? '600' : '500',
                  color: isSelected ? '#333' : '#666',
                  fontSize: '0.95rem',
                  flex: 1
                }}>
                  {season}
                </span>

                {/* Badge de complétude */}
                {!completeness.isComplete && completeness.hasData && (
                  <span style={{
                    padding: '0.15rem 0.5rem',
                    borderRadius: '12px',
                    background: '#fff3cd',
                    color: '#856404',
                    fontSize: '0.7rem',
                    fontWeight: '600',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.25rem'
                  }}>
                    ⚠️ {completeness.coverage}%
                  </span>
                )}

                {!completeness.hasData && (
                  <span style={{
                    padding: '0.15rem 0.5rem',
                    borderRadius: '12px',
                    background: '#f8d7da',
                    color: '#721c24',
                    fontSize: '0.7rem',
                    fontWeight: '600'
                  }}>
                    Aucune donnée
                  </span>
                )}
              </label>
            );
          })
        )}
      </div>
    </div>
  );
}

// ✅ Export explicite (correction ESLint)
export default SeasonSelector;
