import React from 'react';

export default function ArbresConfirmModal({ message }) {
  if (!message) return null;

  return (
    <div style={{
      position: 'fixed',
      top: '20px',
      right: '20px',
      padding: '1rem 1.5rem',
      borderRadius: '8px',
      background: message.type === 'error' ? '#f44336' : '#4caf50',
      color: 'white',
      fontWeight: 'bold',
      zIndex: 9999,
      boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
    }}>
      {message.text}
    </div>
  );
}
