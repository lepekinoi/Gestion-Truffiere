# 🚀 Guide de démarrage rapide

## Installation en 3 étapes

### 1️⃣ Prérequis
- Docker et Docker Compose installés
- Ports 3000, 3001, 5432 disponibles

### 2️⃣ Lancement

```bash
cd truffiere-project
docker-compose up --build
```

### 3️⃣ Accès

- **Application** : http://localhost:3000
- **API** : http://localhost:3001/api

## ⚡ Commandes essentielles

```bash
# Démarrer
docker-compose up -d

# Arrêter
docker-compose down

# Voir les logs
docker-compose logs -f

# Sauvegarder la base
docker exec truffiere_db pg_dump -U unstuffed1004 truffiere > backup.sql
```

## 🔧 Configuration réseau local

Pour accéder depuis d'autres machines :

1. Trouver votre IP : `ipconfig` (Windows) ou `ifconfig` (Linux/Mac)
2. Modifier `docker-compose.yml` ligne 59 :
   ```yaml
   - REACT_APP_API_URL=http://VOTRE_IP:3001/api
   ```
3. Relancer : `docker-compose down && docker-compose up -d`

## 📚 Documentation complète

Voir [README.md](README.md) pour plus de détails.
