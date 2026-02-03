// ============================================================
// CONSTANTS - Configuration globale Achats & Fournisseurs
// ============================================================

export const STATUT_FOURNISSEUR_COLORS = {
  'Actif': { background: '#d4edda', color: '#155724', border: '#28a745' },
  'Inactif': { background: '#f8d7da', color: '#721c24', border: '#dc3545' },
  'Suspendu': { background: '#fff3cd', color: '#856404', border: '#ffc107' }
};

export const STATUT_COMMANDE_COLORS = {
  'En attente': { background: '#fff3cd', color: '#856404', border: '#ffc107' },
  'Confirmée': { background: '#cce5ff', color: '#004085', border: '#007bff' },
  'Expédiée': { background: '#d1ecf1', color: '#0c5460', border: '#17a2b8' },
  'Livrée': { background: '#d4edda', color: '#155724', border: '#28a745' },
  'Réceptionnée': { background: '#d4edda', color: '#155724', border: '#28a745' },
  'Annulée': { background: '#f8d7da', color: '#721c24', border: '#dc3545' }
};

export const COLORS_PIE_CHART = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

// ✅ ENUMS HARMONISÉS AVEC LA BASE PostgreSQL ET RÉCOLTES
export const CALIBRES_TEXTE = [
  'Petit (moins de 20g)',
  'Moyen (20-50g)',
  'Gros (50-100g)',
  'Très gros (plus de 100g)'
];

export const QUALITES = ['Extra', '1ère', '2e'];

export const MATURITES = ['Immature', 'À point', 'Mature', 'Très mature'];

// Mappings calibres mm <-> texte
export const CALIBRE_MM_TO_TEXTE = {
  20: 'Petit (moins de 20g)',
  30: 'Moyen (20-50g)',
  50: 'Gros (50-100g)',
  70: 'Très gros (plus de 100g)'
};

export const CALIBRE_TEXTE_TO_MM = {
  'Petit (moins de 20g)': 20,
  'Moyen (20-50g)': 30,
  'Gros (50-100g)': 50,
  'Très gros (plus de 100g)': 70
};

// Fonctions de conversion
export const convertirMmEnCalibreTexte = (calibreMm) => {
  return CALIBRE_MM_TO_TEXTE[calibreMm] || '';
};

export const convertirCalibreTexteEnMm = (calibreTexte) => {
  return CALIBRE_TEXTE_TO_MM[calibreTexte] || null;
};
