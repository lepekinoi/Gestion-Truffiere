// ============================================================
// CommandesAchatsTab.jsx - Onglet Commandes d'ACHAT Fournisseurs
// ⚠️ NE PAS CONFONDRE avec les commandes CLIENTS (commercial)
// ============================================================

import React from 'react';
import StatsCard from '../StatsCard';
import StatusBadge from '../StatusBadge';

const CommandesAchatsTab = ({
  // Stats
  statsCommandes,
  
  // Données
  commandes,
  fournisseurs,
  
  // Filtres
  filterStatutCommande,
  setFilterStatutCommande,
  
  // Pagination
  currentPageCommandes,
  setCurrentPageCommandes,
  filteredCommandes,
  paginatedCommandes,
  itemsPerPage,
  
  // Actions
  openNewCommandeModal,
  handleEditCommande,
  askDeleteCommande,
  getFournisseurName
}) => {
  return (
    <div>
      {/* STATS COMMANDES */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '15px',
        marginBottom: '30px'
      }}>
        <StatsCard
          label="TOTAL"
          value={statsCommandes.total}
          color="#2196f3"
        />
        <StatsCard
          label="EN ATTENTE"
          value={statsCommandes.enAttente}
          color="#ff9800"
        />
        <StatsCard
          label="LIVRÉES"
          value={statsCommandes.livrees}
          color="#4caf50"
        />
        <StatsCard
          label="MONTANT TOTAL"
          value={`${statsCommandes.montantTotal.toFixed(2)} €`}
          color="#9c27b0"
        />
      </div>
      
      {/* CONTRÔLES COMMANDES */}
      <div style={{
        display: 'flex',
        gap: '15px',
        marginBottom: '20px',
        flexWrap: 'wrap',
        alignItems: 'center'
      }}>
        <button
          onClick={openNewCommandeModal}
          style={{
            padding: '10px 20px',
            background: '#2196f3',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: 600
          }}
        >
          ➕ Nouvelle Commande
        </button>
        
        <select
          value={filterStatutCommande}
          onChange={(e) => {
            setFilterStatutCommande(e.target.value);
            setCurrentPageCommandes(1);
          }}
          style={{
            padding: '10px 15px',
            border: '1px solid #ddd',
            borderRadius: '6px'
          }}
        >
          <option value="all">Tous les statuts</option>
          <option value="En attente">En attente</option>
          <option value="Confirmée">Confirmée</option>
          <option value="Expédiée">Expédiée</option>
          <option value="Livrée">Livrée</option>
          <option value="Réceptionnée">Réceptionnée</option>
          <option value="Annulée">Annulée</option>
        </select>
      </div>
      
      {/* TABLEAU COMMANDES */}
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
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600 }}>N° Commande</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600 }}>Fournisseur</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600 }}>Date</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600 }}>Livraison prévue</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600 }}>Montant</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600 }}>Statut</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginatedCommandes.length === 0 ? (
              <tr>
                <td colSpan="7" style={{ padding: '20px', textAlign: 'center', color: '#999' }}>
                  Aucune commande
                </td>
              </tr>
            ) : (
              paginatedCommandes.map((commande, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid #e0e0e0' }}>
                  <td style={{ padding: '12px', fontWeight: '500' }}>
                    {commande.numero_commande}
                  </td>
                  <td style={{ padding: '12px', color: '#666' }}>
                    {getFournisseurName(commande.fournisseur_id)}
                  </td>
                  <td style={{ padding: '12px', color: '#666' }}>
                    {commande.date_commande ? new Date(commande.date_commande).toLocaleDateString('fr-FR') : '-'}
                  </td>
                  <td style={{ padding: '12px', color: '#666' }}>
                    {commande.date_livraison_prevue ? new Date(commande.date_livraison_prevue).toLocaleDateString('fr-FR') : '-'}
                  </td>
                  <td style={{ padding: '12px', fontWeight: '600' }}>
                    {parseFloat(commande.montant_total || 0).toFixed(2)} €
                  </td>
                  <td style={{ padding: '12px' }}>
                    <StatusBadge statut={commande.statut} type="commande" />
                  </td>
                  <td style={{ padding: '12px' }}>
                    <button
                      onClick={() => handleEditCommande(commande)}
                      style={{
                        marginRight: '10px',
                        padding: '6px 12px',
                        background: '#ff9800',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '12px'
                      }}
                    >
                      Modifier
                    </button>
                    <button
                      onClick={() => askDeleteCommande(commande)}
                      style={{
                        padding: '6px 12px',
                        background: '#f44336',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '12px'
                      }}
                    >
                      Supprimer
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      
      {/* PAGINATION */}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        gap: '10px',
        marginTop: '20px'
      }}>
        <button
          onClick={() => setCurrentPageCommandes(prev => Math.max(1, prev - 1))}
          disabled={currentPageCommandes === 1}
          style={{
            padding: '8px 16px',
            border: '1px solid #ddd',
            borderRadius: '4px',
            background: 'white',
            cursor: currentPageCommandes === 1 ? 'not-allowed' : 'pointer',
            opacity: currentPageCommandes === 1 ? 0.5 : 1
          }}
        >
          ← Précédent
        </button>
        <span style={{ color: '#666' }}>
          Page {currentPageCommandes} sur {Math.ceil(filteredCommandes.length / itemsPerPage) || 1}
        </span>
        <button
          onClick={() => setCurrentPageCommandes(prev => prev + 1)}
          disabled={currentPageCommandes >= Math.ceil(filteredCommandes.length / itemsPerPage)}
          style={{
            padding: '8px 16px',
            border: '1px solid #ddd',
            borderRadius: '4px',
            background: 'white',
            cursor: currentPageCommandes >= Math.ceil(filteredCommandes.length / itemsPerPage) ? 'not-allowed' : 'pointer',
            opacity: currentPageCommandes >= Math.ceil(filteredCommandes.length / itemsPerPage) ? 0.5 : 1
          }}
        >
          Suivant →
        </button>
      </div>
    </div>
  );
};

export default CommandesAchatsTab;
