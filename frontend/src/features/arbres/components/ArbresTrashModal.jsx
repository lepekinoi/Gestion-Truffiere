import React from 'react';

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
  if (!show) return null;

  return (
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
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <span>{arbres.length} arbre(s) dans la corbeille</span>
              <button className="btn btn-danger" onClick={onEmptyTrash}>
                Vider la corbeille
              </button>
            </div>

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
                    <td>{arbre.espece}</td>
                    <td>{arbre.parcelle_nom || '-'}</td>
                    <td>{formatDate(arbre.deleted_at)}</td>
                    <td>
                      <button
                        className="btn btn-primary"
                        onClick={() => onRestore(arbre.id)}
                        style={{ marginRight: '0.5rem' }}
                      >
                        ↩️ Restaurer
                      </button>

                      <button
                        className="btn btn-danger"
                        onClick={() => onDeletePermanent(arbre)}
                      >
                        ✕ Supprimer
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Fermer</button>
        </div>

      </div>
    </div>
  );
}
