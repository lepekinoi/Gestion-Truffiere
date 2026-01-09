import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

function Ventes() {
  const [ventes, setVentes] = useState([]);
  const [clients, setClients] = useState([]);
  const [recoltes, setRecoltes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingVente, setEditingVente] = useState(null);
  const [filterStatut, setFilterStatut] = useState('all');
  const [formData, setFormData] = useState({
    client_id: '',
    recolte_id: '',
    date_vente: '',
    quantite_grammes: '',
    prix_unitaire_kg: '',
    mode_paiement: '',
    statut: 'En attente',
    numero_facture: '',
    notes: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [ventesRes, clientsRes, recoltesRes] = await Promise.all([
        axios.get(`${API_URL}/ventes`),
        axios.get(`${API_URL}/clients`),
        axios.get(`${API_URL}/recoltes`)
      ]);
      setVentes(ventesRes.data);
      setClients(clientsRes.data);
      setRecoltes(recoltesRes.data);
      setLoading(false);
    } catch (error) {
      console.error('Erreur lors du chargement:', error);
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const dataToSend = { ...formData };
      if (!dataToSend.recolte_id) dataToSend.recolte_id = null;

      if (editingVente) {
        await axios.put(`${API_URL}/ventes/${editingVente.id}`, dataToSend);
      } else {
        await axios.post(`${API_URL}/ventes`, dataToSend);
      }
      loadData();
      closeModal();
    } catch (error) {
      console.error('Erreur lors de la sauvegarde:', error);
      alert('Erreur lors de la sauvegarde de la vente');
    }
  };

  const handleEdit = (vente) => {
    setEditingVente(vente);
    setFormData({
      client_id: vente.client_id || '',
      recolte_id: vente.recolte_id || '',
      date_vente: vente.date_vente ? vente.date_vente.split('T')[0] : '',
      quantite_grammes: vente.quantite_grammes || '',
      prix_unitaire_kg: vente.prix_unitaire_kg || '',
      mode_paiement: vente.mode_paiement || '',
      statut: vente.statut || 'En attente',
      numero_facture: vente.numero_facture || '',
      notes: vente.notes || ''
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer cette vente ?')) {
      try {
        await axios.delete(`${API_URL}/ventes/${id}`);
        loadData();
      } catch (error) {
        console.error('Erreur lors de la suppression:', error);
        alert('Erreur lors de la suppression de la vente');
      }
    }
  };

  const openNewModal = () => {
    setEditingVente(null);
    const today = new Date().toISOString().split('T')[0];
    setFormData({
      client_id: '',
      recolte_id: '',
      date_vente: today,
      quantite_grammes: '',
      prix_unitaire_kg: '',
      mode_paiement: '',
      statut: 'En attente',
      numero_facture: '',
      notes: ''
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingVente(null);
  };

  const getStatutBadgeStyle = (statut) => {
    const styles = {
      'En attente': { background: '#fff3cd', color: '#856404' },
      'Payée': { background: '#d4edda', color: '#155724' },
      'Annulée': { background: '#f8d7da', color: '#721c24' }
    };
    return styles[statut] || styles['En attente'];
  };

  // Filtrage
  const filteredVentes = ventes.filter(vente => {
    return filterStatut === 'all' || vente.statut === filterStatut;
  });

  // Statistiques
  const stats = {
    total: ventes.length,
    enAttente: ventes.filter(v => v.statut === 'En attente').length,
    payees: ventes.filter(v => v.statut === 'Payée').length,
    chiffreAffaires: ventes
      .filter(v => v.statut === 'Payée')
      .reduce((sum, v) => sum + parseFloat(v.montant_total || 0), 0),
    quantiteVendue: ventes
      .filter(v => v.statut === 'Payée')
      .reduce((sum, v) => sum + parseFloat(v.quantite_grammes || 0), 0),
    prixMoyen: 0
  };

  if (stats.quantiteVendue > 0) {
    stats.prixMoyen = (stats.chiffreAffaires / (stats.quantiteVendue / 1000));
  }

  // Calcul du montant total
  const montantCalcule = () => {
    const quantite = parseFloat(formData.quantite_grammes) || 0;
    const prix = parseFloat(formData.prix_unitaire_kg) || 0;
    return ((quantite / 1000) * prix).toFixed(2);
  };

  if (loading) {
    return <div className="loading">Chargement des ventes...</div>;
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h2>💰 Gestion des ventes</h2>
        <button className="btn btn-primary" onClick={openNewModal}>
          ➕ Nouvelle vente
        </button>
      </div>

      {/* Statistiques */}
      <div className="card-grid" style={{ marginBottom: '2rem' }}>
        <div className="card">
          <div className="card-title">Total ventes</div>
          <div className="card-value">{stats.total}</div>
        </div>
        <div className="card">
          <div className="card-title">En attente</div>
          <div className="card-value" style={{ color: '#856404' }}>{stats.enAttente}</div>
        </div>
        <div className="card">
          <div className="card-title">Payées</div>
          <div className="card-value" style={{ color: '#155724' }}>{stats.payees}</div>
        </div>
        <div className="card">
          <div className="card-title">Chiffre d'affaires</div>
          <div className="card-value">{stats.chiffreAffaires.toFixed(2)} <span style={{ fontSize: '1.5rem' }}>€</span></div>
        </div>
        <div className="card">
          <div className="card-title">Quantité vendue</div>
          <div className="card-value">{(stats.quantiteVendue / 1000).toFixed(2)} <span style={{ fontSize: '1.5rem' }}>kg</span></div>
        </div>
        <div className="card">
          <div className="card-title">Prix moyen/kg</div>
          <div className="card-value">{stats.prixMoyen.toFixed(2)} <span style={{ fontSize: '1.5rem' }}>€</span></div>
        </div>
      </div>

      {/* Filtres */}
      <div style={{ marginBottom: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <button 
          className={`btn ${filterStatut === 'all' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setFilterStatut('all')}
          style={{ padding: '0.5rem 1rem' }}
        >
          Toutes
        </button>
        <button 
          className={`btn ${filterStatut === 'En attente' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setFilterStatut('En attente')}
          style={{ padding: '0.5rem 1rem' }}
        >
          En attente
        </button>
        <button 
          className={`btn ${filterStatut === 'Payée' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setFilterStatut('Payée')}
          style={{ padding: '0.5rem 1rem' }}
        >
          Payées
        </button>
        <button 
          className={`btn ${filterStatut === 'Annulée' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setFilterStatut('Annulée')}
          style={{ padding: '0.5rem 1rem' }}
        >
          Annulées
        </button>
      </div>

      {filteredVentes.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">💰</div>
          <p>Aucune vente {filterStatut !== 'all' && `avec le statut "${filterStatut}"`}</p>
          <button className="btn btn-primary" onClick={openNewModal} style={{ marginTop: '1rem' }}>
            Enregistrer ma première vente
          </button>
        </div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>N° Facture</th>
              <th>Client</th>
              <th>Quantité</th>
              <th>Prix/kg</th>
              <th>Montant TTC</th>
              <th>Paiement</th>
              <th>Statut</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredVentes
              .sort((a, b) => new Date(b.date_vente) - new Date(a.date_vente))
              .map(vente => {
                const client = clients.find(c => c.id === vente.client_id);
                const clientNom = client 
                  ? (client.type === 'Particulier' 
                      ? `${client.nom} ${client.prenom || ''}`
                      : client.raison_sociale || client.nom)
                  : '-';

                return (
                  <tr key={vente.id}>
                    <td><strong>{new Date(vente.date_vente).toLocaleDateString('fr-FR')}</strong></td>
                    <td>{vente.numero_facture || '-'}</td>
                    <td>{clientNom}</td>
                    <td><strong>{parseFloat(vente.quantite_grammes).toFixed(0)} g</strong></td>
                    <td>{parseFloat(vente.prix_unitaire_kg).toFixed(2)} €</td>
                    <td>
                      <strong style={{ color: '#27ae60', fontSize: '1.1rem' }}>
                        {parseFloat(vente.montant_total).toFixed(2)} €
                      </strong>
                    </td>
                    <td>{vente.mode_paiement || '-'}</td>
                    <td>
                      <span style={{
                        padding: '0.25rem 0.75rem',
                        borderRadius: '12px',
                        fontSize: '0.85rem',
                        fontWeight: '500',
                        ...getStatutBadgeStyle(vente.statut)
                      }}>
                        {vente.statut}
                      </span>
                    </td>
                    <td>
                      <button 
                        className="btn btn-secondary" 
                        onClick={() => handleEdit(vente)}
                        style={{ marginRight: '0.5rem', padding: '0.4rem 0.8rem' }}
                      >
                        ✏️
                      </button>
                      <button 
                        className="btn btn-danger" 
                        onClick={() => handleDelete(vente.id)}
                        style={{ padding: '0.4rem 0.8rem' }}
                      >
                        🗑️
                      </button>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      )}

      {/* Modal de création/édition */}
      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '700px' }}>
            <div className="modal-header">
              <h3>{editingVente ? 'Modifier la vente' : 'Nouvelle vente'}</h3>
              <button className="modal-close" onClick={closeModal}>✕</button>
            </div>
            
            <form onSubmit={handleSubmit}>
              <div className="form-grid">
                <div className="form-group">
                  <label>Client *</label>
                  <select
                    name="client_id"
                    value={formData.client_id}
                    onChange={handleInputChange}
                    required
                  >
                    <option value="">Sélectionner un client...</option>
                    {clients.map(client => (
                      <option key={client.id} value={client.id}>
                        {client.type === 'Particulier' 
                          ? `${client.nom} ${client.prenom || ''}`
                          : client.raison_sociale || client.nom}
                        {` (${client.type})`}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Récolte associée (optionnel)</label>
                  <select
                    name="recolte_id"
                    value={formData.recolte_id}
                    onChange={handleInputChange}
                  >
                    <option value="">Aucune récolte spécifique</option>
                    {recoltes
                      .sort((a, b) => new Date(b.date_recolte) - new Date(a.date_recolte))
                      .map(recolte => (
                        <option key={recolte.id} value={recolte.id}>
                          {new Date(recolte.date_recolte).toLocaleDateString('fr-FR')} - 
                          {` ${parseFloat(recolte.poids_grammes).toFixed(0)}g`}
                          {recolte.qualite && ` (${recolte.qualite})`}
                        </option>
                      ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Date de vente *</label>
                  <input
                    type="date"
                    name="date_vente"
                    value={formData.date_vente}
                    onChange={handleInputChange}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Numéro de facture</label>
                  <input
                    type="text"
                    name="numero_facture"
                    value={formData.numero_facture}
                    onChange={handleInputChange}
                    placeholder="Ex: FACT-2025-001"
                  />
                </div>
              </div>

              <h4 style={{ color: '#2c5f2d', marginTop: '1.5rem', marginBottom: '1rem', borderBottom: '2px solid #e0e0e0', paddingBottom: '0.5rem' }}>
                💶 Montant de la vente
              </h4>
              <div className="form-grid">
                <div className="form-group">
                  <label>Quantité (grammes) *</label>
                  <input
                    type="number"
                    name="quantite_grammes"
                    value={formData.quantite_grammes}
                    onChange={handleInputChange}
                    step="0.1"
                    required
                    placeholder="Ex: 250"
                  />
                </div>

                <div className="form-group">
                  <label>Prix unitaire (€/kg) *</label>
                  <input
                    type="number"
                    name="prix_unitaire_kg"
                    value={formData.prix_unitaire_kg}
                    onChange={handleInputChange}
                    step="0.01"
                    required
                    placeholder="Ex: 800.00"
                  />
                </div>

                <div className="form-group">
                  <label>Montant total TTC</label>
                  <input
                    type="text"
                    value={`${montantCalcule()} €`}
                    disabled
                    style={{ background: '#f0f7f0', fontWeight: 'bold', fontSize: '1.1rem', color: '#27ae60' }}
                  />
                </div>
              </div>

              <h4 style={{ color: '#2c5f2d', marginTop: '1.5rem', marginBottom: '1rem', borderBottom: '2px solid #e0e0e0', paddingBottom: '0.5rem' }}>
                💳 Paiement
              </h4>
              <div className="form-grid">
                <div className="form-group">
                  <label>Mode de paiement</label>
                  <select
                    name="mode_paiement"
                    value={formData.mode_paiement}
                    onChange={handleInputChange}
                  >
                    <option value="">Sélectionner...</option>
                    <option value="Espèces">💵 Espèces</option>
                    <option value="Chèque">📝 Chèque</option>
                    <option value="Virement">🏦 Virement bancaire</option>
                    <option value="CB">💳 Carte bancaire</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Statut *</label>
                  <select
                    name="statut"
                    value={formData.statut}
                    onChange={handleInputChange}
                    required
                  >
                    <option value="En attente">En attente</option>
                    <option value="Payée">Payée</option>
                    <option value="Annulée">Annulée</option>
                  </select>
                </div>
              </div>

              <div className="form-group" style={{ marginTop: '1rem' }}>
                <label>Notes</label>
                <textarea
                  name="notes"
                  value={formData.notes}
                  onChange={handleInputChange}
                  placeholder="Remarques sur la vente, conditions particulières..."
                  rows="3"
                />
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={closeModal}>
                  Annuler
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingVente ? 'Mettre à jour' : 'Enregistrer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Ventes;