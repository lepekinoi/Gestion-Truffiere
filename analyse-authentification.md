# 🔐 Analyse du Projet Truffière & Proposition d'Authentification

## 📊 Résumé de l'Architecture Actuelle

### Stack Technique
| Composant | Technologie | Version |
|-----------|-------------|---------|
| Frontend | React | 18.2.0 |
| Backend | Express.js (Node.js) | - |
| Base de données | PostgreSQL + PostGIS | 16 |
| Containerisation | Docker Compose | - |

### Structure du Projet
```
truffiere/
├── App.js              # Point d'entrée React (navigation par état)
├── App.css             # Styles globaux
├── server.js           # API Express (57 KB, ~1600 lignes)
├── init-db.sql         # Schéma de base de données
├── docker-compose.yml  # Orchestration des services
├── package.json        # Dépendances frontend
└── Components/
    ├── Dashboard.js    # Tableau de bord
    ├── Parcelles.js    # Gestion des parcelles
    ├── Arbres.js       # Gestion des arbres
    ├── Carte.js        # Carte interactive (Leaflet)
    ├── Interventions.js
    ├── Recoltes.js
    ├── Commercial.js
    ├── Statistiques.js
    ├── Previsions.js
    ├── Historique.js
    └── Parametres.js
```

---

## 🚨 Analyse de Sécurité Actuelle

### ❌ Problèmes Identifiés

1. **Aucune authentification** - L'API est totalement ouverte
2. **Pas de gestion d'utilisateurs** - Pas de table `users` dans la BDD
3. **Credentials en dur** dans le code (server.js ligne 16-17)
4. **Pas de middleware de sécurité** (helmet, rate-limiting, etc.)
5. **CORS trop permissif** - `cors()` sans configuration
6. **Pas de HTTPS forcé** dans l'application

### Tables existantes dans la BDD
- `parcelles`, `arbres`, `recoltes`, `interventions`
- `ventes`, `commandes`, `clients`
- `caveurs`, `chiens`
- `types_intervention`, `parametres`, `preferences_utilisateur`
- `historique` (audit trail)
- ⚠️ **Pas de table `users`**

---

## 🎯 Proposition de Système d'Authentification

### Option Recommandée : JWT + Sessions sécurisées

Cette solution offre un bon équilibre entre sécurité et simplicité d'implémentation.

### Architecture Proposée

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│                 │     │                  │     │                 │
│  React Frontend │────▶│  Express Backend │────▶│   PostgreSQL    │
│                 │     │                  │     │                 │
│  - Login Form   │     │  - JWT Middleware│     │  - users table  │
│  - Auth Context │     │  - bcrypt        │     │  - sessions     │
│  - Protected    │     │  - Rate Limiting │     │  - roles        │
│    Routes       │     │  - Refresh Token │     │                 │
│                 │     │                  │     │                 │
└─────────────────┘     └──────────────────┘     └─────────────────┘
```

---

## 📋 Plan d'Implémentation

### Phase 1 : Backend - Base de données

#### 1.1 Nouvelles tables à créer

```sql
-- Table des utilisateurs
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    nom VARCHAR(100) NOT NULL,
    prenom VARCHAR(100),
    role VARCHAR(50) DEFAULT 'user',  -- 'admin', 'user', 'readonly'
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table des sessions/refresh tokens
CREATE TABLE refresh_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(500) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    revoked BOOLEAN DEFAULT false
);

-- Table des tentatives de connexion (protection brute force)
CREATE TABLE login_attempts (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255),
    ip_address VARCHAR(45),
    success BOOLEAN,
    attempted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index pour performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_token ON refresh_tokens(token);
CREATE INDEX idx_login_attempts_email ON login_attempts(email);
```

### Phase 2 : Backend - Nouvelles dépendances

```json
{
  "dependencies": {
    "bcryptjs": "^2.4.3",
    "jsonwebtoken": "^9.0.2",
    "helmet": "^7.1.0",
    "express-rate-limit": "^7.1.5",
    "express-validator": "^7.0.1",
    "cookie-parser": "^1.4.6"
  }
}
```

### Phase 3 : Backend - Middleware d'authentification

```javascript
// middleware/auth.js
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'votre_secret_tres_long_et_securise';

const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Token manquant' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token invalide' });
  }
};

const roleMiddleware = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Accès refusé' });
    }
    next();
  };
};

module.exports = { authMiddleware, roleMiddleware };
```

### Phase 4 : Backend - Routes d'authentification

```javascript
// routes/auth.js
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const router = express.Router();

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  
  // 1. Vérifier les tentatives de connexion
  // 2. Trouver l'utilisateur
  // 3. Vérifier le mot de passe avec bcrypt
  // 4. Générer tokens JWT (access + refresh)
  // 5. Enregistrer le refresh token en BDD
  // 6. Retourner les tokens
});

// POST /api/auth/register (admin seulement)
router.post('/register', authMiddleware, roleMiddleware('admin'), async (req, res) => {
  // Création d'un nouvel utilisateur
});

// POST /api/auth/refresh
router.post('/refresh', async (req, res) => {
  // Rafraîchir le token d'accès
});

// POST /api/auth/logout
router.post('/logout', authMiddleware, async (req, res) => {
  // Révoquer le refresh token
});

// GET /api/auth/me
router.get('/me', authMiddleware, async (req, res) => {
  // Retourner les infos de l'utilisateur connecté
});
```

### Phase 5 : Frontend - Context d'authentification

```javascript
// context/AuthContext.js
import React, { createContext, useState, useContext, useEffect } from 'react';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const login = async (email, password) => {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    
    if (response.ok) {
      const data = await response.json();
      localStorage.setItem('accessToken', data.accessToken);
      localStorage.setItem('refreshToken', data.refreshToken);
      setUser(data.user);
      return true;
    }
    return false;
  };

  const logout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    setUser(null);
  };

  // ... vérification du token au démarrage

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
```

### Phase 6 : Frontend - Composant Login

```javascript
// components/Login.js
import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    const success = await login(email, password);
    if (!success) {
      setError('Email ou mot de passe incorrect');
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <img src="/truffe-icon.png" alt="Logo" className="login-logo" />
        <h2>Gestion de Truffière</h2>
        <form onSubmit={handleSubmit}>
          {/* Formulaire de connexion */}
        </form>
      </div>
    </div>
  );
};
```

---

## 🔒 Mesures de Sécurité Additionnelles

### 1. Variables d'environnement (.env)
```env
NODE_ENV=production
PORT=3001
DB_HOST=postgres
DB_PORT=5432
DB_NAME=truffiere
DB_USER=unstuffed1004
DB_PASSWORD=WeR87fFC8SN5IJUGz4w6Tl87t1Fm2840GepKl82Xe666J0D7hD

# Authentification
JWT_SECRET=une_cle_tres_longue_et_securisee_minimum_64_caracteres
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=7d
BCRYPT_ROUNDS=12
```

### 2. Configuration Helmet (sécurité HTTP)
```javascript
const helmet = require('helmet');
app.use(helmet());
```

### 3. Rate Limiting
```javascript
const rateLimit = require('express-rate-limit');

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 tentatives
  message: 'Trop de tentatives, réessayez dans 15 minutes'
});

app.use('/api/auth/login', loginLimiter);
```

### 4. CORS sécurisé
```javascript
app.use(cors({
  origin: process.env.FRONTEND_URL || 'https://m-a-truffes.sytes.net',
  credentials: true
}));
```

---

## 📊 Niveaux de Rôles Proposés

| Rôle | Permissions |
|------|-------------|
| **admin** | Tout accès (CRUD complet + gestion utilisateurs) |
| **user** | Lecture/écriture sur toutes les données métier |
| **readonly** | Lecture seule (consultation dashboard, stats) |

---

## 📁 Fichiers à Créer/Modifier

### Nouveaux fichiers
```
backend/
├── middleware/
│   ├── auth.js           # Middleware JWT
│   └── validation.js     # Validation des entrées
├── routes/
│   └── auth.js           # Routes d'authentification
├── utils/
│   └── tokens.js         # Génération/validation tokens
└── config/
    └── security.js       # Configuration sécurité

frontend/
├── context/
│   └── AuthContext.js    # Context React pour auth
├── components/
│   ├── Login.js          # Page de connexion
│   └── ProtectedRoute.js # HOC pour routes protégées
└── hooks/
    └── useAuth.js        # Hook personnalisé
```

### Fichiers à modifier
- `server.js` - Ajouter middleware auth, routes
- `App.js` - Ajouter AuthProvider, routing conditionnel
- `App.css` - Styles pour page login
- `init-db.sql` - Ajouter tables users, refresh_tokens
- `docker-compose.yml` - Ajouter variables d'environnement
- `_env` → `.env` - Ajouter secrets

---

## ⏱️ Estimation du Temps d'Implémentation

| Phase | Durée estimée |
|-------|---------------|
| BDD (tables + migration) | 1-2h |
| Backend (auth routes) | 3-4h |
| Backend (middleware + sécurité) | 2-3h |
| Frontend (context + login) | 2-3h |
| Tests & debug | 2-3h |
| **Total** | **10-15h** |

---

## 🚀 Prochaines Étapes

Voulez-vous que je commence l'implémentation ? Je propose de procéder dans cet ordre :

1. **Script SQL** pour créer les tables d'authentification
2. **Backend** : middleware et routes d'auth
3. **Frontend** : contexte auth et page de connexion
4. **Intégration** : protéger les routes existantes

Dites-moi par quelle partie vous souhaitez commencer, ou si vous avez des questions sur cette proposition !
