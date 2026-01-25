import { useState, useMemo } from 'react';

export default function useArbresFilters(arbres) {
  const [filters, setFilters] = useState({
    search: '',
    parcelle: '',
    espece: '',
    etat_sanitaire: '',
    variete_truffe: '',
    avecPosition: ''
  });

  const filterOptions = useMemo(() => {
    const especes = [...new Set(arbres.map(a => a.espece).filter(Boolean))].sort();
    const etats_sanitaire = [...new Set(arbres.map(a => a.etat_sanitaire).filter(Boolean))].sort();
    const varietes = [...new Set(arbres.map(a => a.variete_truffe).filter(Boolean))].sort();
    return { especes, etats_sanitaire, varietes };
  }, [arbres]);

  const filteredArbres = useMemo(() => {
    return arbres.filter(arbre => {
      if (filters.search) {
        const s = filters.search.toLowerCase();
        const matchNumero = arbre.numero?.toLowerCase().includes(s);
        const matchNotes = arbre.notes?.toLowerCase().includes(s);
        const matchEspece = arbre.espece?.toLowerCase().includes(s);
        const matchParcelle = arbre.parcelle_nom?.toLowerCase().includes(s);
        if (!matchNumero && !matchNotes && !matchEspece && !matchParcelle) return false;
      }
      if (filters.parcelle && arbre.parcelle_id !== parseInt(filters.parcelle)) return false;
      if (filters.espece && arbre.espece !== filters.espece) return false;
      if (filters.etat_sanitaire && arbre.etat_sanitaire !== filters.etat_sanitaire) return false;
      if (filters.variete_truffe && arbre.variete_truffe !== filters.variete_truffe) return false;
      if (filters.avecPosition === 'oui' && (!arbre.latitude || !arbre.longitude)) return false;
      if (filters.avecPosition === 'non' && (arbre.latitude && arbre.longitude)) return false;
      return true;
    });
  }, [arbres, filters]);

  const handleFilterChange = (name, value) => {
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const resetFilters = () => {
    setFilters({
      search: '',
      parcelle: '',
      espece: '',
      etat_sanitaire: '',
      variete_truffe: '',
      avecPosition: ''
    });
  };

  const hasActiveFilters = Object.values(filters).some(v => v !== '');

  return {
    filters,
    filterOptions,
    filteredArbres,
    hasActiveFilters,
    handleFilterChange,
    resetFilters
  };
}
