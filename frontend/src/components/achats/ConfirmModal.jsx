import React from 'react';

/**
 * Modal de confirmation réutilisable
 * @param {object} confirmModal - Configuration du modal { type, title, message, confirmText, confirmColor, item }
 * @param {function} onConfirm - Callback de confirmation
 * @param {function} onCancel - Callback d'annulation
 * @param {boolean} isProcessing - État de traitement (désactive les boutons)
 */
const ConfirmModal = ({ confirmModal, onConfirm, onCancel, isProcessing }) => {
  if (!confirmModal) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10000
    }}>
      <div style={{
        background: 'white',
        padding: '30px',
        borderRadius: '12px',
        maxWidth: '500px',
        width: '90%',
        boxShadow: '0 4px 20px rgba(0,0,0,0.3)'
      }}>
        <h3 style={{ marginTop: 0, fontSize: '18px', color: '#333' }}>
          {confirmModal.title}
        </h3>
        <p style={{ 
          color: '#666', 
          fontSize: '14px', 
          lineHeight: '1.6',
          whiteSpace: 'pre-line' 
        }}>
          {confirmModal.message}
        </p>
        <div style={{
          display: 'flex',
          gap: '10px',
          justifyContent: 'flex-end',
          marginTop: '25px'
        }}>
          <button
            onClick={onCancel}
            disabled={isProcessing}
            style={{
              padding: '10px 20px',
              border: '1px solid #ddd',
              borderRadius: '6px',
              background: 'white',
              cursor: isProcessing ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: 500,
              opacity: isProcessing ? 0.6 : 1
            }}
          >
            Annuler
          </button>
          <button
            onClick={onConfirm}
            disabled={isProcessing}
            style={{
              padding: '10px 20px',
              border: 'none',
              borderRadius: '6px',
              background: confirmModal.confirmColor || '#f44336',
              color: 'white',
              cursor: isProcessing ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: 600,
              opacity: isProcessing ? 0.7 : 1,
              transition: 'opacity 0.2s'
            }}
          >
            {isProcessing ? 'Traitement...' : confirmModal.confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
