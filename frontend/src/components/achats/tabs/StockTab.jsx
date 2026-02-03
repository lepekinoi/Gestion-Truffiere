// ============================================================
// StockTab.jsx - Onglet Gestion du Stock
// ============================================================

import React from 'react';
import StatsCard from '../StatsCard';

const StockTab = ({
  // Stats
  statsStock,
  
  // Données
  stock,
  
  // Filtres
  filterCalibre,
  setFilterCalibre,
  filterQualite,
  setFilterQualite,
  filteredStock
}) => {
  return (
    <div>
      {/* STATS STOCK */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '15px',
        marginBottom: '30px'
      }}>
        <StatsCard
          label="STOCK TOTAL"
          value={`${statsStock.totalKg.toFixed(1)} kg`}
          color="#2196f3"
        />
        <StatsCard
          label="NOMBRE DE LOTS"
          value={statsStock.nbLots}
          color="#4caf50"
        />
        <StatsCard
          label="⚠️ ALERTES"
          value={statsStock.alertes}
          color="#f44336"
        />
      </div>
      
      {/* CONTRÔLES STOCK */}
      <div style={{
        display: 'flex',
        gap: '15px',
        marginBottom: '20px',
        flexWrap: 'wrap',
        alignItems: 'center'
      }}>
        <select
          value={filterCalibre}
          onChange={(e) => setFilterCalibre(e.target.value)}
          style={{
            padding: '10px 15px',
            border: '1px solid #ddd',
            borderRadius: '6px'
          }}
        >
          <option value="all">Tous calibres</option>
          <option value="20">Extra (20-30mm)</option>
          <option value="30">1ère (30-50mm)</option>
          <option value="50">2e (>50mm)</option>
        </select>
        
        <select
          value={filterQualite}
          onChange={(e) => setFilterQualite(e.target.value)}
          style={{
            padding: '10px 15px',
            border: '1px solid #ddd',
            borderRadius: '6px'
          }}
        >
          <option value="all">Toutes qualités</option>
          <option value="Extra">Extra</option>
          <option value="1ère">1ère</option>
          <option value="2e">2e</option>
        </select>
      </div>
      
      {/* TABLEAU STOCK */}
      <div style={{
        background: 'white',
        borderRadius: '8px',
        padding: '20px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        overflowX: 'auto'
      }}>
        <table style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: '14px'
        }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #e0e0e0', backgroundColor: '#f8f8f8' }}>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600 }}>Calibre</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600 }}>Qualité</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600 }}>🌱 Maturité</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600 }}>Quantité</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600 }}>Conservation</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600 }}>Localisation</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600 }}>Limite consommation</th>
            </tr>
          </thead>
          <tbody>
            {filteredStock.length === 0 ? (
              <tr>
                <td colSpan="7" style={{ padding: '20px', textAlign: 'center', color: '#999' }}>
                  Aucun stock disponible
                </td>
              </tr>
            ) : (
              filteredStock.map((item, idx) => {
                const jours = item.date_limite_consommation
                  ? Math.floor((new Date(item.date_limite_consommation) - new Date()) / (1000 * 60 * 60 * 24))
                  : null;
                const isAlerte = jours !== null && jours <= 7;
                
                return (
                  <tr key={idx} style={{ borderBottom: '1px solid #e0e0e0', background: isAlerte ? '#fff3cd' : 'white' }}>
                    <td style={{ padding: '12px', fontWeight: '500' }}>
                      {item.calibre}
                    </td>
                    <td style={{ padding: '12px', color: '#666' }}>
                      {item.qualite}
                    </td>
                    <td style={{ padding: '12px', color: '#666' }}>
                      {item.maturite || '-'}
                    </td>
                    <td style={{ padding: '12px', fontWeight: '600' }}>
                      {parseFloat(item.quantite_kg_stock || 0).toFixed(2)} kg
                    </td>
                    <td style={{ padding: '12px', color: '#666' }}>
                      {item.conservation || '-'}
                    </td>
                    <td style={{ padding: '12px', color: '#666' }}>
                      {item.localisation_storage || '-'}
                    </td>
                    <td style={{ padding: '12px', color: isAlerte ? '#f44336' : '#666', fontWeight: isAlerte ? '600' : '400' }}>
                      {item.date_limite_consommation
                        ? `${new Date(item.date_limite_consommation).toLocaleDateString('fr-FR')}${isAlerte ? ` (${jours}j)` : ''}`
                        : '-'}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      
      {/* ALERTES */}
      {statsStock.alertes > 0 && (
        <div style={{
          marginTop: '20px',
          padding: '15px',
          background: '#fff3cd',
          border: '1px solid #ffc107',
          borderRadius: '6px',
          color: '#856404'
        }}>
          <strong>⚠️ Attention :</strong> {statsStock.alertes} lot(s) avec une date limite de consommation approchant (≤ 7 jours)
        </div>
      )}
    </div>
  );
};

export default StockTab;
