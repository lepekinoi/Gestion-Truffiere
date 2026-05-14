# Changelog — Gestion-Truffière

Toutes les modifications notables sont documentées dans ce fichier.  
Format basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/).

---

## [2.0.2] — 2026-05-14

### Documentation
- Réécriture complète de `API.md` : endpoints réels V8, JWT 15 min, modules Commercial/Stock/Historique/Dashboard/Stats, codes d'erreur standardisés, exemples cURL
- Correction de `SETUP.md` : suppression des références MySQL/SQLite (projet 100% PostgreSQL), correction `JWT_EXPIRATION` → 15m, branche V8, script `database/init_database.sql`, identifiants de développement corrects
- Nettoyage de la racine du dépôt : suppression des fichiers V7 (`README_V7-SAISON.md`, `QUICKSTART_V7-SAISON.md`, `STATUS_V7-SAISON.md`) et des notes ponctuelles (`CORRECTION_COMMERCIAL_L847.md`, `CORRECTION_HOISTING.md`)
- Création d'un `QUICKSTART.md` dédié V8 basé sur Docker (4 étapes, < 5 min)
- Unification du `CHANGELOG.md` : absorption des corrections ponctuelles dans l'historique officiel

### Corrections techniques intégrées
- **Commercial (L847)** : correction d'une erreur de référence sur le module commercial (précédemment documentée dans `CORRECTION_COMMERCIAL_L847.md`)
- **Hoisting** : correction d'un problème de hoisting JavaScript dans le backend (précédemment documenté dans `CORRECTION_HOISTING.md`)

---

## [2.0.1] — 2026-04-30

### Ajouté
- Module Historique (audit trail) : 10+ tables tracées, purge admin, filtres avancés
- Module Stock : calcul dynamique récoltes − ventes par qualité
- Endpoint `GET /dashboard/full` : 14 requêtes parallèles via `Promise.all`
- Module Commandes : cycle de vie complet (En attente → Livrée)
- Préférences utilisateur : colonnes, filtres, ordre sauvegardés

### Corrigé
- Récupération automatique du token JWT (interceptor Axios)
- Validation des doublons d'intervention (`check-doublon`)

---

## [2.0.0] — 2026-01-24

### Ajouté
- **Architecture V8** : refonte complète avec Express.js modulaire (20 fichiers de routes)
- **Auth JWT double-token** : access 15 min + refresh 7 jours avec rotation automatique
- **Sécurité renforcée** : bcrypt 12 rounds, verrouillage compte (5 tentatives/15 min), rate limiting, IP tracking, Helmet, CORS
- **85+ codes d'erreur standardisés**
- **Module Commercial** : clients, ventes, commandes
- **Cartographie** : intégration Leaflet, géolocalisation parcelles et arbres
- **Import CSV** / **Export PDF**
- **Docker** : `docker-compose.yml` multi-services (db, backend, frontend)
- **React 18** : 18 composants, routing complet

### Modules stables
Dashboard, Parcelles, Arbres, Récoltes, Interventions, Commercial, Cartographie, Statistiques, Historique, Paramètres

---

## [1.x] — 2025

### V7 (2025)
- Saison truffière 2024-2025 : fonctionnalités de base, saisie des récoltes et interventions
- Première version du module Commercial
- Auth JWT simple (sans refresh token)
- Stack Node.js + PostgreSQL + React

### V1 → V6 (2023–2024)
- Prototypes successifs : gestion parcelles, arbres, récoltes
- Migration progressive vers PostgreSQL
- Construction de l'architecture de base Express.js

---

*Pour les détails techniques des endpoints : [API.md](API.md)*  
*Pour l'architecture interne : [ARCHITECTURE.md](ARCHITECTURE.md)*
