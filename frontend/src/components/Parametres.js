import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

// Définition des colonnes disponibles pour chaque entité
const COLONNES_DISPONIBLES = {
  parcelles: [
    { key: 'nom', label: 'Nom' },
    { key: 'surface_ha', label: 'Surface (ha)' },
    { key: 'type_sol', label: 'Type de sol' },
    { key: 'ph_sol', label: 'pH du sol' },
    { key: 'exposition', label: 'Exposition' },
    { key: 'date_creation', label: 'Date de création' },
    { key: 'notes', label: 'Notes' }
  ],
  arbres: [
    { key: 'numero', label: 'Numéro' },
    { key: 'espece', label: 'Espèce' },
    { key: 'variete_truffe', label: 'Variété de truffe' },
    { key: 'parcelle_nom', label: 'Parcelle' },
    { key: 'etat', label: 'État' },
    { key: 'date_plantation', label: 'Date de plantation' },
    { key: 'circonference_cm', label: 'Circonférence (cm)' },
    { key: 'hauteur_m', label: 'Hauteur (m)' },
    { key: 'latitude', label: 'Latitude' },
    { key: 'longitude', label: 'Longitude' },
    { key: 'notes', label: 'Notes' }
  ],
  interventions: [
    { key: 'date_prevue', label: 'Date prévue' },
    { key: 'date_realisee', label: 'Date réalisée' },
    { key: 'type_nom', label: 'Type' },
    { key: 'parcelle_nom', label: 'Parcelle' },
    { key: 'arbre_numero', label: 'Arbre' },
    { key: 'statut', label: 'Statut' },
    { key: 'personnel', label: 'Personnel' },
    { key: 'duree_minutes', label: 'Durée (min)' },
    { key: 'cout', label: 'Coût' },
    { key: 'description', label: 'Description' },
    { key: 'meteo', label: 'Météo' },
    { key: 'notes', label: 'Notes' }
  ],
  recoltes: [
    { key: 'date_recolte', label: 'Date de récolte' },
    { key: 'parcelle_nom', label: 'Parcelle' },
    { key: 'arbre_numero', label: 'Arbre' },
    { key: 'poids_grammes', label: 'Poids (g)' },
    { key: 'qualite', label: 'Qualité' },
    { key: 'calibre', label: 'Calibre' },
    { key: 'maturite', label: 'Maturité' },
    { key: 'profondeur_cm', label: 'Profondeur (cm)' },
    { key: 'caveur', label: 'Caveur' },
    { key: 'chien', label: 'Chien' },
    { key: 'conditions_meteo', label: 'Conditions météo' },
    { key: 'temperature_sol', label: 'Température sol' },
    { key: 'notes', label: 'Notes' }
  ],
  clients: [
    { key: 'nom', label: 'Nom' },
    { key: 'prenom', label: 'Prénom' },
    { key: 'raison_sociale', label: 'Raison sociale' },
    { key: 'type', label: 'Type' },
    { key: 'email', label: 'Email' },
    { key: 'telephone', label: 'Téléphone' },
    { key: 'adresse', label: 'Adresse' },
    { key: 'code_postal', label: 'Code postal' },
    { key: 'ville', label: 'Ville' },
    { key: 'pays', label: 'Pays' },
    { key: 'siret', label: 'SIRET' },
    { key: 'date_premier_achat', label: 'Premier achat' },
    { key: 'notes', label: 'Notes' }
  ],
  ventes: [
    { key: 'date_vente', label: 'Date de vente' },
    { key: 'numero_facture', label: 'N° Facture' },
    { key: 'client_nom', label: 'Client' },
    { key: 'commande_numero', label: 'N° Commande' },
    { key: 'quantite_grammes', label: 'Quantité (g)' },
    { key: 'prix_unitaire_kg', label: 'Prix unitaire (€/kg)' },
    { key: 'montant_total', label: 'Montant total' },
    { key: 'mode_paiement', label: 'Mode de paiement' },
    { key: 'statut', label: 'Statut' },
    { key: 'notes', label: 'Notes' }
  ]
};

const ENTITES = [
  { key: 'parcelles', label: 'Parcelles', icon: '📋' },
  { key: 'arbres', label: 'Arbres', icon: '🌳' },
  { key: 'interventions', label: 'Interventions', icon: '🛠️' },
  { key: 'recoltes', label: 'Récoltes (Production)', icon: '🍄' },
  { key: 'clients', label: 'Clients', icon: '👥' },
  { key: 'ventes', label: 'Ventes', icon: '💰' }
];

// Configuration des paramètres par catégorie
const PARAMETRES_CONFIG = {
  entreprise: {
    label: 'Informations Entreprise',
    icon: '🏢',
    description: 'Coordonnées de votre exploitation',
    params: [
      { key: 'entreprise_nom', label: 'Nom de l\'entreprise', type: 'text', placeholder: 'Ma Truffière' },
      { key: 'entreprise_adresse', label: 'Adresse', type: 'text', placeholder: '123 Chemin des Chênes' },
      { key: 'entreprise_code_postal', label: 'Code postal', type: 'text', placeholder: '84000' },
      { key: 'entreprise_ville', label: 'Ville', type: 'text', placeholder: 'Avignon' },
      { key: 'entreprise_telephone', label: 'Téléphone', type: 'tel', placeholder: '04 90 XX XX XX' },
      { key: 'entreprise_email', label: 'Email', type: 'email', placeholder: 'contact@matruffiere.fr' },
      { key: 'entreprise_siret', label: 'SIRET', type: 'text', placeholder: '123 456 789 00012' },
      { key: 'entreprise_tva', label: 'N° TVA Intracommunautaire', type: 'text', placeholder: 'FR12345678901' }
    ]
  },
  facturation: {
    label: 'Facturation',
    icon: '🧾',
    description: 'Paramètres pour la génération des factures',
    params: [
      { key: 'facture_prefixe', label: 'Préfixe des factures', type: 'text', placeholder: 'FAC' },
      { key: 'facture_tva_taux', label: 'Taux de TVA (%)', type: 'number', placeholder: '5.5' },
      { key: 'facture_conditions_paiement', label: 'Conditions de paiement', type: 'text', placeholder: 'Paiement à réception' },
      { key: 'facture_delai_paiement', label: 'Délai de paiement (jours)', type: 'number', placeholder: '30' },
      { key: 'facture_iban', label: 'IBAN', type: 'text', placeholder: 'FR76 XXXX XXXX XXXX XXXX XXXX XXX' },
      { key: 'facture_bic', label: 'BIC', type: 'text', placeholder: 'XXXXXXXX' },
      { key: 'facture_mentions_legales', label: 'Mentions légales', type: 'textarea', placeholder: 'TVA non applicable, art. 293 B du CGI...' }
    ]
  },
  stock: {
    label: 'Stock & Alertes',
    icon: '📦',
    description: 'Seuils d\'alerte et paramètres de stock',
    params: [
      { key: 'stock_alerte_critique', label: 'Seuil critique (g)', type: 'number', placeholder: '100' },
      { key: 'stock_alerte_faible', label: 'Seuil faible (g)', type: 'number', placeholder: '500' },
      { key: 'stock_prix_moyen_defaut', label: 'Prix moyen par défaut (€/kg)', type: 'number', placeholder: '800' },
      { key: 'commande_alerte_delai', label: 'Alerte commandes (jours avant livraison)', type: 'number', placeholder: '3' }
    ]
  },
  production: {
    label: 'Production',
    icon: '🍄',
    description: 'Paramètres liés aux récoltes',
    params: [
      { key: 'recolte_qualites', label: 'Qualités disponibles', type: 'tags', placeholder: 'Extra, 1er choix, 2ème choix, Brisures' },
      { key: 'recolte_calibres', label: 'Calibres disponibles', type: 'tags', placeholder: 'Petit, Moyen, Gros, Très gros' },
      { key: 'recolte_maturites', label: 'Maturités disponibles', type: 'tags', placeholder: 'Immature, À point, Mature, Très mature' },
      { key: 'saison_debut_mois', label: 'Début de saison (mois)', type: 'number', placeholder: '11' },
      { key: 'saison_fin_mois', label: 'Fin de saison (mois)', type: 'number', placeholder: '3' }
    ]
  },
  application: {
    label: 'Application',
    icon: '⚙️',
    description: 'Préférences générales de l\'application',
    params: [
      { key: 'app_theme', label: 'Thème couleur principal', type: 'color', placeholder: '#2c5f2d' },
      { key: 'app_langue', label: 'Langue', type: 'select', options: ['fr', 'en'], placeholder: 'fr' },
      { key: 'app_devise', label: 'Devise', type: 'select', options: ['EUR', 'USD', 'CHF'], placeholder: 'EUR' },
      { key: 'app_date_format', label: 'Format de date', type: 'select', options: ['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'], placeholder: 'DD/MM/YYYY' },
      { key: 'dashboard_refresh_interval', label: 'Rafraîchissement dashboard (secondes)', type: 'number', placeholder: '60' },
      { key: 'historique_retention_jours', label: 'Rétention historique (jours)', type: 'number', placeholder: '365' }
    ]
  }
};

// Helper pour parser JSON en toute sécurité
const safeJsonParse = (value, defaultValue = {}) => {
  if (!value) return defaultValue;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch (e) {
    console.error('Erreur parsing JSON:', e);
    return defaultValue;
  }
};

// Helper pour extraire la valeur d'un paramètre JSONB
const extractParamValue = (valeur) => {
  if (valeur === null || valeur === undefined) return '';
  if (typeof valeur === 'object') {
    // Si c'est un objet JSONB avec une propriété "value" ou directement la valeur
    return valeur.value !== undefined ? valeur.value : (typeof valeur === 'string' ? valeur : JSON.stringify(valeur));
  }
  return valeur;
};

function Parametres() {
  const [activeTab, setActiveTab] = useState('equipe');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  
  // Modal de confirmation
  const [confirmModal, setConfirmModal] = useState(null);
  
  // Données équipe
  const [caveurs, setCaveurs] = useState([]);
  const [chiens, setChiens] = useState([]);
  const [recoltes, setRecoltes] = useState([]);
  const [interventions, setInterventions] = useState([]);
  
  // Statistiques pour les tooltips
  const [caveursStats, setCaveursStats] = useState({});
  const [chiensStats, setChiensStats] = useState({});
  
  // Formulaires
  const [newCaveur, setNewCaveur] = useState('');
  const [newChien, setNewChien] = useState({ nom: '', race: '' });
  const [editingCaveur, setEditingCaveur] = useState(null);
  const [editingChien, setEditingChien] = useState(null);
  
  // Paramètres globaux (colonnes)
  const [parametresGlobaux, setParametresGlobaux] = useState({
    colonnes_affichees: {},
    colonnes_export: {}
  });
  
  // Préférences utilisateur
  const [preferencesUtilisateur, setPreferencesUtilisateur] = useState({
    colonnes_affichees: {},
    colonnes_export: {}
  });

  // NOUVEAU: Paramètres application/entreprise
  const [parametresApp, setParametresApp] = useState({});
  const [activeParamCategory, setActiveParamCategory] = useState('entreprise');

  // NOUVEAU: Tous les paramètres bruts de la BDD
  const [allParametres, setAllParametres] = useState([]);
  const [newParam, setNewParam] = useState({ cle: '', valeur: '', description: '' });
  const [editingParam, setEditingParam] = useState(null);

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    try {
      const [caveursRes, chiensRes, recoltesRes, interventionsRes, globalRes, userRes] = await Promise.all([
        axios.get(`${API_URL}/caveurs`).catch(() => ({ data: [] })),
        axios.get(`${API_URL}/chiens`).catch(() => ({ data: [] })),
        axios.get(`${API_URL}/recoltes`).catch(() => ({ data: [] })),
        axios.get(`${API_URL}/interventions`).catch(() => ({ data: [] })),
        axios.get(`${API_URL}/parametres`),
        axios.get(`${API_URL}/preferences-utilisateur`).catch(() => ({ data: null }))
      ]);
      
      setCaveurs(caveursRes.data);
      setChiens(chiensRes.data);
      setRecoltes(recoltesRes.data);
      setInterventions(interventionsRes.data);
      
      // Calculer les statistiques
      calculateStats(caveursRes.data, chiensRes.data, recoltesRes.data, interventionsRes.data);
      
      // Paramètres globaux
      const globalData = { colonnes_affichees: {}, colonnes_export: {} };
      const appParams = {};
      
      globalRes.data.forEach(param => {
        if (param.cle.startsWith('colonnes_affichees_')) {
          const entite = param.cle.replace('colonnes_affichees_', '');
          globalData.colonnes_affichees[entite] = safeJsonParse(param.valeur, []);
        } else if (param.cle.startsWith('colonnes_export_')) {
          const entite = param.cle.replace('colonnes_export_', '');
          globalData.colonnes_export[entite] = safeJsonParse(param.valeur, []);
        } else {
          // Autres paramètres (entreprise, facturation, etc.)
          appParams[param.cle] = extractParamValue(param.valeur);
        }
      });
      setParametresGlobaux(globalData);
      setParametresApp(appParams);
      setAllParametres(globalRes.data); // Stocker tous les paramètres bruts
      
      // Préférences utilisateur
      if (userRes.data) {
        const colonnesAffichees = safeJsonParse(userRes.data.colonnes_affichees, {});
        const colonnesExport = safeJsonParse(userRes.data.colonnes_export, {});
        setPreferencesUtilisateur({
          colonnes_affichees: colonnesAffichees,
          colonnes_export: colonnesExport
        });
      }
      
      setLoading(false);
    } catch (error) {
      console.error('Erreur lors du chargement:', error);
      setLoading(false);
    }
  };

  const calculateStats = (caveursList, chiensList, recoltesList, interventionsList) => {
    const now = new Date();
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
    const currentYear = now.getFullYear();
    
    // Stats caveurs
    const cavStats = {};
    caveursList.forEach(caveur => {
      const recoltesTotal = recoltesList.filter(r => r.caveur === caveur.nom);
      const totalPoids = recoltesTotal.reduce((sum, r) => sum + parseFloat(r.poids_grammes || 0), 0);
      const interventionsTotal = interventionsList.filter(i => i.personnel && i.personnel.includes(caveur.nom));
      
      const recoltes6Mois = recoltesTotal.filter(r => new Date(r.date_recolte) >= sixMonthsAgo);
      const poids6Mois = recoltes6Mois.reduce((sum, r) => sum + parseFloat(r.poids_grammes || 0), 0);
      const interventions6Mois = interventionsTotal.filter(i => new Date(i.date_realisee || i.date_prevue) >= sixMonthsAgo);
      
      cavStats[caveur.id] = {
        nbRecoltes: recoltesTotal.length,
        totalPoids,
        nbInterventions: interventionsTotal.length,
        nbRecoltes6Mois: recoltes6Mois.length,
        poids6Mois,
        nbInterventions6Mois: interventions6Mois.length,
        annee: currentYear
      };
    });
    setCaveursStats(cavStats);
    
    // Stats chiens
    const chiStats = {};
    chiensList.forEach(chien => {
      const recoltesTotal = recoltesList.filter(r => r.chien === chien.nom);
      const totalPoids = recoltesTotal.reduce((sum, r) => sum + parseFloat(r.poids_grammes || 0), 0);
      const recoltes6Mois = recoltesTotal.filter(r => new Date(r.date_recolte) >= sixMonthsAgo);
      const poids6Mois = recoltes6Mois.reduce((sum, r) => sum + parseFloat(r.poids_grammes || 0), 0);
      
      chiStats[chien.id] = {
        nbRecoltes: recoltesTotal.length,
        totalPoids,
        nbRecoltes6Mois: recoltes6Mois.length,
        poids6Mois,
        annee: currentYear
      };
    });
    setChiensStats(chiStats);
  };

  const showMessage = (text, type = 'success') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 4000);
  };

  // ==================== GESTION CAVEURS ====================
  
  const handleAddCaveur = async (e) => {
    e.preventDefault();
    if (!newCaveur.trim()) return;
    
    setSaving(true);
    try {
      await axios.post(`${API_URL}/caveurs`, { nom: newCaveur.trim() });
      setNewCaveur('');
      showMessage('Caveur ajouté avec succès !');
      loadAllData();
    } catch (error) {
      console.error('Erreur:', error);
      showMessage('Erreur lors de l\'ajout du caveur', 'error');
    }
    setSaving(false);
  };

  const handleUpdateCaveur = async (id, nom) => {
    setSaving(true);
    try {
      await axios.put(`${API_URL}/caveurs/${id}`, { nom });
      setEditingCaveur(null);
      showMessage('Caveur modifié avec succès !');
      loadAllData();
    } catch (error) {
      console.error('Erreur:', error);
      showMessage('Erreur lors de la modification', 'error');
    }
    setSaving(false);
  };

  const handleDeleteCaveur = async (id) => {
    setSaving(true);
    try {
      await axios.delete(`${API_URL}/caveurs/${id}`);
      showMessage('Caveur supprimé avec succès !');
      loadAllData();
    } catch (error) {
      console.error('Erreur:', error);
      showMessage('Erreur lors de la suppression', 'error');
    }
    setSaving(false);
    setConfirmModal(null);
  };

  // ==================== GESTION CHIENS ====================
  
  const handleAddChien = async (e) => {
    e.preventDefault();
    if (!newChien.nom.trim()) return;
    
    setSaving(true);
    try {
      await axios.post(`${API_URL}/chiens`, { 
        nom: newChien.nom.trim(), 
        race: newChien.race.trim() || null 
      });
      setNewChien({ nom: '', race: '' });
      showMessage('Chien ajouté avec succès !');
      loadAllData();
    } catch (error) {
      console.error('Erreur:', error);
      showMessage('Erreur lors de l\'ajout du chien', 'error');
    }
    setSaving(false);
  };

  const handleUpdateChien = async (id, nom, race) => {
    setSaving(true);
    try {
      await axios.put(`${API_URL}/chiens/${id}`, { nom, race: race || null });
      setEditingChien(null);
      showMessage('Chien modifié avec succès !');
      loadAllData();
    } catch (error) {
      console.error('Erreur:', error);
      showMessage('Erreur lors de la modification', 'error');
    }
    setSaving(false);
  };

  const handleDeleteChien = async (id) => {
    setSaving(true);
    try {
      await axios.delete(`${API_URL}/chiens/${id}`);
      showMessage('Chien supprimé avec succès !');
      loadAllData();
    } catch (error) {
      console.error('Erreur:', error);
      showMessage('Erreur lors de la suppression', 'error');
    }
    setSaving(false);
    setConfirmModal(null);
  };

  // ==================== GESTION COLONNES ====================

  const handleGlobalColonneToggle = (type, entite, colonne) => {
    setParametresGlobaux(prev => {
      const current = prev[type][entite] || [];
      const updated = current.includes(colonne)
        ? current.filter(c => c !== colonne)
        : [...current, colonne];
      
      return {
        ...prev,
        [type]: {
          ...prev[type],
          [entite]: updated
        }
      };
    });
  };

  const handleUserColonneToggle = (type, entite, colonne) => {
    setPreferencesUtilisateur(prev => {
      const current = prev[type][entite] || [];
      const updated = current.includes(colonne)
        ? current.filter(c => c !== colonne)
        : [...current, colonne];
      
      return {
        ...prev,
        [type]: {
          ...prev[type],
          [entite]: updated
        }
      };
    });
  };

  const saveParametresGlobaux = async () => {
    setSaving(true);
    try {
      // Sauvegarder les colonnes affichées
      for (const [entite, colonnes] of Object.entries(parametresGlobaux.colonnes_affichees)) {
        await axios.post(`${API_URL}/parametres`, {
          cle: `colonnes_affichees_${entite}`,
          valeur: JSON.stringify(colonnes)
        });
      }
      
      // Sauvegarder les colonnes export
      for (const [entite, colonnes] of Object.entries(parametresGlobaux.colonnes_export)) {
        await axios.post(`${API_URL}/parametres`, {
          cle: `colonnes_export_${entite}`,
          valeur: JSON.stringify(colonnes)
        });
      }
      
      showMessage('Paramètres globaux sauvegardés !');
    } catch (error) {
      console.error('Erreur:', error);
      showMessage('Erreur lors de la sauvegarde', 'error');
    }
    setSaving(false);
  };

	const savePreferencesUtilisateur = async () => {
	  setSaving(true);
	  try {
		await axios.put(`${API_URL}/preferences-utilisateur`, {
		  colonnesaffichees: preferencesUtilisateur.colonnesaffichees,
		  colonnesexport: preferencesUtilisateur.colonnesexport,
		});
		showMessage('Préférences sauvegardées !', 'success');
	  } catch (error) {
		console.error('Erreur:', error);
		showMessage('Erreur lors de la sauvegarde', 'error');
	  } finally {
		setSaving(false);
	  }
	};




  // ==================== GESTION PARAMETRES APPLICATION ====================

  const handleParamChange = (key, value) => {
    setParametresApp(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const saveParametresApp = async () => {
    setSaving(true);
    try {
      // Sauvegarder chaque paramètre modifié
      for (const [key, value] of Object.entries(parametresApp)) {
        // Ne pas sauvegarder les paramètres de colonnes (gérés ailleurs)
        if (!key.startsWith('colonnes_')) {
          await axios.post(`${API_URL}/parametres`, {
            cle: key,
            valeur: JSON.stringify(value)
          });
        }
      }
      showMessage('Paramètres sauvegardés avec succès !');
    } catch (error) {
      console.error('Erreur:', error);
      showMessage('Erreur lors de la sauvegarde des paramètres', 'error');
    }
    setSaving(false);
  };

  // ==================== GESTION TOUS LES PARAMETRES ====================

  // Catégoriser les paramètres
  const categorizeParams = (params) => {
    const categories = {
      colonnes_affichees: { label: '📊 Colonnes affichées', params: [] },
      colonnes_export: { label: '📤 Colonnes export', params: [] },
      entreprise: { label: '🏢 Entreprise', params: [] },
      facturation: { label: '🧾 Facturation', params: [] },
      stock: { label: '📦 Stock & Alertes', params: [] },
      production: { label: '🍄 Production', params: [] },
      application: { label: '⚙️ Application', params: [] },
      autres: { label: '📁 Autres', params: [] }
    };

    params.forEach(param => {
      if (param.cle.startsWith('colonnes_affichees_')) {
        categories.colonnes_affichees.params.push(param);
      } else if (param.cle.startsWith('colonnes_export_')) {
        categories.colonnes_export.params.push(param);
      } else if (param.cle.startsWith('entreprise_')) {
        categories.entreprise.params.push(param);
      } else if (param.cle.startsWith('facture_') || param.cle.startsWith('facturation_')) {
        categories.facturation.params.push(param);
      } else if (param.cle.startsWith('stock_') || param.cle.startsWith('alerte_') || param.cle.startsWith('commande_alerte')) {
        categories.stock.params.push(param);
      } else if (param.cle.startsWith('recolte_') || param.cle.startsWith('saison_')) {
        categories.production.params.push(param);
      } else if (param.cle.startsWith('app_') || param.cle.startsWith('dashboard_') || param.cle.startsWith('theme_') || param.cle.startsWith('historique_')) {
        categories.application.params.push(param);
      } else {
        categories.autres.params.push(param);
      }
    });

    return categories;
  };

  const handleAddParam = async (e) => {
    e.preventDefault();
    if (!newParam.cle.trim()) return;

    setSaving(true);
    try {
      // Essayer de parser la valeur comme JSON, sinon la garder comme string
      let valeurToSave = newParam.valeur;
      try {
        valeurToSave = JSON.parse(newParam.valeur);
      } catch {
        // Garder comme string
      }

      await axios.post(`${API_URL}/parametres`, {
        cle: newParam.cle.trim(),
        valeur: typeof valeurToSave === 'string' ? JSON.stringify(valeurToSave) : valeurToSave,
        description: newParam.description.trim() || null
      });
      
      setNewParam({ cle: '', valeur: '', description: '' });
      showMessage('Paramètre ajouté avec succès !');
      loadAllData();
    } catch (error) {
      console.error('Erreur:', error);
      showMessage(error.response?.data?.error || 'Erreur lors de l\'ajout du paramètre', 'error');
    }
    setSaving(false);
  };

  const handleUpdateParam = async (id, cle, valeur, description) => {
    setSaving(true);
    try {
      let valeurToSave = valeur;
      try {
        valeurToSave = JSON.parse(valeur);
      } catch {
        // Garder comme string
      }

      await axios.put(`${API_URL}/parametres/${id}`, {
        cle,
        valeur: typeof valeurToSave === 'string' ? JSON.stringify(valeurToSave) : valeurToSave,
        description: description || null
      });
      
      setEditingParam(null);
      showMessage('Paramètre modifié avec succès !');
      loadAllData();
    } catch (error) {
      console.error('Erreur:', error);
      showMessage('Erreur lors de la modification', 'error');
    }
    setSaving(false);
  };

  const handleDeleteParam = async (id) => {
    setSaving(true);
    try {
      await axios.delete(`${API_URL}/parametres/${id}`);
      showMessage('Paramètre supprimé avec succès !');
      loadAllData();
    } catch (error) {
      console.error('Erreur:', error);
      showMessage('Erreur lors de la suppression', 'error');
    }
    setSaving(false);
    setConfirmModal(null);
  };

  // Formater la valeur pour l'affichage
  const formatParamValue = (valeur) => {
    if (valeur === null || valeur === undefined) return '';
    if (typeof valeur === 'object') {
      return JSON.stringify(valeur, null, 2);
    }
    return String(valeur);
  };

  // ==================== CONFIRMATION ====================

  const handleConfirm = () => {
    if (confirmModal?.action === 'deleteCaveur') {
      handleDeleteCaveur(confirmModal.id);
    } else if (confirmModal?.action === 'deleteChien') {
      handleDeleteChien(confirmModal.id);
    } else if (confirmModal?.action === 'deleteParam') {
      handleDeleteParam(confirmModal.id);
    }
  };

  // ==================== RENDU ====================

  if (loading) {
    return (
      <div className="page-container">
        <div style={{ textAlign: 'center', padding: '3rem' }}>
          <div className="loading-spinner"></div>
          <p>Chargement des paramètres...</p>
        </div>
      </div>
    );
  }

  const renderColonnesSection = (type, label, data, onToggle) => (
    <div style={{ marginBottom: '2rem' }}>
      <h3 style={{ 
        color: '#2c5f2d', 
        marginBottom: '1rem',
        paddingBottom: '0.5rem',
        borderBottom: '2px solid #e0e0e0'
      }}>
        📊 Colonnes {label}
      </h3>
      {ENTITES.map(entite => (
        <div key={entite.key} style={{ 
          marginBottom: '1.5rem',
          padding: '1rem',
          background: '#fafafa',
          borderRadius: '8px',
          border: '1px solid #e0e0e0'
        }}>
          <h4 style={{ 
            marginBottom: '0.75rem', 
            color: '#333',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            <span>{entite.icon}</span>
            <span>{entite.label}</span>
            <span style={{ 
              fontSize: '0.8rem', 
              color: '#666',
              fontWeight: 'normal',
              marginLeft: 'auto'
            }}>
              {(data[type][entite.key] || []).length} / {COLONNES_DISPONIBLES[entite.key]?.length || 0} colonnes
            </span>
          </h4>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: '0.5rem'
          }}>
            {(COLONNES_DISPONIBLES[entite.key] || []).map(col => {
              const isChecked = (data[type][entite.key] || []).includes(col.key);
              return (
                <label 
                  key={col.key}
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '0.5rem',
                    padding: '0.5rem',
                    background: isChecked ? '#e8f5e9' : 'white',
                    borderRadius: '4px',
                    border: `1px solid ${isChecked ? '#4caf50' : '#ddd'}`,
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => onToggle(type, entite.key, col.key)}
                    style={{ cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: '0.9rem' }}>{col.label}</span>
                </label>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );

  // Rendu d'un champ de paramètre
  const renderParamField = (param) => {
    const value = parametresApp[param.key] || '';
    
    const baseStyle = {
      width: '100%',
      padding: '0.75rem',
      borderRadius: '6px',
      border: '1px solid #ddd',
      fontSize: '0.95rem',
      transition: 'border-color 0.2s'
    };

    switch (param.type) {
      case 'textarea':
        return (
          <textarea
            value={value}
            onChange={(e) => handleParamChange(param.key, e.target.value)}
            placeholder={param.placeholder}
            rows={3}
            style={{ ...baseStyle, resize: 'vertical' }}
          />
        );
      
      case 'select':
        return (
          <select
            value={value}
            onChange={(e) => handleParamChange(param.key, e.target.value)}
            style={baseStyle}
          >
            <option value="">-- Sélectionner --</option>
            {param.options?.map(opt => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        );
      
      case 'color':
        return (
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <input
              type="color"
              value={value || '#2c5f2d'}
              onChange={(e) => handleParamChange(param.key, e.target.value)}
              style={{ width: '50px', height: '40px', border: 'none', cursor: 'pointer' }}
            />
            <input
              type="text"
              value={value}
              onChange={(e) => handleParamChange(param.key, e.target.value)}
              placeholder={param.placeholder}
              style={{ ...baseStyle, flex: 1 }}
            />
          </div>
        );
      
      case 'tags':
        return (
          <input
            type="text"
            value={value}
            onChange={(e) => handleParamChange(param.key, e.target.value)}
            placeholder={param.placeholder}
            style={baseStyle}
            title="Séparez les valeurs par des virgules"
          />
        );
      
      case 'number':
        return (
          <input
            type="number"
            value={value}
            onChange={(e) => handleParamChange(param.key, e.target.value)}
            placeholder={param.placeholder}
            style={{ ...baseStyle, maxWidth: '200px' }}
          />
        );
      
      default:
        return (
          <input
            type={param.type || 'text'}
            value={value}
            onChange={(e) => handleParamChange(param.key, e.target.value)}
            placeholder={param.placeholder}
            style={baseStyle}
          />
        );
    }
  };

  return (
    <div className="page-container">
      {/* Modal de confirmation */}
      {confirmModal && (
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
            maxWidth: '450px',
            textAlign: 'center',
            boxShadow: '0 4px 20px rgba(0,0,0,0.3)'
          }}>
            <h3 style={{ marginBottom: '1rem', color: '#333' }}>{confirmModal.title}</h3>
            <p style={{ marginBottom: '1.5rem', color: '#666', lineHeight: '1.5' }}>
              {confirmModal.message}
            </p>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              <button 
                className="btn btn-secondary" 
                onClick={() => setConfirmModal(null)}
                style={{ padding: '0.75rem 1.5rem' }}
              >
                Annuler
              </button>
              <button 
                className="btn" 
                onClick={handleConfirm}
                style={{ 
                  padding: '0.75rem 1.5rem',
                  background: '#e74c3c',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer'
                }}
              >
                {confirmModal.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="page-header">
        <h2>⚙️ Paramètres</h2>
      </div>

      {/* Message de notification */}
      {message && (
        <div style={{
          padding: '1rem',
          marginBottom: '1rem',
          borderRadius: '8px',
          background: message.type === 'success' ? '#d4edda' : '#f8d7da',
          color: message.type === 'success' ? '#155724' : '#721c24',
          border: `1px solid ${message.type === 'success' ? '#c3e6cb' : '#f5c6cb'}`
        }}>
          {message.text}
        </div>
      )}

      {/* Onglets */}
      <div style={{ display: 'flex', gap: '0', marginBottom: '2rem', borderBottom: '2px solid #e0e0e0', flexWrap: 'wrap' }}>
        {[
          { key: 'equipe', label: '👥 Équipe', sublabel: 'Caveurs & Chiens' },
          { key: 'entreprise', label: '🏢 Entreprise', sublabel: 'Facturation' },
          { key: 'config', label: '🗄️ Configuration', sublabel: 'Tous les paramètres' },
          { key: 'global', label: '🌐 Colonnes', sublabel: 'Globales' },
          { key: 'utilisateur', label: '👤 Mes préférences', sublabel: '' }
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '1rem 1.5rem',
              background: activeTab === tab.key ? '#2c5f2d' : 'transparent',
              color: activeTab === tab.key ? 'white' : '#2c5f2d',
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.95rem',
              fontWeight: activeTab === tab.key ? 'bold' : 'normal',
              borderTopLeftRadius: '8px',
              borderTopRightRadius: '8px',
              transition: 'all 0.2s',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '2px'
            }}
          >
            <span>{tab.label}</span>
            {tab.sublabel && (
              <span style={{ fontSize: '0.75rem', opacity: 0.8 }}>{tab.sublabel}</span>
            )}
          </button>
        ))}
      </div>

      {/* Contenu ÉQUIPE */}
      {activeTab === 'equipe' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '2rem' }}>
          
          {/* Section Caveurs */}
          <div style={{ 
            background: 'white', 
            padding: '1.5rem', 
            borderRadius: '12px', 
            boxShadow: '0 2px 10px rgba(0,0,0,0.05)' 
          }}>
            <h3 style={{ color: '#2c5f2d', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              👨‍🌾 Caveurs
              <span style={{ 
                fontSize: '0.85rem', 
                background: '#2c5f2d20', 
                padding: '0.25rem 0.5rem', 
                borderRadius: '12px',
                fontWeight: 'normal'
              }}>
                {caveurs.length}
              </span>
            </h3>
            
            {/* Formulaire ajout */}
            <form onSubmit={handleAddCaveur} style={{ marginBottom: '1rem', display: 'flex', gap: '0.5rem' }}>
              <input 
                type="text" 
                value={newCaveur} 
                onChange={(e) => setNewCaveur(e.target.value)}
                placeholder="Nom du caveur"
                style={{ flex: 1, padding: '0.5rem', borderRadius: '4px', border: '1px solid #ddd' }}
              />
              <button type="submit" className="btn btn-primary" disabled={saving || !newCaveur.trim()}>
                ➕ Ajouter
              </button>
            </form>
            
            {/* Liste */}
            {caveurs.length === 0 ? (
              <p style={{ color: '#888', textAlign: 'center', padding: '1rem' }}>Aucun caveur enregistré</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {caveurs.map(caveur => {
                  const stats = caveursStats[caveur.id] || { nbRecoltes: 0, totalPoids: 0, nbInterventions: 0 };
                  return (
                    <div 
                      key={caveur.id} 
                      style={{ 
                        padding: '0.75rem', 
                        background: '#f9f9f9', 
                        borderRadius: '8px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                      title={`📊 Statistiques ${stats.annee || new Date().getFullYear()}\n━━━━━━━━━━━━━━━━━━━━━━━\n🍄 Récoltes: ${stats.nbRecoltes} (${(stats.totalPoids / 1000).toFixed(2)} kg)\n🛠️ Interventions: ${stats.nbInterventions}`}
                    >
                      {editingCaveur === caveur.id ? (
                        <div style={{ display: 'flex', gap: '0.5rem', flex: 1 }}>
                          <input 
                            type="text" 
                            defaultValue={caveur.nom}
                            id={`caveur-${caveur.id}`}
                            style={{ flex: 1, padding: '0.25rem', borderRadius: '4px', border: '1px solid #2c5f2d' }}
                          />
                          <button 
                            onClick={() => handleUpdateCaveur(caveur.id, document.getElementById(`caveur-${caveur.id}`).value)}
                            className="btn btn-primary"
                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.85rem' }}
                          >
                            ✓
                          </button>
                          <button 
                            onClick={() => setEditingCaveur(null)}
                            className="btn btn-secondary"
                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.85rem' }}
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <span style={{ fontWeight: '500' }}>{caveur.nom}</span>
                          <span style={{ 
                            fontSize: '0.75rem', 
                            color: '#888',
                            background: '#eee',
                            padding: '0.15rem 0.5rem',
                            borderRadius: '8px'
                          }}>
                            {stats.nbRecoltes} réc. • {(stats.totalPoids / 1000).toFixed(2)} kg
                          </span>
                        </div>
                      )}
                      {editingCaveur !== caveur.id && (
                        <div style={{ display: 'flex', gap: '0.25rem' }}>
                          <button 
                            onClick={() => setEditingCaveur(caveur.id)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem' }}
                            title="Modifier"
                          >
                            ✏️
                          </button>
                          <button 
                            onClick={() => setConfirmModal({
                              action: 'deleteCaveur',
                              id: caveur.id,
                              title: 'Supprimer le caveur ?',
                              message: `Êtes-vous sûr de vouloir supprimer "${caveur.nom}" ?`,
                              confirmText: 'Supprimer'
                            })}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem' }}
                            title="Supprimer"
                          >
                            🗑️
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          
          {/* Section Chiens */}
          <div style={{ 
            background: 'white', 
            padding: '1.5rem', 
            borderRadius: '12px', 
            boxShadow: '0 2px 10px rgba(0,0,0,0.05)' 
          }}>
            <h3 style={{ color: '#2c5f2d', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              🐕 Chiens
              <span style={{ 
                fontSize: '0.85rem', 
                background: '#2c5f2d20', 
                padding: '0.25rem 0.5rem', 
                borderRadius: '12px',
                fontWeight: 'normal'
              }}>
                {chiens.length}
              </span>
            </h3>
            
            {/* Formulaire ajout */}
            <form onSubmit={handleAddChien} style={{ marginBottom: '1rem', display: 'flex', gap: '0.5rem' }}>
              <input 
                type="text" 
                value={newChien.nom} 
                onChange={(e) => setNewChien(prev => ({ ...prev, nom: e.target.value }))}
                placeholder="Nom du chien"
                style={{ flex: 1, padding: '0.5rem', borderRadius: '4px', border: '1px solid #ddd' }}
              />
              <input 
                type="text" 
                value={newChien.race} 
                onChange={(e) => setNewChien(prev => ({ ...prev, race: e.target.value }))}
                placeholder="Race (optionnel)"
                style={{ flex: 1, padding: '0.5rem', borderRadius: '4px', border: '1px solid #ddd' }}
              />
              <button type="submit" className="btn btn-primary" disabled={saving || !newChien.nom.trim()}>
                ➕
              </button>
            </form>
            
            {/* Liste */}
            {chiens.length === 0 ? (
              <p style={{ color: '#888', textAlign: 'center', padding: '1rem' }}>Aucun chien enregistré</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {chiens.map(chien => {
                  const stats = chiensStats[chien.id] || { nbRecoltes: 0, totalPoids: 0 };
                  return (
                    <div 
                      key={chien.id} 
                      style={{ 
                        padding: '0.75rem', 
                        background: '#f9f9f9', 
                        borderRadius: '8px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                      title={`📊 Statistiques ${stats.annee || new Date().getFullYear()}\n━━━━━━━━━━━━━━━━━━━━━━━\n🍄 Total: ${stats.nbRecoltes} récolte(s) (${(stats.totalPoids / 1000).toFixed(2)} kg)`}
                    >
                      {editingChien === chien.id ? (
                        <div style={{ display: 'flex', gap: '0.5rem', flex: 1 }}>
                          <input 
                            type="text" 
                            defaultValue={chien.nom}
                            id={`chien-nom-${chien.id}`}
                            style={{ flex: 1, padding: '0.25rem', borderRadius: '4px', border: '1px solid #2c5f2d' }}
                          />
                          <input 
                            type="text" 
                            defaultValue={chien.race || ''}
                            id={`chien-race-${chien.id}`}
                            placeholder="Race"
                            style={{ flex: 1, padding: '0.25rem', borderRadius: '4px', border: '1px solid #2c5f2d' }}
                          />
                          <button 
                            onClick={() => {
                              const nom = document.getElementById(`chien-nom-${chien.id}`).value;
                              const race = document.getElementById(`chien-race-${chien.id}`).value;
                              handleUpdateChien(chien.id, nom, race);
                            }}
                            className="btn btn-primary"
                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.85rem' }}
                          >
                            ✓
                          </button>
                          <button 
                            onClick={() => setEditingChien(null)}
                            className="btn btn-secondary"
                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.85rem' }}
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <span style={{ fontWeight: '500' }}>{chien.nom}</span>
                          {chien.race && (
                            <span style={{ fontSize: '0.85rem', color: '#666' }}>({chien.race})</span>
                          )}
                          <span style={{ 
                            fontSize: '0.75rem', 
                            color: '#888',
                            background: '#eee',
                            padding: '0.15rem 0.5rem',
                            borderRadius: '8px'
                          }}>
                            {stats.nbRecoltes} réc. • {(stats.totalPoids / 1000).toFixed(2)} kg
                          </span>
                        </div>
                      )}
                      {editingChien !== chien.id && (
                        <div style={{ display: 'flex', gap: '0.25rem' }}>
                          <button 
                            onClick={() => setEditingChien(chien.id)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem' }}
                            title="Modifier"
                          >
                            ✏️
                          </button>
                          <button 
                            onClick={() => setConfirmModal({
                              action: 'deleteChien',
                              id: chien.id,
                              title: 'Supprimer le chien ?',
                              message: `Êtes-vous sûr de vouloir supprimer "${chien.nom}" ?`,
                              confirmText: 'Supprimer'
                            })}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem' }}
                            title="Supprimer"
                          >
                            🗑️
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Contenu ENTREPRISE & FACTURATION */}
      {activeTab === 'entreprise' && (
        <div>
          {/* Navigation par catégorie */}
          <div style={{ 
            display: 'flex', 
            gap: '0.5rem', 
            marginBottom: '2rem',
            flexWrap: 'wrap'
          }}>
            {Object.entries(PARAMETRES_CONFIG).map(([key, config]) => (
              <button
                key={key}
                onClick={() => setActiveParamCategory(key)}
                style={{
                  padding: '0.75rem 1.25rem',
                  background: activeParamCategory === key ? '#2c5f2d' : '#f5f5f5',
                  color: activeParamCategory === key ? 'white' : '#333',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  transition: 'all 0.2s'
                }}
              >
                <span>{config.icon}</span>
                <span>{config.label}</span>
              </button>
            ))}
          </div>

          {/* Contenu de la catégorie sélectionnée */}
          {Object.entries(PARAMETRES_CONFIG).map(([key, config]) => (
            activeParamCategory === key && (
              <div key={key} style={{
                background: 'white',
                padding: '2rem',
                borderRadius: '12px',
                boxShadow: '0 2px 10px rgba(0,0,0,0.05)'
              }}>
                <div style={{ marginBottom: '1.5rem' }}>
                  <h3 style={{ 
                    color: '#2c5f2d', 
                    marginBottom: '0.5rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}>
                    <span style={{ fontSize: '1.5rem' }}>{config.icon}</span>
                    {config.label}
                  </h3>
                  <p style={{ color: '#666', fontSize: '0.9rem' }}>{config.description}</p>
                </div>

                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                  gap: '1.5rem'
                }}>
                  {config.params.map(param => (
                    <div key={param.key}>
                      <label style={{ 
                        display: 'block', 
                        marginBottom: '0.5rem', 
                        fontWeight: '500',
                        color: '#333',
                        fontSize: '0.9rem'
                      }}>
                        {param.label}
                      </label>
                      {renderParamField(param)}
                    </div>
                  ))}
                </div>
              </div>
            )
          ))}

          {/* Bouton sauvegarder */}
          <div style={{ 
            marginTop: '2rem', 
            padding: '1.5rem', 
            background: '#f5f5f5', 
            borderRadius: '8px',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '1rem'
          }}>
            <button 
              className="btn btn-secondary"
              onClick={loadAllData}
              disabled={saving}
              style={{ padding: '0.8rem 1.5rem', fontSize: '1rem' }}
            >
              🔄 Annuler les modifications
            </button>
            <button 
              className="btn btn-primary"
              onClick={saveParametresApp}
              disabled={saving}
              style={{ minWidth: '200px', padding: '0.8rem 1.5rem', fontSize: '1rem' }}
            >
              {saving ? '⏳ Sauvegarde...' : '💾 Sauvegarder'}
            </button>
          </div>
        </div>
      )}

      {/* Contenu CONFIGURATION - Tous les paramètres */}
      {activeTab === 'config' && (
        <div>
          <div style={{ 
            background: '#e8f4fd', 
            padding: '1rem', 
            borderRadius: '8px', 
            marginBottom: '1.5rem',
            border: '1px solid #2196f3'
          }}>
            <strong>🗄️ Configuration complète</strong>
            <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.9rem' }}>
              Cette section affiche tous les paramètres de l'application, organisés par catégorie.
              Vous pouvez ajouter, modifier ou supprimer n'importe quel paramètre.
            </p>
          </div>

          {/* Formulaire d'ajout */}
          <div style={{
            background: 'white',
            padding: '1.5rem',
            borderRadius: '12px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
            marginBottom: '2rem'
          }}>
            <h3 style={{ color: '#2c5f2d', marginBottom: '1rem' }}>➕ Ajouter un paramètre</h3>
            <form onSubmit={handleAddParam} style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 2fr auto', gap: '1rem', alignItems: 'end' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', fontSize: '0.9rem' }}>Clé</label>
                <input 
                  type="text" 
                  value={newParam.cle}
                  onChange={(e) => setNewParam(prev => ({ ...prev, cle: e.target.value }))}
                  placeholder="ex: entreprise_logo"
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ddd' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', fontSize: '0.9rem' }}>Valeur</label>
                <input 
                  type="text" 
                  value={newParam.valeur}
                  onChange={(e) => setNewParam(prev => ({ ...prev, valeur: e.target.value }))}
                  placeholder="Valeur du paramètre"
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ddd' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', fontSize: '0.9rem' }}>Description</label>
                <input 
                  type="text" 
                  value={newParam.description}
                  onChange={(e) => setNewParam(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Description (optionnel)"
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ddd' }}
                />
              </div>
              <button type="submit" className="btn btn-primary" disabled={saving || !newParam.cle.trim()}>
                Ajouter
              </button>
            </form>
            <p style={{ fontSize: '0.8rem', color: '#666', marginTop: '0.75rem' }}>
              💡 Préfixes suggérés : <code>entreprise_</code>, <code>facture_</code>, <code>stock_</code>, <code>app_</code>
            </p>
          </div>

          {/* Liste des paramètres par catégorie */}
          {(() => {
            const categories = categorizeParams(allParametres);
            return Object.entries(categories).map(([catKey, category]) => {
              if (category.params.length === 0) return null;
              
              return (
                <div key={catKey} style={{
                  background: 'white',
                  padding: '1.5rem',
                  borderRadius: '12px',
                  boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
                  marginBottom: '1.5rem'
                }}>
                  <h3 style={{ 
                    color: '#2c5f2d', 
                    marginBottom: '1rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}>
                    {category.label}
                    <span style={{
                      fontSize: '0.8rem',
                      background: '#2c5f2d20',
                      padding: '0.2rem 0.6rem',
                      borderRadius: '12px',
                      fontWeight: 'normal'
                    }}>
                      {category.params.length}
                    </span>
                  </h3>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {category.params.map(param => (
                      <div 
                        key={param.id}
                        style={{
                          padding: '1rem',
                          background: '#f9f9f9',
                          borderRadius: '8px',
                          border: '1px solid #e0e0e0'
                        }}
                      >
                        {editingParam === param.id ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '0.75rem' }}>
                              <div>
                                <label style={{ fontSize: '0.8rem', color: '#666' }}>Clé</label>
                                <input 
                                  type="text"
                                  id={`param-cle-${param.id}`}
                                  defaultValue={param.cle}
                                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #2c5f2d' }}
                                />
                              </div>
                              <div>
                                <label style={{ fontSize: '0.8rem', color: '#666' }}>Valeur</label>
                                <textarea 
                                  id={`param-valeur-${param.id}`}
                                  defaultValue={formatParamValue(param.valeur)}
                                  rows={3}
                                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #2c5f2d', fontFamily: 'monospace', fontSize: '0.85rem' }}
                                />
                              </div>
                            </div>
                            <div>
                              <label style={{ fontSize: '0.8rem', color: '#666' }}>Description</label>
                              <input 
                                type="text"
                                id={`param-desc-${param.id}`}
                                defaultValue={param.description || ''}
                                style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #2c5f2d' }}
                              />
                            </div>
                            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                              <button 
                                onClick={() => setEditingParam(null)}
                                className="btn btn-secondary"
                                style={{ padding: '0.5rem 1rem' }}
                              >
                                Annuler
                              </button>
                              <button 
                                onClick={() => handleUpdateParam(
                                  param.id,
                                  document.getElementById(`param-cle-${param.id}`).value,
                                  document.getElementById(`param-valeur-${param.id}`).value,
                                  document.getElementById(`param-desc-${param.id}`).value
                                )}
                                className="btn btn-primary"
                                style={{ padding: '0.5rem 1rem' }}
                              >
                                💾 Sauvegarder
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                              <div>
                                <code style={{ 
                                  background: '#e8f5e9', 
                                  padding: '0.2rem 0.5rem', 
                                  borderRadius: '4px',
                                  fontSize: '0.9rem',
                                  fontWeight: '600'
                                }}>
                                  {param.cle}
                                </code>
                                {param.description && (
                                  <p style={{ fontSize: '0.8rem', color: '#666', marginTop: '0.25rem', marginBottom: 0 }}>
                                    {param.description}
                                  </p>
                                )}
                              </div>
                              <div style={{ display: 'flex', gap: '0.25rem' }}>
                                <button 
                                  onClick={() => setEditingParam(param.id)}
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem' }}
                                  title="Modifier"
                                >
                                  ✏️
                                </button>
                                <button 
                                  onClick={() => setConfirmModal({
                                    action: 'deleteParam',
                                    id: param.id,
                                    title: 'Supprimer ce paramètre ?',
                                    message: `Êtes-vous sûr de vouloir supprimer "${param.cle}" ? Cette action est irréversible.`,
                                    confirmText: 'Supprimer'
                                  })}
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem' }}
                                  title="Supprimer"
                                >
                                  🗑️
                                </button>
                              </div>
                            </div>
                            <div style={{ 
                              background: '#fff', 
                              padding: '0.75rem', 
                              borderRadius: '4px',
                              border: '1px solid #e0e0e0',
                              fontFamily: 'monospace',
                              fontSize: '0.85rem',
                              whiteSpace: 'pre-wrap',
                              wordBreak: 'break-all',
                              maxHeight: '150px',
                              overflow: 'auto'
                            }}>
                              {formatParamValue(param.valeur)}
                            </div>
                            {param.updated_at && (
                              <p style={{ fontSize: '0.75rem', color: '#999', marginTop: '0.5rem', marginBottom: 0 }}>
                                Modifié le {new Date(param.updated_at).toLocaleDateString('fr-FR')} à {new Date(param.updated_at).toLocaleTimeString('fr-FR')}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            });
          })()}

          {allParametres.length === 0 && (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#666' }}>
              <p>Aucun paramètre configuré.</p>
              <p style={{ fontSize: '0.9rem' }}>Utilisez le formulaire ci-dessus pour ajouter votre premier paramètre.</p>
            </div>
          )}
        </div>
      )}

      {/* Contenu GLOBAL (colonnes) */}
      {activeTab === 'global' && (
        <div>
          <div style={{ 
            background: '#fff3cd', 
            padding: '1rem', 
            borderRadius: '8px', 
            marginBottom: '1.5rem',
            border: '1px solid #ffc107'
          }}>
            <strong>ℹ️ Paramètres globaux</strong>
            <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.9rem' }}>
              Ces paramètres définissent les valeurs par défaut pour tous les utilisateurs de l'application.
            </p>
          </div>

          {renderColonnesSection('colonnes_affichees', 'affichées', parametresGlobaux, handleGlobalColonneToggle)}
          {renderColonnesSection('colonnes_export', 'exportées', parametresGlobaux, handleGlobalColonneToggle)}

          <div style={{ 
            marginTop: '2rem', 
            padding: '1.5rem', 
            background: '#f5f5f5', 
            borderRadius: '8px',
            display: 'flex',
            justifyContent: 'flex-end'
          }}>
            <button 
              className="btn btn-primary"
              onClick={saveParametresGlobaux}
              disabled={saving}
              style={{ minWidth: '200px', padding: '0.8rem 1.5rem', fontSize: '1rem' }}
            >
              {saving ? '⏳ Sauvegarde...' : '💾 Sauvegarder les paramètres'}
            </button>
          </div>
        </div>
      )}

      {/* Contenu UTILISATEUR */}
      {activeTab === 'utilisateur' && (
        <div>
          <div style={{ 
            background: '#d1ecf1', 
            padding: '1rem', 
            borderRadius: '8px', 
            marginBottom: '1.5rem',
            border: '1px solid #17a2b8'
          }}>
            <strong>ℹ️ Préférences utilisateur</strong>
            <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.9rem' }}>
              Ces préférences vous sont personnelles et surchargent les paramètres globaux.
            </p>
          </div>

          {renderColonnesSection('colonnes_affichees', 'affichées', preferencesUtilisateur, handleUserColonneToggle)}
          {renderColonnesSection('colonnes_export', 'exportées', preferencesUtilisateur, handleUserColonneToggle)}

          <div style={{ 
            marginTop: '2rem', 
            padding: '1.5rem', 
            background: '#f5f5f5', 
            borderRadius: '8px',
            display: 'flex',
            justifyContent: 'flex-end'
          }}>
            <button 
              className="btn btn-primary"
              onClick={savePreferencesUtilisateur}
              disabled={saving}
              style={{ minWidth: '200px', padding: '0.8rem 1.5rem', fontSize: '1rem' }}
            >
              {saving ? '⏳ Sauvegarde...' : '💾 Sauvegarder mes préférences'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Parametres;
