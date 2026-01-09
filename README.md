# 🍄 Gestion de Truffière

Application complète de gestion de truffière avec Docker, PostgreSQL/PostGIS, Node.js/Express et React.

## 📋 Fonctionnalités

### Gestion de la Culture
- 🗺️ Cartographie interactive des parcelles (avec Leaflet + PostGIS)
- 🌳 Suivi des arbres truffiers (espèce, âge, état)
- 🛠️ Planning des interventions (irrigation, taille, travail du sol)

### Gestion de la Production
- 🍄 Enregistrement des récoltes (poids, qualité, localisation)
- 💰 Suivi des ventes
- 👥 Gestion des clients

### Analyse et Statistiques
- 📊 Tableaux de bord interactifs
- 📈 Statistiques par parcelle, arbre, période
- 📉 Graphiques de production et ventes (Recharts)
- 🔍 Traçabilité complète (triggers automatiques)
- 🔮 Prévisions météo intégrées

## 🚀 Installation et lancement

### Prérequis
- Docker et Docker Compose installés
- Ports 3000, 3001 et 5432 disponibles

### Installation rapide

```bash
# 1. Cloner ou télécharger le projet
cd truffiere-project

# 2. Lancer l'application
docker-compose up --build

# Ou en arrière-plan
docker-compose up -d --build
```

### Accès à l'application

Une fois démarré, accédez à :
- 🌐 **Frontend** : http://localhost:3000
- 🔌 **API Backend** : http://localhost:3001/api
- 🗄️ **PostgreSQL** : localhost:5432

### Test rapide

```bash
# Vérifier que l'API fonctionne
curl http://localhost:3001/api/health

# Récupérer les parcelles
curl http://localhost:3001/api/parcelles
```

## 📁 Structure du projet

```
truffiere-project/
├── docker-compose.yml          # Orchestration des services
├── init-db.sql                 # Schéma de la base de données
├── README.md                   # Cette documentation
├── .gitignore                  # Fichiers à ignorer par Git
│
├── backend/                    # API Node.js/Express
│   ├── Dockerfile
│   ├── package.json
│   ├── server.js              # Serveur avec toutes les routes
│   └── .env                   # Variables d'environnement
│
├── frontend/                   # Application React
│   ├── Dockerfile
│   ├── package.json
│   ├── .env.example
│   ├── public/
│   │   └── index.html
│   └── src/
│       ├── index.js
│       ├── App.js
│       ├── App.css
│       └── components/
│           ├── Dashboard.js    # Tableau de bord
│           ├── Carte.js        # Cartographie Leaflet
│           ├── Parcelles.js    # Gestion parcelles
│           ├── Arbres.js       # Gestion arbres
│           ├── Interventions.js
│           ├── Recoltes.js
│           ├── Clients.js
│           ├── Ventes.js
│           ├── Statistiques.js
│           ├── Previsions.js
│           └── WeatherWidget.js
│
└── nginx/                      # Configuration Nginx (production)
    └── nginx.conf
```

## 🛠️ Commandes utiles

### Docker

```bash
# Voir les logs
docker-compose logs -f

# Logs d'un service spécifique
docker-compose logs -f backend

# Arrêter l'application
docker-compose down

# Arrêter et supprimer les volumes (⚠️ efface les données)
docker-compose down -v

# Redémarrer un service
docker-compose restart backend

# Voir l'état des services
docker-compose ps
```

### Base de données

```bash
# Accéder à PostgreSQL
docker exec -it truffiere_db psql -U unstuffed1004 -d truffiere

# Commandes psql utiles
\dt                    # Lister les tables
\d+ parcelles         # Structure d'une table
SELECT * FROM arbres; # Requête SQL
\q                    # Quitter

# Sauvegarder la base
docker exec truffiere_db pg_dump -U unstuffed1004 truffiere > backup_$(date +%Y%m%d).sql

# Restaurer la base
docker exec -i truffiere_db psql -U unstuffed1004 truffiere < backup.sql
```

## 🗄️ Architecture de la base de données

### Tables principales
- **parcelles** : Informations sur les parcelles avec géométrie PostGIS
- **arbres** : Inventaire des arbres truffiers
- **types_intervention** : Catalogue des types d'interventions
- **interventions** : Planning et historique des travaux
- **recoltes** : Enregistrement des récoltes
- **clients** : Gestion des clients (particuliers et professionnels)
- **ventes** : Suivi des ventes
- **historique** : Audit trail automatique (via triggers)

### Vues statistiques
- **stats_production_parcelle** : Production par parcelle et année
- **stats_production_arbre** : Production par arbre
- **stats_ventes** : Chiffre d'affaires mensuel

## 🔧 Configuration

### Variables d'environnement Backend

Modifiez `backend/.env` pour la production :

```env
NODE_ENV=production
PORT=3001
DB_HOST=postgres
DB_PORT=5432
DB_NAME=truffiere
DB_USER=votre_utilisateur
DB_PASSWORD=votre_mot_de_passe_securise
```

### Configuration réseau Frontend

Pour accéder depuis d'autres machines du réseau :

1. Créez `frontend/.env` :
```env
REACT_APP_API_URL=http://VOTRE_IP:3001/api
```

2. Ou modifiez directement dans `docker-compose.yml` :
```yaml
frontend:
  environment:
    - REACT_APP_API_URL=http://192.168.1.X:3001/api
```

## 🔒 Sécurité (TODO pour la production)

- [ ] Changer les mots de passe par défaut dans `backend/.env` et `docker-compose.yml`
- [ ] Ajouter l'authentification JWT
- [ ] Configurer HTTPS avec certificats SSL
- [ ] Limiter les CORS aux domaines autorisés
- [ ] Ajouter la validation des entrées côté backend
- [ ] Implémenter les rôles utilisateurs
- [ ] Mettre en place des backups automatiques
- [ ] Configurer un reverse proxy (Nginx)

## 🐛 Dépannage

### Port déjà utilisé
```bash
# Modifier les ports dans docker-compose.yml
ports:
  - "3002:3001"  # Backend sur port 3002 au lieu de 3001
  - "3001:3000"  # Frontend sur port 3001 au lieu de 3000
```

### Base de données non accessible
```bash
# Vérifier les logs PostgreSQL
docker-compose logs postgres

# Vérifier que le healthcheck passe
docker-compose ps

# Recréer complètement
docker-compose down -v
docker-compose up --build
```

### Module not found (npm)
```bash
# Supprimer node_modules et réinstaller
docker-compose down
rm -rf backend/node_modules frontend/node_modules
docker-compose up --build
```

### Problème de connexion API depuis le frontend
```bash
# Vérifier que l'API répond
curl http://localhost:3001/api/health

# Vérifier les logs du backend
docker-compose logs -f backend

# Vérifier la variable REACT_APP_API_URL
docker-compose logs frontend | grep API_URL
```

## 📊 API Endpoints

### Parcelles
- `GET /api/parcelles` - Liste des parcelles (avec géométrie)
- `GET /api/parcelles/:id` - Détail d'une parcelle
- `POST /api/parcelles` - Créer une parcelle
- `PUT /api/parcelles/:id` - Modifier une parcelle (avec coordonnées)
- `DELETE /api/parcelles/:id` - Supprimer une parcelle

### Arbres
- `GET /api/arbres?parcelle_id=X` - Liste des arbres (optionnel : filtrer par parcelle)
- `POST /api/arbres` - Créer un arbre
- `PUT /api/arbres/:id` - Modifier un arbre (avec position GPS)
- `DELETE /api/arbres/:id` - Supprimer un arbre

### Interventions
- `GET /api/interventions?debut=YYYY-MM-DD&fin=YYYY-MM-DD` - Liste des interventions
- `GET /api/types-intervention` - Types d'interventions disponibles
- `POST /api/interventions` - Créer une intervention
- `PUT /api/interventions/:id` - Modifier une intervention
- `DELETE /api/interventions/:id` - Supprimer une intervention

### Récoltes
- `GET /api/recoltes?annee=YYYY` - Liste des récoltes (optionnel : filtrer par année)
- `POST /api/recoltes` - Enregistrer une récolte
- `PUT /api/recoltes/:id` - Modifier une récolte
- `DELETE /api/recoltes/:id` - Supprimer une récolte

### Clients et Ventes
- `GET /api/clients` - Liste des clients
- `POST /api/clients` - Créer un client
- `PUT /api/clients/:id` - Modifier un client
- `DELETE /api/clients/:id` - Supprimer un client
- `GET /api/ventes` - Liste des ventes
- `POST /api/ventes` - Enregistrer une vente
- `PUT /api/ventes/:id` - Modifier une vente
- `DELETE /api/ventes/:id` - Supprimer une vente

### Statistiques
- `GET /api/stats/production-parcelle` - Production par parcelle et année
- `GET /api/stats/production-arbre` - Production par arbre (top producteurs)
- `GET /api/stats/ventes` - Chiffre d'affaires mensuel

### Historique
- `GET /api/historique?table_name=X&record_id=Y&limit=50` - Historique des modifications

### Santé
- `GET /api/health` - Vérifier que l'API fonctionne

## 📝 Technologies utilisées

### Backend
- Node.js 18 (Alpine)
- Express.js 4.18
- PostgreSQL 16 + PostGIS 3.4
- pg (node-postgres) 8.11
- CORS, dotenv, morgan

### Frontend
- React 18
- Axios (requêtes HTTP)
- Leaflet + React-Leaflet (cartographie interactive)
- Recharts (graphiques et statistiques)
- React Router DOM (navigation)

### Infrastructure
- Docker & Docker Compose
- PostGIS (extension spatiale PostgreSQL)
- Nginx (optionnel pour production)

## 🚀 Déploiement en production

### 1. Préparer l'environnement

```bash
# Modifier les mots de passe
nano backend/.env
nano docker-compose.yml

# Créer les certificats SSL (optionnel)
mkdir -p nginx/ssl
# ... générer les certificats
```

### 2. Build et démarrage

```bash
# Mode production
docker-compose up -d --build

# Vérifier les logs
docker-compose logs -f
```

### 3. Configuration Nginx (recommandé)

Décommenter la section nginx dans `docker-compose.yml` et configurer le reverse proxy.

### 4. Backups automatiques

```bash
# Ajouter un cron job pour les backups quotidiens
0 2 * * * docker exec truffiere_db pg_dump -U unstuffed1004 truffiere > /backups/truffiere_$(date +\%Y\%m\%d).sql
```

## 🌟 Améliorations futures

### Court terme
- [ ] Formulaires de modification pour tous les composants
- [ ] Messages de confirmation pour les suppressions
- [ ] Filtres et recherche avancée
- [ ] Export PDF des rapports

### Moyen terme
- [ ] Authentification JWT multi-utilisateurs
- [ ] Gestion des photos (upload et galerie)
- [ ] Notifications par email
- [ ] Application mobile (React Native)

### Long terme
- [ ] API publique documentée (Swagger)
- [ ] Intégration IoT (capteurs d'humidité, météo)
- [ ] Machine Learning pour prédictions de production
- [ ] Marketplace pour vente directe

## 📄 Licence

Ce projet est sous licence MIT.

## 👨‍💻 Auteur et Support

Pour toute question ou problème :
1. Consultez les logs : `docker-compose logs -f`
2. Vérifiez la connexion à la base de données
3. Assurez-vous que tous les ports sont disponibles
4. Consultez la documentation dans `/docs` (si disponible)

---

**Version** : 1.0.0  
**Dernière mise à jour** : Décembre 2024  
**Statut** : Production Ready ✅
