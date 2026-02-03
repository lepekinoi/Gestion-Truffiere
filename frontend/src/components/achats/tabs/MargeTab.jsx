// ============================================================
// MargeTab.jsx - Onglet Analyse Marge & Rentabilité
// ============================================================

import React from 'react';

const MargeTab = () => {
  return (
    <div>
      <h2 style={{ marginTop: 0 }}>💰 Analyse de Marge & Rentabilité</h2>
      <div style={{
        background: 'white',
        padding: '20px',
        borderRadius: '8px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        textAlign: 'center',
        color: '#999'
      }}>
        <p>Fonctionnalité d'analyse de marge en cours de développement</p>
        <p style={{ fontSize: '12px' }}>
          Les calculs de marge nécessitent des données complémentaires sur les achats et les ventes
        </p>
      </div>
    </div>
  );
};

export default MargeTab;
