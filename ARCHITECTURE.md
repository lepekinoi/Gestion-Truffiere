# 🏗️ Architecture Documentation — Gestion-Truffière v8

> **Guide technique complet couvrant le design système, les flux de données, la sécurité et le déploiement**

---

## 📋 Table des matières

1. [Vue d'ensemble](#vue-densemble)
2. [Stack technique](#stack-technique)
3. [Couches système](#couches-système)
4. [Structure des répertoires](#structure-des-répertoires)
5. [Flux de données](#flux-de-données)
6. [Schéma de base de données](#schéma-de-base-de-données)
7. [Sécurité & Authentification](#sécurité--authentification)
8. [Performance & Optimisation](#performance--optimisation)
9. [Déploiement & DevOps](#déploiement--devops)
10. [Monitoring & Logging](#monitoring--logging)
11. [Scalabilité](#scalabilité)
12. [Troubleshooting](#troubleshooting)

---

## Vue d'ensemble

### Diagramme haut niveau

```
┌─────────────────────────────────────────────────────────────┐
│                      CLIENT BROWSER                          │
│                   (React.js + Leaflet)                       │
│                    HTML/CSS/JavaScript                       │
└──────────────────────┬──────────────────────────────────────┘
                       │
          ┌────────────┴─────────────┐
          │   HTTPS (Port 443/80)    │
          └────────────┬─────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│                   API GATEWAY                                │
│            (Rate Limiting, CORS, Helmet)                     │
└────────────────────┬─────────────────────────────────────────┘
                     │
┌────────────────────▼──────────────────────────────────────┐
│                EXPRESS.JS SERVER                           │
│                   (Node.js Runtime)                        │
├────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────┐  │
│  │  Auth Layer  │  │ 21 Routes    │  │ Middleware     │  │
│  │  (JWT)       │  │ modulaires   │  │ (auth,         │  │
│  └──────────────┘  └──────────────┘  │  validation,   │  │
│                                      │  authorize)    │  │
│  ┌──────────────┐  ┌──────────────┐  └────────────────┘  │
│  │  utils/      │  │  config/     │                       │
│  │  index.js    │  │  database.js │                       │
│  │  (Factory)   │  │  (Pool PG)   │                       │
│  └──────────────┘  └──────────────┘                       │
└────────────────────┬─────────────────────────────────────┘
                     │
        ┌────────────┴──────────────┐
        │                           │
   ┌────▼──────┐              ┌─────▼───────┐
   │ PostgreSQL │              │ CACHE LAYER │
   │            │              │ Redis       │
   │ - users    │              │ (optionnel) │
   │ - parcelles│              │             │
   │ - arbres   │              │ Sessions    │
   │ - recoltes │              │ Queries     │
   │ - ...      │              │ Tokens      │
   └────────────┘              └─────────────┘
```

### Pattern architectural

**Pattern utilisé** : **Layered Architecture** (routes directement dans Express, sans couche controller/service séparée — pattern volontairement simplifié pour la taille du projet)

```
┌─────────────────────┐
│  PRESENTATION LAYER │  ← React Components, Forms, UI
│  (Frontend)         │
├─────────────────────┤
│  API LAYER          │  ← REST Endpoints, 21 fichiers routes
│  (Express.js)       │
├─────────────────────┤
│  MIDDLEWARE LAYER   │  ← authenticate, authorize, validation
│                     │
├─────────────────────┤
│  DATA ACCESS LAYER  │  ← SQL paramétré direct dans les routes
│  (PostgreSQL pool)  │
├─────────────────────┤
│  DATA LAYER         │  ← PostgreSQL 12+
│  (Storage)          │
└─────────────────────┘
```

---

## Stack technique

### Backend

| Couche | Technologie | Version | Rôle |
|---|---|---|---|
| **Runtime** | Node.js | ≥14.x | JavaScript runtime |
| **Framework** | Express.js | 4.x | HTTP server & routing |
| **Langage** | JavaScript (ES6+) | — | Langage principal |
| **Base de données** | PostgreSQL | 12+ | Persistance (PLpgSQL 10.8%) |
| **Auth** | JWT (jsonwebtoken) | 8.x+ | Authentification stateless |
| **Hashage** | bcryptjs | — | Mots de passe (12 rounds) |
| **Sécurité** | Helmet | — | Headers HTTP sécurisés |
| **Tests** | Jest | 27.x+ | Tests unitaires & intégration (roadmap) |
| **API Docs** | Swagger/OpenAPI | 3.0 | Documentation API (roadmap) |

### Frontend

| Couche | Technologie | Version | Rôle |
|---|---|---|---|
| **Library** | React | 18.x | UI library |
| **Langage** | JavaScript (ES6+) | — | Langage principal |
| **HTTP Client** | Axios | 0.27+ | Communication API |
| **State Mgmt** | Context API | — | État global |
| **Cartes** | Leaflet | 1.7+ | Cartographie interactive |
| **Styles** | CSS3 | — | Styles composants |
| **Build Tool** | Webpack (CRA) | — | Bundler |
| **Graphiques** | Chart.js / Recharts | 3.x+ | Visualisations données |

### Infrastructure

| Composant | Technologie | Rôle |
|---|---|---|
| **Containerisation** | Docker | Images conteneurs |
| **Orchestration** | Docker Compose | Multi-conteneurs |
| **Reverse Proxy** | Nginx | Proxy inverse, SSL |
| **SSL/TLS** | Let's Encrypt | Certificats HTTPS |
| **Versioning** | Git | Gestion source (branche V8) |

---

## Couches système

### 1. Couche Présentation — Frontend React

**Responsabilité** : Interface utilisateur et interactions

#### Composants (18 fichiers)

```
frontend/src/components/
├── Dashboard.js          // Dashboard temps réel
├── Parcelles.js          // Gestion parcelles (CRUD + corbeille)
├── Arbres.js             // Gestion arbres (CRUD + soft delete)
├── Recoltes.js           // Saisie et suivi récoltes
├── Interventions.js      // Log interventions (phyto, eau, coûts)
├── Commercial.js         // Clients, ventes, commandes, stock
├── Statistiques.js       // Analytics & graphiques saison
├── Carte.js              // Cartographie Leaflet interactive
├── Historique.js         // Audit trail + purge
├── Parametres.js         // Configuration & colonnes
├── Login.js              // Authentification
├── UserManagement.js     // Gestion utilisateurs (admin)
├── ChangePassword.js     // Changement mot de passe
├── CSVImportModal.js     // Import CSV
└── ...                   // Autres composants
```

#### Gestion d'état (Context API)

```
frontend/src/context/
└── AuthContext.js        // État authentification + refresh token
```

#### Utilitaires

```
frontend/src/utils/
└── seasonUtils.js        // 🆕 20 fonctions — gestion saisons truffières
                          //    (getCurrentSeason, isOffSeason,
                          //     compareSeasonsSamePeriod, ...)
```

#### Services

```
frontend/src/services/
├── api.js                // Instance Axios configurée
└── axiosConfig.js        // Interceptors, refresh token auto
```

### 2. Couche API — Express.js Routes (21 modules)

**Responsabilité** : Traitement HTTP, application des middlewares, requêtes SQL

#### Structure des routes

```
backend/routes/
├── auth.js                      # 15 routes — login, logout, refresh, users
├── arbres.routes.js             # 8 routes  — CRUD + corbeille
├── parcelles.routes.js          # 7 routes  — CRUD + corbeille
├── interventions.routes.js      # 14 routes — détails + stats phyto/eau
├── commandes.routes.js          # 8 routes  — génération ventes auto
├── clients.routes.js            # 6 routes  — CRUD + stats par type
├── ventes.routes.js             # 4 routes  — filtres avancés
├── recoltes.routes.js           # 4 routes
├── stock.routes.js              # 2 routes  — calcul auto (récoltes − ventes)
├── dashboard.routes.js          # 1 route   — consolidé temps réel
├── stats.routes.js              # 3 routes  — agrégats annuels/mensuels
├── historique.routes.js         # 3 routes  — audit trail + purge
├── parametres.routes.js         # 7 routes  — config app
├── preferences.routes.js        # 3 routes  — préférences utilisateur
├── caveurs.routes.js            # 4 routes
├── chiens.routes.js             # 4 routes
├── especes.routes.js            # 4 routes
├── types-intervention.routes.js # 1 route
├── produits-phyto.routes.js     # 4 routes
├── amendements-ref.routes.js    # 4 routes
└── achats.routes.js             # CRUD achats/fournisseurs
```

#### Pattern d'un handler de route

```js
// Pattern Factory unifié — identique sur les 21 fichiers
router.post('/parcelles',
  authenticate,          // Vérification JWT
  authorize(['admin', 'user']),  // Contrôle rôles
  async (req, res) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const { rows } = await client.query(
        'INSERT INTO parcelles (nom, ...) VALUES ($1, ...) RETURNING *',
        [req.body.nom, ...]
      );

      // Audit trail
      await client.query(
        `INSERT INTO audit_trail (action, entity, new_data, user_id, ip)
         VALUES ($1, $2, $3, $4, $5)`,
        ['CREATE', 'parcelle', JSON.stringify(rows[0]), req.user.id, req.ip]
      );

      await client.query('COMMIT');
      res.status(201).json(rows[0]);
    } catch (err) {
      await client.query('ROLLBACK');
      res.status(500).json({ error: 'Erreur serveur', code: 'INTERNAL_ERROR' });
    } finally {
      client.release();
    }
  }
);
```

### 3. Couche Middleware

**Responsabilité** : Auth, autorisation, validation — appliqués avant chaque handler

```
backend/middleware/
├── auth.js           # 🆕 Extraction et vérification JWT (séparé de server.js en V8)
├── authenticate.js   # Middleware complet — decode token, attache req.user
├── authorize.js      # Contrôle RBAC — vérifie le rôle requis
└── validation.js     # 🆕 Validation centralisée des inputs
```

#### Gestion des rôles (RBAC)

```js
const ROLES = {
  ADMIN:  ['read', 'write', 'delete', 'admin'],
  USER:   ['read', 'write'],
  VIEWER: ['read']
};
```

### 4. Couche Utilitaires

```
backend/utils/
├── index.js           # 🆕 Point d'entrée unique — pattern Factory
│                      #    emptyToNull(), generateAccessToken(),
│                      #    generateRefreshToken(), formatError(), ...
└── tokenRotation.js   # Rotation refresh tokens + détection réutilisation
```

### 5. Couche Données — PostgreSQL

```
backend/config/
└── database.js        # Pool de connexions PostgreSQL (pg)
                       # waitForConnections, connectionLimit, ...

backend/docs/
└── API_ERROR_CODES.md # 🆕 85+ codes d'erreur standardisés
                       #    format : { error, code, details }
                       #    catégories : Auth, Validation, Métier, Système
```

---

## Structure des répertoires

### Structure complète V8

```
Gestion-Truffiere/                    (branche V8)
│
├── backend/
│   ├── server.js                     # Orchestration (25.3 KB, ~900 lignes)
│   ├── package.json
│   │
│   ├── routes/                       # 21 modules de routes
│   │   ├── auth.js                   # Auth JWT (15 routes)
│   │   ├── arbres.routes.js
│   │   ├── parcelles.routes.js
│   │   ├── interventions.routes.js
│   │   ├── recoltes.routes.js
│   │   ├── clients.routes.js
│   │   ├── ventes.routes.js
│   │   ├── commandes.routes.js
│   │   ├── stock.routes.js
│   │   ├── dashboard.routes.js
│   │   ├── stats.routes.js
│   │   ├── historique.routes.js
│   │   ├── parametres.routes.js
│   │   ├── preferences.routes.js
│   │   ├── caveurs.routes.js
│   │   ├── chiens.routes.js
│   │   ├── especes.routes.js
│   │   ├── types-intervention.routes.js
│   │   ├── produits-phyto.routes.js
│   │   ├── amendements-ref.routes.js
│   │   └── achats.routes.js
│   │
│   ├── middleware/
│   │   ├── auth.js                   # 🆕 Vérification JWT
│   │   ├── authenticate.js           # Middleware auth complet
│   │   ├── authorize.js              # Contrôle rôles
│   │   └── validation.js             # 🆕 Validation centralisée
│   │
│   ├── utils/
│   │   ├── index.js                  # 🆕 Point d'entrée unique (Factory)
│   │   └── tokenRotation.js          # Rotation refresh tokens
│   │
│   ├── config/
│   │   └── database.js               # Pool connexions PostgreSQL
│   │
│   └── docs/
│       └── API_ERROR_CODES.md        # 🆕 85+ codes d'erreur documentés
│
├── frontend/
│   ├── package.json
│   │
│   └── src/
│       ├── index.js                  # Entrée React
│       ├── App.js                    # Composant racine
│       │
│       ├── components/               # 18 composants React
│       │   ├── Dashboard.js
│       │   ├── Parcelles.js
│       │   ├── Arbres.js
│       │   ├── Recoltes.js
│       │   ├── Interventions.js
│       │   ├── Commercial.js
│       │   ├── Statistiques.js
│       │   ├── Carte.js
│       │   ├── Historique.js
│       │   ├── Parametres.js
│       │   ├── Login.js
│       │   ├── UserManagement.js
│       │   ├── ChangePassword.js
│       │   ├── CSVImportModal.js
│       │   └── ...
│       │
│       ├── services/
│       │   ├── api.js                # Instance Axios
│       │   └── axiosConfig.js        # Config HTTP + interceptors
│       │
│       ├── context/
│       │   └── AuthContext.js        # État authentification
│       │
│       └── utils/
│           └── seasonUtils.js        # 🆕 20 fonctions saison truffière
│
├── database/
│   └── init_database.sql             # Schéma PostgreSQL + données initiales
│
├── docker-compose.yml
├── Dockerfile
├── .env.exemple
├── backup-db.sh                      # Script backup PostgreSQL
│
├── README.md
├── API.md
├── ARCHITECTURE.md                   # Ce fichier
├── CHANGELOG.md
├── DOCKER.md
└── SETUP.md
```

> **Note V8** : Le dossier `backend/controllers/` (3 fichiers TypeScript, 25.4 KB) a été supprimé en v2.0.1 — c'était du code mort issu d'une exploration antérieure. La logique est directement dans les handlers de routes.

---

## Flux de données

### Cycle Requête/Réponse

```
1. INTERACTION UTILISATEUR
   └─ Clic bouton / soumission formulaire dans un composant React

2. TRAITEMENT FRONTEND
   └─ Handler déclenché
   └─ Validation client (champs requis, formats)
   └─ Appel service API : api.post('/parcelles', data)

3. REQUÊTE HTTP
   ├─ Méthode : POST
   ├─ URL : /api/parcelles
   ├─ Headers : { Authorization: "Bearer <JWT>" }
   └─ Body : { nom: "Parcelle 1", ... }

4. TRAITEMENT SERVEUR
   ├─ Correspondance de route
   ├─ Chaîne middleware :
   │  ├─ authenticate   → Vérification JWT, attach req.user
   │  ├─ authorize      → Vérification rôle
   │  └─ validation     → Vérification body
   └─ Handler :
      ├─ pool.connect() → transaction PostgreSQL
      ├─ INSERT paramétré
      ├─ INSERT audit_trail (old_data, new_data, metadata)
      ├─ COMMIT
      └─ Retour JSON

5. RÉPONSE HTTP
   ├─ Status : 201 Created
   └─ Body : { id, nom, ... }

6. MISE À JOUR FRONTEND
   ├─ Réception réponse Axios
   ├─ Mise à jour state React
   ├─ Re-render composant
   └─ Notification toast succès
```

### Diagramme flux de données

```
┌──────────────────────┐
│  React Component     │
└──────┬───────────────┘
       │ onChange/onClick
       ▼
┌──────────────────────┐
│  api.js (Axios)      │
│  POST /api/parcelles │
│  + Bearer JWT        │
└──────┬───────────────┘
       │ HTTP
       ▼
┌──────────────────────────────────┐
│  Express Route Handler           │
│  parcelles.routes.js             │
└──────┬───────────────────────────┘
       ├──► middleware/authenticate  → vérifie JWT
       ├──► middleware/authorize     → vérifie rôle
       ├──► middleware/validation    → vérifie inputs
       ▼
┌──────────────────────────────────┐
│  Handler async                   │
│  pool.connect() → BEGIN          │
│  INSERT INTO parcelles ...       │
│  INSERT INTO audit_trail ...     │
│  COMMIT                          │
└──────┬───────────────────────────┘
       ▼
┌──────────────────────────────────┐
│  PostgreSQL                      │
│  INSERT + RETURNING *            │
└──────┬───────────────────────────┘
       ▼
┌──────────────────────────────────┐
│  Réponse 201                     │
│  { id, nom, ... }                │
└──────┬───────────────────────────┘
       ▼
┌──────────────────────────────────┐
│  React — setState → re-render    │
└──────────────────────────────────┘
```

---

## Schéma de base de données

### Diagramme Entité-Relation principal

```
┌─────────────┐
│   USERS     │
├─────────────┤
│ id (PK)     │──┐
│ email       │  │
│ password_hash  │ 1
│ nom         │  │
│ prenom      │  │
│ role        │  └────┐
│ failed_login_attempts  N
│ locked_until│       │
│ created_at  │  ┌────▼──────────┐
└─────────────┘  │  PARCELLES    │
                 ├───────────────┤
                 │ id (PK)       │────┐
                 │ user_id (FK)  │    │ 1
                 │ nom           │    │
                 │ localisation  │    │ N
                 │ surface_ha    │    │
                 │ deleted_at    │    └──────────────┐
                 └───────────────┘                   │
                                           ┌─────────▼──────┐
                                           │    ARBRES       │
                                           ├────────────────┤
                                           │ id (PK)        │────┐
                                           │ parcelle_id(FK)│    │ 1
                                           │ variete        │    │
                                           │ date_plantation│    │ N
                                           │ etat_sanitaire │    │
                                           │ deleted_at     │    │
                                           └────────────────┘    │
                                                       ┌──────────┤
                               ┌───────────────┐       │          │
                               │   RECOLTES    │◄──────┘          │
                               ├───────────────┤                  │
                               │ id (PK)       │       ┌──────────▼──────┐
                               │ parcelle_id   │       │  INTERVENTIONS  │
                               │ date_recolte  │       ├─────────────────┤
                               │ quantite_kg   │       │ id (PK)         │
                               │ qualite       │       │ parcelle_id     │
                               │ caveur_id     │       │ type            │
                               │ chien_id      │       │ date_inter      │
                               └───────────────┘       │ cout            │
                                                       │ produit_phyto_id│
                                                       └─────────────────┘

┌──────────────┐     ┌──────────────┐     ┌──────────────────┐
│   CLIENTS    │     │   VENTES     │     │   COMMANDES      │
├──────────────┤     ├──────────────┤     ├──────────────────┤
│ id (PK)      │──┐  │ id (PK)      │  ┌──│ id (PK)          │
│ nom          │  │  │ client_id(FK)│◄─┘  │ client_id (FK)   │
│ type         │  └─►│ quantite_kg  │     │ quantite_kg      │
│ email        │     │ prix_kg      │     │ statut           │
│ telephone    │     │ qualite      │     │ date_commande    │
└──────────────┘     │ date_vente   │     └──────────────────┘
                     └──────────────┘

┌───────────────────────────────────────────────────────┐
│                   AUDIT_TRAIL                         │
├───────────────────────────────────────────────────────┤
│ id (PK) | action | entity | entity_id                 │
│ old_data (JSONB) | new_data (JSONB) | metadata (JSONB)│
│ user_id (FK) | ip_address | created_at                │
└───────────────────────────────────────────────────────┘
```

### Tables clés

#### Table users

```sql
CREATE TABLE users (
  id                    SERIAL PRIMARY KEY,
  email                 VARCHAR(255) UNIQUE NOT NULL,
  password_hash         VARCHAR(255) NOT NULL,
  nom                   VARCHAR(100) NOT NULL,
  prenom                VARCHAR(100) NOT NULL,
  role                  VARCHAR(20) DEFAULT 'user' CHECK (role IN ('admin','user','viewer')),
  is_active             BOOLEAN DEFAULT TRUE,
  failed_login_attempts INT DEFAULT 0,
  locked_until          TIMESTAMP NULL,
  last_login            TIMESTAMP NULL,
  created_at            TIMESTAMP DEFAULT NOW(),
  updated_at            TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_users_email ON users(email);
```

#### Table parcelles

```sql
CREATE TABLE parcelles (
  id               SERIAL PRIMARY KEY,
  user_id          INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  nom              VARCHAR(255) NOT NULL,
  localisation     TEXT,
  latitude         DECIMAL(10,8),
  longitude        DECIMAL(11,8),
  surface_hectares DECIMAL(6,2),
  composition      TEXT,
  created_at       TIMESTAMP DEFAULT NOW(),
  updated_at       TIMESTAMP DEFAULT NOW(),
  deleted_at       TIMESTAMP NULL
);
CREATE INDEX idx_parcelles_user ON parcelles(user_id);
CREATE INDEX idx_parcelles_deleted ON parcelles(deleted_at);
```

#### Table audit_trail

```sql
CREATE TABLE audit_trail (
  id         SERIAL PRIMARY KEY,
  action     VARCHAR(50) NOT NULL,  -- CREATE, UPDATE, DELETE, LOGIN, ...
  entity     VARCHAR(50) NOT NULL,  -- parcelle, arbre, user, ...
  entity_id  INT,
  old_data   JSONB,
  new_data   JSONB,
  metadata   JSONB,
  user_id    INT REFERENCES users(id),
  ip_address VARCHAR(45),
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_audit_user ON audit_trail(user_id);
CREATE INDEX idx_audit_entity ON audit_trail(entity, entity_id);
CREATE INDEX idx_audit_created ON audit_trail(created_at);
```

---

## Sécurité & Authentification

### Flux JWT

```
1. REQUÊTE LOGIN
   POST /api/auth/login
   { "email": "...", "password": "..." }

2. TRAITEMENT SERVEUR
   ├─ Vérification account locking (locked_until)
   ├─ Recherche user par email
   ├─ bcrypt.compare(password, hash) — 12 salt rounds
   ├─ Si KO : incrémente failed_login_attempts
   │          → 5 tentatives : locked_until = NOW() + 15min
   └─ Si OK  : reset compteur, génère tokens

3. TOKENS RETOURNÉS
   ├─ Access Token  (exp: 15 min)
   │  { userId, email, role, iat, exp }
   └─ Refresh Token (exp: 7 jours, stocké en DB avec rotation)

4. REQUÊTES SUIVANTES
   Authorization: Bearer <accessToken>

5. VÉRIFICATION SERVEUR (middleware/authenticate.js)
   ├─ Extraction header Authorization
   ├─ jwt.verify(token, JWT_SECRET)
   ├─ Vérification expiration
   └─ Si valide : req.user = payload

6. REFRESH TOKEN
   POST /api/auth/refresh
   { "refreshToken": "..." }
   → Détection réutilisation (tokenRotation.js)
   → Nouveau access token + rotation refresh token
```

### Couches de sécurité V8

| Couche | Implémentation | Détail |
|---|---|---|
| **Hashage** | bcrypt | 12 salt rounds |
| **Tokens** | JWT | Access 15 min + refresh 7 jours avec rotation |
| **Account locking** | PostgreSQL | 5 tentatives → verrouillage 15 min |
| **Rate limiting** | express-rate-limit | Global : 1000 req/15 min, Auth : 10 req/15 min |
| **IP tracking** | req.ip | Loggé sur toutes les actions sensibles |
| **Headers** | Helmet | CSP, HSTS, X-Frame-Options, XSS... |
| **CORS** | cors | Configurable via `CORS_ORIGIN` dans `.env` |
| **Codes d'erreur** | 85+ codes | `details` masqués hors `NODE_ENV=development` |
| **Audit trail** | PostgreSQL | old_data + new_data + metadata sur toutes mutations |
| **Injections SQL** | pg paramétré | `$1, $2, ...` — jamais de concaténation |

### À implémenter (roadmap)

- [ ] OAuth2 / OpenID Connect
- [ ] Double authentification (2FA)
- [ ] Audit sécurité régulier
- [ ] WAF (Web Application Firewall)

---

## Performance & Optimisation

### Optimisation base de données

#### Index essentiels

```sql
-- Colonnes fréquemment filtrées
CREATE INDEX idx_arbres_parcelle   ON arbres(parcelle_id);
CREATE INDEX idx_arbres_sante      ON arbres(etat_sanitaire);
CREATE INDEX idx_recoltes_date     ON recoltes(date_recolte);
CREATE INDEX idx_interventions_date ON interventions(date_intervention);
CREATE INDEX idx_ventes_client     ON ventes(client_id);

-- Index partiels pour soft delete
CREATE INDEX idx_parcelles_actives ON parcelles(user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_arbres_actifs     ON arbres(parcelle_id) WHERE deleted_at IS NULL;
```

#### Pool de connexions PostgreSQL

```js
// backend/config/database.js
const { Pool } = require('pg');

const pool = new Pool({
  host:     process.env.DB_HOST,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port:     process.env.DB_PORT || 5432,
  max:                10,   // Connexions max
  idleTimeoutMillis:  30000,
  connectionTimeoutMillis: 2000,
});

module.exports = pool;
```

#### Bonnes pratiques SQL dans les routes

```js
// ✅ Sélectionner uniquement les colonnes utiles
const { rows } = await pool.query(
  `SELECT id, nom, surface_hectares, latitude, longitude
   FROM parcelles
   WHERE user_id = $1 AND deleted_at IS NULL
   ORDER BY nom`,
  [req.user.id]
);

// ✅ Pagination systématique
const { rows } = await pool.query(
  `SELECT * FROM ventes
   ORDER BY date_vente DESC
   LIMIT $1 OFFSET $2`,
  [limit, offset]
);

// ✅ Transactions explicites pour mutations multi-tables
const client = await pool.connect();
try {
  await client.query('BEGIN');
  // ... opérations
  await client.query('COMMIT');
} catch (e) {
  await client.query('ROLLBACK');
  throw e;
} finally {
  client.release();
}
```

### Optimisation frontend

#### Memoization React

```js
// Eviter les recalculs sur les listes larges
const parcellesFiltrees = useMemo(
  () => parcelles.filter(p => p.etat === filtre),
  [parcelles, filtre]
);

// Eviter les re-renders inutiles
const ParcelleRow = React.memo(({ parcelle, onEdit }) => (
  <tr>...</tr>
));
```

#### Chargement paresseux des composants

```js
const Statistiques = React.lazy(() => import('./Statistiques'));
const Cartographie  = React.lazy(() => import('./Carte'));

<Suspense fallback={<Spinner />}>
  <Statistiques />
</Suspense>
```

---

## Déploiement & DevOps

### Docker

#### Backend Dockerfile

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 5000
CMD ["npm", "start"]
```

#### docker-compose.yml (production)

```yaml
version: '3.8'

services:
  db:
    image: postgres:14-alpine
    environment:
      POSTGRES_DB:       gestion_truffiere
      POSTGRES_USER:     ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - db_data:/var/lib/postgresql/data
      - ./database/init_database.sql:/docker-entrypoint-initdb.d/init.sql
    restart: unless-stopped

  backend:
    build: ./backend
    environment:
      NODE_ENV:    production
      DB_HOST:     db
      DB_USER:     ${DB_USER}
      DB_PASSWORD: ${DB_PASSWORD}
      DB_NAME:     gestion_truffiere
      JWT_SECRET:  ${JWT_SECRET}
    ports:
      - "5000:5000"
    depends_on:
      - db
    restart: unless-stopped

  frontend:
    build: ./frontend
    environment:
      REACT_APP_API_URL: ${REACT_APP_API_URL}
    ports:
      - "3000:3000"
    depends_on:
      - backend
    restart: unless-stopped

volumes:
  db_data:
```

### Stratégies de déploiement

```bash
# Développement
docker-compose up

# Production — rebuild + restart sans downtime
docker-compose pull
docker-compose up -d --build

# Backup BDD avant déploiement
./backup-db.sh
```

---

## Monitoring & Logging

### Logging actuel

Les routes Express loggent les erreurs dans les blocs `catch` via `console.error`. En production, rediriger vers un fichier :

```bash
node server.js >> logs/app.log 2>&1
# ou via PM2 :
pm2 start server.js --log logs/app.log
```

### Audit trail (natif)

L'audit trail PostgreSQL constitue le principal mécanisme de traçabilité :

```sql
-- Dernières actions
SELECT action, entity, user_id, ip_address, created_at
FROM audit_trail
ORDER BY created_at DESC
LIMIT 50;

-- Actions d'un utilisateur
SELECT * FROM audit_trail
WHERE user_id = $1
ORDER BY created_at DESC;

-- Historique d'une entité
SELECT old_data, new_data, metadata, created_at
FROM audit_trail
WHERE entity = 'parcelle' AND entity_id = $1;
```

### Métriques à surveiller

```
├─ Temps de réponse API         → GET /api/health
├─ Taux d'erreur 5xx            → logs/app.log
├─ Tentatives de connexion      → audit_trail (action = 'LOGIN_FAILED')
├─ Pool PostgreSQL              → pg pool events
└─ Utilisation disque           → df -h (backups BDD)
```

### Roadmap monitoring (v8.5)

- [ ] Winston / Pino pour logging structuré JSON
- [ ] Dashboard métriques (Grafana ou équivalent léger)
- [ ] Alertes automatiques (maladies, seuils stock, météo)
- [ ] WebSockets pour notifications temps réel

---

## Scalabilité

### Scaling horizontal (si nécessaire)

```
            ┌─────────┐
            │ Client  │
            └────┬────┘
                 │
            ┌────▼────┐
            │Nginx LB │
            └────┬────┘
       ┌─────────┼──────────┐
       │         │          │
  ┌────▼───┐ ┌───▼────┐ ┌──▼─────┐
  │Node  1 │ │Node  2 │ │Node  N │
  └────┬───┘ └───┬────┘ └──┬─────┘
       └─────────┼──────────┘
                 │
          ┌──────▼──────┐
          │ PostgreSQL  │
          └─────────────┘
```

> Le backend Express est stateless (JWT) — le scaling horizontal ne nécessite pas de session partagée.

---

## Troubleshooting

### Problèmes fréquents

#### Connexion base de données impossible

```
Error: connect ECONNREFUSED 127.0.0.1:5432

Solutions :
1. Vérifier que PostgreSQL tourne : docker ps | grep postgres
2. Vérifier les credentials dans backend/.env
3. Vérifier DB_HOST (si Docker : nom du service, pas localhost)
4. Tester : psql -h $DB_HOST -U $DB_USER -d $DB_NAME
```

#### JWT expiré

```
TokenExpiredError: jwt expired

Solutions :
1. Utiliser POST /api/auth/refresh avec le refresh token
2. Si refresh expiré → re-login obligatoire
3. Vérifier que l'horloge serveur est synchronisée (NTP)
```

#### CORS bloqué

```
Access to XMLHttpRequest blocked by CORS policy

Solutions :
1. Vérifier CORS_ORIGIN dans backend/.env
2. L'origine doit correspondre exactement (http vs https, port inclus)
3. Vérifier credentials: true si cookies utilisés
```

#### Account verrouillé

```
{ error: "Compte verrouillé", code: "ACCOUNT_LOCKED" }

Solutions :
1. Attendre 15 minutes (expiration automatique)
2. Admin : UPDATE users SET locked_until = NULL,
           failed_login_attempts = 0 WHERE email = '...'
```

#### Consulter les codes d'erreur

Tous les codes `{ error, code, details }` sont documentés dans :
→ [`backend/docs/API_ERROR_CODES.md`](https://github.com/lepekinoi/Gestion-Truffiere/blob/V8/backend/docs/API_ERROR_CODES.md)

---

**Dernière mise à jour : mai 2026**  
**Statut : Production Ready**  
**Maintenu par : lepekinoi**  
**Branche : V8 — version 2.0.1**
