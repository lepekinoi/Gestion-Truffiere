import React, { useState } from 'react';
import ConfirmModal from '../../../components/ConfirmModal';

export default function ArbresTrashModal({
  show,
  onClose,
  arbres,
  loading,
  onRestore,
  onDeletePermanent,
  onEmptyTrash,
  formatDate
}) {
  const [confirmModal, setConfirmModal] = useState({
    show: false,
    type: null, // 'restore', 'delete', 'empty'
    arbre: null,
    isLoading: false
  });

  const handleOpenConfirm = (type, arbre = null) => {
    setConfirmModal({
      show: true,
      type,
      arbre,
      isLoading: false
    });
  };

  const handleCloseConfirm = () => {
    setConfirmModal({
      show: false,
      type: null,
      arbre: null,
      isLoading: false
    });
  };

  const handleConfirmAction = async () => {
    setConfirmModal(prev => ({ ...prev, isLoading: true }));
    
    try {
      switch (confirmModal.type) {
        case 'restore':
          await onRestore(confirmModal.arbre.id);
          break;
        case 'delete':
          await onDeletePermanent(confirmModal.arbre);
          break;
        case 'empty':
          await onEmptyTrash();
          break;
        default:
          break;
      }
    } finally {
      handleCloseConfirm();
    }
  };

  const getConfirmConfig = () => {
    switch (confirmModal.type) {
      case 'restore':
        return {
          title: '🔄 Restaurer l\'arbre',
          message: `Êtes-vous sûr de vouloir restaurer l'arbre ${confirmModal.arbre?.numero} ? Il réapparaîtra dans la liste principale.`,
          confirmText: '✓ Restaurer',
          isDestructive: false
        };
      case 'delete':
        return {
          title: '🗑️ Supprimer définitivement',
          message: `Êtes-vous absolument sûr de vouloir SUPPRIMER DÉFINITIVEMENT l'arbre ${confirmModal.arbre?.numero} ? Cette action est irréversible et supprimera aussi toutes les données associées.`,
          confirmText: '✕ Supprimer définitivement',
          isDestructive: true
        };
      case 'empty':
        return {
          title: '🗑️ Vider la corbeille',
          message: 'Êtes-vous absolument sûr de vouloir vider complètement la corbeille ? Tous les arbres supprimés seront détruits définitivement. Cette action est irréversible.',
          confirmText: '✕ Vider la corbeille',
          isDestructive: true
        };
      default:
        return {};
    }
  };

  if (!show) return null;

  const confirmConfig = getConfirmConfig();

  return (
    <>
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '800px' }}>

          <div className="modal-header">
            <h3>🗑️ Corbeille - Arbres supprimés</h3>
            <button className="modal-close" onClick={onClose}>✕</button>
          </div>

          {loading ? (
            <div style={{ padding: '2rem', textAlign: 'center' }}>Chargement...</div>
          ) : arbres.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#666' }}>
              La corbeille est vide
            </div>
          ) : (
            <>
              <div style={{
                marginBottom: '1rem',
                padding: '1rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: '#fff3cd',
                borderRadius: '8px',
                border: '1px solid #ffc107'
              }}>
                <span style={{ fontWeight: '500', color: '#664d03' }}>
                  ⚠️ {arbres.length} arbre(s) dans la corbeille
                </span>
                <button 
                  className="btn btn-danger" 
                  onClick={() => handleOpenConfirm('empty')}
                  style={{ padding: '0.5rem 1rem' }}
                >
                  🗑️ Vider la corbeille
                </button>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table>
                  <thead>
                    <tr>
                      <th>Numéro</th>
                      <th>Espèce</th>
                      <th>Parcelle</th>
                      <th>Supprimé le</th>
                      <th>Actions</th>
                    </tr>
                  </thead>

                  <tbody>
                    {arbres.map(arbre => (
                      <tr key={arbre.id}>
                        <td><strong>{arbre.numero}</strong></td>
                        <td>{arbre.espece || '-'}</td>
                        <td>{arbre.parcelle_nom || '-'}</td>
                        <td>
                          <small>{formatDate(arbre.deleted_at)}</small>
                        </td>
                        <td>
                          <button
                            className="btn btn-primary"
                            onClick={() => handleOpenConfirm('restore', arbre)}
                            style={{ marginRight: '0.5rem', padding: '0.4rem 0.8rem', fontSize: '0.9rem' }}
                            title="Restaurer"
                          >
                            ↩️ Restaurer
                          </button>

                          <button
                            className="btn btn-danger"
                            onClick={() => handleOpenConfirm('delete', arbre)}
                            style={{ padding: '0.4rem 0.8rem', fontSize: '0.9rem' }}
                            title="Supprimer définitivement"
                          >
                            ✗ Supprimer
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          <div className="modal-footer">
            <button className="btn btn-secondary" onClick={onClose}>Fermer</button>
          </div>

        </div>
      </div>

      {/* Modal de confirmation */}
      <ConfirmModal
        show={confirmModal.show}
        title={confirmConfig.title}
        message={confirmConfig.message}
        confirmText={confirmConfig.confirmText}
        cancelText="Annuler"
        isDestructive={confirmConfig.isDestructive}
        onConfirm={handleConfirmAction}
        onCancel={handleCloseConfirm}
        isLoading={confirmModal.isLoading}
      />
    </>
  );
}