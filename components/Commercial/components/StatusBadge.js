// ============================================================
// StatusBadge.js - Composant badge de statut coloré
// ============================================================
// Affiche un badge coloré pour les statuts (commandes, ventes, etc.)
// Utilise les constantes de couleurs définies dans utils/constants.js
// ============================================================

import React from 'react';
import { STATUT_COLORS_COMMANDES, STATUT_COLORS_VENTES } from '../utils/constants';

/**
 * Composant StatusBadge - Badge de statut coloré
 * 
 * @param {Object} props - Propriétés du composant
 * @param {string} props.status - Texte du statut à afficher
 * @param {string} [props.type='commande'] - Type de statut ('commande' ou 'vente')
 * @param {Object} [props.customColors] - Couleurs personnalisées {background, color, border}
 * @param {string} [props.size='medium'] - Taille du badge ('small', 'medium', 'large')
 * @param {Object} [props.style] - Styles CSS supplémentaires
 */
const StatusBadge = ({
  status,
  type = 'commande',
  customColors = null,
  size = 'medium',
  style = {}
}) => {
  // Sélectionner la palette de couleurs selon le type
  const colorPalette = type === 'vente' ? STATUT_COLORS_VENTES : STATUT_COLORS_COMMANDES;
  
  // Récupérer les couleurs (personnalisées ou depuis la palette)
  const colors = customColors || colorPalette[status] || {
    background: '#f0f0f0',
    color: '#333',
    border: '#ddd'
  };
  
  // Définir les tailles
  const sizes = {
    small: {
      fontSize: '10px',
      padding: '2px 6px'
    },
    medium: {
      fontSize: '12px',
      padding: '4px 10px'
    },
    large: {
      fontSize: '14px',
      padding: '6px 14px'
    }
  };
  
  const sizeStyles = sizes[size] || sizes.medium;
  
  return (
    <span
      style={{
        display: 'inline-block',
        borderRadius: '4px',
        fontWeight: 600,
        backgroundColor: colors.background,
        color: colors.color,
        border: `1px solid ${colors.border || colors.background}`,
        whiteSpace: 'nowrap',
        transition: 'all 0.2s ease',
        ...sizeStyles,
        ...style
      }}
      title={status} // Tooltip au survol
    >
      {status}
    </span>
  );
};

export default StatusBadge;

/**
 * Exemple d'utilisation :
 * 
 * // Badge de commande
 * <StatusBadge status="En attente" type="commande" />
 * <StatusBadge status="Livrée" type="commande" size="large" />
 * 
 * // Badge de vente
 * <StatusBadge status="Payée" type="vente" />
 * 
 * // Badge personnalisé
 * <StatusBadge
 *   status="Custom"
 *   customColors={{
 *     background: '#e3f2fd',
 *     color: '#1976d2',
 *     border: '#2196f3'
 *   }}
 * />
 */
