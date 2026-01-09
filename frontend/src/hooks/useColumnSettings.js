import { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

/**
 * Hook personnalisé pour récupérer les colonnes à afficher/exporter
 * Fusionne les paramètres globaux avec les préférences utilisateur
 */
export const useColumnSettings = (entite) => {
  const [colonnesAffichees, setColonnesAffichees] = useState([]);
  const [colonnesExport, setColonnesExport] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        // Charger les paramètres globaux
        const [globalRes, userRes] = await Promise.all([
          axios.get(`${API_URL}/parametres`),
          axios.get(`${API_URL}/preferences-utilisateur`)
        ]);

        // Extraire les paramètres globaux pour cette entité
        let globalAffichees = [];
        let globalExport = [];

        globalRes.data.forEach(param => {
          if (param.cle === `colonnes_affichees_${entite}`) {
            try {
              globalAffichees = JSON.parse(param.valeur);
            } catch (e) {
              globalAffichees = param.valeur;
            }
          }
          if (param.cle === `colonnes_export_${entite}`) {
            try {
              globalExport = JSON.parse(param.valeur);
            } catch (e) {
              globalExport = param.valeur;
            }
          }
        });

        // Extraire les préférences utilisateur
        const userPrefs = userRes.data || {};
        let userColonnesAffichees = {};
        let userColonnesExport = {};

        try {
          userColonnesAffichees = typeof userPrefs.colonnes_affichees === 'string' 
            ? JSON.parse(userPrefs.colonnes_affichees) 
            : (userPrefs.colonnes_affichees || {});
        } catch (e) {
          userColonnesAffichees = {};
        }

        try {
          userColonnesExport = typeof userPrefs.colonnes_export === 'string'
            ? JSON.parse(userPrefs.colonnes_export)
            : (userPrefs.colonnes_export || {});
        } catch (e) {
          userColonnesExport = {};
        }

        // Fusionner : les préférences utilisateur écrasent les globales si définies
        const finalAffichees = userColonnesAffichees[entite] && userColonnesAffichees[entite].length > 0
          ? userColonnesAffichees[entite]
          : globalAffichees;

        const finalExport = userColonnesExport[entite] && userColonnesExport[entite].length > 0
          ? userColonnesExport[entite]
          : globalExport;

        setColonnesAffichees(Array.isArray(finalAffichees) ? finalAffichees : []);
        setColonnesExport(Array.isArray(finalExport) ? finalExport : []);
        setLoading(false);
      } catch (error) {
        console.error('Erreur lors du chargement des paramètres de colonnes:', error);
        setLoading(false);
      }
    };

    loadSettings();
  }, [entite]);

  return { colonnesAffichees, colonnesExport, loading };
};

/**
 * Définition des colonnes disponibles pour chaque entité
 */
export const COLONNES_CONFIG = {
  parcelles: {
    nom: { label: 'Nom', render: (p) => p.nom },
    surface_ha: { label: 'Surface (ha)', render: (p) => `${p.surface_ha} ha`, align: 'center' },
    type_sol: { label: 'Type de sol', render: (p) => p.type_sol || '-' },
    ph_sol: { label: 'pH', render: (p) => p.ph_sol ? `pH ${p.ph_sol}` : '-', align: 'center' },
    exposition: { label: 'Exposition', render: (p) => p.exposition || '-', align: 'center' },
    date_creation: { label: 'Date création', render: (p) => new Date(p.date_creation).toLocaleDateString('fr-FR'), align: 'center' },
    notes: { label: 'Notes', render: (p) => p.notes || '-' }
  },
  arbres: {
    numero: { label: 'Numéro', render: (a) => a.numero, align: 'center' },
    espece: { label: 'Espèce', render: (a) => a.espece },
    variete_truffe: { label: 'Variété truffe', render: (a) => a.variete_truffe || '-' },
    parcelle_nom: { label: 'Parcelle', render: (a) => a.parcelle_nom || '-' },
    etat: { label: 'État', render: (a) => a.etat, align: 'center' },
    date_plantation: { label: 'Plantation', render: (a) => new Date(a.date_plantation).toLocaleDateString('fr-FR'), align: 'center' },
    circonference_cm: { label: 'Circonf. (cm)', render: (a) => a.circonference_cm ? `${a.circonference_cm} cm` : '-', align: 'center' },
    hauteur_m: { label: 'Hauteur (m)', render: (a) => a.hauteur_m ? `${a.hauteur_m} m` : '-', align: 'center' },
    latitude: { label: 'Latitude', render: (a) => a.latitude || '-', align: 'center' },
    longitude: { label: 'Longitude', render: (a) => a.longitude || '-', align: 'center' },
    notes: { label: 'Notes', render: (a) => a.notes || '-' }
  },
  interventions: {
    date_prevue: { label: 'Date prévue', render: (i) => new Date(i.date_prevue).toLocaleDateString('fr-FR'), align: 'center' },
    date_realisee: { label: 'Date réalisée', render: (i) => i.date_realisee ? new Date(i.date_realisee).toLocaleDateString('fr-FR') : '-', align: 'center' },
    type_nom: { label: 'Type', render: (i) => i.type_nom || '-' },
    parcelle_nom: { label: 'Parcelle', render: (i) => i.parcelle_nom || '-' },
    arbre_numero: { label: 'Arbre', render: (i) => i.arbre_numero || '-', align: 'center' },
    statut: { label: 'Statut', render: (i) => i.statut },
    personnel: { label: 'Personnel', render: (i) => i.personnel || '-' },
    duree_minutes: { label: 'Durée (min)', render: (i) => i.duree_minutes ? `${i.duree_minutes} min` : '-', align: 'center' },
    cout: { label: 'Coût', render: (i) => i.cout ? `${parseFloat(i.cout).toFixed(2)} €` : '-', align: 'right' },
    description: { label: 'Description', render: (i) => i.description || '-' },
    meteo: { label: 'Météo', render: (i) => i.meteo || '-' },
    notes: { label: 'Notes', render: (i) => i.notes || '-' }
  },
  recoltes: {
    date_recolte: { label: 'Date', render: (r) => new Date(r.date_recolte).toLocaleDateString('fr-FR'), align: 'center' },
    parcelle_nom: { label: 'Parcelle', render: (r) => r.parcelle_nom || '-' },
    arbre_numero: { label: 'Arbre', render: (r) => r.arbre_numero || '-', align: 'center' },
    poids_grammes: { label: 'Poids (g)', render: (r) => `${parseFloat(r.poids_grammes).toFixed(0)} g`, align: 'right' },
    qualite: { label: 'Qualité', render: (r) => r.qualite || '-' },
    calibre: { label: 'Calibre', render: (r) => r.calibre || '-' },
    maturite: { label: 'Maturité', render: (r) => r.maturite || '-' },
    profondeur_cm: { label: 'Profondeur', render: (r) => r.profondeur_cm ? `${r.profondeur_cm} cm` : '-', align: 'center' },
    caveur: { label: 'Caveur', render: (r) => r.caveur || '-' },
    chien: { label: 'Chien', render: (r) => r.chien || '-' },
    conditions_meteo: { label: 'Météo', render: (r) => r.conditions_meteo || '-' },
    temperature_sol: { label: 'Temp. sol', render: (r) => r.temperature_sol ? `${r.temperature_sol}°C` : '-', align: 'center' },
    notes: { label: 'Notes', render: (r) => r.notes || '-' }
  },
  clients: {
    nom: { label: 'Nom', render: (c) => c.type === 'Particulier' ? `${c.nom} ${c.prenom || ''}` : (c.raison_sociale || c.nom) },
    prenom: { label: 'Prénom', render: (c) => c.prenom || '-' },
    raison_sociale: { label: 'Raison sociale', render: (c) => c.raison_sociale || '-' },
    type: { label: 'Type', render: (c) => c.type, align: 'center' },
    email: { label: 'Email', render: (c) => c.email || '-' },
    telephone: { label: 'Téléphone', render: (c) => c.telephone || '-' },
    adresse: { label: 'Adresse', render: (c) => c.adresse || '-' },
    code_postal: { label: 'Code postal', render: (c) => c.code_postal || '-', align: 'center' },
    ville: { label: 'Ville', render: (c) => c.ville || '-' },
    pays: { label: 'Pays', render: (c) => c.pays || '-' },
    siret: { label: 'SIRET', render: (c) => c.siret || '-' },
    date_premier_achat: { label: '1er achat', render: (c) => c.date_premier_achat ? new Date(c.date_premier_achat).toLocaleDateString('fr-FR') : '-', align: 'center' },
    notes: { label: 'Notes', render: (c) => c.notes || '-' }
  },
  ventes: {
    date_vente: { label: 'Date', render: (v) => new Date(v.date_vente).toLocaleDateString('fr-FR'), align: 'center' },
    numero_facture: { label: 'N° Facture', render: (v) => v.numero_facture || '-' },
    client_nom: { label: 'Client', render: (v, clients) => {
      const client = clients?.find(c => c.id === v.client_id);
      return client 
        ? (client.type === 'Particulier' ? `${client.nom} ${client.prenom || ''}` : client.raison_sociale || client.nom)
        : '-';
    }},
    commande_numero: { label: 'Commande', render: (v, clients, commandes) => {
      if (!v.commande_id) return '-';
      const commande = commandes?.find(c => c.id === v.commande_id);
      return commande ? (commande.numero_commande || `#${commande.id}`) : `#${v.commande_id}`;
    }, align: 'center' },
    quantite_grammes: { label: 'Quantité', render: (v) => `${parseFloat(v.quantite_grammes).toFixed(0)} g`, align: 'right' },
    prix_unitaire_kg: { label: 'Prix/kg', render: (v) => v.prix_unitaire_kg ? `${parseFloat(v.prix_unitaire_kg).toFixed(2)} €` : '-', align: 'right' },
    montant_total: { label: 'Montant', render: (v) => `${parseFloat(v.montant_total || 0).toFixed(2)} €`, align: 'right' },
    mode_paiement: { label: 'Paiement', render: (v) => v.mode_paiement || '-' },
    statut: { label: 'Statut', render: (v) => v.statut },
    notes: { label: 'Notes', render: (v) => v.notes || '-' }
  }
};

/**
 * Composant de tableau dynamique basé sur les colonnes configurées
 */
export const DynamicTable = ({ data, entite, colonnesAffichees, onEdit, onDelete, extraData, renderActions, renderCell }) => {
  const config = COLONNES_CONFIG[entite];
  
  if (!config || !colonnesAffichees || colonnesAffichees.length === 0) {
    return <p>Aucune colonne configurée pour l'affichage.</p>;
  }

  // Filtrer pour ne garder que les colonnes valides
  const colonnesValides = colonnesAffichees.filter(col => config[col]);

  return (
    <table>
      <thead>
        <tr>
          {colonnesValides.map(col => (
            <th key={col} style={{ textAlign: config[col].align || 'left' }}>
              {config[col].label}
            </th>
          ))}
          {(onEdit || onDelete || renderActions) && <th>Actions</th>}
        </tr>
      </thead>
      <tbody>
        {data.map((item, index) => (
          <tr key={item.id || index}>
            {colonnesValides.map(col => (
              <td key={col} style={{ textAlign: config[col].align || 'left' }}>
                {renderCell ? renderCell(item, col, config[col]) : config[col].render(item, extraData)}
              </td>
            ))}
            {(onEdit || onDelete || renderActions) && (
              <td>
                {renderActions ? renderActions(item) : (
                  <>
                    {onEdit && (
                      <button 
                        className="btn btn-secondary" 
                        onClick={() => onEdit(item)}
                        style={{ marginRight: '0.5rem', padding: '0.4rem 0.8rem' }}
                      >
                        ✏️
                      </button>
                    )}
                    {onDelete && (
                      <button 
                        className="btn btn-danger" 
                        onClick={() => onDelete(item.id)}
                        style={{ padding: '0.4rem 0.8rem' }}
                      >
                        🗑️
                      </button>
                    )}
                  </>
                )}
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
};

export default useColumnSettings;
