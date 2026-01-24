import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

/**
 * Récupère tous les arbres
 */
export const getArbres = async () => {
  try {
    const response = await axios.get(`${API_URL}/arbres`);
    return response.data;
  } catch (error) {
    console.error('Erreur lors de la récupération des arbres:', error);
    throw error;
  }
};

/**
 * Récupère un arbre spécifique par son ID
 */
export const getArbre = async (id) => {
  try {
    const response = await axios.get(`${API_URL}/arbres/${id}`);
    return response.data;
  } catch (error) {
    console.error(`Erreur lors de la récupération de l'arbre ${id}:`, error);
    throw error;
  }
};

/**
 * Crée un nouvel arbre
 */
export const createArbre = async (data) => {
  try {
    const response = await axios.post(`${API_URL}/arbres`, data);
    return response.data;
  } catch (error) {
    console.error('Erreur lors de la création de l\'arbre:', error);
    throw error;
  }
};

/**
 * Modifie un arbre existant
 */
export const updateArbre = async (id, data) => {
  try {
    const response = await axios.put(`${API_URL}/arbres/${id}`, data);
    return response.data;
  } catch (error) {
    console.error(`Erreur lors de la modification de l'arbre ${id}:`, error);
    throw error;
  }
};

/**
 * Supprime un arbre
 */
export const deleteArbre = async (id) => {
  try {
    const response = await axios.delete(`${API_URL}/arbres/${id}`);
    return response.data;
  } catch (error) {
    console.error(`Erreur lors de la suppression de l'arbre ${id}:`, error);
    throw error;
  }
};
