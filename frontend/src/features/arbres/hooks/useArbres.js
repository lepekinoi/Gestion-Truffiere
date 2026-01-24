import { useState, useEffect } from 'react';
import { getArbres } from '../services/arbresService';
import { ARBRE_ERRORS } from '../constants/arbresConstants';

/**
 * Hook personnalisé pour gérer la récupération et l'état des arbres
 * @returns {Object} { arbres, loading, error, refetch }
 */
export const useArbres = () => {
  const [arbres, setArbres] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchArbres = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getArbres();
      setArbres(data);
    } catch (err) {
      setError(ARBRE_ERRORS.FETCH_FAILED);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchArbres();
  }, []);

  return {
    arbres,
    loading,
    error,
    refetch: fetchArbres,
  };
};
