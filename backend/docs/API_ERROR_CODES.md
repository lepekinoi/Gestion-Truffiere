# 📚 Codes d'Erreur API - Référence Complète

> **Version 2.0.1** - Dernière mise à jour : 28 janvier 2026

Ce document liste tous les codes d'erreur utilisés dans l'API Truffière, leurs significations et les actions recommandées.

---

## 📖 Table des Matières

- [Format des Erreurs](#format-des-erreurs)
- [Codes d'Authentification (401, 403, 423)](#codes-dauthentification)
- [Codes de Validation (400)](#codes-de-validation)
- [Codes Métier (404, 409)](#codes-métier)
- [Codes Système (500)](#codes-système)
- [Codes Spécifiques par Module](#codes-spécifiques-par-module)

---

## Format des Erreurs

### Structure Standard

Toutes les erreurs suivent ce format JSON :

```json
{
  "error": "Message lisible par l'utilisateur",
  "code": "ERROR_CODE_EXPLICITE",
  "details": "Détails techniques (uniquement en développement)"
}
```

### Exemple

```json
{
  "error": "Email ou mot de passe incorrect",
  "code": "INVALID_CREDENTIALS",
  "details": "Password hash mismatch for user@example.com"
}
```

---

## Codes d'Authentification

### 401 - Non Authentifié

| Code | Description | Action |
|------|-------------|--------|
| `NO_TOKEN` | Aucun token d'authentification fourni | Ajouter header `Authorization: Bearer <token>` |
| `INVALID_FORMAT` | Format du token invalide | Utiliser format `Bearer <token>` |
| `TOKEN_EXPIRED` | Token d'accès expiré | Rafraîchir avec le refresh token |
| `INVALID_TOKEN` | Token invalide ou corrompu | Se reconnecter |
| `INVALID_CREDENTIALS` | Email ou mot de passe incorrect | Vérifier les identifiants |
| `INVALID_CURRENT_PASSWORD` | Mot de passe actuel incorrect | Vérifier le mot de passe |
| `INVALID_REFRESH_TOKEN` | Refresh token invalide ou expiré | Se reconnecter |
| `TOKEN_REUSE_DETECTED` | Réutilisation de token détectée | Toutes les sessions révoquées - se reconnecter |
| `MAX_ROTATION_EXCEEDED` | Trop de rotations de token | Se reconnecter |

### 403 - Accès Refusé

| Code | Description | Action |
|------|-------------|--------|
| `FORBIDDEN` | Accès non autorisé pour ce rôle | Contacter un administrateur |
| `READONLY` | Compte en lecture seule | Demander les droits d'écriture |
| `ACCOUNT_DISABLED` | Compte désactivé | Contacter un administrateur |
| `CORS_ERROR` | Origine non autorisée | Configurer CORS_ORIGINS |

### 423 - Compte Verrouillé

| Code | Description | Action |
|------|-------------|--------|
| `ACCOUNT_LOCKED` | Compte temporairement verrouillé (5 tentatives échouées) | Attendre 15 minutes ou contacter admin |

---

## Codes de Validation

### 400 - Requête Invalide

#### Généraux

| Code | Description | Action |
|------|-------------|--------|
| `MISSING_CREDENTIALS` | Email et/ou mot de passe manquants | Fournir email et password |
| `MISSING_FIELDS` | Champs requis manquants | Vérifier les champs obligatoires |
| `MISSING_TOKEN` | Refresh token requis | Fournir refreshToken |
| `NO_DATA` | Aucune donnée à mettre à jour | Fournir au moins un champ |
| `INVALID_PASSWORD` | Mot de passe invalide (< 8 caractères) | Utiliser 8+ caractères |
| `CANNOT_DELETE_SELF` | Impossible de supprimer son propre compte | Demander à un autre admin |

#### Champs Spécifiques

| Code | Description | Action |
|------|-------------|--------|
| `PARCELLE_ID_REQUIRED` | ID de parcelle requis | Fournir parcelle_id |
| `ARBRE_ID_REQUIRED` | ID d'arbre requis | Fournir arbre_id |
| `CLIENT_ID_REQUIRED` | ID de client requis | Fournir client_id |
| `DATE_REQUIRED` | Date requise | Fournir une date valide |
| `QUANTITE_REQUIRED` | Quantité requise | Fournir une quantité |
| `TYPE_INTERVENTION_REQUIRED` | Type d'intervention requis | Fournir type_intervention_id |
| `INVALID_DATE_FORMAT` | Format de date invalide | Utiliser format ISO 8601 |
| `INVALID_NUMBER` | Nombre invalide | Fournir un nombre valide |
| `NEGATIVE_VALUE` | Valeur négative non autorisée | Utiliser valeur >= 0 |

---

## Codes Métier

### 404 - Non Trouvé

| Code | Description | Action |
|------|-------------|--------|
| `NOT_FOUND` | Route non trouvée | Vérifier l'URL |
| `USER_NOT_FOUND` | Utilisateur non trouvé | Vérifier l'ID utilisateur |
| `PARCELLE_NOT_FOUND` | Parcelle non trouvée | Vérifier l'ID parcelle |
| `ARBRE_NOT_FOUND` | Arbre non trouvé | Vérifier l'ID arbre |
| `CLIENT_NOT_FOUND` | Client non trouvé | Vérifier l'ID client |
| `VENTE_NOT_FOUND` | Vente non trouvée | Vérifier l'ID vente |
| `COMMANDE_NOT_FOUND` | Commande non trouvée | Vérifier l'ID commande |
| `INTERVENTION_NOT_FOUND` | Intervention non trouvée | Vérifier l'ID intervention |
| `RECOLTE_NOT_FOUND` | Récolte non trouvée | Vérifier l'ID récolte |
| `SESSION_NOT_FOUND` | Session non trouvée | Vérifier l'ID session |
| `PRODUIT_NOT_FOUND` | Produit phyto non trouvé | Vérifier l'ID produit |
| `AMENDEMENT_NOT_FOUND` | Amendement non trouvé | Vérifier l'ID amendement |
| `CAVEUR_NOT_FOUND` | Caveur non trouvé | Vérifier l'ID caveur |
| `CHIEN_NOT_FOUND` | Chien non trouvé | Vérifier l'ID chien |

### 409 - Conflit

| Code | Description | Action |
|------|-------------|--------|
| `EMAIL_EXISTS` | Email déjà utilisé | Utiliser un autre email |
| `UNIQUE_VIOLATION` | Violation de contrainte d'unicité | Modifier les données en doublon |
| `ARBRE_HAS_RECOLTES` | Arbre possède des récoltes | Supprimer les récoltes d'abord |
| `PARCELLE_HAS_ARBRES` | Parcelle possède des arbres | Supprimer/déplacer les arbres |
| `CLIENT_HAS_VENTES` | Client possède des ventes | Ne pas supprimer ou archiver |

---

## Codes Système

### 500 - Erreur Serveur

| Code | Description | Action |
|------|-------------|--------|
| `INTERNAL_ERROR` | Erreur interne générique | Consulter les logs serveur |
| `LOGIN_ERROR` | Erreur lors de la connexion | Réessayer ou contacter support |
| `REFRESH_ERROR` | Erreur lors du rafraîchissement | Se reconnecter |
| `LOGOUT_ERROR` | Erreur lors de la déconnexion | Vérifier le refresh token |
| `LOGOUT_ALL_ERROR` | Erreur déconnexion globale | Réessayer |
| `PROFILE_ERROR` | Erreur récupération profil | Réessayer |
| `REGISTER_ERROR` | Erreur création utilisateur | Vérifier les logs |
| `UPDATE_USER_ERROR` | Erreur mise à jour utilisateur | Vérifier les données |
| `DELETE_USER_ERROR` | Erreur suppression utilisateur | Vérifier les dépendances |
| `CHANGE_PASSWORD_ERROR` | Erreur changement mot de passe | Réessayer |
| `RESET_PASSWORD_ERROR` | Erreur reset mot de passe | Vérifier l'utilisateur |
| `UNLOCK_ERROR` | Erreur déverrouillage compte | Réessayer |
| `GET_SESSIONS_ERROR` | Erreur récupération sessions | Réessayer |
| `REVOKE_SESSION_ERROR` | Erreur révocation session | Vérifier l'ID session |
| `DATABASE_ERROR` | Erreur base de données | Consulter les logs PostgreSQL |

### 429 - Trop de Requêtes

| Code | Description | Action |
|------|-------------|--------|
| `RATE_LIMIT` | Limite globale atteinte (1000 req/15min) | Attendre 15 minutes |
| `AUTH_RATE_LIMIT` | Limite auth atteinte (10 req/15min) | Attendre 15 minutes |

---

## Codes Spécifiques par Module

### Module Parcelles

| Code | Description | HTTP |
|------|-------------|------|
| `PARCELLE_CREATED` | Parcelle créée avec succès | 201 |
| `PARCELLE_UPDATED` | Parcelle mise à jour | 200 |
| `PARCELLE_DELETED` | Parcelle supprimée | 200 |
| `PARCELLE_RESTORED` | Parcelle restaurée de la corbeille | 200 |
| `CREATE_PARCELLE_ERROR` | Erreur création | 500 |
| `UPDATE_PARCELLE_ERROR` | Erreur mise à jour | 500 |
| `DELETE_PARCELLE_ERROR` | Erreur suppression | 500 |

### Module Arbres

| Code | Description | HTTP |
|------|-------------|------|
| `ARBRE_CREATED` | Arbre créé avec succès | 201 |
| `ARBRE_UPDATED` | Arbre mis à jour | 200 |
| `ARBRE_DELETED` | Arbre supprimé (corbeille) | 200 |
| `ARBRE_RESTORED` | Arbre restauré | 200 |
| `ARBRE_PERMANENTLY_DELETED` | Arbre supprimé définitivement | 200 |
| `CREATE_ARBRE_ERROR` | Erreur création | 500 |
| `UPDATE_ARBRE_ERROR` | Erreur mise à jour | 500 |
| `DELETE_ARBRE_ERROR` | Erreur suppression | 500 |

### Module Interventions

| Code | Description | HTTP |
|------|-------------|------|
| `INTERVENTION_CREATED` | Intervention créée | 201 |
| `INTERVENTION_UPDATED` | Intervention mise à jour | 200 |
| `INTERVENTION_DELETED` | Intervention supprimée | 200 |
| `INTERVENTION_COMPLETED` | Intervention marquée terminée | 200 |
| `CREATE_INTERVENTION_ERROR` | Erreur création | 500 |
| `UPDATE_INTERVENTION_ERROR` | Erreur mise à jour | 500 |

### Module Récoltes

| Code | Description | HTTP |
|------|-------------|------|
| `RECOLTE_CREATED` | Récolte enregistrée | 201 |
| `RECOLTE_UPDATED` | Récolte mise à jour | 200 |
| `RECOLTE_DELETED` | Récolte supprimée | 200 |
| `INSUFFICIENT_STOCK` | Stock insuffisant | 400 |
| `CREATE_RECOLTE_ERROR` | Erreur création | 500 |

### Module Ventes

| Code | Description | HTTP |
|------|-------------|------|
| `VENTE_CREATED` | Vente créée | 201 |
| `VENTE_UPDATED` | Vente mise à jour | 200 |
| `VENTE_DELETED` | Vente supprimée | 200 |
| `CREATE_VENTE_ERROR` | Erreur création | 500 |
| `FACTURE_ERROR` | Erreur génération facture | 500 |

### Module Commandes

| Code | Description | HTTP |
|------|-------------|------|
| `COMMANDE_CREATED` | Commande créée | 201 |
| `COMMANDE_UPDATED` | Commande mise à jour | 200 |
| `COMMANDE_DELETED` | Commande supprimée | 200 |
| `CREATE_COMMANDE_ERROR` | Erreur création | 500 |

### Module Clients

| Code | Description | HTTP |
|------|-------------|------|
| `CLIENT_CREATED` | Client créé | 201 |
| `CLIENT_UPDATED` | Client mis à jour | 200 |
| `CLIENT_DELETED` | Client supprimé | 200 |
| `CREATE_CLIENT_ERROR` | Erreur création | 500 |

---

## 💡 Bonnes Pratiques

### Pour les Développeurs Frontend

1. **Toujours vérifier le code d'erreur**, pas seulement le message
```javascript
if (error.code === 'ACCOUNT_LOCKED') {
  showLockMessage(error.lockedUntil);
} else if (error.code === 'INVALID_CREDENTIALS') {
  showInvalidCredentials();
}
```

2. **Gérer les erreurs réseau séparément**
```javascript
try {
  const response = await api.login(credentials);
} catch (error) {
  if (!error.response) {
    // Erreur réseau
    showNetworkError();
  } else {
    // Erreur API avec code
    handleApiError(error.response.data.code);
  }
}
```

3. **Afficher les détails uniquement en développement**
```javascript
if (import.meta.env.DEV && error.details) {
  console.error('API Error Details:', error.details);
}
```

### Pour les Développeurs Backend

1. **Toujours inclure un code d'erreur**
```javascript
return res.status(400).json({
  error: 'Message utilisateur',
  code: 'ERROR_CODE',
  details: process.env.NODE_ENV === 'development' ? err.message : undefined
});
```

2. **Utiliser les codes existants** (ne pas en inventer de nouveaux sans documentation)

3. **Logger les erreurs côté serveur**
```javascript
console.error('Erreur:', { code: 'ERROR_CODE', user: req.user?.id, path: req.path });
```

---

## 📞 Support

En cas de problème avec un code d'erreur :

1. Consulter cette documentation
2. Vérifier les logs serveur (`logs/app.log`)
3. Consulter l'audit trail (`SELECT * FROM audit_trail ORDER BY timestamp DESC LIMIT 50`)
4. Contacter l'équipe de développement

---

## 📝 Historique

- **v2.0.1** (28 jan 2026) - Documentation complète après refactoring
- **v2.0.0** (jan 2026) - Standardisation des codes d'erreur
- **v1.x** - Codes d'erreur partiels
