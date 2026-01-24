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
- [🚀 Démarrage rapide](#-démarrage-rapide)
- [📖 Documentation](#-documentation-technique)
- [🐛 Problèmes connus](#-problèmes-connus)
- [💡 Prochains ajouts](#-prochains-ajouts)
- [🤝 Contribution](#-contribution)
- [📞 Support](#-support)

---

## ✨ Aperçu rapide

**Gestion-Truffière v6** est une plateforme web **enterprise** conçue spécifiquement pour les exploitants truffiers. Elle centralise l'ensemble de la gestion opérationnelle :

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
│  👥 Gestion collaborative              │
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

| Fonctionnalité | Description |
|---|---|
| **📊 Dashboard** | Vue d'ensemble temps réel, statistiques agrégées |
| **🗺️ Cartographie** | Leaflet interactive, marqueurs parcelles |
| **🌳 Parcelles** | CRUD complet, localisation GPS, historique |
| **🌱 Arbres** | Suivi détaillé, état sanitaire, variétés |
| **📦 Récoltes** | Enregistrement quantités, dates, qualité |
| **🔧 Interventions** | Log complet, dates, coûts, traçabilité |
| **👥 Collaboration** | JWT auth, multi-utilisateurs, rôles/permissions |
| **📤 Imports/Exports** | CSV import, PDF export, rapports |
| **🔍 Recherche** | Filtrés multi-modules, tri colonnes |

### 🔄 En développement (Urgent)

| Fonctionnalité | État | Priorité | Notes |
|---|---|---|---|
| **Achats/Fournisseurs** | ⚠️ Incomplet | 🔴 URGENT | Routes API manquantes |
| **Dashboards** | 🔨 Bug fixes | 🔴 URGENT | Affichage graphiques |
| **Interventions** | 🐛 Critique | 🔴 URGENT | Enregistrement données |

### 🚀 Prévisions futures

- [ ] PWA + Mode offline
- [ ] Notifications temps réel (WebSockets)
- [ ] Mobile app (React Native)
- [ ] Analytics IA & prédictions
- [ ] Rapports PDF avancés
- [ ] Intégrations API externes (météo, données agronomiques)

---

## 🚀 Démarrage rapide

### ⚡ Avec Docker (Recommandé)

```bash
# 1. Cloner le repo
git clone https://github.com/lepekinoi/Gestion-Truffiere.git
cd Gestion-Truffiere
git checkout V6

# 2. Configurer
cp backend/.env.example backend/.env
# Éditer backend/.env avec vos paramètres

# 3. Lancer
docker-compose up -d

# 4. Accéder
# Frontend: http://localhost:3000
# Backend API: http://localhost:5000
```

**→ Voir [DOCKER.md](DOCKER.md) pour détails complets (build, troubleshoot, production)**

### 📝 Sans Docker (Développement)

```bash
# === BACKEND ===
cd backend
npm install
npm start
# Running on http://localhost:5000

# === FRONTEND (nouveau terminal) ===
cd frontend
npm install
npm start
# Running on http://localhost:3000
```

**→ Voir [SETUP.md](SETUP.md) pour installation détaillée pas-à-pas**

---

## 📖 Documentation technique

### 📚 Documentation complète

| Document | Description | Audience |
|----------|-------------|----------|
| **[📡 API.md](API.md)** | REST API endpoints, exemples, authentification | Développeurs |
| **[🏠 ARCHITECTURE.md](ARCHITECTURE.md)** | Architecture système, diagrammes, stack, déploiement | Tous |
| **[📋 ROADMAP_V6_FEATURES.md](ROADMAP_V6_FEATURES.md)** | Feuille de route v6+, priorités, estimations | Planification |
| **[🐳 DOCKER.md](DOCKER.md)** | Docker build, run, compose, production | DevOps |
| **[🔧 SETUP.md](SETUP.md)** | Installation détaillée, configuration, prérequis | Nouveaux devs |
| **[🔐 DATABASE.md](DATABASE.md)** | Schéma, migrations, opérations courantes | DBAs |
| **[🐛 TROUBLESHOOTING.md](TROUBLESHOOTING.md)** | Problèmes courants, solutions | Support |
| **[🤝 CONTRIBUTING.md](CONTRIBUTING.md)** | Guidelines contribution, workflow Git | Contributeurs |

### 🔌 API principales endpoints

```
POST   /api/auth/login              - Connexion
GET    /api/parcelles               - Lister parcelles
GET    /api/parcelles/:id           - Détail parcelle
GET    /api/arbres                  - Lister arbres
GET    /api/recoltes                - Lister récoltes
GET    /api/interventions           - Lister interventions
GET    /api/statistiques            - Stats agrégées
GET    /api/users                   - Lister users (admin)
GET    /api/health                  - Health check
```

**→ Voir [API.md](API.md) pour documentation complète avec tous les endpoints et exemples**

---

## 🏗️ Architecture technique

### 📊 Vue d'ensemble

```
CLIENT (React.js)
       ↓ HTTPS/WebSocket
SERVER (Express.js + JWT)
       ↓ SQL Queries
DATABASE (MySQL/PostgreSQL)
```

### 📁 Structure simplifiée

```
Gestion-Truffiere/
├── backend/              # Express.js API
│   ├── server.js        # Serveur principal
│   ├── /routes          # Endpoints API
│   ├── /middleware      # Authentification, validation
│   └── /controllers     # Logique métier
├── frontend/            # React.js App
│   ├── /src/components  # 18 composants React
│   ├── /src/services    # API calls
│   └── /src/context     # État global
├── init-db.sql          # Schéma base de données
├── docker-compose.yml   # Orchestration
├── README.md            # Cette doc
├── API.md               # Documentation API
└── ARCHITECTURE.md      # Architecture détaillée
```

**→ Voir [ARCHITECTURE.md](ARCHITECTURE.md) pour structure détaillée et diagrammes**

---

## 🐛 Problèmes connus

### 🔴 URGENT (À corriger immédiatement)

#### 1. **Bug CRITIQUE: Interventions ne s'enregistrent pas**

- **Symptôme** : Formulaire se soumet sans erreur mais données n'apparaissent pas en BD
- **Priorité** : 🔴 CRITIQUE
- **À faire** : Vérifier validation backend, logging, format JSON

**Diagnostic** :
```bash
docker logs backend  # Vérifier logs
curl -X POST http://localhost:5000/api/interventions \  # Tester endpoint
  -H "Authorization: Bearer <token>" \
  -d '{"parcelle_id": 1, "type": "traitement", ...}'
```

**→ Voir [TROUBLESHOOTING.md](TROUBLESHOOTING.md) pour solutions détaillées**

#### 2. **Dashboards: Bugs d'affichage graphiques**

- **Symptôme** : Certains graphiques ne se chargent pas ou manquent de données
- **Priorité** : 🔴 URGENT
- **À faire** : Audit Dashboard.js, error boundaries, logging

#### 3. **Achats/Fournisseurs: Incomplet**

- **Symptôme** : Routes API manquantes, UI incomplète
- **Priorité** : 🔴 URGENT
- **À faire** : Créer CRUD backend + composants React

### 🟡 À améliorer (Moyen terme)

| Problème | Impact | Effort |
|----------|--------|--------|
| server.js trop volumineux | Maintenabilité | Moyen |
| Pas de tests automatisés | Qualité | Moyen |
| Documentation API manquante | Onboarding | Moyen |
| UX mobile non optimisée | Usabilité | Moyen |

**→ Voir [TROUBLESHOOTING.md](TROUBLESHOOTING.md) pour liste complète et solutions**

---

## 💡 Prochains ajouts

### 📱 Option 1: PWA + Mode Offline (Recommandé)

**Avantages** :
- ✅ Fonctionne hors ligne
- ✅ Icône launcher téléphone
- ✅ Sync données automatique
- ✅ Accès caméra/GPS

**Effort** : 3-4 semaines | **Impact** : Très élevé (travail terrain)

### 🤖 Option 2: Alertes intelligentes

**Avantages** :
- ✅ Notifications auto (maladies, récolte, météo)
- ✅ Rappels programmés
- ✅ Règles configurables
- ✅ Email/SMS/Push

**Effort** : 2-3 semaines | **Impact** : Très élevé (ROI agricole)

### 📊 Option 3: Rapports professionnels

**Avantages** :
- ✅ Rapports PDF personnalisés
- ✅ Graphiques avancés
- ✅ Export XLSX
- ✅ Certification traçabilité

**Effort** : 2-3 semaines | **Impact** : Moyen-élevé (communications externes)

**→ Voir [ROADMAP_V6_FEATURES.md](ROADMAP_V6_FEATURES.md) pour détails complets : architecture, exemples de code, budgets**

---

## 🤝 Contribution

### 📋 Avant de contribuer

- [ ] Fork le projet
- [ ] Lire [CONTRIBUTING.md](CONTRIBUTING.md)
- [ ] Créer feature branch : `feature/nom-feature`
- [ ] Tester localement : `npm test`
- [ ] Committer avec message clair : `feat(module): Description`
- [ ] Créer Pull Request

### ✅ Checklist PR

- [ ] Tests ajoutés et passants
- [ ] Code formaté (ESLint)
- [ ] Documentation mise à jour
- [ ] init-db.sql modifié (si changements BD)
- [ ] Pas de console.log/debugger
- [ ] CHANGELOG.md complété

**→ Voir [CONTRIBUTING.md](CONTRIBUTING.md) pour guidelines détaillés**

---

## 📞 Support

### 🆘 Avant de demander aide

1. ✅ Vérifier [TROUBLESHOOTING.md](TROUBLESHOOTING.md)
2. ✅ Chercher dans [GitHub Issues](https://github.com/lepekinoi/Gestion-Truffiere/issues)
3. ✅ Consulter la documentation appropriée

### 📧 Contact

- **Issues** : [GitHub Issues](https://github.com/lepekinoi/Gestion-Truffiere/issues)
- **Discussions** : [GitHub Discussions](https://github.com/lepekinoi/Gestion-Truffiere/discussions)
- **Owner** : lepekinoi

### 🐛 Signaler un bug

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

### Environment
OS / Node.js / Docker version
```

---

## 📊 Quick Links

| Ressource | Lien |
|-----------|------|
| **Repository** | [GitHub](https://github.com/lepekinoi/Gestion-Truffiere) |
| **Issues** | [GitHub Issues](https://github.com/lepekinoi/Gestion-Truffiere/issues) |
| **📡 API Docs** | [API.md](API.md) |
| **🏠 Architecture** | [ARCHITECTURE.md](ARCHITECTURE.md) |
| **🐳 Docker** | [DOCKER.md](DOCKER.md) |
| **🔧 Setup** | [SETUP.md](SETUP.md) |
| **📋 Roadmap** | [ROADMAP_V6_FEATURES.md](ROADMAP_V6_FEATURES.md) |

---

## 📈 Roadmap v6-v7

### v6.0 (Actuel - Janvier 2026)

✅ Core features  
✅ Architecture stable  
🔄 En finalisation :
- [ ] Corriger bugs critiques
- [ ] Finaliser achats/fournisseurs
- [ ] Dashboard fixes

### v6.1 (Février 2026)

- [ ] PWA & offline support
- [ ] Tests automatisés
- [ ] Swagger documentation

### v7.0 (Trimestre 2, 2026)

- [ ] Système alertes intelligentes
- [ ] Rapports professionnels
- [ ] Mobile app (React Native)
- [ ] Refactor architecture

---

## 📄 Licence

Ce projet est distribué sous **Licence MIT**. Voir [LICENSE](LICENSE).

✅ Libre d'utiliser commercialement  
✅ Libre de modifier & distribuer  
📋 Inclure copyright & licence

---

## 🙏 Remerciements

Merci à :
- 🍄 La communauté truffière
- 💻 Les contributeurs
- 🔧 Les développeurs React & Express
- 🗺️ Leaflet team

---

**🎉 Bienvenue dans Gestion-Truffière!**

*Dernière mise à jour : 24 janvier 2026*  
*By: lepekinoi | Location: Notre-Dame-des-Landes, Pays de la Loire 🇫🇷*
