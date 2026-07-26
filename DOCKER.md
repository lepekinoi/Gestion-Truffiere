# 🐳 Docker — Gestion-Truffière v8

> Guide complet Docker et Docker Compose pour Gestion-Truffière V8

→ Démarrage rapide en 4 étapes : voir [QUICKSTART.md](QUICKSTART.md)  
→ Installation sans Docker : voir [SETUP.md](SETUP.md)

---

## 📋 Table des matières

1. [Prérequis](#-prérequis)
2. [Structure Docker](#-structure-docker)
3. [Variables d'environnement](#-variables-denvironnement)
4. [Commandes essentielles](#-commandes-essentielles)
5. [Environnement de développement](#-environnement-de-développement)
6. [Environnement de production](#-environnement-de-production)
7. [Base de données PostgreSQL](#-base-de-données-postgresql)
8. [Logs & monitoring](#-logs--monitoring)
9. [Troubleshooting](#-troubleshooting)

---

## ✅ Prérequis

```bash
docker --version          # >= 24.x
docker compose version    # >= 2.x (plugin intégré)
git --version             # >= 2.x
```

Installation :
- **Linux** : [docs.docker.com/engine/install](https://docs.docker.com/engine/install/)
- **macOS / Windows** : [Docker Desktop](https://www.docker.com/products/docker-desktop/)

---

## 📁 Structure Docker

```
Gestion-Truffiere/
├── docker-compose.yml          ← orchestration complète
├── Dockerfile                  ← image racine (si utilisée)
├── .env.exemple                ← template variables
│
├── backend/
│   └── Dockerfile              ← image Node.js 18 Alpine
│
├── frontend/
│   └── Dockerfile              ← image Node.js 18 Alpine (build)
│
└── database/
    └── init_database.sql       ← schéma + seed, exécuté au premier démarrage
```

---

## 🔧 Variables d'environnement

```bash
# Copier et éditer le fichier d'environnement
cp .env.exemple backend/.env
```

Variables **obligatoires** avant tout démarrage :

```env
# PostgreSQL — pas MySQL
DB_HOST=postgres
DB_PORT=5432
DB_NAME=truffiere_db
DB_USER=unstuffed1004               # voir database/README.md, section "Prérequis important"
DB_PASSWORD=<mot_de_passe_fort>

# JWT — valeurs IMMUABLES (politique sécurité V8)
JWT_SECRET=<64_octets_hex>          # node -e "require('crypto').randomBytes(64).toString('hex')"
JWT_EXPIRES_IN=15m                  # NE PAS CHANGER — access token 15 min
REFRESH_TOKEN_EXPIRES_DAYS=7

# CORS
CORS_ORIGINS=http://localhost:3000  # ou https://votre-domaine.com en prod (virgules si plusieurs)

# Serveur
PORT=3001
NODE_ENV=production
```

> ⚠️ `JWT_EXPIRES_IN=15m` est intentionnel et ne doit jamais être augmenté.  
> La sécurité V8 repose sur des access tokens courts + refresh tokens avec rotation.
> Ces noms de variables (`DB_*`, `JWT_*`) doivent correspondre exactement à ceux lus par `docker-compose.yml` et `backend/config/`, sous peine de démarrage silencieusement cassé (variable vide).

---

## ⚡ Commandes essentielles

### Démarrage

```bash
# Premier démarrage (build + lancement)
docker compose up -d --build

# Démarrage sans rebuild
docker compose up -d

# Vérifier l'état des conteneurs
docker compose ps

# Santé de l'API
curl http://localhost:3002/api/health
```

### Arrêt

```bash
# Arrêter les conteneurs (données conservées)
docker compose down

# Arrêter ET supprimer les volumes (⚠️ données perdues)
docker compose down -v
```

### Rebuild

```bash
# Rebuild complet sans cache
docker compose build --no-cache
docker compose up -d

# Rebuild d'un seul service
docker compose build --no-cache backend
docker compose up -d backend
```

### Maintenance

```bash
# Redémarrer un service
docker compose restart backend

# Exécuter une commande dans un conteneur
docker compose exec backend sh
docker compose exec db psql -U unstuffed1004 -d truffiere_db

# Supprimer les images inutilisées
docker image prune -f
docker system prune -f
```

---

## 🛠️ Environnement de développement

```bash
# Cloner et basculer sur V8
git clone https://github.com/lepekinoi/Gestion-Truffiere.git
cd Gestion-Truffiere
git checkout V8

# Préparer l'environnement
cp .env.exemple backend/.env
# Éditer backend/.env avec NODE_ENV=development

# Lancer
docker compose up -d --build

# Vérifier
docker compose ps
curl http://localhost:3002/api/health   # {"status":"ok"}
# Frontend : http://localhost:3000
```

En développement, les logs détaillés sont activés via `NODE_ENV=development`  
(les `details` des erreurs API sont exposés).

---

## 🚀 Environnement de production

### docker-compose.yml de référence

```yaml
services:
  db:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_DB:       ${DB_NAME}
      POSTGRES_USER:     ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - db_data:/var/lib/postgresql/data
      - ./database/init_database.sql:/docker-entrypoint-initdb.d/init.sql:ro
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER} -d ${DB_NAME}"]
      interval: 10s
      timeout: 5s
      retries: 5

  backend:
    build: ./backend
    restart: unless-stopped
    environment:
      NODE_ENV:              production
      PORT:                  5000
      DB_HOST:               db
      DB_PORT:               5432
      DB_NAME:               ${DB_NAME}
      DB_USER:               ${DB_USER}
      DB_PASSWORD:           ${DB_PASSWORD}
      JWT_SECRET:            ${JWT_SECRET}
      JWT_EXPIRES_IN:        15m
      REFRESH_TOKEN_EXPIRES_DAYS: 7
      CORS_ORIGINS:          ${FRONTEND_URL}
    ports:
      - "3002:3001"
    depends_on:
      db:
        condition: service_healthy

  frontend:
    build: ./frontend
    restart: unless-stopped
    environment:
      REACT_APP_API_URL: ${BACKEND_URL}/api
    ports:
      - "3000:3000"
    depends_on:
      - backend

volumes:
  db_data:
```

### Nginx reverse proxy (recommandé en prod)

```nginx
server {
    listen 443 ssl;
    server_name m-a-truffes.sytes.net;

    # TLS Let's Encrypt
    ssl_certificate     /etc/letsencrypt/live/m-a-truffes.sytes.net/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/m-a-truffes.sytes.net/privkey.pem;

    # Frontend
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # API
    location /api/ {
        proxy_pass http://localhost:3002;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}

# Redirection HTTP → HTTPS
server {
    listen 80;
    server_name m-a-truffes.sytes.net;
    return 301 https://$host$request_uri;
}
```

---

## 🗄️ Base de données PostgreSQL

### Accès direct

```bash
# Console psql dans le conteneur db
docker compose exec db psql -U unstuffed1004 -d truffiere_db

# Depuis l'hôte (si port 5432 exposé)
psql -h localhost -p 5432 -U unstuffed1004 -d truffiere_db

# Commandes psql utiles
\dt          # lister les tables
\d parcelles # décrire une table
\q           # quitter
```

### Backup & restore

```bash
# Backup manuel
docker compose exec db pg_dump -U unstuffed1004 truffiere_db > backup_$(date +%Y%m%d).sql

# Backup automatique (script intégré)
bash backup-db.sh

# Restaurer une sauvegarde
docker compose exec -T db psql -U unstuffed1004 -d truffiere_db < backup_20260514.sql
```

### Réinitialiser la base (⚠️ développement uniquement)

```bash
# Supprimer et recréer
docker compose down -v
docker compose up -d --build
# init_database.sql est rejoué automatiquement au premier démarrage
```

---

## 📊 Logs & monitoring

```bash
# Logs en temps réel — tous les services
docker compose logs -f

# Logs par service
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f db

# 100 dernières lignes du backend
docker compose logs --tail=100 backend

# Stats ressources
docker stats

# Santé de l'API
curl http://localhost:3002/api/health
# Réponse : {"status":"ok","timestamp":"..."}

# Audit trail (dernières actions)
docker compose exec db psql -U unstuffed1004 -d truffiere_db \
  -c "SELECT user_id, action, table_name, timestamp FROM audit_trail ORDER BY timestamp DESC LIMIT 20;"
```

---

## 🆘 Troubleshooting

### Conteneur qui ne démarre pas

```bash
# Voir les erreurs au démarrage
docker compose logs backend
docker compose logs db

# Vérifier les variables d'environnement
docker compose exec backend env | grep -E 'DATABASE|JWT|NODE_ENV'
```

### Erreur de connexion à la base

```bash
# Vérifier que le conteneur db est healthy
docker compose ps
# La colonne STATUS doit indiquer : healthy

# Tester la connexion depuis le backend
docker compose exec backend node -e "
  const { Pool } = require('pg');
  const p = new Pool({ host: 'db', user: process.env.DB_USER,
    password: process.env.DB_PASSWORD, database: process.env.DB_NAME });
  p.query('SELECT 1').then(() => console.log('OK')).catch(console.error);
"

# Forcer la recréation du conteneur db
docker compose rm -sf db
docker compose up -d db
```

### Port déjà utilisé

```bash
# Identifier le processus
lsof -i :3002
lsof -i :3000

# Arrêter l'occupant ou changer le port dans .env
# PORT=5001 dans backend/.env
```

### Frontend blanc / erreur CORS

```bash
# Vérifier CORS_ORIGINS dans backend/.env
grep CORS_ORIGINS backend/.env
# Doit correspondre exactement à l'URL du frontend

# Vérifier l'URL API dans le frontend
docker compose exec frontend env | grep REACT_APP_API_URL

# Rebuild si les variables ont changé
docker compose down
docker compose up -d --build
```

### Données manquantes après redémarrage

```bash
# Vérifier que le volume est bien présent
docker volume ls | grep db_data

# NE PAS utiliser 'docker compose down -v' en production
# (supprime les volumes = perte de données)
```

### Rebuild après modification du code

```bash
# Backend modifié
docker compose build --no-cache backend
docker compose up -d backend

# Frontend modifié
docker compose build --no-cache frontend
docker compose up -d frontend

# Tout rebuilder proprement
docker compose down
docker compose build --no-cache
docker compose up -d
```

---

*Dernière mise à jour : mai 2026 — V8*
