# 🚀 Quickstart — Gestion-Truffière V8

Guide de démarrage rapide. Pour la documentation complète, voir [`README.md`](./README.md), [`SETUP.md`](./SETUP.md) et [`DOCKER.md`](./DOCKER.md).

**Production** : [https://m-a-truffes.sytes.net/](https://m-a-truffes.sytes.net/)

---

## Prérequis

- [Docker](https://docs.docker.com/get-docker/) + Docker Compose
- Git

> En développement hors Docker : Node.js LTS, npm, PostgreSQL 14+

---

## Démarrage en 4 étapes

### 1. Cloner et basculer sur V8

```bash
git clone https://github.com/lepekinoi/Gestion-Truffiere.git
cd Gestion-Truffiere
git checkout V8
```

### 2. Configurer l'environnement

```bash
cp .env.exemple .env
```

Éditer `.env` et renseigner au minimum :

| Variable | Description |
|---|---|
| `DB_*` | Paramètres PostgreSQL (host, port, user, password, name) |
| `JWT_SECRET` | Secret de signature JWT |
| `JWT_REFRESH_SECRET` | Secret refresh token |
| `FRONTEND_URL` | URL d'accès au frontend (CORS) |
| `NODE_ENV` | `development` ou `production` |

> ⚠️ Ne jamais committer `.env` — il est dans `.gitignore`.

### 3. Démarrer la stack

```bash
docker compose up -d --build
```

### 4. Vérifier

```bash
docker compose ps
docker compose logs -f
```

---

## Architecture de la stack

| Conteneur | Rôle | Technologie |
|---|---|---|
| `frontend` | Interface utilisateur | React 18, Leaflet |
| `backend` | API REST | Express.js modulaire |
| `db` | Base de données | PostgreSQL + PLpgSQL |

---

## Commandes courantes

```bash
# Arrêter
docker compose down

# Rebuild complet (après modification du code)
docker compose down && docker compose up -d --build

# Logs en temps réel
docker compose logs -f backend
docker compose logs -f frontend

# Rebuild sans cache
docker compose build --no-cache

# Accéder à la BDD
docker compose exec db psql -U <DB_USER> -d <DB_NAME>
```

---

## Modules disponibles

| Module | Description |
|---|---|
| Dashboard | Synthèse et indicateurs clés |
| Parcelles | Gestion des parcelles truffières |
| Arbres | Suivi individuel des arbres |
| Récoltes | Saisie et historique des récoltes |
| Interventions | Traitements, arrosages, travaux |
| Commercial | Clients, commandes, ventes |
| Cartographie | Visualisation Leaflet des parcelles |
| Statistiques | Analyses et graphiques |
| Historique | Audit trail complet |
| Paramètres | Configuration de l'exploitation |
| Import / Export | Import CSV, export PDF |

---

## Sécurité intégrée

La stack embarque nativement :

- **bcrypt** (12 rounds) pour les mots de passe
- **JWT** 15 min + refresh tokens avec rotation
- **Account locking** : verrouillage après 5 tentatives / 15 min
- **Rate limiting** : global (1000 req/15min) + auth (10 req/15min)
- **IP tracking**, **Helmet**, **CORS** configurables
- **85+ codes d'erreur** standardisés

> Ne jamais désactiver ces mécanismes pour simplifier un setup local.

---

## Dépannage rapide

| Symptôme | Vérification |
|---|---|
| Stack ne démarre pas | `docker compose logs -f` → vérifier `.env` |
| Erreur de connexion BDD | Variables `DB_*` dans `.env`, PostgreSQL accessible |
| Erreur CORS / 401 | `FRONTEND_URL` et secrets JWT dans `.env` |
| Build frontend échoue | `docker compose build --no-cache frontend` |
| Refresh token invalide | Vider les cookies / localStorage et se reconnecter |

---

## Documentation associée

| Fichier | Contenu |
|---|---|
| [`README.md`](./README.md) | Vue d'ensemble du projet |
| [`SETUP.md`](./SETUP.md) | Installation détaillée |
| [`DOCKER.md`](./DOCKER.md) | Configuration Docker avancée |
| [`ARCHITECTURE.md`](./ARCHITECTURE.md) | Architecture technique complète |
| [`API.md`](./API.md) | Documentation des endpoints API |
| [`CHANGELOG.md`](./CHANGELOG.md) | Historique des versions |

---

*Dernière mise à jour : mai 2026 — branche V8*
