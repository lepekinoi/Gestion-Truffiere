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
    { key: 'prix_unitaire_kg', label: 'Prix unitaire (â‚¬/kg)' },
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
  
  // Paramètres globaux
  const [parametresGlobaux, setParametresGlobaux] = useState({
    colonnes_affichees: {},
    colonnes_export: {}
  });
  
  // Préférences utilisateur
  const [preferencesUtilisateur, setPreferencesUtilisateur] = useState({
    colonnes_affichees: {},
    colonnes_export: {}
  });

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
      globalRes.data.forEach(param => {
        if (param.cle.startsWith('colonnes_affichees_')) {
          const entite = param.cle.replace('colonnes_affichees_', '');
          globalData.colonnes_affichees[entite] = safeJsonParse(param.valeur, []);
        } else if (param.cle.startsWith('colonnes_export_')) {
          const entite = param.cle.replace('colonnes_export_', '');
          globalData.colonnes_export[entite] = safeJsonParse(param.valeur, []);
        }
      });
      setParametresGlobaux(globalData);
      
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
    // Calculer la date d'il y a 6 mois
    const now = new Date();
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
    const currentYear = now.getFullYear();
    
    // Stats caveurs
    const cavStats = {};
    caveursList.forEach(caveur => {
      // Stats totales
      const recoltesTotal = recoltesList.filter(r => r.caveur === caveur.nom);
      const totalPoids = recoltesTotal.reduce((sum, r) => sum + parseFloat(r.poids_grammes || 0), 0);
      const interventionsTotal = interventionsList.filter(i => i.personnel && i.personnel.includes(caveur.nom));
      
      // Stats 6 derniers mois
      const recoltes6Mois = recoltesTotal.filter(r => {
        const dateRecolte = new Date(r.date_recolte);
        return dateRecolte >= sixMonthsAgo;
      });
      const poids6Mois = recoltes6Mois.reduce((sum, r) => sum + parseFloat(r.poids_grammes || 0), 0);
      const interventions6Mois = interventionsTotal.filter(i => {
        const dateInt = new Date(i.date_realisee || i.date_prevue);
        return dateInt >= sixMonthsAgo;
      });
      
      cavStats[caveur.id] = {
        nbRecoltes: recoltesTotal.length,
        totalPoids: totalPoids,
        nbInterventions: interventionsTotal.length,
        nbRecoltes6Mois: recoltes6Mois.length,
        poids6Mois: poids6Mois,
        nbInterventions6Mois: interventions6Mois.length,
        annee: currentYear
      };
    });
    setCaveursStats(cavStats);
    
    // Stats chiens
    const chiStats = {};
    chiensList.forEach(chien => {
      // Stats totales
      const recoltesTotal = recoltesList.filter(r => r.chien === chien.nom);
      const totalPoids = recoltesTotal.reduce((sum, r) => sum + parseFloat(r.poids_grammes || 0), 0);
      
      // Stats 6 derniers mois
      const recoltes6Mois = recoltesTotal.filter(r => {
        const dateRecolte = new Date(r.date_recolte);
        return dateRecolte >= sixMonthsAgo;
      });
      const poids6Mois = recoltes6Mois.reduce((sum, r) => sum + parseFloat(r.poids_grammes || 0), 0);
      
      chiStats[chien.id] = {
        nbRecoltes: recoltesTotal.length,
        totalPoids: totalPoids,
        nbRecoltes6Mois: recoltes6Mois.length,
        poids6Mois: poids6Mois,
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
    setMessage(null);
    try {
      for (const [entite, colonnes] of Object.entries(parametresGlobaux.colonnes_affichees)) {
        await axios.put(`${API_URL}/parametres/colonnes_affichees_${entite}`, { 
          valeur: JSON.stringify(colonnes) 
        });
      }
      
      for (const [entite, colonnes] of Object.entries(parametresGlobaux.colonnes_export)) {
        await axios.put(`${API_URL}/parametres/colonnes_export_${entite}`, { 
          valeur: JSON.stringify(colonnes) 
        });
      }
      
      showMessage('âœ… Paramètres globaux sauvegardés avec succès !');
    } catch (error) {
      console.error('Erreur:', error);
      showMessage('âŒ Erreur lors de la sauvegarde des paramètres.', 'error');
    }
    setSaving(false);
  };

  const savePreferencesUtilisateur = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await axios.post(`${API_URL}/preferences-utilisateur`, {
        colonnes_affichees: JSON.stringify(preferencesUtilisateur.colonnes_affichees),
        colonnes_export: JSON.stringify(preferencesUtilisateur.colonnes_export)
      });
      
      showMessage('âœ… Préférences utilisateur sauvegardées avec succès !');
    } catch (error) {
      console.error('Erreur:', error);
      showMessage('âŒ Erreur lors de la sauvegarde des préférences.', 'error');
    }
    setSaving(false);
  };

  const handleConfirm = () => {
    if (!confirmModal) return;
    if (confirmModal.action === 'deleteCaveur') {
      handleDeleteCaveur(confirmModal.id);
    } else if (confirmModal.action === 'deleteChien') {
      handleDeleteChien(confirmModal.id);
    }
  };

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
      <div style={{ display: 'flex', gap: '0', marginBottom: '2rem', borderBottom: '2px solid #e0e0e0' }}>
        <button
          onClick={() => setActiveTab('equipe')}
          style={{
            padding: '1rem 2rem',
            background: activeTab === 'equipe' ? '#2c5f2d' : 'transparent',
            color: activeTab === 'equipe' ? 'white' : '#2c5f2d',
            border: 'none',
            cursor: 'pointer',
            fontSize: '1rem',
            fontWeight: activeTab === 'equipe' ? 'bold' : 'normal',
            borderTopLeftRadius: '8px',
            borderTopRightRadius: '8px',
            transition: 'all 0.2s'
          }}
        >
          👥 Équipe (Caveurs & Chiens)
        </button>
        <button
          onClick={() => setActiveTab('global')}
          style={{
            padding: '1rem 2rem',
            background: activeTab === 'global' ? '#2c5f2d' : 'transparent',
            color: activeTab === 'global' ? 'white' : '#2c5f2d',
            border: 'none',
            cursor: 'pointer',
            fontSize: '1rem',
            fontWeight: activeTab === 'global' ? 'bold' : 'normal',
            borderTopLeftRadius: '8px',
            borderTopRightRadius: '8px',
            transition: 'all 0.2s'
          }}
        >
          🌐 Paramètres globaux
        </button>
        <button
          onClick={() => setActiveTab('utilisateur')}
          style={{
            padding: '1rem 2rem',
            background: activeTab === 'utilisateur' ? '#2c5f2d' : 'transparent',
            color: activeTab === 'utilisateur' ? 'white' : '#2c5f2d',
            border: 'none',
            cursor: 'pointer',
            fontSize: '1rem',
            fontWeight: activeTab === 'utilisateur' ? 'bold' : 'normal',
            borderTopLeftRadius: '8px',
            borderTopRightRadius: '8px',
            transition: 'all 0.2s'
          }}
        >
          🐕¤ Préférences utilisateur
        </button>
      </div>

      {/* Contenu ÉQUIPE */}
      {activeTab === 'equipe' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
          
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
                        alignItems: 'center',
                        position: 'relative'
                      }}
                      title={`📊 Statistiques ${stats.annee || new Date().getFullYear()}\n━━━━━━━━━━━━━━━━━━━━━━━━\n🍄 Total : ${stats.nbRecoltes} récolte(s) (${(stats.totalPoids / 1000).toFixed(2)} kg)\n🛠️ Total : ${stats.nbInterventions} intervention(s)\n━━━━━━━━━━━━━━━━━━━━━━━━\n📅 6 derniers mois :\n   • ${stats.nbRecoltes6Mois || 0} récolte(s) (${((stats.poids6Mois || 0) / 1000).toFixed(2)} kg)\n   • ${stats.nbInterventions6Mois || 0} intervention(s)`}
                    >
                      {editingCaveur === caveur.id ? (
                        <input 
                          type="text" 
                          defaultValue={caveur.nom}
                          onBlur={(e) => handleUpdateCaveur(caveur.id, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleUpdateCaveur(caveur.id, e.target.value);
                            if (e.key === 'Escape') setEditingCaveur(null);
                          }}
                          autoFocus
                          style={{ flex: 1, padding: '0.25rem', borderRadius: '4px', border: '1px solid #2c5f2d' }}
                        />
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
                            {stats.nbRecoltes} réc. • {stats.nbInterventions} int.
                          </span>
                        </div>
                      )}
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
              🐕 Chiens truffiers
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
                      title={`📊 Statistiques ${stats.annee || new Date().getFullYear()}\n━━━━━━━━━━━━━━━━━━━━━━━━\n🍄 Total : ${stats.nbRecoltes} récolte(s) (${(stats.totalPoids / 1000).toFixed(2)} kg)\n━━━━━━━━━━━━━━━━━━━━━━━━\n📅 6 derniers mois :\n   • ${stats.nbRecoltes6Mois || 0} récolte(s) (${((stats.poids6Mois || 0) / 1000).toFixed(2)} kg)`}
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
                            âœ“
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

      {/* Contenu GLOBAL */}
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
