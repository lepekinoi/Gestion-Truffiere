# Gestion-Truffiere V8 — Quickstart

Guide de démarrage rapide pour la branche **V8** de la plateforme de gestion d'exploitations truffières.

**Production** : [https://m-a-truffes.sytes.net/](https://m-a-truffes.sytes.net/)

---

## Stack technique

| Composant | Technologie |
|---|---|
| Frontend | React 18 + Leaflet |
| Backend | Express.js modulaire (20 fichiers routes) |
| Base de données | PostgreSQL + PL/pgSQL |
| Authentification | JWT 15min + refresh tokens avec rotation |
| Infrastructure | Docker / Docker Compose |

---

## Modules applicatifs

- Dashboard
- Parcelles
- Arbres
- Récoltes
- Interventions
- Commercial
- Cartographie
- Statistiques
- Historique (audit trail)
- Paramètres
- Import CSV / Export PDF

---

## Prérequis

**Obligatoires :**
- Git
- Docker
- Docker Compose

**Optionnels (hors conteneurs) :**
- Node.js LTS
- npm
- PostgreSQL 14+

---

## Démarrage en 4 étapes

### 1. Cloner le dépôt

```bash
git clone https://github.com/lepekinoi/Gestion-Truffiere.git
cd Gestion-Truffiere
git checkout V8
```

### 2. Configurer l'environnement

```bash
cp .env.exemple .env
```

Renseigner dans `.env` :
- Paramètres PostgreSQL (`POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`)
- Secrets JWT (`JWT_SECRET`, `JWT_REFRESH_SECRET`)
- URLs frontend/backend
- Configuration CORS

### 3. Lancer la stack

```bash
docker compose up -d --build
```

### 4. Vérifier les services

```bash
docker compose ps
docker compose logs -f
```

---

## Commandes utiles

```bash
# Redémarrer
docker compose restart

# Arrêter
docker compose down

# Rebuild complet
docker compose down && docker compose up -d --build

# Logs backend
docker compose logs -f backend

# Logs frontend
docker compose logs -f frontend
```

---

## Base de données

Avant le premier usage en environnement neuf :

1. Vérifier la création de la base
2. Exécuter les scripts SQL du dossier `database/`
3. Vérifier la cohérence des variables d'environnement PostgreSQL

Sauvegarde manuelle :

```bash
bash backup-db.sh
```

---

## Sécurité intégrée

Le projet embarque nativement :

- **bcrypt** (12 salt rounds)
- **Verrouillage de compte** après 5 tentatives échouées (15 min)
- **Rate limiting** : global (1000 req/15min) + auth (10 req/15min)
- **IP tracking** sur les actions sensibles
- **Helmet** (headers HTTP sécurisés)
- **CORS** configurable
- **JWT** courts (15 min) + refresh tokens avec rotation
- **85+ codes d'erreur** standardisés

> ⚠️ Ne jamais désactiver ces mécanismes, y compris en environnement local.

---

## Dépannage rapide

| Symptôme | Vérification |
|---|---|
| Stack ne démarre pas | `.env` complet ? PostgreSQL accessible ? `docker compose logs -f` |
| Erreur CORS | URLs frontend/backend dans `.env` ? |
| Erreur d'authentification | Secrets JWT définis ? Token expiré ? |
| Frontend vide | Rebuild sans cache : `docker compose build --no-cache frontend` |
| Backend 500 | Connexion BDD ? `docker compose logs -f backend` |

---

## Documentation associée

| Fichier | Contenu |
|---|---|
| `README.md` | Vue d'ensemble du projet |
| `SETUP.md` | Installation détaillée |
| `DOCKER.md` | Configuration Docker avancée |
| `ARCHITECTURE.md` | Architecture technique complète |
| `API.md` | Référence des endpoints |
| `CHANGELOG.md` | Historique des versions |

---

## Roadmap V8

Orientations en cours :
- Tests Jest / React Testing Library
- PWA offline
- Swagger / OpenAPI
- Alertes intelligentes
- PDF avancés
