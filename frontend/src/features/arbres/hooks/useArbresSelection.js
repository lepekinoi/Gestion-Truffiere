import { useState } from 'react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

export default function useArbresSelection({ arbres, filteredArbres, paginatedArbres, showMessage, loadData }) {
  const [selectedArbres, setSelectedArbres] = useState(new Set());
  const [showBulkEditModal, setShowBulkEditModal] = useState(false);
  const [bulkEditData, setBulkEditData] = useState({
    espece: '',
    variete_truffe: '',
    date_plantation: '',
	porte_greffe: '',
	rendement_estimé: '',
    circonference_cm: '',
    hauteur_m: ''
  });

  const [isProcessing, setIsProcessing] = useState(false);

  const handleSelectArbre = (id) => {
    setSelectedArbres(prev => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  };

  const handleSelectAllPage = () => {
    const ids = paginatedArbres.map(a => a.id);
    const allSelected = ids.every(id => selectedArbres.has(id));
    setSelectedArbres(prev => {
      const s = new Set(prev);
      if (allSelected) ids.forEach(id => s.delete(id));
      else ids.forEach(id => s.add(id));
      return s;
    });
  };

  const handleSelectAllFiltered = () => {
    const allIds = filteredArbres.map(a => a.id);
    setSelectedArbres(new Set(allIds));
  };

  const handleDeselectAll = () => {
    setSelectedArbres(new Set());
  };

  const handleBulkEditChange = (e) => {
    const { name, value } = e.target;
    setBulkEditData(prev => ({ ...prev, [name]: value }));
  };

  const handleBulkEditSubmit = async () => {
    if (selectedArbres.size === 0) return;

    setIsProcessing(true);
    try {
      const updates = {};
      if (bulkEditData.espece) updates.espece = bulkEditData.espece;
      if (bulkEditData.variete_truffe) updates.variete_truffe = bulkEditData.variete_truffe;
      if (bulkEditData.date_plantation) updates.date_plantation = bulkEditData.date_plantation;
      if (bulkEditData.porte_greffe) updates.porte_greffe = bulkEditData.porte_greffe;
      if (bulkEditData.etat_sanitaire) updates.etat_sanitaire = bulkEditData.etat_sanitaire;
      if (bulkEditData.rendement_estimé) updates.rendement_estimé = bulkEditData.rendement_estimé;
      if (bulkEditData.circonference_cm) updates.circonference_cm = bulkEditData.circonference_cm;
      if (bulkEditData.hauteur_m) updates.hauteur_m = bulkEditData.hauteur_m;

      if (Object.keys(updates).length === 0) {
        showMessage('Aucune modification à appliquer', 'error');
        setIsProcessing(false);
        return;
      }

      let successCount = 0;
      let errorCount = 0;

      for (const id of selectedArbres) {
        const arbre = arbres.find(a => a.id === id);
        if (!arbre) continue;
        try {
          await axios.put(`${API_URL}/arbres/${id}`, { ...arbre, ...updates });
          successCount++;
        } catch (e) {
          console.error(e);
          errorCount++;
        }
      }

      if (errorCount === 0) {
        showMessage(`${successCount} arbre(s) modifié(s) avec succès !`, 'success');
      } else {
        showMessage(`${successCount} modifié(s), ${errorCount} erreur(s)`, 'error');
      }

      loadData();
      setShowBulkEditModal(false);
      setSelectedArbres(new Set());
    } catch (e) {
      console.error(e);
      showMessage('Erreur lors de la modification groupée', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const askBulkDelete = (setConfirmModal) => {
    setConfirmModal({
      type: 'bulk-delete',
      item: null,
      title: 'Suppression groupée',
      message: `Voulez-vous mettre ${selectedArbres.size} arbre(s) à la corbeille ? Vous pourrez les restaurer plus tard.`,
      confirmText: 'Oui, mettre à la corbeille',
      confirmColor: '#ff9800'
    });
  };

  const handleConfirmBulkDelete = async (setConfirmModal) => {
    setIsProcessing(true);
    setConfirmModal(null);
    try {
      let successCount = 0;
      let errorCount = 0;

      for (const id of selectedArbres) {
        try {
          await axios.delete(`${API_URL}/arbres/${id}`);
          successCount++;
        } catch (e) {
          console.error(e);
          errorCount++;
        }
      }

      if (errorCount === 0) {
        showMessage(`${successCount} arbre(s) mis à la corbeille !`, 'success');
      } else {
        showMessage(`${successCount} supprimé(s), ${errorCount} erreur(s)`, 'error');
      }

      loadData();
      setSelectedArbres(new Set());
    } catch (e) {
      console.error(e);
      showMessage('Erreur lors de la suppression groupée', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const isAllPageSelected = paginatedArbres.length > 0 && paginatedArbres.every(a => selectedArbres.has(a.id));
  const isSomePageSelected = paginatedArbres.some(a => selectedArbres.has(a.id));

  return {
    selectedArbres,
    handleSelectArbre,
    handleSelectAllPage,
    handleSelectAllFiltered,
    handleDeselectAll,
    isAllPageSelected,
    isSomePageSelected,
    showBulkEditModal,
    setShowBulkEditModal,
    bulkEditData,
    handleBulkEditChange,
    handleBulkEditSubmit,
    askBulkDelete,
    handleConfirmBulkDelete,
    isProcessing
  };
}
