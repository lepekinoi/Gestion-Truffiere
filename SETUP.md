# 🔧 Setup Guide - Installation détaillée

> Guide complet pour installer Gestion-Truffière sans Docker

---

## 📋 Table des matières

1. [Prérequis](#-prérequis)
2. [Installation système](#-installation-système)
3. [Configuration Base de données](#-configuration-base-de-données)
4. [Configuration Backend](#-configuration-backend)
5. [Configuration Frontend](#-configuration-frontend)
6. [Vérification étape par étape](#-vérification-étape-par-étape)
7. [Services système](#-services-système-optionnel)

---

## ✅ Prérequis

### Version requises

```bash
# Vérifier
node --version          # Doit être >= 14.x
npm --version           # Doit être >= 6.x
git --version           # Doit être >= 2.x
mysql --version         # Pour MySQL
postgres --version      # Pour PostgreSQL (si choisi)
```

### Installation système

**macOS** :
```bash
# Installer Homebrew
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Installer Node.js
brew install node

# Installer Git
brew install git

# Installer MySQL (optionnel)
brew install mysql
brew services start mysql

# Vérifier
node --version
```

**Windows** :
1. Installer Node.js depuis https://nodejs.org/
2. Installer Git depuis https://git-scm.com/
3. Installer MySQL depuis https://dev.mysql.com/downloads/mysql/
4. Vérifier dans Command Prompt :
   ```cmd
   node --version
   npm --version
   git --version
   ```

**Linux (Ubuntu/Debian)** :
```bash
# Update packages
sudo apt update && sudo apt upgrade -y

# Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Git
sudo apt install -y git

# MySQL
sudo apt install -y mysql-server
sudo mysql_secure_installation

# Vérifier
node --version
npm --version
```

---

## 🐳 Installation système

### Étape 1₠: Cloner le repo

```bash
# 1. Choisir dossier
mkdir -p ~/projects
cd ~/projects

# 2. Cloner
git clone https://github.com/lepekinoi/Gestion-Truffiere.git
cd Gestion-Truffiere

# 3. Checkout branche V6
git checkout V6

# 4. Vérifier
git branch
# Doit afficher: * V6

ls -la
# Doit montrer: backend, frontend, init-db.sql, README.md, etc.
```

### Étape 2₠: Vérifier permissions

```bash
# Dossier projet accessible
ls -ld .
# Doit afficher: drwxr-xr-x (ou rwx pour propriétaire)

# Backend accessible
ls -ld ./backend
ls ./backend/package.json

# Frontend accessible
ls -ld ./frontend
ls ./frontend/package.json
```

---

## 🖺 Configuration Base de données

### Option A: MySQL (Recommandé production)

**Créer la BD** :

```bash
# 1. Se connecter à MySQL
mysql -u root -p
# Entrer password root

# 2. Dans MySQL console
CREATE DATABASE gestion_truffiere;
CREATE USER 'truffiere'@'localhost' IDENTIFIED BY 'SecurePassword123!';
GRANT ALL PRIVILEGES ON gestion_truffiere.* TO 'truffiere'@'localhost';
FLUSH PRIVILEGES;
EXIT;

# 3. Importer schéma
mysql -u truffiere -p gestion_truffiere < init-db.sql
# Entrer le password 'SecurePassword123!'

# 4. Vérifier
mysql -u truffiere -p gestion_truffiere -e "SHOW TABLES;"
# Doit afficher les tables : users, parcelles, arbres, recoltes, interventions
```

**Vérifier structure** :

```bash
mysql -u truffiere -p gestion_truffiere << EOF
SHOW TABLES;
DESCRIBE users;
DESCRIBE parcelles;
SELECT COUNT(*) as total_tables FROM information_schema.tables WHERE table_schema = 'gestion_truffiere';
EOF
```

### Option B: PostgreSQL

```bash
# 1. Se connecter
sudo -u postgres psql

# 2. Créer BD et user
CREATE DATABASE gestion_truffiere;
CREATE USER truffiere WITH PASSWORD 'SecurePassword123!';
ALTER ROLE truffiere SET client_encoding TO 'utf8';
ALTER ROLE truffiere SET default_transaction_isolation TO 'read committed';
ALTER ROLE truffiere SET default_transaction_deferrable TO on;
GRANT ALL PRIVILEGES ON DATABASE gestion_truffiere TO truffiere;
\q

# 3. Importer schéma (adapter pour PostgreSQL)
psql -U truffiere -d gestion_truffiere < init-db.sql

# 4. Vérifier
psql -U truffiere -d gestion_truffiere -c "\dt"
```

### Option C: SQLite (Développement)

```bash
# SQLite crée la BD automatiquement
# Adapter init-db.sql pour SQLite ou utiliser:

cd backend
sqlite3 gestion_truffiere.db < ../init-db.sql

# Vérifier
sqlite3 gestion_truffiere.db ".tables"
```

---

## 🔌 Configuration Backend

### Étape 1: Dépendances

```bash
cd backend

# 1. Installer npm packages
npm install
# Ou avec Yarn
yarn install

# Vérifier
ls -la node_modules | head
npm list --depth=0
```

### Étape 2: Variables d'environnement

```bash
# Créer fichier .env
cat > .env << 'EOF'
# Server
PORT=5000
NODE_ENV=development
LOG_LEVEL=debug

# Database - Si MySQL
DATABASE_HOST=localhost
DATABASE_PORT=3306
DATABASE_NAME=gestion_truffiere
DATABASE_USER=truffiere
DATABASE_PASSWORD=SecurePassword123!

# Database - Si PostgreSQL (remplacer au-dessus par)
# DATABASE_HOST=localhost
# DATABASE_PORT=5432
# DATABASE_NAME=gestion_truffiere
# DATABASE_USER=truffiere
# DATABASE_PASSWORD=SecurePassword123!

# JWT - Générer clés aléatoires
JWT_SECRET=GeneratedKeyMin32CharsRandom!@#$%^&*KeyGenerate
JWT_REFRESH_SECRET=AnotherSecretKeyMin32CharsRandom!@#$%^&*KeyGen
JWT_EXPIRATION=1h
JWT_REFRESH_EXPIRATION=7d

# CORS
CORS_ORIGIN=http://localhost:3000

# Upload
MAX_FILE_SIZE=52428800
UPLOAD_DIR=./uploads
EOF

# Afficher pour vérifier
cat .env
```

**Générer clés JWT** :

```bash
# Créer clé aléatoire min 32 caractères
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Copier le résultat dans JWT_SECRET

node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Copier le résultat dans JWT_REFRESH_SECRET
```

### Étape 3: Lancer le serveur

```bash
# Depuis dossier backend/
npm start

# Début du serveur :
# Server running on http://localhost:5000
# Connected to database

# Pour arrêter
# CTRL+C
```

### Étape 4: Tester l'API

```bash
# Depuis autre terminal

# Test health
curl http://localhost:5000/api/health
# Réponse : {"status":"ok"}

# Vérifier si BD connectée
curl http://localhost:5000/api/stats
# Doit retourner JSON avec stats
```

---

## 🚀 Configuration Frontend

### Étape 1: Dépendances

```bash
cd frontend

# 1. Installer npm packages
npm install

# Vérifier
ls -la node_modules | head
npm list --depth=0
```

### Étape 2: Variables d'environnement

```bash
# Créer fichier .env.local
cat > .env.local << 'EOF'
REACT_APP_API_URL=http://localhost:5000/api
REACT_APP_ENV=development
REACT_APP_DEBUG=true
REACT_APP_VERSION=6.0.0
EOF

cat .env.local
```

### Étape 3: Lancer le dev server

```bash
# Depuis dossier frontend/
npm start

# Automatiqu
# - Browser devrait ouvrir http://localhost:3000
# - Si non, ouvrir manuellement

# Pour arrêter
# CTRL+C
```

### Étape 4: Vérifier login

1. Ouvrir http://localhost:3000
2. Page login devrait s'afficher
3. Essayer se connecter :
   - Email: admin@example.com
   - Password: AdminPassword123!

Si erreur :
```bash
# Vérifier backend
curl http://localhost:5000/api/health

# Vérifier console navigateur (F12)
# Chercher erreurs CORS
```

---

## 🗍️ Vérification étape par étape

### Checklist d'installation

```bash
# === SYSTÈME ===
✓ Node.js >= 14
  node --version
  ✓ npm >= 6
  npm --version
  ✓ Git
  git --version
  ✓ MySQL/PostgreSQL
  mysql --version

# === REPO ===
✓ Dossier ~/projects/Gestion-Truffiere
  ls -la
  ✓ Branch V6
  git branch
  ✓ Fichier init-db.sql
  ls init-db.sql

# === BASE DE DONNÉES ===
✓ BD gestion_truffiere existé
  mysql -u truffiere -p -e "SHOW DATABASES LIKE 'gestion_truffiere';"
  ✓ Tables créées
  mysql -u truffiere -p gestion_truffiere -e "SHOW TABLES;"
  ✓ Table users avec colonnes
  mysql -u truffiere -p gestion_truffiere -e "DESCRIBE users;"

# === BACKEND ===
✓ node_modules installés
  ls backend/node_modules | wc -l
  ✓ .env présent
  ls -la backend/.env
  ✓ Port 5000 libre
  lsof -i :5000
  ✓ Server démarre
  # cd backend && npm start
  # Vérifier : "Server running on 5000"

# === FRONTEND ===
✓ node_modules installés
  ls frontend/node_modules | wc -l
  ✓ .env.local présent
  ls -la frontend/.env.local
  ✓ Port 3000 libre
  lsof -i :3000
  ✓ App démarre
  # cd frontend && npm start
  # Devrait ouvrir http://localhost:3000

# === API ===
✓ Backend rpond
  curl http://localhost:5000/api/health
  ✓ CORS OK
  # Ouvrir DevTools, pas d'erreur CORS
  ✓ Login possible
  # Entrer credentials
```

### Tests métiers

```bash
# === PARCELLES ===
# Frontend > Parcelles
# ✅ Listée
# ✅ Creer
# ✅ Modifier
# ✅ Supprimer

# === ARBRES ===
# Frontend > Arbres
# ✅ Listé
# ✅ Créé

# === RÉCOLTES ===
# Frontend > Récoltes
# ✅ Enregistrée
# ✅ Chart s'affiche

# === INTERVENTIONS ===
# Frontend > Interventions
# ✅ Énregistrée (URGENT si bug!)
# ✅ Listée

# === DASHBOARD ===
# Frontend > Dashboard
# ✅ Stats affichées
# ✅ Graphiques chargés
# ✅ Carte visible
```

---

## 🕣 Services système (Optionnel)

### Lancer au démarrage macOS

```bash
# Backend
cat > ~/Library/LaunchAgents/com.gestion-truffiere.backend.plist << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.gestion-truffiere.backend</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/npm</string>
        <string>start</string>
    </array>
    <key>WorkingDirectory</key>
    <string>/Users/YOUR_USER/projects/Gestion-Truffiere/backend</string>
    <key>RunAtLoad</key>
    <true/>
    <key>StandardOutPath</key>
    <string>/tmp/gestion-truffiere-backend.log</string>
    <key>StandardErrorPath</key>
    <string>/tmp/gestion-truffiere-backend-error.log</string>
</dict>
</plist>
EOF

# Remplacer YOUR_USER par votre username
# Lancer
launchctl load ~/Library/LaunchAgents/com.gestion-truffiere.backend.plist

# Vérifier
launchctl list | grep gestion-truffiere
```

### Lancer au démarrage Linux

```bash
# Créer service backend
sudo tee /etc/systemd/system/gestion-truffiere-backend.service > /dev/null << EOF
[Unit]
Description=Gestion-Truffiere Backend
After=network.target mysql.service

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

# Démarrer
sudo systemctl daemon-reload
sudo systemctl enable gestion-truffiere-backend
sudo systemctl start gestion-truffiere-backend

# Vérifier
sudo systemctl status gestion-truffiere-backend
```

---

## 🆘 Troubleshooting Installation

### Port déjà occupé

```bash
# Port 3000
lsof -i :3000
# Voir PID
sudo kill -9 <PID>

# Port 5000
lsof -i :5000
sudo kill -9 <PID>

# Ou changer port
PORT=5001 npm start  # Backend
PORT=3001 npm start  # Frontend
```

### Problème connexion BD

```bash
# MySQL conné
mysql -h localhost -P 3306 -u truffiere -p
# Entrer password

# PostgreSQL
psql -h localhost -U truffiere -d gestion_truffiere

# Si "Access denied for user":
# Vérifier BD existe et user créé
mysql -u root -p -e "SELECT user, host FROM mysql.user;"

# Si "Cannot connect to MySQL":
# Relancer service
sudo systemctl restart mysql  # Linux
brew services restart mysql    # macOS
```

### "npm ERR! not found"

```bash
# Supprimer node_modules et réinstaller
rm -rf node_modules package-lock.json
npm cache clean --force
npm install
```

### Frontend blanc / CORS error

```bash
# Vérifier CORS_ORIGIN dans backend/.env
cat backend/.env | grep CORS
# Doit être : http://localhost:3000

# Vérifier API_URL dans frontend/.env.local
cat frontend/.env.local | grep API
# Doit être : http://localhost:5000/api

# Vider cache navigateur
# F12 > Application > Clear all
```

### Package versions conflict

```bash
# Si "peer dependencies warning"
npm install --legacy-peer-deps

# Si conflit persistent
rm -rf node_modules package-lock.json
npm install --no-optional
```

---

## 🖭 Aide supplémentaire

Consulter :
- [TROUBLESHOOTING.md](TROUBLESHOOTING.md) - Problèmes courants
- [DOCKER.md](DOCKER.md) - Installation via Docker (plus simple)
- [API.md](API.md) - Documentation API
- [ARCHITECTURE.md](ARCHITECTURE.md) - Architecture technique

---

*Dernière mise à jour : 24 janvier 2026*
