# 🐳 Docker Guide - Gestion-Truffière

> Guide complet pour utiliser Docker avec Gestion-Truffière v6

---

## 📋 Table des matières

1. [Prérequis](#-prérequis)
2. [Démarrage rapide](#-démarrage-rapide)
3. [Build des images](#-build-des-images)
4. [Lancer les containers](#-lancer-les-containers)
5. [Docker Compose](#-docker-compose)
6. [Déploiement Production](#-déploiement-production)
7. [Troubleshooting](#-troubleshooting)

---

## ✅ Prérequis

```bash
# Vérifier installation
✓ Docker >= 20.10
  $ docker --version
  Docker version 20.10.12

✓ Docker Compose >= 1.29
  $ docker-compose --version
  docker-compose version 1.29.2

✓ Git
  $ git --version
  git version 2.34.1

✓ Port 3000 & 5000 disponibles
  $ sudo lsof -i :3000
  $ sudo lsof -i :5000
```

**Installation Docker** :
- [Windows](https://docs.docker.com/desktop/install/windows-install/)
- [macOS](https://docs.docker.com/desktop/install/mac-install/)
- [Linux](https://docs.docker.com/engine/install/)

---

## ⚡ Démarrage rapide

```bash
# 1. Cloner le repo
git clone https://github.com/lepekinoi/Gestion-Truffiere.git
cd Gestion-Truffiere
git checkout V6

# 2. Configurer
cp backend/.env.example backend/.env

# 3. Éditer .env avec vos paramètres
vim backend/.env
# Important : 
n#   - DATABASE_HOST=db (nom du service)
#   - JWT_SECRET=votre_clé_aléatoire_min_32_chars
#   - CORS_ORIGIN=http://localhost:3000

# 4. Lancer
docker-compose up -d

# 5. Vérifier
docker-compose ps
docker-compose logs -f

# 6. Accéder
# Frontend: http://localhost:3000
# Backend: http://localhost:5000
# Swagger (si implémenté): http://localhost:5000/api/docs
```

**Logs en temps réel** :
```bash
docker-compose logs -f backend      # Logs backend
docker-compose logs -f frontend     # Logs frontend
docker-compose logs -f db           # Logs database
```

---

## 🐳 Build des images

### Build backend

```bash
# Build image
docker build -t gestion-truffiere:backend-v6 ./backend

# Options avancées
docker build \
  -t gestion-truffiere:backend-v6 \
  --build-arg NODE_ENV=production \
  --no-cache \
  ./backend

# Vérifier
docker images | grep gestion-truffiere
```

### Build frontend

```bash
# Build image
docker build -t gestion-truffiere:frontend-v6 ./frontend

# Build optimisé
docker build \
  -t gestion-truffiere:frontend-v6 \
  --build-arg REACT_APP_API_URL=http://api.example.com \
  --no-cache \
  ./frontend

# Vérifier
docker images | grep gestion-truffiere
```

### Dockerfiles détaillés

**backend/Dockerfile** :
```dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .

EXPOSE 5000
CMD ["npm", "start"]
```

**frontend/Dockerfile** :
```dockerfile
# Build stage
FROM node:18-alpine as builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Production stage
FROM nginx:alpine
COPY --from=builder /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 3000
CMD ["nginx", "-g", "daemon off;"]
```

---

## 🚁 Lancer les containers

### Backend seul

```bash
# Run basique
docker run -d \
  --name truffiere-backend \
  -p 5000:5000 \
  -e DATABASE_HOST=localhost \
  -e DATABASE_PORT=3306 \
  -e DATABASE_NAME=gestion_truffiere \
  -e DATABASE_USER=root \
  -e DATABASE_PASSWORD=root \
  -e JWT_SECRET=your_secret_min_32_chars \
  gestion-truffiere:backend-v6

# Vérifier
docker ps
docker logs -f truffiere-backend

# Stopper
docker stop truffiere-backend
docker rm truffiere-backend
```

### Frontend seul

```bash
# Run basique
docker run -d \
  --name truffiere-frontend \
  -p 3000:3000 \
  -e REACT_APP_API_URL=http://localhost:5000/api \
  gestion-truffiere:frontend-v6

# Vérifier
docker ps
docker logs -f truffiere-frontend

# Stopper
docker stop truffiere-frontend
docker rm truffiere-frontend
```

### Accéder au shell

```bash
# Shell backend
docker exec -it truffiere-backend sh

# Shell frontend
docker exec -it truffiere-frontend sh

# Exécuter commande
docker exec truffiere-backend npm run test
```

---

## 🐳 Docker Compose

### Vue d'ensemble

```yaml
version: '3.8'

services:
  # Frontend React
  frontend:
    build: ./frontend
    ports:
      - "3000:3000"
    environment:
      - REACT_APP_API_URL=http://localhost:5000/api
    depends_on:
      - backend
    networks:
      - truffiere-network

  # Backend Express
  backend:
    build: ./backend
    ports:
      - "5000:5000"
    environment:
      - DATABASE_HOST=db
      - DATABASE_PORT=3306
      - DATABASE_NAME=gestion_truffiere
      - DATABASE_USER=truffiere
      - DATABASE_PASSWORD=secure_password
      - JWT_SECRET=your_secret_min_32_chars
    depends_on:
      - db
    networks:
      - truffiere-network

  # Database MySQL
  db:
    image: mysql:8
    ports:
      - "3306:3306"
    environment:
      - MYSQL_ROOT_PASSWORD=root_password
      - MYSQL_DATABASE=gestion_truffiere
      - MYSQL_USER=truffiere
      - MYSQL_PASSWORD=secure_password
    volumes:
      - ./init-db.sql:/docker-entrypoint-initdb.d/init.sql
      - db_data:/var/lib/mysql
    networks:
      - truffiere-network

volumes:
  db_data:

networks:
  truffiere-network:
    driver: bridge
```

### Commandes courantes

```bash
# === LIFECYCLE ===

# Démarrer
docker-compose up -d

# Démarrer avec rebuild
docker-compose up -d --build

# Démarrer un service spécifique
docker-compose up -d backend

# Arrêter
docker-compose down

# Arrêter avec suppression volumes
docker-compose down -v

# Restart
docker-compose restart backend

# === STATUS ===

# Status containers
docker-compose ps

# Logs
docker-compose logs -f
docker-compose logs -f backend

# Stats
docker-compose stats

# === MAINTENANCE ===

# Accéder au shell
docker-compose exec backend sh
docker-compose exec frontend sh
docker-compose exec db mysql -u root -p

# Lancer commande
docker-compose exec backend npm run test

# Vérifier logs de la dernière heure
docker-compose logs --since 1h

# === NETTOYAGE ===

# Supprimer containers
docker-compose rm

# Supprimer images
docker rmi $(docker images -q 'gestion-truffiere*')

# Prúneage complet (attention!)
docker system prune -a --volumes
```

---

## 📦 Déploiement Production

### Configuration Production

**docker-compose.prod.yml** :
```yaml
version: '3.8'

services:
  frontend:
    image: gestion-truffiere:frontend-v6
    ports:
      - "80:3000"
    environment:
      - REACT_APP_API_URL=https://api.example.com
      - REACT_APP_ENV=production
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000"]
      interval: 30s
      timeout: 10s
      retries: 3

  backend:
    image: gestion-truffiere:backend-v6
    ports:
      - "5000:5000"
    environment:
      - NODE_ENV=production
      - DATABASE_HOST=db.production.com
      - DATABASE_PORT=3306
      - DATABASE_NAME=gestion_truffiere_prod
      - DATABASE_USER=prod_user
      - DATABASE_PASSWORD=${DB_PASSWORD}  # À partir de fichier .env
      - JWT_SECRET=${JWT_SECRET}
      - CORS_ORIGIN=https://app.example.com
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:5000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  # Nginx Reverse Proxy (optionnel)
  nginx:
    image: nginx:alpine
    ports:
      - "443:443"
      - "80:80"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./certs:/etc/nginx/certs:ro
    depends_on:
      - frontend
      - backend
    restart: unless-stopped
```

### Lancer en production

```bash
# Build et push images
docker build -t myregistry/gestion-truffiere:backend-v6 ./backend
docker build -t myregistry/gestion-truffiere:frontend-v6 ./frontend

docker push myregistry/gestion-truffiere:backend-v6
docker push myregistry/gestion-truffiere:frontend-v6

# Sur serveur production
cat > .env.production << EOF
DB_PASSWORD=SecurePassword123!@#
JWT_SECRET=GeneratedKeyMin32CharsRandom!@#$%^&*
EOF

# Lancer
docker-compose -f docker-compose.prod.yml up -d

# Voir logs
docker-compose -f docker-compose.prod.yml logs -f

# Health check
curl https://app.example.com/api/health
```

### Nginx config (optionnel)

```nginx
upstream backend {
  server backend:5000;
}

upstream frontend {
  server frontend:3000;
}

server {
  listen 80;
  server_name api.example.com;
  return 301 https://$server_name$request_uri;
}

server {
  listen 443 ssl http2;
  server_name api.example.com;

  ssl_certificate /etc/nginx/certs/api.example.com.crt;
  ssl_certificate_key /etc/nginx/certs/api.example.com.key;
  ssl_protocols TLSv1.2 TLSv1.3;

  location / {
    proxy_pass http://backend;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}

server {
  listen 80;
  server_name app.example.com;
  return 301 https://$server_name$request_uri;
}

server {
  listen 443 ssl http2;
  server_name app.example.com;

  ssl_certificate /etc/nginx/certs/app.example.com.crt;
  ssl_certificate_key /etc/nginx/certs/app.example.com.key;

  location / {
    proxy_pass http://frontend;
    proxy_set_header Host $host;
    proxy_set_header Connection "upgrade";
    proxy_set_header Upgrade $http_upgrade;
  }
}
```

---

## 🐛 Troubleshooting

### Container ne démarre pas

```bash
# Vérifier logs
docker-compose logs backend

# Étape 1: Port déjà occupé
lsof -i :5000      # Voir qui utilise le port
sudo kill -9 <PID> # Tuer le processus

# Étape 2: Problème configuration .env
cat backend/.env
# Vérifier que DATABASE_HOST=db (pas localhost avec Docker Compose)

# Étape 3: Erreur build
docker-compose build --no-cache

# Étape 4: Volumes corrompu
docker-compose down -v  # Supprime volumes
docker-compose up -d --build
```

### Backend ne se connecte pas à la BD

```bash
# Vérifier logs backend
docker-compose logs -f backend | grep -i "database\|error\|mysql"

# Tester connexion BD directement
docker-compose exec db mysql -u root -p gestion_truffiere -e "SHOW TABLES;"

# Vérifier variables d'environnement
docker-compose exec backend env | grep DATABASE

# Vérifier l'ordre de démarrage
docker-compose ps
# db doit être "Up" avant backend

# Forcer restart
docker-compose restart backend
```

### Frontend blanc ou ne charge pas

```bash
# Vérifier logs frontend
docker-compose logs -f frontend

# Vérifier REACT_APP_API_URL
docker-compose exec frontend env | grep REACT_APP

# Vérifier en localhost
curl http://localhost:3000

# Vider cache navigateur
# Ouvrir DevTools (F12)
# Application > Clear all
# Rafraîchir page
```

### Erreurs mémoire

```bash
# Voir utilisation
docker stats

# Limiter mémoire
docker run -m 1024m -d gestion-truffiere:backend-v6

# Ou dans docker-compose.yml
services:
  backend:
    mem_limit: 1024m
    memswap_limit: 2048m
```

### Network issues

```bash
# Vérifier network
docker network ls
docker network inspect truffiere-network

# Tester connectivité entre containers
docker-compose exec backend ping db
docker-compose exec frontend ping backend

# Recréer network
docker-compose down
docker network rm truffiere-network
docker-compose up -d
```

### Permissions volumes

```bash
# Problème: "Permission denied"

# Solution 1: Changer owner du volume
sudo chown -R $USER:$USER ./data

# Solution 2: Utiliser volumes nommés
volumes:
  db_data:
    driver: local

# Solution 3: Dans docker-compose
services:
  db:
    user: "1000:1000"
```

---

## 📊 Images & Registry

### Push à Docker Hub

```bash
# Login
docker login

# Tag
docker tag gestion-truffiere:backend-v6 myusername/gestion-truffiere:backend-v6
docker tag gestion-truffiere:frontend-v6 myusername/gestion-truffiere:frontend-v6

# Push
docker push myusername/gestion-truffiere:backend-v6
docker push myusername/gestion-truffiere:frontend-v6

# Vérifier
docker images myusername/gestion-truffiere
```

### Pull depuis Registry

```bash
docker pull myregistry/gestion-truffiere:backend-v6
docker run -d -p 5000:5000 myregistry/gestion-truffiere:backend-v6
```

---

## 📃 Bonnes pratiques

### 🔐 Sécurité

- ??? Pas de secrets en dur dans Dockerfiles
- ??? Pas d'exécution en root
- ??? Multi-stage builds pour réduire taille images
- ??? Scanner images : `docker scan myimage`
- ??? Secrets séparés dans .env

### 📊 Taille images

```dockerfile
# ❌ MAUVAIS (gros)
FROM ubuntu:20.04
RUN apt-get update && apt-get install -y nodejs npm

# ✅ BON (petit)
FROM node:18-alpine
```

Comparer tailles :
```bash
docker images
REPOSITORY    TAG      SIZE
ubuntu        latest   77MB
node          18-alpine 170MB
alpine        latest   7.05MB
```

### 📄 Nommage

```bash
# ❌ Mauvais
my_app:latest
backend:v1

# ✅ Bon
gestion-truffiere:backend-v6
gestion-truffiere:frontend-v6
myregistry/gestion-truffiere:backend-v6.0.1
```

### 🗓️ Health checks

```yaml
services:
  backend:
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:5000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
```

---

## 🖭️ Orchestration avancée

### Kubernetes (optionnel)

Pour production scaleée (hors scope de ce guide):
- StatefulSets pour BD
- Deployments pour services
- Services pour networking
- ConfigMaps pour config
- Secrets pour securé

Voir : [Kubernetes Docker Guide](https://kubernetes.io/docs/)

### Swarm (optionnel)

Pour cluster basique :
```bash
docker swarm init
docker stack deploy -c docker-compose.yml truffiere
```

---

## 📚 Ressources

- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose Docs](https://docs.docker.com/compose/)
- [Best Practices](https://docs.docker.com/develop/dev-best-practices/)
- [Docker Hub](https://hub.docker.com/)

---

*Dernière mise à jour : 24 janvier 2026*
