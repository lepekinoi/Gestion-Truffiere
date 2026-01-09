# 🚀 Instructions de déploiement - Gestion de Truffière

## 📁 Structure complète du projet

```
truffiere/
├── README.md
├── docker-compose.yml
├── init-db.sql
├── backend/
│   ├── Dockerfile
│   ├── package.json
│   ├── server.js
│   └── .env (à créer)
├── frontend/
│   ├── Dockerfile
│   ├── package.json
│   ├── public/
│   │   └── index.html
│   └── src/
│       ├── index.js
│       ├── App.js
│       ├── App.css
│       └── components/
│           ├── Dashboard.js
│           ├── Parcelles.js
│           ├── Arbres.js
│           ├── Interventions.js
│           ├── Recoltes.js
│           ├── Clients.js
│           ├── Ventes.js
│           └── Statistiques.js
└── nginx/
    └── nginx.conf (optionnel)
```

## 🔧 Étape 1 : Créer la structure

```bash
# Créer le dossier principal
mkdir truffiere && cd truffiere

# Créer les sous-dossiers
mkdir -p backend frontend/public frontend/src/components nginx
```

## 📝 Étape 2 : Copier les fichiers

### 1. Fichiers racine
- Copiez `README.md` à la racine
- Copiez `docker-compose.yml` à la racine
- Copiez `init-db.sql` à la racine

### 2. Backend
Dans le dossier `backend/` :
- `Dockerfile`
- `package.json`
- `server.js`

Créez également `backend/.env` (optionnel) :
```env
NODE_ENV=development
PORT=3001
DB_HOST=postgres
DB_PORT=5432
DB_NAME=truffiere
DB_USER=truffiere_user
DB_PASSWORD=truffiere_pass_2024
```

### 3. Frontend

Dans `frontend/` :
- `Dockerfile`
- `package.json`

Dans `frontend/public/` :
- `index.html`

Dans `frontend/src/` :
- `index.js`
- `App.js`
- `App.css`

Dans `frontend/src/components/` :
**IMPORTANT** : Le fichier que je vous ai fourni "Composants React restants" contient TOUS les composants. Vous devez le séparer en fichiers individuels :

Créez ces 7 fichiers séparés en copiant chaque section :
1. `Arbres.js` → copier la section "Arbres"
2. `Interventions.js` → copier la section "Interventions"
3. `Recoltes.js` → copier la section "Recoltes"
4. `Clients.js` → copier la section "Clients"
5. `Ventes.js` → copier la section "Ventes"
6. `Statistiques.js` → copier la section "Statistiques"

**N'oubliez pas** : Ajoutez ces imports en haut de chaque fichier de composant :
```javascript
import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';
```

Et à la fin, exportez avec :
```javascript
export default NomDuComposant;
```

Le composant `Dashboard.js` est déjà fourni séparément.

## ▶️ Étape 3 : Lancer l'application

```bash
# Dans le dossier racine truffiere/
docker-compose up --build

# Ou en arrière-plan
docker-compose up -d --build
```

**Première fois** : Cela va :
1. Télécharger les images Docker nécessaires (Node.js, PostgreSQL)
2. Construire les conteneurs backend et frontend
3. Initialiser la base de données avec le schéma
4. Installer toutes les dépendances npm
5. Démarrer tous les services

⏱️ **Temps estimé** : 5-10 minutes la première fois

## ✅ Étape 4 : Vérifier que tout fonctionne

### Vérifier les services
```bash
# Voir tous les conteneurs actifs
docker-compose ps

# Devrait afficher :
# truffiere_db       (postgres)
# truffiere_backend  (node)
# truffiere_frontend (node)
```

### Tester l'API
```bash
curl http://localhost:3001/api/health
# Devrait retourner : {"status":"OK","message":"API Truffière fonctionnelle"}

curl http://localhost:3001/api/parcelles
# Devrait retourner un JSON avec les 3 parcelles de démo
```

### Accéder à l'interface web
Ouvrez votre navigateur et allez sur :
- **Frontend** : http://localhost:3000
- **API** : http://localhost:3001/api

Vous devriez voir le tableau de bord avec les données de démonstration.

## 📊 Données de démonstration

La base de données contient :
- ✅ 3 parcelles (Nord, Sud, Est)
- ✅ 4 arbres truffiers
- ✅ 7 types d'interventions prédéfinis

## 🛠️ Commandes utiles

```bash
# Voir les logs en temps réel
docker-compose logs -f

# Voir les logs du backend uniquement
docker-compose logs -f backend

# Arrêter tous les services
docker-compose down

# Redémarrer un service
docker-compose restart backend

# Supprimer tout et recommencer (⚠️ efface les données !)
docker-compose down -v
docker-compose up --build

# Accéder à PostgreSQL
docker exec -it truffiere_db psql -U truffiere_user -d truffiere

# Une fois dans psql :
\dt              # Lister les tables
\d+ parcelles    # Voir la structure de la table parcelles
SELECT * FROM parcelles;  # Voir les données
\q               # Quitter
```

## 🐛 Dépannage

### Problème 1 : Port déjà utilisé
**Erreur** : `port is already allocated`

**Solution** : Modifiez les ports dans `docker-compose.yml` :
```yaml
ports:
  - "3002:3001"  # Au lieu de 3001:3001 pour le backend
  - "3001:3000"  # Au lieu de 3000:3000 pour le frontend
```

### Problème 2 : Erreur de connexion à la base de données
**Solution** :
```bash
# Vérifier que PostgreSQL est démarré
docker-compose logs postgres

# Recréer complètement la base
docker-compose down -v
docker-compose up --build
```

### Problème 3 : Module not found
**Solution** :
```bash
# Supprimer les node_modules et reconstruire
docker-compose down
rm -rf backend/node_modules frontend/node_modules
docker-compose up --build
```

### Problème 4 : La page ne charge pas
1. Vérifiez que tous les services sont démarrés : `docker-compose ps`
2. Vérifiez les logs : `docker-compose logs -f`
3. Essayez d'accéder directement à l'API : http://localhost:3001/api/health
4. Videz le cache du navigateur (Ctrl+F5)

### Problème 5 : Les composants ne s'affichent pas
Vérifiez que vous avez bien :
1. Séparé le fichier "Composants React restants" en 6 fichiers individuels
2. Ajouté les imports nécessaires en haut de chaque fichier
3. Ajouté l'export par défaut à la fin de chaque fichier

## 📈 Prochaines étapes

Une fois que tout fonctionne, vous pouvez :

1. **Ajouter vos vraies données** :
   - Supprimer les données de démo
   - Créer vos propres parcelles et arbres

2. **Compléter les formulaires** :
   - Implémenter les modals de création pour chaque section
   - Ajouter la validation des données

3. **Ajouter la cartographie** :
   - Intégrer Leaflet pour visualiser les parcelles
   - Afficher les arbres sur la carte

4. **Améliorer les statistiques** :
   - Ajouter des graphiques avec Recharts
   - Créer des exports PDF

5. **Sécuriser l'application** :
   - Ajouter l'authentification
   - Changer les mots de passe par défaut
   - Configurer HTTPS pour la production

## 📧 Besoin d'aide ?

Si vous rencontrez un problème :
1. Consultez les logs : `docker-compose logs -f`
2. Vérifiez que Docker est bien installé et démarré
3. Assurez-vous d'avoir les droits d'accès aux ports 3000, 3001 et 5432

## 🎉 C'est parti !

Votre application de gestion de truffière est maintenant prête à l'emploi. Bonne gestion de votre production ! 🍄
