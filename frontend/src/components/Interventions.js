import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { exportInterventionsPDF } from '../utils/pdfExport';
import { validateInterventionsCSV } from '../utils/csvImport';
import CSVImportModal from './CSVImportModal';
import useColumnSettings, { COLONNES_CONFIG } from '../hooks/useColumnSettings';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

// Options de pagination
const PAGINATION_OPTIONS = [
  { value: 10, label: '10' },
  { value: 20, label: '20' },
  { value: 30, label: '30' },
  { value: 50, label: '50' },
  { value: 'all', label: 'Tous' }
];

// ========================================
// CONFIGURATION DES CHAMPS PAR TYPE D'INTERVENTION
// ========================================

const CHAMPS_PAR_TYPE = {
  'Irrigation': {
    icon: '💧',
    sections: [
      {
        titre: "Paramètres d'irrigation",
        champs: [
          { name: 'volumeEauM3', label: 'Volume total (m³)', type: 'number', step: 0.1, placeholder: 'Ex: 5.5' },
          { name: 'volumeEauParArbreL', label: 'Volume par arbre (L)', type: 'number', step: 0.1, placeholder: 'Ex: 50' },
          { name: 'methodeIrrigation', label: 'Méthode', type: 'select', options: ['', 'Goutte-à-goutte', 'Aspersion', 'Micro-aspersion', 'Gravitaire', 'Citerne', 'Tuyau manuel'] },
          { name: 'sourceEau', label: 'Source d\'eau', type: 'select', options: ['', 'Réseau', 'Puits', 'Forage', 'Récupération eau de pluie', 'Citerne', 'Cours d\'eau', 'Bassin'] },
          { name: 'debitLh', label: 'Débit (L/h)', type: 'number', step: 0.1, placeholder: 'Ex: 4' },
          { name: 'pressionBar', label: 'Pression (bar)', type: 'number', step: 0.1, placeholder: 'Ex: 2.5' },
          { name: 'frequenceIrrigation', label: 'Fréquence', type: 'select', options: ['', 'Ponctuel', 'Quotidien', 'Tous les 2 jours', 'Hebdomadaire', 'Bi-hebdomadaire', 'Mensuel'] }
        ]
      },
      {
        titre: 'Mesures du sol',
        champs: [
          { name: 'humiditeSolAvant', label: 'Humidité sol avant (%)', type: 'number', step: 0.1, placeholder: 'Ex: 25' },
          { name: 'humiditeSolApres', label: 'Humidité sol après (%)', type: 'number', step: 0.1, placeholder: 'Ex: 45' }
        ]
      }
    ]
  },
  'Traitement': {
    icon: '🧪',
    sections: [
      {
        titre: 'Produit utilisé',
        champs: [
          { name: 'categorieTraitement', label: 'Catégorie', type: 'select', options: ['', 'Fongicide', 'Insecticide', 'Herbicide', 'Acaricide', 'Répulsif', 'Stimulant', 'Autre'] },
          { name: 'nomCommercial', label: 'Nom commercial', type: 'text', placeholder: 'Ex: Bouillie bordelaise' },
          { name: 'matiereActive', label: 'Matières actives', type: 'text', placeholder: 'Ex: Sulfate de cuivre' },
          { name: 'numeroAmm', label: 'N° AMM', type: 'text', placeholder: 'Ex: 9800123' },
          { name: 'fabricant', label: 'Fabricant', type: 'text', placeholder: 'Ex: BASF' }
        ]
      },
      {
        titre: 'Dosage et application',
        champs: [
          { name: 'doseProduitHa', label: 'Dose/ha (L ou kg)', type: 'number', step: 0.01, placeholder: 'Ex: 2.5' },
          { name: 'doseProduitArbre', label: 'Dose/arbre (mL ou g)', type: 'number', step: 0.1, placeholder: 'Ex: 50' },
          { name: 'concentration', label: 'Concentration', type: 'text', placeholder: 'Ex: 2% ou 50g/L' },
          { name: 'volumeBouillieL', label: 'Volume bouillie (L)', type: 'number', step: 0.1, placeholder: 'Ex: 100' },
          { name: 'surfaceTraiteeHa', label: 'Surface traitée (ha)', type: 'number', step: 0.01, placeholder: 'Ex: 0.5' },
          { name: 'methodeApplication', label: 'Méthode d\'application', type: 'select', options: ['', 'Pulvérisateur dorsal', 'Pulvérisateur tracté', 'Atomiseur', 'Drone', 'Pinceau', 'Injection tronc', 'Arrosage'] }
        ]
      },
      {
        titre: 'Cible et réglementation',
        champs: [
          { name: 'cibleTraitement', label: 'Cible / Ravageur', type: 'text', placeholder: 'Ex: Mouche de la truffe, Pucerons' },
          { name: 'delaiAvantRecolteJours', label: 'DAR (jours)', type: 'number', placeholder: 'Ex: 21', help: 'Délai Avant Récolte réglementaire' },
          { name: 'zoneNonTraiteeM', label: 'ZNT (mètres)', type: 'number', step: 0.1, placeholder: 'Ex: 5' },
          { name: 'equipementProtection', label: 'EPI utilisés', type: 'text', placeholder: 'Ex: Gants, masque, combinaison' },
          { name: 'conditionsApplication', label: 'Conditions d\'application', type: 'textarea', placeholder: 'Température, vent, hygrométrie...' }
        ]
      }
    ]
  },
  'Amendement': {
    icon: '🌱',
    sections: [
      {
        titre: 'Produit d\'amendement',
        champs: [
          { name: 'typeAmendement', label: 'Type d\'amendement', type: 'select', options: ['', 'Calcaire broyé', 'Dolomie', 'Chaux vive', 'Chaux éteinte', 'Lithothamne', 'Compost', 'Fumier composté', 'BRF', 'Cendre de bois', 'Engrais vert', 'Autre'] },
          { name: 'nomProduitAmendement', label: 'Nom du produit', type: 'text', placeholder: 'Ex: Calcaire broyé 0-4' },
          { name: 'origineProduit', label: 'Fournisseur / Origine', type: 'text', placeholder: 'Ex: Carrière locale' },
          { name: 'numeroLot', label: 'N° de lot', type: 'text', placeholder: 'Pour traçabilité' },
          { name: 'certificationBio', label: 'Utilisable en bio', type: 'checkbox' }
        ]
      },
      {
        titre: 'Composition',
        champs: [
          { name: 'compositionNpk', label: 'NPK', type: 'text', placeholder: 'Ex: 10-5-15' },
          { name: 'compositionCao', label: 'CaO (%)', type: 'number', step: 0.1, placeholder: 'Ex: 50' },
          { name: 'compositionMgo', label: 'MgO (%)', type: 'number', step: 0.1, placeholder: 'Ex: 5' },
          { name: 'compositionAutres', label: 'Autres éléments', type: 'textarea', placeholder: 'Oligoéléments, matière organique...' }
        ]
      },
      {
        titre: 'Dosage et application',
        champs: [
          { name: 'doseKgHa', label: 'Dose (kg/ha)', type: 'number', step: 1, placeholder: 'Ex: 1500' },
          { name: 'doseKgArbre', label: 'Dose (kg/arbre)', type: 'number', step: 0.1, placeholder: 'Ex: 5' },
          { name: 'quantiteTotaleKg', label: 'Quantité totale (kg)', type: 'number', step: 1, placeholder: 'Ex: 500' },
          { name: 'methodeEpandage', label: 'Méthode d\'épandage', type: 'select', options: ['', 'Manuel', 'Épandeur centrifuge', 'Épandeur hérisson', 'Enfouissement localisé'] },
          { name: 'incorporation', label: 'Incorporé au sol', type: 'checkbox' },
          { name: 'profondeurIncorporationCm', label: 'Profondeur incorporation (cm)', type: 'number', placeholder: 'Ex: 10' }
        ]
      },
      {
        titre: 'Mesures pH',
        champs: [
          { name: 'phSolAvant', label: 'pH sol avant', type: 'number', step: 0.1, min: 0, max: 14, placeholder: 'Ex: 7.2' },
          { name: 'phSolApres', label: 'pH sol après', type: 'number', step: 0.1, min: 0, max: 14, placeholder: 'Mesure différée' }
        ]
      }
    ]
  },
  'Taille': {
    icon: '✂️',
    sections: [
      {
        titre: 'Type de taille',
        champs: [
          { name: 'typeTaille', label: 'Type de taille', type: 'select', options: ['', 'Formation', 'Entretien', 'Sanitaire', 'Éclaircie', 'Rabattage', 'Taille en vert'] },
          { name: 'intensiteTaille', label: 'Intensité', type: 'select', options: ['', 'Légère (<20%)', 'Modérée (20-40%)', 'Forte (>40%)'] }
        ]
      },
      {
        titre: 'Mesures',
        champs: [
          { name: 'hauteurAvantCm', label: 'Hauteur avant (cm)', type: 'number', placeholder: 'Ex: 350' },
          { name: 'hauteurApresCm', label: 'Hauteur après (cm)', type: 'number', placeholder: 'Ex: 280' },
          { name: 'diametreCouronneAvantM', label: 'Ø couronne avant (m)', type: 'number', step: 0.1, placeholder: 'Ex: 4.5' },
          { name: 'diametreCouronneApresM', label: 'Ø couronne après (m)', type: 'number', step: 0.1, placeholder: 'Ex: 3.5' },
          { name: 'branchesSupprimees', label: 'Branches supprimées', type: 'number', placeholder: 'Nombre' },
          { name: 'diametreMaxCoupeCm', label: 'Plus gros Ø coupé (cm)', type: 'number', placeholder: 'Ex: 8' }
        ]
      },
      {
        titre: 'Résidus et outils',
        champs: [
          { name: 'volumeResidusM3', label: 'Volume résidus (m³)', type: 'number', step: 0.1, placeholder: 'Ex: 2.5' },
          { name: 'destinationResidus', label: 'Destination résidus', type: 'select', options: ['', 'Broyage sur place', 'BRF', 'Brûlage', 'Export', 'Compostage'] },
          { name: 'outilsTaille', label: 'Outils utilisés', type: 'text', placeholder: 'Ex: Sécateur, tronçonneuse' },
          { name: 'desinfectionOutils', label: 'Outils désinfectés', type: 'checkbox' },
          { name: 'produitDesinfection', label: 'Produit désinfection', type: 'text', placeholder: 'Ex: Alcool, eau de javel' }
        ]
      }
    ]
  },
  'Travail du sol': {
    icon: '🚜',
    sections: [
      {
        titre: 'Type de travail',
        champs: [
          { name: 'typeTravailSol', label: 'Type de travail', type: 'select', options: ['', 'Griffage', 'Binage', 'Décompactage', 'Désherbage mécanique', 'Scarification', 'Aération', 'Buttage'] },
          { name: 'outilTravailSol', label: 'Outil utilisé', type: 'select', options: ['', 'Griffe manuelle', 'Binette', 'Motobineuse', 'Décompacteur', 'Cultivateur', 'Herse rotative', 'Disque'] },
          { name: 'zoneTravaillee', label: 'Zone travaillée', type: 'select', options: ['', 'Inter-rang', 'Sous couronne', 'Brûlé uniquement', 'Rang complet', 'Parcelle entière'] }
        ]
      },
      {
        titre: 'Paramètres',
        champs: [
          { name: 'profondeurTravailCm', label: 'Profondeur (cm)', type: 'number', placeholder: 'Ex: 10' },
          { name: 'largeurTravailM', label: 'Largeur (m)', type: 'number', step: 0.1, placeholder: 'Ex: 1.5' },
          { name: 'distanceTroncM', label: 'Distance min du tronc (m)', type: 'number', step: 0.1, placeholder: 'Ex: 0.5' }
        ]
      },
      {
        titre: 'État du sol',
        champs: [
          { name: 'etatSolAvant', label: 'État du sol', type: 'select', options: ['', 'Sec', 'Frais', 'Humide', 'Détrempé'] },
          { name: 'enherbementAvant', label: 'Enherbement avant', type: 'select', options: ['', 'Nul', 'Faible', 'Moyen', 'Fort'] },
          { name: 'enherbementApres', label: 'Enherbement après', type: 'select', options: ['', 'Nul', 'Faible', 'Moyen', 'Fort'] },
          { name: 'presenceCailloux', label: 'Sol caillouteux', type: 'checkbox' }
        ]
      }
    ]
  },
  'Observation': {
    icon: '🔍',
    sections: [
      {
        titre: 'Type d\'observation',
        champs: [
          { name: 'typeObservation', label: 'Type', type: 'select', options: ['', 'Brûlé', 'Mycorhization', 'Santé arbre', 'Ravageurs', 'Maladie', 'Croissance', 'Général'] },
          { name: 'niveauUrgence', label: 'Niveau d\'urgence', type: 'select', options: ['', 'Normal', 'À surveiller', 'Intervention rapide', 'Urgent'] }
        ]
      },
      {
        titre: 'État du brûlé',
        champs: [
          { name: 'etatBrule', label: 'État du brûlé', type: 'select', options: ['', 'Absent', 'Naissant', 'Bien marqué', 'Étendu', 'En régression', 'Disparu'] },
          { name: 'diametreBruleM', label: 'Diamètre brûlé (m)', type: 'number', step: 0.1, placeholder: 'Ex: 3.5' },
          { name: 'evolutionBrule', label: 'Évolution', type: 'select', options: ['', 'Extension', 'Stable', 'Régression'] },
          { name: 'presenceAscomes', label: 'Présence ascocarpes', type: 'checkbox' },
          { name: 'nombreAscomes', label: 'Nombre observé', type: 'number', placeholder: 'Si visible' }
        ]
      },
      {
        titre: 'Mycorhization et santé',
        champs: [
          { name: 'indiceMycorhization', label: 'Indice mycorhization', type: 'select', options: ['', 'Faible (0-30%)', 'Moyen (30-60%)', 'Fort (60-90%)', 'Excellent (>90%)'] },
          { name: 'symptomesObserves', label: 'Symptômes observés', type: 'textarea', placeholder: 'Décrivez les symptômes...' },
          { name: 'ravageursIdentifies', label: 'Ravageurs identifiés', type: 'text', placeholder: 'Ex: Mouche de la truffe' },
          { name: 'degatsConstates', label: 'Dégâts constatés', type: 'textarea', placeholder: 'Description des dégâts' }
        ]
      },
      {
        titre: 'Préconisations',
        champs: [
          { name: 'preconisations', label: 'Préconisations', type: 'textarea', placeholder: 'Actions recommandées...' }
        ]
      }
    ]
  },
  'Paillage': {
    icon: '🍂',
    sections: [
      {
        titre: 'Paillage',
        champs: [
          { name: 'typePaillage', label: 'Type de paillage', type: 'select', options: ['', 'BRF', 'Paille', 'Copeaux de bois', 'Écorces', 'Feuilles mortes', 'Miscanthus', 'Autre'] },
          { name: 'epaisseurCm', label: 'Épaisseur (cm)', type: 'number', placeholder: 'Ex: 10' },
          { name: 'surfacePailleeM2', label: 'Surface paillée (m²)', type: 'number', step: 0.1, placeholder: 'Ex: 25' },
          { name: 'quantitePaillageM3', label: 'Quantité (m³)', type: 'number', step: 0.1, placeholder: 'Ex: 2.5' },
          { name: 'originePaillage', label: 'Origine / Fournisseur', type: 'text', placeholder: 'Ex: Production propre' }
        ]
      }
    ]
  },
  'Plantation': {
    icon: '🌳',
    sections: [
      {
        titre: 'Plant',
        champs: [
          { name: 'especePlantee', label: 'Espèce', type: 'select', options: ['', 'Chêne vert', 'Chêne pubescent', 'Chêne pédonculé', 'Noisetier', 'Charme', 'Tilleul', 'Pin', 'Autre'] },
          { name: 'varietePlant', label: 'Variété / Clone', type: 'text', placeholder: 'Ex: Clone INRAE' },
          { name: 'typeMycorhization', label: 'Mycorhization', type: 'select', options: ['', 'Tuber melanosporum', 'Tuber aestivum', 'Tuber uncinatum', 'Tuber brumale', 'Autre'] },
          { name: 'fournisseurPlant', label: 'Pépiniériste', type: 'text', placeholder: 'Ex: Robin Pépinières' },
          { name: 'certificationPlant', label: 'Certification', type: 'text', placeholder: 'Ex: INRAE certifié' },
          { name: 'numeroLotPlant', label: 'N° de lot', type: 'text', placeholder: 'Pour traçabilité' }
        ]
      },
      {
        titre: 'Caractéristiques du plant',
        champs: [
          { name: 'taillePlantCm', label: 'Hauteur plant (cm)', type: 'number', placeholder: 'Ex: 50' },
          { name: 'diametreColletMm', label: 'Ø collet (mm)', type: 'number', placeholder: 'Ex: 8' }
        ]
      },
      {
        titre: 'Plantation',
        champs: [
          { name: 'dimensionsTrouCm', label: 'Dimensions trou (cm)', type: 'text', placeholder: 'Ex: 50x50x50' },
          { name: 'amendementPlantation', label: 'Amendement à la plantation', type: 'textarea', placeholder: 'Ex: 1kg calcaire + terreau mycorhizé' },
          { name: 'arrosagePlantationL', label: 'Arrosage plantation (L)', type: 'number', placeholder: 'Ex: 20' },
          { name: 'tuteur', label: 'Tuteur installé', type: 'checkbox' },
          { name: 'protectionGibier', label: 'Protection gibier', type: 'checkbox' },
          { name: 'typeProtection', label: 'Type de protection', type: 'text', placeholder: 'Ex: Filet, manchon' }
        ]
      }
    ]
  },
  'Analyse de sol': {
    icon: '🧪',
    sections: [
      {
        titre: 'Prélèvement',
        champs: [
          { name: 'profondeurPrelevementCm', label: 'Profondeur (cm)', type: 'number', placeholder: 'Ex: 30' },
          { name: 'nombreEchantillons', label: 'Nombre d\'échantillons', type: 'number', placeholder: 'Ex: 5' },
          { name: 'laboratoire', label: 'Laboratoire', type: 'text', placeholder: 'Ex: INRAE, Aurea' },
          { name: 'referenceAnalyse', label: 'Référence analyse', type: 'text', placeholder: 'N° de dossier' }
        ]
      },
      {
        titre: 'Résultats',
        champs: [
          { name: 'resultatsPh', label: 'pH', type: 'number', step: 0.1, placeholder: 'Ex: 7.8' },
          { name: 'resultatsCalcaireActif', label: 'Calcaire actif (%)', type: 'number', step: 0.1, placeholder: 'Ex: 12' },
          { name: 'resultatsMatiereOrganique', label: 'Matière organique (%)', type: 'number', step: 0.1, placeholder: 'Ex: 2.5' },
          { name: 'resultatsAzote', label: 'Azote total (‰)', type: 'number', step: 0.01, placeholder: 'Ex: 1.2' },
          { name: 'resultatsPhosphore', label: 'P2O5 (mg/kg)', type: 'number', placeholder: 'Ex: 85' },
          { name: 'resultatsPotassium', label: 'K2O (mg/kg)', type: 'number', placeholder: 'Ex: 180' },
          { name: 'resultatsCec', label: 'CEC (meq/100g)', type: 'number', step: 0.1, placeholder: 'Ex: 15' }
        ]
      },
      {
        titre: 'Interprétation',
        champs: [
          { name: 'interpretation', label: 'Interprétation et recommandations', type: 'textarea', placeholder: 'Conclusions de l\'analyse...' }
        ]
      }
    ]
  },
  'Piégeage': {
    icon: '🪤',
    sections: [
      {
        titre: 'Piégeage',
        champs: [
          { name: 'typePiege', label: 'Type de piège', type: 'select', options: ['', 'Chromotopique jaune', 'Chromotopique bleu', 'Phéromone', 'Alimentaire', 'Mécanique rongeurs', 'Autre'] },
          { name: 'ciblePiegeage', label: 'Cible', type: 'text', placeholder: 'Ex: Mouche de la truffe' },
          { name: 'nombrePieges', label: 'Nombre de pièges', type: 'number', placeholder: 'Ex: 10' },
          { name: 'densitePiegesHa', label: 'Densité (pièges/ha)', type: 'number', placeholder: 'Ex: 20' }
        ]
      },
      {
        titre: 'Relevé',
        champs: [
          { name: 'dateReleve', label: 'Date du relevé', type: 'date' },
          { name: 'captures', label: 'Nombre de captures', type: 'number', placeholder: 'Ex: 5' },
          { name: 'actionSuite', label: 'Action décidée', type: 'textarea', placeholder: 'Traitement prévu, surveillance...' }
        ]
      }
    ]
  },
  'Inoculation': {
    icon: '💉',
    sections: [
      {
        titre: 'Inoculation',
        champs: [
          { name: 'typeInoculum', label: 'Type d\'inoculum', type: 'select', options: ['', 'Spores', 'Mycélium', 'Terre mycorhizée', 'Solution sporale', 'Gel mycorhizien'] },
          { name: 'especeTruffeInoculation', label: 'Espèce de truffe', type: 'select', options: ['', 'Tuber melanosporum', 'Tuber aestivum', 'Tuber uncinatum', 'Tuber brumale', 'Tuber magnatum'] },
          { name: 'quantiteInoculum', label: 'Quantité', type: 'text', placeholder: 'Ex: 50g de spores' },
          { name: 'methodeInoculation', label: 'Méthode', type: 'select', options: ['', 'Injection racinaire', 'Arrosage solution sporale', 'Incorporation sol', 'Trempage racines'] },
          { name: 'fournisseurInoculum', label: 'Fournisseur', type: 'text', placeholder: 'Ex: Robin, Agri-Truffe' }
        ]
      }
    ]
  }
};
// ========================================
// COMPOSANT PRINCIPAL
// ========================================

function Interventions() {
  // États de base
  const [interventions, setInterventions] = useState([]);
  const [parcelles, setParcelles] = useState([]);
  const [arbres, setArbres] = useState([]);
  const [typesIntervention, setTypesIntervention] = useState([]);
  const [caveurs, setCaveurs] = useState([]);
  const [produitsPhyto, setProduitsPhyto] = useState([]);
  const [amendementsRef, setAmendementsRef] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [showModal, setShowModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [editingIntervention, setEditingIntervention] = useState(null);

  // Filtres
  const [filterStatut, setFilterStatut] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [filterParcelle, setFilterParcelle] = useState('all');
  const [filterPeriode, setFilterPeriode] = useState('all');
  const [filterDateDebut, setFilterDateDebut] = useState('');
  const [filterDateFin, setFilterDateFin] = useState('');
  const [searchText, setSearchText] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // 🆕 TRI
  const [sortField, setSortField] = useState('date_prevue');
  const [sortDirection, setSortDirection] = useState('desc');

  // UI
  const [showGraphique, setShowGraphique] = useState(true);
  const [message, setMessage] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Pagination
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);

  // Sélection multiple
  const [selectedInterventions, setSelectedInterventions] = useState(new Set());
  const [showBulkEditModal, setShowBulkEditModal] = useState(false);
  const [bulkEditData, setBulkEditData] = useState({ statut: '', date_realisee: '' });

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

  // Formulaire principal
  const [formData, setFormData] = useState({
    type_intervention_id: '',
    parcelle_id: '',
    arbre_id: [],          // ← comme ça
    date_prevue: new Date().toISOString().split('T')[0],
    date_realisee: '',
    statut: 'Planifié',
    description: '',
    notes: '',
    cout: '',
    dureeMinutes: '',
    meteo: '',
    personnel: '',
    caveurId: ''
  });

  // Détails spécifiques (nouvelle structure)
  const [detailsData, setDetailsData] = useState({});

  // Hook pour les paramètres de colonnes
  const { colonnesAffichees, colonnesExport, loading: loadingSettings } = useColumnSettings('interventions');

  // Charger les données au montage
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
        axios.get(`${API_URL}/amendements-ref`).catch(() => ({ data: [] }))
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
      console.error('❌ Erreur lors du chargement:', error);
      setLoading(false);
    }
  };

  // ========================================
  // 🆕 FONCTION DE TRI
  // ========================================
  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // ========================================
  // FILTRAGE DES INTERVENTIONS
  // ========================================
  const filteredInterventions = useMemo(() => {
    return interventions.filter(intervention => {
      // Filtre par statut
      if (filterStatut !== 'all' && intervention.statut !== filterStatut) return false;

      // Filtre par type
      if (filterType !== 'all' && intervention.type_intervention_id !== parseInt(filterType)) return false;

      // Filtre par parcelle
      if (filterParcelle !== 'all' && intervention.parcelle_id !== parseInt(filterParcelle)) return false;

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
          if (dateIntervention < weekStart || dateIntervention >= weekEnd) return false;
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
        const parcelleNom = intervention.parcelleNom || '';
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

  // 🆕 TRI DES INTERVENTIONS
  const sortedInterventions = useMemo(() => {
    const sorted = [...filteredInterventions];
    
    sorted.sort((a, b) => {
      let aVal, bVal;

      switch (sortField) {
        case 'typenom':
          aVal = getTypeName(a.type_intervention_id).toLowerCase();
          bVal = getTypeName(b.type_intervention_id).toLowerCase();
          break;
        case 'parcelleNom':
          aVal = (a.parcelleNom || a.parcelle_nom || '').toLowerCase();
          bVal = (b.parcelleNom || b.parcelle_nom || '').toLowerCase();
          break;
        case 'date_prevue':
          aVal = new Date(a.date_prevue || a.date_prevue || 0);
          bVal = new Date(b.date_prevue || b.date_prevue || 0);
          break;
        case 'date_realisee':
          aVal = new Date(a.date_realisee || a.date_realisee || 0);
          bVal = new Date(b.date_realisee || b.date_realisee || 0);
          break;
        case 'statut':
          aVal = (a.statut || '').toLowerCase();
          bVal = (b.statut || '').toLowerCase();
          break;
        case 'cout':
          aVal = parseFloat(a.cout) || 0;
          bVal = parseFloat(b.cout) || 0;
          break;
        default:
          aVal = a[sortField] || '';
          bVal = b[sortField] || '';
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return sorted;
  }, [filteredInterventions, sortField, sortDirection]);

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

  // ========================================
  // PAGINATION
  // ========================================
  const totalInterventions = sortedInterventions.length;
  const totalPages = itemsPerPage === 'all' ? 1 : Math.ceil(totalInterventions / itemsPerPage);
  const paginatedInterventions = itemsPerPage === 'all'
    ? sortedInterventions
    : sortedInterventions.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

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

  // ========================================
  // SÉLECTION MULTIPLE - FONCTIONS
  // ========================================
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

  const handleSelectAllFiltered = () => {
    const allIds = sortedInterventions.map(i => i.id);
    setSelectedInterventions(new Set(allIds));
  };

  const handleDeselectAll = () => {
    setSelectedInterventions(new Set());
  };

  const openBulkEditModal = () => {
    setBulkEditData({ statut: '', date_realisee: '' });
    setShowBulkEditModal(true);
  };

  const handleBulkEditChange = (e) => {
    const { name, value } = e.target;
    setBulkEditData(prev => ({
      ...prev,
      [name]: value
    }));
  };

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
            console.error(`❌ Erreur pour l'intervention ${interventionId}:`, error);
            errorCount++;
          }
        }
      }

      if (errorCount === 0) {
        showMessage(`${successCount} interventions modifiées avec succès ! ✅`, 'success');
      } else {
        showMessage(`${successCount} modifiées, ${errorCount} erreurs`, 'error');
      }

      loadData();
      setShowBulkEditModal(false);
      setSelectedInterventions(new Set());
    } catch (error) {
      console.error('❌ Erreur lors de la modification groupée:', error);
      showMessage('Erreur lors de la modification groupée', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const askBulkDelete = () => {
    setConfirmModal({
      type: 'bulk-delete',
      item: null,
      title: 'Suppression groupée',
      message: `Voulez-vous supprimer ${selectedInterventions.size} interventions ? Cette action est irréversible.`,
      confirmText: 'Oui, supprimer',
      confirmColor: '#f44336'
    });
  };

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
          console.error(`❌ Erreur pour l'intervention ${interventionId}:`, error);
          errorCount++;
        }
      }

      if (errorCount === 0) {
        showMessage(`${successCount} interventions supprimées ! ✅`, 'success');
      } else {
        showMessage(`${successCount} supprimées, ${errorCount} erreurs`, 'error');
      }

      loadData();
      setSelectedInterventions(new Set());
    } catch (error) {
      console.error('❌ Erreur lors de la suppression groupée:', error);
      showMessage('Erreur lors de la suppression groupée', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

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

  // ========================================
  // STATISTIQUES
  // ========================================
  const stats = useMemo(() => {
    return {
      total: interventions.length,
      planifiees: interventions.filter(i => i.statut === 'Planifié').length,
      enCours: interventions.filter(i => i.statut === 'En cours').length,
      terminees: interventions.filter(i => i.statut === 'Terminé').length,
      annulees: interventions.filter(i => i.statut === 'Annulé').length,
      coutTotal: interventions.reduce((sum, i) => sum + (parseFloat(i.cout) || 0), 0),
      dureeTotale: interventions.reduce((sum, i) => sum + (parseInt(i.dureeMinutes) || 0), 0)
    };
  }, [interventions]);

  // ========================================
  // GRAPHIQUE D'ACTIVITÉ
  // ========================================
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
        mois,
        annee,
        total: interventionsMois.length,
        terminees: interventionsMois.filter(i => i.statut === 'Terminé').length,
        enCours: interventionsMois.filter(i => i.statut === 'En cours').length,
        planifiees: interventionsMois.filter(i => i.statut === 'Planifié').length
      });
    }

    return data;
  }, [interventions]);

  const maxInterventions = Math.max(...graphiqueData.map(d => d.total), 1);
// ========================================
// 🔧 CORRECTION BUG: FILTRER LES ARBRES
// ========================================
const arbresFiltered = useMemo(() => {
  return arbres.filter(arbre => {
    // 🔧 CORRECTION: Filtre par parcelle
    if (formData.parcelle_id && formData.parcelle_id !== '') {
      // Récupérer l'ID de parcelle de l'arbre (compatible snake_case et camelCase)
      const arbreparcelle_id = arbre.parcelle_id || arbre.parcelle_id;
      
      const parcelle_id_Num = parseInt(formData.parcelle_id);
      const arbreparcelle_id_Num = parseInt(arbreparcelle_id);
      
      // Si les conversions échouent (NaN), on n'affiche pas l'arbre
      if (isNaN(parcelle_id_Num) || isNaN(arbreparcelle_id_Num)) {
        return false;
      }
      
      // Comparaison des IDs numériques
      if (arbreparcelle_id_Num !== parcelle_id_Num) {
        return false;
      }
    }
    // Si parcelle_id  est vide → on affiche TOUS les arbres (cas "Toutes les parcelles")

    // Filtre par texte de recherche
    if (arbreSearchText) {
      const search = arbreSearchText.toLowerCase();
      const matchNumero = arbre.numero?.toLowerCase().includes(search);
      const matchEspece = arbre.espece?.toLowerCase().includes(search);
      const matchVariete = arbre.varieteTruffe?.toLowerCase().includes(search);
      const matchEtat = arbre.etat?.toLowerCase().includes(search);

      if (!matchNumero && !matchEspece && !matchVariete && !matchEtat) {
        return false;
      }
    }

    return true;
  });
}, [arbres, formData.parcelle_id, arbreSearchText]);


  // ========================================
  // CONFIGURATION DES COLONNES
  // ========================================
  const config = COLONNES_CONFIG.interventions;
  const colonnesValides = colonnesAffichees.filter(col => config[col]);

  // ========================================
  // OBTENIR LE NOM DU TYPE
  // ========================================
  const getTypeName = (typeId) => {
    const type = typesIntervention.find(t => t.id === typeId);
    return type ? type.nom : '-';
  };

  // Obtenir l'icône du type
  const getTypeIcon = (typeName) => {
    return CHAMPS_PAR_TYPE[typeName]?.icon || '📋';
  };
   // ========================================
  // RENDU D'UNE CELLULE DU TABLEAU
  // ========================================
  const renderCell = (intervention, col) => {
    if (col === 'typenom') {
      const typeName = intervention.typenom || getTypeName(intervention.type_intervention_id);
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
        <span style={{ padding: '0.25rem 0.75rem', borderRadius: '12px', fontSize: '0.85rem', fontWeight: 500, ...style }}>
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

    if (col === 'dureeminutes') {
      const duree = parseInt(intervention.dureeMinutes);
      if (!duree || isNaN(duree)) return '-';
      const heures = Math.floor(duree / 60);
      const minutes = duree % 60;
      return `${heures}h${minutes > 0 ? minutes + 'min' : ''}`;
    }

    if (config[col]?.render) {
      return config[col].render(intervention);
    }

    return intervention[col] || '-';
  };

  // ========================================
  // GESTION DU FORMULAIRE
  // ========================================
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));

    // Réinitialiser la recherche d'arbres quand la parcelle change
    if (name === 'parcelle_id') {
      setArbreSearchText('');
      setFormData(prev => ({ ...prev, arbre_id: [] }));
    }

    // Réinitialiser les détails quand le type change
    if (name === 'type_intervention_id') {
      setDetailsData({});
      setShowAdvancedFields(false);
    }
  };

  const handleArbresChange = (e) => {
    const selectedOptions = Array.from(e.target.selectedOptions, option => parseInt(option.value));
    setFormData(prev => ({
      ...prev,
      arbre_id: selectedOptions
    }));
  };

  const handleDetailsChange = (e) => {
    const { name, value, type, checked } = e.target;
    setDetailsData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const openNewModal = () => {
    setEditingIntervention(null);
    setFormData({
      type_intervention_id: '',
      parcelle_id: '',
      arbre_id: [],
      date_prevue: new Date().toISOString().split('T')[0],
      date_realisee: '',
      statut: 'Planifié',
      description: '',
      notes: '',
      cout: '',
      dureeMinutes: '',
      meteo: '',
      personnel: personnelDefaut,
      caveurId: ''
    });
    setDetailsData({});
    setArbreSearchText('');
    setShowAdvancedFields(false);
    setDoublonWarning(null);
    setShowModal(true);
  };

	const handleEdit = async (intervention) => {
	  setEditingIntervention(intervention);
	  setFormData({
		type_intervention_id: intervention.type_intervention_id || intervention.typeInterventionId,
		parcelle_id: intervention.parcelle_id || intervention.parcelleId,
		// ✅ CORRECTION : Convertir arbre_id en array
		arbre_id: intervention.arbre_id ? (Array.isArray(intervention.arbre_id) ? intervention.arbre_id : [intervention.arbre_id]): [],
		date_prevue: intervention.date_prevue?.split('T')[0] || intervention.date_prevue?.split('T')[0],
		date_realisee: intervention.date_realisee?.split('T')[0] || intervention.dateRealisee?.split('T')[0] || '',
		statut: intervention.statut || 'Planifié',
		description: intervention.description || '',
		notes: intervention.notes || '',
		cout: intervention.cout || '',
		dureeMinutes: intervention.dureeMinutes || intervention.duree_minutes || '',
		meteo: intervention.meteo || '',
		personnel: intervention.personnel || '',
		caveurId: intervention.caveurId || intervention.caveur_id || ''
	  });

    // Charger les détails depuis la nouvelle API
    try {
      const detailsRes = await axios.get(`${API_URL}/interventions/${intervention.id}/details`);
      setDetailsData(detailsRes.data || {});
      setShowAdvancedFields(Object.keys(detailsRes.data || {}).length > 0);
    } catch (error) {
      console.error('⚠️ Erreur chargement détails:', error);
      setDetailsData({});
      setShowAdvancedFields(false);
    }

    setArbreSearchText('');
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
    // Si plusieurs arbres sélectionnés, créer une intervention par arbre
    const arbresSelectionnes = formData.arbre_id && formData.arbre_id.length > 0 
      ? formData.arbre_id
      : [null]; // Si aucun arbre, créer une intervention sans arbre
    
    let interventionsCreees = 0;
    let savedIntervention = null;
    
    for (const arbre_id of arbresSelectionnes) {
		const dataToSend = {
		  // ⚠️ UTILISER snake_case pour correspondre au backend
		  type_intervention_id: formData.type_intervention_id ? parseInt(formData.type_intervention_id) : null,
		  parcelle_id: formData.parcelle_id ? parseInt(formData.parcelle_id) : null,
		  date_prevue: formData.date_prevue,
		  date_realisee: formData.date_realisee || null,
		  dureeminutes: formData.dureeMinutes ? parseInt(formData.dureeMinutes) : null,
		  personnel: formData.personnel || '',
		  description: formData.description || '',
		  cout: formData.cout ? parseFloat(formData.cout) : null,
		  statut: formData.statut || 'Planifié',
		  meteo: formData.meteo || '',
		  notes: formData.notes || ''
		};

		// ✅ Ajouter arbre_id SEULEMENT si un arbre est sélectionné
		if (arbre_id !== null) {
		  dataToSend.arbre_id = arbre_id;
		}
      
      console.log(`📤 Envoi intervention ${interventionsCreees + 1}/${arbresSelectionnes.length}:`, dataToSend);
      
      if (editingIntervention) {
        // En mode édition, on modifie l'intervention existante
        const res = await axios.put(`${process.env.REACT_APP_API_URL || 'http://localhost:3001/api'}/interventions/${editingIntervention.id}`, dataToSend);
        savedIntervention = res.data;
        interventionsCreees = 1;
        break; // En édition, on ne traite qu'une seule intervention
      } else {
        // En mode création, créer une intervention par arbre
        const res = await axios.post(`${process.env.REACT_APP_API_URL || 'http://localhost:3001/api'}/interventions`, dataToSend);
        savedIntervention = res.data;
        interventionsCreees++;
      }
    }
    
    // Message de succès
    if (editingIntervention) {
      showMessage('✅ Intervention mise à jour avec succès !', 'success');
    } else {
      showMessage(`✅ ${interventionsCreees} intervention(s) créée(s) avec succès !`, 'success');
    }
    
    // Sauvegarder les détails si présents (uniquement pour la dernière intervention créée)
    if (savedIntervention && Object.keys(detailsData).length > 0) {
      try {
        await axios.post(`${process.env.REACT_APP_API_URL || 'http://localhost:3001/api'}/interventions/${savedIntervention.id}/details`, detailsData);
      } catch (detailError) {
        console.error('Erreur sauvegarde détails:', detailError);
        showMessage('⚠️ Intervention sauvegardée, mais erreur sur les détails', 'warning');
      }
    }
    
    loadData();
    closeModal();
    
  } catch (error) {
    console.error('❌ Erreur lors de la sauvegarde:', error);
    
    // Message d'erreur plus détaillé
    if (error.response) {
      const errorMsg = error.response.data?.message || error.response.data?.error || 'Erreur serveur';
      showMessage(`❌ ${errorMsg}`, 'error');
      console.error('Détails erreur serveur:', error.response.data);
    } else {
      showMessage('❌ Erreur lors de la sauvegarde de l\'intervention', 'error');
    }
  } finally {
    setIsProcessing(false);
  }
};




  const askDelete = (intervention) => {
    setConfirmModal({
      type: 'delete',
      item: intervention,
      title: 'Supprimer l\'intervention',
      message: 'Voulez-vous vraiment supprimer cette intervention ? Cette action est irréversible.',
      confirmText: 'Oui, supprimer',
      confirmColor: '#f44336'
    });
  };

  const doDelete = async (intervention) => {
    setIsProcessing(true);
    setConfirmModal(null);

    try {
      await axios.delete(`${API_URL}/interventions/${intervention.id}`);
      showMessage('Intervention supprimée ✅', 'success');
      loadData();
    } catch (error) {
      console.error('❌ Erreur lors de la suppression:', error);
      showMessage('Erreur lors de la suppression ❌', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

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
    exportInterventionsPDF(sortedInterventions, null, colonnesExport);
  };

  // Import CSV
  const handleImportCSV = async (validData) => {
    try {
      for (const intervention of validData) {
        await axios.post(`${API_URL}/interventions`, intervention);
      }
      loadData();
      showMessage(`${validData.length} interventions importées avec succès ! ✅`, 'success');
    } catch (error) {
      console.error('❌ Erreur lors de l\'import:', error);
      throw new Error('Erreur lors de l\'import des interventions');
    }
  };

  // Sélection rapide de produit phyto
  const handleSelectProduitPhyto = (produit) => {
    setDetailsData(prev => ({
      ...prev,
      nomCommercial: produit.nomCommercial,
      matiereActive: produit.matiereActive,
      numeroAmm: produit.numeroAmm,
      fabricant: produit.fabricant,
      categorieTraitement: produit.categorie,
      delaiAvantRecolteJours: produit.darJours
    }));
  };

  // Sélection rapide d'amendement
  const handleSelectAmendement = (amendement) => {
    setDetailsData(prev => ({
      ...prev,
      typeAmendement: amendement.typeAmendement,
      nomProduitAmendement: amendement.nom,
      compositionNpk: amendement.npk,
      compositionCao: amendement.cao,
      certificationBio: amendement.utilisableBio
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
    const value = detailsData[champ.name] || '';

    if (champ.type === 'select') {
      return (
        <select
          name={champ.name}
          value={Array.isArray(formData.arbre_id) ? formData.arbre_id : []}  // ✅ Protection supplémentaire
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

  // 🆕 RENDU INDICATEUR DE TRI
  const renderSortIcon = (field) => {
    if (sortField !== field) {
      return <span style={{ opacity: 0.3, marginLeft: '0.25rem' }}>↕</span>;
    }
    return (
      <span style={{ marginLeft: '0.25rem' }}>
        {sortDirection === 'asc' ? '↑' : '↓'}
      </span>
    );
  };

  if (loading || loadingSettings) {
    return <div className="loading">⏳ Chargement des interventions...</div>;
  }

  const fieldsConfig = getFieldsConfig();

  return (
    <div className="page-container">
      {/* Modal de confirmation */}
      {confirmModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000 }}>
          <div style={{ background: 'white', padding: '2rem', borderRadius: '12px', maxWidth: '420px', textAlign: 'center', boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}>
            <h3 style={{ marginBottom: '1rem', color: '#333' }}>{confirmModal.title}</h3>
            <p style={{ marginBottom: '1.5rem', color: '#666', lineHeight: 1.5 }}>{confirmModal.message}</p>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              <button className="btn btn-secondary" onClick={() => setConfirmModal(null)} style={{ padding: '0.75rem 1.5rem' }}>
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

      {/* Modal d'édition groupée */}
      {showBulkEditModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000 }}>
          <div style={{ background: 'white', padding: '2rem', borderRadius: '12px', maxWidth: '500px', width: '90%' }}>
            <h3 style={{ marginBottom: '1.5rem', color: '#333' }}>✏️ Modification groupée</h3>
            
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>Statut</label>
              <select
                name="statut"
                value={bulkEditData.statut}
                onChange={handleBulkEditChange}
                style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #ddd' }}
              >
                <option value="">-- Ne pas modifier --</option>
                <option value="Planifié">Planifié</option>
                <option value="En cours">En cours</option>
                <option value="Terminé">Terminé</option>
                <option value="Annulé">Annulé</option>
              </select>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>Date réalisée</label>
              <input
                type="date"
                name="date_realisee"
                value={bulkEditData.date_realisee}
                onChange={handleBulkEditChange}
                style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #ddd' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button
                className="btn btn-secondary"
                onClick={() => setShowBulkEditModal(false)}
                style={{ padding: '0.75rem 1.5rem' }}
              >
                Annuler
              </button>
              <button
                className="btn btn-primary"
                onClick={handleBulkEditSubmit}
                disabled={isProcessing}
                style={{ padding: '0.75rem 1.5rem' }}
              >
                {isProcessing ? 'En cours...' : 'Appliquer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal d'import CSV */}
      {showImportModal && (
        <CSVImportModal
          onClose={() => setShowImportModal(false)}
          onImport={handleImportCSV}
          validateFunction={validateInterventionsCSV}
          entityName="interventions"
        />
      )}

      {/* Header */}
      <div className="page-header">
        <h2>📋 Gestion des Interventions</h2>
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
          <div className="card-title">Planifiées</div>
          <div className="card-value" style={{ color: '#856404' }}>{stats.planifiees}</div>
        </div>
        <div className="card" style={{ background: '#cce5ff' }}>
          <div className="card-title">En cours</div>
          <div className="card-value" style={{ color: '#004085' }}>{stats.enCours}</div>
        </div>
        <div className="card" style={{ background: '#d4edda' }}>
          <div className="card-title">Terminées</div>
          <div className="card-value" style={{ color: '#155724' }}>{stats.terminees}</div>
        </div>
        <div className="card">
          <div className="card-title">Coût total</div>
          <div className="card-value">{stats.coutTotal.toFixed(0)} €</div>
        </div>
        <div className="card">
          <div className="card-title">Durée totale</div>
          <div className="card-value">{Math.floor(stats.dureeTotale / 60)}h{stats.dureeTotale % 60 > 0 ? stats.dureeTotale % 60 + 'min' : ''}</div>
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
              {selectedInterventions.size} intervention{selectedInterventions.size > 1 ? 's' : ''} sélectionnée{selectedInterventions.size > 1 ? 's' : ''}
            </span>
            <button
              onClick={handleDeselectAll}
              style={{ padding: '0.4rem 0.8rem', background: 'transparent', border: '1px solid #1976d2', borderRadius: '6px', color: '#1976d2', cursor: 'pointer' }}
            >
              Tout désélectionner
            </button>
            {sortedInterventions.length > selectedInterventions.size && (
              <button
                onClick={handleSelectAllFiltered}
                style={{ padding: '0.4rem 0.8rem', background: 'transparent', border: '1px solid #1976d2', borderRadius: '6px', color: '#1976d2', cursor: 'pointer' }}
              >
                Sélectionner les {sortedInterventions.length} interventions filtrées
              </button>
            )}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button onClick={openBulkEditModal} className="btn btn-primary" style={{ padding: '0.5rem 1rem' }}>
              ✏️ Modifier la sélection
            </button>
            <button onClick={askBulkDelete} className="btn btn-danger" style={{ padding: '0.5rem 1rem' }}>
              🗑️ Supprimer la sélection
            </button>
          </div>
        </div>
      )}
      {/* Graphique d'activité temporel */}
      <div style={{ background: 'white', borderRadius: '12px', padding: '1.5rem', marginBottom: '1.5rem', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', border: '1px solid #e9ecef' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ margin: 0, color: '#2c5f2d', fontSize: '1.1rem' }}>📊 Activité des 6 derniers mois</h3>
          <button
            onClick={() => setShowGraphique(!showGraphique)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', color: '#666' }}
          >
            {showGraphique ? '▼' : '▶'}
          </button>
        </div>

        {showGraphique && (
          <div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.5rem', height: '180px', padding: '0.5rem 0' }}>
              {graphiqueData.map((data, index) => (
                <div key={index} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%' }}>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', width: '100%', gap: '2px' }}>
                    {data.terminees > 0 && (
                      <div
                        style={{
                          height: `${(data.terminees / maxInterventions) * 140}px`,
                          background: 'linear-gradient(180deg, #28a745 0%, #218838 100%)',
                          borderRadius: '4px 4px 0 0',
                          minHeight: '8px',
                          transition: 'height 0.3s ease'
                        }}
                        title={`${data.terminees} terminées`}
                      />
                    )}
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
                    {data.planifiees > 0 && (
                      <div
                        style={{
                          height: `${(data.planifiees / maxInterventions) * 140}px`,
                          background: 'linear-gradient(180deg, #ffc107 0%, #e0a800 100%)',
                          borderRadius: '0 0 4px 4px',
                          minHeight: '8px',
                          transition: 'height 0.3s ease'
                        }}
                        title={`${data.planifiees} planifiées`}
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
          </div>
        )}
      </div>

      {/* Barre de recherche et filtres */}
      <div style={{ background: 'white', borderRadius: '12px', padding: '1rem 1.5rem', marginBottom: '1.5rem', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', border: '1px solid #e9ecef' }}>
        {/* Ligne principale : recherche + bouton filtres */}
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '250px', position: 'relative' }}>
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
            🔧 Filtres
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
              🔄 Réinitialiser
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
            borderTop: '1px solid #e9ecef'
          }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.85rem', color: '#666' }}>Statut</label>
              <select
                value={filterStatut}
                onChange={(e) => { setFilterStatut(e.target.value); setCurrentPage(1); }}
                style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #ddd' }}
              >
                <option value="all">Tous</option>
                <option value="Planifié">Planifié</option>
                <option value="En cours">En cours</option>
                <option value="Terminé">Terminé</option>
                <option value="Annulé">Annulé</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.85rem', color: '#666' }}>Type</label>
              <select
                value={filterType}
                onChange={(e) => { setFilterType(e.target.value); setCurrentPage(1); }}
                style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #ddd' }}
              >
                <option value="all">Tous types</option>
                {typesIntervention.map(type => (
                  <option key={type.id} value={type.id}>{getTypeIcon(type.nom)} {type.nom}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.85rem', color: '#666' }}>Parcelle</label>
              <select
                value={filterParcelle}
                onChange={(e) => { setFilterParcelle(e.target.value); setCurrentPage(1); }}
                style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #ddd' }}
              >
                <option value="all">Toutes</option>
                {parcelles.map(p => (
                  <option key={p.id} value={p.id}>{p.nom}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.85rem', color: '#666' }}>Période</label>
              <select
                value={filterPeriode}
                onChange={(e) => { setFilterPeriode(e.target.value); setCurrentPage(1); }}
                style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #ddd' }}
              >
                <option value="all">Toutes</option>
                <option value="today">Aujourd'hui</option>
                <option value="week">Cette semaine</option>
                <option value="month">Ce mois-ci</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.85rem', color: '#666' }}>Date début</label>
              <input
                type="date"
                value={filterDateDebut}
                onChange={(e) => { setFilterDateDebut(e.target.value); setCurrentPage(1); }}
                style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #ddd' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.85rem', color: '#666' }}>Date fin</label>
              <input
                type="date"
                value={filterDateFin}
                onChange={(e) => { setFilterDateFin(e.target.value); setCurrentPage(1); }}
                style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #ddd' }}
              />
            </div>
          </div>
        )}
      </div>

      {/* 🆕 Tableau des interventions avec TRI */}
      <div style={{ background: 'white', borderRadius: '12px', padding: '1.5rem', marginBottom: '1.5rem', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', border: '1px solid #e9ecef', overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #e9ecef' }}>
              <th style={{ padding: '0.75rem', textAlign: 'left', width: '40px' }}>
                <input
                  type="checkbox"
                  checked={isAllPageSelected}
                  ref={input => {
                    if (input) input.indeterminate = !isAllPageSelected && isSomePageSelected;
                  }}
                  onChange={handleSelectAllPage}
                  style={{ cursor: 'pointer' }}
                />
              </th>
              <th 
                style={{ padding: '0.75rem', textAlign: 'left', cursor: 'pointer', userSelect: 'none' }}
                onClick={() => handleSort('typenom')}
              >
                Type{renderSortIcon('typenom')}
              </th>
              <th 
                style={{ padding: '0.75rem', textAlign: 'left', cursor: 'pointer', userSelect: 'none' }}
                onClick={() => handleSort('parcelleNom')}
              >
                Parcelle{renderSortIcon('parcelleNom')}
              </th>
              <th style={{ padding: '0.75rem', textAlign: 'left' }}>Arbres</th>
              <th 
                style={{ padding: '0.75rem', textAlign: 'left', cursor: 'pointer', userSelect: 'none' }}
                onClick={() => handleSort('date_prevue')}
              >
                Date prévue{renderSortIcon('date_prevue')}
              </th>
              <th 
                style={{ padding: '0.75rem', textAlign: 'left', cursor: 'pointer', userSelect: 'none' }}
                onClick={() => handleSort('statut')}
              >
                Statut{renderSortIcon('statut')}
              </th>
              <th style={{ padding: '0.75rem', textAlign: 'left' }}>Description</th>
              <th 
                style={{ padding: '0.75rem', textAlign: 'left', cursor: 'pointer', userSelect: 'none' }}
                onClick={() => handleSort('cout')}
              >
                Coût{renderSortIcon('cout')}
              </th>
              <th style={{ padding: '0.75rem', textAlign: 'center' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginatedInterventions.length === 0 ? (
              <tr>
                <td colSpan="9" style={{ padding: '2rem', textAlign: 'center', color: '#999' }}>
                  Aucune intervention trouvée
                </td>
              </tr>
            ) : (
              paginatedInterventions.map(intervention => (
                <tr key={intervention.id} style={{ borderBottom: '1px solid #e9ecef' }}>
                  <td style={{ padding: '0.75rem' }}>
                    <input
                      type="checkbox"
                      checked={selectedInterventions.has(intervention.id)}
                      onChange={() => handleSelectIntervention(intervention.id)}
                      style={{ cursor: 'pointer' }}
                    />
                  </td>
                  <td style={{ padding: '0.75rem' }}>{renderCell(intervention, 'typenom')}</td>
                  <td style={{ padding: '0.75rem' }}>{intervention.parcelleNom || intervention.parcelle_nom || '-'}</td>
                  <td style={{ padding: '0.75rem' }}>
					{(() => {
					// Si arbre_id est un array (multi-sélection)
					if (Array.isArray(intervention.arbre_id)) {
					  if (intervention.arbre_id.length === 0) return '-';
					  
					  // Afficher les numéros des arbres
					  const arbresNoms = intervention.arbre_id
						.map(id => {
						  const arbre = arbres.find(a => a.id === id);
						  return arbre?.numero || `#${id}`;
						})
						.join(', ');
					  
					  return arbresNoms || '-';
					}
					
					// Si arbre_id est un seul ID (nombre)
					if (intervention.arbre_id) {
					  const arbre = arbres.find(a => a.id === intervention.arbre_id);
					  return arbre?.numero || `#${intervention.arbre_id}`;
					}
					
					return '-';
				  })()}
                  </td>
                  <td style={{ padding: '0.75rem' }}>{renderCell(intervention, 'date_prevue')}</td>
                  <td style={{ padding: '0.75rem' }}>{renderCell(intervention, 'statut')}</td>
                  <td style={{ padding: '0.75rem', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {intervention.description || '-'}
                  </td>
                  <td style={{ padding: '0.75rem' }}>{renderCell(intervention, 'cout')}</td>
                  <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                    <button
                      onClick={() => handleEdit(intervention)}
                      style={{ padding: '0.25rem 0.75rem', marginRight: '0.5rem', background: '#2c5f2d', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                      title="Modifier"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => askDelete(intervention)}
                      style={{ padding: '0.25rem 0.75rem', background: '#f44336', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                      title="Supprimer"
                    >
                      🗑️
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {itemsPerPage !== 'all' && totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.9rem', color: '#666' }}>Lignes par page:</span>
            <select
              value={itemsPerPage}
              onChange={(e) => handleItemsPerPageChange(e.target.value === 'all' ? 'all' : parseInt(e.target.value))}
              style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid #ddd' }}
            >
              {PAGINATION_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>

            <span style={{ fontSize: '0.9rem', color: '#666', marginLeft: '1rem' }}>
              {(currentPage - 1) * itemsPerPage + 1}-{Math.min(currentPage * itemsPerPage, totalInterventions)} sur {totalInterventions}
            </span>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '6px',
                border: '1px solid #ddd',
                background: currentPage === 1 ? '#f5f5f5' : 'white',
                cursor: currentPage === 1 ? 'not-allowed' : 'pointer'
              }}
            >
              ◄◄
            </button>

            <button
              onClick={() => setCurrentPage(currentPage - 1)}
              disabled={currentPage === 1}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '6px',
                border: '1px solid #ddd',
                background: currentPage === 1 ? '#f5f5f5' : 'white',
                cursor: currentPage === 1 ? 'not-allowed' : 'pointer'
              }}
            >
              ◄
            </button>

            {getPageNumbers().map((page, idx) => (
              page === '...' ? (
                <span key={`ellipsis-${idx}`} style={{ padding: '0.5rem 1rem', color: '#999' }}>...</span>
              ) : (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  style={{
                    padding: '0.5rem 1rem',
                    borderRadius: '6px',
                    border: '1px solid #ddd',
                    background: currentPage === page ? '#2c5f2d' : 'white',
                    color: currentPage === page ? 'white' : '#333',
                    cursor: 'pointer',
                    fontWeight: currentPage === page ? 'bold' : 'normal'
                  }}
                >
                  {page}
                </button>
              )
            ))}

            <button
              onClick={() => setCurrentPage(currentPage + 1)}
              disabled={currentPage === totalPages}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '6px',
                border: '1px solid #ddd',
                background: currentPage === totalPages ? '#f5f5f5' : 'white',
                cursor: currentPage === totalPages ? 'not-allowed' : 'pointer'
              }}
            >
              ►
            </button>

            <button
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '6px',
                border: '1px solid #ddd',
                background: currentPage === totalPages ? '#f5f5f5' : 'white',
                cursor: currentPage === totalPages ? 'not-allowed' : 'pointer'
              }}
            >
              ►►
            </button>
          </div>
        </div>
      )}

      {/* Modal de création/édition */}
      {showModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, overflow: 'auto' }}>
          <div style={{ background: 'white', borderRadius: '12px', maxWidth: '800px', width: '90%', maxHeight: '90vh', overflow: 'auto', margin: '2rem' }}>
            <div style={{ position: 'sticky', top: 0, background: 'white', padding: '1.5rem', borderBottom: '1px solid #e9ecef', zIndex: 1 }}>
              <h3 style={{ margin: 0, color: '#333' }}>
                {editingIntervention ? '✏️ Modifier l\'intervention' : '➕ Nouvelle intervention'}
              </h3>
            </div>

            <form onSubmit={handleSubmit}>
              <div style={{ padding: '1.5rem' }}>
                {/* Champs principaux */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>Type d'intervention *</label>
                    <select
                      name="type_intervention_id"
                      value={formData.type_intervention_id}
                      onChange={handleInputChange}
                      required
                      style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #ddd' }}
                    >
                      <option value="">Sélectionner...</option>
                      {typesIntervention.map(type => (
                        <option key={type.id} value={type.id}>{getTypeIcon(type.nom)} {type.nom}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>Parcelle</label>
                    <select
                      name="parcelle_id"
                      value={formData.parcelle_id}
                      onChange={handleInputChange}
                      style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #ddd' }}
                    >
                      <option value="">Toutes les parcelles</option>
                      {parcelles.map(p => (
                        <option key={p.id} value={p.id}>{p.nom}</option>
                      ))}
                    </select>
                  </div>
                </div>

				{/* 🎯 SÉLECTION D'ARBRES - Multiple en création, Simple en édition */}
				<div>
				  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
					Arbre(s) concerné(s)
					{editingIntervention && (
					  <span style={{ fontSize: '0.85em', color: '#666', marginLeft: '0.5rem' }}>
						(modification : 1 seul arbre)
					  </span>
					)}
				  </label>

				  {/* 🔍 Champ de recherche - Seulement en mode création */}
				  {!editingIntervention && (
					<input
					  type="text"
					  placeholder="🔍 Rechercher un arbre..."
					  value={arbreSearchText}
					  onChange={(e) => setArbreSearchText(e.target.value)}
					  style={{
						width: '100%',
						padding: '0.5rem',
						marginBottom: '0.5rem',
						borderRadius: '4px',
						border: '1px solid #ddd'
					  }}
					/>
				  )}

				  {editingIntervention ? (
					/* ✅ MODE ÉDITION : SELECT SIMPLE (1 seul arbre) */
					<select
					  name="arbre_id"
					  value={Array.isArray(formData.arbre_id) ? (formData.arbre_id[0] || '') : (formData.arbre_id || '')}
					  onChange={(e) => {
						const value = e.target.value;
						setFormData(prev => ({
						  ...prev,
						  arbre_id: value ? [parseInt(value)] : []
						}));
					  }}
					  style={{
						width: '100%',
						padding: '0.5rem',
						borderRadius: '6px',
						border: '1px solid #ddd'
					  }}
					>
					  <option value="">-- Aucun arbre --</option>
					  {arbresFiltered.map(arbre => (
						<option key={arbre.id} value={arbre.id}>
						  {arbre.numero} - {arbre.espece} ({arbre.etat})
						</option>
					  ))}
					</select>
				  ) : (
					/* 🆕 MODE CRÉATION : SELECT MULTIPLE (plusieurs arbres) */
					<select
					  multiple
					  name="arbre_id"
					  value={Array.isArray(formData.arbre_id) ? formData.arbre_id : []}
					  onChange={handleArbresChange}
					  size={Math.min(8, arbresFiltered.length)}
					  style={{
						width: '100%',
						padding: '0.5rem',
						borderRadius: '6px',
						border: '1px solid #ddd',
						minHeight: '150px'
					  }}
					>
					  {arbresFiltered.length === 0 ? (
						<option disabled>Aucun arbre disponible pour cette parcelle</option>
					  ) : (
						arbresFiltered.map(arbre => (
						  <option key={arbre.id} value={arbre.id}>
							{arbre.numero} - {arbre.espece} ({arbre.etat})
						  </option>
						))
					  )}
					</select>
				  )}

				  <div style={{ fontSize: '0.85rem', color: '#666', marginTop: '0.5rem' }}>
					{editingIntervention ? (
					  '💡 Vous pouvez sélectionner un seul arbre en modification'
					) : (
					  <>
						💡 Maintenez <kbd>Ctrl</kbd> (Windows) ou <kbd>Cmd</kbd> (Mac) pour sélectionner plusieurs arbres
						{formData.arbre_id && formData.arbre_id.length > 0 && (
						  <div style={{ marginTop: '0.5rem', fontWeight: 'bold', color: '#28a745' }}>
							✅ {formData.arbre_id.length} arbre(s) sélectionné(s)
						  </div>
						)}
					  </>
					)}
				  </div>
				</div>


                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>Date prévue *</label>
                    <input
                      type="date"
                      name="date_prevue"
                      value={formData.date_prevue}
                      onChange={handleInputChange}
                      required
                      style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #ddd' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>Date réalisée</label>
                    <input
                      type="date"
                      name="date_realisee"
                      value={formData.date_realisee}
                      onChange={handleInputChange}
                      style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #ddd' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>Statut</label>
                    <select
                      name="statut"
                      value={formData.statut}
                      onChange={handleInputChange}
                      style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #ddd' }}
                    >
                      <option value="Planifié">Planifié</option>
                      <option value="En cours">En cours</option>
                      <option value="Terminé">Terminé</option>
                      <option value="Annulé">Annulé</option>
                    </select>
                  </div>
                </div>

                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>Description</label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    rows={3}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #ddd' }}
                  />
                </div>

                {/* Champs détaillés selon le type */}
                {fieldsConfig && (
                  <div style={{ marginTop: '1.5rem', padding: '1rem', background: '#f8f9fa', borderRadius: '8px' }}>
                    <h4 style={{ marginTop: 0, color: '#2c5f2d' }}>
                      {fieldsConfig.icon} Détails spécifiques - {getSelectedTypeName()}
                    </h4>
                    {fieldsConfig.sections.map((section, idx) => (
                      <div key={idx} style={{ marginBottom: '1.5rem' }}>
                        <h5 style={{ color: '#555', marginBottom: '1rem' }}>{section.titre}</h5>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                          {section.champs.map((champ, cidx) => (
                            <div key={cidx}>
                              <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.9rem', fontWeight: '500' }}>
                                {champ.label}
                                {champ.help && <span style={{ fontSize: '0.75rem', color: '#666', marginLeft: '0.25rem' }}>ℹ️</span>}
                              </label>
                              {renderField(champ)}
                              {champ.help && <small style={{ fontSize: '0.75rem', color: '#666' }}>{champ.help}</small>}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ position: 'sticky', bottom: 0, background: 'white', padding: '1.5rem', borderTop: '1px solid #e9ecef', display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={closeModal}
                  style={{ padding: '0.75rem 1.5rem', borderRadius: '6px', border: '1px solid #ddd', background: 'white', cursor: 'pointer' }}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isProcessing}
                  style={{
                    padding: '0.75rem 1.5rem',
                    borderRadius: '6px',
                    border: 'none',
                    background: '#2c5f2d',
                    color: 'white',
                    cursor: isProcessing ? 'wait' : 'pointer',
                    opacity: isProcessing ? 0.7 : 1
                  }}
                >
                  {isProcessing ? 'Enregistrement...' : (editingIntervention ? 'Mettre à jour' : 'Créer')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Interventions;
