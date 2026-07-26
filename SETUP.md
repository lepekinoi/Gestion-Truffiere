# 🔧 Guide d'installation — Gestion-Truffière v8

> Installation locale sans Docker — développement et debug

→ Démarrage rapide avec Docker : voir [QUICKSTART.md](QUICKSTART.md)  
→ Configuration Docker détaillée : voir [DOCKER.md](DOCKER.md)

---

## Prérequis

| Outil | Version minimale |
|---|---|
| Node.js | 18 LTS |
| npm | 9.x |
| PostgreSQL | 14+ |
| Git | 2.x |

---

## 1. Cloner le dépôt

```bash
git clone https://github.com/lepekinoi/Gestion-Truffiere.git
cd Gestion-Truffiere
git checkout V8
```

---

## 2. Base de données PostgreSQL

> Le projet utilise **exclusivement PostgreSQL**. MySQL, MariaDB et SQLite ne sont pas supportés.

### 2.1 Créer la base et l'utilisateur

```sql
-- En tant que superutilisateur PostgreSQL
CREATE USER unstuffed1004 WITH PASSWORD 'mot_de_passe_fort';
CREATE DATABASE truffiere_db OWNER unstuffed1004;
GRANT ALL PRIVILEGES ON DATABASE truffiere_db TO unstuffed1004;
```

### 2.2 Initialiser le schéma

```bash
psql -U unstuffed1004 -d truffiere_db -f database/init_database.sql
```

Le script `database/init_database.sql` est idempotent (équivalent à `CREATE TABLE IF NOT EXISTS`) — il peut être rejoué sans risque.

---

## 3. Configuration de l'environnement

### 3.1 Copier le template

```bash
cp .env.exemple backend/.env
```

### 3.2 Renseigner `backend/.env`

```env
# ———————————————————————————
# APPLICATION
# ———————————————————————————
NODE_ENV=development
PORT=3001

# ———————————————————————————
# POSTGRESQL
# ———————————————————————————
DB_HOST=localhost
DB_PORT=5432
DB_NAME=truffiere_db
DB_USER=unstuffed1004
DB_PASSWORD=mot_de_passe_fort

# ———————————————————————————
# JWT — SECRET (générer avec la commande ci-dessous)
# node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
# ———————————————————————————
JWT_SECRET=<64_octets_hex>
JWT_EXPIRES_IN=15m                    # ne pas modifier — politique sécurité V8
REFRESH_TOKEN_EXPIRES_DAYS=7

# ———————————————————————————
# FRONTEND
# ———————————————————————————
CORS_ORIGINS=http://localhost:3000
REACT_APP_VERSION=8.0.0
REACT_APP_API_URL=http://localhost:3001/api
```

> ⚠️ Ne jamais committer `backend/.env` — il est listé dans `.gitignore`.

---

## 4. Installer les dépendances

```bash
# Backend
cd backend
npm install
cd ..

# Frontend
cd frontend
npm install
cd ..
```

---

## 5. Lancer en développement

### Terminal 1 — Backend

```bash
cd backend
npm run dev
# Serveur Express sur http://localhost:3001
# Rechargement automatique avec nodemon
```

### Terminal 2 — Frontend

```bash
cd frontend
npm start
# Serveur React sur http://localhost:3000
# Hot reload actif
```

---

## 6. Vérifier l'installation

```bash
# Health check API
curl http://localhost:3001/api/health
# Attend : {"status":"ok"}

# Test login (identifiants développement)
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@truffiere.local","password":"admin123"}'
```

Accéder à l'application : **http://localhost:3000**

---

## Structure des répertoires

```
Gestion-Truffiere/
├── backend/                # Express.js — 20 fichiers de routes, architecture modulaire
│   ├── routes/             # 20 fichiers de routes (parcelles, arbres, recoltes…)
│   ├── middleware/         # auth JWT, rate limiting, error handler
│   ├── config/             # config DB, Helmet, CORS
│   ├── docs/               # API_ERROR_CODES.md
│   ├── .env                # ← créé à l'étape 3 (ne pas committer)
│   └── server.js
├── frontend/               # React 18 — 18 composants
│   ├── src/
│   │   ├── components/
│   │   └── pages/
│   └── public/
├── database/
│   └── init_database.sql   # Schéma PostgreSQL + données initiales
├── .env.exemple           # Template à copier vers backend/.env
└── docker-compose.yml
```

---

## Sécurité intégrée (rappel)

Le backend V8 inclut les mécanismes suivants — ne pas les désactiver en développement :

- **bcrypt** 12 rounds — hashage des mots de passe
- **Verrouillage de compte** — 5 tentatives échouées = 15 minutes de blocage
- **Rate limiting** — 1 000 req/15 min global, 10 req/15 min sur `/auth/*`
- **IP tracking** — journalisé dans l'audit trail
- **JWT courts** — 15 minutes (access) + 7 jours (refresh) avec rotation
- **Helmet** — headers HTTP sécurisés
- **CORS contrôlé** — origines explicites uniquement
- **85+ codes d'erreur standardisés** — cf. `backend/docs/API_ERROR_CODES.md`

---

## Dépannage

### PostgreSQL inaccessible

```bash
# Vérifier que le service est actif
sudo systemctl status postgresql
# ou
pg_isready -h localhost -p 5432 -U unstuffed1004
```

### Erreur de port déjà utilisé

```bash
lsof -i :3001
lsof -i :3000
```

### Erreur lors de l'initialisation du schéma

```bash
# Vérifier les droits
psql -U unstuffed1004 -d truffiere_db -c "\dt"
# Si vide, relancer le script
psql -U unstuffed1004 -d truffiere_db -f database/init_database.sql
```

### Modules Node.js corrompus

```bash
rm -rf backend/node_modules backend/package-lock.json
rm -rf frontend/node_modules frontend/package-lock.json
npm install --prefix backend
npm install --prefix frontend
```

---

*Dernière mise à jour : mai 2026 — V8 (2.0.2)*
