# 🍄 Gestion Truffière - Version 4

![Version](https://img.shields.io/badge/version-4.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)
![React](https://img.shields.io/badge/react-18.2.0-61dafb)
![PostgreSQL](https://img.shields.io/badge/postgresql-15-blue)

Application web complète de gestion d'exploitation truffière, développée en React et Node.js. Optimisez votre production de truffes grâce à un suivi précis de vos parcelles, arbres, interventions et récoltes.

---

## 📋 Table des matières

- [✨ Fonctionnalités](#-fonctionnalités)
- [🏗️ Architecture](#️-architecture)
- [🚀 Démarrage rapide](#-démarrage-rapide)
- [📦 Installation détaillée](#-installation-détaillée)
- [🔑 Authentification](#-authentification)
- [📚 Documentation](#-documentation)
- [🛠️ Technologies utilisées](#️-technologies-utilisées)
- [🗺️ Roadmap](#️-roadmap)
- [🤝 Contribution](#-contribution)

---

## ✨ Fonctionnalités

### 🌳 Gestion de la culture
- **Cartographie des parcelles** : Visualisation et organisation de vos zones de plantation
- **Suivi des arbres truffiers** : Enregistrement détaillé (espèce, âge, état sanitaire, localisation GPS)
- **Planning des interventions** : Gestion de l'irrigation, taille, travail du sol, traitements
- **Calendrier intelligent** : Rappels et suggestions basés sur les meilleures pratiques

### 📊 Gestion de la production
- **Enregistrement des récoltes** : Poids, qualité (Extra, 1ère, 2ème), localisation par arbre
- **Suivi des ventes** : Gestion clients, facturation, historique des transactions
- **Statistiques avancées** : Rendement par parcelle, évolution pluriannuelle, comparaisons
- **Tableaux de bord interactifs** : Visualisation en temps réel de vos KPIs

### 👥 Gestion des utilisateurs
- **Système d'authentification sécurisé** : JWT, refresh tokens, réinitialisation de mot de passe
- **Gestion des rôles** :
  - 🔵 **Propriétaire** : Accès complet (CRUD, gestion utilisateurs, finances)
  - 🟢 **Employé** : Opérations quotidiennes (interventions, récoltes)
  - 🟡 **Consultant** : Lecture seule (statistiques, rapports)
- **Logs d'activité** : Traçabilité complète des actions

### 📈 Analyse et reporting
- **Historique complet** : Traçabilité de toutes les opérations
- **Tableaux de bord personnalisables** : Graphiques, tendances, prévisions
- **Export de rapports** : PDF, Excel, CSV pour comptabilité
- **Analyse comparative** : Benchmark entre parcelles, essences, années

---

## 🏗️ Architecture

```
Gestion-Truffiere/
├── backend/                    # API Node.js + Express
│   ├── routes/                # Routes API (auth, parcelles, arbres, etc.)
│   ├── controllers/           # Logique métier
│   ├── middleware/            # Authentification, validation
│   ├── models/               # Modèles de données
│   ├── config/               # Configuration (DB, JWT, etc.)
│   └── server.js             # Point d'entrée backend
│
├── frontend/                   # Application React
│   ├── src/
│   │   ├── components/       # Composants réutilisables
│   │   │   ├── auth/        # Authentification
│   │   │   ├── dashboard/   # Tableaux de bord
│   │   │   ├── parcelles/   # Gestion parcelles
│   │   │   ├── arbres/      # Gestion arbres
│   │   │   └── recoltes/    # Gestion récoltes
│   │   ├── hooks/           # Hooks personnalisés
│   │   ├── services/        # Appels API
│   │   ├── context/         # Context API (Auth, Theme)
│   │   ├── utils/           # Fonctions utilitaires
│   │   └── App.js           # Application principale
│   └── public/
│
├── DEMARRAGE_RAPIDE.md         # Guide installation rapide
├── README_NOUVELLES_FONCTIONNALITES.md
├── Dashboard_Reorganisation.md
├── analyse-authentification.md
└── README.md                   # Ce fichier
```

### Stack technique

#### Backend
- **Node.js** (v18+) + **Express** : API REST
- **PostgreSQL** (v15) : Base de données relationnelle
- **JWT** : Authentification stateless
- **bcryptjs** : Hashage sécurisé des mots de passe
- **express-validator** : Validation des données
- **nodemailer** : Envoi d'emails (reset password)

#### Frontend
- **React** (v18.2) : Interface utilisateur
- **React Router** (v6) : Navigation SPA
- **Context API** : Gestion d'état global
- **Fetch API** : Communication avec backend
- **CSS Modules** : Styles encapsulés

#### Infrastructure
- **Docker** + **Docker Compose** : Containerisation
- **Nginx** : Reverse proxy (production)
- **Git** : Contrôle de version

---

## 🚀 Démarrage rapide

### Prérequis

- Node.js ≥ 18.0.0
- PostgreSQL ≥ 15
- npm ou yarn
- Git

### Installation express (5 minutes)

```bash
# 1. Cloner le dépôt
git clone https://github.com/lepekinoi/Gestion-Truffiere.git
cd Gestion-Truffiere

# 2. Installer les dépendances
cd backend && npm install
cd ../frontend && npm install

# 3. Configurer la base de données
createdb gestion_truffiere
psql -d gestion_truffiere -f backend/database/init.sql

# 4. Configurer les variables d'environnement
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
# Éditer les fichiers .env avec vos paramètres

# 5. Lancer l'application
# Terminal 1 - Backend
cd backend && npm start

# Terminal 2 - Frontend
cd frontend && npm start

# 🎉 Application accessible sur http://localhost:3000
```

**📖 Pour une installation détaillée, consultez [DEMARRAGE_RAPIDE.md](./DEMARRAGE_RAPIDE.md)**

---

## 📦 Installation détaillée

### Étape 1 : Configuration Backend

```bash
cd backend

# Installation des dépendances
npm install

# Créer le fichier .env
cat > .env << EOL
# Base de données
DB_HOST=localhost
DB_PORT=5432
DB_NAME=gestion_truffiere
DB_USER=postgres
DB_PASSWORD=votre_mot_de_passe

# JWT
JWT_SECRET=votre_secret_super_securise_32_caracteres_minimum
JWT_EXPIRES_IN=24h
JWT_REFRESH_EXPIRES_IN=7d

# Email (optionnel pour reset password)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=votre.email@gmail.com
SMTP_PASS=votre_mot_de_passe_app

# API
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
EOL

# Initialiser la base de données
psql -U postgres << SQL
CREATE DATABASE gestion_truffiere;
\c gestion_truffiere
\i database/init.sql
SQL

# Lancer le serveur
npm start
# ✅ API disponible sur http://localhost:5000
```

### Étape 2 : Configuration Frontend

```bash
cd frontend

# Installation des dépendances
npm install

# Créer le fichier .env
cat > .env << EOL
REACT_APP_API_URL=http://localhost:5000
REACT_APP_VERSION=4.0.0
EOL

# Lancer l'application
npm start
# ✅ Interface disponible sur http://localhost:3000
```

### Étape 3 : Création du premier utilisateur

Deux options :

**Option A - Via l'interface web** :
1. Accéder à http://localhost:3000
2. Cliquer sur "S'inscrire"
3. Remplir le formulaire avec le rôle "Propriétaire"

**Option B - Via la base de données** :

```sql
-- Mot de passe: admin123
INSERT INTO users (email, password_hash, nom, prenom, role_id)
VALUES (
    'admin@truffiere.fr',
    '$2a$10$CwTycUXWue0Thq9StjUM0uJ8JnQBBN8T2OKhKm.xhzCN.sJZHKQsm',
    'Admin',
    'Système',
    (SELECT id FROM roles WHERE nom = 'proprietaire')
);
```

---

## 🔑 Authentification

### Système de rôles

| Rôle | Accès | Permissions |
|------|-------|-------------|
| **Propriétaire** | Complet | CRUD sur tout, gestion utilisateurs, finances, exports |
| **Employé** | Standard | Créer/modifier parcelles, arbres, interventions, récoltes |
| **Consultant** | Lecture | Consulter données, statistiques, générer rapports |

### Sécurité

- ✅ Tokens JWT avec expiration (24h)
- ✅ Refresh tokens (7 jours)
- ✅ Mots de passe hashés (bcrypt, 10 rounds)
- ✅ Protection CSRF
- ✅ Rate limiting sur les routes sensibles
- ✅ Logs de connexion (IP, user-agent)
- ✅ Réinitialisation sécurisée par email

**📖 Plus de détails : [analyse-authentification.md](./analyse-authentification.md)**

---

## 📚 Documentation

| Document | Description |
|----------|-------------|
| [DEMARRAGE_RAPIDE.md](./DEMARRAGE_RAPIDE.md) | Guide d'installation et premier lancement |
| [README_NOUVELLES_FONCTIONNALITES.md](./README_NOUVELLES_FONCTIONNALITES.md) | Détail des fonctionnalités V4 |
| [Dashboard_Reorganisation.md](./Dashboard_Reorganisation.md) | Architecture du tableau de bord |
| [analyse-authentification.md](./analyse-authentification.md) | Système d'authentification |
| `backend/API.md` | Documentation des endpoints API |
| `frontend/COMPONENTS.md` | Guide des composants React |

---

## 🛠️ Technologies utilisées

### Backend
![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![Express](https://img.shields.io/badge/Express-000000?style=for-the-badge&logo=express&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)
![JWT](https://img.shields.io/badge/JWT-000000?style=for-the-badge&logo=jsonwebtokens&logoColor=white)

### Frontend
![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white)

### DevOps
![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)
![Git](https://img.shields.io/badge/Git-F05032?style=for-the-badge&logo=git&logoColor=white)

---

## 🗺️ Roadmap

### Version 4.1 (En cours)
- [ ] Module météo intégré (API Météo France)
- [ ] Notifications push (PWA)
- [ ] Export cartographique (GeoJSON, KML)
- [ ] Mode hors-ligne progressif

### Version 4.2 (Q2 2026)
- [ ] Application mobile (React Native)
- [ ] Intégration capteurs IoT (humidité sol)
- [ ] Intelligence artificielle (prédiction récoltes)
- [ ] Module de gestion financière avancée

### Version 5.0 (Q4 2026)
- [ ] Blockchain pour traçabilité
- [ ] Marketplace intégrée
- [ ] Multi-exploitation (groupements)
- [ ] API publique pour intégrations tierces

**💡 Proposez vos idées en ouvrant une [issue](https://github.com/lepekinoi/Gestion-Truffiere/issues) !**

---

## 🤝 Contribution

Les contributions sont les bienvenues ! Voici comment participer :

1. **Fork** le projet
2. **Créer une branche** pour votre fonctionnalité (`git checkout -b feature/AmazingFeature`)
3. **Commit** vos changements (`git commit -m 'Add AmazingFeature'`)
4. **Push** vers la branche (`git push origin feature/AmazingFeature`)
5. **Ouvrir une Pull Request**

### Guidelines

- Suivre les conventions de code existantes
- Écrire des tests pour les nouvelles fonctionnalités
- Mettre à jour la documentation si nécessaire
- Commenter le code pour les parties complexes

---

## 📄 Licence

Ce projet est sous licence MIT. Voir le fichier [LICENSE](LICENSE) pour plus de détails.

---

## 👨‍💻 Auteur

**lepekinoi**
- GitHub: [@lepekinoi](https://github.com/lepekinoi)
- Projet: [Gestion-Truffiere](https://github.com/lepekinoi/Gestion-Truffiere)

---

## 🙏 Remerciements

- Communauté des trufficulteurs pour leurs retours
- Contributeurs open-source
- [INRAE](https://www.inrae.fr/) pour les recherches sur la trufficulture
- [WETRUF](https://wetruf.com/) pour l'inspiration

---

## 📞 Support

- 📧 Email: support@gestion-truffiere.fr
- 🐛 Issues: [GitHub Issues](https://github.com/lepekinoi/Gestion-Truffiere/issues)
- 📖 Documentation: [Wiki](https://github.com/lepekinoi/Gestion-Truffiere/wiki)

---

<div align="center">

**⭐ Si ce projet vous est utile, n'hésitez pas à lui donner une étoile !**

Made with 🍄 for truffle lovers

</div>
