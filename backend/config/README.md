# ⚙️ Configuration Backend

> **Module de configuration centralisé pour l'API Gestion-Truffière**

---

## 📚 Table des matières

- [Vue d'ensemble](#vue-densemble)
- [Fichiers](#fichiers)
- [Variables d'environnement](#variables-denvironnement)
- [Utilisation](#utilisation)
- [Dépannage](#dépannage)

---

## Vue d'ensemble

Ce dossier contient toutes les configurations centralisées du backend :

- **database.js** : Pool de connexions PostgreSQL
- **jwt.js** : Configuration JWT (tokens d'accès et refresh)
- **security.js** : Sécurité (CORS, Helmet, Rate Limiting)
- **environment.js** : Validation des variables d'environnement
- **index.js** : Export centralisé de tous les modules

---

## Fichiers

### 1. `database.js`

**Responsabilité** : Gestion du pool de connexions PostgreSQL

**Exports** :
```javascript
const { pool, testConnection, closePool } = require('./config/database');
```

**Fonctions** :
- `pool` : Instance du pool PostgreSQL
- `testConnection()` : Teste la connexion (async)
- `closePool()` : Ferme proprement le pool (async)

**Configuration** :
```javascript
max: 20,                      // 20 connexions max
idleTimeoutMillis: 30000,     // Timeout inactivité 30s
connectionTimeoutMillis: 2000 // Timeout connexion 2s
```

---

### 2. `jwt.js`

**Responsabilité** : Configuration JWT (access & refresh tokens)

**Exports** :
```javascript
const { 
  JWT_SECRET, 
  JWT_EXPIRES_IN, 
  REFRESH_TOKEN_EXPIRES_DAYS, 
  BCRYPT_ROUNDS 
} = require('./config/jwt');
```

**Valeurs par défaut** :
- `JWT_EXPIRES_IN` : `'15m'` (15 minutes)
- `REFRESH_TOKEN_EXPIRES_DAYS` : `7` (7 jours)
- `BCRYPT_ROUNDS` : `12` (hash bcrypt)

**Sécurité** :
- Vérifie que `JWT_SECRET` est défini (sinon exit)
- Masque le secret dans les logs

---

### 3. `security.js`

**Responsabilité** : Sécurité HTTP (CORS, headers, rate limiting)

**Exports** :
```javascript
const { 
  corsOptions,           // Config CORS
  helmetConfig,          // Headers sécurité
  globalLimiter,         // Rate limit global
  authLimiter,           // Rate limit auth
  registerLimiter,       // Rate limit register
  passwordResetLimiter,  // Rate limit reset pwd
  sensitiveLimiter,      // Rate limit APIs sensibles
  cookieOptions,         // Config cookies
  bcryptConfig,          // Config bcrypt
  publicRoutes,          // Routes publiques
  isPublicRoute,         // Vérifie si route publique
  cors                   // Middleware CORS
} = require('./config/security');
```

**Rate Limiting** :
- **Global** : 1000 req/15min
- **Auth** : 10 req/15min (tentatives connexion)
- **Register** : 5 req/1h
- **Password Reset** : 3 req/1h
- **Sensitive** : 10 req/1min

---

### 4. `environment.js`

**Responsabilité** : Validation des variables d'environnement

**Exports** :
```javascript
const { 
  validateEnvironment,   // Valide les env vars
  getEnv,                // Récupère env var
  getEnvNumber,          // Récupère env var numérique
  getEnvBoolean,         // Récupère env var booléenne
  displayEnvironment     // Affiche config (masquée)
} = require('./config/environment');
```

**Variables obligatoires** :
- `JWT_SECRET`
- `DB_PASSWORD`
- `DB_USER`
- `DB_NAME`
- `DB_HOST`

**Variables recommandées** :
- `CORS_ORIGINS`
- `NODE_ENV`
- `PORT`
- `DB_PORT`
- `JWT_EXPIRES_IN`
- `REFRESH_TOKEN_EXPIRES_DAYS`
- `BCRYPT_ROUNDS`

---

### 5. `index.js`

**Responsabilité** : Export centralisé de tous les modules

**Usage** :
```javascript
// Import centralisé (recommandé)
const config = require('./config');

// Utilisation
config.pool.query('SELECT * FROM users');
config.validateEnvironment();
app.use(config.globalLimiter);

// Ou import destructuré
const { pool, JWT_SECRET, corsOptions } = require('./config');
```

---

## Variables d'environnement

Créez un fichier `.env` à la racine de `backend/` :

```bash
# Base de données PostgreSQL
DB_HOST=localhost
DB_PORT=5432
DB_NAME=gestion_truffiere
DB_USER=postgres
DB_PASSWORD=votre_mot_de_passe

# JWT
JWT_SECRET=votre_secret_super_securise_64_caracteres_minimum
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_DAYS=7
BCRYPT_ROUNDS=12

# CORS
CORS_ORIGINS=http://localhost:3000,https://app.example.com

# Serveur
PORT=3001
NODE_ENV=development

# Frontend
FRONTEND_URL=http://localhost:3000
```

### Générer un JWT_SECRET sécurisé

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

---

## Utilisation

### Exemple 1 : Initialiser l'application

```javascript
const express = require('express');
const config = require('./config');

const app = express();

// 1. Valider les variables d'environnement
config.validateEnvironment();

// 2. Tester la connexion DB
config.testConnection().then((connected) => {
  if (!connected) {
    console.error('❌ Impossible de démarrer sans DB');
    process.exit(1);
  }
  
  // 3. Appliquer les middlewares de sécurité
  app.use(config.helmetConfig);
  app.use(config.cors());
  app.use(config.globalLimiter);
  
  // 4. Démarrer le serveur
  app.listen(3001, () => {
    console.log('🚀 Serveur démarré');
  });
});
```

### Exemple 2 : Utiliser le pool DB

```javascript
const { pool } = require('./config');

const getUsers = async () => {
  try {
    const result = await pool.query('SELECT * FROM users');
    return result.rows;
  } catch (err) {
    console.error('Erreur DB:', err);
    throw err;
  }
};
```

### Exemple 3 : Appliquer rate limiting auth

```javascript
const { authLimiter } = require('./config');
const express = require('express');
const router = express.Router();

// Limiter les tentatives de connexion
router.post('/login', authLimiter, (req, res) => {
  // Logique de connexion
});
```

---

## Dépannage

### Erreur : "JWT_SECRET manquant"

**Solution** :
```bash
# Générer un secret
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# Ajouter dans .env
echo "JWT_SECRET=votre_secret_genere" >> .env
```

### Erreur : "Connexion DB refusée"

**Solution** :
1. Vérifier que PostgreSQL est démarré : `docker ps`
2. Vérifier les credentials dans `.env`
3. Vérifier le port : `5432` par défaut
4. Tester manuellement : `psql -h localhost -U postgres -d gestion_truffiere`

### Erreur : "Variables d'environnement manquantes"

**Solution** :
```bash
# Copier le template
cp .env.example .env

# Éditer et remplir les valeurs
nano .env
```

### Erreur : "CORS blocked"

**Solution** :
Ajouter l'origine dans `.env` :
```bash
CORS_ORIGINS=http://localhost:3000,https://votre-frontend.com
```

### Erreur : "Rate limit exceeded"

**Solution** :
- Attendre la fenêtre de rate limiting (15 min pour global, 1h pour register)
- Ou augmenter les limites dans `security.js` (dev seulement)

---

## 🔒 Sécurité

### Bonnes pratiques

✅ **DO** :
- Utiliser un `JWT_SECRET` de 64+ caractères aléatoires
- Définir `NODE_ENV=production` en production
- Activer HTTPS en production
- Limiter `CORS_ORIGINS` aux domaines autorisés
- Utiliser `BCRYPT_ROUNDS=12` minimum

❌ **DON'T** :
- Ne JAMAIS committer le fichier `.env`
- Ne pas partager le `JWT_SECRET`
- Ne pas désactiver le rate limiting en production
- Ne pas exposer les détails d'erreur en production

---

## 📈 Monitoring

### Logs à surveiller

```bash
# Connexions DB
✅ Connexion à la base de données PostgreSQL réussie

# Validation environnement
✅ Variables d'environnement validées avec succès

# Sécurité
🔒 Configuration sécurité chargée

# Rate limiting
⚠️  Trop de requêtes (IP: xxx.xxx.xxx.xxx)
```

---

**Dernière mise à jour** : 14 mai 2026  
**Version** : V8 (2.0.3)  
**Auteur** : lepekinoi
