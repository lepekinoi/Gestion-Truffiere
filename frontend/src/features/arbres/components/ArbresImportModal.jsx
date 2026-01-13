import React from 'react';
import CSVImportModal from '../../../components/CSVImportModal';
import { validateArbresCSV } from '../../../utils/csvImport';

export default function ArbresImportModal({
  show,
  onClose,
  onImport,
  parcelles
}) {
  return (
    <CSVImportModal
      show={show}
      onClose={onClose}
      onImport={onImport}
      validateFunction={validateArbresCSV}
      type="arbres"
      title="Importer des arbres depuis CSV"
      dependencies={{ parcelles }}
    />
  );
}
