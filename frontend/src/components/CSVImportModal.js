import React, { useState } from 'react';
import { parseCSVFile, downloadCSVTemplate } from '../utils/csvImport';

/**
 * Modal d'import CSV réutilisable
 * @param {Object} props
 * @param {boolean} props.show - Afficher/masquer la modal
 * @param {Function} props.onClose - Fonction de fermeture
 * @param {Function} props.onImport - Fonction appelée avec les données validées
 * @param {Function} props.validateFunction - Fonction de validation spécifique
 * @param {string} props.type - Type de données (parcelles, arbres, etc.)
 * @param {string} props.title - Titre de la modal
 */
function CSVImportModal({ show, onClose, onImport, validateFunction, type, title, dependencies = {} }) {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState([]);
  const [validData, setValidData] = useState([]);
  const [step, setStep] = useState(1); // 1: Upload, 2: Preview, 3: Result

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
    setErrors([]);
    setValidData([]);
    setStep(1);
  };

  const handleParse = async () => {
    if (!file) {
      setErrors(['Veuillez sélectionner un fichier']);
      return;
    }

    setLoading(true);
    setErrors([]);

    try {
      // Parse le CSV
      const data = await parseCSVFile(file);
      
      // Valide les données
      const { validData: validated, errors: validationErrors } = validateFunction(data, dependencies);
      
      setValidData(validated);
      setErrors(validationErrors);
      setStep(2);

    } catch (error) {
      setErrors([error.message]);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmImport = async () => {
    if (validData.length === 0) {
      setErrors(['Aucune donnée valide à importer']);
      return;
    }

    setLoading(true);
    try {
      await onImport(validData);
      setStep(3);
    } catch (error) {
      setErrors([`Erreur lors de l'import: ${error.message}`]);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setErrors([]);
    setValidData([]);
    setStep(1);
    onClose();
  };

  const handleDownloadTemplate = () => {
    downloadCSVTemplate(type);
  };

  if (!show) return null;

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '700px' }}>
        <div className="modal-header">
          <h3>📤 {title}</h3>
          <button className="close-button" onClick={handleClose}>×</button>
        </div>

        <div className="modal-body">
          {step === 1 && (
            <>
              <div style={{ marginBottom: '1.5rem', padding: '1rem', background: '#e3f2fd', borderRadius: '8px' }}>
                <h4 style={{ margin: '0 0 0.5rem 0' }}>📋 Instructions</h4>
                <ol style={{ margin: '0.5rem 0 0 0', paddingLeft: '1.5rem' }}>
                  <li>Téléchargez le template CSV ci-dessous</li>
                  <li>Remplissez-le avec vos données (Excel, LibreOffice, etc.)</li>
                  <li>Sauvegardez en format CSV (UTF-8)</li>
                  <li>Importez le fichier ici</li>
                </ol>
                <button
                  className="btn btn-secondary"
                  onClick={handleDownloadTemplate}
                  style={{ marginTop: '1rem' }}
                >
                  📥 Télécharger le template CSV
                </button>
              </div>

              <div className="form-group">
                <label>Fichier CSV à importer</label>
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  style={{
                    padding: '0.75rem',
                    border: '2px dashed #ccc',
                    borderRadius: '8px',
                    width: '100%',
                    cursor: 'pointer'
                  }}
                />
                {file && (
                  <div style={{ marginTop: '0.5rem', color: '#666', fontSize: '0.9rem' }}>
                    📄 Fichier sélectionné: <strong>{file.name}</strong>
                  </div>
                )}
              </div>

              {errors.length > 0 && (
                <div style={{ marginTop: '1rem', padding: '1rem', background: '#ffebee', borderRadius: '8px', color: '#c62828' }}>
                  <strong>⚠️ Erreurs détectées:</strong>
                  <ul style={{ margin: '0.5rem 0 0 0', paddingLeft: '1.5rem' }}>
                    {errors.map((error, index) => (
                      <li key={index}>{error}</li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}

          {step === 2 && (
            <>
              <div style={{ marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <div>
                    <h4 style={{ margin: 0, color: '#155724' }}>✅ {validData.length} ligne(s) valide(s)</h4>
                    {errors.length > 0 && (
                      <p style={{ margin: '0.5rem 0 0 0', color: '#c62828', fontSize: '0.9rem' }}>
                        ⚠️ {errors.length} erreur(s) détectée(s)
                      </p>
                    )}
                  </div>
                  <button className="btn btn-secondary" onClick={() => setStep(1)}>
                    ← Retour
                  </button>
                </div>

                {errors.length > 0 && (
                  <details style={{ marginBottom: '1rem', padding: '1rem', background: '#fff3cd', borderRadius: '8px' }}>
                    <summary style={{ cursor: 'pointer', fontWeight: 'bold', color: '#856404' }}>
                      Voir les erreurs ({errors.length})
                    </summary>
                    <ul style={{ margin: '0.5rem 0 0 0', paddingLeft: '1.5rem', fontSize: '0.9rem' }}>
                      {errors.slice(0, 10).map((error, index) => (
                        <li key={index}>{error}</li>
                      ))}
                      {errors.length > 10 && (
                        <li><em>... et {errors.length - 10} autre(s) erreur(s)</em></li>
                      )}
                    </ul>
                  </details>
                )}

                {validData.length > 0 && (
                  <div style={{ maxHeight: '300px', overflow: 'auto', border: '1px solid #ddd', borderRadius: '8px' }}>
                    <table style={{ width: '100%', fontSize: '0.85rem' }}>
                      <thead>
                        <tr style={{ background: '#f5f5f5', position: 'sticky', top: 0 }}>
                          <th style={{ padding: '0.5rem', textAlign: 'left' }}>#</th>
                          {Object.keys(validData[0]).slice(0, 4).map((key) => (
                            <th key={key} style={{ padding: '0.5rem', textAlign: 'left' }}>{key}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {validData.slice(0, 10).map((row, index) => (
                          <tr key={index} style={{ borderBottom: '1px solid #eee' }}>
                            <td style={{ padding: '0.5rem' }}>{index + 1}</td>
                            {Object.values(row).slice(0, 4).map((value, i) => (
                              <td key={i} style={{ padding: '0.5rem' }}>
                                {value !== null && value !== undefined ? String(value).substring(0, 30) : '-'}
                              </td>
                            ))}
                          </tr>
                        ))}
                        {validData.length > 10 && (
                          <tr>
                            <td colSpan="5" style={{ padding: '0.5rem', textAlign: 'center', fontStyle: 'italic', color: '#666' }}>
                              ... et {validData.length - 10} autre(s) ligne(s)
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div style={{ padding: '1rem', background: '#e8f5e9', borderRadius: '8px', marginBottom: '1rem' }}>
                <p style={{ margin: 0 }}>
                  ⚡ <strong>{validData.length} enregistrement(s)</strong> seront importés dans la base de données.
                  {errors.length > 0 && <span style={{ color: '#c62828' }}> Les lignes en erreur seront ignorées.</span>}
                </p>
              </div>
            </>
          )}

          {step === 3 && (
            <div style={{ textAlign: 'center', padding: '2rem' }}>
              <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>✅</div>
              <h3 style={{ color: '#155724', margin: '0 0 0.5rem 0' }}>Import réussi !</h3>
              <p style={{ color: '#666', margin: 0 }}>{validData.length} enregistrement(s) importé(s)</p>
            </div>
          )}
        </div>

        <div className="modal-footer">
          {step === 1 && (
            <>
              <button className="btn btn-secondary" onClick={handleClose}>Annuler</button>
              <button
                className="btn btn-primary"
                onClick={handleParse}
                disabled={!file || loading}
              >
                {loading ? 'Analyse en cours...' : '🔍 Analyser le fichier'}
              </button>
            </>
          )}

          {step === 2 && (
            <>
              <button className="btn btn-secondary" onClick={handleClose}>Annuler</button>
              <button
                className="btn btn-primary"
                onClick={handleConfirmImport}
                disabled={validData.length === 0 || loading}
              >
                {loading ? 'Import en cours...' : `✅ Importer ${validData.length} ligne(s)`}
              </button>
            </>
          )}

          {step === 3 && (
            <button className="btn btn-primary" onClick={handleClose}>Fermer</button>
          )}
        </div>
      </div>
    </div>
  );
}

export default CSVImportModal;