# 🏗️ Architecture — Gestion-Truffière v8

> Documentation technique de référence : conception système, flux de données, sécurité, déploiement

---

## 📋 Table des matières

1. [Vue d'ensemble](#vue-densemble)
2. [Stack technique](#stack-technique)
3. [Structure du projet](#structure-du-projet)
4. [Couches applicatives](#couches-applicatives)
5. [Flux de données](#flux-de-données)
6. [Routes API](#routes-api)
7. [Sécurité & authentification](#sécurité--authentification)
8. [Base de données](#base-de-données)
9. [Performance & optimisation](#performance--optimisation)
10. [Déploiement & DevOps](#déploiement--devops)

---

## Vue d'ensemble

### Diagramme haut niveau

```
┌─────────────────────────────────────────────────────┐
│                   CLIENT BROWSER                    │
│              React 18 + Leaflet + Chart.js          │
└──────────────────────┬──────────────────────────────┘
                       │ HTTPS
┌──────────────────────▼──────────────────────────────┐
│                 EXPRESS.JS SERVER                   │
│                  Node.js ≥ 18 LTS                   │
├─────────────────────────────────────────────────────┤
│  middleware/auth.js    middleware/validation.js      │
│  Rate limiting         Helmet + CORS                 │
│  IP tracking           Account locking               │
├─────────────────────────────────────────────────────┤
│              routes/ (22 fichiers)                  │
│  *.routes.js — pattern Factory unifié               │
├─────────────────────────────────────────────────────┤
│              utils/ (point d'entrée unique)         │
│  tokenUtils  passwordUtils  errorCodes  helpers     │
└──────────────────────┬──────────────────────────────┘
                       │ node-postgres (pg)
┌──────────────────────▼──────────────────────────────┐
│                  POSTGRESQL ≥ 14                    │
│   Transactions ACID · PLpgSQL · audit_trail         │
└─────────────────────────────────────────────────────┘
```

### Pattern architectural

Architecture **en couches plate** (Flat Layered Architecture) sans controllers ni services dédiés :
- Le routing et la logique métier sont colocalisés dans chaque fichier `routes/*.routes.js`
- Le pattern **Factory** unifié assure la cohérence inter-routes
- Les utilitaires transverses sont centralisés dans `utils/index.js`
- Pas de dossiers `controllers/`, `services/`, `models/` — supprimés lors du refactoring V8

---

## Stack technique

### Backend

| Composant | Technologie | Version | Rôle |
|-----------|------------|---------|------|
| Runtime | Node.js | ≥ 18 LTS | Environnement JavaScript |
| Framework | Express.js | 4.x | Serveur HTTP & routing |
| Base de données | **PostgreSQL** | ≥ 14 | Persistance des données |
| Driver DB | node-postgres (`pg`) | 8.x | Connexion PostgreSQL |
| Auth | JWT (`jsonwebtoken`) | 9.x | Tokens stateless |
| Hachage | bcryptjs | — | Mots de passe (12 rounds) |
| Sécurité | Helmet | — | Headers HTTP sécurisés |
| Rate limiting | express-rate-limit | — | 1000 req/15min global, 10 req/15min auth |
| Logging | morgan / winston | — | Logs requêtes & erreurs |

### Frontend

| Composant | Technologie | Version | Rôle |
|-----------|------------|---------|------|
| UI Library | React | 18.x | Interface utilisateur |
| Cartes | Leaflet | 1.7+ | Cartographie interactive |
| Graphiques | Chart.js | 3.x+ | Visualisations statistiques |
| HTTP Client | Axios | — | Appels API |
| State | Context API | — | État global |
| Build | CRA / Webpack | — | Bundling |

### Infrastructure

| Composant | Technologie | Rôle |
|-----------|------------|------|
| Conteneurisation | Docker | Images applicatives |
| Orchestration | Docker Compose | Stack multi-conteneurs |
| Reverse proxy | Nginx | Terminaison TLS, proxy |
| TLS | Let's Encrypt | Certificats HTTPS |
| Contrôle de version | Git | Gestion du code source |

---

## Structure du projet

```
Gestion-Truffiere/          ← racine
│
├── backend/
│   ├── server.js           ← point d'entrée Express (~25 KB après refactoring)
│   ├── package.json
│   ├── Dockerfile
│   │
│   ├── config/
│   │   ├── database.js     ← pool node-postgres
│   │   └── security.js     ← CORS, Helmet
│   │
│   ├── middleware/
│   │   ├── auth.js         ← vérification JWT
│   │   └── validation.js   ← validation centralisée
│   │
│   ├── routes/             ← 22 fichiers, pattern Factory unifié
│   │   ├── auth.js                         ← 15 routes
│   │   ├── parcelles.routes.js
│   │   ├── arbres.routes.js
│   │   ├── recoltes.routes.js
│   │   ├── interventions.routes.js
│   │   ├── clients.routes.js
│   │   ├── ventes.routes.js
│   │   ├── commandes.routes.js
│   │   ├── fournisseurs.js
│   │   ├── achats-fournisseurs.routes.js
│   │   ├── stock.routes.js
│   │   ├── dashboard.routes.js
│   │   ├── stats.routes.js
│   │   ├── historique.routes.js
│   │   ├── parametres.routes.js
│   │   ├── preferences.routes.js
│   │   ├── especes.routes.js
│   │   ├── caveurs.routes.js
│   │   ├── chiens.routes.js
│   │   ├── produits-phyto.routes.js
│   │   ├── amendements-ref.routes.js
│   │   ├── types-intervention.routes.js
│   │   └── zones-production.routes.js
│   │
│   ├── utils/
│   │   └── index.js        ← point d'entrée unique (tokenUtils, passwordUtils,
│   │                          errorCodes, helpers, emptyToNull...)
│   │
│   └── docs/
│       └── API_ERROR_CODES.md  ← 85+ codes d'erreur standardisés
│
├── frontend/
│   ├── package.json
│   ├── Dockerfile
│   ├── public/
│   │   ├── index.html
│   │   ├── favicon.ico
│   │   └── manifest.json
│   └── src/
│       ├── App.js
│       ├── components/     ← 18 composants React
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
│       │   ├── GlobalSearch.js
│       │   ├── WeatherWidget.js
│       │   ├── Previsions.js
│       │   └── CSVImportModal.js
│       ├── context/
│       │   ├── AuthContext.js
│       │   └── ThemeContext.js
│       ├── hooks/
│       │   ├── useAuth.js
│       │   ├── useFetch.js
│       │   ├── useColumnSettings.js
│       │   └── useLocalStorage.js
│       ├── services/
│       │   ├── api.js
│       │   └── axiosConfig.js
│       └── utils/
│           ├── csvImport.js
│           ├── pdfExport.js
│           ├── formatters.js
│           └── helpers.js
│
├── database/
│   └── init_database.sql   ← schéma complet + seed data
│
├── docker-compose.yml
├── .env.exemple            ← template variables d'environnement
├── backup-db.sh
│
├── README.md
├── QUICKSTART.md
├── SETUP.md
├── DOCKER.md
├── API.md
├── ARCHITECTURE.md         ← ce fichier
└── CHANGELOG.md
```

> ⚠️ Il n'existe **pas** de dossiers `controllers/`, `services/`, `models/` ni `migrations/`  
> dans V8. Ces dossiers ont été supprimés lors du refactoring backend (voir [CHANGELOG.md](CHANGELOG.md)).

---

## Couches applicatives

### 1. Présentation — React (frontend)

- 18 composants fonctionnels React
- Gestion d'état via Context API (`AuthContext`, `ThemeContext`)
- Axios pour les appels API avec intercepteurs JWT
- Leaflet pour la cartographie
- Chart.js pour les statistiques visuelles
- Export PDF natif via `utils/pdfExport.js`
- Import CSV via `CSVImportModal.js`

### 2. API — Express.js (routes)

Chaque fichier `routes/*.routes.js` suit le **pattern Factory** :

```javascript
// Pattern unifié V8
const createRouter = (db) => {
  const router = express.Router();
  const { authenticateToken, generateAccessToken, logAuditTrail } = require('../utils');

  router.get('/', authenticateToken, async (req, res) => {
    try {
      const result = await db.query(
        'SELECT * FROM parcelles WHERE user_id = $1 ORDER BY created_at DESC',
        [req.user.id]
      );
      res.json({ status: 'success', data: result.rows });
    } catch (err) {
      res.status(500).json({ error: 'Erreur serveur', code: 'SERVER_ERROR' });
    }
  });

  return router;
};

module.exports = createRouter;
```

### 3. Middleware

```
middleware/auth.js
  └─ authenticateToken()     ← vérifie le JWT, injecte req.user

middleware/validation.js
  └─ validateBody(schema)    ← validation des entrées

server.js (inline middlewares)
  ├─ Helmet                  ← headers sécurisés
  ├─ CORS configurable       ← via CORS_ORIGIN env
  ├─ Rate limiting global    ← 1000 req / 15 min
  ├─ Rate limiting auth      ← 10 req / 15 min
  └─ Morgan logging          ← logs requêtes HTTP
```

### 4. Utilitaires centralisés (`utils/index.js`)

```javascript
module.exports = {
  // Auth
  authenticateToken,    // middleware JWT
  generateAccessToken,  // génère un access token 15min
  generateRefreshToken, // génère un refresh token 7j

  // Sécurité
  hashPassword,         // bcrypt 12 rounds
  comparePassword,      // bcrypt compare
  emptyToNull,          // normalise les champs vides

  // Audit
  logAuditTrail,        // écrit dans audit_trail

  // Erreurs
  ERROR_CODES,          // 85+ codes standardisés
  sendError,            // helper réponse erreur uniforme
};
```

### 5. Base de données — PostgreSQL

- Requêtes paramétrées (`$1, $2, ...`) — pas de concaténation SQL
- Transactions explicites avec `BEGIN / COMMIT / ROLLBACK`
- Fonctions PLpgSQL pour la logique métier complexe
- Table `audit_trail` pour la traçabilité complète

---

## Flux de données

### Cycle requête/réponse complet

```
1. ACTION UTILISATEUR
   └─ Clic / formulaire dans un composant React

2. FRONTEND
   └─ Handler → validation client → api.post('/parcelles', data)
   └─ Axios injecte automatiquement : Authorization: Bearer <accessToken>

3. HTTP REQUEST
   POST /api/parcelles
   Authorization: Bearer <JWT_15min>
   Body: { nom, surface_hectares, localisation, ... }

4. MIDDLEWARE CHAIN (server.js → route)
   ├─ Helmet           ← headers sécurisés ajoutés
   ├─ Rate limiter      ← compteur incrémenté
   ├─ CORS             ← origine vérifiée
   ├─ authenticateToken ← JWT décodé, req.user injecté
   └─ validateBody     ← schéma vérifié

5. HANDLER (dans routes/parcelles.routes.js)
   ├─ Logique métier
   ├─ db.query(parameterized SQL)
   ├─ logAuditTrail({ action: 'CREATE', ... })
   └─ res.status(201).json({ status: 'success', data: {...} })

6. RÉPONSE HTTP
   201 Created
   { status: 'success', data: { id, nom, ... }, timestamp }

7. FRONTEND
   └─ Mise à jour état React → re-render composant → notification
```

### Refresh token flow

```
Access token expiré (15 min)
  └─ Axios interceptor → POST /api/auth/refresh
       ├─ Refresh token vérifié (7 jours)
       ├─ Rotation : ancien refresh invalidé, nouveau généré
       ├─ Nouveau access token retourné
       └─ Requête originale relancée automatiquement

Si refresh token expiré ou réutilisation détectée
  └─ Déconnexion forcée → redirect /login
```

---

## Routes API

### Récapitulatif des 22 fichiers routes

| Fichier | Préfixe | Routes | Domaine |
|---------|---------|--------|---------|
| `auth.js` | `/api/auth` | 15 | Login, logout, refresh, profil, users |
| `parcelles.routes.js` | `/api/parcelles` | ~8 | Gestion parcelles |
| `arbres.routes.js` | `/api/arbres` | ~8 | Gestion arbres |
| `interventions.routes.js` | `/api/interventions` | ~10 | Interventions |
| `recoltes.routes.js` | `/api/recoltes` | ~6 | Récoltes |
| `commandes.routes.js` | `/api/commandes` | ~8 | Commandes clients |
| `clients.routes.js` | `/api/clients` | ~6 | Clients |
| `ventes.routes.js` | `/api/ventes` | ~6 | Ventes |
| `fournisseurs.js` | `/api/fournisseurs` | ~6 | Fournisseurs |
| `achats-fournisseurs.routes.js` | `/api/achats-fournisseurs` | ~8 | Achats |
| `stock.routes.js` | `/api/stock` | ~6 | Stock |
| `dashboard.routes.js` | `/api/dashboard` | ~5 | Statistiques dashboard |
| `stats.routes.js` | `/api/stats` | ~4 | Statistiques avancées |
| `historique.routes.js` | `/api/historique` | ~4 | Audit trail |
| `parametres.routes.js` | `/api/parametres` | ~6 | Paramètres app |
| `preferences.routes.js` | `/api/preferences` | ~3 | Préférences utilisateur |
| `especes.routes.js` | `/api/especes` | ~4 | Référentiel espèces |
| `caveurs.routes.js` | `/api/caveurs` | ~4 | Caveurs |
| `chiens.routes.js` | `/api/chiens` | ~4 | Chiens |
| `produits-phyto.routes.js` | `/api/produits-phyto` | ~5 | Produits phytosanitaires |
| `amendements-ref.routes.js` | `/api/amendements-ref` | ~5 | Référentiel amendements |
| `types-intervention.routes.js` | `/api/types-intervention` | ~3 | Types d'intervention |
| `zones-production.routes.js` | `/api/zones-production` | ~3 | Zones de production |

**Total : ~150+ endpoints** — voir [API.md](API.md) pour la documentation complète.

### Format de réponse uniforme

```javascript
// Succès
{ status: 'success', data: { ... }, timestamp: '2026-...' }

// Erreur
{ error: 'Message en français', code: 'ERROR_CODE', details: '...' }
// 'details' affiché uniquement si NODE_ENV=development
```

Codes d'erreur standardisés → voir [backend/docs/API_ERROR_CODES.md](backend/docs/API_ERROR_CODES.md)

---

## Sécurité & authentification

### Flux JWT complet

```
POST /api/auth/login
  ├─ Rate limiting auth : 10 req / 15 min par IP
  ├─ Compte vérifié (account locking : 5 tentatives → 15 min de blocage)
  ├─ bcrypt.compare() — 12 rounds
  ├─ Access token  : JWT signé, exp = 15 minutes
  └─ Refresh token : JWT signé, exp = 7 jours, stocké en DB

Requêtes authentifiées
  ├─ Authorization: Bearer <accessToken>
  ├─ middleware/auth.js → jwt.verify() → req.user injecté
  └─ Si expiré : 401 → client appelle POST /api/auth/refresh

Rotation des refresh tokens
  ├─ Chaque utilisation d'un refresh token en génère un nouveau
  ├─ L'ancien est immédiatement invalidé en DB
  └─ Réutilisation d'un token révoqué → déconnexion totale (détection de vol)
```

### Mesures de sécurité actives

| Mesure | Détail |
|--------|--------|
| bcrypt | 12 salt rounds |
| JWT access | Expiration 15 min |
| JWT refresh | Expiration 7 jours + rotation |
| Account locking | 5 tentatives échouées → blocage 15 min |
| Rate limiting global | 1000 req / 15 min |
| Rate limiting auth | 10 req / 15 min |
| IP tracking | Sur login, logout, actions sensibles |
| Helmet | Headers HTTP sécurisés |
| CORS | Configurable via `CORS_ORIGIN` |
| SQL injection | Requêtes 100% paramétrées (`$1, $2...`) |
| Audit trail | Toutes actions Create/Update/Delete/Auth tracées |
| Security events | Logging des événements suspects |

### RBAC — Contrôle d'accès par rôle

```javascript
const ROLES = {
  ADMIN: 'admin',       // accès complet
  USER: 'user',         // lecture/écriture sur ses données
  READONLY: 'readonly'  // lecture seule
};

// Exemple dans une route
router.delete('/:id',
  authenticateToken,
  requireRole(['admin']),
  async (req, res) => { /* ... */ }
);
```

---

## Base de données

### Schéma principal

```
users
  └─┬── parcelles
    │     └─┬── arbres
    │       └─┬── recoltes
    │         └── interventions
    ├── clients
    │     └── commandes → ventes
    ├── fournisseurs
    │     └── achats_fournisseurs
    ├── stock
    ├── especes          (référentiel)
    ├── types_intervention (référentiel)
    ├── amendements_ref  (référentiel)
    ├── produits_phyto   (référentiel)
    ├── caveurs
    ├── chiens
    ├── zones_production
    ├── preferences_utilisateur
    └── audit_trail      (traçabilité)
```

### Connexion PostgreSQL (node-postgres)

```javascript
// backend/config/database.js
const { Pool } = require('pg');

const pool = new Pool({
  host:     process.env.DATABASE_HOST,
  port:     process.env.DATABASE_PORT || 5432,
  database: process.env.DATABASE_NAME,
  user:     process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  max: 20,              // max connexions simultanées
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

module.exports = pool;
```

### Patterns SQL utilisés

```sql
-- Requêtes paramétrées (obligatoire)
SELECT * FROM parcelles WHERE user_id = $1 AND deleted_at IS NULL;

-- Transactions explicites
BEGIN;
  INSERT INTO recoltes (...) VALUES ($1, $2, $3);
  UPDATE arbres SET derniere_recolte = NOW() WHERE id = $4;
COMMIT;

-- Soft delete
UPDATE parcelles SET deleted_at = NOW() WHERE id = $1;

-- Audit trail
INSERT INTO audit_trail (user_id, action, table_name, record_id, old_data, new_data, metadata, ip_address)
VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7::jsonb, $8);

-- Erreur PostgreSQL spécifique
-- Code 23505 = UNIQUE_VIOLATION → message métier en français
```

### Initialisation

```bash
# Importer le schéma complet
psql -U truffiere -d gestion_truffiere -f database/init_database.sql
```

---

## Performance & optimisation

### Index clés

```sql
-- Relations fréquentes
CREATE INDEX idx_parcelle_user    ON parcelles(user_id);
CREATE INDEX idx_arbre_parcelle   ON arbres(parcelle_id);
CREATE INDEX idx_recolte_date     ON recoltes(date_recolte);
CREATE INDEX idx_intervention_date ON interventions(date_intervention);
CREATE INDEX idx_audit_user_date  ON audit_trail(user_id, timestamp);
```

### Pool de connexions

Max 20 connexions simultanées — adapté à une exploitation truffière mono-utilisateur  
à multi-utilisateurs restreints. Ajuster `max` si charge plus importante.

### Frontend

```javascript
// Lazy loading des composants lourds
const Statistiques = React.lazy(() => import('./components/Statistiques'));
const Carte        = React.lazy(() => import('./components/Carte'));

// Memoïsation
const ParcelleCard = React.memo(({ parcelle }) => { /* ... */ });
```

---

## Déploiement & DevOps

### Docker Compose (stack complète)

```yaml
services:
  db:
    image: postgres:16-alpine       # PostgreSQL — pas MySQL
    environment:
      POSTGRES_DB:       gestion_truffiere
      POSTGRES_USER:     truffiere
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - db_data:/var/lib/postgresql/data
      - ./database/init_database.sql:/docker-entrypoint-initdb.d/init.sql

  backend:
    build: ./backend
    environment:
      NODE_ENV:          production
      DATABASE_HOST:     db
      JWT_SECRET:        ${JWT_SECRET}
      JWT_EXPIRATION:    15m           # immuable — politique sécurité V8
      CORS_ORIGIN:       ${FRONTEND_URL}
    depends_on:
      db:
        condition: service_healthy

  frontend:
    build: ./frontend
    environment:
      REACT_APP_API_URL: ${BACKEND_URL}/api
    depends_on:
      - backend
```

Guide complet → [DOCKER.md](DOCKER.md)

### Checklist production

```bash
# Vérifier les variables critiques
grep -E 'JWT_SECRET|DB_PASSWORD|CORS_ORIGIN' .env

# Santé de l'API
curl https://m-a-truffes.sytes.net/api/health

# Logs temps réel
docker compose logs -f backend

# Audit trail récent
psql -U truffiere -d gestion_truffiere \
  -c "SELECT user_id, action, table_name, timestamp FROM audit_trail ORDER BY timestamp DESC LIMIT 20;"
```

---

## Roadmap technique

| Priorité | Item | Statut |
|----------|------|--------|
| 🔴 Haute | Tests Jest + React Testing Library | Non démarré |
| 🔴 Haute | Swagger/OpenAPI auto-généré | Non démarré |
| 🟡 Moyenne | PWA offline (Service Worker) | Non démarré |
| 🟡 Moyenne | Alertes intelligentes (seuils récolte) | Non démarré |
| 🟢 Basse | PDF avancés (graphiques embarqués) | Non démarré |
| 🟢 Basse | GitHub Actions CI/CD | Non démarré |

---

*Dernière mise à jour : mai 2026 — V8*  
*Voir [CHANGELOG.md](CHANGELOG.md) pour l'historique des modifications*
