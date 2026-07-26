# 📡 API Documentation — Gestion-Truffière v8

> Documentation complète de l'API REST — branche V8 (v2.0.2)  
> Base URL de production : `https://m-a-truffes.sytes.net/api`

→ Codes d'erreur complets : [`backend/docs/API_ERROR_CODES.md`](backend/docs/API_ERROR_CODES.md)  
→ Architecture : [`ARCHITECTURE.md`](ARCHITECTURE.md)

---

## 📋 Sommaire

1. [Vue d'ensemble](#vue-densemble)
2. [Authentification](#authentification)
3. [Gestion des erreurs](#gestion-des-erreurs)
4. [Index des endpoints](#index-des-endpoints)
5. [Auth](#auth)
6. [Parcelles](#parcelles)
7. [Arbres](#arbres)
8. [Récoltes](#récoltes)
9. [Interventions](#interventions)
10. [Commercial — Clients](#clients)
11. [Commercial — Ventes](#ventes)
12. [Commercial — Commandes](#commandes)
13. [Fournisseurs & Achats](#fournisseurs--achats)
14. [Stock](#stock)
15. [Dashboard](#dashboard)
16. [Statistiques](#statistiques)
17. [Historique (Audit trail)](#historique)
18. [Paramètres & Préférences](#paramètres--préférences)
19. [Référentiels](#référentiels)
20. [Utilisateurs (Admin)](#utilisateurs)
21. [Système](#système)

---

## Vue d'ensemble

### Base URL

```
Production :   https://m-a-truffes.sytes.net/api
Développement: http://localhost:3001/api
```

### Protocole

- **Format** : JSON
- **Charset** : UTF-8
- **Auth** : JWT Bearer Token
- **HTTPS** : obligatoire en production

### Version

```http
X-API-Version: 8.0
X-API-Build: 2.0.2
```

### Format de réponse standard

Les endpoints retournent directement les données (tableaux ou objets) :

```json
// Liste
[ { "id": 1, "nom": "Parcelle A", ... }, ... ]

// Objet unique
{ "id": 1, "nom": "Parcelle A", ... }

// Message de confirmation
{ "message": "Ressource supprimée", "code": "RESOURCE_DELETED" }
```

---

## Authentification

### JWT Bearer Token

L'API utilise JWT avec rotation des refresh tokens.

**Durées :**
- Access token : **15 minutes** (non modifiable — politique sécurité V8)
- Refresh token : **7 jours** avec rotation automatique

#### Flux d'authentification

1. `POST /api/auth/login` → reçoit `accessToken` + `refreshToken`
2. Inclure l'access token dans chaque requête :
   ```http
   Authorization: Bearer <accessToken>
   ```
3. Quand le token expire (401), appeler `POST /api/auth/refresh`
4. En cas de réutilisation d'un refresh token révoqué → tous les tokens de la session sont invalidés (détection de vol)

#### Payload du token

```javascript
// Access Token (15 min)
{
  "userId": 1,
  "email": "admin@truffiere.local",
  "role": "admin",      // admin | user | readonly
  "iat": 1747820000,
  "exp": 1747820900     // +900 secondes
}

// Refresh Token (7 jours)
{
  "userId": 1,
  "type": "refresh",
  "iat": 1747820000,
  "exp": 1748424800
}
```

#### Rôles et droits

| Rôle | Lecture | Écriture | Admin |
|------|---------|----------|-------|
| `admin` | ✅ | ✅ | ✅ |
| `user` | ✅ | ✅ | ❌ |
| `readonly` | ✅ | ❌ | ❌ |

---

## Gestion des erreurs

### Codes HTTP utilisés

| Code | Signification |
|------|---------------|
| 200 | OK |
| 201 | Créé |
| 400 | Requête invalide (validation) |
| 401 | Non authentifié |
| 403 | Accès refusé (droits insuffisants) |
| 404 | Ressource introuvable |
| 409 | Conflit (doublon) |
| 429 | Trop de requêtes (rate limiting) |
| 500 | Erreur serveur |

### Format d'erreur

```json
{
  "error": "Message lisible",
  "code": "ERROR_CODE_STANDARDISE",
  "details": "Stack ou info technique (uniquement en NODE_ENV=development)"
}
```

### Rate limiting

- **Global** : 1 000 requêtes / 15 minutes
- **Auth** (`/auth/login`, `/auth/refresh`) : 10 requêtes / 15 minutes
- **Account locking** : 5 tentatives de connexion échouées → verrouillage 15 min

### Exemple de gestion Axios

```javascript
axios.interceptors.response.use(
  res => res,
  async err => {
    if (err.response?.status === 401 && !err.config._retry) {
      err.config._retry = true;
      const { data } = await axios.post('/api/auth/refresh', { refreshToken });
      setAccessToken(data.accessToken);
      err.config.headers['Authorization'] = `Bearer ${data.accessToken}`;
      return axios(err.config);
    }
    if (err.response?.data?.code === 'ACCOUNT_LOCKED') {
      showLockedUntil(err.response.data.lockedUntil);
    }
    return Promise.reject(err);
  }
);
```

---

## Index des endpoints

```
# Authentification
POST   /auth/login                        Connexion
POST   /auth/logout                       Déconnexion
POST   /auth/refresh                      Renouvellement du token
POST   /auth/change-password              Changement de mot de passe
GET    /auth/me                           Profil de l'utilisateur connecté
GET    /auth/sessions                     Sessions actives
DELETE /auth/sessions/:id                 Révoquer une session
GET    /auth/security-events             Journal des événements de sécurité (admin)

# Parcelles
GET    /parcelles                         Lister toutes les parcelles
GET    /parcelles/corbeille               Parcelles supprimées (soft delete)
GET    /parcelles/:id                     Détail d'une parcelle
POST   /parcelles                         Créer une parcelle
PUT    /parcelles/:id                     Modifier une parcelle
DELETE /parcelles/:id                     Supprimer (soft delete)
PUT    /parcelles/:id/restaurer           Restaurer depuis la corbeille

# Arbres
GET    /arbres                            Lister les arbres
GET    /arbres/corbeille                  Arbres supprimés
GET    /arbres/:id                        Détail d'un arbre
POST   /arbres                            Créer un arbre
PUT    /arbres/:id                        Modifier un arbre
DELETE /arbres/:id                        Supprimer (soft delete)
PUT    /arbres/:id/restaurer              Restaurer

# Récoltes
GET    /recoltes                          Lister les récoltes
GET    /recoltes/:id                      Détail d'une récolte
POST   /recoltes                          Enregistrer une récolte
PUT    /recoltes/:id                      Modifier une récolte
DELETE /recoltes/:id                      Supprimer une récolte

# Interventions
GET    /interventions                     Lister les interventions
GET    /interventions/stats               Statistiques par type
GET    /interventions/stats/eau           Consommation d'eau
GET    /interventions/stats/traitements   Traçabilité phytosanitaire
GET    /interventions/export              Export complet avec détails
GET    /interventions/check-doublon       Vérifier doublon
GET    /interventions/:id                 Détail d'une intervention
GET    /interventions/:id/details         Détails spécifiques (irrigation/traitement)
POST   /interventions                     Créer une intervention
POST   /interventions/:id/details         Créer/mettre à jour les détails
PUT    /interventions/:id                 Modifier une intervention
DELETE /interventions/:id                 Supprimer une intervention
DELETE /interventions/:id/details         Supprimer les détails

# Commercial
GET    /clients                           Lister les clients
GET    /clients/:id                       Détail d'un client
POST   /clients                           Créer un client
PUT    /clients/:id                       Modifier un client
DELETE /clients/:id                       Supprimer un client
GET    /clients/:id/ventes                Ventes d'un client

GET    /ventes                            Lister les ventes
GET    /ventes/:id                        Détail d'une vente
POST   /ventes                            Créer une vente
PUT    /ventes/:id                        Modifier une vente
DELETE /ventes/:id                        Supprimer une vente

GET    /commandes                         Lister les commandes
GET    /commandes/:id                     Détail d'une commande
POST   /commandes                         Créer une commande
PUT    /commandes/:id                     Modifier une commande
DELETE /commandes/:id                     Supprimer une commande
POST   /commandes/:id/generer-vente       Générer une vente depuis une commande

# Fournisseurs & Achats
GET    /fournisseurs                      Lister les fournisseurs
GET    /fournisseurs/:id                  Détail d'un fournisseur
GET    /fournisseurs/:id/statistiques     Statistiques d'un fournisseur
POST   /fournisseurs                      Créer un fournisseur
PUT    /fournisseurs/:id                  Modifier un fournisseur
DELETE /fournisseurs/:id                  Supprimer (soft delete)
POST   /fournisseurs/:id/evaluations      Créer une évaluation fournisseur
GET    /fournisseurs/:id/evaluations      Évaluations d'un fournisseur

GET    /commandes-achats                  Lister les commandes d'achat
GET    /commandes-achats/:id              Détail d'une commande d'achat
GET    /commandes-achats/:id/lignes       Lignes d'une commande d'achat
POST   /commandes-achats                  Créer une commande d'achat
PUT    /commandes-achats/:id              Modifier une commande d'achat
PUT    /commandes-achats/:id/statut       Changer le statut d'une commande
POST   /commandes-achats/:id/reception    Réceptionner une commande (crée le stock)
DELETE /commandes-achats/:id              Supprimer une commande d'achat

GET    /factures-achats                   Lister les factures d'achat
POST   /factures-achats                   Créer une facture d'achat
PUT    /factures-achats/:id/paiement      Enregistrer un paiement

GET    /stock-disponible                  Stock de truffes achetées disponible
GET    /stock-disponible/details          Détails complets du stock
GET    /stock-disponible/alertes          Alertes stock bas / dates limites

GET    /historique-prix                   Évolution des prix d'achat
GET    /marge-globale                     Analyse des marges achat/vente
GET    /marge-globale/details             Détail des marges par transaction

# Stock
GET    /stock                             Stock global (récoltes − ventes)
GET    /stock/par-qualite                 Stock par qualité

# Dashboard & Statistiques
GET    /dashboard/full                    Dashboard consolidé temps réel
GET    /stats/dashboard                   Statistiques legacy (compatibilité)
GET    /stats/recoltes-annuelles          Récoltes agrégées par année
GET    /stats/recoltes-mensuelles         Récoltes agrégées par mois

# Historique (Audit trail)
GET    /historique                        Lister l'historique avec filtres
GET    /historique/stats                  Statistiques de l'historique
DELETE /historique/purge                  Purger l'historique (admin)

# Paramètres & Préférences
GET    /parametres                        Paramètres de l'application
PUT    /parametres                        Mettre à jour les paramètres
GET    /preferences-utilisateur           Préférences de l'utilisateur connecté
PUT    /preferences-utilisateur           Mettre à jour les préférences
POST   /preferences-utilisateur/reset     Réinitialiser les préférences

# Référentiels
GET    /types-intervention                Types d'intervention disponibles
GET    /especes                           Espèces d'arbres
GET    /caveurs                           Caveurs
GET    /chiens                            Chiens de cavage
GET    /produits-phyto                    Produits phytosanitaires
GET    /amendements-ref                   Référentiel amendements
GET    /zones-production                  Zones de production actives
GET    /zones-production/par-region       Zones groupées par région

# Utilisateurs (admin)
GET    /auth/users                        Lister les utilisateurs
POST   /auth/users                        Créer un utilisateur
PUT    /auth/users/:id                    Modifier un utilisateur
DELETE /auth/users/:id                    Supprimer un utilisateur
PUT    /auth/users/:id/role               Changer le rôle
POST   /auth/users/:id/unlock             Déverrouiller un compte

# Système
GET    /health                            Health check
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

**Réponse 200 :**

```json
{
  "user": {
    "id": 1,
    "email": "admin@truffiere.local",
    "nom": "Admin",
    "prenom": "Truffiere",
    "role": "admin"
  },
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": 900
}
```

> `expiresIn` = 900 secondes (15 minutes)

**Erreurs :**

| Code HTTP | Code erreur | Cause |
|-----------|------------|-------|
| 400 | `MISSING_CREDENTIALS` | Email ou mot de passe absent |
| 401 | `INVALID_CREDENTIALS` | Email/mot de passe incorrect |
| 423 | `ACCOUNT_LOCKED` | 5 tentatives échouées — inclut `lockedUntil` |

---

### POST /auth/refresh

```http
POST /api/auth/refresh
Content-Type: application/json

{ "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." }
```

**Réponse 200 :**

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": 900
}
```

> Le refresh token est **rotatif** : un nouveau token est émis à chaque appel. La réutilisation d'un ancien token invalide toute la session.

---

### POST /auth/logout

```http
POST /api/auth/logout
Authorization: Bearer <accessToken>
Content-Type: application/json

{ "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." }
```

**Réponse 200 :**

```json
{ "message": "Déconnexion réussie", "code": "LOGOUT_SUCCESS" }
```

---

### POST /auth/change-password

```http
POST /api/auth/change-password
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "currentPassword": "admin123",
  "newPassword": "NouveauMotDePasse!2026"
}
```

---

## Parcelles

### GET /parcelles

```http
GET /api/parcelles
Authorization: Bearer <token>
```

**Réponse 200 :**

```json
[
  {
    "id": 1,
    "nom": "Parcelle A",
    "surface_ha": 2.5,
    "localisation": "Lieu-dit Les Pins",
    "latitude": 47.2941,
    "longitude": -1.5840,
    "notes": "",
    "created_at": "2025-03-01T10:00:00Z",
    "updated_at": "2026-01-15T14:00:00Z",
    "deleted_at": null
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
  "nom": "Parcelle B",
  "surface_ha": 1.8,
  "localisation": "Route de la Forêt",
  "latitude": 47.3012,
  "longitude": -1.5721,
  "notes": "Plantation 2022 — Tuber melanosporum"
}
```

**Réponse 201 :** objet parcelle créé.

---

### DELETE /parcelles/:id

Suppression **soft delete** — la parcelle passe en corbeille (`deleted_at` renseigné), elle n'est pas physiquement supprimée. Restauration possible via `PUT /parcelles/:id/restaurer`.

---

## Arbres

### GET /arbres

```http
GET /api/arbres
Authorization: Bearer <token>
```

**Réponse 200 :**

```json
[
  {
    "id": 1,
    "parcelle_id": 1,
    "numero": "A-001",
    "espece_id": 2,
    "variete": "Périgord Noir",
    "date_plantation": "2020-03-15",
    "etat_sanitaire": "Bon",
    "latitude": 47.2941,
    "longitude": -1.5840,
    "notes": "",
    "deleted_at": null
  }
]
```

**Valeurs `etat_sanitaire` :** `Bon` | `Moyen` | `Mauvais` | `Mort`

---

### POST /arbres

```http
POST /api/arbres
Authorization: Bearer <token>
Content-Type: application/json

{
  "parcelle_id": 1,
  "numero": "A-002",
  "espece_id": 2,
  "variete": "Périgord Noir",
  "date_plantation": "2021-04-10",
  "etat_sanitaire": "Bon",
  "latitude": 47.2942,
  "longitude": -1.5841
}
```

---

## Récoltes

### GET /recoltes

```http
GET /api/recoltes
Authorization: Bearer <token>
```

**Réponse 200 :**

```json
[
  {
    "id": 1,
    "parcelle_id": 1,
    "arbre_id": null,
    "date_recolte": "2025-11-20",
    "poids_grammes": 850,
    "qualite": "Extra",
    "caveur_id": 1,
    "chien_id": 2,
    "notes": "Bonne saison",
    "created_at": "2025-11-20T16:00:00Z"
  }
]
```

**Valeurs `qualite` :** `Extra` | `1er choix` | `2ème choix` | `Confection`

---

### POST /recoltes

```http
POST /api/recoltes
Authorization: Bearer <token>
Content-Type: application/json

{
  "parcelle_id": 1,
  "arbre_id": null,
  "date_recolte": "2025-12-05",
  "poids_grammes": 1200,
  "qualite": "Extra",
  "caveur_id": 1,
  "chien_id": 2,
  "notes": ""
}
```

> **Note** : le champ est `poids_grammes` (entier, grammes) — pas `quantite_kg`.

---

## Interventions

### GET /interventions

```http
GET /api/interventions
Authorization: Bearer <token>
```

**Réponse 200 :**

```json
[
  {
    "id": 1,
    "type_intervention_id": 3,
    "type_nom": "Traitement",
    "parcelle_id": 1,
    "parcelle_nom": "Parcelle A",
    "arbre_id": null,
    "arbre_numero": null,
    "date_prevue": "2026-02-10",
    "date_realisee": "2026-02-10",
    "duree_minutes": 90,
    "personnel": "Jean Dupont",
    "description": "Traitement préventif",
    "cout": 45.50,
    "statut": "Réalisé",
    "meteo": "Ensoleillé",
    "notes": ""
  }
]
```

**Valeurs `statut` :** `Planifié` | `En cours` | `Réalisé` | `Annulé`

---

### POST /interventions

Création transactionnelle : si des champs de détail (irrigation ou traitement phyto) sont fournis, un enregistrement `intervention_details` est créé dans la même transaction.

```http
POST /api/interventions
Authorization: Bearer <token>
Content-Type: application/json

{
  "type_intervention_id": 3,
  "parcelle_id": 1,
  "arbre_id": null,
  "date_prevue": "2026-03-15",
  "date_realisee": null,
  "duree_minutes": 60,
  "personnel": "Jean Dupont",
  "description": "Traitement insecticide préventif",
  "cout": 55.00,
  "statut": "Planifié",
  "meteo": null,
  "notes": "",

  "nom_commercial": "Kaolin WP",
  "matiere_active": "kaolin",
  "numero_amm": "2010001",
  "dose_produit_ha": 20,
  "surface_traitee_ha": 2.5,
  "volume_bouillie_l": 300,
  "methode_application": "Pulvérisateur",
  "cible_traitement": "Mouche de la truffe",
  "delai_avant_recolte_jours": 7
}
```

---

### GET /interventions/stats/traitements

Retourne le journal de traçabilité phytosanitaire complet, compatible avec les exigences réglementaires.

```http
GET /api/interventions/stats/traitements?date_debut=2025-09-01&date_fin=2026-03-31
Authorization: Bearer <token>
```

---

### GET /interventions/check-doublon

```http
GET /api/interventions/check-doublon?arbre_id=5&type_intervention_id=3&date_prevue=2026-03-15
Authorization: Bearer <token>
```

**Réponse 200 :** `{ "exists": false }`

---

## Clients

### GET /clients

```http
GET /api/clients
Authorization: Bearer <token>
```

**Réponse 200 :**

```json
[
  {
    "id": 1,
    "nom": "Dupont",
    "prenom": "Marie",
    "email": "marie.dupont@example.com",
    "telephone": "0612345678",
    "adresse": "12 rue des Chênes",
    "ville": "Nantes",
    "code_postal": "44000",
    "type_client": "Particulier",
    "notes": "",
    "created_at": "2025-10-01T10:00:00Z"
  }
]
```

**Valeurs `type_client` :** `Particulier` | `Restaurant` | `Grossiste` | `Autre`

---

### POST /clients

```http
POST /api/clients
Authorization: Bearer <token>
Content-Type: application/json

{
  "nom": "Martin",
  "prenom": "Paul",
  "email": "paul.martin@restaurant.fr",
  "telephone": "0298765432",
  "adresse": "5 place du Marché",
  "ville": "Rennes",
  "code_postal": "35000",
  "type_client": "Restaurant",
  "notes": "Client fidèle depuis 2023"
}
```

---

## Ventes

### GET /ventes

```http
GET /api/ventes
Authorization: Bearer <token>
```

**Réponse 200 :**

```json
[
  {
    "id": 1,
    "client_id": 1,
    "client_nom": "Dupont Marie",
    "date_vente": "2025-12-01",
    "poids_grammes": 500,
    "qualite": "Extra",
    "prix_unitaire_kg": 900,
    "montant_total": 450.00,
    "notes": ""
  }
]
```

---

### POST /ventes

```http
POST /api/ventes
Authorization: Bearer <token>
Content-Type: application/json

{
  "client_id": 1,
  "date_vente": "2025-12-15",
  "poids_grammes": 300,
  "qualite": "Extra",
  "prix_unitaire_kg": 950,
  "montant_total": 285.00,
  "notes": ""
}
```

---

## Commandes

### GET /commandes

```http
GET /api/commandes
Authorization: Bearer <token>
```

**Réponse 200 :**

```json
[
  {
    "id": 1,
    "client_id": 1,
    "client_nom": "Dupont Marie",
    "date_commande": "2025-11-25",
    "date_livraison_souhaitee": "2025-12-05",
    "poids_grammes": 600,
    "qualite": "1er choix",
    "prix_unitaire_kg": 850,
    "montant_total": 510.00,
    "statut": "En attente",
    "notes": ""
  }
]
```

**Valeurs `statut` :** `En attente` | `Confirmée` | `En préparation` | `Livrée` | `Annulée`

---

### POST /commandes/:id/generer-vente

Génère automatiquement une vente à partir d'une commande confirmée.

```http
POST /api/commandes/1/generer-vente
Authorization: Bearer <token>
```

**Réponse 201 :** objet vente créé avec les données de la commande.

---

## Fournisseurs & Achats

> ⚠️ Implémentation active : `backend/routes/achats-fournisseurs.routes.js`, montée directement sous `/api`.
> Un second fichier `backend/routes/fournisseurs.js` existe dans le dépôt mais **n'est pas monté dans `server.js`** — il s'agit de code mort (ancienne version, table `fournisseurstruffes` en camelCase) à ne pas utiliser ni documenter comme référence.

### GET /fournisseurs

```http
GET /api/fournisseurs
Authorization: Bearer <token>
```

**Réponse 200 :**

```json
[
  {
    "id": 1,
    "nom": "Truffes du Périgord",
    "raison_sociale": "SARL Truffes du Périgord",
    "email": "contact@example.com",
    "telephone": "0553000000",
    "adresse": "12 route des Chênes",
    "code_postal": "24000",
    "ville": "Périgueux",
    "pays": "France",
    "zone_production": "Périgord",
    "certifications": "Bio",
    "statut": "Actif",
    "contact_principal": "Jean Dupont",
    "telephone_contact": "0600000000",
    "delai_livraison_jours": 3,
    "conditions_paiement": "30 jours",
    "notes": "",
    "created_at": "2026-01-01T00:00:00.000Z",
    "updated_at": "2026-01-01T00:00:00.000Z"
  }
]
```

**Valeurs `statut` :** `Actif` | `Inactif`

---

### GET /fournisseurs/:id

Détails d'un fournisseur.

```http
GET /api/fournisseurs/1
Authorization: Bearer <token>
```

---

### GET /fournisseurs/:id/statistiques

Statistiques agrégées d'un fournisseur (commandes, montants, note moyenne).

```http
GET /api/fournisseurs/1/statistiques
Authorization: Bearer <token>
```

**Réponse 200 :**

```json
{
  "nombre_commandes": 12,
  "montant_total_achats": 4580.00,
  "montant_moyen_commande": 381.66,
  "note_moyenne": 4.2,
  "nombre_evaluations": 5,
  "derniere_commande": "2026-04-10"
}
```

---

### POST /fournisseurs

```http
POST /api/fournisseurs
Authorization: Bearer <token>
Content-Type: application/json

{
  "nom": "Truffes du Périgord",
  "raison_sociale": "SARL Truffes du Périgord",
  "email": "contact@example.com",
  "telephone": "0553000000",
  "adresse": "12 route des Chênes",
  "code_postal": "24000",
  "ville": "Périgueux",
  "pays": "France",
  "zone_production": "Périgord",
  "certifications": "Bio",
  "statut": "Actif",
  "contact_principal": "Jean Dupont",
  "telephone_contact": "0600000000",
  "delai_livraison_jours": 3,
  "conditions_paiement": "30 jours",
  "notes": ""
}
```

**Réponse 201 :** objet fournisseur créé.

---

### PUT /fournisseurs/:id

Modification complète d'un fournisseur (mêmes champs que POST).

---

### DELETE /fournisseurs/:id

Suppression logique (soft delete, `deleted_at`).

---

### POST /fournisseurs/:id/evaluations

Créer une évaluation fournisseur (qualité, délai, prix, service).

```http
POST /api/fournisseurs/1/evaluations
Authorization: Bearer <token>
Content-Type: application/json

{
  "note_qualite": 4,
  "note_delai": 5,
  "note_prix": 3,
  "note_service": 4,
  "commentaires": "Livraison rapide, bonne qualité"
}
```

---

### GET /fournisseurs/:id/evaluations

Liste des évaluations d'un fournisseur, triées par date décroissante.

---

### GET /commandes-achats

Liste des commandes d'achat auprès des fournisseurs, avec nombre de lignes et quantité totale agrégés.

```http
GET /api/commandes-achats
Authorization: Bearer <token>
```

---

### GET /commandes-achats/:id

Détails d'une commande d'achat avec ses lignes.

---

### GET /commandes-achats/:id/lignes

Lignes d'une commande d'achat uniquement.

---

### POST /commandes-achats

Créer une commande d'achat (fournisseur + lignes : calibre, qualité, maturité, quantité, prix).

```http
POST /api/commandes-achats
Authorization: Bearer <token>
Content-Type: application/json

{
  "fournisseur_id": 1,
  "date_commande": "2026-05-01",
  "date_livraison_prevue": "2026-05-05",
  "lignes": [
    {
      "calibre_mm": 30,
      "qualite": "1er choix",
      "maturite": "Mature",
      "quantite_kg": 2.5,
      "prix_achat_kg": 450
    }
  ],
  "notes": ""
}
```

**Réponse 201 :**

```json
{
  "commande": { "id": 5, "numero_commande": "ACH-1746000000000", "statut": "En attente", "...": "..." },
  "message": "Commande créée avec succès. 1 ligne(s) ajoutée(s).",
  "numeroCommande": "ACH-1746000000000"
}
```

> Un tableau `lignes` vide est autorisé (création de brouillon).

---

### PUT /commandes-achats/:id

Modification complète d'une commande d'achat (remplace toutes les lignes).

⚠️ Si la commande est au statut `Réceptionnée` ou `Livrée`, la modification est bloquée par défaut :

```json
{
  "error": "confirmation_required",
  "message": "Cette commande est Réceptionnée. Une confirmation est requise pour la modifier.",
  "statut": "Réceptionnée"
}
```
→ Statut HTTP `409`. Renvoyer `"force_modify": true` dans le body pour forcer la modification.

---

### PUT /commandes-achats/:id/statut

Changer uniquement le statut d'une commande (et éventuellement la date de livraison réelle).

```http
PUT /api/commandes-achats/1/statut
Authorization: Bearer <token>
Content-Type: application/json

{
  "statut": "Livrée",
  "date_livraison_reelle": "2026-05-06"
}
```

---

### POST /commandes-achats/:id/reception

Réceptionner une commande : crée les entrées de stock (`stocks_truffes_achetees`) pour chaque ligne reçue et passe la commande au statut `Réceptionnée`.

```http
POST /api/commandes-achats/1/reception
Authorization: Bearer <token>
Content-Type: application/json

{
  "date_reception": "2026-05-06",
  "lignes_recues": [
    {
      "ligne_id": 12,
      "quantite_recue": 2.5,
      "date_limite_consommation": "2026-05-13"
    }
  ],
  "conservation": "Frais",
  "localisation_storage": "Chambre froide A"
}
```

---

### DELETE /commandes-achats/:id

Suppression d'une commande d'achat (et de ses lignes en cascade).

⚠️ Même logique de confirmation que `PUT` si statut `Réceptionnée`/`Livrée` : renvoyer `?force_delete=true` (query) ou `"force_delete": true` (body) pour forcer.

---

### GET /factures-achats

Liste des factures d'achat, jointes au fournisseur et à la commande.

---

### POST /factures-achats

Créer une facture liée à une commande d'achat (calcule automatiquement la TVA et le TTC).

```http
POST /api/factures-achats
Authorization: Bearer <token>
Content-Type: application/json

{
  "commande_id": 5,
  "numero_facture": "FAC-2026-0012",
  "date_facture": "2026-05-06",
  "date_echeance": "2026-06-05",
  "montant_ht": 1125.00,
  "taux_tva": 20,
  "notes": ""
}
```

---

### PUT /factures-achats/:id/paiement

Enregistrer le paiement d'une facture (passe `statut_paiement` à `Payée`).

```http
PUT /api/factures-achats/1/paiement
Authorization: Bearer <token>
Content-Type: application/json

{
  "date_paiement": "2026-06-01",
  "mode_paiement": "Virement",
  "reference_paiement": "VIR-2026-0456"
}
```

---

### GET /stock-disponible

Stock de truffes achetées disponible (vue `vstocktruffesdisponible`), trié par calibre décroissant.

---

### GET /stock-disponible/details

Détails complets du stock disponible (jointure commande + fournisseur), excluant les lots périmés.

---

### GET /stock-disponible/alertes

Alertes stock : lots sous 5 kg (`stock_bas`) et lots à date limite de consommation ≤ 7 jours (`dates_limites`).

```json
{
  "stock_bas": [ "..." ],
  "dates_limites": [ "..." ],
  "total_alertes": 3
}
```

---

### GET /historique-prix

Évolution des prix d'achat, filtrable par `calibre_mm`, `qualite`, `maturite`, `date_debut`, `date_fin` (query params).

---

### GET /marge-globale

Analyse des marges achat/vente, globale et par calibre (vue `vanalysemargeparcalibre` + table `analyse_marge_truffes`).

---

### GET /marge-globale/details

Détail des marges par transaction individuelle.

---

## Stock

Le stock est **calculé dynamiquement** : `total_recoltes − total_ventes`, par qualité et par saison.

### GET /stock

```http
GET /api/stock
Authorization: Bearer <token>
```

**Réponse 200 :**

```json
{
  "stock_global_grammes": 3500,
  "par_qualite": [
    { "qualite": "Extra", "stock_grammes": 1200 },
    { "qualite": "1er choix", "stock_grammes": 1800 },
    { "qualite": "2ème choix", "stock_grammes": 500 }
  ]
}
```

---

## Dashboard

### GET /dashboard/full

Endpoint consolidé — toutes les données du dashboard en une seule requête (Promise.all sur 14 requêtes parallèles).

```http
GET /api/dashboard/full
Authorization: Bearer <token>
```

**Réponse 200 :**

```json
{
  "parcelles": { "count": 4, "surface": 8.2 },
  "arbres": {
    "count": 320,
    "parEtat": [
      { "etat_sanitaire": "Bon", "count": 290 },
      { "etat_sanitaire": "Moyen", "count": 25 },
      { "etat_sanitaire": "Mauvais", "count": 5 }
    ]
  },
  "recoltesSaison": { "totalGrammes": 12500, "count": 18 },
  "ventesMois": { "chiffreAffaires": 4750.00, "count": 7 },
  "interventionsAVenir": { "count": 3 },
  "commandesEnCours": { "count": 2 },
  "commandesEnAttente": { "count": 1 },
  "ventesEnAttente": [],
  "dernieresRecoltes": [ ... ],
  "prochainesInterventions": [ ... ],
  "commandesRecentes": [ ... ],
  "productionMensuelle": [ ... ],
  "productionParParcelle": [ ... ]
}
```

---

## Statistiques

### GET /stats/recoltes-annuelles

```http
GET /api/stats/recoltes-annuelles
Authorization: Bearer <token>
```

**Réponse 200 :**

```json
[
  { "annee": 2025, "total_grammes": 18400, "nombre_recoltes": 24 },
  { "annee": 2024, "total_grammes": 15200, "nombre_recoltes": 19 }
]
```

---

### GET /stats/recoltes-mensuelles

```http
GET /api/stats/recoltes-mensuelles
Authorization: Bearer <token>
```

**Réponse 200 :**

```json
[
  { "mois": "2025-11", "total_grammes": 4200, "nombre_recoltes": 6 },
  { "mois": "2025-12", "total_grammes": 7800, "nombre_recoltes": 10 },
  { "mois": "2026-01", "total_grammes": 6400, "nombre_recoltes": 8 }
]
```

---

## Historique

Audit trail complet de toutes les actions créer/modifier/supprimer, connexions, changements de mot de passe et actions admin.

### GET /historique

```http
GET /api/historique?table_name=recoltes&start_date=2025-11-01&end_date=2026-01-31&action=create&limit=100
Authorization: Bearer <token>
```

**Paramètres de filtre :**

| Paramètre | Type | Valeurs |
|-----------|------|---------|
| `table_name` | string | `parcelles` \| `arbres` \| `recoltes` \| `interventions` \| `clients` \| `ventes` \| `commandes` \| `all` |
| `action` | string | `create` \| `update` \| `delete` \| `all` |
| `start_date` | date | `YYYY-MM-DD` (fuseau Europe/Paris) |
| `end_date` | date | `YYYY-MM-DD` (fuseau Europe/Paris) |
| `limit` | number | défaut 500 |

**Réponse 200 :**

```json
[
  {
    "id": 1042,
    "table_name": "recoltes",
    "action": "create",
    "record_id": 48,
    "user_id": 1,
    "timestamp": "2025-12-05T16:32:00Z",
    "old_data": null,
    "new_data": { "poids_grammes": 850, "qualite": "Extra", ... },
    "item_name": "ID: 48"
  }
]
```

---

### DELETE /historique/purge

Admin uniquement.

```http
DELETE /api/historique/purge
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "period": "year",
  "table_name": "all"
}
```

**Valeurs `period` :** `month` | `6months` | `year` | `custom` (avec `custom_date`)

**Réponse 200 :**

```json
{
  "message": "Purge de l'historique effectuée",
  "code": "HISTORIQUE_PURGED",
  "deleted_count": 1284
}
```

---

## Paramètres & Préférences

### GET /preferences-utilisateur

Préférences de l'utilisateur connecté (colonnes affichées/exportées). Crée automatiquement une entrée par défaut si aucune n'existe encore pour l'utilisateur.

```http
GET /api/preferences-utilisateur
Authorization: Bearer <token>
```

**Réponse 200 :**

```json
{
  "user_id": "12",
  "colonnes_affichees": { "parcelles": ["nom", "surface_ha"], "arbres": ["numero", "espece"] },
  "colonnes_export": {}
}
```

---

### PUT /preferences-utilisateur

```http
PUT /api/preferences-utilisateur
Authorization: Bearer <token>
Content-Type: application/json

{
  "colonnes_affichees": { "parcelles": ["nom", "surface_ha", "localisation"] },
  "colonnes_export": { "parcelles": ["nom", "surface_ha"] }
}
```

**Réponse 200 :** objet préférences mis à jour (upsert — `ON CONFLICT ... DO UPDATE`).

---

### POST /preferences-utilisateur/reset

Réinitialise les préférences de l'utilisateur connecté (`colonnes_affichees`/`colonnes_export` remis à `{}`).

```http
POST /api/preferences-utilisateur/reset
Authorization: Bearer <token>
```

---

## Référentiels

### GET /types-intervention

```http
GET /api/types-intervention
Authorization: Bearer <token>
```

**Réponse 200 :**

```json
[
  { "id": 1, "nom": "Taille", "couleur": "#27ae60" },
  { "id": 2, "nom": "Irrigation", "couleur": "#2980b9" },
  { "id": 3, "nom": "Traitement", "couleur": "#e74c3c" },
  { "id": 4, "nom": "Amendement", "couleur": "#f39c12" }
]
```

---

### GET /caveurs

```http
GET /api/caveurs
Authorization: Bearer <token>
```

**Réponse 200 :**

```json
[
  { "id": 1, "nom": "Dupont", "prenom": "Jean", "actif": true }
]
```

---

### GET /chiens

```http
GET /api/chiens
Authorization: Bearer <token>
```

**Réponse 200 :**

```json
[
  { "id": 1, "nom": "Truffe", "race": "Labrador", "caveur_id": 1, "actif": true }
]
```

---

### GET /zones-production

Liste des zones de production actives (référentiel utilisé notamment par le module Fournisseurs, champ `zone_production`).

```http
GET /api/zones-production
Authorization: Bearer <token>
```

**Réponse 200 :**

```json
[
  { "id": 1, "code": "PER", "nom": "Périgord", "departement": "24", "actif": true, "ordre_affichage": 1 }
]
```

---

### GET /zones-production/par-region

Zones groupées par région (agrégation JSON côté PostgreSQL).

```http
GET /api/zones-production/par-region
Authorization: Bearer <token>
```

**Réponse 200 :**

```json
[
  {
    "region": "Nouvelle-Aquitaine",
    "zones": [
      { "id": 1, "code": "PER", "nom": "Périgord", "departement": "24", "departements": ["24"] }
    ]
  }
]
```

---

## Utilisateurs

Endpoints de gestion des utilisateurs — réservés au rôle `admin`.

### GET /auth/users

```http
GET /api/auth/users
Authorization: Bearer <admin_token>
```

**Réponse 200 :**

```json
[
  {
    "id": 1,
    "email": "admin@truffiere.local",
    "nom": "Admin",
    "prenom": "Truffiere",
    "role": "admin",
    "is_active": true,
    "failed_login_attempts": 0,
    "locked_until": null,
    "last_login": "2026-05-14T14:00:00Z",
    "created_at": "2025-01-15T10:00:00Z"
  }
]
```

---

### POST /auth/users

```http
POST /api/auth/users
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "email": "collaborateur@truffiere.local",
  "password": "MotDePasseTemporaire!1",
  "nom": "Martin",
  "prenom": "Sophie",
  "role": "user"
}
```

---

### POST /auth/users/:id/unlock

Déverrouille un compte bloqué après 5 tentatives échouées.

```http
POST /api/auth/users/2/unlock
Authorization: Bearer <admin_token>
```

---

## Système

### GET /health

```http
GET /api/health
```

**Réponse 200 :**

```json
{ "status": "ok" }
```

---

## Bonnes pratiques client

### Intercepteur Axios recommandé

```javascript
// services/api.js
import axios from 'axios';

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL,
  timeout: 30000,
});

// Attacher le token à chaque requête
api.interceptors.request.use(config => {
  const token = getAccessToken();
  if (token) config.headers['Authorization'] = `Bearer ${token}`;
  return config;
});

// Refresh automatique
api.interceptors.response.use(
  res => res,
  async err => {
    if (err.response?.status === 401 && !err.config._retry) {
      err.config._retry = true;
      try {
        const { data } = await axios.post(
          `${process.env.REACT_APP_API_URL}/auth/refresh`,
          { refreshToken: getRefreshToken() }
        );
        setAccessToken(data.accessToken);
        setRefreshToken(data.refreshToken); // rotation
        err.config.headers['Authorization'] = `Bearer ${data.accessToken}`;
        return api(err.config);
      } catch {
        logout();
      }
    }
    return Promise.reject(err);
  }
);

export default api;
```

---

*Dernière mise à jour : mai 2026 — V8 (v2.0.2)*  
*Voir [`CHANGELOG.md`](CHANGELOG.md) pour l'historique complet des modifications.*
