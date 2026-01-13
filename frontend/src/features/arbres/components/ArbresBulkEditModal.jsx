import React from 'react';

export default function ArbresBulkEditModal({
  show,
  onClose,
  selectedCount,
  bulkEditData,
  onChange,
  onSubmit
}) {
  if (!show) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
        
        <div className="modal-header">
          <h3>✏️ Modifier {selectedCount} arbre(s)</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div style={{ padding: '1rem', background: '#fff3e0', borderRadius: '8px', marginBottom: '1rem' }}>
          <p style={{ margin: 0, color: '#e65100' }}>
            <strong>⚠️ Attention :</strong> seuls les champs remplis seront modifiés.
          </p>
        </div>

        <div className="form-grid">
          <div className="form-group">
            <label>Espèce</label>
            <select name="espece" value={bulkEditData.espece} onChange={onChange}>
              <option value="">-- Ne pas modifier --</option>
              <option value="Chênes vert (V)">Chênes vert (V)</option>
              <option value="Chêne pubescent (P)">Chêne pubescent (P)</option>
              <option value="Chênes Cerris (Cé)">Chênes Cerris (Cé)</option>
              <option value="Chêne pédonculé">Chêne pédonculé</option>
              <option value="Noisetier">Noisetier</option>
              <option value="Charmes (C)">Charmes (C)</option>
              <option value="Tilleul">Tilleul</option>
              <option value="Pin">Pin</option>
            </select>
          </div>

          <div className="form-group">
            <label>Variété</label>
            <select name="variete_truffe" value={bulkEditData.variete_truffe} onChange={onChange}>
              <option value="">-- Ne pas modifier --</option>
              <option value="Tuber melanosporum">Tuber melanosporum</option>
              <option value="Tuber aestivum">Tuber aestivum</option>
              <option value="Tuber brumale">Tuber brumale</option>
              <option value="Tuber uncinatum">Tuber uncinatum</option>
            </select>
          </div>

          <div className="form-group">
            <label>Date plantation</label>
            <input type="date" name="date_plantation" value={bulkEditData.date_plantation} onChange={onChange} />
          </div>

          <div className="form-group">
            <label>État</label>
            <select name="etat" value={bulkEditData.etat} onChange={onChange}>
              <option value="">-- Ne pas modifier --</option>
              <option value="Bon">Bon</option>
              <option value="Moyen">Moyen</option>
              <option value="Mauvais">Mauvais</option>
              <option value="Mort">Mort</option>
            </select>
          </div>

          <div className="form-group">
            <label>Circonférence (cm)</label>
            <input type="number" name="circonference_cm" value={bulkEditData.circonference_cm} onChange={onChange} step="0.1" />
          </div>

          <div className="form-group">
            <label>Hauteur (m)</label>
            <input type="number" name="hauteur_m" value={bulkEditData.hauteur_m} onChange={onChange} step="0.1" />
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Annuler</button>
          <button className="btn btn-primary" onClick={onSubmit}>
            Appliquer à {selectedCount} arbre(s)
          </button>
        </div>

      </div>
    </div>
  );
}
