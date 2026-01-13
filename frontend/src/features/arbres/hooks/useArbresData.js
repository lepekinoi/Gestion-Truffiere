import { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

export default function useArbresData() {
  const [arbres, setArbres] = useState([]);
  const [parcelles, setParcelles] = useState([]);
  const [interventions, setInterventions] = useState([]);
  const [loading, setLoading] = useState(true);

  const [message, setMessage] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [editingArbre, setEditingArbre] = useState(null);

  const [showCorbeille, setShowCorbeille] = useState(false);
  const [arbresCorbeille, setArbresCorbeille] = useState([]);
  const [loadingCorbeille, setLoadingCorbeille] = useState(false);

  const [showImportModal, setShowImportModal] = useState(false);

  const showMessage = (text, type = 'success') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 4000);
  };

  const loadData = async () => {
    try {
      const [arbresRes, parcellesRes, interventionsRes] = await Promise.all([
        axios.get(`${API_URL}/arbres`),
        axios.get(`${API_URL}/parcelles`),
        axios.get(`${API_URL}/interventions`)
      ]);
      setArbres(arbresRes.data);
      setParcelles(parcellesRes.data);
      setInterventions(interventionsRes.data);
    } catch (error) {
      console.error('Erreur lors du chargement:', error);
      showMessage('Erreur lors du chargement des données', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Corbeille
  const loadCorbeille = async () => {
    setLoadingCorbeille(true);
    try {
      const res = await axios.get(`${API_URL}/arbres/corbeille`);
      setArbresCorbeille(res.data);
    } catch (e) {
      console.error('Erreur corbeille:', e);
      setArbresCorbeille([]);
    } finally {
      setLoadingCorbeille(false);
    }
  };

  const handleRestaurer = async (id) => {
    try {
      await axios.post(`${API_URL}/arbres/corbeille/${id}/restaurer`);
      showMessage('Arbre restauré avec succès !', 'success');
      loadCorbeille();
      loadData();
    } catch (e) {
      console.error(e);
      showMessage('Erreur lors de la restauration', 'error');
    }
  };

  const handleDeletePermanent = async (arbre) => {
    setIsProcessing(true);
    try {
      await axios.delete(`${API_URL}/arbres/corbeille/${arbre.id}`);
      showMessage('Arbre supprimé définitivement !', 'success');
      loadCorbeille();
    } catch (e) {
      console.error(e);
      showMessage('Erreur lors de la suppression définitive', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleEmptyTrash = async () => {
    setIsProcessing(true);
    try {
      await axios.delete(`${API_URL}/arbres/corbeille`);
      showMessage('Corbeille vidée !', 'success');
      loadCorbeille();
    } catch (e) {
      console.error(e);
      showMessage('Erreur lors du vidage de la corbeille', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  // CRUD arbre
  const handleSubmit = async (formData, editingArbre, closeModal) => {
    setIsProcessing(true);
    try {
      if (editingArbre) {
        await axios.put(`${API_URL}/arbres/${editingArbre.id}`, formData);
        showMessage('Arbre mis à jour avec succès !', 'success');
      } else {
        await axios.post(`${API_URL}/arbres`, formData);
        showMessage('Arbre créé avec succès !', 'success');
      }
      loadData();
      closeModal();
    } catch (e) {
      console.error(e);
      showMessage('Erreur lors de la sauvegarde de l\'arbre', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleEdit = (arbre, openModal, prepareForm) => {
    prepareForm(arbre);
    openModal();
  };

  const handleDelete = async (arbre, after) => {
    setIsProcessing(true);
    try {
      await axios.delete(`${API_URL}/arbres/${arbre.id}`);
      showMessage('Arbre mis à la corbeille', 'success');
      loadData();
      after && after();
    } catch (e) {
      console.error(e);
      showMessage('Erreur lors de la suppression de l\'arbre', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  // Import CSV
  const handleImportCSV = async (validData) => {
    try {
      for (const arbre of validData) {
        await axios.post(`${API_URL}/arbres`, arbre);
      }
      loadData();
      showMessage(`${validData.length} arbre(s) importé(s) avec succès !`, 'success');
    } catch (e) {
      console.error(e);
      throw new Error('Erreur lors de l\'import des arbres');
    }
  };

  return {
    arbres,
    parcelles,
    interventions,
    loading,
    message,
    showMessage,
    isProcessing,
    loadData,

    showModal,
    setShowModal,
    editingArbre,
    setEditingArbre,
    handleSubmit,
    handleEdit,
    handleDelete,

    showCorbeille,
    setShowCorbeille,
    arbresCorbeille,
    loadingCorbeille,
    loadCorbeille,
    handleRestaurer,
    handleDeletePermanent,
    handleEmptyTrash,

    showImportModal,
    setShowImportModal,
    handleImportCSV
  };
}
