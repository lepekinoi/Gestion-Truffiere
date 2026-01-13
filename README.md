# 🍄 Gestion-Truffière

Plateforme de gestion intégrée pour exploitations truffières - Suivi des parcelles, arbres, récoltes et interventions.

![Status](https://img.shields.io/badge/status-active-brightgreen)
![Last Update](https://img.shields.io/badge/last%20update-January%202026-blue)
![License](https://img.shields.io/badge/license-MIT-green)

---

## 📋 Table des matières

- [Aperçu](#aperçu)
- [Architecture](#architecture)
- [Installation](#installation)
- [Base de données](#base-de-données)
- [Utilisation](#utilisation)
- [Structure du projet](#structure-du-projet)
- [Fonctionnalités](#fonctionnalités)
- [Changelog](#changelog)
- [Contribution](#contribution)

---

## 🎯 Aperçu

**Gestion-Truffière** est une application web complète permettant la gestion opérationnelle des exploitations truffières avec :

- 📊 Tableau de bord intuitif
- 🗺️ Cartographie des parcelles
- 🌳 Gestion des arbres et santé des plants
- 📈 Suivi des récoltes et statistiques
- 🔧 Historique des interventions
- 👥 Gestion des utilisateurs avec authentification
- 📤 Import/Export CSV
- 📄 Export PDF des données

**Stack technologique :**
- **Frontend** : React.js, Axios, Leaflet (cartographie)
- **Backend** : Node.js, Express
- **Base de données** : SQL avec init-db.sql (structure complète documentée)
- **Architecture** : REST API

---

## 🏗️ Architecture

```
Gestion-Truffiere/
├── backend/
│   ├── server.js                 # Serveur principal
│   ├── server_avt_auth.js        # Serveur avant authentification
│   ├── config/
│   │   └── security.js           # Configuration sécurité
│   ├── routes/
│   │   └── auth.js               # Routes authentification
│   ├── middleware/
│   │   ├── auth.js               # Middleware JWT
│   │   └── validation.js         # Validation des données
│   └── utils/
│       └── tokens.js             # Gestion des tokens JWT
│
├── frontend/
│   └── src/
│       ├── index.js              # Point d'entrée
│       ├── App.js                # Composant racine
│       ├── components/           # Composants React
│       │   ├── Dashboard.js
│       │   ├── Parcelles.js
│       │   ├── Arbres.js
│       │   ├── Recoltes.js
│       │   ├── Interventions.js
│       │   ├── Statistiques.js
│       │   ├── Previsions.js
│       │   ├── Carte.js
│       │   ├── WeatherWidget.js
│       │   ├── GlobalSearch.js
│       │   ├── Historique.js
│       │   ├── Login.js
│       │   ├── UserManagement.js
│       │   ├── ChangePassword.js
│       │   ├── Parametres.js
│       │   ├── Commercial.js
│       │   └── CSVImportModal.js
│       ├── services/
│       │   ├── api.js            # Appels API
│       │   └── axiosConfig.js    # Configuration Axios
│       ├── context/
│       │   └── AuthContext.js    # Context API authentification
│       ├── hooks/
│       │   └── useColumnSettings.js
│       └── utils/
│           ├── csvImport.js      # Import CSV
│           └── pdfExport.js      # Export PDF
│
├── init-db.sql                  # ✨ NEW - Structure base de données
└── README.md
```

---

## ⚙️ Installation

### Prérequis
- Node.js >= 14.x
- npm ou yarn
- Base de données SQL (MySQL, PostgreSQL, etc.)
- Git

### Étapes

#### 1. Cloner le projet
```bash
git clone https://github.com/lepekinoi/Gestion-Truffiere.git
cd Gestion-Truffiere
```

#### 2. Configurer la base de données

**Créer la base de données :**
```bash
# Avec MySQL
mysql -u root -p < init-db.sql

# Avec PostgreSQL
psql -U postgres < init-db.sql

# Avec autre : consulter le fichier init-db.sql pour la syntaxe
```

#### 3. Installer les dépendances Backend
```bash
cd backend
npm install
```

#### 4. Installer les dépendances Frontend
```bash
cd ../frontend
npm install
```

#### 5. Configuration

Créer un fichier `.env` à la racine `backend/` :
```env
PORT=5000
JWT_SECRET=votre_clé_secrète_très_sécurisée
DATABASE_URL=mysql://user:password@localhost:3306/gestion_truffiere
DATABASE_USER=user
DATABASE_PASSWORD=password
DATABASE_HOST=localhost
DATABASE_PORT=3306
DATABASE_NAME=gestion_truffiere
NODE_ENV=development
CORS_ORIGIN=http://localhost:3000
```

#### 6. Lancer l'application

**Backend** (depuis `backend/`):
```bash
npm start
```

**Frontend** (depuis `frontend/`):
```bash
npm start
```

L'application sera accessible à : `http://localhost:3000`

---

## 🗄️ Base de données

### 📌 Nouveau : init-db.sql

Le fichier `init-db.sql` contient la structure complète de la base de données avec :

- ✅ Création de toutes les tables
- ✅ Définition des colonnes et types
- ✅ Clés primaires et étrangères
- ✅ Contraintes et validations
- ✅ Relations entre tables
- ✅ Données initiales (si applicable)

### 🔍 Utilisation

**Installation initiale :**
```bash
# Créer la base de données
mysql -u root -p < init-db.sql
```

**Reset complet (développement) :**
```bash
# Supprimer et recréer
mysql -u root -p -e "DROP DATABASE IF EXISTS gestion_truffiere;"
mysql -u root -p < init-db.sql
```

### 📊 Structure des tables

Les tables incluent (détails dans init-db.sql) :
- 👤 **users** - Utilisateurs et authentification
- 📍 **parcelles** - Parcelles de l'exploitation
- 🌳 **arbres** - Arbres/plants
- 📦 **recoltes** - Récoltes effectuées
- 🔧 **interventions** - Historique des interventions
- ⚙️ **parametres** - Configuration système
- 📊 **statistiques** - Données statistiques agrégées

*Note : Structure complète à consulter dans init-db.sql*

---

## 🚀 Utilisation

### Authentification
1. Accédez à l'écran de connexion (`Login.js`)
2. Entrez vos identifiants
3. Les tokens JWT sont stockés automatiquement

### Tableau de bord
- Vue d'ensemble des stats clés
- Accès rapide aux modules
- Widget météo intégré

### Gestion des données
- **Parcelles** : Création, modification, visualisation sur carte
- **Arbres** : Suivi sanitaire et calendrier de plantation
- **Récoltes** : Enregistrement et historique des rendements
- **Interventions** : Log des actions effectuées

### Export/Import
- Exportez en PDF ou CSV via les boutons d'action
- Importez les données via `CSVImportModal.js`

### Recherche globale
- Utilisez `GlobalSearch.js` pour rechercher tous les éléments
- Accès par raccourci clavier (si implémenté)

---

## 📦 Structure du Projet - Détails

### Backend (7 fichiers .js)

| Fichier | Rôle |
|---------|------|
| `server.js` | Initialisation serveur Express, routes |
| `server_avt_auth.js` | Version de développement sans auth |
| `auth.js` (route) | Endpoints login/register/refresh |
| `auth.js` (middleware) | Vérification JWT, protéction routes |
| `validation.js` | Validation données reçues |
| `tokens.js` | Génération/vérification JWT |
| `security.js` | Config CORS, headers sécurité |

### Frontend - Composants (18 fichiers .js)

#### Gestion des données
- `Dashboard.js` - Vue d'ensemble
- `Parcelles.js` - Gestion des parcelles
- `Arbres.js` - Gestion des arbres
- `Recoltes.js` - Suivi des récoltes
- `Interventions.js` - Historique interventions

#### Analytics & Visualisation
- `Statistiques.js` - Graphiques et statistiques
- `Previsions.js` - Prévisions et projections
- `Carte.js` - Visualisation géospatiale (Leaflet)
- `WeatherWidget.js` - Données météo

#### Utilitaires
- `GlobalSearch.js` - Recherche multi-modules
- `Historique.js` - Journal d'activités
- `CSVImportModal.js` - Import de fichiers CSV

#### Authentification & Paramètres
- `Login.js` - Écran de connexion
- `UserManagement.js` - Gestion des utilisateurs
- `ChangePassword.js` - Changement de mot de passe
- `Parametres.js` - Configuration générale
- `Commercial.js` - Vue commerciale

### Frontend - Services & Utilitaires (8 fichiers .js)

| Type | Fichiers |
|------|----------|
| **Services API** | `api.js`, `axiosConfig.js` |
| **Context** | `AuthContext.js` |
| **Hooks** | `useColumnSettings.js` |
| **Utilitaires** | `csvImport.js`, `pdfExport.js` |
| **Racine** | `index.js`, `App.js` |

---

## ✨ Fonctionnalités principales

### ✅ Implémentées
- [x] Authentification JWT
- [x] Gestion multi-utilisateurs
- [x] Dashboard interactif
- [x] Cartographie (Leaflet)
- [x] Statistiques et graphiques
- [x] Import/Export CSV
- [x] Export PDF
- [x] Recherche globale
- [x] Historique d'activités
- [x] Widget météo
- [x] Gestion des paramètres
- [x] Structure BD documentée (init-db.sql)

### 🔄 En développement
- [ ] Notifications temps réel
- [ ] Prévisions AI
- [ ] Mobile responsive
- [ ] Mode offline
- [ ] Intégration webhooks

### 📋 Prévu
- [ ] API GraphQL
- [ ] Tests automatisés
- [ ] Documentation API (Swagger/OpenAPI)
- [ ] Docker support
- [ ] Monitoring et logging

---

## 📝 Changelog

### [14 janvier 2026] - Évolution majeure 🎉

#### 🆕 Ajouté
- **init-db.sql** - Structure complète de la base de données
  - Définition de toutes les tables
  - Relations et contraintes
  - Setup BD reproductible et documenté

#### ✏️ Modifié
- **Backend** - Évolutions routes et models
  - Routes adaptées à la nouvelle structure BD
  - Models/Schemas mis à jour
  - Requêtes SQL optimisées
  
- **Frontend** - Adaptations composants et API calls
  - Composants adaptés aux nouvelles données
  - API calls mises à jour
  - Validation formulaires alignée

#### 📊 Améliorations
- Structure BD enfin documentée et claire
- Installation et setup facilitées
- Relations données clarifiées
- Meilleure compréhension architecture globale
- Reproducibilité augmentée

### [Version précédente]
- Initialisation du projet
- Structure React + Express
- Authentification JWT
- Core features CRUD

---

## 🤝 Contribution

### Pour contribuer :

1. **Fork** le projet
2. Créez une branche feature (`git checkout -b feature/AmazingFeature`)
3. Commitez vos changements (`git commit -m 'Add some AmazingFeature'`)
4. Poussez la branche (`git push origin feature/AmazingFeature`)
5. Ouvrez une Pull Request

### Standards de code
- Respecter la structure de dossiers existante
- Commentaires en français ou anglais cohérent
- Noms de variables explicites
- Pas de console.log en production
- Tests pour nouvelles fonctionnalités

### Avant de faire une PR
- [ ] Tests effectués
- [ ] Code formaté (ESLint)
- [ ] Documentation mise à jour
- [ ] init-db.sql updaté (si changements BD)
- [ ] CHANGELOG.md mis à jour

---

## 📧 Support & Contact

**Responsable du projet** : lepekinoi  
**Localisation** : Notre-Dame-des-Landes, Pays de la Loire, FR  
**Email** : Via GitHub  
**Issues** : [GitHub Issues](https://github.com/lepekinoi/Gestion-Truffiere/issues)

---

## 📄 Licence

Ce projet est distribué sous la licence MIT. Voir le fichier `LICENSE` pour plus de détails.

---

## 🙏 Remerciements

- Développé pour la gestion des exploitations truffières en Pays de la Loire
- Stack React + Express robuste et performant
- Structure BD bien documentée (init-db.sql)

---

## 📚 Documentation complémentaire

- **CHANGELOG.md** - Historique détaillé des versions
- **init-db.sql** - Structure base de données
- **EVOLUTION_14_01_2026.md** - Détail des changements récents
- **suivi_updates_gestion_truffiere.md** - Suivi des mises à jour

---

**Dernière mise à jour** : 14 janvier 2026 12h11 CET  
**Mainteneur** : lepekinoi  
**Status** : ✅ Actif - Évolution majeure en cours
