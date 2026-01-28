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
        // Modification d'un arbre existant
        const response = await axios.put(`${API_URL}/arbres/${editingArbre.id}`, formData);
        showMessage('Arbre mis à jour avec succès !', 'success');
        
        // ✅ FIX : Mettre à jour l'état local IMMÉDIATEMENT avec les données retournées par l'API
        // Cela évite que loadData() n'écrase les modifications avec d'anciennes données
        setArbres(prevArbres => 
          prevArbres.map(arbre => 
            arbre.id === editingArbre.id ? response.data : arbre
          )
        );
      } else {
        // Création d'un nouvel arbre
        const response = await axios.post(`${API_URL}/arbres`, formData);
        showMessage('Arbre créé avec succès !', 'success');
        
        // ✅ FIX : Ajouter le nouvel arbre immédiatement à l'état local
        setArbres(prevArbres => [...prevArbres, response.data]);
      }
      
      closeModal();
      
      // Optionnel : Recharger les données en arrière-plan pour synchroniser
      // avec d'éventuels changements faits par d'autres utilisateurs
      // Note : On ne recharge QUE si nécessaire (ex: nouvelles interventions)
      // Pour éviter d'écraser l'état local qu'on vient de mettre à jour
      
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
      
      // ✅ FIX : Retirer l'arbre de l'état local immédiatement
      setArbres(prevArbres => prevArbres.filter(a => a.id !== arbre.id));
      
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
      const newArbres = [];
      for (const arbre of validData) {
        const response = await axios.post(`${API_URL}/arbres`, arbre);
        newArbres.push(response.data);
      }
      
      // ✅ FIX : Ajouter les arbres importés immédiatement
      setArbres(prevArbres => [...prevArbres, ...newArbres]);
      
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
