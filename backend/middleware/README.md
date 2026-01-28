# 🛡️ Middlewares - API Truffière

Ce dossier contient tous les middlewares de l'application, organisés par catégorie.

## 📁 Structure

```
middleware/
├── auth.js              # Authentification JWT & rôles
├── validation.js       # Validation des entrées (express-validator)
├── error.middleware.js # Gestion centralisée des erreurs
├── index.js            # Export centralisé
└── README.md           # Cette documentation
```

---

## 🔐 Authentification (`auth.js`)

### Middlewares disponibles

#### 1. `authMiddleware`
Vérifie la présence et la validité du token JWT.

```javascript
const { authMiddleware } = require('./middleware');

router.get('/protected', authMiddleware, (req, res) => {
  console.log(req.user); // { id, email, role, nom }
  res.json({ message: 'Accès autorisé' });
});
```

**Réponses :**
- `401` : Token absent, expiré ou invalide
- `200` : Token valide, `req.user` rempli

---

#### 2. `roleMiddleware(...roles)`
Vérifie que l'utilisateur a l'un des rôles autorisés.

```javascript
const { authMiddleware, roleMiddleware } = require('./middleware');

// Admin seulement
router.delete('/users/:id', 
  authMiddleware, 
  roleMiddleware('admin'), 
  deleteUser
);

// User ou Admin
router.post('/data', 
  authMiddleware, 
  roleMiddleware('user', 'admin'), 
  createData
);
```

**Raccourcis disponibles :**
```javascript
const { adminOnly, userOrAdmin, allRoles } = require('./middleware');

router.delete('/sensitive', authMiddleware, adminOnly, handler);
router.post('/data', authMiddleware, userOrAdmin, handler);
router.get('/public', authMiddleware, allRoles, handler);
```

---

#### 3. `requireWriteAccess`
**NOUVEAU** : Bloque les utilisateurs en lecture seule (`role: 'readonly'`).

```javascript
const { authMiddleware, requireWriteAccess } = require('./middleware');

// Lecture seule autorisée
router.get('/parcelles', authMiddleware, listParcelles);

// Écriture refusée pour readonly
router.post('/parcelles', 
  authMiddleware, 
  requireWriteAccess, 
  createParcelle
);
```

**Réponse si readonly :**
```json
{
  "error": "Accès en lecture seule - Modification interdite",
  "code": "READONLY_ACCESS"
}
```

---

#### 4. `optionalAuth`
Auth optionnelle : n'échoue pas si pas de token, mais remplit `req.user` si valide.

```javascript
const { optionalAuth } = require('./middleware');

router.get('/stats', optionalAuth, (req, res) => {
  if (req.user) {
    // Utilisateur authentifié : stats détaillées
    return res.json(getDetailedStats(req.user));
  }
  // Non authentifié : stats publiques
  res.json(getPublicStats());
});
```

---

#### 5. `activeUserMiddleware(pool)`
Vérifie en base de données que l'utilisateur est actif et non verrouillé.

```javascript
const { authMiddleware, activeUserMiddleware } = require('./middleware');
const { pool } = require('../config/database');

router.post('/critical-action', 
  authMiddleware, 
  activeUserMiddleware(pool), 
  handler
);
```

**Vérifie :**
- `is_active = true`
- `locked_until` n'est pas dans le futur

---

## ✅ Validation (`validation.js`)

Utilise **express-validator** pour valider les entrées.

### Validations disponibles

#### 1. `loginValidation`
Validation du login (email + password).

```javascript
const { loginValidation } = require('./middleware');

router.post('/auth/login', loginValidation, loginController);
```

**Champs validés :**
- `email` : format email, max 255 caractères
- `password` : requis, min 1 caractère

---

#### 2. `registerValidation`
Validation inscription (email, password fort, nom, prénom).

```javascript
const { registerValidation } = require('./middleware');

router.post('/auth/register', registerValidation, registerController);
```

**Champs validés :**
- `email` : format email
- `password` : min 8 chars, 1 maj, 1 min, 1 chiffre, 1 caractère spécial
- `nom` : 2-100 chars, lettres uniquement
- `prenom` : optionnel, max 100 chars
- `role` : optionnel, enum `['admin', 'user', 'readonly']`

---

#### 3. `changePasswordValidation`
Validation changement de mot de passe.

```javascript
const { changePasswordValidation } = require('./middleware');

router.post('/auth/change-password', changePasswordValidation, handler);
```

**Champs validés :**
- `currentPassword` : requis
- `newPassword` : mêmes règles que register + différent de l'ancien
- `confirmPassword` : doit correspondre à `newPassword`

---

#### 4. Autres validations

```javascript
const {
  updateUserValidation,      // Mise à jour utilisateur
  resetPasswordValidation,   // Réinitialisation avec token
  forgotPasswordValidation,  // Demande de réinitialisation
  refreshTokenValidation     // Refresh token
} = require('./middleware');
```

---

## ❌ Gestion d'erreurs (`error.middleware.js`)

### Middlewares disponibles

#### 1. `notFoundHandler`
Capture toutes les routes non définies (404).

```javascript
const { notFoundHandler } = require('./middleware');

// À placer AVANT errorHandler
app.use(notFoundHandler);
```

**Réponse :**
```json
{
  "error": "Route non trouvée",
  "code": "NOT_FOUND",
  "path": "/api/inexistant",
  "method": "GET"
}
```

---

#### 2. `errorHandler`
Gestionnaire d'erreurs global. **Doit être le dernier middleware.**

```javascript
const { errorHandler } = require('./middleware');

// À la fin de server.js
app.use(errorHandler);
```

**Fonctionnalités :**
- Log détaillé (timestamp, user, IP, stack)
- Réponse adaptée (dev vs prod)
- Gestion des codes de statut

**Réponse en dev :**
```json
{
  "error": "Erreur interne",
  "code": "INTERNAL_ERROR",
  "stack": "Error: ...",
  "timestamp": "2026-01-28T20:00:00.000Z"
}
```

**Réponse en prod :**
```json
{
  "error": "Erreur interne",
  "code": "INTERNAL_ERROR",
  "timestamp": "2026-01-28T20:00:00.000Z"
}
```

---

#### 3. `postgresErrorHandler`
Traduit les codes d'erreur PostgreSQL en messages clairs.

```javascript
const { postgresErrorHandler, errorHandler } = require('./middleware');

// À placer AVANT errorHandler
app.use(postgresErrorHandler);
app.use(errorHandler);
```

**Erreurs gérées :**
- `23505` : Violation d'unicité (UNIQUE)
- `23503` : Violation de clé étrangère (FOREIGN KEY)
- `23502` : Champ NULL non autorisé (NOT NULL)
- `23514` : Violation de contrainte CHECK
- `42601` : Erreur de syntaxe SQL
- `42703` : Colonne inconnue
- `42P01` : Table inconnue

---

#### 4. `corsErrorHandler`
Gestion spécifique des erreurs CORS.

```javascript
const { corsErrorHandler } = require('./middleware');

app.use(corsErrorHandler);
```

---

#### 5. `asyncHandler(fn)`
Wrapper pour routes async (supprime les try/catch répétitifs).

```javascript
const { asyncHandler } = require('./middleware');

router.get('/data', asyncHandler(async (req, res) => {
  const data = await fetchData(); // Pas de try/catch nécessaire
  res.json(data);
}));
```

---

#### 6. `createError(message, statusCode, code)`
Factory pour créer des erreurs enrichies.

```javascript
const { createError } = require('./middleware');

if (!user) {
  throw createError('Utilisateur non trouvé', 404, 'USER_NOT_FOUND');
}
```

---

## 🔧 Usage dans `server.js`

### Avant refactoring (server.js : 1240 lignes)

```javascript
// 50 lignes de middlewares + 40 lignes de fonctions utilitaires
const authMiddleware = (req, res, next) => { /* ... */ };
const roleMiddleware = (...roles) => { /* ... */ };
// etc.
```

### Après refactoring (server.js : ~206 lignes)

```javascript
const express = require('express');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const config = require('./config');
const {
  authMiddleware,
  requireRole,
  requireWriteAccess,
  notFoundHandler,
  errorHandler,
  postgresErrorHandler,
  corsErrorHandler
} = require('./middleware');

const app = express();

// Middlewares globaux
app.use(config.helmetConfig);
app.use(config.cors());
app.use(express.json());
app.use(cookieParser());
app.use(morgan('dev'));

// Routes publiques
app.get('/health', (req, res) => res.json({ status: 'OK' }));

// Routes protégées
app.use('/api', authMiddleware);
app.use('/api/parcelles', requireWriteAccess, parcellesRoutes);

// Gestion d'erreurs (ORDRE IMPORTANT)
app.use(notFoundHandler);
app.use(corsErrorHandler);
app.use(postgresErrorHandler);
app.use(errorHandler); // Toujours en dernier
```

---

## 🛡️ Sécurité - Best Practices

### 1. Toujours utiliser `authMiddleware` en premier
```javascript
// ❌ MAUVAIS
router.post('/data', requireWriteAccess, handler);

// ✅ BON
router.post('/data', authMiddleware, requireWriteAccess, handler);
```

### 2. Vérifier les rôles après l'authentification
```javascript
// ✅ BON
router.delete('/users/:id', 
  authMiddleware,    // 1. Vérifie le token
  adminOnly,          // 2. Vérifie le rôle
  deleteUser
);
```

### 3. Ordre des middlewares d'erreur
```javascript
// ✅ BON ORDRE
app.use(notFoundHandler);        // 1. Routes inexistantes
app.use(corsErrorHandler);       // 2. Erreurs CORS
app.use(postgresErrorHandler);   // 3. Erreurs DB
app.use(errorHandler);           // 4. Erreurs générales (dernier)
```

### 4. Utiliser `activeUserMiddleware` pour actions critiques
```javascript
router.delete('/critical', 
  authMiddleware,
  activeUserMiddleware(pool), // Vérifie compte actif en DB
  adminOnly,
  handler
);
```

---

## 📄 Référence rapide

| Middleware | Usage | Rôle |
|------------|-------|------|
| `authMiddleware` | Toutes routes protégées | Vérifie JWT |
| `roleMiddleware('admin')` | Actions admin | Vérifie rôle |
| `requireWriteAccess` | Routes POST/PUT/DELETE | Bloque readonly |
| `optionalAuth` | Stats publiques/privées | Auth facultative |
| `activeUserMiddleware(pool)` | Actions critiques | Vérifie compte actif |
| `loginValidation` | `/auth/login` | Validation entrées |
| `registerValidation` | `/auth/register` | Validation inscription |
| `notFoundHandler` | Fin de routes | Gestion 404 |
| `errorHandler` | Fin de app | Gestion erreurs |
| `asyncHandler(fn)` | Routes async | Supprime try/catch |

---

## 🔗 Voir aussi

- [config/](../config/README.md) - Configuration centralisée
- [routes/](../routes/) - Routes de l'API
- [utils/](../utils/) - Fonctions utilitaires

---

**Documentation générée le** : 28 janvier 2026  
**Version** : 2.0.0 (Phase 2 - Refactoring)
