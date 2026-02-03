// ============================================================
// FournisseursTab.jsx - Onglet Gestion Fournisseurs
// ============================================================

import React from 'react';
import StatsCard from '../StatsCard';
import StatusBadge from '../StatusBadge';

const FournisseursTab = ({
  // Stats
  statsFournisseurs,
  
  // Données
  fournisseurs,
  zonesProduction,
  regionsFournisseur,
  
  // Filtres
  filterRegion,
  setFilterRegion,
  filterZone,
  setFilterZone,
  filterStatutFournisseur,
  setFilterStatutFournisseur,
  searchTerm,
  setSearchTerm,
  
  // Pagination
  currentPageFournisseurs,
  setCurrentPageFournisseurs,
  filteredFournisseurs,
  paginatedFournisseurs,
  itemsPerPage,
  
  // Actions
  openNewFournisseurModal,
  handleEditFournisseur,
  askDeleteFournisseur,
  resetFiltersFournisseurs,
  getZonesByRegion
}) => {
  return (
    <div>
      {/* STATS FOURNISSEURS */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '15px',
        marginBottom: '30px'
      }}>
        <StatsCard
          label="✅ FOURNISSEURS ACTIFS"
          value={statsFournisseurs.actifs}
          color="#28a745"
        />
        <StatsCard
          label="👥 TOUS LES FOURNISSEURS"
          value={statsFournisseurs.total}
          color="#2196f3"
        />
        <StatsCard 
          label="🚀 ORIGINES APPRO" 
          value={statsFournisseurs.zones} 
          color="#ff9800"
          subtitle="Zones géographiques des fournisseurs"
        />
        <StatsCard
          label="🏆 CERTIFICATIONS"
          value={statsFournisseurs.certifies}
          color="#9c27b0"
        />
      </div>
      
      {/* CONTRÔLES FOURNISSEURS */}
      <div style={{ display: 'flex', gap: '15px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
        <button 
          onClick={openNewFournisseurModal}
          style={{ 
            padding: '10px 20px', 
            background: '#2196f3', 
            color: 'white', 
            border: 'none', 
            borderRadius: '6px', 
            cursor: 'pointer', 
            fontWeight: 600,
            transition: 'background 0.2s'
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = '#1976d2'}
          onMouseLeave={(e) => e.currentTarget.style.background = '#2196f3'}
        >
          ➕ Nouveau Fournisseur
        </button>

        <button 
          onClick={resetFiltersFournisseurs}
          title="Réinitialiser tous les filtres"
          style={{ 
            padding: '10px 20px', 
            background: '#9e9e9e', 
            color: 'white', 
            border: 'none', 
            borderRadius: '6px', 
            cursor: 'pointer', 
            fontWeight: 600,
            transition: 'background 0.2s'
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = '#757575'}
          onMouseLeave={(e) => e.currentTarget.style.background = '#9e9e9e'}
        >
          🔄 Réinitialiser filtres
        </button>

        {/* FILTRE PAR RÉGION */}
        <select
          value={filterRegion}
          onChange={(e) => {
            setFilterRegion(e.target.value);
            setFilterZone('all');
            setCurrentPageFournisseurs(1);
          }}
          style={{ 
            padding: '10px 15px', 
            border: '1px solid #ddd', 
            borderRadius: '6px',
            cursor: 'pointer'
          }}
        >
          <option value="all">🗺️ Toutes les régions</option>
          {regionsFournisseur.map(region => (
            <option key={region} value={region}>{region}</option>
          ))}
        </select>

        {/* FILTRE PAR ZONE */}
        <select
          value={filterZone}
          onChange={(e) => {
            setFilterZone(e.target.value);
            setCurrentPageFournisseurs(1);
          }}
          disabled={filterRegion === 'all'}
          style={{ 
            padding: '10px 15px', 
            border: '1px solid #ddd', 
            borderRadius: '6px',
            cursor: filterRegion === 'all' ? 'not-allowed' : 'pointer',
            backgroundColor: filterRegion === 'all' ? '#f5f5f5' : 'white',
            color: filterRegion === 'all' ? '#999' : '#333'
          }}
        >
          <option value="all">
            {filterRegion === 'all' ? '📍 Toutes les zones' : '📍 Toutes zones de la région'}
          </option>
          {filterRegion !== 'all' && getZonesByRegion(filterRegion).map(zone => (
            <option key={zone.id} value={zone.nom}>
              {zone.nom}
            </option>
          ))}
        </select>

        {/* FILTRE PAR STATUT */}
        <select
          value={filterStatutFournisseur}
          onChange={(e) => {
            setFilterStatutFournisseur(e.target.value);
            setCurrentPageFournisseurs(1);
          }}
          style={{ 
            padding: '10px 15px', 
            border: '1px solid #ddd', 
            borderRadius: '6px',
            cursor: 'pointer'
          }}
        >
          <option value="all">⚡ Tous les statuts</option>
          <option value="Actif">✅ Actif</option>
          <option value="Inactif">❌ Inactif</option>
          <option value="Suspendu">⏸️ Suspendu</option>
        </select>

        {/* RECHERCHE */}
        <input
          type="text"
          placeholder="🔍 Rechercher un fournisseur..."
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setCurrentPageFournisseurs(1);
          }}
          style={{ 
            padding: '10px 15px', 
            border: '1px solid #ddd', 
            borderRadius: '6px', 
            flex: 1, 
            minWidth: '200px',
            fontSize: '14px'
          }}
        />
  
        {/* INDICATEUR DE FILTRES ACTIFS */}
        {(filterRegion !== 'all' || filterZone !== 'all' || filterStatutFournisseur !== 'all' || searchTerm) && (
          <div style={{ 
            padding: '8px 12px', 
            background: '#fff3cd', 
            border: '1px solid #ffc107',
            borderRadius: '6px',
            fontSize: '13px',
            color: '#856404',
            fontWeight: 500
          }}>
            🎯 Filtres actifs
          </div>
        )}
      </div>
  
      {/* TABLEAU FOURNISSEURS */}
      <div style={{ background: 'white', borderRadius: '8px', padding: '20px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
        
        {/* PAGINATION ET INFO AU-DESSUS */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          marginBottom: '15px', 
          paddingBottom: '15px', 
          borderBottom: '2px solid #e0e0e0' 
        }}>
          <div style={{ color: '#666', fontSize: '14px' }}>
            🧑‍🌾 <strong>{filteredFournisseurs.length}</strong> fournisseur(s) trouvé(s)
            {filterRegion !== 'all' && ` • 🗺️ ${filterRegion}`}
            {filterZone !== 'all' && ` • 📍 ${filterZone}`}
          </div>
        
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              onClick={() => setCurrentPageFournisseurs(prev => Math.max(1, prev - 1))}
              disabled={currentPageFournisseurs === 1}
              style={{
                padding: '8px 16px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                background: currentPageFournisseurs === 1 ? '#f5f5f5' : 'white',
                cursor: currentPageFournisseurs === 1 ? 'not-allowed' : 'pointer',
                opacity: currentPageFournisseurs === 1 ? 0.5 : 1,
                fontWeight: 500
              }}
            >
              ← Précédent
            </button>
            
            <span style={{ color: '#666', fontSize: '14px' }}>
              Page <strong>{currentPageFournisseurs}</strong> / <strong>{Math.ceil(filteredFournisseurs.length / itemsPerPage) || 1}</strong>
            </span>
            
            <button
              onClick={() => setCurrentPageFournisseurs(prev => prev + 1)}
              disabled={currentPageFournisseurs >= Math.ceil(filteredFournisseurs.length / itemsPerPage)}
              style={{
                padding: '8px 16px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                background: currentPageFournisseurs >= Math.ceil(filteredFournisseurs.length / itemsPerPage) ? '#f5f5f5' : 'white',
                cursor: currentPageFournisseurs >= Math.ceil(filteredFournisseurs.length / itemsPerPage) ? 'not-allowed' : 'pointer',
                opacity: currentPageFournisseurs >= Math.ceil(filteredFournisseurs.length / itemsPerPage) ? 0.5 : 1,
                fontWeight: 500
              }}
            >
              Suivant →
            </button>
          </div>
        </div>

        {/* TABLEAU */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e0e0e0', backgroundColor: '#f8f8f8' }}>
                <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600 }}>👤 Nom</th>
                <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600 }}>🗺️ Région</th>
                <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600 }}>📍 Zone Production</th>
                <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600 }}>📞 Contact</th>
                <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600 }}>⚡ Statut</th>
                <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600 }}>🏆 Certifications</th>
                <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600 }}>⚙️ Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedFournisseurs.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ padding: '20px', textAlign: 'center', color: '#999' }}>
                    😔 Aucun fournisseur trouvé
                  </td>
                </tr>
              ) : (
                paginatedFournisseurs.map((fournisseur, idx) => {
                  const fournisseurRegion = fournisseur.zone_production 
                    ? (zonesProduction.find(z => z.nom === fournisseur.zone_production)?.region || '-')
                    : '-';
                  
                  return (
                    <tr 
                      key={idx} 
                      style={{ 
                        borderBottom: '1px solid #e0e0e0',
                        transition: 'background 0.2s'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = '#f9f9f9'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
                    >
                      <td style={{ padding: '12px', fontWeight: 600, color: '#333' }}>
                        {fournisseur.nom}
                      </td>
                      
                      <td style={{ padding: '12px', color: '#666', fontSize: '13px' }}>
                        {fournisseurRegion}
                      </td>
                      
                      <td style={{ padding: '12px', color: '#666', fontSize: '13px' }}>
                        {fournisseur.zone_production || '-'}
                      </td>
                      
                      <td style={{ padding: '12px', color: '#666', fontSize: '13px' }}>
                        {fournisseur.email ? (
                          <a 
                            href={`mailto:${fournisseur.email}`} 
                            style={{ color: '#2196f3', textDecoration: 'none', display: 'block' }}
                          >
                            📧 {fournisseur.email}
                          </a>
                        ) : (
                          <span style={{ color: '#999' }}>-</span>
                        )}
                        {fournisseur.telephone && (
                          <div style={{ marginTop: '4px', color: '#666' }}>
                            📱 {fournisseur.telephone}
                          </div>
                        )}
                      </td>
                      
                      <td style={{ padding: '12px' }}>
                        <StatusBadge statut={fournisseur.statut || 'Actif'} type="fournisseur" />
                      </td>
                      
                      <td style={{ padding: '12px', color: '#666', fontSize: '13px' }}>
                        {fournisseur.certifications ? (
                          <span>🏅 {fournisseur.certifications}</span>
                        ) : (
                          <span style={{ color: '#999' }}>-</span>
                        )}
                      </td>
                      
                      <td style={{ padding: '12px' }}>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            onClick={() => handleEditFournisseur(fournisseur)}
                            title="Modifier le fournisseur"
                            style={{
                              padding: '6px 12px',
                              background: '#ff9800',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontSize: '12px',
                              fontWeight: 500,
                              transition: 'background 0.2s'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = '#f57c00'}
                            onMouseLeave={(e) => e.currentTarget.style.background = '#ff9800'}
                          >
                            ✏️ Modifier
                          </button>
                          <button
                            onClick={() => askDeleteFournisseur(fournisseur)}
                            title="Supprimer le fournisseur"
                            style={{
                              padding: '6px 12px',
                              background: '#f44336',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontSize: '12px',
                              fontWeight: 500,
                              transition: 'background 0.2s'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = '#d32f2f'}
                            onMouseLeave={(e) => e.currentTarget.style.background = '#f44336'}
                          >
                            🗑️ Supprimer
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
    
        {/* PAGINATION EN BAS */}
        {filteredFournisseurs.length > itemsPerPage && (
          <div style={{ 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center', 
            gap: '10px', 
            marginTop: '20px',
            paddingTop: '15px',
            borderTop: '1px solid #e0e0e0'
          }}>
            <button
              onClick={() => setCurrentPageFournisseurs(prev => Math.max(1, prev - 1))}
              disabled={currentPageFournisseurs === 1}
              style={{
                padding: '8px 16px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                background: 'white',
                cursor: currentPageFournisseurs === 1 ? 'not-allowed' : 'pointer',
                opacity: currentPageFournisseurs === 1 ? 0.5 : 1
              }}
            >
              ⬅️ Précédent
            </button>
            
            <span style={{ color: '#666' }}>
              Page <strong>{currentPageFournisseurs}</strong> sur <strong>{Math.ceil(filteredFournisseurs.length / itemsPerPage) || 1}</strong>
            </span>
            
            <button
              onClick={() => setCurrentPageFournisseurs(prev => prev + 1)}
              disabled={currentPageFournisseurs >= Math.ceil(filteredFournisseurs.length / itemsPerPage)}
              style={{
                padding: '8px 16px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                background: 'white',
                cursor: currentPageFournisseurs >= Math.ceil(filteredFournisseurs.length / itemsPerPage) ? 'not-allowed' : 'pointer',
                opacity: currentPageFournisseurs >= Math.ceil(filteredFournisseurs.length / itemsPerPage) ? 0.5 : 1
              }}
            >
              Suivant ➡️
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default FournisseursTab;
