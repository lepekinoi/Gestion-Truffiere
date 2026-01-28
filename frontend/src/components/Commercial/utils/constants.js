// ============================================================
// constants.js - Constantes du module Commercial
// ============================================================
// Extraction des constantes depuis Commercial.js pour améliorer
// la maintenabilité et la réutilisabilité du code
// ============================================================

/**
 * Couleurs et styles pour les statuts de commandes
 * Utilisé dans l'affichage des badges de statut
 */
export const STATUT_COLORS_COMMANDES = {
  'En attente': {
    background: '#fff3cd',
    color: '#856404',
    border: '#ffc107'
  },
  'Confirmée': {
    background: '#cce5ff',
    color: '#004085',
    border: '#007bff'
  },
  'En préparation': {
    background: '#d4edda',
    color: '#155724',
    border: '#28a745'
  },
  'Livrée': {
    background: '#d1ecf1',
    color: '#0c5460',
    border: '#17a2b8'
  },
  'Annulée': {
    background: '#f8d7da',
    color: '#721c24',
    border: '#dc3545'
  }
};

/**
 * Couleurs et styles pour les statuts de ventes
 * Utilisé dans l'affichage des badges de statut
 */
export const STATUT_COLORS_VENTES = {
  'En attente': {
    background: '#fff3cd',
    color: '#856404',
    border: '#ffc107'
  },
  'Payée': {
    background: '#d4edda',
    color: '#155724',
    border: '#28a745'
  },
  'Annulée': {
    background: '#f8d7da',
    color: '#721c24',
    border: '#dc3545'
  }
};

/**
 * Palette de couleurs pour les graphiques Pie Charts
 * Utilisé dans les graphiques recharts
 */
export const COLORS_PIE_CHART = [
  '#0088FE',
  '#00C49F',
  '#FFBB28',
  '#FF8042',
  '#8884d8'
];

/**
 * Taux de TVA appliqué aux transactions
 * Format : 0.055 = 5.5%
 */
export const TVA_RATE = 0.055;

/**
 * Types de clients avec leurs emojis associés
 * Utilisé pour l'affichage des tuiles clients et les filtres
 */
export const CLIENT_TYPES = {
  'Particulier': '👤',
  'Restaurant': '🍽️',
  'Grossiste': '📦',
  'Association': '🤝'
};

/**
 * Liste des statuts disponibles pour les commandes
 * Ordre logique du workflow
 */
export const STATUTS_COMMANDE = [
  'En attente',
  'Confirmée',
  'En préparation',
  'Livrée',
  'Annulée'
];

/**
 * Liste des statuts disponibles pour les ventes
 */
export const STATUTS_VENTE = [
  'En attente',
  'Payée',
  'Annulée'
];

/**
 * Liste des types de clients disponibles
 */
export const TYPES_CLIENT = [
  'Particulier',
  'Restaurant',
  'Grossiste',
  'Association'
];

/**
 * Configuration de pagination par défaut
 */
export const PAGINATION_DEFAULTS = {
  CLIENTS_PER_PAGE: 50,
  VENTES_PER_PAGE: 20,
  COMMANDES_PER_PAGE: 50,
  PAGE_SIZE_OPTIONS: [25, 50, 100, 200]
};

/**
 * Messages de notification par défaut
 */
export const MESSAGES = {
  CLIENT: {
    CREATE_SUCCESS: 'Client créé avec succès !',
    UPDATE_SUCCESS: 'Client mis à jour avec succès !',
    DELETE_SUCCESS: 'Client supprimé avec succès !',
    DELETE_CONFIRM: 'Êtes-vous sûr de vouloir supprimer ce client ? Cette action est irréversible.',
    ERROR: 'Erreur lors de la sauvegarde du client'
  },
  COMMANDE: {
    CREATE_SUCCESS: 'Commande enregistrée avec succès !',
    UPDATE_SUCCESS: 'Commande mise à jour avec succès !',
    DELETE_SUCCESS: 'Commande supprimée avec succès !',
    DELETE_CONFIRM: 'Êtes-vous sûr de vouloir supprimer cette commande ?',
    ERROR: 'Erreur lors de la sauvegarde de la commande'
  },
  VENTE: {
    CREATE_SUCCESS: 'Vente enregistrée avec succès !',
    UPDATE_SUCCESS: 'Vente mise à jour avec succès !',
    DELETE_SUCCESS: 'Vente supprimée avec succès !',
    DELETE_CONFIRM: 'Êtes-vous sûr de vouloir supprimer cette vente ?',
    ERROR: 'Erreur lors de la sauvegarde de la vente'
  },
  GENERAL: {
    LOADING_ERROR: 'Erreur lors du chargement des données',
    PROCESSING: 'Traitement en cours...'
  }
};

/**
 * Labels pour les onglets du module commercial
 */
export const TAB_LABELS = {
  CLIENTS: '👥 Clients',
  COMMANDES: '📋 Commandes',
  VENTES: '🛍️ Ventes',
  STATUTS: '📊 Statuts',
  ACHATS: '🛒 Achats & Fournisseurs',
  ANALYTICS: '📈 Analytics'
};

/**
 * Configuration des formulaires - champs par défaut
 */
export const DEFAULT_FORM_VALUES = {
  CLIENT: {
    type: 'Particulier',
    nom: '',
    prenom: '',
    raison_sociale: '',
    email: '',
    telephone: '',
    adresse: '',
    code_postal: '',
    ville: '',
    pays: 'France',
    siret: '',
    notes: ''
  },
  COMMANDE: {
    client_id: '',
    date_commande: () => new Date().toISOString().split('T')[0],
    date_livraison_demandee: '',
    poids_grammes: '',
    calibre: '',
    qualite: '',
    maturite: '',
    prix_unitaire_kg: '',
    statut: 'En attente',
    notes: ''
  },
  VENTE: {
    client_id: '',
    recolte_id: '',
    date_vente: () => new Date().toISOString().split('T')[0],
    quantite_grammes: '',
    prix_unitaire_kg: '',
    mode_paiement: '',
    statut: 'En attente',
    numero_facture: '',
    notes: ''
  }
};

/**
 * Configuration des tris par défaut pour chaque section
 */
export const DEFAULT_SORT_CONFIG = {
  CLIENTS: { key: null, direction: 'asc' },
  COMMANDES: { key: 'date_commande', direction: 'desc' },
  VENTES: { key: 'date_vente', direction: 'desc' }
};
