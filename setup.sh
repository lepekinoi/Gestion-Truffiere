#!/bin/bash

# Script d'installation automatique pour le projet Truffière
# Usage: bash setup.sh

set -e  # Arrêter en cas d'erreur

echo "?? ========================================="
echo "   Installation du système de gestion"
echo "   de truffière"
echo "========================================= ??"
echo ""

# Vérifier que Docker est installé
if ! command -v docker &> /dev/null; then
    echo "? Docker n'est pas installé. Veuillez l'installer d'abord."
    echo "   https://docs.docker.com/get-docker/"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "? Docker Compose n'est pas installé. Veuillez l'installer d'abord."
    echo "   https://docs.docker.com/compose/install/"
    exit 1
fi

echo "? Docker et Docker Compose sont installés"
echo ""

# Créer la structure de dossiers
echo "?? Création de la structure de dossiers..."
mkdir -p backend frontend/public frontend/src/components nginx

echo "? Structure créée avec succès"
echo ""

# Créer les fichiers manquants du frontend
echo "?? Création des fichiers de configuration frontend..."

# frontend/public/index.html
cat > frontend/public/index.html << 'EOF'
<!DOCTYPE html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Gestion de Truffière</title>
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  </head>
  <body>
    <noscript>Vous devez activer JavaScript pour utiliser cette application.</noscript>
    <div id="root"></div>
  </body>
</html>
EOF

# frontend/src/index.js
cat > frontend/src/index.js << 'EOF'
import React from 'react';
import ReactDOM from 'react-dom/client';
import './App.css';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
EOF

# backend/.env
cat > backend/.env << 'EOF'
NODE_ENV=development
PORT=3001
DB_HOST=postgres
DB_PORT=5432
DB_NAME=truffiere
DB_USER=truffiere_user
DB_PASSWORD=truffiere_pass_2024
EOF

# .gitignore à la racine
cat > .gitignore << 'EOF'
# Dependencies
node_modules/
backend/node_modules/
frontend/node_modules/

# Environment
.env
*.env.local

# Logs
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Docker
*.log

# OS
.DS_Store
Thumbs.db

# IDE
.vscode/
.idea/
*.swp
*.swo
EOF

echo "? Fichiers de configuration créés"
echo ""

# Vérifier que les fichiers principaux existent
echo "?? Vérification des fichiers requis..."

REQUIRED_FILES=(
    "docker-compose.yml"
    "init-db.sql"
    "backend/Dockerfile"
    "backend/package.json"
    "backend/server.js"
    "frontend/Dockerfile"
    "frontend/package.json"
    "frontend/src/App.js"
    "frontend/src/App.css"
    "frontend/src/components/Dashboard.js"
    "frontend/src/components/Parcelles.js"
)

MISSING_FILES=()

for file in "${REQUIRED_FILES[@]}"; do
    if [ ! -f "$file" ]; then
        MISSING_FILES+=("$file")
    fi
done

if [ ${#MISSING_FILES[@]} -ne 0 ]; then
    echo "? Fichiers manquants :"
    for file in "${MISSING_FILES[@]}"; do
        echo "   - $file"
    done
    echo ""
    echo "??  Veuillez copier tous les fichiers fournis dans la structure appropriée"
    echo "   Consultez le fichier INSTRUCTIONS_DEPLOYMENT.md pour plus de détails"
    exit 1
fi

echo "? Tous les fichiers requis sont présents"
echo ""

# Message de vérification des composants
echo "??  IMPORTANT : Vérification des composants React"
COMPONENTS=(
    "frontend/src/components/Arbres.js"
    "frontend/src/components/Interventions.js"
    "frontend/src/components/Recoltes.js"
    "frontend/src/components/Clients.js"
    "frontend/src/components/Ventes.js"
    "frontend/src/components/Statistiques.js"
)

MISSING_COMPONENTS=()
for component in "${COMPONENTS[@]}"; do
    if [ ! -f "$component" ]; then
        MISSING_COMPONENTS+=("$component")
    fi
done

if [ ${#MISSING_COMPONENTS[@]} -ne 0 ]; then
    echo "??  Composants manquants détectés :"
    for component in "${MISSING_COMPONENTS[@]}"; do
        echo "   - $component"
    done
    echo ""
    echo "?? N'oubliez pas de séparer le fichier 'Composants React restants'"
    echo "   en fichiers individuels comme indiqué dans INSTRUCTIONS_DEPLOYMENT.md"
    echo ""
    read -p "Continuer quand même ? (o/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Oo]$ ]]; then
        echo "Installation annulée."
        exit 1
    fi
fi

echo ""
echo "?? Démarrage de l'application avec Docker..."
echo "   Cela peut prendre 5-10 minutes la première fois..."
echo ""

# Construire et démarrer les conteneurs
docker-compose up --build -d

echo ""
echo "? Attente que les services soient prêts..."
sleep 10

# Vérifier que les conteneurs sont démarrés
if docker-compose ps | grep -q "Up"; then
    echo ""
    echo "? ========================================="
    echo "   Installation terminée avec succès !"
    echo "========================================= ?"
    echo ""
    echo "?? Accès à l'application :"
    echo "   Frontend : http://localhost:3000"
    echo "   Backend  : http://localhost:3001/api"
    echo ""
    echo "?? Test de l'API :"
    echo "   curl http://localhost:3001/api/health"
    echo ""
    echo "?? Commandes utiles :"
    echo "   Voir les logs        : docker-compose logs -f"
    echo "   Arrêter              : docker-compose down"
    echo "   Redémarrer           : docker-compose restart"
    echo "   Accéder à PostgreSQL : docker exec -it truffiere_db psql -U truffiere_user -d truffiere"
    echo ""
    echo "?? Documentation : Consultez README.md"
    echo ""
else
    echo ""
    echo "? Problème détecté lors du démarrage"
    echo "   Consultez les logs : docker-compose logs"
    echo ""
    exit 1
fi