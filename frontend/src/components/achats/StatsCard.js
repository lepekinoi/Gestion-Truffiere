import React from 'react';

/**
 * Composant carte de statistiques réutilisable
 * @param {string} label - Libellé affiché
 * @param {string|number} value - Valeur à afficher
 * @param {string} color - Couleur principale
 * @param {string} subtitle - Sous-titre optionnel (pour légende)
 */
const StatsCard = ({ label, value, color, subtitle }) => (
  <div style={{
    background: 'white',
    padding: '20px',
    borderRadius: '8px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    textAlign: 'center'
  }}>
    <div style={{ 
      fontSize: '12px', 
      color: '#666', 
      marginBottom: '10px', 
      fontWeight: '600' 
    }}>
      {label}
    </div>
    <div style={{ 
      fontSize: '32px', 
      fontWeight: 'bold', 
      color: color 
    }}>
      {value}
    </div>
    {subtitle && (
      <div style={{ 
        fontSize: '11px', 
        color: '#999', 
        marginTop: '8px',
        fontStyle: 'italic'
      }}>
        {subtitle}
      </div>
    )}
  </div>
);

export default StatsCard;
