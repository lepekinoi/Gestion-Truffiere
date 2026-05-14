# 📝 Changelog - Gestion Truffière

Tous les changements notables de ce projet sont documentés dans ce fichier.

Le format est basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/),
et ce projet adhère à [Semantic Versioning](https://semver.org/lang/fr/).

---

## [2.0.2] - 2026-05-14

### 🐛 Corrigé

#### `frontend/src/components/Commercial.js`

- **[HOISTING] `Cannot access 'sortedClients' before initialization`** — Le bloc de filtrage/tri/pagination (`filteredClients`, `filteredCommandes`, `filteredVentes`, `sortedClients`, `sortedCommandes`, `sortedVentes`, `paginatedClients`, `paginatedCommandes`, `paginatedVentes`) était déclaré **après** le bloc `STATISTIQUES`, provoquant une ReferenceError au rendu. Correction : déplacement du bloc `FILTRAGE` avant le bloc `STATISTIQUES` pour respecter l'ordre d'initialisation.

- **[JSX] `Adjacent JSX elements must be wrapped in an enclosing tag`** — Présence d'un fragment JSX orphelin résidu d'une ancienne définition inline de `PaginationControls` : un `>` solitaire suivi d'une implémentation dupliquée (~70 lignes) coexistait avec le composant `PaginationControlsComponent` importé. Correction : suppression complète du bloc orphelin, la pagination clients restant fonctionnelle via `PaginationControlsComponent`.

### 📚 Documentation

- Suppression des fichiers résiduels V7 à la racine : `README_V7-SAISON.md`, `QUICKSTART_V7-SAISON.md`, `STATUS_V7-SAISON.md`
- Suppression des notes de correction ponctuelles absorbées dans ce CHANGELOG : `CORRECTION_COMMERCIAL_L847.md`, `CORRECTION_HOISTING.md`
- Suppression de `SPECIFICATIONS_SAISON.md` — contenu absorbé dans `README.md` (section *Vue Saisonnière Truffière*)
- Ajout d'un `QUICKSTART.md` dédié V8
- Mise à jour `README.md` : section Vue Saisonnière complète, badge v2.0.2, Roadmap détaillée
- Correction `SETUP.md` : V6→V8, MySQL supprimé, PostgreSQL uniquement, JWT 15min, identifiants corrects, chemins mis à jour

---

## [2.0.1] - 2026-01-28

### 🎉 Refactoring backend complet

Refonte complète de l'architecture backend avec standardisation et amélioration de la qualité du code.

### ✨ Ajouté

#### Architecture
- **Pattern Factory** unifié sur tous les fichiers routes
- **Utils centralisés** dans `utils/index.js` (point d'entrée unique)
- **Middleware auth** séparé dans `middleware/auth.js`
- **Validation** centralisée dans `middleware/validation.js`
- **Documentation complète** des codes d'erreur (`backend/docs/API_ERROR_CODES.md`)

#### Audit Trail
- Traçabilité complète sur **toutes** les actions sensibles (Create, Update, Delete, Login, Logout, changements de mot de passe, actions admin, gestion de sessions)
- Métadonnées enrichies : `old_data`, `new_data`, `metadata`
- Traçage utilisateur complet : qui, quoi, quand

#### Codes d'Erreur
- **85+ codes d'erreur** standardisés et documentés
- Format uniforme : `{ error, code, details }`
- `details` affiché uniquement si `NODE_ENV=development`
- Catégorisation : Auth, Validation, Métier, Système

#### Sécurité
- Token rotation automatique avec détection de réutilisation
- Account locking après 5 tentatives échouées (15 min)
- Security events logging
- Rate limiting global (1000 req/15 min) et auth (10 req/15 min)
- IP tracking sur toutes les actions sensibles

### 🔧 Modifié

#### 21 fichiers routes refactorés

| Batch | Fichiers | Routes |
|---|---|---|
| Core Business | `parcelles`, `arbres`, `interventions`, `commandes` | 37 routes |
| Business | `clients`, `ventes`, `recoltes` | 14 routes |
| Config & Référentiels | `types-intervention`, `caveurs`, `chiens`, `preferences`, `stats`, `amendements-ref` | 19 routes |
| Moyens | `produits-phyto`, `historique`, `especes` | 11 routes |
| Finals | `dashboard`, `parametres`, `stock` | 10 routes |
| Auth | `auth.js` | 15 routes |

#### Server.js nettoyé
- Suppression de ~600 lignes de routes auth inline
- Suppression des fonctions dupliquées (`emptyToNull`, `generateAccessToken`, etc.)
- Import des utils centralisés
- **Résultat** : 48.8 KB → 25.3 KB (**−50%**)

#### Améliorations globales
- Principes DRY et SOLID appliqués sur 20 fichiers
- Gestion d'erreur homogène : try/catch + logging + status codes corrects (200, 201, 400, 401, 403, 404, 409, 500)
- Messages d'erreur uniformément en français
- Gestion des erreurs PostgreSQL spécifiques (`23505` = UNIQUE_VIOLATION)
- Validation des champs requis sur tous les POST/PUT

### 🗑️ Supprimé

- Dossier `controllers/` (3 fichiers TypeScript inutilisés, 25.4 KB de code mort)
- Fonctions utils dupliquées dans `server.js`
- 15 routes auth inline dans `server.js`

### 🔒 Sécurité

- bcrypt avec 12 salt rounds
- JWT 15 min + refresh tokens avec rotation
- Account locking après 5 tentatives
- IP tracking sur login/logout
- Security events logging
- Rate limiting (auth + global)
- CORS configurable via variables d'environnement
- Helmet pour les headers HTTP

### ⚠️ Breaking Changes

**Aucun** 🎉 — Rétrocompatibilité totale : mêmes endpoints, mêmes structures de requête et réponse, mêmes flows d'authentification.

Seuls ajouts côté réponses d'erreur :
- Champ `code` (ex: `ACCOUNT_LOCKED`)
- Champ `details` en mode `development`

```javascript
// Adaptation recommandée (non obligatoire)
if (error.response.data.code === 'ACCOUNT_LOCKED') {
  showAccountLocked(error.response.data.lockedUntil);
} else if (error.response.data.code === 'INVALID_CREDENTIALS') {
  showInvalidCredentials();
}
```

### 📊 Statistiques

- 22 commits propres et documentés
- 21 fichiers routes refactorés
- ~20 000 lignes de code modernisées
- 95+ endpoints API améliorés
- 0 breaking change

### 🛠️ Actions post-déploiement recommandées

```bash
# Vérifier les logs
tail -f logs/app.log

# Vérifier l'audit trail
psql -U truffiere -d gestion_truffiere -c \
  "SELECT * FROM audit_trail ORDER BY timestamp DESC LIMIT 50;"

# Tester les endpoints auth
curl http://localhost:5000/api/auth/login
curl http://localhost:5000/api/health
```

---

## [2.0.0] - 2026-01-15

### ✨ Ajouté

- Système d'authentification JWT complet
- Gestion des utilisateurs (CRUD)
- Gestion des rôles (admin, user, readonly)
- Refresh tokens avec expiration
- Dashboard avec statistiques temps réel
- Module de recherche globale
- Génération de rapports PDF

### 🔧 Modifié

- Refonte de la structure de la base de données
- Amélioration des performances des requêtes
- Optimisation du calcul du stock

---

## [1.x] - 2025

### Versions initiales

- Gestion des parcelles, arbres, récoltes, interventions
- Gestion des clients, ventes et commandes
- Interface cartographique Leaflet
- Export CSV de base

---

## 📌 Légende

| Emoji | Signification |
|---|---|
| ✨ | Nouvelles fonctionnalités |
| 🔧 | Changements de fonctionnalités existantes |
| 🗑️ | Fonctionnalités retirées |
| 🐛 | Corrections de bugs |
| 🔒 | Correctifs de sécurité |
| ⚠️ | Breaking changes |
| 📚 | Documentation |

---

## 🔗 Liens utiles

- [Codes d'erreur API](./backend/docs/API_ERROR_CODES.md)
- [Utils backend](./backend/utils/README.md)
- [Documentation API](./API.md)
- [Architecture](./ARCHITECTURE.md)

---

## 👥 Contributeurs

- **lepekinoi** — Développement, refactoring backend V8, corrections Commercial.js

---

*Dernière mise à jour : mai 2026 — V8*
