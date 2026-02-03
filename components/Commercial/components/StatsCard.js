// ============================================================
// StatsCard.js - Composant carte statistique réutilisable
// ============================================================
// Affiche une statistique avec titre, valeur, couleur et sous-texte optionnel
// Utilisé dans les tableaux de bord des différents onglets
// ============================================================

import React from 'react';

/**
 * Composant StatsCard - Carte d'affichage de statistique
 * 
 * @param {Object} props - Propriétés du composant
 * @param {string} props.title - Titre de la statistique (ex: "TOTAL CLIENTS")
 * @param {string|number} props.value - Valeur principale à afficher
 * @param {string} props.color - Couleur du thème (hex, rgb, ou nom CSS)
 * @param {string} [props.icon] - Emoji ou icône à afficher
 * @param {string} [props.subtitle] - Texte secondaire optionnel
 * @param {Function} [props.onClick] - Fonction appelée au clic (rend la carte cliquable)
 * @param {Object} [props.style] - Styles CSS personnalisés supplémentaires
 */
const StatsCard = ({
  title,
  value,
  color = '#2196f3',
  icon = '',
  subtitle = '',
  onClick,
  style = {}
}) => {
  const isClickable = typeof onClick === 'function';
  
  return (
    <div
      onClick={isClickable ? onClick : undefined}
      style={{
        background: 'white',
        padding: '20px',
        borderRadius: '8px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        borderLeft: `4px solid ${color}`,
        cursor: isClickable ? 'pointer' : 'default',
        transition: 'all 0.3s ease',
        ...style
      }}
      onMouseEnter={(e) => {
        if (isClickable) {
          e.currentTarget.style.transform = 'translateY(-2px)';
          e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
        }
      }}
      onMouseLeave={(e) => {
        if (isClickable) {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
        }
      }}
    >
      {/* En-tête avec icône et titre */}
      <div
        style={{
          fontSize: '12px',
          color: '#666',
          fontWeight: 600,
          marginBottom: '10px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          textTransform: 'uppercase',
          letterSpacing: '0.5px'
        }}
      >
        {icon && <span style={{ fontSize: '16px' }}>{icon}</span>}
        {title}
      </div>
      
      {/* Valeur principale */}
      <div
        style={{
          fontSize: '32px',
          fontWeight: 'bold',
          color: color,
          marginBottom: subtitle ? '5px' : '0',
          lineHeight: '1.2'
        }}
      >
        {value}
      </div>
      
      {/* Sous-titre optionnel */}
      {subtitle && (
        <div
          style={{
            fontSize: '13px',
            color: '#999',
            marginTop: '5px'
          }}
        >
          {subtitle}
        </div>
      )}
    </div>
  );
};

export default StatsCard;

/**
 * Exemple d'utilisation :
 * 
 * <StatsCard
 *   title="Total Clients"
 *   value={150}
 *   color="#2196f3"
 *   icon="👥"
 *   subtitle="+12 ce mois"
 *   onClick={() => console.log('Carte cliquée')}
 * />
 */
