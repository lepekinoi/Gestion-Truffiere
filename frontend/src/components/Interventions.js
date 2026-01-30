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
// COMPOSANT TOOLTIP POUR LES LABELS
// ========================================

function FieldLabel({ label, tooltip }) {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <label style={{ 
      display: 'flex', 
      alignItems: 'center', 
      gap: '0.5rem',
      marginBottom: '0.25rem', 
      fontSize: '0.9rem', 
      fontWeight: '500' 
    }}>
      <span>{label}</span>
      {tooltip && (
        <span
          style={{
            position: 'relative',
            cursor: 'help',
            fontSize: '1.2rem',
            display: 'inline-flex',
            alignItems: 'center'
          }}
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
        >
          💡
          {showTooltip && (
            <div style={{
              position: 'absolute',
              left: '25px',
              top: '-10px',
              background: '#333',
              color: 'white',
              padding: '0.75rem',
              borderRadius: '6px',
              fontSize: '0.85rem',
              lineHeight: '1.4',
              width: '280px',
              zIndex: 1000,
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
              pointerEvents: 'none'
            }}>
              {tooltip}
              <div style={{
                position: 'absolute',
                left: '-6px',
                top: '15px',
                width: 0,
                height: 0,
                borderTop: '6px solid transparent',
                borderBottom: '6px solid transparent',
                borderRight: '6px solid #333'
              }} />
            </div>
          )}
        </span>
      )}
    </label>
  );
}

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
          { name: 'especePlantee', label: 'Espèce', type: 'select', options: ['', 'Chêne vert', 'Chêne pubescent', 'Chêne pédoncule', 'Noisetier', 'Charme', 'Tilleul', 'Pin', 'Autre'] },
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
          { name: 'captures', label: 'Nombre de captures', type: 'number', placeholder: 'Ex: 15' }
        ]
      }
    ]
  }
};

// ✅ Fonction pour récupérer l'icône d'un type d'intervention
const getTypeIcon = (typeName) => {
  return CHAMPS_PAR_TYPE[typeName]?.icon || '📋';
};

// ✅ NOUVELLE FONCTION : Récupère l'icône d'un statut
const getStatutIcon = (statut) => {
  const statutIcons = {
    'Prévu': '📅',
    'En cours': '⏳',
    'Terminé': '✅',
    'Annulé': '❌'
  };
  return statutIcons[statut] || '📋';
};

// Sélecteur de parcelle avec affichage amélioré
function ParcelleSelector({ parcelles, selectedId, onChange }) {
  return (
    <select 
      value={selectedId || ''} 
      onChange={(e) => onChange(e.target.value ? parseInt(e.target.value) : null)}
      style={{
        width: '100%',
        padding: '0.5rem',
        border: '1px solid #ddd',
        borderRadius: '4px',
        fontSize: '0.9rem'
      }}
    >
      <option value="">-- Sélectionner une parcelle --</option>
      {parcelles.map(p => (
        <option key={p.id} value={p.id}>
          {p.nom} ({p.surface_ha} ha)
        </option>
      ))}
    </select>
  );
}

// Composant principal
function Interventions() {
  // États
  const [interventions, setInterventions] = useState([]);
  const [typesIntervention, setTypesIntervention] = useState([]);
  const [parcelles, setParcelles] = useState([]);
  const [arbres, setArbres] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [editingIntervention, setEditingIntervention] = useState(null);
  const [message, setMessage] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Filtres et options d'affichage
  const [filterType, setFilterType] = useState('all');
  const [filterDateDebut, setFilterDateDebut] = useState('');
  const [filterDateFin, setFilterDateFin] = useState('');
  const [filterParcelle, setFilterParcelle] = useState('all');
  const [filterArbre, setFilterArbre] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  
  // États pour le tri
  const [sortColumn, setSortColumn] = useState(null);
  const [sortDirection, setSortDirection] = useState('asc');
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(PAGINATION_OPTIONS[2].value);

  // Formulaire
  const [formData, setFormData] = useState({
    parcelle_id: null,
    arbre_id: null,
    type_intervention_id: null,
    date_prevue: new Date().toISOString().split('T')[0],
    statut: 'Prévu', 
    description: '',
    notes: '',
    donnees_complementaires: {}
  });

  const { colonnesAffichees, colonnesExport, loading: loadingSettings } = useColumnSettings('interventions');
  
  useEffect(() => { loadData(); }, []);

  const showMessage = (text, type = 'success') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 4000);
  };

  const loadData = async () => {
    try {
      const [interventionsRes, parcellesRes, arbresRes, typesRes] = await Promise.all([
        axios.get(`${API_URL}/interventions`),
        axios.get(`${API_URL}/parcelles`),
        axios.get(`${API_URL}/arbres`),
        axios.get(`${API_URL}/types-intervention`)
      ]);
      setInterventions(interventionsRes.data);
      setParcelles(parcellesRes.data);
      setArbres(arbresRes.data);
      setTypesIntervention(typesRes.data);
      setLoading(false);
    } catch (error) {
      console.error('Erreur:', error);
      showMessage('Erreur lors du chargement des données', 'error');
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleComplementChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      donnees_complementaires: {
        ...prev.donnees_complementaires,
        [field]: value
      }
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsProcessing(true);
    try {
      const dataToSend = {
        type_intervention_id: formData.type_intervention_id,
        parcelle_id: formData.parcelle_id === '' ? null : formData.parcelle_id,
        arbre_id: formData.arbre_id === '' ? null : formData.arbre_id,
        date_prevue: formData.date_prevue,
        statut: formData.statut,
        description: formData.description,
        notes: formData.notes,
        ...formData.donnees_complementaires
      };
      
      Object.keys(dataToSend).forEach(key => {
        if (dataToSend[key] === '' || dataToSend[key] === undefined) {
          dataToSend[key] = null;
        }
      });
      
      if (editingIntervention) {
        await axios.put(`${API_URL}/interventions/${editingIntervention.id}`, dataToSend);
        showMessage('Intervention mise à jour !', 'success');
      } else {
        await axios.post(`${API_URL}/interventions`, dataToSend);
        showMessage('Intervention créée !', 'success');
      }
      
      loadData();
      closeModal();
    } catch (error) {
      console.error('Erreur:', error);
      showMessage(error.response?.data?.details || 'Erreur lors de la sauvegarde', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleEdit = (intervention) => {
    setEditingIntervention(intervention);
    setFormData({
      parcelle_id: intervention.parcelle_id || null,
      arbre_id: intervention.arbre_id || null,
      type_intervention_id: intervention.type_intervention_id || null,
      date_prevue: intervention.date_prevue ? intervention.date_prevue.split('T')[0] : '',
      statut: intervention.statut || 'Prévu', 
      description: intervention.description || '',
      notes: intervention.notes || '',
      donnees_complementaires: intervention.donnees_complementaires || {}
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Supprimer cette intervention ?')) return;
    try {
      await axios.delete(`${API_URL}/interventions/${id}`);
      showMessage('Intervention supprimée !', 'success');
      loadData();
    } catch (error) {
      showMessage('Erreur lors de la suppression', 'error');
    }
  };

  const openNewModal = () => {
    setEditingIntervention(null);
    setFormData({
      parcelle_id: null,
      arbre_id: null,
      type_intervention_id: null,
      date_prevue: new Date().toISOString().split('T')[0],
      statut: 'Prévu',
      description: '',
      notes: '',
      donnees_complementaires: {}
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingIntervention(null);
  };

  const handleImportCSV = async (validData) => {
    try {
      for (const intervention of validData) {
        await axios.post(`${API_URL}/interventions`, intervention);
      }
      loadData();
      showMessage(`${validData.length} intervention(s) importée(s) !`, 'success');
    } catch (error) {
      throw new Error('Erreur lors de l\'import');
    }
  };

  const handleExportPDF = () => {
    exportInterventionsPDF(interventions, colonnesExport);
  };

  // Gestion du tri
  const handleSort = (column) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  // Filtrage
  const interventionsFiltrees = useMemo(() => {
    return interventions.filter(inter => {
      if (filterType !== 'all' && inter.type_nom !== filterType) return false;
      if (filterParcelle !== 'all' && inter.parcelle_id !== parseInt(filterParcelle)) return false;
      if (filterArbre !== 'all' && inter.arbre_id !== parseInt(filterArbre)) return false;
      if (filterDateDebut && inter.date_prevue < filterDateDebut) return false;
      if (filterDateFin && inter.date_prevue > filterDateFin) return false;
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        if (!inter.description?.toLowerCase().includes(search) && 
            !inter.type_nom?.toLowerCase().includes(search) &&
            !inter.notes?.toLowerCase().includes(search)) {
          return false;
        }
      }
      return true;
    });
  }, [interventions, filterType, filterParcelle, filterArbre, filterDateDebut, filterDateFin, searchTerm]);

  // Tri des interventions filtrées
  const interventionsTriees = useMemo(() => {
    if (!sortColumn) return interventionsFiltrees;
    
    return [...interventionsFiltrees].sort((a, b) => {
      let aVal = a[sortColumn];
      let bVal = b[sortColumn];
      
      // Gestion des valeurs nulles
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;
      
      // Comparaison selon le type
      if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = bVal.toLowerCase();
      }
      
      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [interventionsFiltrees, sortColumn, sortDirection]);

  // Pagination
  const totalPages = itemsPerPage === 'all' ? 1 : Math.ceil(interventionsTriees.length / itemsPerPage);
  const interventionsPaginees = itemsPerPage === 'all' 
    ? interventionsTriees 
    : interventionsTriees.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
      );

  const resetFilters = () => {
    setFilterType('all');
    setFilterParcelle('all');
    setFilterArbre('all');
    setFilterDateDebut('');
    setFilterDateFin('');
    setSearchTerm('');
    setCurrentPage(1);
  };

  const activeFiltersCount = [filterType, filterParcelle, filterArbre, filterDateDebut, filterDateFin, searchTerm]
    .filter(f => f && f !== 'all').length;

  // Rendu du formulaire selon le type d'intervention
  const renderFormFields = () => {
    const typeObj = typesIntervention.find(t => t.id === parseInt(formData.type_intervention_id));
    if (!typeObj) return null;
    
    const typeName = typeObj.nom;
    const config = CHAMPS_PAR_TYPE[typeName];
    if (!config) return null;

    return (
      <div style={{ marginTop: '1rem' }}>
        <h4 style={{ color: '#2c5f2d', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '1.5rem' }}>{config.icon}</span>
          Paramètres spécifiques
        </h4>
        
        {config.sections.map((section, idx) => (
          <div key={idx} style={{ marginBottom: '1.5rem' }}>
            <h5 style={{ color: '#4caf50', marginBottom: '0.75rem', borderBottom: '1px solid #e0e0e0', paddingBottom: '0.25rem' }}>
              {section.titre}
            </h5>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
              {section.champs.map(champ => (
                <div key={champ.name} style={{ marginBottom: '0.5rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.9rem', fontWeight: '500' }}>
                    {champ.label}
                    {champ.help && <span style={{ fontSize: '0.8rem', color: '#666', marginLeft: '0.25rem' }}>({champ.help})</span>}
                  </label>
                  
                  {champ.type === 'select' ? (
                    <select
                      value={formData.donnees_complementaires[champ.name] || ''}
                      onChange={(e) => handleComplementChange(champ.name, e.target.value)}
                      style={{ width: '100%', padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px' }}
                    >
                      {champ.options.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  ) : champ.type === 'textarea' ? (
                    <textarea
                      value={formData.donnees_complementaires[champ.name] || ''}
                      onChange={(e) => handleComplementChange(champ.name, e.target.value)}
                      placeholder={champ.placeholder}
                      rows="3"
                      style={{ width: '100%', padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px', resize: 'vertical' }}
                    />
                  ) : champ.type === 'checkbox' ? (
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={formData.donnees_complementaires[champ.name] || false}
                        onChange={(e) => handleComplementChange(champ.name, e.target.checked)}
                      />
                      <span>Oui</span>
                    </label>
                  ) : (
                    <input
                      type={champ.type || 'text'}
                      value={formData.donnees_complementaires[champ.name] || ''}
                      onChange={(e) => handleComplementChange(champ.name, e.target.value)}
                      placeholder={champ.placeholder}
                      step={champ.step}
                      min={champ.min}
                      max={champ.max}
                      style={{ width: '100%', padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px' }}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  };

  if (loading || loadingSettings) return <div className="loading">Chargement...</div>;

  const config = COLONNES_CONFIG.interventions;
  const colonnesValides = colonnesAffichees.filter(col => config[col]);

  return (
    <div className="page-container">
      {message && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          padding: '1rem 1.5rem',
          borderRadius: '8px',
          background: message.type === 'error' ? '#f44336' : '#4caf50',
          color: 'white',
          fontWeight: 'bold',
          zIndex: 9999
        }}>
          {message.text}
        </div>
      )}

      <div className="page-header">
        <h2>🛠️ Gestion des interventions</h2>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-secondary" onClick={() => setShowImportModal(true)}>📤 Importer CSV</button>
          <button className="btn btn-secondary" onClick={handleExportPDF} disabled={interventions.length === 0}>📄 Exporter PDF</button>
          <button className="btn btn-primary" onClick={openNewModal}>➕ Nouvelle intervention</button>
        </div>
      </div>

      {interventions.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🛠️</div>
          <p>Aucune intervention enregistrée</p>
          <button className="btn btn-primary" onClick={openNewModal} style={{ marginTop: '1rem' }}>Créer ma première intervention</button>
        </div>
      ) : (
        <>
          {/* Filtres */}
          <div style={{ marginBottom: '1rem' }}>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="btn btn-secondary"
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '0.5rem',
                background: activeFiltersCount > 0 ? '#e3f2fd' : undefined,
                borderColor: activeFiltersCount > 0 ? '#1976d2' : undefined
              }}
            >
              🔍 Filtres {activeFiltersCount > 0 && `(${activeFiltersCount})`}
              <span style={{ fontSize: '0.8rem' }}>{showFilters ? '▲' : '▼'}</span>
            </button>
            
            {showFilters && (
              <div style={{ marginTop: '0.75rem', padding: '1rem', background: 'white', borderRadius: '8px', border: '1px solid #ddd' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.85rem', fontWeight: '600' }}>Recherche</label>
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Description, type, notes..."
                      style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ddd' }}
                    />
                  </div>
                  
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.85rem', fontWeight: '600' }}>Type</label>
                    <select 
                      value={filterType} 
                      onChange={(e) => setFilterType(e.target.value)} 
                      style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ddd' }}
                    >
                      <option value="all">Tous</option>
                      {Object.keys(CHAMPS_PAR_TYPE).map(type => (
                        <option key={type} value={type}>
                          {getTypeIcon(type)} {type}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.85rem', fontWeight: '600' }}>Parcelle</label>
                    <select value={filterParcelle} onChange={(e) => setFilterParcelle(e.target.value)} style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ddd' }}>
                      <option value="all">Toutes</option>
                      {parcelles.map(p => (
                        <option key={p.id} value={p.id}>{p.nom}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.85rem', fontWeight: '600' }}>Du</label>
                    <input
                      type="date"
                      value={filterDateDebut}
                      onChange={(e) => setFilterDateDebut(e.target.value)}
                      style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ddd' }}
                    />
                  </div>
                  
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.85rem', fontWeight: '600' }}>Au</label>
                    <input
                      type="date"
                      value={filterDateFin}
                      onChange={(e) => setFilterDateFin(e.target.value)}
                      style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ddd' }}
                    />
                  </div>
                </div>
                
                <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.85rem', color: '#666' }}>
                    {interventionsTriees.length} / {interventions.length} intervention(s)
                  </span>
                  {activeFiltersCount > 0 && (
                    <button 
                      onClick={resetFilters}
                      style={{ padding: '0.5rem 1rem', background: '#ff5722', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem' }}
                    >
                      ✕ Réinitialiser
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Pagination au-dessus du tableau */}
          {totalPages > 1 && (
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              marginBottom: '0.75rem',
              padding: '0.75rem 1rem',
              background: 'white',
              borderRadius: '8px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.85rem', color: '#666' }}>Afficher</span>
                <select 
                  value={itemsPerPage} 
                  onChange={(e) => { 
                    const value = e.target.value === 'all' ? 'all' : parseInt(e.target.value);
                    setItemsPerPage(value); 
                    setCurrentPage(1); 
                  }}
                  style={{ padding: '0.4rem 0.6rem', borderRadius: '4px', border: '1px solid #ddd', fontSize: '0.85rem' }}
                >
                  {PAGINATION_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                <span style={{ fontSize: '0.85rem', color: '#666' }}>lignes</span>
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <button 
                  onClick={() => setCurrentPage(1)} 
                  disabled={currentPage === 1}
                  style={{ 
                    padding: '0.4rem 0.6rem', 
                    border: 'none', 
                    background: currentPage === 1 ? '#f5f5f5' : '#4caf50',
                    color: currentPage === 1 ? '#ccc' : 'white',
                    borderRadius: '4px',
                    cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                    fontSize: '1rem'
                  }}
                  title="Première page"
                >
                  ⏮️
                </button>
                <button 
                  onClick={() => setCurrentPage(currentPage - 1)} 
                  disabled={currentPage === 1}
                  style={{ 
                    padding: '0.4rem 0.6rem', 
                    border: 'none', 
                    background: currentPage === 1 ? '#f5f5f5' : '#4caf50',
                    color: currentPage === 1 ? '#ccc' : 'white',
                    borderRadius: '4px',
                    cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                    fontSize: '1rem'
                  }}
                  title="Page précédente"
                >
                  ◀️
                </button>
                <span style={{ fontSize: '0.9rem', fontWeight: '600', padding: '0 0.75rem' }}>
                  Page {currentPage} / {totalPages}
                </span>
                <button 
                  onClick={() => setCurrentPage(currentPage + 1)} 
                  disabled={currentPage === totalPages}
                  style={{ 
                    padding: '0.4rem 0.6rem', 
                    border: 'none', 
                    background: currentPage === totalPages ? '#f5f5f5' : '#4caf50',
                    color: currentPage === totalPages ? '#ccc' : 'white',
                    borderRadius: '4px',
                    cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                    fontSize: '1rem'
                  }}
                  title="Page suivante"
                >
                  ▶️
                </button>
                <button 
                  onClick={() => setCurrentPage(totalPages)} 
                  disabled={currentPage === totalPages}
                  style={{ 
                    padding: '0.4rem 0.6rem', 
                    border: 'none', 
                    background: currentPage === totalPages ? '#f5f5f5' : '#4caf50',
                    color: currentPage === totalPages ? '#ccc' : 'white',
                    borderRadius: '4px',
                    cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                    fontSize: '1rem'
                  }}
                  title="Dernière page"
                >
                  ⏭️
                </button>
              </div>
            </div>
          )}

          {/* Tableau */}
          <div style={{ background: 'white', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
            <table>
              <thead>
                <tr>
                  {colonnesValides.map(col => (
                    <th 
                      key={col}
                      onClick={() => handleSort(col)}
                      style={{ cursor: 'pointer', userSelect: 'none', position: 'relative' }}
                      title={`Trier par ${config[col].label}`}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'space-between' }}>
                        <span>{config[col].label}</span>
                        {sortColumn === col && (
                          <span style={{ fontSize: '0.8rem' }}>
                            {sortDirection === 'asc' ? '🔼' : '🔽'}
                          </span>
                        )}
                      </div>
                    </th>
                  ))}
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {interventionsPaginees.map(inter => (
                  <tr key={inter.id}>
                    {colonnesValides.map(col => {
                      // ✅ CORRECTION + AMÉLIORATION : Affichage des emojis pour Type ET Statut
                      if (col === 'type_nom') {
                        return (
                          <td key={col}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <span style={{ fontSize: '1.2rem' }}>{getTypeIcon(inter.type_nom)}</span>
                              <span>{inter.type_nom}</span>
                            </span>
                          </td>
                        );
                      }
                      if (col === 'statut') {
                        return (
                          <td key={col}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <span style={{ fontSize: '1.2rem' }}>{getStatutIcon(inter.statut)}</span>
                              <span>{inter.statut}</span>
                            </span>
                          </td>
                        );
                      }
                      return <td key={col}>{config[col].render(inter)}</td>;
                    })}
                    <td>
                      <div style={{ display: 'flex', gap: '0.25rem' }}>
                        <button className="btn btn-secondary" onClick={() => handleEdit(inter)} style={{ padding: '0.4rem 0.6rem' }}>✏️</button>
                        <button className="btn btn-danger" onClick={() => handleDelete(inter.id)} style={{ padding: '0.4rem 0.6rem' }}>🗑️</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '900px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="modal-header">
              <h3>{editingIntervention ? 'Modifier l\'intervention' : 'Nouvelle intervention'}</h3>
              <button className="modal-close" onClick={closeModal}>✕</button>
            </div>
            
            <form onSubmit={handleSubmit}>
              <div className="form-grid">
                <div className="form-group">
                  <label>Type d'intervention *</label>
                  <select 
                    name="type_intervention_id"
                    value={formData.type_intervention_id || ''} 
                    onChange={handleInputChange} 
                    required
                  >
                    <option value="">-- Sélectionner --</option>
                    {typesIntervention.map(type => (
                      <option key={type.id} value={type.id}>
                        {CHAMPS_PAR_TYPE[type.nom]?.icon || '📋'} {type.nom}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div className="form-group">
                  <label>Date prévue *</label>
                  <input 
                    type="date" 
                    name="date_prevue"
                    value={formData.date_prevue} 
                    onChange={handleInputChange} 
                    required 
                  />
                </div>
                
                <div className="form-group">
                  <label>Parcelle</label>
                  <ParcelleSelector 
                    parcelles={parcelles} 
                    selectedId={formData.parcelle_id} 
                    onChange={(id) => {
                      setFormData(prev => ({ 
                        ...prev, 
                        parcelle_id: id,
                        arbre_id: null
                      }));
                    }} 
                  />
                </div>
                
                <div className="form-group">
                  <label>Arbre (optionnel)</label>
                  <select
                    name="arbre_id"
                    value={formData.arbre_id || ''}
                    onChange={handleInputChange}
                    disabled={!formData.parcelle_id}
                    style={{
                      width: '100%',
                      padding: '0.5rem',
                      border: '1px solid #ddd',
                      borderRadius: '4px',
                      fontSize: '0.9rem',
                      backgroundColor: !formData.parcelle_id ? '#f5f5f5' : 'white'
                    }}
                  >
                    <option value="">
                      {formData.parcelle_id ? '-- Sélectionner un arbre --' : '⚠️ Sélectionner d\'abord une parcelle'}
                    </option>
                    {arbres
                      .filter(a => a.parcelle_id === parseInt(formData.parcelle_id))
                      .map(arbre => (
                        <option key={arbre.id} value={arbre.id}>
                          {arbre.numero} - {arbre.espece || 'N/A'}
                        </option>
                      ))
                    }
                  </select>
                </div>
                
                <div className="form-group">
                  <label>Statut *</label>
                  <select
                    name="statut"
                    value={formData.statut || 'Prévu'}
                    onChange={handleInputChange}
                    required
                    style={{
                      width: '100%',
                      padding: '0.5rem',
                      border: '1px solid #ddd',
                      borderRadius: '4px',
                      fontSize: '0.9rem'
                    }}
                  >
                    <option value="Prévu">📅 Prévu</option>
                    <option value="En cours">⏳ En cours</option>
                    <option value="Terminé">✅ Terminé</option>
                    <option value="Annulé">❌ Annulé</option>
                  </select>
                </div>
              </div>
              
              <div className="form-group">
                <FieldLabel 
                  label="Description générale"
                  tooltip="Description objective de l'intervention : qu'est-ce qui est fait ? (ex: Traitement insecticide préventif, Taille de formation des jeunes arbres)"
                />
                <textarea 
                  name="description" 
                  value={formData.description} 
                  onChange={handleInputChange} 
                  rows="3" 
                  placeholder="Décrivez l'objectif principal de l'intervention..." 
                />
              </div>
              
              <div className="form-group">
                <FieldLabel 
                  label="Notes"
                  tooltip="Informations complémentaires, observations terrain et remarques contextuelles (ex: Conditions météo favorables, Application réussie, Zone humide à surveiller)"
                />
                <textarea 
                  name="notes" 
                  value={formData.notes} 
                  onChange={handleInputChange} 
                  rows="3" 
                  placeholder="Observations, remarques, contexte particulier..." 
                />
              </div>
              
              {renderFormFields()}
              
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={closeModal}>Annuler</button>
                <button type="submit" className="btn btn-primary" disabled={isProcessing}>
                  {isProcessing ? 'En cours...' : (editingIntervention ? 'Mettre à jour' : 'Créer')}
                </button>
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
      />
    </div>
  );
}

export default Interventions;