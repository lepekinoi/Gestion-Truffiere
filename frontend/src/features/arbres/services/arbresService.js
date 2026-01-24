const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

/**
 * Récupère tous les arbres
 */
export const getArbres = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/arbres`);
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    return await response.json();
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
    const response = await fetch(`${API_BASE_URL}/arbres/${id}`);
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    return await response.json();
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
    const response = await fetch(`${API_BASE_URL}/arbres`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    return await response.json();
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
    const response = await fetch(`${API_BASE_URL}/arbres/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    return await response.json();
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
    const response = await fetch(`${API_BASE_URL}/arbres/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error(`Erreur lors de la suppression de l'arbre ${id}:`, error);
    throw error;
  }
};
