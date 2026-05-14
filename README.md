# 🍄 Gestion-Truffière v8 — Plateforme de gestion intégrée

> **Système complet de gestion pour exploitations truffières — Pays de la Loire**  
> Stack moderne React + Express.js | Architecture modulaire | Docker ready | Production-ready

[![Status](https://img.shields.io/badge/Status-Production-2ECC71?style=flat-square)](https://github.com/lepekinoi/Gestion-Truffiere)
[![Version](https://img.shields.io/badge/Version-2.0.2-4ECDC4?style=flat-square)](https://github.com/lepekinoi/Gestion-Truffiere/blob/V8/CHANGELOG.md)
[![Branch](https://img.shields.io/badge/Branch-V8-9B59B6?style=flat-square)](https://github.com/lepekinoi/Gestion-Truffiere/tree/V8)
[![JavaScript](https://img.shields.io/badge/JavaScript-ES6+-F7DF1E?style=flat-square&logo=javascript)](https://www.javascript.com/)
[![License](https://img.shields.io/badge/License-MIT-2ECC71?style=flat-square)](https://github.com/lepekinoi/Gestion-Truffiere/blob/V8/LICENSE)
[![Last Update](https://img.shields.io/badge/Last%20Update-Mai%202026-3498DB?style=flat-square)](https://github.com/lepekinoi/Gestion-Truffiere/commits/V8)
[![Code Quality](https://img.shields.io/badge/Code%20Quality-Refactoré-9B5CB6?style=flat-square)](https://github.com/lepekinoi/Gestion-Truffiere/blob/V8)

---

## 📋 Table des matières

- [Aperçu rapide](#-aperçu-rapide)
- [Fonctionnalités](#-fonctionnalités-complètes)
- [Vue Saisonnière](#-vue-saisonnière-truffière)
- [Architecture V8](#️-architecture-v8)
- [Démarrage rapide](#-démarrage-rapide)
- [Identifiants par défaut](#-identifiants-par-défaut)
- [Documentation technique](#-documentation-technique)
- [Structure du projet](#-structure-du-projet)
- [Problèmes connus](#-problèmes-connus)
- [Roadmap](#-roadmap)
- [Contribution](#-contribution)

---

## ✨ Aperçu rapide

**Gestion-Truffière v8** est une plateforme web **production-ready** conçue spécifiquement pour les exploitants truffiers. Elle centralise l'ensemble de la gestion opérationnelle :

```
┌─────────────────────────────────────────┐
│   🍄 GESTION-TRUFFIÈRE v8              │
├─────────────────────────────────────────┤
│                                         │
│  📊 Dashboard temps réel               │
│  🗺️  Cartographie Leaflet interactive  │
│  🌳 Suivi sanitaire des arbres         │
│  📈 Récoltes & statistiques saison     │
│  🔧 Interventions détaillées           │
│  👥 Multi-utilisateurs & rôles         │
│  🏪 Module commercial complet          │
│  📜 Audit trail complet (85+ codes)    │
│  📤 Import CSV / Export PDF            │
│  🔐 Auth JWT sécurisée (bcrypt x12)   │
│  🏗️  Architecture modulaire (21 routes)│
│  🍂 Vue saisonnière truffière          │
│                                         │
└─────────────────────────────────────────┘
```

### 💡 Cas d'usage

| Profil | Usages principaux |
|---|---|
| **Agriculteur** | Suivi quotidien parcelles/arbres, log interventions |
| **Responsable Exploitation** | Analytics, stats saison, gestion équipes |
| **Administrateur** | Rapports financiers, audit trail, configuration |
| **Commercial** | Clients, ventes, commandes, stock automatique |

---

## 🎯 Fonctionnalités complètes

### ✅ Core Features (v8 — Production Ready)

| Fonctionnalité | Description | État |
|---|---|---|
| **📊 Dashboard** | Vue d'ensemble temps réel, KPIs agrégés | ✅ Production |
| **🗺️ Cartographie** | Leaflet interactive, marqueurs GPS parcelles | ✅ Production |
| **🌳 Parcelles** | CRUD complet, localisation GPS, corbeille | ✅ Production |
| **🌱 Arbres** | Suivi sanitaire, variétés, soft delete | ✅ Production |
| **📦 Récoltes** | Quantités, qualité, caveur/chien, saison | ✅ Production |
| **🔧 Interventions** | Log complet, coûts, traçabilité phyto, irrigation | ✅ Production |
| **💼 Commercial** | Clients, ventes, commandes, analytics | ✅ Production |
| **📊 Stock** | Calcul automatique (récoltes − ventes), par qualité/saison | ✅ Production |
| **👥 Auth & Rôles** | JWT, multi-utilisateurs, admin/user/viewer | ✅ Production |
| **📤 Import/Export** | CSV import, PDF export, rapports | ✅ Production |
| **🔍 Recherche** | Filtres multi-modules, tri colonnes | ✅ Production |
| **⚙️ Paramètres** | Colonnes configurables, préférences utilisateur | ✅ Production |
| **📜 Historique** | Audit trail complet (old_data/new_data), purge sélective | ✅ Production |
| **🔔 Sécurité** | 85+ codes d'erreur, account locking, rate limiting | ✅ Production |
| **🍂 Vue Saisonnière** | Cycle truffier sep→mars, comparaison inter-saisons, `seasonUtils.js` | 🔧 En cours |

---

## 🍂 Vue Saisonnière Truffière

> Feature en cours d'intégration — `frontend/src/utils/seasonUtils.js` disponible (fév. 2026)

### Objectif

Adapter l'affichage selon le **cycle naturel de la truffe** (septembre → mars) plutôt que l'année civile, pour comparer les performances d'une saison à l'autre (ex : `2024-2025` vs `2023-2024`).

### Composants prévus

| Composant | Description |
|---|---|
| **Toggle mode** | Basculer entre *Année civile* et *Saison truffière*, persisté en `localStorage` |
| **Widget Saison en cours** | Production totale, nb récoltes, progression %, comparaison même période saison précédente |
| **Widget Hors Saison** | Actif en avril–août : résumé dernière saison + compte à rebours prochain septembre |
| **Graphique multi-saisons** | Courbes comparatives par saison (Sep→Mars en axe X) via Recharts |
| **Onglet Saisons** | Nouvel onglet dans Statistiques.js avec tableau récapitulatif toutes saisons |
| **KPIs saisonniers** | Production, moyenne/récolte, meilleur mois, comparaison même période |
| **Détection incomplète** | Marquage visuel des saisons à données partielles (taux de couverture %) |

### Logique de calcul (`seasonUtils.js`)

```javascript
// Nomenclature : YYYY-YYYY (sep année N → mars année N+1)
// Sep–Déc  → saison year-(year+1)
// Jan–Mar  → saison (year-1)-year
// Avr–Aoû  → hors saison

const getCurrentSeason = () => {
  const month = new Date().getMonth() + 1;
  const year  = new Date().getFullYear();
  if (month >= 9)            return `${year}-${year + 1}`;
  if (month <= 3)            return `${year - 1}-${year}`;
  return `${year}-${year + 1}`; // hors saison → prochaine
};

export const isOffSeason = () => {
  const month = new Date().getMonth() + 1;
  return month >= 4 && month <= 8;
};
```

### Fonctions clés (`seasonUtils.js` — 20 fonctions)

- `getCurrentSeason()` — saison active
- `getAvailableSeasons(recoltesData)` — liste des saisons avec données
- `isOffSeason()` — détection période creuse
- `getDaysUntilNextSeason()` — compte à rebours
- `getLastCompleteSeason()` — dernière saison terminée
- `compareSeasonsSamePeriod(data, current, previous)` — comparaison équitable jusqu'au même point d'avancement
- `detectIncompleteSeason(season, data)` — taux de couverture + mois manquants
- `calculateSeasonProgress()` — % d'avancement dans la saison
- `getDaysIntoSeason(date)` — jours écoulés depuis le 1er septembre
- `formatSeasonLabel(season, completenessInfo)` — label avec indicateur ⚠️ si données partielles

### État d'avancement

- ✅ `seasonUtils.js` créé et testé
- ✅ `getCurrentSeason()` et `getAvailableSeasons()` opérationnels
- 🔧 Intégration `Dashboard.js` — toggle + widget saison en cours
- 🔧 Intégration `Statistiques.js` — onglet Saisons
- ⏳ Tests Jest pour `seasonUtils.js`
- ⏳ `OffSeasonWidget` composant React
- ⏳ Graphique multi-saisons Recharts

---

## 🏗️ Architecture V8

### Vue d'ensemble des améliorations V7 → V8

| Métrique | Avant (V7) | Après (V8) | Delta |
|---|---|---|---|
| **Taille server.js** | 48.8 KB | 25.3 KB | **−50%** 🎉 |
| **Lignes server.js** | ~2800 | ~900 | **−68%** |
| **Fichiers routes** | 1 monolithe | 21 modules | **+2000%** organisation |
| **Codes d'erreur** | non standardisés | 85+ codes documentés | ✅ |
| **Audit trail** | partiel | complet (toutes entités) | ✅ |
| **Endpoints API** | ~70 | 95+ | ✅ |
| **Code mort supprimé** | — | `controllers/` TS (25.4 KB) | 🗑️ |

### Structure backend après refactoring (v2.0.1)

```
backend/
├── server.js                        # Orchestration (25.3 KB, ~900 lignes)
│
├── routes/                          # 21 modules indépendants
│   ├── auth.js                      # 15 routes — Auth JWT + audit complet
│   ├── arbres.routes.js             # 8 routes — CRUD + corbeille
│   ├── parcelles.routes.js          # 7 routes — CRUD + corbeille
│   ├── interventions.routes.js      # 14 routes — Détails + stats phyto/eau
│   ├── commandes.routes.js          # 8 routes — Génération ventes auto
│   ├── clients.routes.js            # 6 routes — Stats par type
│   ├── ventes.routes.js             # 4 routes — Filtres avancés
│   ├── recoltes.routes.js           # 4 routes
│   ├── stock.routes.js              # 2 routes — Calcul auto
│   ├── dashboard.routes.js          # 1 route — Consolidé temps réel
│   ├── stats.routes.js              # 3 routes — Agrégats annuels/mensuels
│   ├── historique.routes.js         # 3 routes — Audit trail + purge
│   ├── parametres.routes.js         # 7 routes — Config app
│   ├── preferences.routes.js        # 3 routes — Préférences utilisateur
│   ├── caveurs.routes.js            # 4 routes
│   ├── chiens.routes.js             # 4 routes
│   ├── especes.routes.js            # 4 routes
│   ├── types-intervention.routes.js # 1 route
│   ├── produits-phyto.routes.js     # 4 routes
│   ├── amendements-ref.routes.js    # 4 routes
│   └── achats.routes.js             # CRUD achats/fournisseurs
│
├── middleware/
│   ├── auth.js                      # 🆕 Vérification JWT (extrait de server.js)
│   ├── authenticate.js              # Middleware auth complet
│   ├── authorize.js                 # Contrôle rôles RBAC
│   └── validation.js                # 🆕 Validation centralisée
│
├── utils/
│   ├── index.js                     # 🆕 Point d'entrée unique (pattern Factory)
│   └── tokenRotation.js             # Gestion refresh tokens + détection réutilisation
│
├── config/
│   └── database.js                  # Pool connexions PostgreSQL
│
└── docs/
    └── API_ERROR_CODES.md           # 🆕 Référence 85+ codes d'erreur documentés
```

### Ajouts V8 (🆕) par rapport au README précédent

- **`utils/index.js`** : pattern Factory unifié, point d'entrée unique pour tous les helpers
- **`middleware/auth.js`** + **`middleware/validation.js`** : séparés de server.js
- **`backend/docs/API_ERROR_CODES.md`** : référence complète 85+ codes d'erreur au format `{ error, code, details }`
- **`frontend/src/utils/seasonUtils.js`** : 20 fonctions utilitaires pour la gestion des saisons truffières — voir section [Vue Saisonnière](#-vue-saisonnière-truffière)
- **Audit trail enrichi** : `old_data`, `new_data`, `metadata` sur toutes les actions sensibles
- **Suppression** du dossier `controllers/` (3 fichiers TypeScript inutilisés, 25.4 KB de code mort)

---

## 🔒 Sécurité

| Couche | Implémentation |
|---|---|
| Hachage | bcrypt, 12 salt rounds |
| Tokens | JWT 15 min + refresh tokens avec rotation et détection de réutilisation |
| Account locking | 5 tentatives échouées → verrouillage 15 min |
| Rate limiting | Global : 1000 req/15 min — Auth : 10 req/15 min |
| IP tracking | Sur toutes les actions sensibles |
| Headers | Helmet (CSP, HSTS, XSS...) |
| CORS | Configurable via variables d'environnement |
| Codes d'erreur | 85+ codes standardisés, `details` masqués hors `NODE_ENV=development` |

---

## 🚀 Démarrage rapide

### ⚡ Avec Docker (recommandé)

```bash
# 1. Cloner le repo et se placer sur V8
git clone https://github.com/lepekinoi/Gestion-Truffiere.git
cd Gestion-Truffiere
git checkout V8

# 2. Configurer l'environnement
cp .env.exemple backend/.env
# Éditer backend/.env avec vos paramètres (JWT_SECRET, DATABASE_PASSWORD…)

# 3. Lancer
docker compose up -d --build

# 4. Accès
# Frontend : http://localhost:3000
# API      : http://localhost:5000
```

→ Voir [QUICKSTART.md](https://github.com/lepekinoi/Gestion-Truffiere/blob/V8/QUICKSTART.md) pour un démarrage en 4 étapes.  
→ Voir [DOCKER.md](https://github.com/lepekinoi/Gestion-Truffiere/blob/V8/DOCKER.md) pour build, volumes, troubleshoot, production.

### 📝 Sans Docker (développement local)

```bash
# Backend
cd backend
npm install
npm start        # http://localhost:5000

# Frontend (nouveau terminal)
cd frontend
npm install
npm start        # http://localhost:3000
```

→ Voir [SETUP.md](https://github.com/lepekinoi/Gestion-Truffiere/blob/V8/SETUP.md) pour l'installation détaillée (PostgreSQL, variables d'environnement, systemd).

---

## 🔐 Identifiants par défaut

```
Email        : admin@truffiere.local
Mot de passe : admin123
```

> ⚠️ **Changez ce mot de passe immédiatement** après la première connexion :  
> **Paramètres → Mon profil → Modifier le mot de passe**

---

## 📖 Documentation technique

| Document | Description | Audience |
|---|---|---|
| **[⚡ QUICKSTART.md](https://github.com/lepekinoi/Gestion-Truffiere/blob/V8/QUICKSTART.md)** | Démarrage en 4 étapes, dépannage rapide | Tous |
| **[📡 API.md](https://github.com/lepekinoi/Gestion-Truffiere/blob/V8/API.md)** | 95+ endpoints REST, exemples, auth | Développeurs |
| **[🏗️ ARCHITECTURE.md](https://github.com/lepekinoi/Gestion-Truffiere/blob/V8/ARCHITECTURE.md)** | Architecture système, diagrammes, stack | Tous |
| **[🔴 API_ERROR_CODES.md](https://github.com/lepekinoi/Gestion-Truffiere/blob/V8/backend/docs/API_ERROR_CODES.md)** | 85+ codes d'erreur standardisés | Développeurs |
| **[🐳 DOCKER.md](https://github.com/lepekinoi/Gestion-Truffiere/blob/V8/DOCKER.md)** | Build, run, compose, production | DevOps |
| **[🔧 SETUP.md](https://github.com/lepekinoi/Gestion-Truffiere/blob/V8/SETUP.md)** | Installation, configuration, prérequis | Nouveaux devs |
| **[📝 CHANGELOG.md](https://github.com/lepekinoi/Gestion-Truffiere/blob/V8/CHANGELOG.md)** | Historique des versions (Keep a Changelog) | Tous |

### Endpoints API principaux

```
POST   /api/auth/login              Connexion
POST   /api/auth/refresh            Refresh token
POST   /api/auth/logout             Déconnexion

GET    /api/parcelles               Lister parcelles
GET    /api/arbres                  Lister arbres
GET    /api/recoltes                Lister récoltes
GET    /api/interventions           Lister interventions

GET    /api/clients                 Lister clients
GET    /api/ventes                  Lister ventes
GET    /api/commandes               Lister commandes
GET    /api/stock                   Stock automatique (récoltes − ventes)

GET    /api/dashboard/full          Dashboard consolidé temps réel
GET    /api/stats                   Statistiques agrégées
GET    /api/historique              Audit trail complet
GET    /api/parametres              Configuration app
GET    /api/health                  Health check
```

---

## 📁 Structure du projet

```
Gestion-Truffiere/                    (branche V8)
│
├── backend/                          # API Express.js
│   ├── server.js                     # Point d'entrée (25.3 KB, ~900 lignes)
│   ├── routes/                       # 21 fichiers de routes modulaires
│   ├── middleware/                   # authenticate, authorize, validation, auth
│   ├── utils/                        # index.js (Factory), tokenRotation.js
│   ├── config/                       # database.js (pool PostgreSQL)
│   └── docs/
│       └── API_ERROR_CODES.md        # 85+ codes d'erreur documentés
│
├── frontend/                         # Application React
│   └── src/
│       ├── components/               # 18 composants (Dashboard, Parcelles, Arbres…)
│       ├── services/                 # api.js (Axios), axiosConfig.js
│       ├── context/                  # AuthContext.js
│       └── utils/
│           └── seasonUtils.js        # 🆕 20 fonctions utilitaires saison truffière
│
├── database/                         # PostgreSQL
│   └── init_database.sql             # Schéma + données initiales
│
├── docker-compose.yml
├── Dockerfile
├── .env.exemple
│
├── README.md                         # Ce fichier
├── QUICKSTART.md                     # Démarrage rapide V8 (Docker, 4 étapes)
├── API.md                            # Documentation API complète
├── ARCHITECTURE.md                   # Architecture technique
├── CHANGELOG.md                      # Historique versions (Keep a Changelog)
├── DOCKER.md                         # Guide Docker
├── SETUP.md                          # Guide installation sans Docker
└── backup-db.sh                      # Script backup PostgreSQL
```

---

## 🐛 Problèmes connus

### ✅ Résolus en V8

| Problème | Solution |
|---|---|
| server.js monolithique (48.8 KB) | Refactoring 21 modules (25.3 KB, −50%) |
| Routes auth inline dans server.js | Extrait dans `routes/auth.js` (15 routes) |
| Fonctions utils dupliquées | `utils/index.js` comme point d'entrée unique |
| Codes d'erreur incohérents | 85+ codes standardisés, format uniforme |
| Audit trail incomplet | Traçabilité sur toutes les entités (old/new data) |
| Code mort TypeScript | `controllers/` supprimé (25.4 KB) |
| [HOISTING] `Cannot access 'sortedClients' before initialization` | Bloc filtrage déplacé avant bloc STATISTIQUES dans `Commercial.js` |
| [JSX] Fragment orphelin ligne 847 dans `Commercial.js` | Suppression bloc dupliqué `PaginationControls` |

### 🟡 À améliorer

| Problème | Impact | Priorité | Roadmap |
|---|---|---|---|
| Tests automatisés absents | Qualité, régressions | 🔴 Haute | v8.1 |
| Vue Saisonnière non intégrée dans Dashboard/Stats | Feature incomplète | 🔴 Haute | v8.1 |
| UX mobile non optimisée | Terrain, usabilité | 🟡 Moyenne | v8.5 |
| Pas de documentation Swagger/OpenAPI | Onboarding devs | 🟡 Moyenne | v8.1 |
| Rapports PDF basiques | Livrables clients | 🟢 Basse | v8.5 |

---

## 💡 Roadmap

### v8.1 — Q2/Q3 2026

- [ ] **Vue Saisonnière** — Intégration complète dans `Dashboard.js` et `Statistiques.js`
  - [ ] Toggle *Année civile* ↔ *Saison truffière* (persisté localStorage)
  - [ ] `SeasonWidget` — production, progression %, comparaison même période
  - [ ] `OffSeasonWidget` — résumé + compte à rebours (actif avr–août)
  - [ ] Graphique Recharts multi-saisons (axe X : Sep→Mar)
  - [ ] Onglet *Saisons* dans `Statistiques.js`
  - [ ] Détection et marquage des saisons incomplètes
  - [ ] Tests Jest pour `seasonUtils.js`
- [ ] Tests automatisés — Jest + React Testing Library
- [ ] PWA & mode offline (Service Worker, sync)
- [ ] Documentation Swagger/OpenAPI auto-générée

### v8.5 — Q4 2026

- [ ] Système d'alertes intelligentes (maladies, météo, rappels)
- [ ] Rapports PDF professionnels (graphiques, traçabilité)
- [ ] Mobile app React Native
- [ ] Analytics IA & prédictions de récolte
- [ ] Intégrations API météo / données agronomiques
- [ ] WebSockets (notifications temps réel)

---

## 🤝 Contribution

```bash
# Workflow standard
git checkout V8
git checkout -b feature/nom-feature

# Après développement
npm run lint          # ESLint
npm test              # Jest (quand disponible)
git commit -m "feat(module): description claire"
# → Pull Request vers V8
```

**Checklist PR :**
- [ ] Code formaté (ESLint + Prettier)
- [ ] Tests ajoutés si applicable
- [ ] `CHANGELOG.md` mis à jour
- [ ] `init_database.sql` modifié si changement BDD
- [ ] Pas de `console.log` en production
- [ ] Codes d'erreur standardisés utilisés

---

## 📞 Support

- **Issues** : [GitHub Issues](https://github.com/lepekinoi/Gestion-Truffiere/issues)
- **Discussions** : [GitHub Discussions](https://github.com/lepekinoi/Gestion-Truffiere/discussions)
- **Owner** : lepekinoi

Avant d'ouvrir une issue :
1. Consulter les logs : `docker compose logs -f backend` ou `tail -f logs/app.log`
2. Vérifier [API_ERROR_CODES.md](https://github.com/lepekinoi/Gestion-Truffiere/blob/V8/backend/docs/API_ERROR_CODES.md)
3. Tester le health check : `GET /api/health`

---

## 📊 Statistiques V8

```
📦 Routes modulaires    : 21 fichiers (vs 1 monolithe)
⚡ Réduction server.js  : −50% taille (48.8 KB → 25.3 KB)
🔴 Codes d'erreur       : 85+ standardisés et documentés
🌐 Endpoints API        : 95+
🗑️  Code mort supprimé  : 25.4 KB (controllers/ TypeScript)
📝 Commits              : 625+
🛡️  0 breaking change   : rétrocompatibilité totale
```

---

## 📄 Licence

Distribué sous **Licence MIT** — voir [LICENSE](https://github.com/lepekinoi/Gestion-Truffiere/blob/V8/LICENSE).

---

*Dernière mise à jour : mai 2026*  
*By: lepekinoi | Notre-Dame-des-Landes, Pays de la Loire 🇫🇷*
