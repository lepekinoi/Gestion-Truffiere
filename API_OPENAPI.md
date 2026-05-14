# API Gestion-Truffiere V8 — Documentation OpenAPI 3.1

> Spécification OpenAPI 3.1.0 complète de l'API REST Gestion-Truffiere V8.  
> Base URL production : `https://m-a-truffes.sytes.net/api`  
> Authentification : Bearer JWT (access token 15 min) + refresh token à rotation.

---

## Sommaire des ressources

| Tag | Préfixe | Fichier route | Endpoints |
|---|---|---|---|
| Auth | `/api/auth` | `auth.js` | 15 |
| Parcelles | `/api/parcelles` | `parcelles.routes.js` | 5 |
| Arbres | `/api/arbres` | `arbres.routes.js` | 8 |
| Récoltes | `/api/recoltes` | `recoltes.routes.js` | 4 |
| Interventions | `/api/interventions` | `interventions.routes.js` | 12 |
| Ventes | `/api/ventes` | `ventes.routes.js` | 4 |
| Commandes | `/api/commandes` | `commandes.routes.js` | 6 |
| Clients | `/api/clients` | `clients.routes.js` | 6 |
| Achats & Fournisseurs | `/api/achats` | `achats-fournisseurs.routes.js` | 25 |
| Fournisseurs (legacy) | `/api/fournisseurs` | `fournisseurs.js` | 8 |
| Stock | `/api/stock` | `stock.routes.js` | 2 |
| Dashboard | `/api/dashboard` | `dashboard.routes.js` | 1 |
| Statistiques | `/api/stats` | `stats.routes.js` | 3 |
| Historique | `/api/historique` | `historique.routes.js` | 3 |
| Paramètres | `/api/parametres` | `parametres.routes.js` | 7 |
| Préférences | `/api/preferences` | `preferences.routes.js` | 3 |
| Espèces | `/api/especes` | `especes.routes.js` | 4 |
| Caveurs | `/api/caveurs` | `caveurs.routes.js` | 4 |
| Chiens | `/api/chiens` | `chiens.routes.js` | 4 |
| Amendements | `/api/amendements-ref` | `amendements-ref.routes.js` | 4 |
| Produits phyto | `/api/produits-phyto` | `produits-phyto.routes.js` | 4 |
| Types intervention | `/api/types-intervention` | `types-intervention.routes.js` | 1 |
| Zones production | `/api/zones-production` | `zones-production.routes.js` | 2 |

---

## Spécification OpenAPI 3.1.0

La spec YAML complète est disponible dans [`docs/openapi.yaml`](docs/openapi.yaml).

Pour la consulter via Swagger UI en développement :

```bash
cd backend
npm install swagger-ui-express js-yaml
npm run docs
```

Puis ouvrir : `http://localhost:3001/api/docs`

---

## Intégration Swagger UI

```bash
npm install swagger-ui-express js-yaml
```

`backend/swagger.js` est déjà configuré. Il suffit de monter la route dans `server.js` :

```js
// Dans backend/server.js — après les middlewares de sécurité
if (process.env.NODE_ENV !== 'production') {
  const { swaggerUi, swaggerDocument } = require('./swagger');
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
}
```

L'interface sera accessible sur `http://localhost:3001/api/docs`.

---

## Codes d'erreur standardisés (extrait)

| Code | HTTP | Description |
|---|---|---|
| `AUTH_TOKEN_INVALID` | 401 | Token absent, expiré ou malformé |
| `AUTH_TOKEN_EXPIRED` | 401 | Access token expiré (utiliser /auth/refresh) |
| `AUTH_REFRESH_INVALID` | 401 | Refresh token invalide ou révoqué |
| `AUTH_ACCOUNT_LOCKED` | 423 | Compte verrouillé après 5 échecs |
| `AUTH_ADMIN_REQUIRED` | 403 | Rôle admin requis |
| `AUTH_WRITE_REQUIRED` | 403 | Rôle user/admin requis (readonly insuffisant) |
| `AUTH_INVALID_CREDENTIALS` | 401 | Email ou mot de passe incorrect |
| `VALIDATION_ERROR` | 400 | Données entrantes invalides |
| `RESOURCE_NOT_FOUND` | 404 | Ressource introuvable |
| `RESOURCE_CONFLICT` | 409 | Conflit (doublon détecté) |
| `RATE_LIMIT_EXCEEDED` | 429 | Trop de requêtes |
| `DB_ERROR` | 500 | Erreur base de données |
| `SERVER_ERROR` | 500 | Erreur serveur interne |

---

## Notes d'implémentation

- **Toutes les routes** (sauf `/auth/login` et `/auth/refresh`) requièrent `Authorization: Bearer <accessToken>`
- Les routes en **écriture** (`POST`, `PUT`, `DELETE`) requièrent le middleware `requireWriteAccess` — le rôle `readonly` est bloqué
- Le module **Achats & Fournisseurs** (`achats-fournisseurs.routes.js`) est le plus riche avec 25 endpoints ; il coexiste avec `fournisseurs.js` (legacy)
- L'**audit trail** est automatique côté PostgreSQL (triggers PLpgSQL) — les routes `/historique` exposent uniquement la lecture
- Les **soft deletes** sont implémentés uniquement sur les Arbres (corbeille explicite)
- La spec complète est dans [`docs/openapi.yaml`](docs/openapi.yaml)
