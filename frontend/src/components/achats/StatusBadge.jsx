import React from 'react';
import { STATUT_FOURNISSEUR_COLORS, STATUT_COMMANDE_COLORS } from './constants';

/**
 * Badge de statut stylisé selon le type (fournisseur ou commande)
 * @param {string} statut - Statut à afficher
 * @param {'fournisseur'|'commande'} type - Type d'entité
 */
const StatusBadge = ({ statut, type }) => {
  const colors = type === 'fournisseur' 
    ? STATUT_FOURNISSEUR_COLORS 
    : STATUT_COMMANDE_COLORS;
  
  const style = colors[statut] || { 
    background: '#e0e0e0', 
    color: '#666' 
  };
  
  return (
    <span style={{
      display: 'inline-block',
      padding: '4px 10px',
      borderRadius: '4px',
      fontSize: '12px',
      fontWeight: '600',
      backgroundColor: style.background,
      color: style.color
    }}>
      {statut}
    </span>
  );
};

export default StatusBadge;
