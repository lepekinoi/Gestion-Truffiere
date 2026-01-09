// ============================================================
// components/ChangePassword.js
// Formulaire de changement de mot de passe
// ============================================================

import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

const ChangePassword = ({ onClose }) => {
  const { changePassword } = useAuth();
  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setError('');
  };

  const toggleShowPassword = (field) => {
    setShowPasswords(prev => ({ ...prev, [field]: !prev[field] }));
  };

  const validatePassword = (password) => {
    const errors = [];
    if (password.length < 8) errors.push('au moins 8 caractères');
    if (!/[a-z]/.test(password)) errors.push('une minuscule');
    if (!/[A-Z]/.test(password)) errors.push('une majuscule');
    if (!/[0-9]/.test(password)) errors.push('un chiffre');
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) errors.push('un caractère spécial');
    return errors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validations
    if (!formData.currentPassword) {
      setError('Veuillez saisir votre mot de passe actuel');
      return;
    }

    if (!formData.newPassword) {
      setError('Veuillez saisir un nouveau mot de passe');
      return;
    }

    const passwordErrors = validatePassword(formData.newPassword);
    if (passwordErrors.length > 0) {
      setError(`Le mot de passe doit contenir : ${passwordErrors.join(', ')}`);
      return;
    }

    if (formData.newPassword !== formData.confirmPassword) {
      setError('Les mots de passe ne correspondent pas');
      return;
    }

    if (formData.currentPassword === formData.newPassword) {
      setError('Le nouveau mot de passe doit être différent de l\'ancien');
      return;
    }

    setLoading(true);

    try {
      await changePassword(formData.currentPassword, formData.newPassword);
      // La fonction changePassword déconnecte automatiquement
      // donc pas besoin de onClose()
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content change-password-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>🔑 Changer le mot de passe</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          <form onSubmit={handleSubmit}>
            {error && <div className="alert alert-error">{error}</div>}

            <div className="form-group">
              <label>Mot de passe actuel</label>
              <div className="password-input-wrapper">
                <input
                  type={showPasswords.current ? 'text' : 'password'}
                  name="currentPassword"
                  value={formData.currentPassword}
                  onChange={handleChange}
                  placeholder="Votre mot de passe actuel"
                  disabled={loading}
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => toggleShowPassword('current')}
                >
                  {showPasswords.current ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            <div className="form-group">
              <label>Nouveau mot de passe</label>
              <div className="password-input-wrapper">
                <input
                  type={showPasswords.new ? 'text' : 'password'}
                  name="newPassword"
                  value={formData.newPassword}
                  onChange={handleChange}
                  placeholder="Nouveau mot de passe"
                  disabled={loading}
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => toggleShowPassword('new')}
                >
                  {showPasswords.new ? '🙈' : '👁️'}
                </button>
              </div>
              <small className="form-help">
                Min. 8 caractères avec majuscule, minuscule, chiffre et caractère spécial
              </small>
            </div>

            <div className="form-group">
              <label>Confirmer le nouveau mot de passe</label>
              <div className="password-input-wrapper">
                <input
                  type={showPasswords.confirm ? 'text' : 'password'}
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  placeholder="Confirmer le mot de passe"
                  disabled={loading}
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => toggleShowPassword('confirm')}
                >
                  {showPasswords.confirm ? '🙈' : '👁️'}
                </button>
              </div>
              {formData.confirmPassword && formData.newPassword !== formData.confirmPassword && (
                <small className="form-error">Les mots de passe ne correspondent pas</small>
              )}
              {formData.confirmPassword && formData.newPassword === formData.confirmPassword && (
                <small className="form-success">✓ Les mots de passe correspondent</small>
              )}
            </div>

            <div className="form-actions">
              <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
                Annuler
              </button>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? 'Modification...' : 'Changer le mot de passe'}
              </button>
            </div>

            <p className="form-note">
              ⚠️ Après le changement, vous serez déconnecté et devrez vous reconnecter avec le nouveau mot de passe.
            </p>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ChangePassword;
