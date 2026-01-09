import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

function Clients() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [filterType, setFilterType] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({
    type: 'Particulier',
    nom: '',
    prenom: '',
    raison_sociale: '',
    email: '',
    telephone: '',
    adresse: '',
    code_postal: '',
    ville: '',
    pays: 'France',
    siret: '',
    notes: ''
  });

  useEffect(() => {
    loadClients();
  }, []);

  const loadClients = async () => {
    try {
      const response = await axios.get(`${API_URL}/clients`);
      setClients(response.data);
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
      
      // Nettoyer les champs selon le type
      if (dataToSend.type === 'Particulier') {
        dataToSend.raison_sociale = null;
        dataToSend.siret = null;
      } else {
        dataToSend.prenom = null;
      }

      if (editingClient) {
        await axios.put(`${API_URL}/clients/${editingClient.id}`, dataToSend);
      } else {
        await axios.post(`${API_URL}/clients`, dataToSend);
      }
      loadClients();
      closeModal();
    } catch (error) {
      console.error('Erreur lors de la sauvegarde:', error);
      alert('Erreur lors de la sauvegarde du client');
    }
  };

  const handleEdit = (client) => {
    setEditingClient(client);
    setFormData({
      type: client.type || 'Particulier',
      nom: client.nom || '',
      prenom: client.prenom || '',
      raison_sociale: client.raison_sociale || '',
      email: client.email || '',
      telephone: client.telephone || '',
      adresse: client.adresse || '',
      code_postal: client.code_postal || '',
      ville: client.ville || '',
      pays: client.pays || 'France',
      siret: client.siret || '',
      notes: client.notes || ''
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer ce client ?')) {
      try {
        await axios.delete(`${API_URL}/clients/${id}`);
        loadClients();
      } catch (error) {
        console.error('Erreur lors de la suppression:', error);
        alert('Erreur lors de la suppression du client');
      }
    }
  };

  const openNewModal = () => {
    setEditingClient(null);
    setFormData({
      type: 'Particulier',
      nom: '',
      prenom: '',
      raison_sociale: '',
      email: '',
      telephone: '',
      adresse: '',
      code_postal: '',
      ville: '',
      pays: 'France',
      siret: '',
      notes: ''
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingClient(null);
  };

  const getTypeBadgeStyle = (type) => {
    const styles = {
      'Particulier': { background: '#e3f2fd', color: '#1565c0' },
      'Restaurant': { background: '#fff3e0', color: '#e65100' },
      'Grossiste': { background: '#f3e5f5', color: '#7b1fa2' }
    };
    return styles[type] || styles['Particulier'];
  };

  // Filtrage et recherche
  const filteredClients = clients.filter(client => {
    const matchType = filterType === 'all' || client.type === filterType;
    const searchLower = searchTerm.toLowerCase();
    const matchSearch = searchTerm === '' || 
      (client.nom && client.nom.toLowerCase().includes(searchLower)) ||
      (client.prenom && client.prenom.toLowerCase().includes(searchLower)) ||
      (client.raison_sociale && client.raison_sociale.toLowerCase().includes(searchLower)) ||
      (client.email && client.email.toLowerCase().includes(searchLower)) ||
      (client.ville && client.ville.toLowerCase().includes(searchLower));
    
    return matchType && matchSearch;
  });

  // Statistiques
  const stats = {
    total: clients.length,
    particuliers: clients.filter(c => c.type === 'Particulier').length,
    restaurants: clients.filter(c => c.type === 'Restaurant').length,
    grossistes: clients.filter(c => c.type === 'Grossiste').length
  };

  if (loading) {
    return <div className="loading">Chargement des clients...</div>;
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h2>👥 Gestion des clients</h2>
        <button className="btn btn-primary" onClick={openNewModal}>
          ➕ Nouveau client
        </button>
      </div>

      {/* Statistiques */}
      <div className="card-grid" style={{ marginBottom: '2rem', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
        <div className="card">
          <div className="card-title">Total clients</div>
          <div className="card-value">{stats.total}</div>
        </div>
        <div className="card">
          <div className="card-title">Particuliers</div>
          <div className="card-value" style={{ color: '#1565c0' }}>{stats.particuliers}</div>
        </div>
        <div className="card">
          <div className="card-title">Restaurants</div>
          <div className="card-value" style={{ color: '#e65100' }}>{stats.restaurants}</div>
        </div>
        <div className="card">
          <div className="card-title">Grossistes</div>
          <div className="card-value" style={{ color: '#7b1fa2' }}>{stats.grossistes}</div>
        </div>
      </div>

      {/* Filtres et recherche */}
      <div style={{ marginBottom: '1rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button 
            className={`btn ${filterType === 'all' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFilterType('all')}
            style={{ padding: '0.5rem 1rem' }}
          >
            Tous
          </button>
          <button 
            className={`btn ${filterType === 'Particulier' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFilterType('Particulier')}
            style={{ padding: '0.5rem 1rem' }}
          >
            Particuliers
          </button>
          <button 
            className={`btn ${filterType === 'Restaurant' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFilterType('Restaurant')}
            style={{ padding: '0.5rem 1rem' }}
          >
            Restaurants
          </button>
          <button 
            className={`btn ${filterType === 'Grossiste' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFilterType('Grossiste')}
            style={{ padding: '0.5rem 1rem' }}
          >
            Grossistes
          </button>
        </div>
        
        <input
          type="text"
          placeholder="🔍 Rechercher (nom, email, ville...)"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            flex: 1,
            minWidth: '250px',
            padding: '0.6rem 1rem',
            border: '2px solid #e0e0e0',
            borderRadius: '8px',
            fontSize: '1rem'
          }}
        />
      </div>

      {filteredClients.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">👥</div>
          <p>
            {searchTerm || filterType !== 'all' 
              ? 'Aucun client ne correspond à votre recherche' 
              : 'Aucun client enregistré'}
          </p>
          {!searchTerm && filterType === 'all' && (
            <button className="btn btn-primary" onClick={openNewModal} style={{ marginTop: '1rem' }}>
              Ajouter mon premier client
            </button>
          )}
        </div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Type</th>
              <th>Nom / Raison sociale</th>
              <th>Contact</th>
              <th>Téléphone</th>
              <th>Ville</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredClients.map(client => (
              <tr key={client.id}>
                <td>
                  <span style={{
                    padding: '0.25rem 0.75rem',
                    borderRadius: '12px',
                    fontSize: '0.85rem',
                    fontWeight: '500',
                    ...getTypeBadgeStyle(client.type)
                  }}>
                    {client.type}
                  </span>
                </td>
                <td>
                  <strong>
                    {client.type === 'Particulier' 
                      ? `${client.nom} ${client.prenom || ''}`
                      : client.raison_sociale || client.nom}
                  </strong>
                  {client.siret && (
                    <div style={{ fontSize: '0.85rem', color: '#666' }}>
                      SIRET: {client.siret}
                    </div>
                  )}
                </td>
                <td>{client.email || '-'}</td>
                <td>{client.telephone || '-'}</td>
                <td>
                  {client.ville && (
                    <>
                      {client.code_postal && `${client.code_postal} `}
                      {client.ville}
                    </>
                  )}
                  {!client.ville && '-'}
                </td>
                <td>
                  <button 
                    className="btn btn-secondary" 
                    onClick={() => handleEdit(client)}
                    style={{ marginRight: '0.5rem', padding: '0.4rem 0.8rem' }}
                  >
                    ✏️
                  </button>
                  <button 
                    className="btn btn-danger" 
                    onClick={() => handleDelete(client.id)}
                    style={{ padding: '0.4rem 0.8rem' }}
                  >
                    🗑️
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Modal de création/édition */}
      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '700px' }}>
            <div className="modal-header">
              <h3>{editingClient ? 'Modifier le client' : 'Nouveau client'}</h3>
              <button className="modal-close" onClick={closeModal}>✕</button>
            </div>
            
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Type de client *</label>
                <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                  {['Particulier', 'Restaurant', 'Grossiste'].map(type => (
                    <label key={type} style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                      <input
                        type="radio"
                        name="type"
                        value={type}
                        checked={formData.type === type}
                        onChange={handleInputChange}
                        style={{ marginRight: '0.5rem' }}
                      />
                      <span>{type}</span>
                    </label>
                  ))}
                </div>
              </div>

              {formData.type === 'Particulier' ? (
                <div className="form-grid">
                  <div className="form-group">
                    <label>Nom *</label>
                    <input
                      type="text"
                      name="nom"
                      value={formData.nom}
                      onChange={handleInputChange}
                      required
                      placeholder="Nom de famille"
                    />
                  </div>

                  <div className="form-group">
                    <label>Prénom</label>
                    <input
                      type="text"
                      name="prenom"
                      value={formData.prenom}
                      onChange={handleInputChange}
                      placeholder="Prénom"
                    />
                  </div>
                </div>
              ) : (
                <div className="form-grid">
                  <div className="form-group">
                    <label>Raison sociale *</label>
                    <input
                      type="text"
                      name="raison_sociale"
                      value={formData.raison_sociale}
                      onChange={handleInputChange}
                      required
                      placeholder="Nom de l'entreprise"
                    />
                  </div>

                  <div className="form-group">
                    <label>Contact (nom)</label>
                    <input
                      type="text"
                      name="nom"
                      value={formData.nom}
                      onChange={handleInputChange}
                      placeholder="Nom du contact"
                    />
                  </div>

                  <div className="form-group">
                    <label>SIRET</label>
                    <input
                      type="text"
                      name="siret"
                      value={formData.siret}
                      onChange={handleInputChange}
                      placeholder="14 chiffres"
                      maxLength="14"
                    />
                  </div>
                </div>
              )}

              <h4 style={{ color: '#2c5f2d', marginTop: '1.5rem', marginBottom: '1rem', borderBottom: '2px solid #e0e0e0', paddingBottom: '0.5rem' }}>
                📞 Coordonnées
              </h4>
              <div className="form-grid">
                <div className="form-group">
                  <label>Email</label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    placeholder="email@exemple.fr"
                  />
                </div>

                <div className="form-group">
                  <label>Téléphone</label>
                  <input
                    type="tel"
                    name="telephone"
                    value={formData.telephone}
                    onChange={handleInputChange}
                    placeholder="06 12 34 56 78"
                  />
                </div>
              </div>

              <h4 style={{ color: '#2c5f2d', marginTop: '1.5rem', marginBottom: '1rem', borderBottom: '2px solid #e0e0e0', paddingBottom: '0.5rem' }}>
                📍 Adresse
              </h4>
              <div className="form-group">
                <label>Adresse</label>
                <input
                  type="text"
                  name="adresse"
                  value={formData.adresse}
                  onChange={handleInputChange}
                  placeholder="Numéro et nom de rue"
                />
              </div>

              <div className="form-grid">
                <div className="form-group">
                  <label>Code postal</label>
                  <input
                    type="text"
                    name="code_postal"
                    value={formData.code_postal}
                    onChange={handleInputChange}
                    placeholder="85140"
                    maxLength="5"
                  />
                </div>

                <div className="form-group">
                  <label>Ville</label>
                  <input
                    type="text"
                    name="ville"
                    value={formData.ville}
                    onChange={handleInputChange}
                    placeholder="Ville"
                  />
                </div>

                <div className="form-group">
                  <label>Pays</label>
                  <input
                    type="text"
                    name="pays"
                    value={formData.pays}
                    onChange={handleInputChange}
                    placeholder="France"
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginTop: '1rem' }}>
                <label>Notes</label>
                <textarea
                  name="notes"
                  value={formData.notes}
                  onChange={handleInputChange}
                  placeholder="Préférences, remarques, historique..."
                  rows="3"
                />
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={closeModal}>
                  Annuler
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingClient ? 'Mettre à jour' : 'Créer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Clients;