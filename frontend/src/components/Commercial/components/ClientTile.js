// ============================================================
// ClientTile.js - Composant tuile client
// ============================================================
// Affiche une tuile client avec informations essentielles
// Utilisé dans la grille de l'onglet Clients
// ============================================================

import React from 'react';
import { CLIENT_TYPES } from '../utils/constants';
import { formatPhone, truncateText } from '../utils/formatters';

/**
 * Composant ClientTile - Tuile d'affichage client
 * 
 * @param {Object} props - Propriétés du composant
 * @param {Object} props.client - Objet client
 * @param {Function} props.onEdit - Fonction appelée lors du clic sur Modifier
 * @param {Function} props.onDelete - Fonction appelée lors du clic sur Supprimer
 * @param {Function} [props.onView] - Fonction appelée lors du clic sur la tuile (optionnel)
 * @param {boolean} [props.showActions=true] - Afficher les boutons d'action
 * @param {Object} [props.style] - Styles CSS supplémentaires
 */
const ClientTile = ({
  client,
  onEdit,
  onDelete,
  onView,
  showActions = true,
  style = {}
}) => {
  // Construire le nom du client selon son type
  const getClientName = () => {
    if (client.type === 'Particulier') {
      return `${client.nom} ${client.prenom || ''}`.trim();
    }
    return client.raison_sociale || client.nom || '-';
  };
  
  // Gérer le clic sur la tuile
  const handleTileClick = () => {
    if (typeof onView === 'function') {
      onView(client);
    }
  };
  
  // Gérer le clic sur les boutons (empêcher la propagation)
  const handleEditClick = (e) => {
    e.stopPropagation();
    onEdit(client);
  };
  
  const handleDeleteClick = (e) => {
    e.stopPropagation();
    onDelete(client);
  };
  
  const isClickable = typeof onView === 'function';
  
  return (
    <div
      onClick={isClickable ? handleTileClick : undefined}
      style={{
        background: '#f8f9fa',
        border: '1px solid #e0e0e0',
        borderRadius: '8px',
        padding: '15px',
        cursor: isClickable ? 'pointer' : 'default',
        transition: 'all 0.3s ease',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        ...style
      }}
      onMouseEnter={(e) => {
        if (isClickable) {
          e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
          e.currentTarget.style.transform = 'translateY(-2px)';
        }
      }}
      onMouseLeave={(e) => {
        if (isClickable) {
          e.currentTarget.style.boxShadow = 'none';
          e.currentTarget.style.transform = 'translateY(0)';
        }
      }}
    >
      {/* Icône du type de client */}
      <div style={{ fontSize: '32px', marginBottom: '10px', textAlign: 'center' }}>
        {CLIENT_TYPES[client.type] || '👤'}
      </div>
      
      {/* Nom du client */}
      <div
        style={{
          fontWeight: 'bold',
          fontSize: '14px',
          marginBottom: '8px',
          color: '#333',
          textAlign: 'center',
          minHeight: '40px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
        title={getClientName()}
      >
        {truncateText(getClientName(), 30)}
      </div>
      
      {/* Badge type */}
      <div style={{ marginBottom: '10px', textAlign: 'center' }}>
        <span
          style={{
            display: 'inline-block',
            padding: '3px 8px',
            background: '#e3f2fd',
            borderRadius: '4px',
            fontSize: '11px',
            fontWeight: 600,
            color: '#1976d2'
          }}
        >
          {client.type}
        </span>
      </div>
      
      {/* Informations de contact */}
      <div style={{ flex: 1, fontSize: '11px', color: '#666', marginBottom: '12px' }}>
        {client.email && (
          <div
            style={{
              marginBottom: '4px',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}
            title={client.email}
          >
            📧 {client.email}
          </div>
        )}
        
        {client.telephone && (
          <div style={{ marginBottom: '4px' }}>
            📞 {formatPhone(client.telephone)}
          </div>
        )}
        
        {client.ville && (
          <div style={{ marginBottom: '4px' }}>
            📍 {client.ville}
          </div>
        )}
        
        {!client.email && !client.telephone && !client.ville && (
          <div style={{ color: '#999', fontStyle: 'italic', textAlign: 'center' }}>
            Pas d'infos
          </div>
        )}
      </div>
      
      {/* Boutons d'action */}
      {showActions && (
        <div style={{ display: 'flex', gap: '6px', marginTop: 'auto' }}>
          <button
            onClick={handleEditClick}
            style={{
              flex: 1,
              padding: '8px 10px',
              background: '#ff9800',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '11px',
              fontWeight: 600,
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#f57c00';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#ff9800';
            }}
            title="Modifier le client"
          >
            ✏️ Modifier
          </button>
          
          <button
            onClick={handleDeleteClick}
            style={{
              flex: 1,
              padding: '8px 10px',
              background: '#f44336',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '11px',
              fontWeight: 600,
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#d32f2f';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#f44336';
            }}
            title="Supprimer le client"
          >
            🗑️ Supprimer
          </button>
        </div>
      )}
    </div>
  );
};

export default ClientTile;

/**
 * Exemple d'utilisation :
 * 
 * <ClientTile
 *   client={{
 *     type: 'Particulier',
 *     nom: 'Dupont',
 *     prenom: 'Jean',
 *     email: 'jean.dupont@example.com',
 *     telephone: '0612345678',
 *     ville: 'Paris'
 *   }}
 *   onEdit={(client) => console.log('Edit', client)}
 *   onDelete={(client) => console.log('Delete', client)}
 *   onView={(client) => console.log('View', client)}
 * />
 */
