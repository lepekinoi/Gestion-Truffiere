import React from 'react';

export default function ConfirmModal({
  show,
  title,
  message,
  confirmText = 'OK',
  cancelText = 'Annuler',
  isDestructive = false,
  onConfirm,
  onCancel,
  isLoading = false
}) {
  if (!show) return null;

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="modal-close" onClick={onCancel}>✕</button>
        </div>

        <div style={{ padding: '1.5rem', color: '#333' }}>
          <p style={{ fontSize: '1.1rem', lineHeight: '1.6', margin: '0' }}>
            {message}
          </p>
        </div>

        <div className="modal-footer" style={{ justifyContent: 'flex-end', gap: '0.75rem' }}>
          <button 
            className="btn btn-secondary" 
            onClick={onCancel}
            disabled={isLoading}
          >
            {cancelText}
          </button>
          <button 
            className={`btn ${isDestructive ? 'btn-danger' : 'btn-primary'}`}
            onClick={onConfirm}
            disabled={isLoading}
            style={{
              opacity: isLoading ? 0.7 : 1,
              cursor: isLoading ? 'not-allowed' : 'pointer'
            }}
          >
            {isLoading ? '⏳ En cours...' : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}