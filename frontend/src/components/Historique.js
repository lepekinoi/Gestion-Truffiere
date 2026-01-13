import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

// Tables auditées par les triggers PostgreSQL (15 tables)
const TABLE_NAMES = {
  // Données principales
  'parcelles': { label: 'Parcelles', icon: '🗺️', color: '#3498db' },
  'arbres': { label: 'Arbres', icon: '🌳', color: '#27ae60' },
  'interventions': { label: 'Interventions', icon: '🛠️', color: '#e67e22' },
  'intervention_details': { label: 'Détails interventions', icon: '📋', color: '#f39c12' },
  'recoltes': { label: 'Récoltes', icon: '🍄', color: '#8e44ad' },
  
  // Commercial
  'clients': { label: 'Clients', icon: '👥', color: '#c0392b' },
  'commandes': { label: 'Commandes', icon: '📦', color: '#2c3e50' },
  'ventes': { label: 'Ventes', icon: '💰', color: '#16a085' },
  
  // Équipe de cavage
  'caveurs': { label: 'Caveurs', icon: '👷', color: '#34495e' },
  'chiens': { label: 'Chiens', icon: '🐕', color: '#e74c3c' },
  
  // Référentiels
  'types_intervention': { label: 'Types intervention', icon: '🔑', color: '#95a5a6' },
  'produits_phyto': { label: 'Produits phyto', icon: '🧪', color: '#9b59b6' },
  'amendements_ref': { label: 'Amendements', icon: '🌿', color: '#1abc9c' },
  
  // Système
  'parametres': { label: 'Paramètres', icon: '⚙️', color: '#7f8c8d' },
  'users': { label: 'Utilisateurs', icon: '👤', color: '#3498db' }
};

const ACTION_STYLES = {
  'INSERT': { label: 'Création', color: '#27ae60', icon: '➕' },
  'UPDATE': { label: 'Modification', color: '#f39c12', icon: '✏️' },
  'DELETE': { label: 'Suppression', color: '#e74c3c', icon: '🗑️' }
};

// Filtres rapides prédéfinis
const QUICK_FILTERS = {
  'today': { label: "Aujourd'hui", icon: '📅' },
  'yesterday': { label: 'Hier', icon: '⏮️' },
  'week': { label: 'Cette semaine', icon: '📆' },
  'month': { label: 'Ce mois', icon: '🗓️' },
  'quarter': { label: 'Ce trimestre', icon: '📊' }
};

// Mapping des clés techniques vers des libellés lisibles
const FIELD_LABELS = {
  // Champs communs
  'id': 'ID',
  'nom': 'Nom',
  'notes': 'Notes',
  'created_at': 'Créé le',
  'updated_at': 'Modifié le',
  'deleted_at': 'Supprimé le',
  
  // Parcelles
  'surface_ha': 'Surface (ha)',
  'type_sol': 'Type de sol',
  'ph_sol': 'pH du sol',
  'exposition': 'Exposition',
  'altitude': 'Altitude',
  'coordonnees_gps': 'Coordonnées GPS',
  'geojson': 'Tracé géographique',
  
  // Arbres
  'numero': 'Numéro',
  'parcelle_id': 'Parcelle',
  'espece': 'Espèce',
  'variete_truffe': 'Variété de truffe',
  'date_plantation': 'Date de plantation',
  'etat': 'État',
  'circonference_cm': 'Circonférence (cm)',
  'hauteur_m': 'Hauteur (m)',
  'date_derniere_taille': 'Dernière taille',
  'latitude': 'Latitude',
  'longitude': 'Longitude',
  'position': 'Position GPS',
  
  // Interventions de base
  'type_intervention_id': "Type d'intervention",
  'arbre_id': 'Arbre',
  'date_prevue': 'Date prévue',
  'date_realisee': 'Date réalisée',
  'statut': 'Statut',
  'description': 'Description',
  'personnel': 'Personnel',
  'cout': 'Coût (€)',
  'duree_minutes': 'Durée (min)',
  'meteo': 'Météo',
  
  // Détails intervention - Irrigation
  'volume_eau_m3': 'Volume eau (m³)',
  'volume_eau_par_arbre_L': 'Volume/arbre (L)',
  'methode_irrigation': 'Méthode irrigation',
  'source_eau': "Source d'eau",
  'debit_L_h': 'Débit (L/h)',
  'frequence_irrigation': 'Fréquence',
  'humidite_sol_avant': 'Humidité sol avant (%)',
  'humidite_sol_apres': 'Humidité sol après (%)',
  'pression_bar': 'Pression (bar)',
  
  // Détails intervention - Traitement
  'categorie_traitement': 'Catégorie traitement',
  'nom_commercial': 'Nom commercial',
  'matiere_active': 'Matière active',
  'numero_amm': 'N° AMM',
  'dose_produit_ha': 'Dose/ha',
  'dose_produit_arbre': 'Dose/arbre',
  'concentration': 'Concentration',
  'volume_bouillie_L': 'Volume bouillie (L)',
  'surface_traitee_ha': 'Surface traitée (ha)',
  'methode_application': 'Méthode application',
  'cible_traitement': 'Cible',
  'delai_avant_recolte_jours': 'DAR (jours)',
  'conditions_application': 'Conditions application',
  'equipement_protection': 'EPI',
  'zone_non_traitee_m': 'ZNT (m)',
  'fabricant': 'Fabricant',
  
  // Détails intervention - Amendement
  'type_amendement': 'Type amendement',
  'nom_produit_amendement': 'Nom produit',
  'composition_npk': 'NPK',
  'composition_cao': 'CaO (%)',
  'composition_mgo': 'MgO (%)',
  'composition_autres': 'Autres éléments',
  'dose_kg_ha': 'Dose (kg/ha)',
  'dose_kg_arbre': 'Dose (kg/arbre)',
  'quantite_totale_kg': 'Quantité totale (kg)',
  'ph_sol_avant': 'pH avant',
  'ph_sol_apres': 'pH après',
  'methode_epandage': 'Méthode épandage',
  'incorporation': 'Incorporé',
  'profondeur_incorporation_cm': 'Profondeur (cm)',
  'origine_produit': 'Origine',
  'certification_bio': 'Certifié bio',
  'numero_lot': 'N° lot',
  
  // Détails intervention - Taille
  'type_taille': 'Type taille',
  'intensite_taille': 'Intensité',
  'hauteur_avant_cm': 'Hauteur avant (cm)',
  'hauteur_apres_cm': 'Hauteur après (cm)',
  'diametre_couronne_avant_m': '˜ couronne avant (m)',
  'diametre_couronne_apres_m': '˜ couronne après (m)',
  'branches_supprimees': 'Branches supprimées',
  'diametre_max_coupe_cm': '˜ max coupé (cm)',
  'volume_residus_m3': 'Volume résidus (m³)',
  'destination_residus': 'Destination résidus',
  'outils_taille': 'Outils utilisés',
  'desinfection_outils': 'Désinfection outils',
  'produit_desinfection': 'Produit désinfection',
  
  // Détails intervention - Travail du sol
  'type_travail_sol': 'Type travail sol',
  'profondeur_travail_cm': 'Profondeur (cm)',
  'largeur_travail_m': 'Largeur (m)',
  'outil_travail_sol': 'Outil utilisé',
  'zone_travaillee': 'Zone travaillée',
  'distance_tronc_m': 'Distance tronc (m)',
  'etat_sol_avant': 'État sol',
  'enherbement_avant': 'Enherbement avant',
  'enherbement_apres': 'Enherbement après',
  'presence_cailloux': 'Sol caillouteux',
  
  // Détails intervention - Observation
  'type_observation': 'Type observation',
  'etat_brule': 'État brûlé',
  'diametre_brule_m': '˜ brûlé (m)',
  'evolution_brule': 'Évolution brûlé',
  'presence_ascomes': 'Ascocarpes visibles',
  'nombre_ascomes': 'Nb ascocarpes',
  'indice_mycorhization': 'Mycorhization',
  'symptomes_observes': 'Symptômes',
  'ravageurs_identifies': 'Ravageurs',
  'degats_constates': 'Dégâts',
  'niveau_urgence': 'Urgence',
  'preconisations': 'Préconisations',
  
  // Détails intervention - Paillage
  'type_paillage': 'Type paillage',
  'epaisseur_cm': 'Épaisseur (cm)',
  'surface_paillee_m2': 'Surface (m²)',
  'quantite_paillage_m3': 'Quantité (m³)',
  'origine_paillage': 'Origine paillage',
  
  // Détails intervention - Plantation
  'espece_plantee': 'Espèce plantée',
  'variete_plant': 'Variété',
  'fournisseur_plant': 'Pépiniériste',
  'type_mycorhization': 'Mycorhization',
  'certification_plant': 'Certification',
  'numero_lot_plant': 'N° lot plant',
  'taille_plant_cm': 'Taille plant (cm)',
  'diametre_collet_mm': '˜ collet (mm)',
  'dimensions_trou_cm': 'Dimensions trou',
  'amendement_plantation': 'Amendement plantation',
  'tuteur': 'Tuteur',
  'protection_gibier': 'Protection gibier',
  'type_protection': 'Type protection',
  'arrosage_plantation_L': 'Arrosage (L)',
  
  // Détails intervention - Analyse de sol
  'laboratoire': 'Laboratoire',
  'reference_analyse': 'Réf. analyse',
  'profondeur_prelevement_cm': 'Prof. prélèvement (cm)',
  'nombre_echantillons': 'Nb échantillons',
  'resultats_ph': 'pH mesuré',
  'resultats_calcaire_actif': 'Calcaire actif (%)',
  'resultats_matiere_organique': 'MO (%)',
  'resultats_azote': 'Azote',
  'resultats_phosphore': 'P2O5',
  'resultats_potassium': 'K2O',
  'resultats_cec': 'CEC',
  'interpretation': 'Interprétation',
  
  // Détails intervention - Piégeage
  'type_piege': 'Type piège',
  'cible_piegeage': 'Cible',
  'nombre_pieges': 'Nb pièges',
  'captures': 'Captures',
  'densite_pieges_ha': 'Densité/ha',
  'date_releve': 'Date relevé',
  'action_suite': 'Action suite',
  
  // Détails intervention - Inoculation
  'type_inoculum': 'Type inoculum',
  'espece_truffe_inoculation': 'Espèce truffe',
  'quantite_inoculum': 'Quantité',
  'methode_inoculation': 'Méthode',
  'fournisseur_inoculum': 'Fournisseur',
  
  // Récoltes
  'date_recolte': 'Date de récolte',
  'poids_grammes': 'Poids (g)',
  'qualite': 'Qualité',
  'calibre': 'Calibre',
  'maturite': 'Maturité',
  'caveur_id': 'Caveur',
  'chien_id': 'Chien',
  'profondeur_cm': 'Profondeur (cm)',
  'temperature_sol': 'Température sol',
  'conditions_meteo': 'Conditions météo',
  
  // Clients
  'prenom': 'Prénom',
  'raison_sociale': 'Raison sociale',
  'type': 'Type',
  'email': 'Email',
  'telephone': 'Téléphone',
  'adresse': 'Adresse',
  'code_postal': 'Code postal',
  'ville': 'Ville',
  'pays': 'Pays',
  'siret': 'SIRET',
  
  // Commandes
  'client_id': 'Client',
  'date_commande': 'Date de commande',
  'date_livraison_souhaitee': 'Livraison souhaitée',
  'date_livraison_demandee': 'Livraison demandée',
  'quantite_grammes': 'Quantité (g)',
  'prix_estime': 'Prix estimé (€)',
  'prix_unitaire_kg': 'Prix/kg (€)',
  'montant_total': 'Montant total (€)',
  'priorite': 'Priorité',
  'numero_commande': 'N° commande',
  
  // Ventes
  'date_vente': 'Date de vente',
  'numero_facture': 'N° Facture',
  'commande_id': 'Commande',
  'recolte_id': 'Récolte',
  'mode_paiement': 'Mode de paiement',
  
  // Produits phyto
  'dar_jours': 'DAR (jours)',
  'znt_metres': 'ZNT (m)',
  'utilisable_bio': 'Utilisable bio',
  'phrase_risque': 'Phrase risque',
  'conseils_utilisation': 'Conseils',
  'actif': 'Actif',
  
  // Amendements ref
  'effet_principal': 'Effet principal',
  'precautions': 'Précautions',
  'dose_recommandee_ha': 'Dose recommandée/ha',

  // Caveurs & Chiens
  'specialite': 'Spécialité',
  'race': 'Race',
  'date_naissance': 'Date naissance',
  'certification': 'Certification',
  
  // Users
  'username': "Nom d'utilisateur",
  'role': 'Rôle',
  'is_active': 'Actif',
  'last_login': 'Dernière connexion'
};

// Champs À ignorer dans l'affichage des détails
const IGNORED_FIELDS = ['created_at', 'updated_at', 'position', 'geojson', 'photos_paths', 'documents_paths', 'password_hash'];

// Nombre d'entrées par page
const PAGE_SIZE_OPTIONS = [25, 50, 100, 200];

/**
 * Formate une date en YYYY-MM-DD en utilisant l'heure LOCALE
 * IMPORTANT: Ne pas utiliser toISOString() car il convertit en UTC et décale la date
 * @param {Date} date - La date À formater
 * @returns {string} La date au format YYYY-MM-DD
 */
const formatDateLocal = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Calcule les dates de début et fin pour un filtre rapide
 * @param {string} filterType - Type de filtre (today, yesterday, week, month, quarter)
 * @returns {{startDate: string, endDate: string}} Les dates formatées
 */
const calculateQuickFilterDates = (filterType) => {
  // Créer la date d'aujourd'hui À minuit en heure locale
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  let startDate, endDate;
  
  switch (filterType) {
    case 'today':
      startDate = formatDateLocal(today);
      endDate = formatDateLocal(today);
      break;
      
    case 'yesterday':
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      startDate = formatDateLocal(yesterday);
      endDate = formatDateLocal(yesterday);
      break;
      
    case 'week':
      // Lundi de cette semaine
      const weekStart = new Date(today);
      const dayOfWeek = weekStart.getDay(); // 0 = dimanche, 1 = lundi, etc.
      const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      weekStart.setDate(weekStart.getDate() - daysToMonday);
      startDate = formatDateLocal(weekStart);
      endDate = formatDateLocal(today);
      break;
      
    case 'month':
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      startDate = formatDateLocal(monthStart);
      endDate = formatDateLocal(today);
      break;
      
    case 'quarter':
      const currentQuarter = Math.floor(today.getMonth() / 3);
      const quarterStart = new Date(today.getFullYear(), currentQuarter * 3, 1);
      startDate = formatDateLocal(quarterStart);
      endDate = formatDateLocal(today);
      break;
      
    default:
      startDate = '';
      endDate = '';
  }
  
  return { startDate, endDate };
};

function Historique() {
  const [historique, setHistorique] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Données de référence pour la résolution des IDs
  const [referenceData, setReferenceData] = useState({
    parcelles: {},
    arbres: {},
    typesIntervention: {},
    clients: {},
    caveurs: {},
    chiens: {},
    commandes: {},
    recoltes: {}
  });
  
  // Filtres principaux
  const [filterTable, setFilterTable] = useState('all');
  const [filterAction, setFilterAction] = useState('all');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  
  // Nouveaux filtres
  const [filterQuick, setFilterQuick] = useState('');
  const [filterSearch, setFilterSearch] = useState('');
  const [filterRecordId, setFilterRecordId] = useState('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  
  // Modal de purge
  const [showPurgeModal, setShowPurgeModal] = useState(false);
  const [purgeOptions, setPurgeOptions] = useState({
    period: 'year',
    table_name: 'all',
    custom_date: ''
  });
  
  // Modal de détail
  const [selectedEntry, setSelectedEntry] = useState(null);
  
  // Modal d'export
  const [showExportModal, setShowExportModal] = useState(false);

  useEffect(() => {
    loadReferenceData();
  }, []);

  useEffect(() => {
    if (Object.keys(referenceData.parcelles).length > 0) {
      loadHistorique();
      loadStats();
    }
  }, [filterTable, filterAction, filterStartDate, filterEndDate, referenceData]);
  
  // Réinitialiser la page quand les filtres changent
  useEffect(() => {
    setCurrentPage(1);
  }, [filterTable, filterAction, filterStartDate, filterEndDate, filterSearch, filterRecordId, pageSize]);

  // Appliquer le filtre rapide
  useEffect(() => {
    if (filterQuick) {
      const { startDate, endDate } = calculateQuickFilterDates(filterQuick);
      setFilterStartDate(startDate);
      setFilterEndDate(endDate);
    }
  }, [filterQuick]);

  const showMessage = (text, type = 'success') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 4000);
  };

  // Charger toutes les données de référence pour résoudre les IDs
  const loadReferenceData = async () => {
    try {
      const [parcelles, arbres, typesIntervention, clients, caveurs, chiens, commandes, recoltes] = await Promise.all([
        axios.get(`${API_URL}/parcelles`).catch(() => ({ data: [] })),
        axios.get(`${API_URL}/arbres`).catch(() => ({ data: [] })),
        axios.get(`${API_URL}/types-intervention`).catch(() => ({ data: [] })),
        axios.get(`${API_URL}/clients`).catch(() => ({ data: [] })),
        axios.get(`${API_URL}/caveurs`).catch(() => ({ data: [] })),
        axios.get(`${API_URL}/chiens`).catch(() => ({ data: [] })),
        axios.get(`${API_URL}/commandes`).catch(() => ({ data: [] })),
        axios.get(`${API_URL}/recoltes`).catch(() => ({ data: [] }))
      ]);

      const createLookup = (items, labelFn) => {
        const lookup = {};
        items.forEach(item => {
          lookup[item.id] = labelFn(item);
        });
        return lookup;
      };

      setReferenceData({
        parcelles: createLookup(parcelles.data, p => p.nom),
        arbres: createLookup(arbres.data, a => a.numero || `Arbre #${a.id}`),
        typesIntervention: createLookup(typesIntervention.data, t => t.nom),
        clients: createLookup(clients.data, c => c.raison_sociale || `${c.prenom || ''} ${c.nom}`.trim() || `Client #${c.id}`),
        caveurs: createLookup(caveurs.data, c => c.nom),
        chiens: createLookup(chiens.data, c => c.nom),
        commandes: createLookup(commandes.data, c => c.numero_commande || `Commande #${c.id}`),
        recoltes: createLookup(recoltes.data, r => `Récolte du ${r.date_recolte ? new Date(r.date_recolte).toLocaleDateString('fr-FR') : '#' + r.id}`)
      });
    } catch (error) {
      console.error('Erreur chargement données de référence:', error);
    }
  };

  // Résoudre un ID en libellé
  const resolveId = (fieldName, value) => {
    if (value === null || value === undefined) return null;
    
    const mappings = {
      'parcelle_id': referenceData.parcelles,
      'arbre_id': referenceData.arbres,
      'type_intervention_id': referenceData.typesIntervention,
      'client_id': referenceData.clients,
      'caveur_id': referenceData.caveurs,
      'chien_id': referenceData.chiens,
      'commande_id': referenceData.commandes,
      'recolte_id': referenceData.recoltes,
      'intervention_id': {}
    };
    
    const lookup = mappings[fieldName];
    if (lookup && lookup[value]) {
      return lookup[value];
    }
    
    return value;
  };

  // Formater une valeur pour l'affichage
  const formatValue = (key, value) => {
    if (value === null || value === undefined) return '-';
    if (value === '') return '(vide)';
    
    // Booléens
    if (typeof value === 'boolean') {
      return value ? '✓ Oui' : '✗ Non';
    }
    
    // Dates
    if (key.includes('date') || key === 'created_at' || key === 'updated_at' || key === 'deleted_at' || key === 'last_login') {
      try {
        const date = new Date(value);
        if (!isNaN(date.getTime())) {
          return date.toLocaleDateString('fr-FR', { 
            day: '2-digit', 
            month: '2-digit', 
            year: 'numeric',
            hour: key.includes('_at') || key === 'last_login' ? '2-digit' : undefined,
            minute: key.includes('_at') || key === 'last_login' ? '2-digit' : undefined
          });
        }
      } catch (e) {
        // Ignorer les erreurs de parsing
      }
    }
    
    // IDs référencés
    const resolved = resolveId(key, value);
    if (resolved !== value) {
      return `${resolved} (#${value})`;
    }
    
    // Nombres avec formatage
    if (typeof value === 'number') {
      if (key.includes('cout') || key.includes('prix') || key.includes('montant')) {
        return `${value.toFixed(2)} €`;
      }
      if (key.includes('_ha') && !key.includes('dose')) {
        return `${value} ha`;
      }
      if (key.includes('_m3')) {
        return `${value} m³`;
      }
      if (key.includes('_m2')) {
        return `${value} m²`;
      }
      if (key.includes('_cm')) {
        return `${value} cm`;
      }
      if (key.includes('_mm')) {
        return `${value} mm`;
      }
      if (key.includes('_m') && !key.includes('_m2') && !key.includes('_m3')) {
        return `${value} m`;
      }
      if (key.includes('_L') || key.includes('_l')) {
        return `${value} L`;
      }
      if (key.includes('_kg')) {
        return `${value} kg`;
      }
      if (key.includes('grammes')) {
        return `${value} g`;
      }
      if (key.includes('minutes')) {
        return `${value} min`;
      }
      if (key.includes('jours')) {
        return `${value} j`;
      }
    }
    
    // Texte long tronqué
    if (typeof value === 'string' && value.length > 100) {
      return value.substring(0, 100) + '...';
    }
    
    return String(value);
  };

  const loadHistorique = async () => {
    try {
      let url = `${API_URL}/historique?`;
      const params = [];
      
      if (filterTable !== 'all') params.push(`table_name=${filterTable}`);
      if (filterAction !== 'all') params.push(`action=${filterAction}`);
      if (filterStartDate) params.push(`start_date=${filterStartDate}`);
      if (filterEndDate) params.push(`end_date=${filterEndDate}`);
      
      url += params.join('&');
      
      const response = await axios.get(url);
      setHistorique(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Erreur chargement historique:', error);
      setHistorique([]);
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await axios.get(`${API_URL}/historique/stats`);
      setStats(response.data);
    } catch (error) {
      console.error('Erreur chargement stats:', error);
    }
  };

  // Filtrage local (recherche textuelle et record_id)
  const filteredHistorique = useMemo(() => {
    let result = [...historique];
    
    // Filtre par record_id
    if (filterRecordId) {
      const recordId = parseInt(filterRecordId, 10);
      if (!isNaN(recordId)) {
        result = result.filter(entry => entry.record_id === recordId);
      }
    }
    
    // Recherche textuelle
    if (filterSearch.trim()) {
      const searchLower = filterSearch.toLowerCase().trim();
      result = result.filter(entry => {
        // Recherche dans les données
        const searchInData = (data) => {
          if (!data) return false;
          return Object.values(data).some(value => {
            if (value === null || value === undefined) return false;
            return String(value).toLowerCase().includes(searchLower);
          });
        };
        
        // Recherche dans le nom de table
        const tableLabel = TABLE_NAMES[entry.table_name]?.label || entry.table_name;
        if (tableLabel.toLowerCase().includes(searchLower)) return true;
        
        // Recherche dans l'action
        const actionLabel = ACTION_STYLES[entry.action]?.label || entry.action;
        if (actionLabel.toLowerCase().includes(searchLower)) return true;
        
        // Recherche dans old_data et new_data
        if (searchInData(entry.old_data)) return true;
        if (searchInData(entry.new_data)) return true;
        
        return false;
      });
    }
    
    return result;
  }, [historique, filterSearch, filterRecordId]);
  
  // Pagination
  const totalPages = Math.ceil(filteredHistorique.length / pageSize);
  const paginatedHistorique = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredHistorique.slice(start, start + pageSize);
  }, [filteredHistorique, currentPage, pageSize]);

  const handlePurge = async () => {
    setIsProcessing(true);
    try {
      let beforeDate;
      const now = new Date();
      
      switch (purgeOptions.period) {
        case 'month':
          beforeDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
          break;
        case '6months':
          beforeDate = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
          break;
        case 'year':
          beforeDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
          break;
        case 'custom':
          beforeDate = new Date(purgeOptions.custom_date);
          break;
        default:
          beforeDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
      }
      
      const params = {
        before_date: formatDateLocal(beforeDate)
      };
      
      if (purgeOptions.table_name !== 'all') {
        params.table_name = purgeOptions.table_name;
      }
      
      const response = await axios.delete(`${API_URL}/historique/purge`, { params });
      showMessage(`${response.data.deleted} entrée(s) supprimée(s)`, 'success');
      setShowPurgeModal(false);
      loadHistorique();
      loadStats();
    } catch (error) {
      console.error('Erreur purge:', error);
      showMessage('Erreur lors de la purge', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  // Export CSV
  const handleExport = () => {
    const dataToExport = filteredHistorique;
    
    const headers = ['Date', 'Table', 'Action', 'ID Enregistrement', 'Changements'];
    const rows = dataToExport.map(entry => {
      const changes = getChangeSummary(entry);
      return [
        formatDateTime(entry.timestamp),
        TABLE_NAMES[entry.table_name]?.label || entry.table_name,
        ACTION_STYLES[entry.action]?.label || entry.action,
        entry.record_id,
        changes
      ];
    });
    
    const csvContent = [
      headers.join(';'),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(';'))
    ].join('\n');
    
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `historique_${formatDateLocal(new Date())}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    
    showMessage(`${dataToExport.length} entrée(s) exportée(s)`, 'success');
    setShowExportModal(false);
  };

  const getChangeSummary = (entry) => {
    if (entry.action === 'INSERT') {
      return `Création : ${getEntryLabel(entry)}`;
    }
    if (entry.action === 'DELETE') {
      return `Suppression : ${getEntryLabel(entry)}`;
    }
    if (entry.action === 'UPDATE') {
      const oldData = entry.old_data || {};
      const newData = entry.new_data || {};
      const changes = [];
      
      Object.keys(newData).forEach(key => {
        if (IGNORED_FIELDS.includes(key)) return;
        if (JSON.stringify(oldData[key]) !== JSON.stringify(newData[key])) {
          const label = FIELD_LABELS[key] || key;
          let newValue = newData[key];
          
          // Essayer de résoudre les IDs en libellés
          if (key.endsWith('_id') && newValue) {
            const numValue = typeof newValue === 'string' ? parseInt(newValue, 10) : newValue;
            const resolved = resolveId(key, numValue);
            if (resolved && resolved !== numValue) {
              newValue = resolved;
            }
          }
          
          // Formatage basique pour CSV
          if (newValue === null || newValue === undefined || newValue === '') {
            newValue = 'vide';
          } else if (typeof newValue === 'boolean') {
            newValue = newValue ? 'Oui' : 'Non';
          } else {
            newValue = String(newValue);
            if (newValue.length > 50) {
              newValue = newValue.substring(0, 47) + '...';
            }
          }
          
          changes.push(`${label} : ${newValue}`);
        }
      });
      
      return changes.length > 0 ? changes.join(', ') : 'Aucun changement visible';
    }
    return '-';
  };

  const formatDateTime = (dateStr) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getEntryLabel = (entry) => {
    const data = entry.new_data || entry.old_data || {};
    
    // Trouver un identifiant lisible direct
    if (data.nom) return data.nom;
    if (data.numero) return data.numero;
    if (data.numero_commande) return data.numero_commande;
    if (data.numero_facture) return data.numero_facture;
    if (data.nom_commercial) return data.nom_commercial;
    if (data.raison_sociale) return data.raison_sociale;
    if (data.username) return data.username;
    if (data.prenom && data.nom) return `${data.prenom} ${data.nom}`;
    
    // Pour les tables liées, essayer de résoudre l'ID principal
    // Interventions -> résoudre le type d'intervention
    if (entry.table_name === 'interventions' && data.type_intervention_id) {
      const typeName = referenceData.typesIntervention[data.type_intervention_id];
      if (typeName) return typeName;
    }
    
    // Intervention_details -> lié À une intervention
    if (entry.table_name === 'intervention_details' && data.intervention_id) {
      return `Détail intervention #${data.intervention_id}`;
    }
    
    // Récoltes -> essayer d'afficher la date et l'arbre
    if (entry.table_name === 'recoltes') {
      const parts = [];
      if (data.date_recolte) {
        try {
          parts.push(new Date(data.date_recolte).toLocaleDateString('fr-FR'));
        } catch (e) {}
      }
      if (data.arbre_id) {
        const arbreName = referenceData.arbres[data.arbre_id];
        if (arbreName) parts.push(arbreName);
      }
      if (parts.length > 0) return parts.join(' - ');
    }
    
    // Ventes -> afficher le numéro de facture ou la date
    if (entry.table_name === 'ventes') {
      if (data.numero_facture) return data.numero_facture;
      if (data.date_vente) {
        try {
          return `Vente du ${new Date(data.date_vente).toLocaleDateString('fr-FR')}`;
        } catch (e) {}
      }
    }
    
    // Commandes -> client
    if (entry.table_name === 'commandes' && data.client_id) {
      const clientName = referenceData.clients[data.client_id];
      if (clientName) return `Commande ${clientName}`;
    }
    
    // Par défaut, afficher le record_id
    if (entry.record_id) return `#${entry.record_id}`;
    
    return 'Enregistrement';
  };

  // Formater une valeur de manière concise pour le tableau (max 30 caractères)
  const formatValueShort = (key, value) => {
    if (value === null || value === undefined) return 'vide';
    if (value === '') return 'vide';
    
    // Booléens
    if (typeof value === 'boolean') {
      return value ? 'Oui' : 'Non';
    }
    
    // Dates - format court
    if (key.includes('date') || key === 'created_at' || key === 'updated_at') {
      try {
        const date = new Date(value);
        if (!isNaN(date.getTime())) {
          return date.toLocaleDateString('fr-FR');
        }
      } catch (e) {
        // Ignorer
      }
    }
    
    // IDs référencés - afficher le libellé (conversion en string pour la comparaison)
    const numValue = typeof value === 'string' ? parseInt(value, 10) : value;
    const resolved = resolveId(key, numValue);
    if (resolved && resolved !== numValue) {
      const strResolved = String(resolved);
      return strResolved.length > 25 ? strResolved.substring(0, 22) + 'â€¦' : strResolved;
    }
    
    // Nombres avec unités
    if (typeof value === 'number') {
      if (key.includes('cout') || key.includes('prix') || key.includes('montant')) {
        return `${value.toFixed(2)} €`;
      }
      if (key.includes('grammes') || key === 'poids_grammes') {
        return `${value} g`;
      }
      if (key.includes('_kg')) {
        return `${value} kg`;
      }
      if (key.includes('_ha')) {
        return `${value} ha`;
      }
      if (key.includes('_cm')) {
        return `${value} cm`;
      }
      if (key.includes('_m2')) {
        return `${value} m²`;
      }
      if (key.includes('_m3')) {
        return `${value} m³`;
      }
      return String(value);
    }
    
    // Texte - tronquer si nécessaire
    const strValue = String(value);
    if (strValue.length > 30) {
      return strValue.substring(0, 27) + 'â€¦';
    }
    
    return strValue;
  };

  const renderDataChanges = (entry) => {
    const actionLabel = ACTION_STYLES[entry.action]?.label || entry.action;
    
    if (entry.action === 'INSERT') {
      return <span style={{ color: '#27ae60' }}>{actionLabel} : {getEntryLabel(entry)}</span>;
    }
    
    if (entry.action === 'DELETE') {
      return <span style={{ color: '#e74c3c' }}>{actionLabel} : {getEntryLabel(entry)}</span>;
    }
    
    if (entry.action === 'UPDATE') {
      const oldData = entry.old_data || {};
      const newData = entry.new_data || {};
      const changes = [];
      
      Object.keys(newData).forEach(key => {
        if (IGNORED_FIELDS.includes(key)) return;
        if (JSON.stringify(oldData[key]) !== JSON.stringify(newData[key])) {
          const label = FIELD_LABELS[key] || key;
          const newValue = formatValueShort(key, newData[key]);
          changes.push({ label, newValue });
        }
      });
      
      if (changes.length === 0) {
        return <span style={{ color: '#666' }}>Aucun changement visible</span>;
      }
      
      // Afficher les changements au format "Champ : valeur"
      const displayChanges = changes.slice(0, 2).map(c => `${c.label} : ${c.newValue}`);
      const remaining = changes.length - 2;
      
      return (
        <span style={{ color: '#f39c12' }}>
          {displayChanges.join(', ')}
          {remaining > 0 && <span style={{ color: '#999' }}> (+{remaining})</span>}
        </span>
      );
    }
    
    return '-';
  };

  const renderChangesComparison = (oldData, newData) => {
    if (!oldData || !newData) return null;
    
    const changedFields = [];
    
    Object.keys(newData).forEach(key => {
      if (IGNORED_FIELDS.includes(key)) return;
      if (JSON.stringify(oldData[key]) !== JSON.stringify(newData[key])) {
        changedFields.push(key);
      }
    });
    
    if (changedFields.length === 0) {
      return <p style={{ color: '#666', fontStyle: 'italic' }}>Aucun changement détecté</p>;
    }
    
    return (
      <div>
        <h4 style={{ marginBottom: '1rem', color: '#333' }}>🔍 Modifications ({changedFields.length})</h4>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f8f9fa' }}>
              <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '2px solid #dee2e6', width: '25%' }}>Champ</th>
              <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '2px solid #dee2e6', width: '37.5%' }}>Ancienne valeur</th>
              <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '2px solid #dee2e6', width: '37.5%' }}>Nouvelle valeur</th>
            </tr>
          </thead>
          <tbody>
            {changedFields.map(key => (
              <tr key={key}>
                <td style={{ padding: '0.5rem', borderBottom: '1px solid #dee2e6', fontWeight: '500' }}>
                  {FIELD_LABELS[key] || key}
                </td>
                <td style={{ padding: '0.5rem', borderBottom: '1px solid #dee2e6', background: '#fff5f5', color: '#c0392b' }}>
                  {formatValue(key, oldData[key])}
                </td>
                <td style={{ padding: '0.5rem', borderBottom: '1px solid #dee2e6', background: '#f0fff0', color: '#27ae60' }}>
                  {formatValue(key, newData[key])}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderDetailedData = (data, title, bgColor) => {
    if (!data) return null;
    
    const displayableFields = Object.entries(data).filter(([key]) => !IGNORED_FIELDS.includes(key));
    
    return (
      <div>
        <h4 style={{ marginBottom: '1rem', color: '#333' }}>{title}</h4>
        <div style={{ 
          background: bgColor, 
          padding: '1rem', 
          borderRadius: '8px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
          gap: '0.75rem'
        }}>
          {displayableFields.map(([key, value]) => (
            <div key={key} style={{ padding: '0.5rem', background: 'white', borderRadius: '4px' }}>
              <strong style={{ color: '#666', fontSize: '0.85rem' }}>{FIELD_LABELS[key] || key}</strong><br />
              <span style={{ color: '#333' }}>{formatValue(key, value)}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };
  
  // Réinitialiser tous les filtres
  const resetAllFilters = () => {
    setFilterTable('all');
    setFilterAction('all');
    setFilterStartDate('');
    setFilterEndDate('');
    setFilterQuick('');
    setFilterSearch('');
    setFilterRecordId('');
    setCurrentPage(1);
  };
  
  // Compter les filtres actifs
  const activeFiltersCount = [
    filterTable !== 'all',
    filterAction !== 'all',
    filterStartDate,
    filterEndDate,
    filterSearch,
    filterRecordId
  ].filter(Boolean).length;

  if (loading) return <div className="loading">Chargement de l'historique...</div>;

  return (
    <div className="page-container">
      {/* Message de notification */}
      {message && (
        <div style={{
          position: 'fixed',
          top: '1rem',
          right: '1rem',
          padding: '1rem 1.5rem',
          borderRadius: '8px',
          background: message.type === 'success' ? '#d4edda' : '#f8d7da',
          color: message.type === 'success' ? '#155724' : '#721c24',
          border: `1px solid ${message.type === 'success' ? '#c3e6cb' : '#f5c6cb'}`,
          zIndex: 9999,
          boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
        }}>
          {message.text}
        </div>
      )}

      <div className="page-header">
        <h2>📓 Historique des modifications</h2>
        <div className="header-actions" style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-secondary" onClick={() => setShowExportModal(true)}>
            📥 Exporter
          </button>
          <button className="btn btn-danger" onClick={() => setShowPurgeModal(true)}>
            🗑️ Purger
          </button>
        </div>
      </div>

      {/* Statistiques */}
      {stats && (
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', 
          gap: '1rem', 
          marginBottom: '1.5rem' 
        }}>
          <div style={{ background: '#d4edda', padding: '1rem', borderRadius: '8px', textAlign: 'center' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#155724' }}>{stats.insertions || 0}</div>
            <div style={{ color: '#155724', fontSize: '0.85rem' }}>➕ Créations</div>
          </div>
          <div style={{ background: '#fff3cd', padding: '1rem', borderRadius: '8px', textAlign: 'center' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#856404' }}>{stats.updates || 0}</div>
            <div style={{ color: '#856404', fontSize: '0.85rem' }}>✏️ Modifications</div>
          </div>
          <div style={{ background: '#f8d7da', padding: '1rem', borderRadius: '8px', textAlign: 'center' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#721c24' }}>{stats.deletions || 0}</div>
            <div style={{ color: '#721c24', fontSize: '0.85rem' }}>🗑️ Suppressions</div>
          </div>
          <div style={{ background: '#e2e3e5', padding: '1rem', borderRadius: '8px', textAlign: 'center' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#383d41' }}>{stats.total || 0}</div>
            <div style={{ color: '#383d41', fontSize: '0.85rem' }}>📋 Total</div>
          </div>
        </div>
      )}

      {/* Filtres rapides */}
      <div style={{ 
        display: 'flex', 
        gap: '0.5rem', 
        marginBottom: '1rem',
        flexWrap: 'wrap'
      }}>
        {Object.entries(QUICK_FILTERS).map(([key, { label, icon }]) => (
          <button
            key={key}
            onClick={() => {
              if (filterQuick === key) {
                // Désélectionner le filtre
                setFilterQuick('');
                setFilterStartDate('');
                setFilterEndDate('');
              } else {
                // Sélectionner le filtre
                setFilterQuick(key);
              }
            }}
            style={{
              padding: '0.4rem 0.8rem',
              borderRadius: '20px',
              border: filterQuick === key ? '2px solid #3498db' : '1px solid #ddd',
              background: filterQuick === key ? '#e8f4fc' : 'white',
              color: filterQuick === key ? '#2980b9' : '#666',
              cursor: 'pointer',
              fontSize: '0.85rem',
              fontWeight: filterQuick === key ? '600' : '400',
              transition: 'all 0.2s'
            }}
          >
            {icon} {label}
          </button>
        ))}
      </div>

      {/* Barre de recherche et filtres principaux */}
      <div style={{ 
        background: '#f8f9fa', 
        padding: '1rem', 
        borderRadius: '8px', 
        marginBottom: '1rem'
      }}>
        {/* Ligne de recherche */}
        <div style={{ 
          display: 'flex', 
          gap: '1rem', 
          marginBottom: showAdvancedFilters ? '1rem' : '0',
          flexWrap: 'wrap',
          alignItems: 'center'
        }}>
          <div style={{ flex: '1', minWidth: '250px' }}>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                placeholder="🔍 Rechercher dans l'historique..."
                value={filterSearch}
                onChange={(e) => setFilterSearch(e.target.value)}
                style={{ 
                  width: '100%',
                  padding: '0.6rem 1rem',
                  paddingRight: filterSearch ? '2.5rem' : '1rem',
                  borderRadius: '8px',
                  border: '1px solid #ddd',
                  fontSize: '0.95rem'
                }}
              />
              {filterSearch && (
                <button
                  onClick={() => setFilterSearch('')}
                  style={{
                    position: 'absolute',
                    right: '0.5rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#999',
                    fontSize: '1.2rem'
                  }}
                >
                  ✕
                </button>
              )}
            </div>
          </div>
          
          <button
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            style={{
              padding: '0.6rem 1rem',
              borderRadius: '8px',
              border: '1px solid #ddd',
              background: showAdvancedFilters ? '#e8f4fc' : 'white',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            🗓️ Filtres avancés
            {activeFiltersCount > 0 && (
              <span style={{
                background: '#3498db',
                color: 'white',
                borderRadius: '50%',
                width: '20px',
                height: '20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.75rem'
              }}>
                {activeFiltersCount}
              </span>
            )}
          </button>
          
          {activeFiltersCount > 0 && (
            <button 
              className="btn btn-secondary" 
              onClick={resetAllFilters}
              style={{ padding: '0.6rem 1rem' }}
            >
              ââ€Â ‚Âº Réinitialiser
            </button>
          )}
        </div>

        {/* Filtres avancés */}
        {showAdvancedFilters && (
          <div style={{ 
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            gap: '1rem',
            paddingTop: '1rem',
            borderTop: '1px solid #dee2e6'
          }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: '500', fontSize: '0.85rem' }}>Table</label>
              <select 
                value={filterTable} 
                onChange={(e) => setFilterTable(e.target.value)}
                style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ddd' }}
              >
                <option value="all">Toutes les tables</option>
                {Object.entries(TABLE_NAMES).map(([key, val]) => (
                  <option key={key} value={key}>{val.icon} {val.label}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: '500', fontSize: '0.85rem' }}>Action</label>
              <select 
                value={filterAction} 
                onChange={(e) => setFilterAction(e.target.value)}
                style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ddd' }}
              >
                <option value="all">Toutes les actions</option>
                {Object.entries(ACTION_STYLES).map(([key, val]) => (
                  <option key={key} value={key}>{val.icon} {val.label}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: '500', fontSize: '0.85rem' }}>Du</label>
              <input 
                type="date" 
                value={filterStartDate} 
                onChange={(e) => {
                  setFilterStartDate(e.target.value);
                  setFilterQuick(''); // Désactiver le filtre rapide
                }}
                style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ddd' }}
              />
            </div>
            
            <div>
              <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: '500', fontSize: '0.85rem' }}>Au</label>
              <input 
                type="date" 
                value={filterEndDate} 
                onChange={(e) => {
                  setFilterEndDate(e.target.value);
                  setFilterQuick(''); // Désactiver le filtre rapide
                }}
                style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ddd' }}
              />
            </div>
            
            <div>
              <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: '500', fontSize: '0.85rem' }}>ID Enregistrement</label>
              <input 
                type="number" 
                placeholder="Ex: 42"
                value={filterRecordId} 
                onChange={(e) => setFilterRecordId(e.target.value)}
                style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ddd' }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Résumé des résultats et pagination */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '1rem',
        flexWrap: 'wrap',
        gap: '0.5rem'
      }}>
        <div style={{ color: '#666', fontSize: '0.9rem' }}>
          {filteredHistorique.length} entrée(s) trouvée(s)
          {filteredHistorique.length !== historique.length && (
            <span> (sur {historique.length} total)</span>
          )}
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.85rem', color: '#666' }}>Afficher</label>
            <select 
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              style={{ padding: '0.3rem', borderRadius: '4px', border: '1px solid #ddd' }}
            >
              {PAGE_SIZE_OPTIONS.map(size => (
                <option key={size} value={size}>{size}</option>
              ))}
            </select>
          </div>
          
          {totalPages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <button 
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                style={{ 
                  padding: '0.3rem 0.6rem', 
                  border: '1px solid #ddd', 
                  borderRadius: '4px',
                  background: 'white',
                  cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                  opacity: currentPage === 1 ? 0.5 : 1
                }}
              >
                ⏮️
              </button>
              <button 
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                style={{ 
                  padding: '0.3rem 0.6rem', 
                  border: '1px solid #ddd', 
                  borderRadius: '4px',
                  background: 'white',
                  cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                  opacity: currentPage === 1 ? 0.5 : 1
                }}
              >
                â—€ï¸
              </button>
              <span style={{ fontSize: '0.9rem', color: '#666' }}>
                Page {currentPage} / {totalPages}
              </span>
              <button 
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                style={{ 
                  padding: '0.3rem 0.6rem', 
                  border: '1px solid #ddd', 
                  borderRadius: '4px',
                  background: 'white',
                  cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                  opacity: currentPage === totalPages ? 0.5 : 1
                }}
              >
                â–¶ï¸
              </button>
              <button 
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
                style={{ 
                  padding: '0.3rem 0.6rem', 
                  border: '1px solid #ddd', 
                  borderRadius: '4px',
                  background: 'white',
                  cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                  opacity: currentPage === totalPages ? 0.5 : 1
                }}
              >
                â­ï¸
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Tableau */}
      {paginatedHistorique.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📓</div>
          <p>Aucune entrée dans l'historique</p>
          {activeFiltersCount > 0 && (
            <button className="btn btn-secondary" onClick={resetAllFilters} style={{ marginTop: '1rem' }}>
              Réinitialiser les filtres
            </button>
          )}
        </div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Table</th>
              <th>Action</th>
              <th>ID</th>
              <th>Changements</th>
              <th>Détails</th>
            </tr>
          </thead>
          <tbody>
            {paginatedHistorique.map(entry => {
              const tableInfo = TABLE_NAMES[entry.table_name] || { label: entry.table_name, icon: '📋', color: '#666' };
              const actionInfo = ACTION_STYLES[entry.action] || { label: entry.action, icon: 'â‚Ââ€Å“', color: '#666' };
              
              return (
                <tr key={entry.id}>
                  <td style={{ whiteSpace: 'nowrap' }}>{formatDateTime(entry.timestamp)}</td>
                  <td>
                    <span style={{ 
                      padding: '0.25rem 0.75rem', 
                      borderRadius: '12px', 
                      fontSize: '0.85rem',
                      background: `${tableInfo.color}20`,
                      color: tableInfo.color,
                      fontWeight: '500'
                    }}>
                      {tableInfo.icon} {tableInfo.label}
                    </span>
                  </td>
                  <td>
                    <span style={{ 
                      padding: '0.25rem 0.75rem', 
                      borderRadius: '12px', 
                      fontSize: '0.85rem',
                      background: `${actionInfo.color}20`,
                      color: actionInfo.color,
                      fontWeight: '500'
                    }}>
                      {actionInfo.icon} {actionInfo.label}
                    </span>
                  </td>
                  <td style={{ fontFamily: 'monospace', color: '#666' }}>
                    #{entry.record_id}
                  </td>
                  <td>
                    {renderDataChanges(entry)}
                  </td>
                  <td>
                    <button 
                      className="btn btn-secondary" 
                      onClick={() => setSelectedEntry(entry)}
                      style={{ padding: '0.3rem 0.6rem' }}
                      title="Voir les détails"
                    >
                      👁️
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {/* Pagination en bas */}
      {totalPages > 1 && paginatedHistorique.length > 0 && (
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          gap: '0.5rem',
          marginTop: '1rem',
          paddingTop: '1rem',
          borderTop: '1px solid #dee2e6'
        }}>
          <button 
            onClick={() => setCurrentPage(1)}
            disabled={currentPage === 1}
            className="btn btn-secondary"
            style={{ opacity: currentPage === 1 ? 0.5 : 1 }}
          >
            ⏮️ Début
          </button>
          <button 
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="btn btn-secondary"
            style={{ opacity: currentPage === 1 ? 0.5 : 1 }}
          >
            â—€ï¸ Précédent
          </button>
          <span style={{ padding: '0 1rem', color: '#666' }}>
            Page {currentPage} sur {totalPages}
          </span>
          <button 
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="btn btn-secondary"
            style={{ opacity: currentPage === totalPages ? 0.5 : 1 }}
          >
            Suivant â–¶ï¸
          </button>
          <button 
            onClick={() => setCurrentPage(totalPages)}
            disabled={currentPage === totalPages}
            className="btn btn-secondary"
            style={{ opacity: currentPage === totalPages ? 0.5 : 1 }}
          >
            Fin â­ï¸
          </button>
        </div>
      )}

      {/* Modal de purge */}
      {showPurgeModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000
        }}>
          <div style={{
            background: 'white',
            padding: '2rem',
            borderRadius: '12px',
            maxWidth: '500px',
            width: '90%',
            boxShadow: '0 4px 20px rgba(0,0,0,0.3)'
          }}>
            <h3 style={{ marginBottom: '1rem', color: '#e74c3c' }}>🗑️ Purger l'historique</h3>
            <p style={{ marginBottom: '1.5rem', color: '#666' }}>
              Cette action est irréversible. Sélectionnez les critères de purge :
            </p>

            <div className="form-group" style={{ marginBottom: '1rem' }}>
              <label style={{ fontWeight: 'bold' }}>Période À supprimer</label>
              <select 
                value={purgeOptions.period} 
                onChange={(e) => setPurgeOptions(prev => ({ ...prev, period: e.target.value }))}
                style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ddd' }}
              >
                <option value="month">Plus d'un mois</option>
                <option value="6months">Plus de 6 mois</option>
                <option value="year">Plus d'un an</option>
                <option value="custom">Date personnalisée</option>
              </select>
            </div>

            {purgeOptions.period === 'custom' && (
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label style={{ fontWeight: 'bold' }}>Supprimer avant le</label>
                <input 
                  type="date" 
                  value={purgeOptions.custom_date} 
                  onChange={(e) => setPurgeOptions(prev => ({ ...prev, custom_date: e.target.value }))}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ddd' }}
                />
              </div>
            )}

            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
              <label style={{ fontWeight: 'bold' }}>Table concernée</label>
              <select 
                value={purgeOptions.table_name} 
                onChange={(e) => setPurgeOptions(prev => ({ ...prev, table_name: e.target.value }))}
                style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ddd' }}
              >
                <option value="all">Toutes les tables</option>
                {Object.entries(TABLE_NAMES).map(([key, val]) => (
                  <option key={key} value={key}>{val.icon} {val.label}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button 
                className="btn btn-secondary" 
                onClick={() => setShowPurgeModal(false)}
                disabled={isProcessing}
              >
                Annuler
              </button>
              <button 
                className="btn btn-danger" 
                onClick={handlePurge}
                disabled={isProcessing || (purgeOptions.period === 'custom' && !purgeOptions.custom_date)}
              >
                {isProcessing ? 'Purge en cours...' : 'Confirmer la purge'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal d'export */}
      {showExportModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000
        }}>
          <div style={{
            background: 'white',
            padding: '2rem',
            borderRadius: '12px',
            maxWidth: '500px',
            width: '90%',
            boxShadow: '0 4px 20px rgba(0,0,0,0.3)'
          }}>
            <h3 style={{ marginBottom: '1rem', color: '#2c3e50' }}>📥 Exporter l'historique</h3>
            <p style={{ marginBottom: '1.5rem', color: '#666' }}>
              {filteredHistorique.length} entrée(s) seront exportées au format CSV avec les filtres actuels.
            </p>
            
            {activeFiltersCount > 0 && (
              <div style={{ 
                background: '#e8f4fc', 
                padding: '1rem', 
                borderRadius: '8px', 
                marginBottom: '1.5rem',
                fontSize: '0.9rem'
              }}>
                <strong>Filtres actifs :</strong>
                <ul style={{ margin: '0.5rem 0 0 1rem', paddingLeft: 0 }}>
                  {filterTable !== 'all' && <li>Table : {TABLE_NAMES[filterTable]?.label || filterTable}</li>}
                  {filterAction !== 'all' && <li>Action : {ACTION_STYLES[filterAction]?.label || filterAction}</li>}
                  {filterStartDate && <li>Du : {filterStartDate}</li>}
                  {filterEndDate && <li>Au : {filterEndDate}</li>}
                  {filterSearch && <li>Recherche : "{filterSearch}"</li>}
                  {filterRecordId && <li>ID : #{filterRecordId}</li>}
                </ul>
              </div>
            )}

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button 
                className="btn btn-secondary" 
                onClick={() => setShowExportModal(false)}
              >
                Annuler
              </button>
              <button 
                className="btn btn-primary" 
                onClick={handleExport}
              >
                📥 Télécharger CSV
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de détail */}
      {selectedEntry && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000
        }}>
          <div style={{
            background: 'white',
            padding: '2rem',
            borderRadius: '12px',
            maxWidth: '900px',
            width: '95%',
            maxHeight: '90vh',
            overflow: 'auto',
            boxShadow: '0 4px 20px rgba(0,0,0,0.3)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ margin: 0 }}>
                {ACTION_STYLES[selectedEntry.action]?.icon} Détails de l'opération
              </h3>
              <button 
                onClick={() => setSelectedEntry(null)}
                style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', padding: '0.5rem' }}
              >
                ✕
              </button>
            </div>

            {/* Informations générales */}
            <div style={{ 
              marginBottom: '1.5rem', 
              padding: '1rem', 
              background: '#f8f9fa', 
              borderRadius: '8px',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '1rem'
            }}>
              <div>
                <strong style={{ color: '#666' }}>📅 Date :</strong><br />
                {formatDateTime(selectedEntry.timestamp)}
              </div>
              <div>
                <strong style={{ color: '#666' }}>📋 Table :</strong><br />
                <span style={{ 
                  padding: '0.25rem 0.5rem', 
                  borderRadius: '4px', 
                  background: `${TABLE_NAMES[selectedEntry.table_name]?.color}20`,
                  color: TABLE_NAMES[selectedEntry.table_name]?.color
                }}>
                  {TABLE_NAMES[selectedEntry.table_name]?.icon} {TABLE_NAMES[selectedEntry.table_name]?.label || selectedEntry.table_name}
                </span>
              </div>
              <div>
                <strong style={{ color: '#666' }}>⚡ Action :</strong><br />
                <span style={{ 
                  padding: '0.25rem 0.5rem', 
                  borderRadius: '4px', 
                  background: `${ACTION_STYLES[selectedEntry.action]?.color}20`,
                  color: ACTION_STYLES[selectedEntry.action]?.color
                }}>
                  {ACTION_STYLES[selectedEntry.action]?.icon} {ACTION_STYLES[selectedEntry.action]?.label || selectedEntry.action}
                </span>
              </div>
              <div>
                <strong style={{ color: '#666' }}>🔢 ID enregistrement :</strong><br />
                #{selectedEntry.record_id}
              </div>
            </div>

            {/* Affichage selon le type d'action */}
            {selectedEntry.action === 'UPDATE' && (
              renderChangesComparison(selectedEntry.old_data, selectedEntry.new_data)
            )}

            {selectedEntry.action === 'INSERT' && selectedEntry.new_data && (
              renderDetailedData(selectedEntry.new_data, '✨ Données créées', '#f0fff0')
            )}

            {selectedEntry.action === 'DELETE' && selectedEntry.old_data && (
              renderDetailedData(selectedEntry.old_data, '🗑️ Données supprimées', '#fff0f0')
            )}

            <div style={{ textAlign: 'right', marginTop: '1.5rem' }}>
              <button className="btn btn-primary" onClick={() => setSelectedEntry(null)}>
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Historique;
