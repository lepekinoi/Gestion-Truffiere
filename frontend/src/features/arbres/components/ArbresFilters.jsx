import React from 'react';

export default function ArbresFilters({
  filters,
  filterOptions,
  hasActiveFilters,
  onChange,
  onReset,
  total,
  filtered
}) {
  const [showFilters, setShowFilters] = React.useState(false);

  return (
    <div style={{
      background: 'white',
      padding: '1rem',
      borderRadius: '12px',
      marginBottom: '1rem',
      boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
    }}>
      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
        
        {/* Recherche */}
        <div style={{ flex: '1', minWidth: '250px', position: 'relative' }}>
          <input
            type="text"
            placeholder="🔍 Rechercher par numéro, espèce, parcelle, notes..."
            value={filters.search}
            onChange={(e) => onChange('search', e.target.value)}
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
              onClick={() => onChange('search', '')}
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

        {/* Bouton filtres */}
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
          🎛️ Filtres {hasActiveFilters && `(${Object.values(filters).filter(v => v !== '').length})`}
          <span style={{ fontSize: '0.8rem' }}>{showFilters ? '▲' : '▼'}</span>
        </button>

        {/* Reset */}
        {hasActiveFilters && (
          <button
            onClick={onReset}
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

      {/* Panneau de filtres */}
      {showFilters && (
        <div style={{
          marginTop: '1rem',
          paddingTop: '1rem',
          borderTop: '1px solid #eee',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '1rem'
        }}>
          
          {/* Parcelle */}
          <div>
            <label>Parcelle</label>
            <select
              value={filters.parcelle}
              onChange={(e) => onChange('parcelle', e.target.value)}
            >
              <option value="">Toutes</option>
              {filterOptions.parcelles?.map(p => (
                <option key={p.id} value={p.id}>{p.nom}</option>
              ))}
            </select>
          </div>

          {/* Espèce */}
          <div>
            <label>Espèce</label>
            <select
              value={filters.espece}
              onChange={(e) => onChange('espece', e.target.value)}
            >
              <option value="">Toutes</option>
              {filterOptions.especes.map(e => (
                <option key={e} value={e}>{e}</option>
              ))}
            </select>
          </div>

          {/* État */}
          <div>
            <label>État</label>
            <select
              value={filters.etat_sanitaire}
              onChange={(e) => onChange('etat_sanitaire', e.target.value)}
            >
              <option value="">Tous</option>
              <option value="Bon">Bon</option>
              <option value="Moyen">Moyen</option>
              <option value="Mauvais">Mauvais</option>
              <option value="Mort">Mort</option>
            </select>
          </div>

          {/* Variété */}
          <div>
            <label>Variété</label>
            <select
              value={filters.variete_truffe}
              onChange={(e) => onChange('variete_truffe', e.target.value)}
            >
              <option value="">Toutes</option>
              {filterOptions.varietes.map(v => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          </div>

          {/* Position */}
          <div>
            <label>Position GPS</label>
            <select
              value={filters.avecPosition}
              onChange={(e) => onChange('avecPosition', e.target.value)}
            >
              <option value="">Tous</option>
              <option value="oui">📍 Avec position</option>
              <option value="non">❌ Sans position</option>
            </select>
          </div>
        </div>
      )}

      {/* Résumé */}
      {hasActiveFilters && (
        <div style={{
          marginTop: '1rem',
          padding: '0.75rem',
          background: '#f5f5f5',
          borderRadius: '6px',
          fontSize: '0.9rem',
          color: '#666'
        }}>
          <strong>{filtered}</strong> arbre(s) trouvé(s)
          {filtered !== total && (
            <span> sur {total} au total</span>
          )}
        </div>
      )}
    </div>
  );
}
