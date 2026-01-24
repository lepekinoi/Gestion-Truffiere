# 🍄 Gestion-Truffière v6 - Plateforme de gestion intégrée

> **Système complet de gestion pour exploitations truffières en Pays de la Loire**  
> Stack moderne React + Express.js | Docker ready | Production-ready

[![Status](https://img.shields.io/badge/Status-Finalisation-FF6B6B?style=flat-square)](https://github.com/lepekinoi/Gestion-Truffiere)
[![Version](https://img.shields.io/badge/Version-6.0-4ECDC4?style=flat-square)](https://github.com/lepekinoi/Gestion-Truffiere/releases)
[![JavaScript](https://img.shields.io/badge/JavaScript-ES6+-F7DF1E?style=flat-square&logo=javascript)](https://www.javascript.com/)
[![License](https://img.shields.io/badge/License-MIT-2ECC71?style=flat-square)](LICENSE)
[![Last Update](https://img.shields.io/badge/Last%20Update-Jan%202026-3498DB?style=flat-square)](https://github.com/lepekinoi/Gestion-Truffiere/commits/V6)

---

## 📋 Table des matières

- [✨ Aperçu rapide](#-aperçu-rapide)
- [🎯 Fonctionnalités](#-fonctionnalités-complètes)
- [🏗️ Architecture](#-architecture-technique)
- [🚀 Démarrage rapide](#-démarrage-rapide)
- [📦 Installation détaillée](#-installation-détaillée)
- [🗄️ Base de données](#-base-de-données)
- [📖 Documentation](#-documentation-technique)
- [🐛 Problèmes connus & Axes d'amélioration](#-problèmes-connus--axes-daméliorations)
- [💡 Prochains ajouts suggérés](#-prochains-ajouts-suggérés)
- [🔧 Configuration avancée](#-configuration-avancée)
- [🤝 Contribution](#-contribution)
- [📞 Support](#-support)

---

## ✨ Aperçu rapide

### 🎨 Qu'est-ce que c'est?

**Gestion-Truffière v6** est une plateforme web d'**entreprise** conçue spécifiquement pour les exploitants truffiers. Elle centralise l'ensemble de la gestion opérationnelle :

```
┌─────────────────────────────────────────┐
│   🍄 GESTION-TRUFFIÈRE v6              │
├─────────────────────────────────────────┤
│                                         │
│  📊 Dashboard temps réel               │
│  🗺️  Cartographie interactive          │
│  🌳 Suivi sanitaire des arbres         │
│  📈 Récoltes & statistiques            │
│  🔧 Interventions détaillées           │
│  👥 Gestion collaborativ               │
│  📤 Exports (PDF, CSV, rapports)       │
│  🔐 Authentification sécurisée         │
│                                         │
└─────────────────────────────────────────┘
```

### 💡 Cas d'usage principales

- **Agriculteur** : Suivi quotidien parcelles/arbres, historique interventions
- **Responsable Exploitation** : Analytics, prévisions, gestion équipes
- **Administrateur** : Rapports financiers, statistiques agrégées, conformité

---

## 🎯 Fonctionnalités complètes

### ✅ Core Features (v6.0 - Production Ready)

#### 📊 **Dashboard & Analytics**
- Vue d'ensemble temps réel
- Statistiques clés agrégées
- Widget météo intégré
- Indicateurs de rendement
- Alertes importantes

#### 🗺️ **Cartographie avancée**
- Visualisation Leaflet (OpenStreetMap)
- Marqueurs parcelles interactifs
- Zoom & navigation intuitive
- Export vue terrain

#### 🌳 **Gestion des parcelles**
- CRUD complet (Create, Read, Update, Delete)
- Localisation GPS
- Historique modifications
- Suivi surface et composition
- Lien avec arbres

#### 🌱 **Gestion des arbres**
- Enregistrement détaillé
- Calendrier plantation/récolte
- Suivi sanitaire (maladies, traitements)
- Classification par âge/variété
- État phytosanitaire

#### 📦 **Récoltes & rendements**
- Enregistrement des récoltes
- Quantités par parcelle
- Dates et conditions
- Statistiques production
- Tendances annuelles

#### 🔧 **Interventions & maintenance**
- Log complet des actions
- Dates, responsable, description
- Coûts associés
- Suivi maintenance équipements
- Traçabilité audit

#### 👥 **Gestion collaborative**
- Authentification JWT sécurisée
- Gestion multi-utilisateurs
- Rôles et permissions (Admin, User, Viewer)
- Changement mot de passe
- Historique connexions

#### 📤 **Import/Export & rapports**
- Import CSV (données en batch)
- Export PDF de rapports
- Export CSV pour analyses externes
- Génération historiques
- Sauvegarde données

#### 🔍 **Recherche & filtres**
- Recherche globale multi-modules
- Filtres par parcelle, arbre, date
- Tri colonnes
- Sauvegarde critères

### 🔄 En développement / Finalisation

| Fonctionnalité | État | Priorité | Notes |
|---|---|---|---|
| **Achats/Fournisseurs** | ⚠️ Incomplet | 🔴 URGENT | Routes API manquantes, UI incomplète |
| **Dashboards corrections** | 🔨 En cours | 🔴 URGENT | Bugs affichage certains graphiques |
| **Interventions détaillées** | 🐛 Bug critique | 🔴 URGENT | Données ne s'enregistrent pas |

### 🚀 Prévisions futures

- [ ] Notifications temps réel (WebSockets)
- [ ] Mobile app (React Native)
- [ ] Analytics avancée & IA
- [ ] Export rapports automatisés
- [ ] Intégration API externes (météo+, données agronomiques)
- [ ] Mode offline
- [ ] Calendrier collaboratif

---

## 🏗️ Architecture technique

### 🔷 Vue d'ensemble

```
                     ┌─────────────────────┐
                     │   CLIENT BROWSER    │
                     │  (React.js + UI)    │
                     └──────────┬──────────┘
                                │
                    ┌───────────┴──────────┐
                    │   HTTPS/WebSocket   │
                    └───────────┬──────────┘
                                │
                     ┌──────────▼──────────┐
                     │  EXPRESS.JS SERVER │
                     │  (API REST/Graph)  │
                     │  + JWT Auth        │
                     └───────┬────────┬───┘
                             │        │
                    ┌────────▼──┐  ┌─▼────────┐
                    │    SQL    │  │  Cache   │
                    │  DATABASE │  │  Redis?  │
                    └───────────┘  └──────────┘
```

### 📁 Structure des dossiers

```
Gestion-Truffiere/
│
├── 🔷 BACKEND
│   ├── server.js                    # Serveur principal Express (126 KB)
│   ├── package.json                 # Dépendances Node.js
│   ├── Dockerfile                   # Container backend
│   │
│   ├── /config                      # Configuration
│   │   └── security.js              # CORS, headers sécurité
│   │
│   ├── /routes                      # Endpoints API
│   │   ├── auth.js                  # Auth endpoints
│   │   ├── parcelles.js             # Parcelles CRUD
│   │   ├── arbres.js                # Arbres CRUD
│   │   ├── recoltes.js              # Récoltes CRUD
│   │   ├── interventions.js         # Interventions CRUD
│   │   └── ...                      # Autres ressources
│   │
│   ├── /middleware                  # Middlewares Express
│   │   ├── auth.js                  # JWT verification
│   │   ├── validation.js            # Input validation
│   │   └── errorHandler.js          # Error handling
│   │
│   ├── /controllers                 # Logique métier
│   │   ├── authController.js
│   │   ├── parcellesController.js
│   │   └── ...                      # Controllers par ressource
│   │
│   ├── /utils                       # Utilitaires
│   │   ├── tokens.js                # JWT generation/verification
│   │   ├── database.js              # DB connection pool
│   │   └── helpers.js               # Helper functions
│   │
│   ├── /migrations                  # DB Migrations (versioning)
│   ├── /docs                        # API documentation
│   └── /tests                       # Tests backend (Jest)
│
│
├── 🔵 FRONTEND
│   ├── package.json                 # Dépendances React
│   ├── package-lock.json            # Lock versions
│   ├── Dockerfile                   # Container frontend
│   │
│   ├── /public                      # Static assets
│   │   ├── index.html               # HTML template
│   │   ├── favicon.ico              # Icon
│   │   └── ...
│   │
│   └── /src                         # Code source React
│       ├── index.js                 # React entry point
│       ├── App.js                   # Root component
│       ├── App.css                  # Global styles
│       │
│       ├── /components              # React Components (18 fichiers)
│       │   ├── Dashboard.js         # Vue d'ensemble
│       │   ├── Parcelles.js         # Gestion parcelles
│       │   ├── Arbres.js            # Gestion arbres
│       │   ├── Recoltes.js          # Suivi récoltes
│       │   ├── Interventions.js     # Log interventions
│       │   ├── Statistiques.js      # Graphiques/stats
│       │   ├── Previsions.js        # Prévisions
│       │   ├── Carte.js             # Visualisation map
│       │   ├── WeatherWidget.js     # Météo
│       │   ├── GlobalSearch.js      # Recherche
│       │   ├── Historique.js        # Activity log
│       │   ├── Login.js             # Auth page
│       │   ├── UserManagement.js    # Users CRUD
│       │   ├── ChangePassword.js    # Password form
│       │   ├── Parametres.js        # Settings
│       │   ├── Commercial.js        # Business view
│       │   └── CSVImportModal.js    # CSV import
│       │
│       ├── /services                # API Services
│       │   ├── api.js               # API client (Axios)
│       │   ├── axiosConfig.js       # Axios configuration
│       │   └── endpoints.js         # API endpoints constants
│       │
│       ├── /context                 # React Context
│       │   ├── AuthContext.js       # Auth state management
│       │   ├── AppContext.js        # App global state
│       │   └── ThemeContext.js      # Theme (light/dark)
│       │
│       ├── /hooks                   # Custom React Hooks
│       │   ├── useColumnSettings.js # Column config hook
│       │   ├── useFetch.js          # Data fetching
│       │   └── useAuth.js           # Auth helper
│       │
│       └── /utils                   # Utilities
│           ├── csvImport.js         # CSV parsing
│           ├── pdfExport.js         # PDF generation
│           ├── validators.js        # Form validation
│           └── formatters.js        # Data formatters
│
│
├── 🗄️ DATABASE
│   ├── init-db.sql                  # DB Schema (31.6 KB)
│   ├── migrations/
│   │   ├── 001_initial_schema.sql
│   │   ├── 002_add_users.sql
│   │   └── ...
│   └── backups/                     # DB backups
│
│
├── 🐳 DOCKER
│   ├── docker-compose.yml           # Orchestration conteneurs
│   ├── backend/Dockerfile           # Image backend
│   └── frontend/Dockerfile          # Image frontend
│
│
├── 📚 DOCUMENTATION
│   ├── README.md                    # Cette doc
│   ├── 📡 [API.md](API.md)          # **API REST documentation**
│   ├── 🏠 [ARCHITECTURE.md](ARCHITECTURE.md)          # **Architecture détaillée**
│   ├── 📋 [ROADMAP_V6_FEATURES.md](ROADMAP_V6_FEATURES.md)  # **Feuille de route v6+**
│   ├── CHANGELOG.md                 # Version history
│   ├── SETUP.md                     # Installation guide
│   ├── TROUBLESHOOTING.md           # Problèmes courants
│   └── CONTRIBUTING.md              # Guide contribution
│
├── 🔧 CONFIGURATION
│   ├── .env.example                 # Template variables env
│   ├── .gitignore                   # Git ignore rules
│   └── package.json                 # Root package (optional)
│
└── 📄 Fichiers racine
    └── README.md (CETTE DOC!)
```

### 🔗 Flux de communication

```
┌────────────────────────────────────────────────────────────┐
│ FRONTEND (React)                                           │
│ ┌──────────────────────────────────────────────────────┐  │
│ │ Component renders                                    │  │
│ │ → User interaction (click, input, etc.)            │  │
│ │ → useEffect/Hook triggers                          │  │
│ │ → Call API service                                 │  │
│ └──────────────────────────────────────────────────────┘  │
└────────────┬─────────────────────────────────────────────┘
             │
             │ POST /api/parcelles (JSON)
             │ Headers: { Authorization: "Bearer JWT_TOKEN" }
             │
             ▼
┌────────────────────────────────────────────────────────────┐
│ BACKEND (Express.js)                                       │
│ ┌──────────────────────────────────────────────────────┐  │
│ │ 1. Request route matching                           │  │
│ │ 2. JWT middleware verification                      │  │
│ │ 3. Validation middleware (input check)              │  │
│ │ 4. Route handler/Controller logic                   │  │
│ │ 5. Database query execution                         │  │
│ │ 6. Response formatting                              │  │
│ │ 7. Send JSON response                               │  │
│ └──────────────────────────────────────────────────────┘  │
└────────────┬─────────────────────────────────────────────┘
             │
             │ 200 OK { id, name, ... } (JSON)
             │
             ▼
┌────────────────────────────────────────────────────────────┐
│ FRONTEND (React)                                           │
│ ┌──────────────────────────────────────────────────────┐  │
│ │ 1. API response received                            │  │
│ │ 2. Update React state                               │  │
│ │ 3. Component re-renders                             │  │
│ │ 4. UI shows new data                                │  │
│ │ 5. User feedback (toast notification)               │  │
│ └──────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────┘
```

---

## 🚀 Démarrage rapide

### ⚡ Avec Docker (Recommandé)

```bash
# 1. Cloner le repo
git clone https://github.com/lepekinoi/Gestion-Truffiere.git
cd Gestion-Truffiere
git checkout V6

# 2. Créer fichier .env
cp backend/.env.example backend/.env
# Éditer backend/.env avec vos paramètres

# 3. Lancer tous les services
docker-compose up -d

# 4. Accéder à l'app
# Frontend : http://localhost:3000
# Backend API : http://localhost:5000
# Database : localhost:3306 (si MySQL exposé)
```

### 📝 Sans Docker (Développement)

```bash
# === BACKEND ===
cd backend
npm install
npm start
# Backend running on http://localhost:5000

# === FRONTEND (nouveau terminal) ===
cd frontend
npm install
npm start
# Frontend running on http://localhost:3000
```

---

## 📦 Installation détaillée

### Prérequis

```bash
# Required
✅ Node.js >= 14.x          # node --version
✅ npm >= 6.x or yarn       # npm --version
✅ Git                       # git --version
✅ Database                  # MySQL 5.7+ / PostgreSQL 12+ / SQLite

# Optional but recommended
✅ Docker >= 20.10          # docker --version
✅ Docker Compose >= 1.29   # docker-compose --version
✅ Code editor (VSCode)
✅ Postman/Insomnia for API testing
```

### Étape 1️⃣ : Cloner le projet

```bash
git clone https://github.com/lepekinoi/Gestion-Truffiere.git
cd Gestion-Truffiere
git checkout V6  # Important: V6 branch
```

### Étape 2️⃣ : Configuration base de données

#### Option A: MySQL (Recommandé pour production)

```bash
# Créer la base de données
mysql -u root -p < init-db.sql

# Vérifier la création
mysql -u root -p -e "SHOW DATABASES LIKE 'gestion_truffiere';"
```

#### Option B: PostgreSQL

```bash
# Créer la base de données
psql -U postgres < init-db.sql

# Vérifier
psql -U postgres -l | grep gestion_truffiere
```

#### Option C: SQLite (Développement)

```bash
# SQLite crée automatiquement la DB
# Adapter init-db.sql pour SQLite ou utiliser tool de migration
```

### Étape 3️⃣ : Configuration Backend

```bash
cd backend

# 1. Installer dépendances
npm install

# 2. Créer .env
cat > .env << EOF
# Server
PORT=5000
NODE_ENV=development

# Database
DATABASE_HOST=localhost
DATABASE_PORT=3306
DATABASE_NAME=gestion_truffiere
DATABASE_USER=root
DATABASE_PASSWORD=your_password

# JWT
JWT_SECRET=votre_clé_très_secrète_min_32_caractères_aléatoire
JWT_REFRESH_SECRET=autre_clé_refresh_aussi_secrète
JWT_EXPIRATION=1h
JWT_REFRESH_EXPIRATION=7d

# CORS
CORS_ORIGIN=http://localhost:3000

# Logger
LOG_LEVEL=debug
EOF

# 3. Tester connexion DB
npm run test:db

# 4. Lancer le serveur
npm start
```

### Étape 4️⃣ : Configuration Frontend

```bash
cd frontend

# 1. Installer dépendances
npm install

# 2. Créer fichier config
cat > src/config/api.js << EOF
export const API_BASE_URL = 'http://localhost:5000/api';
export const API_TIMEOUT = 30000;
export const DEBUG = true;
EOF

# 3. Lancer le dev server
npm start
# L'app s'ouvre automatiquement sur http://localhost:3000
```

### Étape 5️⃣ : Connexion & test

```bash
# 1. Ouvrir l'app
# → http://localhost:3000

# 2. Se connecter
# Créer utilisateur admin:
# Email: admin@example.com
# Password: AdminPassword123!

# 3. Vérifier fonctionnalités
# ✅ Dashboard se charge
# ✅ Parcelles listées
# ✅ Carte s'affiche
# ✅ Interventions se charge
```

---

## 🗄️ Base de données

### 📋 Schéma principal

Le fichier `init-db.sql` contient l'**intégralité** du schéma :

#### 📊 Tables principales

```sql
-- Users & Auth
users
  ├─ id (PK)
  ├─ email (UNIQUE)
  ├─ password_hash
  ├─ nom, prenom
  ├─ role (admin/user/viewer)
  ├─ created_at
  └─ last_login

-- Données métier
parcelles
  ├─ id (PK)
  ├─ nom
  ├─ localisation (GEOMETRY/POINT)
  ├─ surface_hectares
  ├─ created_at
  └─ updated_at

arbres
  ├─ id (PK)
  ├─ parcelle_id (FK)
  ├─ variete
  ├─ date_plantation
  ├─ etat_sanitaire
  ├─ created_at
  └─ updated_at

recoltes
  ├─ id (PK)
  ├─ parcelle_id (FK)
  ├─ date_recolte
  ├─ quantite_kg
  ├─ qualite
  ├─ created_at
  └─ updated_at

interventions
  ├─ id (PK)
  ├─ parcelle_id (FK)
  ├─ type (traitement/taille/autre)
  ├─ description
  ├─ date_intervention
  ├─ responsable
  ├─ coût
  ├─ created_at
  └─ updated_at

-- À implémenter
achats
  ├─ id (PK)
  ├─ fournisseur_id (FK)
  ├─ produit
  ├─ quantité
  ├─ prix_unitaire
  ├─ date_achat
  └─ created_at

fournisseurs
  ├─ id (PK)
  ├─ nom
  ├─ contact
  ├─ email
  ├─ telephone
  ├─ adresse
  └─ created_at
```

### 🔧 Opérations courantes

```bash
# === DÉVELOPPEMENT ===

# Reset complet (attention: perte données!)
mysql -u root -p -e "DROP DATABASE IF EXISTS gestion_truffiere;"
mysql -u root -p < init-db.sql

# Vérifier structure
mysql -u root -p gestion_truffiere -e "SHOW TABLES;"
mysql -u root -p gestion_truffiere -e "DESCRIBE parcelles;"

# Insérer données test
mysql -u root -p gestion_truffiere << EOF
INSERT INTO users (email, password_hash, nom, prenom, role)
VALUES ('admin@test.com', 'hash_here', 'Admin', 'Test', 'admin');
EOF

# Backup
mysqldump -u root -p gestion_truffiere > backup_$(date +%Y%m%d_%H%M%S).sql

# Restore
mysql -u root -p gestion_truffiere < backup_20260120_143000.sql
```

---

## 📖 Documentation technique

### 📚 Ressources documentations

**Documentation principaux** :

- **[📡 API.md](API.md)** - **Documentation REST API complète**
  - Tous les endpoints REST
  - Exemples de requêtes/réponses
  - Status codes & error handling
  - Rate limiting & pagination
  - Authentication détaillée

- **[🏠 ARCHITECTURE.md](ARCHITECTURE.md)** - **Architecture détaillée du système**
  - Diagrammes architecture
  - Stack technologique complet
  - Structure dossiers backend/frontend
  - Schéma base de données
  - Flux de données
  - Sécurité & performance
  - DevOps & déploiement
  - Monitoring & logging

- **[📋 ROADMAP_V6_FEATURES.md](ROADMAP_V6_FEATURES.md)** - **Feuille de route v6+**
  - Grille de priorités
  - Timeline recommandée
  - Détail 7 fonctionnalités majeures
  - Architecture implémentations
  - Exemples de code complets
  - Budget estimations
  - Stack recommendations

**Documentation secondaires** :

- **CHANGELOG.md** - Version history
- **DATABASE.md** - Schema & migrations
- **AUTH.md** - Système authentification JWT
- **DEPLOYMENT.md** - Guide déploiement production
- **TROUBLESHOOTING.md** - Problèmes courants
- **CONTRIBUTING.md** - Guide contribution

### 🔌 API principales endpoints

```
POST   /api/auth/login              - Connexion
POST   /api/auth/logout             - Déconnexion
POST   /api/auth/refresh            - Refresh token

GET    /api/parcelles               - Lister parcelles
GET    /api/parcelles/:id           - Détail parcelle
POST   /api/parcelles               - Créer parcelle
PUT    /api/parcelles/:id           - Modifier parcelle
DELETE /api/parcelles/:id           - Supprimer parcelle

GET    /api/arbres                  - Lister arbres
POST   /api/arbres                  - Créer arbre
PUT    /api/arbres/:id              - Modifier arbre

GET    /api/recoltes                - Lister récoltes
POST   /api/recoltes                - Enregistrer récolte

GET    /api/interventions           - Lister interventions
POST   /api/interventions           - Créer intervention

GET    /api/statistiques            - Stats agrégées
GET    /api/statistiques/recoltes   - Stats récoltes

GET    /api/users                   - Lister users (admin)
POST   /api/users                   - Créer user (admin)

GET    /api/health                  - Health check
```

**→ Voir [API.md](API.md) pour documentation complète avec exemples curl**

---

## 🐛 Problèmes connus & Axes d'améliorations

### 🔴 URGENT - À corriger immédiatement

#### 1. **Bug CRITIQUE: Interventions détaillées ne s'enregistrent pas**

**Symptôme** :
- Formulaire interventions se soumet sans erreur
- Message "Succès" s'affiche
- Données n'apparaissent PAS en base

**Causes possibles** :
- Validation backend trop stricte rejette les données silencieusement
- Format JSON mal formé
- Token JWT expiré/invalide
- Paramètres manquants dans requête

**À investiguer** :
```bash
# 1. Vérifier logs backend
docker logs backend
grep "intervention" logs.txt

# 2. Tester endpoint avec Postman
POST http://localhost:5000/api/interventions
Header: Authorization: Bearer <token>
Body: {
  "parcelle_id": 1,
  "type": "traitement",
  "description": "Test",
  "date_intervention": "2026-01-20",
  "coût": 100
}

# 3. Vérifier BD directement
mysql -u root -p gestion_truffiere
SELECT * FROM interventions WHERE created_at > DATE_SUB(NOW(), INTERVAL 1 HOUR);
```

**Solution** :
- [ ] Vérifier `/backend/routes/interventions.js`
- [ ] Vérifier validation middleware
- [ ] Ajouter logging détaillé
- [ ] Tester avec curl/Postman
- [ ] Vérifier format données envoyées

---

#### 2. **Plusieurs Dashboards ont des bugs d'affichage**

**Symptôme** :
- Certains graphiques ne se chargent pas
- Données manquantes/null
- Layout cassé

**Causes probables** :
- API calls non synchronisées
- Données mal mappées
- Erreurs JavaScript non loggées
- Responsive design issues

**À investiguer** :
```bash
# 1. Ouvrir DevTools du navigateur
F12 → Console
# Vérifier erreurs JavaScript

# 2. Onglet Network
# Vérifier requêtes API (200 vs 404/500)

# 3. Vérifier état React
# Redux DevTools / React DevTools
```

**Solution** :
- [ ] Auditer `frontend/src/components/Dashboard.js`
- [ ] Ajouter error boundaries
- [ ] Logging API responses
- [ ] Tester chaque graphique individuellement

---

#### 3. **Achats/Fournisseurs incomplet**

**État** :
- Routes backend manquantes
- Composant React incomplet
- Tables BD probablement vides/mal structurées

**À implémenter** :

```javascript
// Backend routes à créer:
POST /api/fournisseurs           - Créer fournisseur
GET  /api/fournisseurs           - Lister fournisseurs
PUT  /api/fournisseurs/:id       - Modifier fournisseur
DELETE /api/fournisseurs/:id     - Supprimer fournisseur

POST /api/achats                 - Enregistrer achat
GET  /api/achats                 - Lister achats (avec filtres)
PUT  /api/achats/:id             - Modifier achat
DELETE /api/achats/:id           - Supprimer achat
GET  /api/achats/fournisseur/:id - Achats par fournisseur
```

**Composants à créer** :
- `Fournisseurs.js` - CRUD fournisseurs
- `Achats.js` - Gestion achats
- `FournisseurForm.js` - Formulaire fournisseur
- `AchatForm.js` - Formulaire achat

---

### 🟡 À améliorer (Moyen terme)

| Problème | Impact | Effort | Solution |
|----------|--------|--------|----------|
| server.js trop volumineux (126 KB) | Maintenabilité | 🔴 Haut | Refactoriser en modules |
| Pas de tests (unit/intégration) | Qualité | 🟡 Moyen | Ajouter Jest + tests |
| Documentation API manquante | Onboarding | 🟡 Moyen | Ajouter Swagger/OpenAPI |
| Pas de logging production | Débogage | 🟡 Moyen | Implémenter Winston |
| Sécurité: Audit dépendances | Sécurité | 🟡 Moyen | npm audit + update |
| UX mobile non optimisée | Usabilité | 🟡 Moyen | Responsive design audit |
| Pas de monitoring/alertes | Ops | 🟠 Bas | Ajouter Sentry |

---

## 💡 Prochains ajouts suggérés

### 📱 Option 1: Progressive Web App (PWA) + Mobile

**Bénéfice** : Les agriculteurs travaillent en champ → accès mobile natif, offline mode

**Valeur ajoutée** :
- ✅ Fonctionne hors ligne (Service Workers)
- ✅ Icône launcher sur téléphone
- ✅ Synchronisation auto données offline
- ✅ Push notifications
- ✅ Accès caméra pour photos terrain

**Effort** : 3-4 semaines  
**Technologies** : PWA API, Service Workers, React Native (optionnel)  
**Priorité** : 🟠 Haute (gros gain UX)

**→ Voir [ROADMAP_V6_FEATURES.md](ROADMAP_V6_FEATURES.md) pour détails complets**

---

### 🤖 Option 2: Alertes & Notifications intelligentes

**Bénéfice** : Automatiser alertes importantes pour meilleures décisions

**Valeur ajoutée** :
- ✅ Alerte si maladie détectée sur arbre
- ✅ Notification pic récolte optimal
- ✅ Rappel interventions planifiées
- ✅ Alerte conditions météo (gelée, sécheresse)
- ✅ Email/SMS/Push notifications
- ✅ Règles métier configurables

**Effort** : 2-3 semaines  
**Technologies** : WebSockets, Bull (queues), Nodemailer  
**Priorité** : 🔴 Très haute (ROI agricole)

**→ Voir [ROADMAP_V6_FEATURES.md](ROADMAP_V6_FEATURES.md) pour détails complets**

---

### 📊 Option 3: Rapports professionels & Analytics avancée

**Bénéfice** : Documents pour communications externes (banque, distributeurs, certification)

**Valeur ajoutée** :
- ✅ Rapports PDF personnalisés
- ✅ Graphiques avancés (D3, Chart.js PRO)
- ✅ Export XLSX avec mise en forme
- ✅ Templates rapports (Word-like)
- ✅ Historiques comparatifs année/année
- ✅ Benchmarking vs industrie
- ✅ Certification traçabilité

**Effort** : 2-3 semaines  
**Technologies** : ReportLab/PDFKit, Chart.js, Excel4Node  
**Priorité** : 🟡 Moyenne (valeur commerciale)

**→ Voir [ROADMAP_V6_FEATURES.md](ROADMAP_V6_FEATURES.md) pour détails complets**

---

### 🏆 Recommandation

**Je propose** : **Commencer par Option 1 (PWA)** puis Option 2

**Pourquoi** :
1. Option 1 = Utilité immédiate (travail terrain)
2. Option 2 = ROI agricole le plus élevé
3. Option 3 = Une fois les 2 premières stables

**Chronologie suggérée** :
- Semaines 1-2 : Corriger bugs URGENT
- Semaines 3-5 : Finaliser achats/fournisseurs
- Semaines 6-9 : PWA + offline
- Semaines 10-13 : Système alertes
- Semaines 14-16 : Rapports professionnels

**→ Voir [ROADMAP_V6_FEATURES.md](ROADMAP_V6_FEATURES.md) pour tous les détails : architecture, exemples de code, estimations budgétaires, etc.**

---

## 🔧 Configuration avancée

### 🐳 Docker en détail

```bash
# === BUILD IMAGES ===

# Seul backend
docker build -t gestion-truffiere:backend-v6 ./backend
docker build -t gestion-truffiere:frontend-v6 ./frontend

# === RUN STANDALONE ===

# Backend
docker run -d \
  --name truffiere-backend \
  -p 5000:5000 \
  -e DATABASE_URL="mysql://user:pass@host/db" \
  -e JWT_SECRET="secret123" \
  gestion-truffiere:backend-v6

# Frontend
docker run -d \
  --name truffiere-frontend \
  -p 3000:3000 \
  -e REACT_APP_API_URL="http://localhost:5000" \
  gestion-truffiere:frontend-v6

# === COMPOSE ===

docker-compose up -d              # Lancer tous les services
docker-compose down               # Arrêter tous
docker-compose ps                 # Status
docker-compose logs -f backend    # Logs en temps réel
docker-compose exec backend bash  # Shell dans container

# === PUSH TO REGISTRY ===

docker tag gestion-truffiere:backend-v6 myregistry/backend:v6
docker push myregistry/backend:v6
```

### 🔐 Variables d'environnement

```bash
# === BACKEND (.env) ===

# Server
PORT=5000
NODE_ENV=production
LOG_LEVEL=info

# Database - MySQL
DATABASE_HOST=db.example.com
DATABASE_PORT=3306
DATABASE_NAME=gestion_truffiere_prod
DATABASE_USER=truffiere_user
DATABASE_PASSWORD=StrongPassword123!

# Database - Connection Pool
DB_CONNECTION_LIMIT=10
DB_QUEUE_LIMIT=0
DB_ENABLE_KEEP_ALIVE=true

# JWT - Security
JWT_SECRET=GeneratedKeyMin32CharsRandom!@#$%^&*
JWT_REFRESH_SECRET=AnotherSecretKeyMin32CharsRandom!@#$%^
JWT_EXPIRATION=1h
JWT_REFRESH_EXPIRATION=7d

# CORS - Autorisé domaines
CORS_ORIGIN=https://app.example.com,https://api.example.com

# File Upload
MAX_FILE_SIZE=52428800        # 50MB
UPLOAD_DIR=/app/uploads

# Sentry (Error tracking - optionnel)
SENTRY_DSN=https://xxx@sentry.io/123456

# === FRONTEND (.env) ===

REACT_APP_API_URL=https://api.example.com
REACT_APP_ENV=production
REACT_APP_DEBUG=false
REACT_APP_VERSION=6.0.0
```

### 📈 Performance tuning

Voir [ARCHITECTURE.md](ARCHITECTURE.md#performance) pour optimisations détaillées.

---

## 🤝 Contribution

### 📋 Avant de contribuer

- [ ] Fork le projet
- [ ] Lire CONTRIBUTING.md
- [ ] Configurer dev environment
- [ ] Créer feature branch

### 🔀 Workflow Git

```bash
# 1. Créer branche feature
git checkout -b feature/achats-fournisseurs

# 2. Développer & commit
git add .
git commit -m "feat(achats): Ajouter CRUD fournisseurs"

# 3. Push & PR
git push origin feature/achats-fournisseurs
# → Ouvrir PR sur GitHub

# 4. Review & Merge
# Attendre review
# Merge une fois approuvé
```

### ✅ Standards de code

```javascript
// ✅ BON
const getUserById = async (userId) => {
  const user = await db.query('SELECT * FROM users WHERE id = ?', [userId]);
  return user;
};

// ❌ MAUVAIS
function get_user_by_id(id){
let user=db.query('SELECT * FROM users WHERE id='+id);
return user;
}

// Standards:
// - camelCase pour variables/functions
// - CONSTANTS en UPPER_CASE
// - Async/await > callbacks
// - Comments en français ou anglais cohérent
// - Pas de console.log en prod
// - Max 80 chars par ligne
// - Indentation 2 espaces
```

### 🧪 Tests requis

```bash
# Avant de faire une PR:

# Tests backend
npm test --prefix backend

# Tests frontend
npm test --prefix frontend

# Linting
npx eslint .

# Build check
npm run build --prefix frontend
```

### 📝 Checklist PR

- [ ] Branch nommée correctement (feature/xxx, fix/xxx)
- [ ] Tests ajoutés et passants
- [ ] Code formaté (ESLint)
- [ ] Documentation mise à jour
- [ ] CHANGELOG.md complété
- [ ] Pas de console.log/debugger
- [ ] init-db.sql mis à jour (si changements BD)
- [ ] Messages commits clairs

---

## 📞 Support

### 🆘 Problèmes & Questions

**Avant de demander aide** :
1. Vérifier [TROUBLESHOOTING.md](TROUBLESHOOTING.md)
2. Chercher dans [GitHub Issues](https://github.com/lepekinoi/Gestion-Truffiere/issues)
3. Regarder [Discussions](https://github.com/lepekinoi/Gestion-Truffiere/discussions)

### 📧 Contact

- **Owner** : lepekinoi
- **Email** : Via GitHub
- **Issues** : [GitHub Issues](https://github.com/lepekinoi/Gestion-Truffiere/issues)
- **Discussions** : [GitHub Discussions](https://github.com/lepekinoi/Gestion-Truffiere/discussions)

### 🐛 Rapport Bug

Créer issue avec template :

```markdown
## Bug Report

### Description
Décrire le bug clairement

### Reproduction steps
1. ...
2. ...
3. ...

### Résultat obtenu
Ce qui se passe

### Résultat attendu
Ce qui devrait se passer

### Screenshots
[si applicable]

### Environment
- OS: macOS / Windows / Linux
- Node.js version: 
- NPM version:
- Docker: yes/no
```

---

## 📄 Licence

Ce projet est distribué sous **Licence MIT**. 
Voir [LICENSE](LICENSE) pour détails.

Vous êtes libre de :
- ✅ Utiliser commercialement
- ✅ Modifier
- ✅ Distribuer
- ✅ Utiliser en privé

Conditions :
- 📋 Inclure copyright & licence
- 📋 Pas de responsabilité

---

## 🎓 Apprentissage & Ressources

### 📚 Documentation technique

- [Express.js Docs](https://expressjs.com/)
- [React Docs](https://react.dev/)
- [Leaflet Docs](https://leafletjs.com/)
- [JWT Explication](https://jwt.io/)
- [SQL Best Practices](https://use-the-index-luke.com/)

### 🎥 Tutoriels recommandés

- [Build REST API with Node.js](https://www.youtube.com/watch?v=dvO4mX5rFoQ)
- [React Hooks Deep Dive](https://www.youtube.com/watch?v=f9D0qtQQru8)
- [Leaflet Maps Tutorial](https://www.youtube.com/watch?v=sMvEz3kDYYo)

---

## 🙏 Remerciements

Merci à :
- 🍄 La communauté truffière
- 💻 Les contributeurs
- 🔧 Les développeurs React & Express
- 🗺️ Leaflet team
- 📊 Toute la stack JavaScript

---

## 📊 Roadmap v6-v7

### v6.0 (Actuel - Janvier 2026)
- ✅ Core features complètes
- ✅ Architecture stable
- 🔄 En finalisation
  - [ ] Corriger bugs critiques
  - [ ] Finaliser achats/fournisseurs
  - [ ] Dashboard fixes

### v6.1 (Février 2026)
- [ ] PWA & offline support
- [ ] Tests automatisés
- [ ] Documentation API (Swagger)

### v7.0 (Trimestre 2, 2026)
- [ ] Système alertes intelligentes
- [ ] Rapports professionnels
- [ ] Refactor server.js
- [ ] Mobile app (React Native)

---

## 📈 Statistiques du projet

```
📊 Code Statistics
├─ Total files: 40+
├─ Backend JS: ~10 files (server.js: 126 KB)
├─ Frontend Components: 18 files
├─ Database tables: 8+ (in init-db.sql)
├─ REST endpoints: 20+
└─ Supported languages: JavaScript, SQL

📦 Dependencies
├─ Production: ~30 packages
├─ Development: ~50 packages
├─ Zero critical vulnerabilities
└─ Last audit: January 2026

👥 Contributors
├─ Maintainer: lepekinoi
├─ Contributors: Welcome!
└─ Community: Growing!

📍 Project Stats
├─ Created: January 9, 2026
├─ Last update: January 24, 2026
├─ Stars: 1 ⭐
├─ Forks: 0
└─ Open issues: 0
```

---

## 🚀 Quick Links

| Ressource | Lien |
|-----------|------|
| **Repository** | [GitHub](https://github.com/lepekinoi/Gestion-Truffiere) |
| **Issues** | [GitHub Issues](https://github.com/lepekinoi/Gestion-Truffiere/issues) |
| **Discussions** | [GitHub Discussions](https://github.com/lepekinoi/Gestion-Truffiere/discussions) |
| **Release** | [v6.0 Release](https://github.com/lepekinoi/Gestion-Truffiere/releases) |
| **📡 API Docs** | [API.md](API.md) |
| **🏠 Architecture** | [ARCHITECTURE.md](ARCHITECTURE.md) |
| **📋 Roadmap** | [ROADMAP_V6_FEATURES.md](ROADMAP_V6_FEATURES.md) |

---

## ⭐ Si vous trouvez ça utile

- ⭐ **Star** le projet sur GitHub
- 🔔 **Watch** pour les mises à jour
- 🤝 **Contribuer** avec vos idées
- 📢 **Partager** avec d'autres

---

## 📝 Notes finales

**Gestion-Truffière v6** est une **plateforme moderne et complète** pour la gestion de truffières. Elle démontre des bonnes pratiques en :

- ✅ Architecture fullstack moderne
- ✅ Sécurité (JWT, validation)
- ✅ Scalabilité (Docker-ready)
- ✅ UX professionnelle
- ✅ Code organisé

**La v6 se finalise** avec correction des bugs et implémentation achats/fournisseurs. 

**Prochaines étapes** recommandées : PWA + alertes intelligentes.

**Consultez [ROADMAP_V6_FEATURES.md](ROADMAP_V6_FEATURES.md) pour le plan détaillé des 7 prochaines fonctionnalités!**

---

**🎉 Bienvenue dans Gestion-Truffière!**

*Dernière mise à jour : 24 janvier 2026 à 16h30 CET*  
*By: lepekinoi | Location: Notre-Dame-des-Landes, Pays de la Loire 🇫🇷*