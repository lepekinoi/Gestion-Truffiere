# 🔧 Setup Guide - Installation détaillée

> Guide complet pour installer Gestion-Truffière **sans Docker** — branche V8

→ Pour un démarrage en 4 étapes avec Docker, voir [QUICKSTART.md](QUICKSTART.md)  
→ Pour le guide Docker complet, voir [DOCKER.md](DOCKER.md)

---

## 📋 Table des matières

1. [Prérequis](#-prérequis)
2. [Cloner le dépôt](#-cloner-le-dépôt)
3. [Configuration PostgreSQL](#-configuration-postgresql)
4. [Configuration Backend](#-configuration-backend)
5. [Configuration Frontend](#-configuration-frontend)
6. [Vérification](#-vérification)
7. [Services système](#-services-système-optionnel)
8. [Troubleshooting](#-troubleshooting)

---

## ✅ Prérequis

### Versions requises

```bash
node --version     # >= 18.x LTS recommandé
npm --version      # >= 9.x
git --version      # >= 2.x
psql --version     # PostgreSQL >= 14
```

### Installation — macOS

```bash
# Homebrew
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

brew install node git postgresql@16
brew services start postgresql@16
```

### Installation — Linux (Ubuntu/Debian)

```bash
sudo apt update && sudo apt upgrade -y

# Node.js 18 LTS
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs git

# PostgreSQL 16
sudo apt install -y postgresql postgresql-contrib
sudo systemctl enable --now postgresql
```

### Installation — Windows

1. [Node.js LTS](https://nodejs.org/) — installer le package officiel
2. [Git](https://git-scm.com/)
3. [PostgreSQL 16](https://www.enterprisedb.com/downloads/postgres-postgresql-downloads)

---

## 📥 Cloner le dépôt

```bash
mkdir -p ~/projects && cd ~/projects

git clone https://github.com/lepekinoi/Gestion-Truffiere.git
cd Gestion-Truffiere

git checkout V8

# Vérifier
git branch
# Doit afficher : * V8

ls -la
# Doit montrer : backend/  frontend/  database/  docker-compose.yml  README.md ...
```

---

## 🗄️ Configuration PostgreSQL

```bash
# Se connecter en tant que superutilisateur postgres
sudo -u postgres psql
```

```sql
-- Créer la base et l'utilisateur
CREATE DATABASE gestion_truffiere;
CREATE USER truffiere WITH PASSWORD 'SecurePassword123!';
ALTER ROLE truffiere SET client_encoding TO 'utf8';
ALTER ROLE truffiere SET default_transaction_isolation TO 'read committed';
GRANT ALL PRIVILEGES ON DATABASE gestion_truffiere TO truffiere;
\q
```

```bash
# Importer le schéma
psql -U truffiere -d gestion_truffiere -f database/init_database.sql

# Vérifier les tables
psql -U truffiere -d gestion_truffiere -c "\dt"
# Doit afficher : users, parcelles, arbres, recoltes, interventions, clients, ventes...
```

---

## 🔌 Configuration Backend

### Étape 1 : Dépendances

```bash
cd backend
npm install
```

### Étape 2 : Variables d'environnement

```bash
# Copier le modèle depuis la racine
cp ../.env.exemple .env
```

Éditer `backend/.env` avec les valeurs suivantes :

```env
# Serveur
PORT=5000
NODE_ENV=development
LOG_LEVEL=debug

# PostgreSQL
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=gestion_truffiere
DATABASE_USER=truffiere
DATABASE_PASSWORD=SecurePassword123!

# JWT — durée courte obligatoire (sécurité)
JWT_SECRET=<générer_ci-dessous>
JWT_REFRESH_SECRET=<générer_ci-dessous>
JWT_EXPIRATION=15m
JWT_REFRESH_EXPIRATION=7d

# CORS
CORS_ORIGIN=http://localhost:3000

# Upload
MAX_FILE_SIZE=52428800
UPLOAD_DIR=./uploads
```

**Générer les secrets JWT** :

```bash
# Exécuter deux fois, copier chaque résultat
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

> ⚠️ `JWT_EXPIRATION=15m` est intentionnel — les access tokens expirent en 15 minutes  
> conformément à la politique de sécurité V8 (refresh tokens avec rotation).

### Étape 3 : Lancer

```bash
# Depuis backend/
npm start

# Attendu :
# Server running on http://localhost:5000
# Connected to PostgreSQL database
```

### Étape 4 : Tester l'API

```bash
curl http://localhost:5000/api/health
# Réponse attendue : {"status":"ok"}
```

---

## 🚀 Configuration Frontend

### Étape 1 : Dépendances

```bash
cd frontend
npm install
```

### Étape 2 : Variables d'environnement

```bash
cat > .env.local << 'EOF'
REACT_APP_API_URL=http://localhost:5000/api
REACT_APP_ENV=development
REACT_APP_DEBUG=true
REACT_APP_VERSION=8.0.0
EOF
```

### Étape 3 : Lancer

```bash
# Depuis frontend/
npm start
# Le navigateur s'ouvre automatiquement sur http://localhost:3000
```

### Étape 4 : Vérifier le login

1. Ouvrir http://localhost:3000
2. Se connecter avec les identifiants par défaut :
   - **Email** : `admin@truffiere.local`
   - **Mot de passe** : `admin123`
3. **Changer le mot de passe immédiatement** : Paramètres → Mon profil → Modifier le mot de passe

Si erreur de connexion :
```bash
# Vérifier le backend
curl http://localhost:5000/api/health

# Vérifier CORS dans backend/.env
grep CORS_ORIGIN backend/.env
# Doit être : http://localhost:3000

# Consulter la console navigateur (F12) pour les erreurs
```

---

## 🗍️ Vérification

### Checklist rapide

```bash
# Système
node --version   # >= 18
psql --version   # >= 14
git branch       # * V8

# Base de données
psql -U truffiere -d gestion_truffiere -c "\dt"  # Tables présentes

# Backend (dans un terminal)
cd backend && npm start
curl http://localhost:5000/api/health  # {"status":"ok"}

# Frontend (dans un autre terminal)
cd frontend && npm start
# http://localhost:3000 accessible
```

### Tests fonctionnels minimaux

- ✅ Login avec `admin@truffiere.local`
- ✅ Dashboard → stats affichées
- ✅ Parcelles → liste visible
- ✅ Récoltes → ajout possible
- ✅ Cartographie → carte Leaflet visible

---

## 🕣 Services système (Optionnel)

### Linux — systemd

```bash
# Service backend
sudo tee /etc/systemd/system/gestion-truffiere-backend.service > /dev/null << EOF
[Unit]
Description=Gestion-Truffiere Backend V8
After=network.target postgresql.service

[Service]
Type=simple
User=$USER
WorkingDirectory=/home/$USER/projects/Gestion-Truffiere/backend
ExecStart=/usr/bin/npm start
Restart=on-failure
RestartSec=10
Environment="NODE_ENV=production"

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now gestion-truffiere-backend
sudo systemctl status gestion-truffiere-backend
```

### macOS — launchd

```bash
# Remplacer YOUR_USER par votre username
cat > ~/Library/LaunchAgents/com.gestion-truffiere.backend.plist << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.gestion-truffiere.backend</string>
  <key>ProgramArguments</key>
  <array>
    <string>/usr/local/bin/npm</string>
    <string>start</string>
  </array>
  <key>WorkingDirectory</key>
  <string>/Users/YOUR_USER/projects/Gestion-Truffiere/backend</string>
  <key>RunAtLoad</key><true/>
  <key>StandardOutPath</key><string>/tmp/gt-backend.log</string>
  <key>StandardErrorPath</key><string>/tmp/gt-backend-error.log</string>
</dict>
</plist>
EOF

launchctl load ~/Library/LaunchAgents/com.gestion-truffiere.backend.plist
```

---

## 🆘 Troubleshooting

### Port déjà occupé

```bash
lsof -i :5000   # Trouver le PID
sudo kill -9 <PID>

# Ou changer de port
PORT=5001 npm start
```

### Problème connexion PostgreSQL

```bash
# Tester la connexion
psql -h localhost -U truffiere -d gestion_truffiere

# Si "role does not exist" — recréer l'utilisateur
sudo -u postgres psql -c "CREATE USER truffiere WITH PASSWORD 'SecurePassword123!';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE gestion_truffiere TO truffiere;"

# Vérifier que PostgreSQL tourne
sudo systemctl status postgresql   # Linux
brew services info postgresql@16   # macOS
```

### npm ERR! module not found

```bash
rm -rf node_modules package-lock.json
npm cache clean --force
npm install
```

### Frontend blanc / erreur CORS

```bash
# Vérifier CORS_ORIGIN dans backend/.env
grep CORS_ORIGIN backend/.env
# Doit être : CORS_ORIGIN=http://localhost:3000

# Vérifier l'URL API dans frontend/.env.local
grep REACT_APP_API_URL frontend/.env.local
# Doit être : http://localhost:5000/api

# Vider le cache navigateur : F12 → Application → Clear storage
```

### Codes d'erreur API

Consulter [`backend/docs/API_ERROR_CODES.md`](backend/docs/API_ERROR_CODES.md) pour la référence complète des 85+ codes d'erreur standardisés.

---

*Dernière mise à jour : mai 2026 — V8*
