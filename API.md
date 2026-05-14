# 📡 API Documentation — Gestion-Truffière v8

> Documentation complète de l'API REST — 95+ endpoints, authentification JWT, codes d'erreur standardisés

**Base URL**

```
Production  : https://m-a-truffes.sytes.net/api
Développement : http://localhost:5000/api
```

→ Référence des 85+ codes d'erreur : [backend/docs/API_ERROR_CODES.md](backend/docs/API_ERROR_CODES.md)  
→ Architecture modulaire : [ARCHITECTURE.md](ARCHITECTURE.md)

---

## 📋 Table des matières

1. [Protocole & Format](#protocole--format)
2. [Authentification JWT](#authentification-jwt)
3. [Gestion des erreurs](#gestion-des-erreurs)
4. [Index des endpoints](#index-des-endpoints)
5. [Auth](#auth)
6. [Parcelles](#parcelles)
7. [Arbres](#arbres)
8. [Récoltes](#récoltes)
9. [Interventions](#interventions)
10. [Commercial — Clients, Ventes, Commandes](#commercial--clients-ventes-commandes)
11. [Stock](#stock)
12. [Dashboard & Statistiques](#dashboard--statistiques)
13. [Historique (Audit Trail)](#historique-audit-trail)
14. [Paramètres & Préférences](#paramètres--préférences)
15. [Référentiels](#référentiels)
16. [Import / Export](#import--export)
17. [Rate Limiting](#rate-limiting)

---

## Protocole & Format

| Propriété | Valeur |
|---|---|
| Protocole | HTTPS (production), HTTP (dev) |
| Format | JSON |
| Charset | UTF-8 |
| Timeout | 30 secondes |
| Version API | `X-API-Version: 8.0` |
| Build | `X-API-Build: 2.0.2` |

### Format de réponse (succès)

```json
{
  "id": 1,
  "nom": "Parcelle Nord",
  "surface_ha": 2.5
}
```

Les endpoints retournent directement l'objet ou le tableau, sans enveloppe `{ status, data }`.

### Format de réponse (erreur)

```json
{
  "error": "Description de l'erreur",
  "code": "CODE_ERREUR_STANDARDISE",
  "details": "Stack ou détail technique (mode development uniquement)"
}
```

---

## Authentification JWT

Le projet utilise un système JWT à deux tokens avec rotation automatique.

| Token | Durée | Renouvellement |
|---|---|---|
| `accessToken` | **15 minutes** | Via `POST /auth/refresh` |
| `refreshToken` | 7 jours | Rotation à chaque usage |

> ⚠️ La durée de 15 minutes est intentionnelle — politique de sécurité V8. Ne pas modifier `JWT_EXPIRATION`.

### Inclure le token dans les requêtes

```http
Authorization: Bearer <accessToken>
```

### Payload du token

```json
{
  "userId": 1,
  "email": "admin@truffiere.local",
  "role": "admin",
  "iat": 1747220000,
  "exp": 1747220900
}
```

### Rôles disponibles

| Rôle | Droits |
|---|---|
| `admin` | Lecture + écriture + gestion utilisateurs + purge audit |
| `user` | Lecture + écriture |
| `readonly` | Lecture seule |

### Renouvellement automatique (Axios interceptor)

```javascript
axiosInstance.interceptors.response.use(
  response => response,
  async error => {
    if (error.response?.status === 401 && !error.config._retry) {
      error.config._retry = true;
      const { data } = await axios.post('/api/auth/refresh', { refreshToken });
      localStorage.setItem('accessToken', data.accessToken);
      error.config.headers['Authorization'] = `Bearer ${data.accessToken}`;
      return axiosInstance.request(error.config);
    }
    return Promise.reject(error);
  }
);
```

---

## Gestion des erreurs

### Codes HTTP utilisés

| Code | Signification |
|---|---|
| 200 | Succès |
| 201 | Ressource créée |
| 400 | Données invalides / champ manquant |
| 401 | Token absent, expiré ou invalide |
| 403 | Permission insuffisante (rôle) |
| 404 | Ressource introuvable |
| 409 | Conflit (doublon, contrainte unique) |
| 429 | Rate limit dépassé |
| 500 | Erreur serveur interne |

### Codes d'erreur standardisés (sélection)

```
AUTH
  INVALID_CREDENTIALS         Email ou mot de passe incorrect
  ACCOUNT_LOCKED              5 tentatives échouées — verrouillé 15 min
  TOKEN_EXPIRED               Access token expiré
  TOKEN_INVALID               Token malformé ou signature invalide
  REFRESH_TOKEN_REUSED        Détection de réutilisation du refresh token
  UNAUTHORIZED                Token absent

VALIDATION
  REQUIRED_FIELD              Champ obligatoire manquant
  INVALID_FORMAT              Format invalide (date, email…)
  DUPLICATE_ENTRY             Violation contrainte UNIQUE (code PostgreSQL 23505)

MÉTIER
  INTERVENTION_NOT_FOUND      Intervention introuvable
  PARCELLE_NOT_FOUND          Parcelle introuvable
  ARBRE_NOT_FOUND             Arbre introuvable
  CLIENT_NOT_FOUND            Client introuvable
  COMMANDE_NOT_FOUND          Commande introuvable
  STOCK_INSUFFISANT           Stock insuffisant pour la vente
  ADMIN_REQUIRED              Action réservée au rôle admin
```

Référence complète : [`backend/docs/API_ERROR_CODES.md`](backend/docs/API_ERROR_CODES.md)

---

## Index des endpoints

```
Auth
  POST   /auth/login
  POST   /auth/refresh
  POST   /auth/logout
  POST   /auth/change-password
  GET    /auth/me
  GET    /auth/users             (admin)
  POST   /auth/users             (admin)
  PUT    /auth/users/:id         (admin)
  DELETE /auth/users/:id         (admin)

Parcelles
  GET    /parcelles
  GET    /parcelles/:id
  GET    /parcelles/:id/arbres
  GET    /parcelles/corbeille
  POST   /parcelles
  PUT    /parcelles/:id
  DELETE /parcelles/:id
  PUT    /parcelles/:id/restore

Arbres
  GET    /arbres
  GET    /arbres/:id
  GET    /arbres/corbeille
  POST   /arbres
  PUT    /arbres/:id
  DELETE /arbres/:id
  PUT    /arbres/:id/restore

Récoltes
  GET    /recoltes
  GET    /recoltes/:id
  POST   /recoltes
  PUT    /recoltes/:id
  DELETE /recoltes/:id

Interventions
  GET    /interventions
  GET    /interventions/stats
  GET    /interventions/stats/eau
  GET    /interventions/stats/traitements
  GET    /interventions/export
  GET    /interventions/check-doublon
  POST   /interventions
  PUT    /interventions/:id
  DELETE /interventions/:id
  GET    /interventions/:id/details
  POST   /interventions/:id/details
  DELETE /interventions/:id/details

Commercial
  GET    /clients
  GET    /clients/:id
  GET    /clients/stats
  POST   /clients
  PUT    /clients/:id
  DELETE /clients/:id
  GET    /ventes
  GET    /ventes/:id
  POST   /ventes
  PUT    /ventes/:id
  DELETE /ventes/:id
  GET    /commandes
  GET    /commandes/:id
  POST   /commandes
  PUT    /commandes/:id
  DELETE /commandes/:id
  PUT    /commandes/:id/statut

Stock
  GET    /stock
  GET    /stock/global

Dashboard & Stats
  GET    /dashboard/full
  GET    /stats/dashboard        (legacy)
  GET    /stats/recoltes-annuelles
  GET    /stats/recoltes-mensuelles

Historique
  GET    /historique
  GET    /historique/stats
  DELETE /historique/purge       (admin)

Paramètres & Préférences
  GET    /parametres
  GET    /parametres/:cle
  PUT    /parametres/:cle
  GET    /preferences
  PUT    /preferences

Référentiels
  GET/POST/PUT/DELETE  /types-intervention
  GET/POST/PUT/DELETE  /caveurs
  GET/POST/PUT/DELETE  /chiens
  GET/POST/PUT/DELETE  /especes
  GET/POST/PUT/DELETE  /produits-phyto
  GET/POST/PUT/DELETE  /amendements-ref

System
  GET    /health
```

---

## Auth

### POST /auth/login

```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "admin@truffiere.local",
  "password": "admin123"
}
```

**Réponse 200**

```json
{
  "user": {
    "id": 1,
    "email": "admin@truffiere.local",
    "nom": "Admin",
    "prenom": "Truffiere",
    "role": "admin"
  },
  "accessToken": "<jwt_15min>",
  "refreshToken": "<jwt_7j>"
}
```

**Erreurs**

```json
{ "error": "Email ou mot de passe incorrect", "code": "INVALID_CREDENTIALS" }
{ "error": "Compte verrouillé", "code": "ACCOUNT_LOCKED", "lockedUntil": "2026-05-14T15:30:00Z" }
```

---

### POST /auth/refresh

```http
POST /api/auth/refresh
Content-Type: application/json

{ "refreshToken": "<token>" }
```

**Réponse 200**

```json
{ "accessToken": "<nouveau_jwt_15min>", "refreshToken": "<nouveau_refresh>" }
```

> Le refresh token est **rotatif** : l'ancien est invalidé immédiatement. Toute réutilisation déclenche `REFRESH_TOKEN_REUSED` et révoque toutes les sessions.

---

### POST /auth/logout

```http
POST /api/auth/logout
Authorization: Bearer <token>
Content-Type: application/json

{ "refreshToken": "<token>" }
```

**Réponse 200** : `{ "message": "Déconnexion réussie", "code": "LOGOUT_SUCCESS" }`

---

### POST /auth/change-password

```http
POST /api/auth/change-password
Authorization: Bearer <token>
Content-Type: application/json

{
  "currentPassword": "admin123",
  "newPassword": "MonMotDePasseForce!2026"
}
```

**Réponse 200** : `{ "message": "Mot de passe modifié", "code": "PASSWORD_CHANGED" }`

---

## Parcelles

### GET /parcelles

```http
GET /api/parcelles
Authorization: Bearer <token>
```

**Réponse 200** — tableau des parcelles actives (soft delete)

```json
[
  {
    "id": 1,
    "nom": "Parcelle Nord",
    "surface_ha": 2.5,
    "localisation": "Secteur A",
    "latitude": 47.3456,
    "longitude": -1.6789,
    "notes": "",
    "created_at": "2025-09-01T08:00:00Z",
    "updated_at": "2026-03-15T14:30:00Z"
  }
]
```

---

### POST /parcelles

```http
POST /api/parcelles
Authorization: Bearer <token>
Content-Type: application/json

{
  "nom": "Parcelle Sud",
  "surface_ha": 1.8,
  "localisation": "Secteur B",
  "latitude": 47.3200,
  "longitude": -1.6500,
  "notes": "Terrain argileux"
}
```

**Réponse 201** : objet parcelle créé  
**Erreur 409** : `{ "code": "DUPLICATE_NOM" }` si nom déjà existant

---

### GET /parcelles/:id/arbres

```http
GET /api/parcelles/1/arbres
Authorization: Bearer <token>
```

Retourne les arbres actifs de la parcelle (sans soft-deleted).

---

### PUT /parcelles/:id/restore

Restaure une parcelle depuis la corbeille.

```http
PUT /api/parcelles/1/restore
Authorization: Bearer <token>
```

---

## Arbres

### GET /arbres

```http
GET /api/arbres
Authorization: Bearer <token>
```

**Réponse 200** — arbres actifs avec jointures parcelle + espèce

```json
[
  {
    "id": 42,
    "numero": "A-042",
    "parcelle_id": 1,
    "parcelle_nom": "Parcelle Nord",
    "espece_id": 2,
    "espece_nom": "Quercus pubescens",
    "date_plantation": "2020-03-10",
    "etat_sanitaire": "Sain",
    "latitude": 47.3460,
    "longitude": -1.6795,
    "notes": "",
    "deleted_at": null
  }
]
```

---

### POST /arbres

```http
POST /api/arbres
Authorization: Bearer <token>
Content-Type: application/json

{
  "numero": "A-043",
  "parcelle_id": 1,
  "espece_id": 2,
  "date_plantation": "2022-03-15",
  "etat_sanitaire": "Sain",
  "latitude": 47.3461,
  "longitude": -1.6796,
  "notes": ""
}
```

**Réponse 201** : objet arbre créé

---

## Récoltes

### GET /recoltes

```http
GET /api/recoltes
Authorization: Bearer <token>
```

**Réponse 200**

```json
[
  {
    "id": 10,
    "date_recolte": "2025-11-18",
    "poids_grammes": 850,
    "qualite": "Extra",
    "prix_kg": 900.00,
    "parcelle_id": 1,
    "parcelle_nom": "Parcelle Nord",
    "arbre_id": 42,
    "arbre_numero": "A-042",
    "caveur_id": 1,
    "caveur_nom": "Martin",
    "chien_id": 2,
    "chien_nom": "Rex",
    "notes": ""
  }
]
```

### POST /recoltes

```http
POST /api/recoltes
Authorization: Bearer <token>
Content-Type: application/json

{
  "date_recolte": "2026-01-10",
  "poids_grammes": 1200,
  "qualite": "Extra",
  "prix_kg": 950.00,
  "parcelle_id": 1,
  "arbre_id": 42,
  "caveur_id": 1,
  "chien_id": 2,
  "notes": "Très belle récolte matinale"
}
```

**Qualités acceptées** : `Extra`, `1ère catégorie`, `2ème catégorie`, `Confection`

**Réponse 201** : objet récolte créé

---

## Interventions

### GET /interventions

Retourne toutes les interventions avec jointures type, parcelle, arbre.

```http
GET /api/interventions
Authorization: Bearer <token>
```

### GET /interventions/stats

Statistiques par type d'intervention, filtres optionnels.

```http
GET /api/interventions/stats?date_debut=2025-09-01&date_fin=2026-03-31&parcelle_id=1
Authorization: Bearer <token>
```

**Réponse 200**

```json
{
  "par_type": [
    {
      "type_intervention": "Irrigation",
      "couleur": "#3498db",
      "nombre": 12,
      "cout_total": 0,
      "duree_moyenne": 45.5
    }
  ],
  "totaux": {
    "total_interventions": 28,
    "cout_total": 1250.00,
    "duree_totale_minutes": 1890
  }
}
```

### GET /interventions/stats/eau

Consommation d'eau par parcelle (irrigations uniquement).

### GET /interventions/stats/traitements

Registre de traçabilité phytosanitaire — conforme au cahier d'épandage.

```json
[
  {
    "id": 5,
    "date_realisee": "2025-10-15",
    "parcelle": "Parcelle Nord",
    "arbre": "A-042",
    "nom_commercial": "Produit X",
    "matiere_active": "Cuivre",
    "numero_amm": "2060123",
    "dose_produit_ha": 2.5,
    "surface_traitee_ha": 1.2,
    "delai_avant_recolte_jours": 14,
    "personnel": "Jean Dupont"
  }
]
```

### GET /interventions/check-doublon

```http
GET /api/interventions/check-doublon?arbre_id=42&type_intervention_id=3&date_prevue=2026-02-10
```

**Réponse** : `{ "exists": true }`

### POST /interventions

Création avec détails optionnels (irrigation ou traitement phyto) en transaction unique.

```http
POST /api/interventions
Authorization: Bearer <token>
Content-Type: application/json

{
  "type_intervention_id": 3,
  "parcelle_id": 1,
  "arbre_id": 42,
  "date_prevue": "2026-02-15",
  "date_realisee": "2026-02-15",
  "duree_minutes": 60,
  "personnel": "Jean Dupont",
  "description": "Taille hivernale",
  "cout": 50.00,
  "statut": "Réalisée",
  "meteo": "Ensoleillé",
  "notes": "",

  "volume_eau_m3": 0.5,
  "methode_irrigation": "Goutte-à-goutte"
}
```

**Réponse 201** : objet intervention créé. Les champs de détails sont insérés en transaction dans `intervention_details`.

### GET /interventions/:id/details

Détails spécifiques (irrigation ou traitement phyto) pour une intervention.

---

## Commercial — Clients, Ventes, Commandes

### GET /clients

```http
GET /api/clients
Authorization: Bearer <token>
```

### GET /clients/stats

Statistiques par type de client (Particulier, Restaurateur, Grossiste…).

### POST /clients

```http
POST /api/clients
Content-Type: application/json

{
  "nom": "Restaurant Le Périgord",
  "type_client": "Restaurateur",
  "email": "contact@le-perigord.fr",
  "telephone": "0240123456",
  "adresse": "12 rue de la Truffe, 44000 Nantes",
  "notes": ""
}
```

---

### GET /ventes

```http
GET /api/ventes
Authorization: Bearer <token>
```

Retourne les ventes avec jointures client + lignes de vente.

### POST /ventes

```http
POST /api/ventes
Content-Type: application/json

{
  "client_id": 3,
  "date_vente": "2026-01-20",
  "montant_total": 855.00,
  "notes": "Livraison comprise",
  "lignes": [
    {
      "qualite": "Extra",
      "poids_grammes": 950,
      "prix_kg": 900.00
    }
  ]
}
```

> La création d'une vente décrémente automatiquement le stock calculé.

---

### GET /commandes

```http
GET /api/commandes
Authorization: Bearer <token>
```

### POST /commandes

```http
POST /api/commandes
Content-Type: application/json

{
  "client_id": 3,
  "date_commande": "2026-01-18",
  "date_livraison_prevue": "2026-01-22",
  "quantite_grammes": 1000,
  "qualite_souhaitee": "Extra",
  "prix_kg_negocie": 880.00,
  "statut": "En attente",
  "notes": ""
}
```

### PUT /commandes/:id/statut

Changement rapide de statut sans modifier le reste de la commande.

```http
PUT /api/commandes/5/statut
Content-Type: application/json

{ "statut": "Confirmée" }
```

**Statuts valides** : `En attente`, `Confirmée`, `En préparation`, `Expédiée`, `Livrée`, `Annulée`

---

## Stock

Le stock est calculé dynamiquement : `récoltes − ventes`, par qualité et saison.

### GET /stock

```http
GET /api/stock
Authorization: Bearer <token>
```

**Réponse 200**

```json
[
  {
    "qualite": "Extra",
    "total_recolte_grammes": 12500,
    "total_vendu_grammes": 9800,
    "stock_disponible_grammes": 2700
  },
  {
    "qualite": "1ère catégorie",
    "total_recolte_grammes": 5000,
    "total_vendu_grammes": 3200,
    "stock_disponible_grammes": 1800
  }
]
```

### GET /stock/global

Stock agrégé toutes qualités confondues.

---

## Dashboard & Statistiques

### GET /dashboard/full

Endpoint principal du dashboard — toutes les données en une seule requête (14 requêtes parallèles via `Promise.all`).

```http
GET /api/dashboard/full
Authorization: Bearer <token>
```

**Réponse 200** (structure simplifiée)

```json
{
  "parcelles": { "count": 5, "surface": 12.3 },
  "arbres": { "count": 320, "parEtat": [...] },
  "recoltesSaison": { "total_grammes": 18500, "count": 42 },
  "ventesMois": { "chiffre_affaires": 4750.00, "count": 8 },
  "interventionsAVenir": { "count": 3 },
  "commandesEnCours": { "count": 2 },
  "commandesEnAttente": { "count": 1 },
  "ventesEnAttente": { "count": 0 },
  "dernieresRecoltes": [...],
  "prochainesInterventions": [...],
  "commandesRecentes": [...],
  "productionMensuelle": [...],
  "productionParParcelle": [...]
}
```

### GET /stats/recoltes-annuelles

Agrégat annuel des récoltes (10 dernières années).

```json
[
  { "annee": 2026, "total_grammes": 18500, "nombre_recoltes": 42 },
  { "annee": 2025, "total_grammes": 21300, "nombre_recoltes": 51 }
]
```

### GET /stats/recoltes-mensuelles

Agrégat mensuel toutes années confondues.

---

## Historique (Audit Trail)

### GET /historique

```http
GET /api/historique?table_name=interventions&start_date=2026-01-01&end_date=2026-05-14&action=create&limit=100
Authorization: Bearer <token>
```

**Paramètres** (tous optionnels)

| Paramètre | Type | Description |
|---|---|---|
| `table_name` | string | `parcelles`, `arbres`, `recoltes`, `interventions`, `clients`, `ventes`, `commandes`… ou `all` |
| `start_date` | date | Filtre depuis (Europe/Paris) |
| `end_date` | date | Filtre jusqu'à (inclus) |
| `action` | string | `create`, `update`, `delete`, `login`, `logout` |
| `limit` | number | Max résultats (défaut 500) |

**Réponse 200**

```json
[
  {
    "id": 1024,
    "table_name": "interventions",
    "action": "create",
    "record_id": 87,
    "old_data": null,
    "new_data": { "type_intervention_id": 3, "statut": "Planifié", "...": "..." },
    "metadata": { "ip": "192.168.1.10" },
    "timestamp": "2026-05-14T10:22:00Z",
    "item_name": "Taille hivernale"
  }
]
```

### GET /historique/stats

Comptage par `table_name` + `action` avec total et date du premier enregistrement.

### DELETE /historique/purge *(admin)*

```http
DELETE /api/historique/purge
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "period": "year",
  "table_name": "all"
}
```

**Valeurs `period`** : `month`, `6months`, `year`, `custom` (+ `custom_date`)

**Réponse 200** : `{ "code": "HISTORIQUE_PURGED", "deleted_count": 1247 }`

---

## Paramètres & Préférences

### GET /parametres

Liste de toutes les clés de configuration de l'application.

### GET /parametres/:cle

```http
GET /api/parametres/theme_couleur
Authorization: Bearer <token>
```

### PUT /parametres/:cle

```http
PUT /api/parametres/theme_couleur
Content-Type: application/json

{ "valeur": "dark" }
```

### GET /preferences / PUT /preferences

Préférences par utilisateur (colonnes visibles, ordre, filtres sauvegardés).

---

## Référentiels

Tous les référentiels exposent un CRUD standard : `GET /`, `POST /`, `PUT /:id`, `DELETE /:id`.

| Endpoint | Description |
|---|---|
| `/types-intervention` | Types d'interventions (Taille, Irrigation, Traitement…) avec couleur |
| `/caveurs` | Caveurs enregistrés |
| `/chiens` | Chiens de cavage |
| `/especes` | Espèces d'arbres (Quercus pubescens, Quercus ilex…) |
| `/produits-phyto` | Référentiel produits phytosanitaires |
| `/amendements-ref` | Référentiel amendements |

---

## Import / Export

### POST /import/csv

Import en masse via fichier CSV. Voir documentation détaillée dans l'interface Paramètres → Import CSV.

### GET /export/pdf

Génération de rapport PDF. Paramètres disponibles selon le module.

---

## Rate Limiting

| Scope | Limite |
|---|---|
| Global | 1 000 requêtes / 15 minutes par IP |
| Auth (`/auth/login`, `/auth/refresh`) | 10 requêtes / 15 minutes par IP |

**Réponse 429**

```json
{
  "error": "Trop de requêtes",
  "code": "RATE_LIMIT_EXCEEDED"
}
```

---

## Health Check

```http
GET /api/health
```

**Réponse 200** : `{ "status": "ok" }`

Aucune authentification requise — utilisé par Docker healthcheck et monitoring.

---

## Exemples cURL

```bash
# Login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@truffiere.local","password":"admin123"}'

# Lister les parcelles
curl http://localhost:5000/api/parcelles \
  -H "Authorization: Bearer <token>"

# Dashboard complet
curl http://localhost:5000/api/dashboard/full \
  -H "Authorization: Bearer <token>"

# Créer une récolte
curl -X POST http://localhost:5000/api/recoltes \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"date_recolte":"2026-01-10","poids_grammes":1200,"qualite":"Extra","prix_kg":950,"parcelle_id":1}'

# Consulter le stock
curl http://localhost:5000/api/stock \
  -H "Authorization: Bearer <token>"

# Audit trail des 7 derniers jours
curl "http://localhost:5000/api/historique?start_date=2026-05-07&limit=200" \
  -H "Authorization: Bearer <token>"
```

---

*Dernière mise à jour : mai 2026 — V8 (2.0.2)*
