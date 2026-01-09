import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

const TABLE_NAMES = {
  'arbres': { label: 'Arbres', icon: '🌳', color: '#27ae60' },
  'parcelles': { label: 'Parcelles', icon: '📋', color: '#3498db' },
  'interventions': { label: 'Interventions', icon: '🛠️', color: '#e67e22' },
  'recoltes': { label: 'Récoltes', icon: '🍄', color: '#8e44ad' },
  'commandes': { label: 'Commandes', icon: '📦', color: '#2c3e50' },
  'ventes': { label: 'Ventes', icon: '💰', color: '#16a085' },
  'clients': { label: 'Clients', icon: '👥', color: '#c0392b' }
};

const ACTION_STYLES = {
  'INSERT': { label: 'Création', color: '#27ae60', icon: '➕' },
  'UPDATE': { label: 'Modification', color: '#f39c12', icon: '✏️' },
  'DELETE': { label: 'Suppression', color: '#e74c3c', icon: '🗑️' }
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
  
  // Interventions
  'type_intervention_id': 'Type d\'intervention',
  'arbre_id': 'Arbre',
  'date_prevue': 'Date prévue',
  'date_realisee': 'Date réalisée',
  'statut': 'Statut',
  'description': 'Description',
  'personnel': 'Personnel',
  'cout': 'Coût (€)',
  'duree_heures': 'Durée (h)',
  
  // Récoltes
  'date_recolte': 'Date de récolte',
  'poids_grammes': 'Poids (g)',
  'qualite': 'Qualité',
  'calibre': 'Calibre',
  'maturite': 'Maturité',
  'caveur_id': 'Caveur',
  'chien_id': 'Chien',
  
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
  'quantite_grammes': 'Quantité (g)',
  'prix_estime': 'Prix estimé (€)',
  'priorite': 'Priorité',
  
  // Ventes
  'date_vente': 'Date de vente',
  'numero_facture': 'N° Facture',
  'commande_id': 'Commande',
  'recolte_id': 'Récolte',
  'prix_unitaire_kg': 'Prix unitaire (€/kg)',
  'montant_total': 'Montant total (€)',
  'mode_paiement': 'Mode de paiement'
};

// Champs à ignorer dans l'affichage des détails
const IGNORED_FIELDS = ['created_at', 'updated_at', 'position', 'geojson'];

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
  
  // Filtres
  const [filterTable, setFilterTable] = useState('all');
  const [filterAction, setFilterAction] = useState('all');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  
  // Modal de purge
  const [showPurgeModal, setShowPurgeModal] = useState(false);
  const [purgeOptions, setPurgeOptions] = useState({
    period: 'year',
    table_name: 'all',
    custom_date: ''
  });
  
  // Modal de détail
  const [selectedEntry, setSelectedEntry] = useState(null);

  useEffect(() => {
    loadReferenceData();
  }, []);

  useEffect(() => {
    if (Object.keys(referenceData.parcelles).length > 0) {
      loadHistorique();
      loadStats();
    }
  }, [filterTable, filterAction, filterStartDate, filterEndDate, referenceData]);

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

      // Créer des dictionnaires ID -> Libellé
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
      'recolte_id': referenceData.recoltes
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
    
    // Résoudre les IDs de référence
    if (key.endsWith('_id') && key !== 'id') {
      const resolved = resolveId(key, value);
      return resolved !== value ? resolved : `#${value}`;
    }
    
    // Formater les dates
    if (key.includes('date') || key === 'created_at' || key === 'updated_at' || key === 'deleted_at') {
      if (!value) return '-';
      const date = new Date(value);
      return date.toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    }
    
    // Formater les prix/montants
    if (key.includes('prix') || key.includes('montant') || key === 'cout') {
      return `${parseFloat(value).toFixed(2)} €`;
    }
    
    // Formater les poids
    if (key.includes('poids') || key.includes('grammes')) {
      return `${value} g`;
    }
    
    // Formater les surfaces
    if (key.includes('surface')) {
      return `${value} ha`;
    }
    
    // Booléens
    if (typeof value === 'boolean') {
      return value ? 'Oui' : 'Non';
    }
    
    // Objets/tableaux
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }
    
    return String(value);
  };

  // Obtenir le libellé d'un champ
  const getFieldLabel = (key) => {
    return FIELD_LABELS[key] || key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const loadHistorique = async () => {
    try {
      const params = new URLSearchParams();
      if (filterTable !== 'all') params.append('table_name', filterTable);
      if (filterAction !== 'all') params.append('action', filterAction);
      if (filterStartDate) params.append('start_date', filterStartDate);
      if (filterEndDate) params.append('end_date', filterEndDate);
      params.append('limit', '500');
      
      const response = await axios.get(`${API_URL}/historique?${params.toString()}`);
      setHistorique(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Erreur:', error);
      showMessage('Erreur lors du chargement de l\'historique', 'error');
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await axios.get(`${API_URL}/historique/stats`);
      setStats(response.data);
    } catch (error) {
      console.error('Erreur stats:', error);
    }
  };

  const handlePurge = async () => {
    setIsProcessing(true);
    try {
      const response = await axios.delete(`${API_URL}/historique/purge`, {
        data: purgeOptions
      });
      showMessage(`Purge effectuée : ${response.data.deleted_count} enregistrement(s) supprimé(s)`, 'success');
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

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Générer un résumé lisible des données
  const getReadableSummary = (entry) => {
    const data = entry.new_data || entry.old_data || {};
    const tableName = entry.table_name;
    
    // Identifier l'élément principal
    let mainIdentifier = '';
    
    switch (tableName) {
      case 'arbres':
        mainIdentifier = data.numero || `Arbre #${entry.record_id}`;
        if (data.parcelle_id && referenceData.parcelles[data.parcelle_id]) {
          mainIdentifier += ` (${referenceData.parcelles[data.parcelle_id]})`;
        }
        break;
      case 'parcelles':
        mainIdentifier = data.nom || `Parcelle #${entry.record_id}`;
        break;
      case 'interventions':
        const typeIntervention = data.type_intervention_id ? 
          referenceData.typesIntervention[data.type_intervention_id] : 'Intervention';
        mainIdentifier = typeIntervention || 'Intervention';
        if (data.parcelle_id && referenceData.parcelles[data.parcelle_id]) {
          mainIdentifier += ` - ${referenceData.parcelles[data.parcelle_id]}`;
        }
        if (data.arbre_id && referenceData.arbres[data.arbre_id]) {
          mainIdentifier += ` (${referenceData.arbres[data.arbre_id]})`;
        }
        break;
      case 'recoltes':
        mainIdentifier = data.date_recolte ? 
          `Récolte du ${new Date(data.date_recolte).toLocaleDateString('fr-FR')}` : 
          `Récolte #${entry.record_id}`;
        if (data.poids_grammes) {
          mainIdentifier += ` - ${data.poids_grammes}g`;
        }
        if (data.parcelle_id && referenceData.parcelles[data.parcelle_id]) {
          mainIdentifier += ` (${referenceData.parcelles[data.parcelle_id]})`;
        }
        break;
      case 'clients':
        mainIdentifier = data.raison_sociale || 
          `${data.prenom || ''} ${data.nom || ''}`.trim() || 
          `Client #${entry.record_id}`;
        break;
      case 'commandes':
        mainIdentifier = data.numero_commande || `Commande #${entry.record_id}`;
        if (data.client_id && referenceData.clients[data.client_id]) {
          mainIdentifier += ` - ${referenceData.clients[data.client_id]}`;
        }
        break;
      case 'ventes':
        mainIdentifier = data.numero_facture || `Vente #${entry.record_id}`;
        if (data.client_id && referenceData.clients[data.client_id]) {
          mainIdentifier += ` - ${referenceData.clients[data.client_id]}`;
        }
        if (data.montant_total) {
          mainIdentifier += ` (${parseFloat(data.montant_total).toFixed(2)} €)`;
        }
        break;
      default:
        mainIdentifier = data.nom || data.numero || `#${entry.record_id}`;
    }
    
    return mainIdentifier;
  };

  const renderDataChanges = (entry) => {
    const summary = getReadableSummary(entry);
    
    if (entry.action === 'INSERT') {
      return (
        <div style={{ fontSize: '0.85rem', color: '#27ae60' }}>
          <strong>Nouveau :</strong> {summary}
        </div>
      );
    }
    
    if (entry.action === 'DELETE') {
      return (
        <div style={{ fontSize: '0.85rem', color: '#e74c3c' }}>
          <strong>Supprimé :</strong> {summary}
        </div>
      );
    }
    
    if (entry.action === 'UPDATE') {
      const changes = [];
      const oldData = entry.old_data || {};
      const newData = entry.new_data || {};
      
      Object.keys(newData).forEach(key => {
        if (!IGNORED_FIELDS.includes(key) && oldData[key] !== newData[key]) {
          changes.push(getFieldLabel(key));
        }
      });
      
      return (
        <div style={{ fontSize: '0.85rem', color: '#f39c12' }}>
          <strong>Modifié :</strong> {summary}
          {changes.length > 0 && (
            <span style={{ color: '#888', marginLeft: '0.5rem', fontStyle: 'italic' }}>
              ({changes.slice(0, 3).join(', ')}{changes.length > 3 ? '...' : ''})
            </span>
          )}
        </div>
      );
    }
    
    return null;
  };

  // Rendu des données dans le modal de détail avec libellés
  const renderDetailedData = (data, title, bgColor) => {
    if (!data) return null;
    
    const entries = Object.entries(data).filter(([key]) => !IGNORED_FIELDS.includes(key));
    
    return (
      <div style={{ marginBottom: '1rem' }}>
        <h4 style={{ color: bgColor === '#fff0f0' ? '#e74c3c' : '#27ae60', marginBottom: '0.5rem' }}>
          {title}
        </h4>
        <div style={{ 
          background: bgColor, 
          padding: '1rem', 
          borderRadius: '8px', 
          maxHeight: '300px',
          overflow: 'auto'
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
            <tbody>
              {entries.map(([key, value]) => (
                <tr key={key} style={{ borderBottom: '1px solid rgba(0,0,0,0.1)' }}>
                  <td style={{ 
                    padding: '0.5rem', 
                    fontWeight: '500', 
                    color: '#555',
                    width: '40%',
                    verticalAlign: 'top'
                  }}>
                    {getFieldLabel(key)}
                  </td>
                  <td style={{ padding: '0.5rem', color: '#333' }}>
                    {formatValue(key, value)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // Rendu des changements entre old_data et new_data pour les UPDATE
  const renderChangesComparison = (oldData, newData) => {
    if (!oldData || !newData) return null;
    
    const changes = [];
    Object.keys(newData).forEach(key => {
      if (!IGNORED_FIELDS.includes(key) && oldData[key] !== newData[key]) {
        changes.push({
          field: key,
          oldValue: oldData[key],
          newValue: newData[key]
        });
      }
    });
    
    if (changes.length === 0) return null;
    
    return (
      <div style={{ marginBottom: '1rem' }}>
        <h4 style={{ color: '#f39c12', marginBottom: '0.5rem' }}>📝 Modifications effectuées</h4>
        <div style={{ 
          background: '#fffbf0', 
          padding: '1rem', 
          borderRadius: '8px',
          border: '1px solid #f39c1240'
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #f39c1240' }}>
                <th style={{ padding: '0.5rem', textAlign: 'left', color: '#666' }}>Champ</th>
                <th style={{ padding: '0.5rem', textAlign: 'left', color: '#e74c3c' }}>Avant</th>
                <th style={{ padding: '0.5rem', textAlign: 'left', color: '#27ae60' }}>Après</th>
              </tr>
            </thead>
            <tbody>
              {changes.map(({ field, oldValue, newValue }) => (
                <tr key={field} style={{ borderBottom: '1px solid rgba(0,0,0,0.1)' }}>
                  <td style={{ padding: '0.5rem', fontWeight: '500', color: '#555' }}>
                    {getFieldLabel(field)}
                  </td>
                  <td style={{ padding: '0.5rem', color: '#e74c3c', background: '#fff0f0' }}>
                    {formatValue(field, oldValue)}
                  </td>
                  <td style={{ padding: '0.5rem', color: '#27ae60', background: '#f0fff0' }}>
                    {formatValue(field, newValue)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const resetFilters = () => {
    setFilterTable('all');
    setFilterAction('all');
    setFilterStartDate('');
    setFilterEndDate('');
  };

  if (loading) {
    return <div className="loading">Chargement de l'historique...</div>;
  }

  return (
    <div className="page-container">
      {/* Message de notification */}
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
          zIndex: 9999,
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
        }}>
          {message.text}
        </div>
      )}

      <div className="page-header">
        <h2>📜 Historique des actions</h2>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button 
            className="btn btn-secondary" 
            onClick={resetFilters}
            disabled={filterTable === 'all' && filterAction === 'all' && !filterStartDate && !filterEndDate}
          >
            🔄 Réinitialiser filtres
          </button>
          <button 
            className="btn btn-danger" 
            onClick={() => setShowPurgeModal(true)}
          >
            🗑️ Purger l'historique
          </button>
        </div>
      </div>

      {/* Statistiques */}
      {stats && (
        <div className="card-grid" style={{ marginBottom: '2rem' }}>
          <div className="card">
            <div className="card-title">Total entrées</div>
            <div className="card-value">{stats.total}</div>
          </div>
          <div className="card">
            <div className="card-title">Plus ancien</div>
            <div className="card-value" style={{ fontSize: '1rem' }}>
              {stats.oldest ? new Date(stats.oldest).toLocaleDateString('fr-FR') : '-'}
            </div>
          </div>
          <div className="card">
            <div className="card-title">Résultats filtrés</div>
            <div className="card-value">{historique.length}</div>
          </div>
        </div>
      )}

      {/* Filtres */}
      <div style={{ 
        marginBottom: '1.5rem', 
        display: 'flex', 
        gap: '1rem', 
        flexWrap: 'wrap',
        padding: '1rem',
        background: '#f8f9fa',
        borderRadius: '8px'
      }}>
        <div className="form-group" style={{ minWidth: '150px', margin: 0 }}>
          <label>Table</label>
          <select value={filterTable} onChange={(e) => setFilterTable(e.target.value)}>
            <option value="all">Toutes</option>
            {Object.entries(TABLE_NAMES).map(([key, val]) => (
              <option key={key} value={key}>{val.icon} {val.label}</option>
            ))}
          </select>
        </div>
        
        <div className="form-group" style={{ minWidth: '150px', margin: 0 }}>
          <label>Action</label>
          <select value={filterAction} onChange={(e) => setFilterAction(e.target.value)}>
            <option value="all">Toutes</option>
            {Object.entries(ACTION_STYLES).map(([key, val]) => (
              <option key={key} value={key}>{val.icon} {val.label}</option>
            ))}
          </select>
        </div>
        
        <div className="form-group" style={{ minWidth: '150px', margin: 0 }}>
          <label>Date début</label>
          <input 
            type="date" 
            value={filterStartDate} 
            onChange={(e) => setFilterStartDate(e.target.value)}
          />
        </div>
        
        <div className="form-group" style={{ minWidth: '150px', margin: 0 }}>
          <label>Date fin</label>
          <input 
            type="date" 
            value={filterEndDate} 
            onChange={(e) => setFilterEndDate(e.target.value)}
          />
        </div>
      </div>

      {/* Table */}
      {historique.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#888' }}>
          <p style={{ fontSize: '3rem', marginBottom: '1rem' }}>📭</p>
          <p>Aucun historique trouvé avec ces filtres</p>
        </div>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: '150px' }}>Date/Heure</th>
              <th style={{ width: '130px' }}>Table</th>
              <th style={{ width: '130px' }}>Action</th>
              <th>Détails</th>
              <th style={{ width: '60px' }}>Voir</th>
            </tr>
          </thead>
          <tbody>
            {historique.map(entry => {
              const tableInfo = TABLE_NAMES[entry.table_name] || { label: entry.table_name, icon: '📄', color: '#888' };
              const actionInfo = ACTION_STYLES[entry.action] || { label: entry.action, color: '#888', icon: '❓' };
              
              return (
                <tr key={entry.id}>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {formatDate(entry.timestamp)}
                  </td>
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
              <label style={{ fontWeight: 'bold' }}>Période à supprimer</label>
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

      {/* Modal de détail amélioré */}
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
            maxWidth: '800px',
            width: '90%',
            maxHeight: '85vh',
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
                {formatDate(selectedEntry.timestamp)}
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
