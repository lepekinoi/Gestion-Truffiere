// ============================================================
// AchatsFournisseursPage.jsx - Gestion complète achats et fournisseurs
// ============================================================

import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import '../App.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

// ============================================================
// COMPOSANT PRINCIPAL
// ============================================================
const AchatsFournisseursPage = () => {
  const { canWrite } = useAuth();
  const [activeTab, setActiveTab] = useState('fournisseurs');
  
  // États fournisseurs
  const [fournisseurs, setFournisseurs] = useState([]);
  const [loadingFournisseurs, setLoadingFournisseurs] = useState(true);
  const [showFournisseurForm, setShowFournisseurForm] = useState(false);
  const [editingFournisseur, setEditingFournisseur] = useState(null);
  
  // États achats
  const [achats, setAchats] = useState([]);
  const [loadingAchats, setLoadingAchats] = useState(true);
  const [showAchatForm, setShowAchatForm] = useState(false);
  const [editingAchat, setEditingAchat] = useState(null);
  
  // États des formulaires
  const [fournisseurForm, setFournisseurForm] = useState({
    nom: '',
    type: 'Plantes',
    contact: '',
    telephone: '',
    email: '',
    adresse: '',
    ville: '',
    code_postal: '',
    siret: '',
    certifications: '',
    notes: '',
    actif: true
  });

  const [achatForm, setAchatForm] = useState({
    fournisseur_id: '',
    date_achat: new Date().toISOString().split('T')[0],
    categorie: 'Plants',
    designation: '',
    quantite: '',
    unite: 'unité',
    prix_unitaire: '',
    montant_total: '',
    numero_facture: '',
    mode_paiement: 'Virement',
    statut_paiement: 'En attente',
    notes: ''
  });

  // Statistiques
  const [stats, setStats] = useState({
    fournisseursActifs: 0,
    totalFournisseurs: 0,
    zonesProduction: 0,
    fournisseursCertifies: 0,
    achatsAnnee: 0,
    montantTotal: 0
  });

  // ============================================================
  // CHARGEMENT DES DONNÉES
  // ============================================================
  useEffect(() => {
    chargerFournisseurs();
    chargerAchats();
  }, []);

  useEffect(() => {
    calculerStats();
  }, [fournisseurs, achats]);

  const chargerFournisseurs = async () => {
    try {
      const response = await fetch(`${API_URL}/fournisseurs`, {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setFournisseurs(data);
      }
    } catch (error) {
      console.error('Erreur chargement fournisseurs:', error);
    } finally {
      setLoadingFournisseurs(false);
    }
  };

  const chargerAchats = async () => {
    try {
      const response = await fetch(`${API_URL}/fournisseurs/achats`, {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setAchats(data);
      }
    } catch (error) {
      console.error('Erreur chargement achats:', error);
    } finally {
      setLoadingAchats(false);
    }
  };

  const calculerStats = () => {
    const fournisseursActifs = fournisseurs.filter(f => f.actif).length;
    const fournisseursCertifies = fournisseurs.filter(f => f.certifications).length;
    
    const achatsAnnee = achats.filter(a => {
      const dateAchat = new Date(a.date_achat);
      return dateAchat.getFullYear() === new Date().getFullYear();
    }).length;
    
    const montantTotal = achats.reduce((sum, a) => sum + (parseFloat(a.montant_total) || 0), 0);

    setStats({
      fournisseursActifs,
      totalFournisseurs: fournisseurs.length,
      zonesProduction: new Set(fournisseurs.map(f => f.ville).filter(Boolean)).size,
      fournisseursCertifies,
      achatsAnnee,
      montantTotal
    });
  };

  // ============================================================
  // GESTION FOURNISSEURS
  // ============================================================
  const handleSaveFournisseur = async (e) => {
    e.preventDefault();
    if (!canWrite()) {
      alert('Vous n\'avez pas les droits pour modifier les données');
      return;
    }

    try {
      const method = editingFournisseur ? 'PUT' : 'POST';
      const url = editingFournisseur
        ? `${API_URL}/fournisseurs/${editingFournisseur.id}`
        : `${API_URL}/fournisseurs`;

      const response = await fetch(url, {
        method,
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fournisseurForm)
      });

      if (response.ok) {
        chargerFournisseurs();
        resetFournisseurForm();
        alert(editingFournisseur ? 'Fournisseur modifié' : 'Fournisseur créé');
      } else {
        const error = await response.json();
        alert('Erreur: ' + error.error);
      }
    } catch (error) {
      console.error('Erreur sauvegarde fournisseur:', error);
      alert('Erreur lors de la sauvegarde');
    }
  };

  const handleEditFournisseur = (fournisseur) => {
    setEditingFournisseur(fournisseur);
    setFournisseurForm({
      nom: fournisseur.nom || '',
      type: fournisseur.type || 'Plantes',
      contact: fournisseur.contact || '',
      telephone: fournisseur.telephone || '',
      email: fournisseur.email || '',
      adresse: fournisseur.adresse || '',
      ville: fournisseur.ville || '',
      code_postal: fournisseur.code_postal || '',
      siret: fournisseur.siret || '',
      certifications: fournisseur.certifications || '',
      notes: fournisseur.notes || '',
      actif: fournisseur.actif !== false
    });
    setShowFournisseurForm(true);
  };

  const handleDeleteFournisseur = async (id) => {
    if (!canWrite()) {
      alert('Vous n\'avez pas les droits pour supprimer');
      return;
    }
    if (!window.confirm('Supprimer ce fournisseur ?')) return;

    try {
      const response = await fetch(`${API_URL}/fournisseurs/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (response.ok) {
        chargerFournisseurs();
        alert('Fournisseur supprimé');
      }
    } catch (error) {
      console.error('Erreur suppression:', error);
      alert('Erreur lors de la suppression');
    }
  };

  const resetFournisseurForm = () => {
    setFournisseurForm({
      nom: '',
      type: 'Plantes',
      contact: '',
      telephone: '',
      email: '',
      adresse: '',
      ville: '',
      code_postal: '',
      siret: '',
      certifications: '',
      notes: '',
      actif: true
    });
    setEditingFournisseur(null);
    setShowFournisseurForm(false);
  };

  // ============================================================
  // GESTION ACHATS
  // ============================================================
  const handleSaveAchat = async (e) => {
    e.preventDefault();
    if (!canWrite()) {
      alert('Vous n\'avez pas les droits pour modifier les données');
      return;
    }

    try {
      const method = editingAchat ? 'PUT' : 'POST';
      const url = editingAchat
        ? `${API_URL}/fournisseurs/achats/${editingAchat.id}`
        : `${API_URL}/fournisseurs/achats`;

      const response = await fetch(url, {
        method,
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(achatForm)
      });

      if (response.ok) {
        chargerAchats();
        resetAchatForm();
        alert(editingAchat ? 'Achat modifié' : 'Achat créé');
      } else {
        const error = await response.json();
        alert('Erreur: ' + error.error);
      }
    } catch (error) {
      console.error('Erreur sauvegarde achat:', error);
      alert('Erreur lors de la sauvegarde');
    }
  };

  const handleEditAchat = (achat) => {
    setEditingAchat(achat);
    setAchatForm({
      fournisseur_id: achat.fournisseur_id || '',
      date_achat: achat.date_achat?.split('T')[0] || new Date().toISOString().split('T')[0],
      categorie: achat.categorie || 'Plants',
      designation: achat.designation || '',
      quantite: achat.quantite || '',
      unite: achat.unite || 'unité',
      prix_unitaire: achat.prix_unitaire || '',
      montant_total: achat.montant_total || '',
      numero_facture: achat.numero_facture || '',
      mode_paiement: achat.mode_paiement || 'Virement',
      statut_paiement: achat.statut_paiement || 'En attente',
      notes: achat.notes || ''
    });
    setShowAchatForm(true);
  };

  const handleDeleteAchat = async (id) => {
    if (!canWrite()) {
      alert('Vous n\'avez pas les droits pour supprimer');
      return;
    }
    if (!window.confirm('Supprimer cet achat ?')) return;

    try {
      const response = await fetch(`${API_URL}/fournisseurs/achats/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (response.ok) {
        chargerAchats();
        alert('Achat supprimé');
      }
    } catch (error) {
      console.error('Erreur suppression:', error);
      alert('Erreur lors de la suppression');
    }
  };

  const resetAchatForm = () => {
    setAchatForm({
      fournisseur_id: '',
      date_achat: new Date().toISOString().split('T')[0],
      categorie: 'Plants',
      designation: '',
      quantite: '',
      unite: 'unité',
      prix_unitaire: '',
      montant_total: '',
      numero_facture: '',
      mode_paiement: 'Virement',
      statut_paiement: 'En attente',
      notes: ''
    });
    setEditingAchat(null);
    setShowAchatForm(false);
  };

  // Calcul automatique du montant total
  useEffect(() => {
    const quantite = parseFloat(achatForm.quantite) || 0;
    const prixUnitaire = parseFloat(achatForm.prix_unitaire) || 0;
    const montant = (quantite * prixUnitaire).toFixed(2);
    if (montant !== achatForm.montant_total) {
      setAchatForm(prev => ({ ...prev, montant_total: montant }));
    }
  }, [achatForm.quantite, achatForm.prix_unitaire]);

  // ============================================================
  // RENDU
  // ============================================================
  return (
    <div className="page-container">
      <div className="page-header">
        <h2>🛒 Gestion des Achats de Truffes</h2>
        <p>Gestion complète des fournisseurs, commandes et marges</p>
      </div>

      {/* Statistiques */}
      <div className="stats-container">
        <div className="stat-card" style={{ borderLeftColor: '#10b981' }}>
          <div className="stat-icon">✅</div>
          <div className="stat-content">
            <div className="stat-label">FOURNISSEURS ACTIFS</div>
            <div className="stat-value">{stats.fournisseursActifs}</div>
            <div className="stat-subtitle">sur {stats.totalFournisseurs} total</div>
          </div>
        </div>

        <div className="stat-card" style={{ borderLeftColor: '#3b82f6' }}>
          <div className="stat-icon">👥</div>
          <div className="stat-content">
            <div className="stat-label">TOUS LES FOURNISSEURS</div>
            <div className="stat-value">{stats.totalFournisseurs}</div>
            <div className="stat-subtitle">partenaires trufficulteurs</div>
          </div>
        </div>

        <div className="stat-card" style={{ borderLeftColor: '#f97316' }}>
          <div className="stat-icon">📍</div>
          <div className="stat-content">
            <div className="stat-label">ZONES COUVERTES</div>
            <div className="stat-value">{stats.zonesProduction}</div>
            <div className="stat-subtitle">zones de production</div>
          </div>
        </div>

        <div className="stat-card" style={{ borderLeftColor: '#8b5cf6' }}>
          <div className="stat-icon">🏆</div>
          <div className="stat-content">
            <div className="stat-label">CERTIFICATIONS</div>
            <div className="stat-value">{stats.fournisseursCertifies}</div>
            <div className="stat-subtitle">fournisseurs certifiés</div>
          </div>
        </div>
      </div>

      {/* Onglets */}
      <div className="tabs-container" style={{ marginTop: '20px' }}>
        <button
          className={`tab-button ${activeTab === 'fournisseurs' ? 'active' : ''}`}
          onClick={() => setActiveTab('fournisseurs')}
        >
          📋 Fournisseurs disponibles
        </button>
        <button
          className={`tab-button ${activeTab === 'achats' ? 'active' : ''}`}
          onClick={() => setActiveTab('achats')}
        >
          🛍️ Historique des achats ({stats.achatsAnnee} cette année)
        </button>
        <button
          className={`tab-button ${activeTab === 'stats' ? 'active' : ''}`}
          onClick={() => setActiveTab('stats')}
        >
          📊 Statistiques & Marges
        </button>
      </div>

      {/* Contenu des onglets */}
      {activeTab === 'fournisseurs' && (
        <div className="tab-content">
          {canWrite() && !showFournisseurForm && (
            <button className="btn-primary" onClick={() => setShowFournisseurForm(true)}>
              ➕ Ajouter un fournisseur
            </button>
          )}

          {showFournisseurForm && (
            <FormulaireFournisseur
              form={fournisseurForm}
              setForm={setFournisseurForm}
              onSubmit={handleSaveFournisseur}
              onCancel={resetFournisseurForm}
              editing={editingFournisseur}
            />
          )}

          <ListeFournisseurs
            fournisseurs={fournisseurs}
            loading={loadingFournisseurs}
            onEdit={handleEditFournisseur}
            onDelete={handleDeleteFournisseur}
            canWrite={canWrite()}
          />
        </div>
      )}

      {activeTab === 'achats' && (
        <div className="tab-content">
          {canWrite() && !showAchatForm && (
            <button className="btn-primary" onClick={() => setShowAchatForm(true)}>
              ➕ Nouvel achat
            </button>
          )}

          {showAchatForm && (
            <FormulaireAchat
              form={achatForm}
              setForm={setAchatForm}
              onSubmit={handleSaveAchat}
              onCancel={resetAchatForm}
              editing={editingAchat}
              fournisseurs={fournisseurs}
            />
          )}

          <ListeAchats
            achats={achats}
            loading={loadingAchats}
            onEdit={handleEditAchat}
            onDelete={handleDeleteAchat}
            canWrite={canWrite()}
            fournisseurs={fournisseurs}
          />
        </div>
      )}

      {activeTab === 'stats' && (
        <div className="tab-content">
          <StatsAchats achats={achats} fournisseurs={fournisseurs} />
        </div>
      )}
    </div>
  );
};

// ============================================================
// FORMULAIRE FOURNISSEUR
// ============================================================
const FormulaireFournisseur = ({ form, setForm, onSubmit, onCancel, editing }) => (
  <div className="form-card">
    <h3>{editing ? '✏️ Modifier le fournisseur' : '➕ Nouveau fournisseur'}</h3>
    <form onSubmit={onSubmit}>
      <div className="form-grid">
        <div className="form-group">
          <label>Nom du fournisseur *</label>
          <input
            type="text"
            value={form.nom}
            onChange={(e) => setForm({...form, nom: e.target.value})}
            required
          />
        </div>

        <div className="form-group">
          <label>Type</label>
          <select value={form.type} onChange={(e) => setForm({...form, type: e.target.value})}>
            <option value="Plantes">Plantes</option>
            <option value="Trufficulteur">Trufficulteur</option>
            <option value="Pépiniériste">Pépiniériste</option>
            <option value="Matériel">Matériel</option>
            <option value="Produits phytosanitaires">Produits phytosanitaires</option>
            <option value="Amendements">Amendements</option>
            <option value="Autre">Autre</option>
          </select>
        </div>

        <div className="form-group">
          <label>Personne de contact</label>
          <input
            type="text"
            value={form.contact}
            onChange={(e) => setForm({...form, contact: e.target.value})}
          />
        </div>

        <div className="form-group">
          <label>Téléphone</label>
          <input
            type="tel"
            value={form.telephone}
            onChange={(e) => setForm({...form, telephone: e.target.value})}
          />
        </div>

        <div className="form-group">
          <label>Email</label>
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm({...form, email: e.target.value})}
          />
        </div>

        <div className="form-group">
          <label>Adresse</label>
          <input
            type="text"
            value={form.adresse}
            onChange={(e) => setForm({...form, adresse: e.target.value})}
          />
        </div>

        <div className="form-group">
          <label>Code postal</label>
          <input
            type="text"
            value={form.code_postal}
            onChange={(e) => setForm({...form, code_postal: e.target.value})}
          />
        </div>

        <div className="form-group">
          <label>Ville</label>
          <input
            type="text"
            value={form.ville}
            onChange={(e) => setForm({...form, ville: e.target.value})}
          />
        </div>

        <div className="form-group">
          <label>SIRET</label>
          <input
            type="text"
            value={form.siret}
            onChange={(e) => setForm({...form, siret: e.target.value})}
          />
        </div>

        <div className="form-group">
          <label>Certifications</label>
          <input
            type="text"
            value={form.certifications}
            onChange={(e) => setForm({...form, certifications: e.target.value})}
            placeholder="Bio, IGP, etc."
          />
        </div>

        <div className="form-group full-width">
          <label>Notes</label>
          <textarea
            value={form.notes}
            onChange={(e) => setForm({...form, notes: e.target.value})}
            rows="3"
          />
        </div>

        <div className="form-group">
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              type="checkbox"
              checked={form.actif}
              onChange={(e) => setForm({...form, actif: e.target.checked})}
            />
            Fournisseur actif
          </label>
        </div>
      </div>

      <div className="form-actions">
        <button type="submit" className="btn-primary">
          {editing ? 'Enregistrer' : 'Créer'}
        </button>
        <button type="button" className="btn-secondary" onClick={onCancel}>
          Annuler
        </button>
      </div>
    </form>
  </div>
);

// ============================================================
// LISTE FOURNISSEURS
// ============================================================
const ListeFournisseurs = ({ fournisseurs, loading, onEdit, onDelete, canWrite }) => {
  if (loading) {
    return <div className="loading">Chargement...</div>;
  }

  if (fournisseurs.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-icon">📦</div>
        <p>Aucun fournisseur pour le moment</p>
        <p className="empty-subtitle">Commencez par créer un fournisseur dans l'application dédiée</p>
      </div>
    );
  }

  return (
    <div className="table-container" style={{ marginTop: '20px' }}>
      <table>
        <thead>
          <tr>
            <th>Nom</th>
            <th>Type</th>
            <th>Contact</th>
            <th>Téléphone</th>
            <th>Email</th>
            <th>Ville</th>
            <th>Certifications</th>
            <th>Statut</th>
            {canWrite && <th>Actions</th>}
          </tr>
        </thead>
        <tbody>
          {fournisseurs.map(f => (
            <tr key={f.id}>
              <td><strong>{f.nom}</strong></td>
              <td>{f.type}</td>
              <td>{f.contact || '-'}</td>
              <td>{f.telephone || '-'}</td>
              <td>{f.email || '-'}</td>
              <td>{f.ville || '-'}</td>
              <td>{f.certifications || '-'}</td>
              <td>
                <span className={`badge ${f.actif ? 'badge-success' : 'badge-error'}`}>
                  {f.actif ? '✓ Actif' : '✗ Inactif'}
                </span>
              </td>
              {canWrite && (
                <td>
                  <button className="btn-icon" onClick={() => onEdit(f)} title="Modifier">
                    ✏️
                  </button>
                  <button className="btn-icon" onClick={() => onDelete(f.id)} title="Supprimer">
                    🗑️
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// ============================================================
// FORMULAIRE ACHAT
// ============================================================
const FormulaireAchat = ({ form, setForm, onSubmit, onCancel, editing, fournisseurs }) => (
  <div className="form-card">
    <h3>{editing ? '✏️ Modifier l\'achat' : '➕ Nouvel achat'}</h3>
    <form onSubmit={onSubmit}>
      <div className="form-grid">
        <div className="form-group">
          <label>Fournisseur *</label>
          <select
            value={form.fournisseur_id}
            onChange={(e) => setForm({...form, fournisseur_id: e.target.value})}
            required
          >
            <option value="">Sélectionner...</option>
            {fournisseurs.filter(f => f.actif).map(f => (
              <option key={f.id} value={f.id}>{f.nom}</option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label>Date d'achat *</label>
          <input
            type="date"
            value={form.date_achat}
            onChange={(e) => setForm({...form, date_achat: e.target.value})}
            required
          />
        </div>

        <div className="form-group">
          <label>Catégorie *</label>
          <select
            value={form.categorie}
            onChange={(e) => setForm({...form, categorie: e.target.value})}
            required
          >
            <option value="Plants">Plants truffiers</option>
            <option value="Truffes">Truffes</option>
            <option value="Matériel">Matériel</option>
            <option value="Produits phytosanitaires">Produits phytosanitaires</option>
            <option value="Amendements">Amendements</option>
            <option value="Autre">Autre</option>
          </select>
        </div>

        <div className="form-group full-width">
          <label>Désignation *</label>
          <input
            type="text"
            value={form.designation}
            onChange={(e) => setForm({...form, designation: e.target.value})}
            placeholder="Ex: Chênes verts mycorhizés Tuber melanosporum"
            required
          />
        </div>

        <div className="form-group">
          <label>Quantité *</label>
          <input
            type="number"
            step="0.01"
            value={form.quantite}
            onChange={(e) => setForm({...form, quantite: e.target.value})}
            required
          />
        </div>

        <div className="form-group">
          <label>Unité</label>
          <select value={form.unite} onChange={(e) => setForm({...form, unite: e.target.value})}>
            <option value="unité">unité</option>
            <option value="kg">kg</option>
            <option value="g">g</option>
            <option value="L">L</option>
            <option value="m²">m²</option>
            <option value="lot">lot</option>
          </select>
        </div>

        <div className="form-group">
          <label>Prix unitaire (€) *</label>
          <input
            type="number"
            step="0.01"
            value={form.prix_unitaire}
            onChange={(e) => setForm({...form, prix_unitaire: e.target.value})}
            required
          />
        </div>

        <div className="form-group">
          <label>Montant total (€)</label>
          <input
            type="number"
            step="0.01"
            value={form.montant_total}
            readOnly
            style={{ backgroundColor: '#f3f4f6' }}
          />
        </div>

        <div className="form-group">
          <label>N° Facture</label>
          <input
            type="text"
            value={form.numero_facture}
            onChange={(e) => setForm({...form, numero_facture: e.target.value})}
          />
        </div>

        <div className="form-group">
          <label>Mode de paiement</label>
          <select value={form.mode_paiement} onChange={(e) => setForm({...form, mode_paiement: e.target.value})}>
            <option value="Virement">Virement</option>
            <option value="Chèque">Chèque</option>
            <option value="Espèces">Espèces</option>
            <option value="Carte bancaire">Carte bancaire</option>
          </select>
        </div>

        <div className="form-group">
          <label>Statut paiement</label>
          <select value={form.statut_paiement} onChange={(e) => setForm({...form, statut_paiement: e.target.value})}>
            <option value="En attente">En attente</option>
            <option value="Payé">Payé</option>
            <option value="En retard">En retard</option>
          </select>
        </div>

        <div className="form-group full-width">
          <label>Notes</label>
          <textarea
            value={form.notes}
            onChange={(e) => setForm({...form, notes: e.target.value})}
            rows="3"
          />
        </div>
      </div>

      <div className="form-actions">
        <button type="submit" className="btn-primary">
          {editing ? 'Enregistrer' : 'Créer'}
        </button>
        <button type="button" className="btn-secondary" onClick={onCancel}>
          Annuler
        </button>
      </div>
    </form>
  </div>
);

// ============================================================
// LISTE ACHATS
// ============================================================
const ListeAchats = ({ achats, loading, onEdit, onDelete, canWrite, fournisseurs }) => {
  if (loading) {
    return <div className="loading">Chargement...</div>;
  }

  if (achats.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-icon">📝</div>
        <p>Aucun achat enregistré</p>
      </div>
    );
  }

  const getFournisseurNom = (id) => {
    const f = fournisseurs.find(f => f.id === id);
    return f ? f.nom : 'Inconnu';
  };

  return (
    <div className="table-container" style={{ marginTop: '20px' }}>
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Fournisseur</th>
            <th>Catégorie</th>
            <th>Désignation</th>
            <th>Quantité</th>
            <th>Prix Unit.</th>
            <th>Montant</th>
            <th>N° Facture</th>
            <th>Paiement</th>
            {canWrite && <th>Actions</th>}
          </tr>
        </thead>
        <tbody>
          {achats.map(a => (
            <tr key={a.id}>
              <td>{new Date(a.date_achat).toLocaleDateString('fr-FR')}</td>
              <td><strong>{getFournisseurNom(a.fournisseur_id)}</strong></td>
              <td>{a.categorie}</td>
              <td>{a.designation}</td>
              <td>{a.quantite} {a.unite}</td>
              <td>{parseFloat(a.prix_unitaire).toFixed(2)} €</td>
              <td><strong>{parseFloat(a.montant_total).toFixed(2)} €</strong></td>
              <td>{a.numero_facture || '-'}</td>
              <td>
                <span className={`badge ${
                  a.statut_paiement === 'Payé' ? 'badge-success' :
                  a.statut_paiement === 'En retard' ? 'badge-error' :
                  'badge-warning'
                }`}>
                  {a.statut_paiement}
                </span>
              </td>
              {canWrite && (
                <td>
                  <button className="btn-icon" onClick={() => onEdit(a)} title="Modifier">
                    ✏️
                  </button>
                  <button className="btn-icon" onClick={() => onDelete(a.id)} title="Supprimer">
                    🗑️
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// ============================================================
// STATISTIQUES ACHATS
// ============================================================
const StatsAchats = ({ achats, fournisseurs }) => {
  const statsParCategorie = {};
  const statsParFournisseur = {};
  
  achats.forEach(a => {
    // Par catégorie
    if (!statsParCategorie[a.categorie]) {
      statsParCategorie[a.categorie] = { count: 0, montant: 0 };
    }
    statsParCategorie[a.categorie].count++;
    statsParCategorie[a.categorie].montant += parseFloat(a.montant_total) || 0;

    // Par fournisseur
    if (!statsParFournisseur[a.fournisseur_id]) {
      statsParFournisseur[a.fournisseur_id] = { count: 0, montant: 0 };
    }
    statsParFournisseur[a.fournisseur_id].count++;
    statsParFournisseur[a.fournisseur_id].montant += parseFloat(a.montant_total) || 0;
  });

  const getFournisseurNom = (id) => {
    const f = fournisseurs.find(f => f.id === parseInt(id));
    return f ? f.nom : 'Inconnu';
  };

  return (
    <div className="stats-details">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '20px' }}>
        <div className="info-card">
          <h3>📊 Achats par catégorie</h3>
          <table>
            <thead>
              <tr>
                <th>Catégorie</th>
                <th>Nombre</th>
                <th>Montant total</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(statsParCategorie).map(([cat, data]) => (
                <tr key={cat}>
                  <td><strong>{cat}</strong></td>
                  <td>{data.count}</td>
                  <td>{data.montant.toFixed(2)} €</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="info-card">
          <h3>👥 Achats par fournisseur</h3>
          <table>
            <thead>
              <tr>
                <th>Fournisseur</th>
                <th>Nombre</th>
                <th>Montant total</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(statsParFournisseur).map(([id, data]) => (
                <tr key={id}>
                  <td><strong>{getFournisseurNom(id)}</strong></td>
                  <td>{data.count}</td>
                  <td>{data.montant.toFixed(2)} €</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AchatsFournisseursPage;
