# 📡 API Documentation - Gestion-Truffière

> Documentation complète des endpoints REST avec exemples de requêtes et réponses.

---

## Table des Matières

1. [Vue d'Ensemble](#vue-densemble)
2. [Authentication](#authentication)
3. [Parcelles](#parcelles)
4. [Arbres](#arbres)
5. [Interventions](#interventions)
6. [Récoltes](#récoltes)
7. [Fournisseurs & Achats](#fournisseurs--achats)
8. [Alertes & Notifications](#alertes--notifications)
9. [Rapports](#rapports)
10. [Erreurs & Status Codes](#erreurs--status-codes)

---

## Vue d'Ensemble

### Base URL
```
Production: https://api.gestion-truffiere.fr/api
Development: http://localhost:5000/api
```

### Headers Requis
```http
Content-Type: application/json
Authorization: Bearer <JWT_TOKEN>
```

### Formats de Réponse

**Succès (2xx)**
```json
{
  "success": true,
  "data": { /* ... */ },
  "message": "Operation completed successfully"
}
```

**Erreur (4xx/5xx)**
```json
{
  "success": false,
  "error": "ERROR_CODE",
  "message": "Description de l'erreur",
  "details": { /* ... */ }
}
```

---

## Authentication

### Login

**POST** `/auth/login`

**Request**
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password123"
  }'
```

**Response (200 OK)**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
      "id": "user_001",
      "email": "user@example.com",
      "firstName": "Jean",
      "lastName": "Dupont",
      "role": "farmer"
    }
  }
}
```

### Refresh Token

**POST** `/auth/refresh`

**Request**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Response (200 OK)**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

### Logout

**POST** `/auth/logout`

**Headers**
```http
Authorization: Bearer <JWT_TOKEN>
```

**Response (200 OK)**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

---

## Parcelles

### Liste Parcelles

**GET** `/parcelles`

**Query Parameters**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20)
- `status` (optional): Filter by status (active, archived)

**Request**
```bash
curl http://localhost:5000/api/parcelles?page=1&limit=20 \
  -H "Authorization: Bearer <TOKEN>"
```

**Response (200 OK)**
```json
{
  "success": true,
  "data": [
    {
      "id": "p_001",
      "nom": "Parcelle Nord",
      "surface_m2": 5000,
      "nombre_arbres": 500,
      "localisation": {
        "lat": 47.5023,
        "lng": -1.5435
      },
      "etat_general": "bon",
      "created_at": "2025-01-01T10:00:00Z",
      "updated_at": "2026-01-24T16:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 5
  }
}
```

### Détail Parcelle

**GET** `/parcelles/:id`

**Request**
```bash
curl http://localhost:5000/api/parcelles/p_001 \
  -H "Authorization: Bearer <TOKEN>"
```

**Response (200 OK)**
```json
{
  "success": true,
  "data": {
    "id": "p_001",
    "nom": "Parcelle Nord",
    "surface_m2": 5000,
    "nombre_arbres": 500,
    "localisation": {
      "lat": 47.5023,
      "lng": -1.5435
    },
    "etat_general": "bon",
    "sol_type": "calcaire",
    "drainage": "bon",
    "exposition": "sud-est",
    "interventions_count": 12,
    "arbres": [
      {
        "id": "a_001",
        "numero": "A1",
        "etat_sanitaire": "sain",
        "age_annees": 8
      }
    ],
    "created_at": "2025-01-01T10:00:00Z",
    "updated_at": "2026-01-24T16:00:00Z"
  }
}
```

### Créer Parcelle

**POST** `/parcelles`

**Request**
```json
{
  "nom": "Parcelle Sud",
  "surface_m2": 3500,
  "nombre_arbres": 350,
  "localisation": {
    "lat": 47.4950,
    "lng": -1.5500
  },
  "sol_type": "calcaire",
  "drainage": "bon",
  "exposition": "sud"
}
```

**Response (201 Created)**
```json
{
  "success": true,
  "data": {
    "id": "p_002",
    "nom": "Parcelle Sud",
    /* ... */
  },
  "message": "Parcelle created successfully"
}
```

### Mettre à jour Parcelle

**PATCH** `/parcelles/:id`

**Request**
```json
{
  "etat_general": "moyen",
  "drainage": "modéré"
}
```

**Response (200 OK)**
```json
{
  "success": true,
  "data": { /* ... */ },
  "message": "Parcelle updated successfully"
}
```

### Supprimer Parcelle

**DELETE** `/parcelles/:id`

**Response (200 OK)**
```json
{
  "success": true,
  "message": "Parcelle deleted successfully"
}
```

---

## Arbres

### Liste Arbres d'une Parcelle

**GET** `/parcelles/:parcelle_id/arbres`

**Response**
```json
{
  "success": true,
  "data": [
    {
      "id": "a_001",
      "parcelle_id": "p_001",
      "numero": "A1",
      "age_annees": 8,
      "etat_sanitaire": "sain",
      "variete": "Tuber melanosporum",
      "date_plantation": "2018-03-15",
      "dernier_rendement_kg": 2.5,
      "notes": "Excellent état",
      "created_at": "2025-01-01T10:00:00Z"
    }
  ]
}
```

### Créer Arbre

**POST** `/parcelles/:parcelle_id/arbres`

**Request**
```json
{
  "numero": "A501",
  "variete": "Tuber melanosporum",
  "date_plantation": "2018-03-15",
  "notes": "Plantation initiale"
}
```

**Response (201 Created)**
```json
{
  "success": true,
  "data": {
    "id": "a_002",
    /* ... */
  }
}
```

---

## Interventions

### Liste Interventions

**GET** `/interventions`

**Query Parameters**
- `parcelle_id` (optional): Filter by parcelle
- `type` (optional): traitement, maintenance, inspection, autres
- `date_from` (optional): ISO date
- `date_to` (optional): ISO date

**Request**
```bash
curl "http://localhost:5000/api/interventions?parcelle_id=p_001&type=traitement" \
  -H "Authorization: Bearer <TOKEN>"
```

**Response**
```json
{
  "success": true,
  "data": [
    {
      "id": "i_001",
      "parcelle_id": "p_001",
      "type": "traitement",
      "date": "2026-01-20T10:00:00Z",
      "description": "Traitement fongicide préventif",
      "produit": "Soufre",
      "quantite": 5,
      "unite": "kg",
      "cout": 125.50,
      "notes": "Bonne couverture de feuillage",
      "responsable": "Jean Dupont",
      "created_at": "2026-01-20T10:30:00Z"
    }
  ]
}
```

### Créer Intervention

**POST** `/interventions`

**Request**
```json
{
  "parcelle_id": "p_001",
  "type": "traitement",
  "date": "2026-01-25T10:00:00Z",
  "description": "Traitement contre le ver blanc",
  "produit": "Spinosad",
  "quantite": 3,
  "unite": "L",
  "cout": 85.00,
  "notes": "Application foliaire",
  "responsable": "Jean Dupont"
}
```

**Response (201 Created)**
```json
{
  "success": true,
  "data": {
    "id": "i_002",
    /* ... */
  },
  "message": "Intervention created successfully"
}
```

---

## Récoltes

### Liste Récoltes

**GET** `/recoltes`

**Query Parameters**
- `parcelle_id` (optional)
- `year` (optional): 2025, 2026, etc.

**Response**
```json
{
  "success": true,
  "data": [
    {
      "id": "r_001",
      "parcelle_id": "p_001",
      "date_recolte": "2025-12-15T10:00:00Z",
      "quantite_kg": 1250,
      "qualite": "extra",
      "prix_vente_kg": 1200,
      "revenus_totaux": 1500000,
      "notes": "Excellente récolte",
      "created_at": "2025-12-15T11:00:00Z"
    }
  ]
}
```

### Créer Récolte

**POST** `/recoltes`

**Request**
```json
{
  "parcelle_id": "p_001",
  "date_recolte": "2026-01-25T10:00:00Z",
  "quantite_kg": 850,
  "qualite": "première",
  "prix_vente_kg": 1150,
  "notes": "Récolte satisfaisante"
}
```

**Response (201 Created)**
```json
{
  "success": true,
  "data": {
    "id": "r_002",
    "quantite_kg": 850,
    "revenus_totaux": 977500,
    /* ... */
  }
}
```

---

## Fournisseurs & Achats

### Liste Fournisseurs

**GET** `/fournisseurs`

**Response**
```json
{
  "success": true,
  "data": [
    {
      "id": "f_001",
      "nom": "PhytoServices SA",
      "type_produit": "produits phytosanitaires",
      "contact": "contact@phytoservices.fr",
      "telephone": "+33 2 XX XX XX XX",
      "adresse": "123 Rue des Produits, 44000 Nantes",
      "ville": "Nantes",
      "code_postal": "44000",
      "conditions_paiement": "30 jours net",
      "created_at": "2025-01-01T10:00:00Z"
    }
  ]
}
```

### Créer Fournisseur

**POST** `/fournisseurs`

**Request**
```json
{
  "nom": "EcoAgriculture",
  "type_produit": "engrais organiques",
  "contact": "info@ecoagriculture.fr",
  "telephone": "+33 2 XX XX XX XX",
  "adresse": "456 Rue Écologique, 44300 Nantes",
  "ville": "Nantes",
  "code_postal": "44300",
  "conditions_paiement": "45 jours net"
}
```

**Response (201 Created)**
```json
{
  "success": true,
  "data": { /* ... */ }
}
```

### Liste Achats

**GET** `/achats`

**Query Parameters**
- `fournisseur_id` (optional)
- `date_from` (optional)
- `date_to` (optional)

**Response**
```json
{
  "success": true,
  "data": [
    {
      "id": "ac_001",
      "fournisseur_id": "f_001",
      "fournisseur_nom": "PhytoServices SA",
      "date_commande": "2026-01-20T10:00:00Z",
      "date_livraison": "2026-01-22T14:00:00Z",
      "produits": [
        {
          "nom": "Soufre micronisé",
          "quantite": 10,
          "unite": "kg",
          "prix_unitaire": 12.50,
          "total": 125.00
        }
      ],
      "cout_total": 125.00,
      "statut": "livré",
      "notes": "Livraison conforme",
      "created_at": "2026-01-20T10:30:00Z"
    }
  ]
}
```

### Créer Achat

**POST** `/achats`

**Request**
```json
{
  "fournisseur_id": "f_001",
  "date_commande": "2026-01-25T10:00:00Z",
  "produits": [
    {
      "nom": "Spinosad 48% EC",
      "quantite": 5,
      "unite": "L",
      "prix_unitaire": 95.00
    }
  ],
  "notes": "Commande urgente"
}
```

**Response (201 Created)**
```json
{
  "success": true,
  "data": {
    "id": "ac_002",
    "cout_total": 475.00,
    /* ... */
  }
}
```

---

## Alertes & Notifications

### Lister Alertes

**GET** `/alertes`

**Query Parameters**
- `severity` (optional): info, warning, error, critical
- `read` (optional): true, false
- `date_from` (optional)

**Response**
```json
{
  "success": true,
  "data": [
    {
      "id": "al_001",
      "type": "santé_arbre",
      "severité": "critical",
      "titre": "Arbre malade détecté",
      "message": "L'arbre A42 (parcelle p_001) présente des signes de maladie",
      "parcelle_id": "p_001",
      "date_alerte": "2026-01-24T14:30:00Z",
      "lue": false,
      "actions_suggérées": [
        "Inspection visuelle urgente",
        "Prélever échantillon pour diagnostic"
      ]
    }
  ]
}
```

### Marquer Alerte comme Lue

**PATCH** `/alertes/:id/read`

**Response**
```json
{
  "success": true,
  "message": "Alert marked as read"
}
```

### Créer Règle d'Alerte

**POST** `/alertes/regles`

**Request**
```json
{
  "nom": "Alerte Gel",
  "type": "meteo",
  "condition": "forecast_temp < 0 AND saison == 'hivernage'",
  "severité": "warning",
  "message": "Gel prévu, protéger les arbres",
  "active": true
}
```

**Response (201 Created)**
```json
{
  "success": true,
  "data": { /* ... */ }
}
```

---

## Rapports

### Générer Rapport Bilan Annuel

**POST** `/rapports/bilan-annuel`

**Request**
```json
{
  "parcelle_id": "p_001",
  "annee": 2025,
  "format": "pdf"
}
```

**Response (200 OK)**
```json
{
  "success": true,
  "data": {
    "fichier_url": "https://api.gestion-truffiere.fr/reports/bilan_p001_2025.pdf",
    "nom_fichier": "bilan_p001_2025.pdf",
    "taille_bytes": 125000,
    "date_generation": "2026-01-24T16:00:00Z"
  },
  "message": "Report generated successfully"
}
```

### Générer Rapport Sanitaire

**POST** `/rapports/rapport-sanitaire`

**Request**
```json
{
  "parcelle_id": "p_001",
  "date_debut": "2025-01-01",
  "date_fin": "2026-01-24",
  "format": "pdf"
}
```

**Response**
```json
{
  "success": true,
  "data": {
    "fichier_url": "https://api.gestion-truffiere.fr/reports/sanitaire_p001_2025.pdf",
    /* ... */
  }
}
```

### Lister Rapports Disponibles

**GET** `/rapports`

**Response**
```json
{
  "success": true,
  "data": [
    {
      "id": "rep_001",
      "type": "bilan-annuel",
      "parcelle_id": "p_001",
      "année": 2025,
      "url": "https://api.gestion-truffiere.fr/reports/bilan_p001_2025.pdf",
      "date_generation": "2025-12-31T18:00:00Z",
      "taille_kb": 125
    }
  ]
}
```

---

## Erreurs & Status Codes

### Status Codes

| Code | Signification |
|------|---------------|
| **200** | OK - Requête réussie |
| **201** | Created - Ressource créée |
| **204** | No Content - Suppression réussie |
| **400** | Bad Request - Paramètres invalides |
| **401** | Unauthorized - Token manquant/invalide |
| **403** | Forbidden - Accès non autorisé |
| **404** | Not Found - Ressource non trouvée |
| **409** | Conflict - Conflit (ex: doublons) |
| **422** | Unprocessable Entity - Validation échouée |
| **429** | Too Many Requests - Rate limit atteint |
| **500** | Internal Server Error - Erreur serveur |
| **503** | Service Unavailable - Maintenance |

### Codes d'Erreur Courants

```json
{
  "success": false,
  "error": "VALIDATION_ERROR",
  "message": "Validation failed",
  "details": {
    "parcelle_id": ["Parcelle not found"],
    "quantite_kg": ["Must be positive number"]
  }
}
```

```json
{
  "success": false,
  "error": "UNAUTHORIZED",
  "message": "Invalid or expired token"
}
```

```json
{
  "success": false,
  "error": "RATE_LIMIT",
  "message": "Too many requests",
  "retry_after_seconds": 60
}
```

---

## Pagination

Les endpoints listant des ressources supportent la pagination:

```bash
GET /api/parcelles?page=2&limit=10
```

**Response**
```json
{
  "success": true,
  "data": [ /* ... */ ],
  "pagination": {
    "page": 2,
    "limit": 10,
    "total": 45,
    "pages": 5,
    "has_more": true
  }
}
```

---

## Filtrage & Recherche

Certains endpoints supportent les filtres avancés:

```bash
GET /api/interventions?type=traitement&date_from=2026-01-01&date_to=2026-01-31
```

---

## Rate Limiting

- **Limite**: 1000 requêtes par 15 minutes
- **Headers de réponse**:
  - `X-RateLimit-Limit`: 1000
  - `X-RateLimit-Remaining`: 950
  - `X-RateLimit-Reset`: 1642956000

---

## Webhooks (Futur)

Les webhooks permettront de recevoir des notifications en temps réel:

```bash
POST /api/webhooks
{
  "url": "https://votre-app.com/webhooks/truffiere",
  "events": ["intervention.created", "alerte.critical"],
  "active": true
}
```

---

**API Version**: 1.0  
**Dernière mise à jour**: Janvier 2026  
**Support**: [support@gestion-truffiere.fr](mailto:support@gestion-truffiere.fr)