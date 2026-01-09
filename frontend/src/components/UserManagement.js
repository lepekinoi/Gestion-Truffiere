// ============================================================
// components/UserManagement.js
// Gestion des utilisateurs (admin uniquement)
// ============================================================

import React, { useState, useEffect, useCallback } from 'react';
import { authApi } from '../services/api';
import { useAuth } from '../context/AuthContext';

const UserManagement = ({ onClose }) => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // États pour le formulaire
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    nom: '',
    prenom: '',
    role: 'user'
  });

  // États pour reset password
  const [resetPasswordUser, setResetPasswordUser] = useState(null);
  const [newPassword, setNewPassword] = useState('');

  // Charger les utilisateurs
  const loadUsers = useCallback(async () => {
    try {
      setLoading(true);
      const data = await authApi.getUsers();
      setUsers(data);
      setError('');
    } catch (err) {
      setError('Erreur lors du chargement des utilisateurs');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  // Gérer le formulaire
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      if (editingUser) {
        // Mise à jour
        const updateData = { ...formData };
        delete updateData.password; // Ne pas envoyer le mot de passe vide
        await authApi.updateUser(editingUser.id, updateData);
        setSuccess('Utilisateur mis à jour avec succès');
      } else {
        // Création
        if (!formData.password) {
          setError('Le mot de passe est requis pour un nouvel utilisateur');
          return;
        }
        await authApi.createUser(formData);
        setSuccess('Utilisateur créé avec succès');
      }
      
      setShowForm(false);
      setEditingUser(null);
      setFormData({ email: '', password: '', nom: '', prenom: '', role: 'user' });
      loadUsers();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleEdit = (user) => {
    setEditingUser(user);
    setFormData({
      email: user.email,
      password: '',
      nom: user.nom,
      prenom: user.prenom || '',
      role: user.role
    });
    setShowForm(true);
    setError('');
    setSuccess('');
  };

  const handleDelete = async (user) => {
    if (!window.confirm(`Supprimer l'utilisateur ${user.email} ?`)) return;
    
    try {
      await authApi.deleteUser(user.id);
      setSuccess('Utilisateur supprimé');
      loadUsers();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleToggleActive = async (user) => {
    try {
      await authApi.updateUser(user.id, { is_active: !user.is_active });
      setSuccess(`Utilisateur ${user.is_active ? 'désactivé' : 'activé'}`);
      loadUsers();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleUnlock = async (user) => {
    try {
      await authApi.unlockUser(user.id);
      setSuccess('Compte déverrouillé');
      loadUsers();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères');
      return;
    }

    try {
      await authApi.resetUserPassword(resetPasswordUser.id, newPassword);
      setSuccess('Mot de passe réinitialisé');
      setResetPasswordUser(null);
      setNewPassword('');
    } catch (err) {
      setError(err.message);
    }
  };

  const getRoleBadge = (role) => {
    const badges = {
      admin: { bg: '#dc3545', label: 'Admin' },
      user: { bg: '#28a745', label: 'Utilisateur' },
      readonly: { bg: '#6c757d', label: 'Lecture seule' }
    };
    const badge = badges[role] || { bg: '#6c757d', label: role };
    return (
      <span style={{
        background: badge.bg,
        color: 'white',
        padding: '2px 8px',
        borderRadius: '12px',
        fontSize: '12px'
      }}>
        {badge.label}
      </span>
    );
  };

  const formatDate = (date) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content user-management-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>👥 Gestion des utilisateurs</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          {/* Messages */}
          {error && <div className="alert alert-error">{error}</div>}
          {success && <div className="alert alert-success">{success}</div>}

          {/* Bouton Ajouter */}
          {!showForm && !resetPasswordUser && (
            <button 
              className="btn btn-primary"
              onClick={() => {
                setShowForm(true);
                setEditingUser(null);
                setFormData({ email: '', password: '', nom: '', prenom: '', role: 'user' });
                setError('');
                setSuccess('');
              }}
              style={{ marginBottom: '20px' }}
            >
              ➕ Nouvel utilisateur
            </button>
          )}

          {/* Formulaire création/édition */}
          {showForm && (
            <form onSubmit={handleSubmit} className="user-form">
              <h3>{editingUser ? '✏️ Modifier l\'utilisateur' : '➕ Nouvel utilisateur'}</h3>
              
              <div className="form-row">
                <div className="form-group">
                  <label>Email *</label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                {!editingUser && (
                  <div className="form-group">
                    <label>Mot de passe *</label>
                    <input
                      type="password"
                      name="password"
                      value={formData.password}
                      onChange={handleInputChange}
                      placeholder="Min. 8 caractères"
                      required={!editingUser}
                    />
                  </div>
                )}
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Nom *</label>
                  <input
                    type="text"
                    name="nom"
                    value={formData.nom}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Prénom</label>
                  <input
                    type="text"
                    name="prenom"
                    value={formData.prenom}
                    onChange={handleInputChange}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Rôle *</label>
                <select name="role" value={formData.role} onChange={handleInputChange}>
                  <option value="readonly">Lecture seule - Consultation uniquement</option>
                  <option value="user">Utilisateur - Lecture et écriture</option>
                  <option value="admin">Administrateur - Accès complet</option>
                </select>
              </div>

              <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={() => {
                  setShowForm(false);
                  setEditingUser(null);
                }}>
                  Annuler
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingUser ? 'Mettre à jour' : 'Créer'}
                </button>
              </div>
            </form>
          )}

          {/* Formulaire reset password */}
          {resetPasswordUser && (
            <form onSubmit={handleResetPassword} className="user-form">
              <h3>🔑 Réinitialiser le mot de passe</h3>
              <p>Utilisateur : <strong>{resetPasswordUser.email}</strong></p>
              
              <div className="form-group">
                <label>Nouveau mot de passe *</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min. 8 caractères"
                  required
                />
              </div>

              <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={() => {
                  setResetPasswordUser(null);
                  setNewPassword('');
                }}>
                  Annuler
                </button>
                <button type="submit" className="btn btn-primary">
                  Réinitialiser
                </button>
              </div>
            </form>
          )}

          {/* Liste des utilisateurs */}
          {!showForm && !resetPasswordUser && (
            <div className="users-table-container">
              {loading ? (
                <p>Chargement...</p>
              ) : (
                <table className="users-table">
                  <thead>
                    <tr>
                      <th>Utilisateur</th>
                      <th>Rôle</th>
                      <th>Statut</th>
                      <th>Dernière connexion</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(user => (
                      <tr key={user.id} className={!user.is_active ? 'inactive' : ''}>
                        <td>
                          <div className="user-cell">
                            <strong>{user.prenom} {user.nom}</strong>
                            <span className="user-email">{user.email}</span>
                          </div>
                        </td>
                        <td>{getRoleBadge(user.role)}</td>
                        <td>
                          {user.is_active ? (
                            <span className="status-badge active">Actif</span>
                          ) : (
                            <span className="status-badge inactive">Inactif</span>
                          )}
                          {user.locked_until && new Date(user.locked_until) > new Date() && (
                            <span className="status-badge locked">🔒 Verrouillé</span>
                          )}
                        </td>
                        <td>{formatDate(user.last_login)}</td>
                        <td className="actions-cell">
                          <button 
                            className="btn-icon" 
                            title="Modifier"
                            onClick={() => handleEdit(user)}
                          >
                            ✏️
                          </button>
                          <button 
                            className="btn-icon" 
                            title="Réinitialiser le mot de passe"
                            onClick={() => {
                              setResetPasswordUser(user);
                              setError('');
                              setSuccess('');
                            }}
                          >
                            🔑
                          </button>
                          <button 
                            className="btn-icon" 
                            title={user.is_active ? 'Désactiver' : 'Activer'}
                            onClick={() => handleToggleActive(user)}
                            disabled={user.id === currentUser.id}
                          >
                            {user.is_active ? '🚫' : '✅'}
                          </button>
                          {user.locked_until && new Date(user.locked_until) > new Date() && (
                            <button 
                              className="btn-icon" 
                              title="Déverrouiller"
                              onClick={() => handleUnlock(user)}
                            >
                              🔓
                            </button>
                          )}
                          <button 
                            className="btn-icon danger" 
                            title="Supprimer"
                            onClick={() => handleDelete(user)}
                            disabled={user.id === currentUser.id}
                          >
                            🗑️
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserManagement;
