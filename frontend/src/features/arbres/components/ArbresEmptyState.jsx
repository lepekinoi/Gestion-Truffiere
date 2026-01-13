import React from 'react';

export default function ArbresEmptyState({ hasActiveFilters, onResetFilters, onAdd }) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon">{hasActiveFilters ? '🔍' : '🌳'}</div>
      <p>
        {hasActiveFilters
          ? 'Aucun arbre ne correspond aux critères de recherche'
          : 'Aucun arbre enregistré'}
      </p>

      {hasActiveFilters ? (
        <button className="btn btn-secondary" onClick={onResetFilters}>
          Réinitialiser les filtres
        </button>
      ) : (
        <button className="btn btn-primary" onClick={onAdd}>
          Ajouter mon premier arbre
        </button>
      )}
    </div>
  );
}
