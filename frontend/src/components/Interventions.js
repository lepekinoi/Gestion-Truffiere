import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { exportInterventionsPDF } from '../utils/pdfExport';
import { validateInterventionsCSV } from '../utils/csvImport';
import CSVImportModal from './CSVImportModal';
import { useColumnSettings, COLONNES_CONFIG } from '../hooks/useColumnSettings';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

// Options de pagination
const PAGINATION_OPTIONS = [
  { value: 10, label: '10' },
  { value: 20, label: '20' },
  { value: 30, label: '30' },
  { value: 50, label: '50' },
  { value: 'all', label: 'Tous' }
];

// ============================================================================
// CONFIGURATION DES CHAMPS PAR TYPE D'INTERVENTION
// ============================================================================

const CHAMPS_PAR_TYPE = {
  'Irrigation': {
    icon: '💧',
    sections: [
      {
        titre: '💧 Paramètres d\'irrigation',
        champs: [
          { name: 'volume_eau_m3', label: 'Volume total (m³)', type: 'number', step: '0.1', placeholder: 'Ex: 5.5' },
          { name: 'volume_eau_par_arbre_L', label: 'Volume par arbre (L)', type: 'number', step: '0.1', placeholder: 'Ex: 50' },
          { name: 'methode_irrigation', label: 'Méthode', type: 'select', options: [
            '', 'Goutte-à-goutte', 'Aspersion', 'Micro-aspersion', 'Gravitaire', 'Citerne', 'Tuyau manuel'
          ]},
          { name: 'source_eau', label: 'Source d\'eau', type: 'select', options: [
            '', 'Réseau', 'Puits', 'Forage', 'Récupération eau de pluie', 'Citerne', 'Cours d\'eau', 'Bassin'
          ]},
          { name: 'debit_L_h', label: 'Débit (L/h)', type: 'number', step: '0.1', placeholder: 'Ex: 4' },
          { name: 'pression_bar', label: 'Pression (bar)', type: 'number', step: '0.1', placeholder: 'Ex: 2.5' },
          { name: 'frequence_irrigation', label: 'Fréquence', type: 'select', options: [
            '', 'Ponctuel', 'Quotidien', 'Tous les 2 jours', 'Hebdomadaire', 'Bi-hebdomadaire', 'Mensuel'
          ]},
        ]
      },
      {
        titre: '🌡️ Mesures du sol',
        champs: [
          { name: 'humidite_sol_avant', label: 'Humidité sol avant (%)', type: 'number', step: '0.1', placeholder: 'Ex: 25' },
          { name: 'humidite_sol_apres', label: 'Humidité sol après (%)', type: 'number', step: '0.1', placeholder: 'Ex: 45' },
        ]
      }
    ]
  },
  
  'Traitement': {
    icon: '🧪',
    sections: [
      {
        titre: '🧪 Produit utilisé',
        champs: [
          { name: 'categorie_traitement', label: 'Catégorie', type: 'select', options: [
            '', 'Fongicide', 'Insecticide', 'Herbicide', 'Acaricide', 'Répulsif', 'Stimulant', 'Autre'
          ]},
          { name: 'nom_commercial', label: 'Nom commercial *', type: 'text', placeholder: 'Ex: Bouillie bordelaise' },
          { name: 'matiere_active', label: 'Matière(s) active(s)', type: 'text', placeholder: 'Ex: Sulfate de cuivre' },
          { name: 'numero_amm', label: 'N° AMM', type: 'text', placeholder: 'Ex: 9800123' },
          { name: 'fabricant', label: 'Fabricant', type: 'text', placeholder: 'Ex: BASF' },
        ]
      },
      {
        titre: '📐 Dosage et application',
        champs: [
          { name: 'dose_produit_ha', label: 'Dose/ha (L ou kg)', type: 'number', step: '0.01', placeholder: 'Ex: 2.5' },
          { name: 'dose_produit_arbre', label: 'Dose/arbre (mL ou g)', type: 'number', step: '0.1', placeholder: 'Ex: 50' },
          { name: 'concentration', label: 'Concentration', type: 'text', placeholder: 'Ex: 2% ou 50g/L' },
          { name: 'volume_bouillie_L', label: 'Volume bouillie (L)', type: 'number', step: '0.1', placeholder: 'Ex: 100' },
          { name: 'surface_traitee_ha', label: 'Surface traitée (ha)', type: 'number', step: '0.01', placeholder: 'Ex: 0.5' },
          { name: 'methode_application', label: 'Méthode d\'application', type: 'select', options: [
            '', 'Pulvérisateur dorsal', 'Pulvérisateur tracté', 'Atomiseur', 'Drone', 'Pinceau', 'Injection tronc', 'Arrosage'
          ]},
        ]
      },
      {
        titre: '🎯 Cible et réglementation',
        champs: [
          { name: 'cible_traitement', label: 'Cible / Ravageur', type: 'text', placeholder: 'Ex: Mouche de la truffe, Pucerons' },
          { name: 'delai_avant_recolte_jours', label: 'DAR (jours) *', type: 'number', placeholder: 'Ex: 21', help: 'Délai Avant Récolte réglementaire' },
          { name: 'zone_non_traitee_m', label: 'ZNT (mètres)', type: 'number', step: '0.1', placeholder: 'Ex: 5' },
          { name: 'equipement_protection', label: 'EPI utilisés', type: 'text', placeholder: 'Ex: Gants, masque, combinaison' },
          { name: 'conditions_application', label: 'Conditions d\'application', type: 'textarea', placeholder: 'Température, vent, hygrométrie...' },
        ]
      }
    ]
  },
  
  'Amendement': {
    icon: '🌿',
    sections: [
      {
        titre: '🌿 Produit d\'amendement',
        champs: [
          { name: 'type_amendement', label: 'Type d\'amendement', type: 'select', options: [
            '', 'Calcaire broyé', 'Dolomie', 'Chaux vive', 'Chaux éteinte', 'Lithothamne', 
            'Compost', 'Fumier composté', 'BRF', 'Cendre de bois', 'Engrais vert', 'Autre'
          ]},
          { name: 'nom_produit_amendement', label: 'Nom du produit', type: 'text', placeholder: 'Ex: Calcaire broyé 0-4' },
          { name: 'origine_produit', label: 'Fournisseur / Origine', type: 'text', placeholder: 'Ex: Carrière locale' },
          { name: 'numero_lot', label: 'N° de lot', type: 'text', placeholder: 'Pour traçabilité' },
          { name: 'certification_bio', label: 'Utilisable en bio', type: 'checkbox' },
        ]
      },
      {
        titre: '🧪 Composition',
        champs: [
          { name: 'composition_npk', label: 'NPK', type: 'text', placeholder: 'Ex: 10-5-15' },
          { name: 'composition_cao', label: 'CaO (%)', type: 'number', step: '0.1', placeholder: 'Ex: 50' },
          { name: 'composition_mgo', label: 'MgO (%)', type: 'number', step: '0.1', placeholder: 'Ex: 5' },
          { name: 'composition_autres', label: 'Autres éléments', type: 'textarea', placeholder: 'Oligoéléments, matière organique...' },
        ]
      },
      {
        titre: '📐 Dosage et application',
        champs: [
          { name: 'dose_kg_ha', label: 'Dose (kg/ha)', type: 'number', step: '1', placeholder: 'Ex: 1500' },
          { name: 'dose_kg_arbre', label: 'Dose (kg/arbre)', type: 'number', step: '0.1', placeholder: 'Ex: 5' },
          { name: 'quantite_totale_kg', label: 'Quantité totale (kg)', type: 'number', step: '1', placeholder: 'Ex: 500' },
          { name: 'methode_epandage', label: 'Méthode d\'épandage', type: 'select', options: [
            '', 'Manuel', 'Épandeur centrifuge', 'Épandeur à hérisson', 'Enfouissement localisé'
          ]},
          { name: 'incorporation', label: 'Incorporé au sol', type: 'checkbox' },
          { name: 'profondeur_incorporation_cm', label: 'Profondeur incorporation (cm)', type: 'number', placeholder: 'Ex: 10' },
        ]
      },
      {
        titre: '🌡️ Mesures pH',
        champs: [
          { name: 'ph_sol_avant', label: 'pH sol avant', type: 'number', step: '0.1', min: '0', max: '14', placeholder: 'Ex: 7.2' },
          { name: 'ph_sol_apres', label: 'pH sol après', type: 'number', step: '0.1', min: '0', max: '14', placeholder: 'Mesure différée' },
        ]
      }
    ]
  },
  
  'Taille': {
    icon: '✂️',
    sections: [
      {
        titre: '✂️ Type de taille',
        champs: [
          { name: 'type_taille', label: 'Type de taille', type: 'select', options: [
            '', 'Formation', 'Entretien', 'Sanitaire', 'Éclaircie', 'Rabattage', 'Taille en vert'
          ]},
          { name: 'intensite_taille', label: 'Intensité', type: 'select', options: [
            '', 'Légère (<20%)', 'Modérée (20-40%)', 'Forte (>40%)'
          ]},
        ]
      },
      {
        titre: '📐 Mesures',
        champs: [
          { name: 'hauteur_avant_cm', label: 'Hauteur avant (cm)', type: 'number', placeholder: 'Ex: 350' },
          { name: 'hauteur_apres_cm', label: 'Hauteur après (cm)', type: 'number', placeholder: 'Ex: 280' },
          { name: 'diametre_couronne_avant_m', label: 'Ø couronne avant (m)', type: 'number', step: '0.1', placeholder: 'Ex: 4.5' },
          { name: 'diametre_couronne_apres_m', label: 'Ø couronne après (m)', type: 'number', step: '0.1', placeholder: 'Ex: 3.5' },
          { name: 'branches_supprimees', label: 'Branches supprimées', type: 'number', placeholder: 'Nombre' },
          { name: 'diametre_max_coupe_cm', label: 'Plus gros Ø coupé (cm)', type: 'number', placeholder: 'Ex: 8' },
        ]
      },
      {
        titre: '🌿 Résidus et outils',
        champs: [
          { name: 'volume_residus_m3', label: 'Volume résidus (m³)', type: 'number', step: '0.1', placeholder: 'Ex: 2.5' },
          { name: 'destination_residus', label: 'Destination résidus', type: 'select', options: [
            '', 'Broyage sur place', 'BRF', 'Brûlage', 'Export', 'Compostage'
          ]},
          { name: 'outils_taille', label: 'Outils utilisés', type: 'text', placeholder: 'Ex: Sécateur, tronçonneuse' },
          { name: 'desinfection_outils', label: 'Outils désinfectés', type: 'checkbox' },
          { name: 'produit_desinfection', label: 'Produit désinfection', type: 'text', placeholder: 'Ex: Alcool, eau de javel' },
        ]
      }
    ]
  },
  
  'Travail du sol': {
    icon: '🚜',
    sections: [
      {
        titre: '🚜 Type de travail',
        champs: [
          { name: 'type_travail_sol', label: 'Type de travail', type: 'select', options: [
            '', 'Griffage', 'Binage', 'Décompactage', 'Désherbage mécanique', 'Scarification', 'Aération', 'Buttage'
          ]},
          { name: 'outil_travail_sol', label: 'Outil utilisé', type: 'select', options: [
            '', 'Griffe manuelle', 'Binette', 'Motobineuse', 'Décompacteur', 'Cultivateur', 'Herse rotative', 'Disque'
          ]},
          { name: 'zone_travaillee', label: 'Zone travaillée', type: 'select', options: [
            '', 'Inter-rang', 'Sous couronne', 'Brûlé uniquement', 'Rang complet', 'Parcelle entière'
          ]},
        ]
      },
      {
        titre: '📐 Paramètres',
        champs: [
          { name: 'profondeur_travail_cm', label: 'Profondeur (cm)', type: 'number', placeholder: 'Ex: 10' },
          { name: 'largeur_travail_m', label: 'Largeur (m)', type: 'number', step: '0.1', placeholder: 'Ex: 1.5' },
          { name: 'distance_tronc_m', label: 'Distance min du tronc (m)', type: 'number', step: '0.1', placeholder: 'Ex: 0.5' },
        ]
      },
      {
        titre: '🌱 État du sol',
        champs: [
          { name: 'etat_sol_avant', label: 'État du sol', type: 'select', options: [
            '', 'Sec', 'Frais', 'Humide', 'Détrempé'
          ]},
          { name: 'enherbement_avant', label: 'Enherbement avant', type: 'select', options: [
            '', 'Nul', 'Faible', 'Moyen', 'Fort'
          ]},
          { name: 'enherbement_apres', label: 'Enherbement après', type: 'select', options: [
            '', 'Nul', 'Faible', 'Moyen', 'Fort'
          ]},
          { name: 'presence_cailloux', label: 'Sol caillouteux', type: 'checkbox' },
        ]
      }
    ]
  },
  
  'Observation': {
    icon: '🔍',
    sections: [
      {
        titre: '🔍 Type d\'observation',
        champs: [
          { name: 'type_observation', label: 'Type', type: 'select', options: [
            '', 'Brûlé', 'Mycorhization', 'Santé arbre', 'Ravageurs', 'Maladie', 'Croissance', 'Général'
          ]},
          { name: 'niveau_urgence', label: 'Niveau d\'urgence', type: 'select', options: [
            '', 'Normal', 'À surveiller', 'Intervention rapide', 'Urgent'
          ]},
        ]
      },
      {
        titre: '🍄 État du brûlé',
        champs: [
          { name: 'etat_brule', label: 'État du brûlé', type: 'select', options: [
            '', 'Absent', 'Naissant', 'Bien marqué', 'Étendu', 'En régression', 'Disparu'
          ]},
          { name: 'diametre_brule_m', label: 'Diamètre brûlé (m)', type: 'number', step: '0.1', placeholder: 'Ex: 3.5' },
          { name: 'evolution_brule', label: 'Évolution', type: 'select', options: [
            '', 'Extension', 'Stable', 'Régression'
          ]},
          { name: 'presence_ascomes', label: 'Présence ascocarpes', type: 'checkbox' },
          { name: 'nombre_ascomes', label: 'Nombre observé', type: 'number', placeholder: 'Si visible' },
        ]
      },
      {
        titre: '🌿 Mycorhization et santé',
        champs: [
          { name: 'indice_mycorhization', label: 'Indice mycorhization', type: 'select', options: [
            '', 'Faible (0-30%)', 'Moyen (30-60%)', 'Fort (60-90%)', 'Excellent (>90%)'
          ]},
          { name: 'symptomes_observes', label: 'Symptômes observés', type: 'textarea', placeholder: 'Décrivez les symptômes...' },
          { name: 'ravageurs_identifies', label: 'Ravageurs identifiés', type: 'text', placeholder: 'Ex: Mouche de la truffe' },
          { name: 'degats_constates', label: 'Dégâts constatés', type: 'textarea', placeholder: 'Description des dégâts' },
        ]
      },
      {
        titre: '📝 Préconisations',
        champs: [
          { name: 'preconisations', label: 'Préconisations', type: 'textarea', placeholder: 'Actions recommandées...' },
        ]
      }
    ]
  },
  
  'Paillage': {
    icon: '🌾',
    sections: [
      {
        titre: '🌾 Paillage',
        champs: [
          { name: 'type_paillage', label: 'Type de paillage', type: 'select', options: [
            '', 'BRF', 'Paille', 'Copeaux de bois', 'Écorces', 'Feuilles mortes', 'Miscanthus', 'Autre'
          ]},
          { name: 'epaisseur_cm', label: 'Épaisseur (cm)', type: 'number', placeholder: 'Ex: 10' },
          { name: 'surface_paillee_m2', label: 'Surface paillée (m²)', type: 'number', step: '0.1', placeholder: 'Ex: 25' },
          { name: 'quantite_paillage_m3', label: 'Quantité (m³)', type: 'number', step: '0.1', placeholder: 'Ex: 2.5' },
          { name: 'origine_paillage', label: 'Origine / Fournisseur', type: 'text', placeholder: 'Ex: Production propre' },
        ]
      }
    ]
  },
  
  'Plantation': {
    icon: '🌱',
    sections: [
      {
        titre: '🌱 Plant',
        champs: [
          { name: 'espece_plantee', label: 'Espèce', type: 'select', options: [
            '', 'Chêne vert', 'Chêne pubescent', 'Chêne pédonculé', 'Noisetier', 'Charme', 'Tilleul', 'Pin', 'Autre'
          ]},
          { name: 'variete_plant', label: 'Variété / Clone', type: 'text', placeholder: 'Ex: Clone INRAE' },
          { name: 'type_mycorhization', label: 'Mycorhization', type: 'select', options: [
            '', 'Tuber melanosporum', 'Tuber aestivum', 'Tuber uncinatum', 'Tuber brumale', 'Autre'
          ]},
          { name: 'fournisseur_plant', label: 'Pépiniériste', type: 'text', placeholder: 'Ex: Robin Pépinières' },
          { name: 'certification_plant', label: 'Certification', type: 'text', placeholder: 'Ex: INRAE certifié' },
          { name: 'numero_lot_plant', label: 'N° de lot', type: 'text', placeholder: 'Pour traçabilité' },
        ]
      },
      {
        titre: '📐 Caractéristiques du plant',
        champs: [
          { name: 'taille_plant_cm', label: 'Hauteur plant (cm)', type: 'number', placeholder: 'Ex: 50' },
          { name: 'diametre_collet_mm', label: 'Ø collet (mm)', type: 'number', placeholder: 'Ex: 8' },
        ]
      },
      {
        titre: '🕳️ Plantation',
        champs: [
          { name: 'dimensions_trou_cm', label: 'Dimensions trou (cm)', type: 'text', placeholder: 'Ex: 50x50x50' },
          { name: 'amendement_plantation', label: 'Amendement à la plantation', type: 'textarea', placeholder: 'Ex: 1kg calcaire + terreau mycorhizé' },
          { name: 'arrosage_plantation_L', label: 'Arrosage plantation (L)', type: 'number', placeholder: 'Ex: 20' },
          { name: 'tuteur', label: 'Tuteur installé', type: 'checkbox' },
          { name: 'protection_gibier', label: 'Protection gibier', type: 'checkbox' },
          { name: 'type_protection', label: 'Type de protection', type: 'text', placeholder: 'Ex: Filet, manchon' },
        ]
      }
    ]
  },
  
  'Analyse de sol': {
    icon: '🧫',
    sections: [
      {
        titre: '🧫 Prélèvement',
        champs: [
          { name: 'profondeur_prelevement_cm', label: 'Profondeur (cm)', type: 'number', placeholder: 'Ex: 30' },
          { name: 'nombre_echantillons', label: 'Nombre d\'échantillons', type: 'number', placeholder: 'Ex: 5' },
          { name: 'laboratoire', label: 'Laboratoire', type: 'text', placeholder: 'Ex: INRAE, Auréa' },
          { name: 'reference_analyse', label: 'Référence analyse', type: 'text', placeholder: 'N° de dossier' },
        ]
      },
      {
        titre: '📊 Résultats',
        champs: [
          { name: 'resultats_ph', label: 'pH', type: 'number', step: '0.1', placeholder: 'Ex: 7.8' },
          { name: 'resultats_calcaire_actif', label: 'Calcaire actif (%)', type: 'number', step: '0.1', placeholder: 'Ex: 12' },
          { name: 'resultats_matiere_organique', label: 'Matière organique (%)', type: 'number', step: '0.1', placeholder: 'Ex: 2.5' },
          { name: 'resultats_azote', label: 'Azote total (‰)', type: 'number', step: '0.01', placeholder: 'Ex: 1.2' },
          { name: 'resultats_phosphore', label: 'P2O5 (mg/kg)', type: 'number', placeholder: 'Ex: 85' },
          { name: 'resultats_potassium', label: 'K2O (mg/kg)', type: 'number', placeholder: 'Ex: 180' },
          { name: 'resultats_cec', label: 'CEC (meq/100g)', type: 'number', step: '0.1', placeholder: 'Ex: 15' },
        ]
      },
      {
        titre: '📝 Interprétation',
        champs: [
          { name: 'interpretation', label: 'Interprétation et recommandations', type: 'textarea', placeholder: 'Conclusions de l\'analyse...' },
        ]
      }
    ]
  },
  
  'Piégeage': {
    icon: '🪤',
    sections: [
      {
        titre: '🪤 Piégeage',
        champs: [
          { name: 'type_piege', label: 'Type de piège', type: 'select', options: [
            '', 'Chromotopique jaune', 'Chromotopique bleu', 'Phéromone', 'Alimentaire', 'Mécanique (rongeurs)', 'Autre'
          ]},
          { name: 'cible_piegeage', label: 'Cible', type: 'text', placeholder: 'Ex: Mouche de la truffe' },
          { name: 'nombre_pieges', label: 'Nombre de pièges', type: 'number', placeholder: 'Ex: 10' },
          { name: 'densite_pieges_ha', label: 'Densité (pièges/ha)', type: 'number', placeholder: 'Ex: 20' },
        ]
      },
      {
        titre: '📊 Relevé',
        champs: [
          { name: 'date_releve', label: 'Date du relevé', type: 'date' },
          { name: 'captures', label: 'Nombre de captures', type: 'number', placeholder: 'Ex: 5' },
          { name: 'action_suite', label: 'Action décidée', type: 'textarea', placeholder: 'Traitement prévu, surveillance...' },
        ]
      }
    ]
  },
  
  'Inoculation': {
    icon: '🍄',
    sections: [
      {
        titre: '🍄 Inoculation',
        champs: [
          { name: 'type_inoculum', label: 'Type d\'inoculum', type: 'select', options: [
            '', 'Spores', 'Mycélium', 'Terre mycorhizée', 'Solution sporale', 'Gel mycorhizien'
          ]},
          { name: 'espece_truffe_inoculation', label: 'Espèce de truffe', type: 'select', options: [
            '', 'Tuber melanosporum', 'Tuber aestivum', 'Tuber uncinatum', 'Tuber brumale', 'Tuber magnatum'
          ]},
          { name: 'quantite_inoculum', label: 'Quantité', type: 'text', placeholder: 'Ex: 50g de spores' },
          { name: 'methode_inoculation', label: 'Méthode', type: 'select', options: [
            '', 'Injection racinaire', 'Arrosage solution sporale', 'Incorporation sol', 'Trempage racines'
          ]},
          { name: 'fournisseur_inoculum', label: 'Fournisseur', type: 'text', placeholder: 'Ex: Robin, Agri-Truffe' },
        ]
      }
    ]
  }
};

// ============================================================================
// COMPOSANT PRINCIPAL
// ============================================================================

function Interventions() {
  const [interventions, setInterventions] = useState([]);
  const [parcelles, setParcelles] = useState([]);
  const [arbres, setArbres] = useState([]);
  const [typesIntervention, setTypesIntervention] = useState([]);
  const [caveurs, setCaveurs] = useState([]);
  const [produitsPhyto, setProduitsPhyto] = useState([]);
  const [amendementsRef, setAmendementsRef] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [editingIntervention, setEditingIntervention] = useState(null);
  const [filterStatut, setFilterStatut] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [filterParcelle, setFilterParcelle] = useState('all');
  const [filterPeriode, setFilterPeriode] = useState('all');
  const [filterDateDebut, setFilterDateDebut] = useState('');
  const [filterDateFin, setFilterDateFin] = useState('');
  const [searchText, setSearchText] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [showGraphique, setShowGraphique] = useState(true);
  const [message, setMessage] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // État pour la pagination
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);
  
  // ============ SÉLECTION MULTIPLE ============
  const [selectedInterventions, setSelectedInterventions] = useState(new Set());
  const [showBulkEditModal, setShowBulkEditModal] = useState(false);
  const [bulkEditData, setBulkEditData] = useState({
    statut: '',
    date_realisee: ''
  });
  
  // Modal de confirmation
  const [confirmModal, setConfirmModal] = useState(null);
  
  // Avertissement doublon
  const [doublonWarning, setDoublonWarning] = useState(null);
  
  // Personnel par défaut
  const [personnelDefaut, setPersonnelDefaut] = useState('');
  
  // Filtre de recherche pour les arbres
  const [arbreSearchText, setArbreSearchText] = useState('');
  
  // Afficher/masquer les champs avancés
  const [showAdvancedFields, setShowAdvancedFields] = useState(false);
  
  const [formData, setFormData] = useState({
    type_intervention_id: '',
    parcelle_id: '',
    arbre_ids: [],
    date_prevue: '',
    date_realisee: '',
    statut: 'Planifié',
    description: '',
    notes: '',
    cout: '',
    duree_minutes: '',
    meteo: '',
    personnel: '',
    caveur_id: '',
    details: {}
  });

  // Hook pour les paramètres de colonnes
  const { colonnesAffichees, colonnesExport, loading: loadingSettings } = useColumnSettings('interventions');

  useEffect(() => {
    loadData();
  }, []);

  const showMessage = (text, type = 'success') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 4000);
  };

  const loadData = async () => {
    try {
      const [interventionsRes, parcellesRes, arbresRes, typesRes, caveursRes, produitsRes, amendementsRes] = await Promise.all([
        axios.get(`${API_URL}/interventions`),
        axios.get(`${API_URL}/parcelles`),
        axios.get(`${API_URL}/arbres`),
        axios.get(`${API_URL}/types-intervention`),
        axios.get(`${API_URL}/caveurs`).catch(() => ({ data: [] })),
        axios.get(`${API_URL}/produits-phyto`).catch(() => ({ data: [] })),
        axios.get(`${API_URL}/amendements`).catch(() => ({ data: [] }))
      ]);
      setInterventions(interventionsRes.data);
      setParcelles(parcellesRes.data);
      setArbres(arbresRes.data);
      setTypesIntervention(typesRes.data);
      setCaveurs(caveursRes.data);
      setProduitsPhyto(produitsRes.data);
      setAmendementsRef(amendementsRes.data);
      setLoading(false);
    } catch (error) {
      console.error('Erreur lors du chargement:', error);
      setLoading(false);
    }
  };

  // Filtrer les interventions
  const filteredInterventions = useMemo(() => {
    return interventions.filter(intervention => {
      // Filtre par statut
      if (filterStatut !== 'all' && intervention.statut !== filterStatut) {
        return false;
      }
      
      // Filtre par type
      if (filterType !== 'all' && intervention.type_intervention_id !== parseInt(filterType)) {
        return false;
      }
      
      // Filtre par parcelle
      if (filterParcelle !== 'all' && intervention.parcelle_id !== parseInt(filterParcelle)) {
        return false;
      }
      
      // Filtre par période
      if (filterPeriode !== 'all') {
        const dateIntervention = new Date(intervention.date_prevue);
        const now = new Date();
        
        if (filterPeriode === 'today') {
          if (dateIntervention.toDateString() !== now.toDateString()) return false;
        } else if (filterPeriode === 'week') {
          const weekStart = new Date(now);
          weekStart.setDate(now.getDate() - now.getDay());
          const weekEnd = new Date(weekStart);
          weekEnd.setDate(weekStart.getDate() + 7);
          if (dateIntervention < weekStart || dateIntervention > weekEnd) return false;
        } else if (filterPeriode === 'month') {
          if (dateIntervention.getMonth() !== now.getMonth() || dateIntervention.getFullYear() !== now.getFullYear()) return false;
        }
      }
      
      // Filtre par dates personnalisées
      if (filterDateDebut) {
        const dateDebut = new Date(filterDateDebut);
        const dateIntervention = new Date(intervention.date_prevue);
        if (dateIntervention < dateDebut) return false;
      }
      
      if (filterDateFin) {
        const dateFin = new Date(filterDateFin);
        const dateIntervention = new Date(intervention.date_prevue);
        if (dateIntervention > dateFin) return false;
      }
      
      // Filtre par recherche textuelle
      if (searchText) {
        const search = searchText.toLowerCase();
        const typeNom = typesIntervention.find(t => t.id === intervention.type_intervention_id)?.nom || '';
        const parcelleNom = intervention.parcelle_nom || '';
        const description = intervention.description || '';
        const notes = intervention.notes || '';
        
        if (!typeNom.toLowerCase().includes(search) && 
            !parcelleNom.toLowerCase().includes(search) &&
            !description.toLowerCase().includes(search) &&
            !notes.toLowerCase().includes(search)) {
          return false;
        }
      }
      
      return true;
    });
  }, [interventions, filterStatut, filterType, filterParcelle, filterPeriode, filterDateDebut, filterDateFin, searchText, typesIntervention]);

  // Calculer le nombre de filtres actifs
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filterStatut !== 'all') count++;
    if (filterType !== 'all') count++;
    if (filterParcelle !== 'all') count++;
    if (filterPeriode !== 'all') count++;
    if (filterDateDebut) count++;
    if (filterDateFin) count++;
    if (searchText) count++;
    return count;
  }, [filterStatut, filterType, filterParcelle, filterPeriode, filterDateDebut, filterDateFin, searchText]);

  // ===== PAGINATION =====
  const totalInterventions = filteredInterventions.length;
  const totalPages = itemsPerPage === 'all' ? 1 : Math.ceil(totalInterventions / itemsPerPage);
  
  const paginatedInterventions = itemsPerPage === 'all' 
    ? filteredInterventions 
    : filteredInterventions.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handleItemsPerPageChange = (value) => {
    setItemsPerPage(value);
    setCurrentPage(1);
  };

  const getPageNumbers = () => {
    const pages = [];
    const maxVisiblePages = 5;
    
    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= 4; i++) pages.push(i);
        pages.push('...');
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1);
        pages.push('...');
        for (let i = totalPages - 3; i <= totalPages; i++) pages.push(i);
      } else {
        pages.push(1);
        pages.push('...');
        for (let i = currentPage - 1; i <= currentPage + 1; i++) pages.push(i);
        pages.push('...');
        pages.push(totalPages);
      }
    }
    return pages;
  };

  // Vérifier si tous les éléments de la page sont sélectionnés
  const isAllPageSelected = paginatedInterventions.length > 0 && paginatedInterventions.every(i => selectedInterventions.has(i.id));
  const isSomePageSelected = paginatedInterventions.some(i => selectedInterventions.has(i.id));

  // ============ SÉLECTION MULTIPLE - FONCTIONS ============
  
  // Gérer la sélection d'une intervention
  const handleSelectIntervention = (interventionId) => {
    setSelectedInterventions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(interventionId)) {
        newSet.delete(interventionId);
      } else {
        newSet.add(interventionId);
      }
      return newSet;
    });
  };

  // Sélectionner/Désélectionner tous les éléments de la page courante
  const handleSelectAllPage = () => {
    const pageIds = paginatedInterventions.map(i => i.id);
    const allSelected = pageIds.every(id => selectedInterventions.has(id));
    
    setSelectedInterventions(prev => {
      const newSet = new Set(prev);
      if (allSelected) {
        pageIds.forEach(id => newSet.delete(id));
      } else {
        pageIds.forEach(id => newSet.add(id));
      }
      return newSet;
    });
  };

  // Sélectionner tous les éléments filtrés
  const handleSelectAllFiltered = () => {
    const allIds = filteredInterventions.map(i => i.id);
    setSelectedInterventions(new Set(allIds));
  };

  // Désélectionner tout
  const handleDeselectAll = () => {
    setSelectedInterventions(new Set());
  };

  // Ouvrir le modal de modification groupée
  const openBulkEditModal = () => {
    setBulkEditData({
      statut: '',
      date_realisee: ''
    });
    setShowBulkEditModal(true);
  };

  // Gérer les changements dans le formulaire de modification groupée
  const handleBulkEditChange = (e) => {
    const { name, value } = e.target;
    setBulkEditData(prev => ({ ...prev, [name]: value }));
  };

  // Appliquer les modifications groupées
  const handleBulkEditSubmit = async () => {
    if (selectedInterventions.size === 0) return;
    
    setIsProcessing(true);
    
    try {
      const updates = {};
      if (bulkEditData.statut) updates.statut = bulkEditData.statut;
      if (bulkEditData.date_realisee) updates.date_realisee = bulkEditData.date_realisee;

      if (Object.keys(updates).length === 0) {
        showMessage('Aucune modification à appliquer', 'error');
        setIsProcessing(false);
        return;
      }

      let successCount = 0;
      let errorCount = 0;

      for (const interventionId of selectedInterventions) {
        const intervention = interventions.find(i => i.id === interventionId);
        if (intervention) {
          try {
            await axios.put(`${API_URL}/interventions/${interventionId}`, {
              ...intervention,
              ...updates
            });
            successCount++;
          } catch (error) {
            console.error(`Erreur pour l'intervention ${interventionId}:`, error);
            errorCount++;
          }
        }
      }

      if (errorCount === 0) {
        showMessage(`${successCount} intervention(s) modifiée(s) avec succès !`, 'success');
      } else {
        showMessage(`${successCount} modifiée(s), ${errorCount} erreur(s)`, 'error');
      }

      loadData();
      setShowBulkEditModal(false);
      setSelectedInterventions(new Set());
    } catch (error) {
      console.error('Erreur lors de la modification groupée:', error);
      showMessage('Erreur lors de la modification groupée', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  // Demander confirmation pour suppression groupée
  const askBulkDelete = () => {
    setConfirmModal({
      type: 'bulk-delete',
      item: null,
      title: 'Suppression groupée',
      message: `Voulez-vous supprimer ${selectedInterventions.size} intervention(s) ? Cette action est irréversible.`,
      confirmText: 'Oui, supprimer',
      confirmColor: '#f44336'
    });
  };

  // Exécuter la suppression groupée
  const doBulkDelete = async () => {
    setIsProcessing(true);
    setConfirmModal(null);
    
    try {
      let successCount = 0;
      let errorCount = 0;

      for (const interventionId of selectedInterventions) {
        try {
          await axios.delete(`${API_URL}/interventions/${interventionId}`);
          successCount++;
        } catch (error) {
          console.error(`Erreur pour l'intervention ${interventionId}:`, error);
          errorCount++;
        }
      }

      if (errorCount === 0) {
        showMessage(`${successCount} intervention(s) supprimée(s) !`, 'success');
      } else {
        showMessage(`${successCount} supprimée(s), ${errorCount} erreur(s)`, 'error');
      }

      loadData();
      setSelectedInterventions(new Set());
    } catch (error) {
      console.error('Erreur lors de la suppression groupée:', error);
      showMessage('Erreur lors de la suppression groupée', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  // Réinitialiser les filtres
  const resetFilters = () => {
    setFilterStatut('all');
    setFilterType('all');
    setFilterParcelle('all');
    setFilterPeriode('all');
    setFilterDateDebut('');
    setFilterDateFin('');
    setSearchText('');
    setCurrentPage(1);
  };

  // Statistiques
  const stats = useMemo(() => {
    return {
      total: interventions.length,
      planifiees: interventions.filter(i => i.statut === 'Planifié').length,
      enCours: interventions.filter(i => i.statut === 'En cours').length,
      terminees: interventions.filter(i => i.statut === 'Terminé').length,
      annulees: interventions.filter(i => i.statut === 'Annulé').length,
      coutTotal: interventions.reduce((sum, i) => sum + (parseFloat(i.cout) || 0), 0),
      dureeTotale: interventions.reduce((sum, i) => sum + (parseInt(i.duree_minutes) || 0), 0)
    };
  }, [interventions]);

  // Données pour le graphique d'activité
  const graphiqueData = useMemo(() => {
    const data = [];
    const now = new Date();
    
    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mois = date.toLocaleDateString('fr-FR', { month: 'short' });
      const annee = date.getFullYear();
      const moisNum = date.getMonth();
      
      const interventionsMois = interventions.filter(intervention => {
        const dateInt = new Date(intervention.date_prevue || intervention.date_realisee);
        return dateInt.getMonth() === moisNum && dateInt.getFullYear() === annee;
      });
      
      data.push({
        mois: mois,
        annee: annee,
        total: interventionsMois.length,
        terminees: interventionsMois.filter(i => i.statut === 'Terminé').length,
        enCours: interventionsMois.filter(i => i.statut === 'En cours').length,
        planifiees: interventionsMois.filter(i => i.statut === 'Planifié').length
      });
    }
    
    return data;
  }, [interventions]);

  const maxInterventions = Math.max(...graphiqueData.map(d => d.total), 1);

  // Filtrer les arbres par parcelle et recherche
  const arbresFiltered = useMemo(() => {
    return arbres.filter(arbre => {
      if (formData.parcelle_id && arbre.parcelle_id !== parseInt(formData.parcelle_id)) {
        return false;
      }
      if (arbreSearchText) {
        const search = arbreSearchText.toLowerCase();
        const matchNumero = arbre.numero?.toLowerCase().includes(search);
        const matchEspece = arbre.espece?.toLowerCase().includes(search);
        const matchVariete = arbre.variete_truffe?.toLowerCase().includes(search);
        const matchEtat = arbre.etat?.toLowerCase().includes(search);
        if (!matchNumero && !matchEspece && !matchVariete && !matchEtat) return false;
      }
      return true;
    });
  }, [arbres, formData.parcelle_id, arbreSearchText]);

  // Configuration des colonnes pour l'affichage
  const config = COLONNES_CONFIG.interventions;
  const colonnesValides = colonnesAffichees.filter(col => config[col]);

  // Obtenir le nom du type d'intervention
  const getTypeName = (typeId) => {
    const type = typesIntervention.find(t => t.id === typeId);
    return type ? type.nom : '-';
  };

  // Obtenir l'icône du type
  const getTypeIcon = (typeName) => {
    return CHAMPS_PAR_TYPE[typeName]?.icon || '📋';
  };

  // Rendu d'une cellule du tableau
  const renderCell = (intervention, col) => {
    if (col === 'type_nom') {
      const typeName = intervention.type_nom || getTypeName(intervention.type_intervention_id);
      const icon = getTypeIcon(typeName);
      return (
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span>{icon}</span>
          <strong>{typeName}</strong>
        </span>
      );
    }
    
    if (col === 'statut') {
      const statutStyles = {
        'Planifié': { background: '#fff3cd', color: '#856404' },
        'En cours': { background: '#cce5ff', color: '#004085' },
        'Terminé': { background: '#d4edda', color: '#155724' },
        'Annulé': { background: '#f8d7da', color: '#721c24' }
      };
      const style = statutStyles[intervention.statut] || statutStyles['Planifié'];
      return (
        <span style={{
          padding: '0.25rem 0.75rem',
          borderRadius: '12px',
          fontSize: '0.85rem',
          fontWeight: '500',
          ...style
        }}>
          {intervention.statut}
        </span>
      );
    }
    
    if (col === 'date_prevue' || col === 'date_realisee') {
      const date = intervention[col];
      if (!date) return '-';
      return new Date(date).toLocaleDateString('fr-FR');
    }
    
    if (col === 'cout') {
      const cout = parseFloat(intervention.cout);
      if (!cout || isNaN(cout)) return '-';
      return `${cout.toFixed(2)} €`;
    }
    
    if (col === 'duree_minutes') {
      const duree = parseInt(intervention.duree_minutes);
      if (!duree || isNaN(duree)) return '-';
      const heures = Math.floor(duree / 60);
      const minutes = duree % 60;
      return heures > 0 ? `${heures}h${minutes > 0 ? minutes : ''}` : `${minutes}min`;
    }
    
    if (config[col]?.render) {
      return config[col].render(intervention);
    }
    
    return intervention[col] || '-';
  };

  // Fonctions de gestion du formulaire
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    
    // Réinitialiser la recherche d'arbres quand la parcelle change
    if (name === 'parcelle_id') {
      setArbreSearchText('');
      setFormData(prev => ({ ...prev, arbre_ids: [] }));
    }
    
    // Réinitialiser les détails quand le type change
    if (name === 'type_intervention_id') {
      setFormData(prev => ({ ...prev, details: {} }));
      setShowAdvancedFields(false);
    }
  };

  const handleArbresChange = (e) => {
    const selectedOptions = Array.from(e.target.selectedOptions, option => parseInt(option.value));
    setFormData(prev => ({ ...prev, arbre_ids: selectedOptions }));
  };

  const handleDetailsChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      details: {
        ...prev.details,
        [name]: type === 'checkbox' ? checked : value
      }
    }));
  };

  const openNewModal = () => {
    setEditingIntervention(null);
    setFormData({
      type_intervention_id: '',
      parcelle_id: '',
      arbre_ids: [],
      date_prevue: new Date().toISOString().split('T')[0],
      date_realisee: '',
      statut: 'Planifié',
      description: '',
      notes: '',
      cout: '',
      duree_minutes: '',
      meteo: '',
      personnel: personnelDefaut,
      caveur_id: '',
      details: {}
    });
    setArbreSearchText('');
    setShowAdvancedFields(false);
    setDoublonWarning(null);
    setShowModal(true);
  };

  const handleEdit = (intervention) => {
    setEditingIntervention(intervention);
    setFormData({
      type_intervention_id: intervention.type_intervention_id || '',
      parcelle_id: intervention.parcelle_id || '',
      arbre_ids: intervention.arbre_ids || [],
      date_prevue: intervention.date_prevue ? intervention.date_prevue.split('T')[0] : '',
      date_realisee: intervention.date_realisee ? intervention.date_realisee.split('T')[0] : '',
      statut: intervention.statut || 'Planifié',
      description: intervention.description || '',
      notes: intervention.notes || '',
      cout: intervention.cout || '',
      duree_minutes: intervention.duree_minutes || '',
      meteo: intervention.meteo || '',
      personnel: intervention.personnel || '',
      caveur_id: intervention.caveur_id || '',
      details: intervention.details || {}
    });
    setArbreSearchText('');
    setShowAdvancedFields(Object.keys(intervention.details || {}).length > 0);
    setDoublonWarning(null);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingIntervention(null);
    setDoublonWarning(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsProcessing(true);
    
    try {
      const dataToSend = {
        ...formData,
        cout: formData.cout ? parseFloat(formData.cout) : null,
        duree_minutes: formData.duree_minutes ? parseInt(formData.duree_minutes) : null
      };
      
      if (editingIntervention) {
        await axios.put(`${API_URL}/interventions/${editingIntervention.id}`, dataToSend);
        showMessage('Intervention mise à jour avec succès !', 'success');
      } else {
        await axios.post(`${API_URL}/interventions`, dataToSend);
        showMessage('Intervention créée avec succès !', 'success');
      }
      loadData();
      closeModal();
    } catch (error) {
      console.error('Erreur lors de la sauvegarde:', error);
      showMessage('Erreur lors de la sauvegarde de l\'intervention', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  // Demander confirmation pour suppression
  const askDelete = (intervention) => {
    setConfirmModal({
      type: 'delete',
      item: intervention,
      title: 'Supprimer l\'intervention',
      message: `Voulez-vous vraiment supprimer cette intervention ? Cette action est irréversible.`,
      confirmText: 'Oui, supprimer',
      confirmColor: '#f44336'
    });
  };

  // Exécuter la suppression
  const doDelete = async (intervention) => {
    setIsProcessing(true);
    setConfirmModal(null);
    
    try {
      await axios.delete(`${API_URL}/interventions/${intervention.id}`);
      showMessage('Intervention supprimée', 'success');
      loadData();
    } catch (error) {
      console.error('Erreur lors de la suppression:', error);
      showMessage('Erreur lors de la suppression', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  // Gérer la confirmation selon le type
  const handleConfirm = () => {
    if (!confirmModal) return;
    
    switch (confirmModal.type) {
      case 'delete':
        doDelete(confirmModal.item);
        break;
      case 'bulk-delete':
        doBulkDelete();
        break;
      default:
        setConfirmModal(null);
    }
  };

  // Export PDF
  const handleExportPDF = () => {
    exportInterventionsPDF(filteredInterventions, null, colonnesExport);
  };

  // Import CSV
  const handleImportCSV = async (validData) => {
    try {
      for (const intervention of validData) {
        await axios.post(`${API_URL}/interventions`, intervention);
      }
      loadData();
      showMessage(`${validData.length} intervention(s) importée(s) avec succès !`, 'success');
    } catch (error) {
      console.error('Erreur lors de l\'import:', error);
      throw new Error('Erreur lors de l\'import des interventions');
    }
  };

  // Sélection rapide de produit phyto
  const handleSelectProduitPhyto = (produit) => {
    setFormData(prev => ({
      ...prev,
      details: {
        ...prev.details,
        nom_commercial: produit.nom_commercial,
        matiere_active: produit.matiere_active,
        numero_amm: produit.numero_amm,
        fabricant: produit.fabricant,
        categorie_traitement: produit.categorie,
        delai_avant_recolte_jours: produit.dar_jours
      }
    }));
  };

  // Sélection rapide d'amendement
  const handleSelectAmendement = (amendement) => {
    setFormData(prev => ({
      ...prev,
      details: {
        ...prev.details,
        type_amendement: amendement.type_amendement,
        nom_produit_amendement: amendement.nom,
        composition_npk: amendement.npk,
        composition_cao: amendement.cao,
        certification_bio: amendement.utilisable_bio
      }
    }));
  };

  // Obtenir la configuration des champs pour le type sélectionné
  const getFieldsConfig = () => {
    const typeName = getTypeName(parseInt(formData.type_intervention_id));
    return CHAMPS_PAR_TYPE[typeName] || null;
  };

  const getSelectedTypeName = () => {
    return getTypeName(parseInt(formData.type_intervention_id));
  };

  // Rendu d'un champ du formulaire détaillé
  const renderField = (champ) => {
    const value = formData.details[champ.name] || '';
    
    if (champ.type === 'select') {
      return (
        <select
          name={champ.name}
          value={value}
          onChange={handleDetailsChange}
          style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ddd' }}
        >
          {champ.options.map((option, idx) => (
            <option key={idx} value={option}>{option || 'Sélectionner...'}</option>
          ))}
        </select>
      );
    }
    
    if (champ.type === 'textarea') {
      return (
        <textarea
          name={champ.name}
          value={value}
          onChange={handleDetailsChange}
          placeholder={champ.placeholder}
          rows={3}
          style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ddd' }}
        />
      );
    }
    
    if (champ.type === 'checkbox') {
      return (
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
          <input
            type="checkbox"
            name={champ.name}
            checked={value || false}
            onChange={handleDetailsChange}
          />
          <span>Oui</span>
        </label>
      );
    }
    
    return (
      <input
        type={champ.type}
        name={champ.name}
        value={value}
        onChange={handleDetailsChange}
        placeholder={champ.placeholder}
        step={champ.step}
        min={champ.min}
        max={champ.max}
        style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ddd' }}
      />
    );
  };

  if (loading || loadingSettings) return <div className="loading">Chargement des interventions...</div>;

  const fieldsConfig = getFieldsConfig();
  const selectedTypeName = getSelectedTypeName();

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
            maxWidth: '420px',
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
                disabled={isProcessing}
                style={{ 
                  padding: '0.75rem 1.5rem',
                  background: confirmModal.confirmColor || '#f44336',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: isProcessing ? 'wait' : 'pointer',
                  opacity: isProcessing ? 0.7 : 1
                }}
              >
                {isProcessing ? 'En cours...' : confirmModal.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}

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
          boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
          maxWidth: '400px'
        }}>
          {message.text}
        </div>
      )}

      <div className="page-header">
        <h2>🗓 Gestion des Interventions</h2>
        <div className="header-actions">
          <button className="btn btn-secondary" onClick={() => setShowImportModal(true)}>
            📥 Importer CSV
          </button>
          <button className="btn btn-secondary" onClick={handleExportPDF}>
            📄 Exporter PDF
          </button>
          <button className="btn btn-primary" onClick={openNewModal}>
            ➕ Nouvelle intervention
          </button>
        </div>
      </div>

      {/* Statistiques */}
      <div className="stats-grid">
        <div className="card">
          <div className="card-title">Total</div>
          <div className="card-value">{stats.total}</div>
        </div>
        <div className="card" style={{ background: '#fff3cd' }}>
          <div className="card-title">📋 Planifiées</div>
          <div className="card-value" style={{ color: '#856404' }}>{stats.planifiees}</div>
        </div>
        <div className="card" style={{ background: '#cce5ff' }}>
          <div className="card-title">🔄 En cours</div>
          <div className="card-value" style={{ color: '#004085' }}>{stats.enCours}</div>
        </div>
        <div className="card" style={{ background: '#d4edda' }}>
          <div className="card-title">✅ Terminées</div>
          <div className="card-value" style={{ color: '#155724' }}>{stats.terminees}</div>
        </div>
        <div className="card">
          <div className="card-title">💰 Coût total</div>
          <div className="card-value">{stats.coutTotal.toFixed(0)} €</div>
        </div>
        <div className="card">
          <div className="card-title">⏱️ Durée totale</div>
          <div className="card-value">{Math.floor(stats.dureeTotale / 60)}h{stats.dureeTotale % 60 > 0 ? (stats.dureeTotale % 60) : ''}</div>
        </div>
      </div>

      {/* Barre de sélection groupée */}
      {selectedInterventions.size > 0 && (
        <div style={{
          background: '#e3f2fd',
          padding: '1rem',
          borderRadius: '12px',
          marginBottom: '1rem',
          border: '2px solid #1976d2',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <span style={{ fontWeight: 'bold', color: '#1976d2' }}>
              ✅ {selectedInterventions.size} intervention(s) sélectionnée(s)
            </span>
            <button
              onClick={handleDeselectAll}
              style={{
                padding: '0.4rem 0.8rem',
                background: 'transparent',
                border: '1px solid #1976d2',
                borderRadius: '6px',
                color: '#1976d2',
                cursor: 'pointer'
              }}
            >
              Tout désélectionner
            </button>
            {filteredInterventions.length > selectedInterventions.size && (
              <button
                onClick={handleSelectAllFiltered}
                style={{
                  padding: '0.4rem 0.8rem',
                  background: 'transparent',
                  border: '1px solid #1976d2',
                  borderRadius: '6px',
                  color: '#1976d2',
                  cursor: 'pointer'
                }}
              >
                Sélectionner les {filteredInterventions.length} interventions filtrées
              </button>
            )}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={openBulkEditModal}
              className="btn btn-primary"
              style={{ padding: '0.5rem 1rem' }}
            >
              ✏️ Modifier la sélection
            </button>
            <button
              onClick={askBulkDelete}
              className="btn btn-danger"
              style={{ padding: '0.5rem 1rem' }}
            >
              🗑️ Supprimer la sélection
            </button>
          </div>
        </div>
      )}

      {/* Graphique d'activité temporel */}
      <div style={{ 
        background: 'white', 
        borderRadius: '12px', 
        padding: '1.5rem', 
        marginBottom: '1.5rem',
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        border: '1px solid #e9ecef'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ margin: 0, color: '#2c5f2d', fontSize: '1.1rem' }}>
            📊 Activité des 6 derniers mois
          </h3>
          <button 
            onClick={() => setShowGraphique(!showGraphique)}
            style={{ 
              background: 'none', 
              border: 'none', 
              cursor: 'pointer', 
              fontSize: '1.2rem',
              color: '#666'
            }}
          >
            {showGraphique ? '▼' : '▶'}
          </button>
        </div>
        
        {showGraphique && (
          <>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.5rem', height: '180px', padding: '0.5rem 0' }}>
              {graphiqueData.map((data, index) => (
                <div key={index} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%' }}>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', width: '100%', gap: '2px' }}>
                    {/* Barre terminées */}
                    {data.terminees > 0 && (
                      <div 
                        style={{ 
                          height: `${(data.terminees / maxInterventions) * 140}px`,
                          background: 'linear-gradient(180deg, #28a745 0%, #218838 100%)',
                          borderRadius: '4px 4px 0 0',
                          minHeight: '8px',
                          transition: 'height 0.3s ease'
                        }}
                        title={`${data.terminees} terminée(s)`}
                      />
                    )}
                    {/* Barre en cours */}
                    {data.enCours > 0 && (
                      <div 
                        style={{ 
                          height: `${(data.enCours / maxInterventions) * 140}px`,
                          background: 'linear-gradient(180deg, #007bff 0%, #0056b3 100%)',
                          minHeight: '8px',
                          transition: 'height 0.3s ease'
                        }}
                        title={`${data.enCours} en cours`}
                      />
                    )}
                    {/* Barre planifiées */}
                    {data.planifiees > 0 && (
                      <div 
                        style={{ 
                          height: `${(data.planifiees / maxInterventions) * 140}px`,
                          background: 'linear-gradient(180deg, #ffc107 0%, #e0a800 100%)',
                          borderRadius: '0 0 4px 4px',
                          minHeight: '8px',
                          transition: 'height 0.3s ease'
                        }}
                        title={`${data.planifiees} planifiée(s)`}
                      />
                    )}
                    {data.total === 0 && (
                      <div style={{ height: '8px', background: '#e9ecef', borderRadius: '4px', width: '100%' }} />
                    )}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#666', marginTop: '0.5rem', textAlign: 'center' }}>
                    {data.mois}
                  </div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#333' }}>
                    {data.total}
                  </div>
                </div>
              ))}
            </div>
            
            {/* Légende */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: '1.5rem', marginTop: '1rem', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ width: '12px', height: '12px', background: '#ffc107', borderRadius: '2px' }} />
                <span style={{ fontSize: '0.85rem', color: '#666' }}>Planifiées</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ width: '12px', height: '12px', background: '#007bff', borderRadius: '2px' }} />
                <span style={{ fontSize: '0.85rem', color: '#666' }}>En cours</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ width: '12px', height: '12px', background: '#28a745', borderRadius: '2px' }} />
                <span style={{ fontSize: '0.85rem', color: '#666' }}>Terminées</span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Barre de recherche et filtres */}
      <div style={{ 
        background: 'white', 
        borderRadius: '12px', 
        padding: '1rem 1.5rem', 
        marginBottom: '1.5rem',
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        border: '1px solid #e9ecef'
      }}>
        {/* Ligne principale : recherche + bouton filtres */}
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ flex: '1', minWidth: '250px', position: 'relative' }}>
            <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '1.1rem' }}>🔍</span>
            <input 
              type="text"
              placeholder="Rechercher une intervention..."
              value={searchText}
              onChange={(e) => { setSearchText(e.target.value); setCurrentPage(1); }}
              style={{ 
                width: '100%', 
                padding: '0.75rem 0.75rem 0.75rem 2.5rem', 
                borderRadius: '8px', 
                border: '1px solid #ddd',
                fontSize: '0.95rem'
              }}
            />
          </div>
          
          <button 
            onClick={() => setShowFilters(!showFilters)}
            style={{ 
              padding: '0.75rem 1rem',
              borderRadius: '8px',
              border: '1px solid #ddd',
              background: showFilters ? '#2c5f2d' : 'white',
              color: showFilters ? 'white' : '#333',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontSize: '0.95rem'
            }}
          >
            🏷️ Filtres
            {activeFiltersCount > 0 && (
              <span style={{
                background: '#e74c3c',
                color: 'white',
                borderRadius: '50%',
                width: '20px',
                height: '20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.75rem',
                fontWeight: 'bold'
              }}>
                {activeFiltersCount}
              </span>
            )}
          </button>
          
          {activeFiltersCount > 0 && (
            <button 
              onClick={resetFilters}
              style={{ 
                padding: '0.75rem 1rem',
                borderRadius: '8px',
                border: 'none',
                background: '#ffebee',
                color: '#c62828',
                cursor: 'pointer',
                fontSize: '0.95rem'
              }}
            >
              ✖ Réinitialiser
            </button>
          )}
        </div>
        
        {/* Panneau de filtres */}
        {showFilters && (
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', 
            gap: '1rem', 
            marginTop: '1rem',
            paddingTop: '1rem',
            borderTop: '1px solid #eee'
          }}>
            {/* Filtre par statut */}
            <div>
              <label style={{ fontSize: '0.85rem', color: '#666', marginBottom: '0.5rem', display: 'block' }}>
                📊 Statut
              </label>
              <select 
                value={filterStatut} 
                onChange={(e) => { setFilterStatut(e.target.value); setCurrentPage(1); }}
                style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid #ddd' }}
              >
                <option value="all">Tous les statuts</option>
                <option value="Planifié">📋 Planifié</option>
                <option value="En cours">🔄 En cours</option>
                <option value="Terminé">✅ Terminé</option>
                <option value="Annulé">❌ Annulé</option>
              </select>
            </div>
            
            {/* Filtre par type */}
            <div>
              <label style={{ fontSize: '0.85rem', color: '#666', marginBottom: '0.5rem', display: 'block' }}>
                🏷️ Type
              </label>
              <select 
                value={filterType} 
                onChange={(e) => { setFilterType(e.target.value); setCurrentPage(1); }}
                style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid #ddd' }}
              >
                <option value="all">Tous les types</option>
                {typesIntervention.map(type => (
                  <option key={type.id} value={type.id}>
                    {CHAMPS_PAR_TYPE[type.nom]?.icon || '📋'} {type.nom}
                  </option>
                ))}
              </select>
            </div>
            
            {/* Filtre par période */}
            <div>
              <label style={{ fontSize: '0.85rem', color: '#666', marginBottom: '0.5rem', display: 'block' }}>
                📅 Période
              </label>
              <select 
                value={filterPeriode} 
                onChange={(e) => { setFilterPeriode(e.target.value); setCurrentPage(1); }}
                style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid #ddd' }}
              >
                <option value="all">Toutes périodes</option>
                <option value="today">Aujourd'hui</option>
                <option value="week">Cette semaine</option>
                <option value="month">Ce mois</option>
              </select>
            </div>
            
            {/* Filtre par parcelle */}
            <div>
              <label style={{ fontSize: '0.85rem', color: '#666', marginBottom: '0.5rem', display: 'block' }}>
                🗺️ Parcelle
              </label>
              <select 
                value={filterParcelle} 
                onChange={(e) => { setFilterParcelle(e.target.value); setCurrentPage(1); }}
                style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid #ddd' }}
              >
                <option value="all">Toutes les parcelles</option>
                {parcelles.map(parcelle => (
                  <option key={parcelle.id} value={parcelle.id}>
                    {parcelle.nom}
                  </option>
                ))}
              </select>
            </div>
            
            {/* Filtre par date début */}
            <div>
              <label style={{ fontSize: '0.85rem', color: '#666', marginBottom: '0.5rem', display: 'block' }}>
                📅 Date début
              </label>
              <input 
                type="date"
                value={filterDateDebut}
                onChange={(e) => { setFilterDateDebut(e.target.value); setCurrentPage(1); }}
                style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid #ddd' }}
              />
            </div>
            
            {/* Filtre par date fin */}
            <div>
              <label style={{ fontSize: '0.85rem', color: '#666', marginBottom: '0.5rem', display: 'block' }}>
                📅 Date fin
              </label>
              <input 
                type="date"
                value={filterDateFin}
                onChange={(e) => { setFilterDateFin(e.target.value); setCurrentPage(1); }}
                style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid #ddd' }}
              />
            </div>
          </div>
        )}
        
        {/* Résultat du filtrage */}
        <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: '#666', fontSize: '0.9rem' }}>
            {filteredInterventions.length} intervention{filteredInterventions.length > 1 ? 's' : ''} trouvée{filteredInterventions.length > 1 ? 's' : ''}
            {activeFiltersCount > 0 && ` (${activeFiltersCount} filtre${activeFiltersCount > 1 ? 's' : ''} actif${activeFiltersCount > 1 ? 's' : ''})`}
          </span>
        </div>
      </div>

      {/* Contrôles de pagination */}
      {filteredInterventions.length > 0 && (
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          marginBottom: '1rem',
          flexWrap: 'wrap',
          gap: '1rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontWeight: '500', color: '#666' }}>Afficher :</span>
            {PAGINATION_OPTIONS.map(option => (
              <button
                key={option.value}
                onClick={() => handleItemsPerPageChange(option.value)}
                style={{
                  padding: '0.4rem 0.8rem',
                  border: itemsPerPage === option.value ? '2px solid #2c5f2d' : '1px solid #ddd',
                  borderRadius: '6px',
                  background: itemsPerPage === option.value ? '#e8f5e9' : 'white',
                  color: itemsPerPage === option.value ? '#2c5f2d' : '#666',
                  fontWeight: itemsPerPage === option.value ? 'bold' : 'normal',
                  cursor: 'pointer'
                }}
              >
                {option.label}
              </button>
            ))}
          </div>
          
          {itemsPerPage !== 'all' && (
            <div style={{ color: '#666', fontSize: '0.9rem' }}>
              Affichage de {((currentPage - 1) * itemsPerPage) + 1} à {Math.min(currentPage * itemsPerPage, totalInterventions)} sur {totalInterventions} interventions
            </div>
          )}
        </div>
      )}

      {filteredInterventions.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🗓</div>
          <p>Aucune intervention trouvée</p>
          {activeFiltersCount > 0 ? (
            <button className="btn btn-secondary" onClick={resetFilters} style={{ marginTop: '1rem' }}>
              Effacer les filtres
            </button>
          ) : (
            <button className="btn btn-primary" onClick={openNewModal} style={{ marginTop: '1rem' }}>
              Planifier une intervention
            </button>
          )}
        </div>
      ) : (
        <>
          <table>
            <thead>
              <tr>
                <th style={{ width: '40px', textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    checked={isAllPageSelected}
                    ref={el => {
                      if (el) el.indeterminate = isSomePageSelected && !isAllPageSelected;
                    }}
                    onChange={handleSelectAllPage}
                    title={isAllPageSelected ? 'Désélectionner tous' : 'Sélectionner tous'}
                    style={{ cursor: 'pointer', width: '18px', height: '18px' }}
                  />
                </th>
                {colonnesValides.map(col => (
                  <th key={col} style={{ textAlign: config[col]?.align || 'left' }}>
                    {config[col]?.label || col}
                  </th>
                ))}
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedInterventions.map(intervention => (
                <tr 
                  key={intervention.id}
                  style={{ background: selectedInterventions.has(intervention.id) ? '#e3f2fd' : 'transparent' }}
                >
                  <td style={{ textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      checked={selectedInterventions.has(intervention.id)}
                      onChange={() => handleSelectIntervention(intervention.id)}
                      onClick={(e) => e.stopPropagation()}
                      style={{ cursor: 'pointer', width: '18px', height: '18px' }}
                    />
                  </td>
                  {colonnesValides.map(col => (
                    <td key={col} style={{ textAlign: config[col]?.align || 'left' }}>
                      {renderCell(intervention, col)}
                    </td>
                  ))}
                  <td>
                    <button className="btn btn-secondary" onClick={() => handleEdit(intervention)} style={{ marginRight: '0.5rem', padding: '0.4rem 0.8rem' }}>
                      ✏️
                    </button>
                    <button className="btn btn-danger" onClick={() => askDelete(intervention)} style={{ padding: '0.4rem 0.8rem' }}>
                      🗑️
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination */}
          {itemsPerPage !== 'all' && totalPages > 1 && (
            <div style={{ 
              display: 'flex', 
              justifyContent: 'center', 
              alignItems: 'center', 
              gap: '0.5rem',
              marginTop: '1.5rem',
              paddingTop: '1rem',
              borderTop: '1px solid #eee'
            }}>
              <button 
                onClick={() => setCurrentPage(1)} 
                disabled={currentPage === 1}
                style={{ 
                  padding: '0.5rem 0.75rem', 
                  border: '1px solid #ddd', 
                  borderRadius: '6px', 
                  background: currentPage === 1 ? '#f5f5f5' : 'white', 
                  cursor: currentPage === 1 ? 'not-allowed' : 'pointer' 
                }}
              >
                ⏮
              </button>
              <button 
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} 
                disabled={currentPage === 1}
                style={{ 
                  padding: '0.5rem 0.75rem', 
                  border: '1px solid #ddd', 
                  borderRadius: '6px', 
                  background: currentPage === 1 ? '#f5f5f5' : 'white', 
                  cursor: currentPage === 1 ? 'not-allowed' : 'pointer' 
                }}
              >
                ◀️
              </button>
              
              {getPageNumbers().map((page, idx) => (
                <button 
                  key={idx} 
                  onClick={() => page !== '...' && setCurrentPage(page)} 
                  disabled={page === '...'}
                  style={{ 
                    padding: '0.5rem 0.9rem', 
                    border: currentPage === page ? '2px solid #2c5f2d' : '1px solid #ddd', 
                    borderRadius: '6px', 
                    background: currentPage === page ? '#2c5f2d' : 'white', 
                    color: currentPage === page ? 'white' : (page === '...' ? '#999' : '#333'), 
                    fontWeight: currentPage === page ? 'bold' : 'normal', 
                    cursor: page === '...' ? 'default' : 'pointer', 
                    minWidth: '40px' 
                  }}
                >
                  {page}
                </button>
              ))}
              
              <button 
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} 
                disabled={currentPage === totalPages}
                style={{ 
                  padding: '0.5rem 0.75rem', 
                  border: '1px solid #ddd', 
                  borderRadius: '6px', 
                  background: currentPage === totalPages ? '#f5f5f5' : 'white', 
                  cursor: currentPage === totalPages ? 'not-allowed' : 'pointer' 
                }}
              >
                ▶️
              </button>
              <button 
                onClick={() => setCurrentPage(totalPages)} 
                disabled={currentPage === totalPages}
                style={{ 
                  padding: '0.5rem 0.75rem', 
                  border: '1px solid #ddd', 
                  borderRadius: '6px', 
                  background: currentPage === totalPages ? '#f5f5f5' : 'white', 
                  cursor: currentPage === totalPages ? 'not-allowed' : 'pointer' 
                }}
              >
                ⏭
              </button>
            </div>
          )}
        </>
      )}

      {/* Modal de modification groupée */}
      {showBulkEditModal && (
        <div className="modal-overlay" onClick={() => setShowBulkEditModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h3>✏️ Modifier {selectedInterventions.size} intervention(s)</h3>
              <button className="modal-close" onClick={() => setShowBulkEditModal(false)}>✖</button>
            </div>
            
            <div style={{ padding: '1rem', background: '#fff3e0', borderRadius: '8px', marginBottom: '1rem' }}>
              <p style={{ margin: 0, color: '#e65100' }}>
                <strong>⚠️ Attention :</strong> Seuls les champs remplis seront modifiés. Les champs vides seront ignorés.
              </p>
            </div>

            <div className="form-grid">
              <div className="form-group">
                <label>Statut</label>
                <select name="statut" value={bulkEditData.statut} onChange={handleBulkEditChange}>
                  <option value="">-- Ne pas modifier --</option>
                  <option value="Planifié">📋 Planifié</option>
                  <option value="En cours">🔄 En cours</option>
                  <option value="Terminé">✅ Terminé</option>
                  <option value="Annulé">❌ Annulé</option>
                </select>
              </div>

              <div className="form-group">
                <label>Date de réalisation</label>
                <input 
                  type="date" 
                  name="date_realisee" 
                  value={bulkEditData.date_realisee} 
                  onChange={handleBulkEditChange}
                />
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setShowBulkEditModal(false)}>
                Annuler
              </button>
              <button 
                type="button" 
                className="btn btn-primary" 
                onClick={handleBulkEditSubmit}
                disabled={isProcessing}
              >
                {isProcessing ? 'En cours...' : `Appliquer à ${selectedInterventions.size} intervention(s)`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de création/édition */}
      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '800px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="modal-header">
              <h3>
                {fieldsConfig?.icon || '📋'} {editingIntervention ? 'Modifier l\'intervention' : 'Nouvelle intervention'}
                {selectedTypeName && ` - ${selectedTypeName}`}
              </h3>
              <button className="modal-close" onClick={closeModal}>✕</button>
            </div>
            
            {/* Avertissement doublon */}
            {doublonWarning && (
              <div style={{
                background: '#fff3cd',
                border: '1px solid #ffc107',
                borderRadius: '8px',
                padding: '1rem',
                marginBottom: '1rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem'
              }}>
                <span style={{ fontSize: '1.5rem' }}>⚠</span>
                <div>
                  <strong>Attention - Intervention similaire existante</strong>
                  <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.9rem', color: '#856404' }}>
                    Une intervention "{doublonWarning.type}" est déjà prévue pour l'arbre {doublonWarning.arbre} le {doublonWarning.date}.
                  </p>
                </div>
              </div>
            )}
            
            <form onSubmit={handleSubmit}>
              {/* Section 1: Type et localisation */}
              <h4 style={{ color: '#2c5f2d', marginBottom: '1rem', borderBottom: '2px solid #e0e0e0', paddingBottom: '0.5rem' }}>
                📋 Type et localisation
              </h4>
              <div className="form-grid">
                <div className="form-group">
                  <label>Type d'intervention *</label>
                  <select name="type_intervention_id" value={formData.type_intervention_id} onChange={handleInputChange} required>
                    <option value="">Sélectionner...</option>
                    {typesIntervention.map(type => (
                      <option key={type.id} value={type.id}>
                        {CHAMPS_PAR_TYPE[type.nom]?.icon || '📋'} {type.nom}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Détails spécifiques au type sélectionné */}
              {fieldsConfig && (
                <>
                  <div style={{ 
                    marginTop: '1.5rem', 
                    marginBottom: '1rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderBottom: '2px solid #e0e0e0',
                    paddingBottom: '0.5rem'
                  }}>
                    <h4 style={{ color: '#2c5f2d', margin: 0 }}>
                      {fieldsConfig.icon} Détails {selectedTypeName}
                    </h4>
                    <button
                      type="button"
                      onClick={() => setShowAdvancedFields(!showAdvancedFields)}
                      style={{
                        padding: '0.5rem 1rem',
                        background: showAdvancedFields ? '#2c5f2d' : '#f0f0f0',
                        color: showAdvancedFields ? 'white' : '#333',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '0.9rem'
                      }}
                    >
                      {showAdvancedFields ? '➖ Masquer' : '➕ Afficher les détails'}
                    </button>
                  </div>

                  {showAdvancedFields && (
                    <div style={{ background: '#f9f9f9', padding: '1rem', borderRadius: '8px', marginBottom: '1rem' }}>
                      {/* Sélection rapide pour traitements */}
                      {selectedTypeName === 'Traitement' && produitsPhyto.length > 0 && (
                        <div style={{ marginBottom: '1rem', padding: '0.75rem', background: '#e8f5e9', borderRadius: '4px' }}>
                          <label style={{ fontWeight: 'bold', marginBottom: '0.5rem', display: 'block' }}>
                            📦 Sélection rapide depuis le référentiel
                          </label>
                          <select 
                            onChange={(e) => {
                              const produit = produitsPhyto.find(p => p.id === parseInt(e.target.value));
                              if (produit) handleSelectProduitPhyto(produit);
                            }}
                            style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ddd' }}
                          >
                            <option value="">Choisir un produit...</option>
                            {produitsPhyto.map(p => (
                              <option key={p.id} value={p.id}>
                                {p.nom_commercial} ({p.categorie}) {p.utilisable_bio && '🌿 Bio'}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                      
                      {/* Sélection rapide pour amendements */}
                      {selectedTypeName === 'Amendement' && amendementsRef.length > 0 && (
                        <div style={{ marginBottom: '1rem', padding: '0.75rem', background: '#e8f5e9', borderRadius: '4px' }}>
                          <label style={{ fontWeight: 'bold', marginBottom: '0.5rem', display: 'block' }}>
                            📦 Sélection rapide depuis le référentiel
                          </label>
                          <select 
                            onChange={(e) => {
                              const amendement = amendementsRef.find(a => a.id === parseInt(e.target.value));
                              if (amendement) handleSelectAmendement(amendement);
                            }}
                            style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ddd' }}
                          >
                            <option value="">Choisir un amendement...</option>
                            {amendementsRef.map(a => (
                              <option key={a.id} value={a.id}>
                                {a.nom} ({a.type_amendement}) {a.utilisable_bio && '🌿 Bio'}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {fieldsConfig.sections.map((section, sectionIndex) => (
                        <div key={sectionIndex} style={{ marginBottom: '1rem' }}>
                          <h5 style={{ color: '#555', marginBottom: '0.75rem', fontSize: '0.95rem' }}>
                            {section.titre}
                          </h5>
                          <div className="form-grid">
                            {section.champs.map((champ, champIndex) => (
                              <div key={champIndex} className="form-group">
                                <label>
                                  {champ.label}
                                  {champ.help && (
                                    <span style={{ fontSize: '0.8rem', color: '#888', marginLeft: '0.5rem' }}>
                                      ℹ {champ.help}
                                    </span>
                                  )}
                                </label>
                                {renderField(champ)}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}


              {/* Suite: Localisation */}
              <div className="form-grid">

                <div className="form-group">
                  <label>Parcelle *</label>
                  <select name="parcelle_id" value={formData.parcelle_id} onChange={handleInputChange} required>
                    <option value="">Sélectionner...</option>
                    {parcelles.map(parcelle => (
                      <option key={parcelle.id} value={parcelle.id}>{parcelle.nom}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label>
                    Arbres concernés 
                    <span style={{ fontSize: '0.85rem', color: '#666', marginLeft: '0.5rem' }}>
                      (Ctrl+clic pour sélection multiple)
                    </span>
                  </label>
                  <input 
                    type="text" 
                    placeholder="🔍 Rechercher un arbre (numéro, espèce, variété, état)..." 
                    value={arbreSearchText}
                    onChange={(e) => setArbreSearchText(e.target.value)}
                    style={{ 
                      marginBottom: '0.5rem', 
                      padding: '0.5rem', 
                      border: '1px solid #ddd', 
                      borderRadius: '4px',
                      width: '100%'
                    }}
                  />
                  <select multiple value={formData.arbre_ids} onChange={handleArbresChange} style={{ height: '100px' }}>
                    {arbresFiltered.map(arbre => (
                      <option key={arbre.id} value={arbre.id}>
                        {arbre.numero} - {arbre.espece} ({arbre.etat})
                      </option>
                    ))}
                  </select>
                  {formData.parcelle_id && arbresFiltered.length > 0 && (
                    <small style={{ color: '#27ae60' }}>
                      {arbresFiltered.length} arbre(s) disponible(s)
                      {formData.arbre_ids.length > 0 && ` - ${formData.arbre_ids.length} sélectionné(s)`}
                    </small>
                  )}
                </div>
              </div>

              {/* Section 2: Planification */}
              <h4 style={{ color: '#2c5f2d', marginTop: '1.5rem', marginBottom: '1rem', borderBottom: '2px solid #e0e0e0', paddingBottom: '0.5rem' }}>
                📅 Planification
              </h4>
              <div className="form-grid">
                <div className="form-group">
                  <label>Date prévue *</label>
                  <input type="date" name="date_prevue" value={formData.date_prevue} onChange={handleInputChange} required />
                </div>

                <div className="form-group">
                  <label>Date de réalisation</label>
                  <input type="date" name="date_realisee" value={formData.date_realisee} onChange={handleInputChange} />
                </div>

                <div className="form-group">
                  <label>Statut *</label>
                  <select name="statut" value={formData.statut} onChange={handleInputChange} required>
                    <option value="Planifié">📋 Planifié</option>
                    <option value="En cours">🔄 En cours</option>
                    <option value="Terminé">✅ Terminé</option>
                    <option value="Annulé">❌ Annulé</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Durée (minutes)</label>
                  <input type="number" name="duree_minutes" value={formData.duree_minutes} onChange={handleInputChange} placeholder="Ex: 120" />
                </div>
              </div>

              {/* Section 3: Équipe et coûts */}
              <h4 style={{ color: '#2c5f2d', marginTop: '1.5rem', marginBottom: '1rem', borderBottom: '2px solid #e0e0e0', paddingBottom: '0.5rem' }}>
                👷 Équipe et coûts
              </h4>
              <div className="form-grid">
                <div className="form-group">
                  <label>Caveur / Personnel</label>
                  {caveurs.length > 0 ? (
                    <select name="caveur_id" value={formData.caveur_id} onChange={handleInputChange}>
                      <option value="">Sélectionner un caveur...</option>
                      {caveurs.map(caveur => (
                        <option key={caveur.id} value={caveur.id}>
                          {caveur.nom} {caveur.specialite ? `(${caveur.specialite})` : ''}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input 
                      type="text" 
                      name="personnel" 
                      value={formData.personnel} 
                      onChange={handleInputChange} 
                      placeholder="Nom(s) des personnes" 
                    />
                  )}
                </div>

                <div className="form-group">
                  <label>Coût (€)</label>
                  <input type="number" name="cout" value={formData.cout} onChange={handleInputChange} step="0.01" placeholder="Ex: 150.00" />
                </div>

                <div className="form-group">
                  <label>Conditions météo</label>
                  <select name="meteo" value={formData.meteo} onChange={handleInputChange}>
                    <option value="">Sélectionner...</option>
                    <option value="Ensoleillé">☀ Ensoleillé</option>
                    <option value="Nuageux">⛅ Nuageux</option>
                    <option value="Pluvieux">🌧️ Pluvieux</option>
                    <option value="Orageux">⛈ Orageux</option>
                    <option value="Neigeux">❄ Neigeux</option>
                    <option value="Venteux">💨 Venteux</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Description</label>
                <textarea name="description" value={formData.description} onChange={handleInputChange} placeholder="Détails de l'intervention..." rows="2" />
              </div>

              <div className="form-group">
                <label>Notes</label>
                <textarea name="notes" value={formData.notes} onChange={handleInputChange} placeholder="Remarques, observations..." rows="2" />
              </div>

              <div className="modal-footer" style={{ display: 'flex', justifyContent: editingIntervention ? 'space-between' : 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
                {editingIntervention && (
                  <button 
                    type="button" 
                    className="btn btn-danger" 
                    onClick={() => {
                      closeModal();
                      askDelete(editingIntervention);
                    }}
                    disabled={isProcessing}
                    style={{ marginRight: 'auto' }}
                  >
                    🗑️ Supprimer
                  </button>
                )}
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button type="button" className="btn btn-secondary" onClick={closeModal}>Annuler</button>
                  <button type="submit" className="btn btn-primary" disabled={isProcessing}>
                    {isProcessing ? 'En cours...' : (editingIntervention ? 'Mettre à jour' : 'Planifier')}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      <CSVImportModal
        show={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImport={handleImportCSV}
        validateFunction={validateInterventionsCSV}
        type="interventions"
        title="Importer des interventions depuis CSV"
        dependencies={{ parcelles, typesIntervention, arbres }}
      />
    </div>
  );
}

export default Interventions;
