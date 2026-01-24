# 📡 API Documentation - Gestion-Truffière v6

> **Complete REST API documentation with all endpoints, examples, and error handling**

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Error Handling](#error-handling)
4. [Endpoints Index](#endpoints-index)
5. [Auth Endpoints](#auth-endpoints)
6. [Parcelles (Plots)](#parcelles-endpoints)
7. [Arbres (Trees)](#arbres-endpoints)
8. [Récoltes (Harvests)](#recoltes-endpoints)
9. [Interventions](#interventions-endpoints)
10. [Statistics](#statistics-endpoints)
11. [Users Management](#users-management-endpoints)
12. [Rate Limiting & Pagination](#rate-limiting--pagination)
13. [Best Practices](#best-practices)

---

## Overview

### Base URL

```
Production:   https://api.example.com/api
Development:  http://localhost:5000/api
Testing:      http://localhost:5000/api
```

### Protocol

- **Protocol** : HTTPS (production)
- **Format** : JSON
- **Charset** : UTF-8
- **Timeout** : 30 seconds

### API Version

```http
X-API-Version: 1.0
X-API-Build: 6.0.0
```

### Response Format

All responses are JSON:

```json
{
  "status": "success",
  "data": { ... },
  "timestamp": "2026-01-24T17:30:00Z",
  "version": "1.0"
}
```

---

## Authentication

### JWT Bearer Token

The API uses **JWT (JSON Web Tokens)** for authentication.

#### How it works

1. User logs in with email/password
2. Backend returns `accessToken` + `refreshToken`
3. Client includes `accessToken` in subsequent requests
4. When token expires, use `refreshToken` to get new `accessToken`

#### Token Headers

```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
X-API-Key: optional-api-key
```

#### Token Format

```javascript
// Access Token (expires in 1 hour)
{
  "userId": 1,
  "email": "admin@example.com",
  "role": "admin",
  "iat": 1642086600,
  "exp": 1642090200
}

// Refresh Token (expires in 7 days)
{
  "userId": 1,
  "type": "refresh",
  "iat": 1642086600,
  "exp": 1642691400
}
```

#### Token Management

```javascript
// Store tokens in client
localStorage.setItem('accessToken', response.accessToken);
localStorage.setItem('refreshToken', response.refreshToken);

// Use in requests
const config = {
  headers: {
    'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
  }
};
axios.get('/api/parcelles', config);

// Automatic token refresh
if (response.status === 401) {
  // Token expired, refresh it
  const newToken = await refreshToken();
  // Retry original request
}
```

---

## Error Handling

### Status Codes

| Code | Meaning | Action |
|------|---------|--------|
| **200** | OK | Request successful |
| **201** | Created | Resource created |
| **204** | No Content | Delete successful |
| **400** | Bad Request | Invalid input |
| **401** | Unauthorized | Missing/invalid token |
| **403** | Forbidden | Insufficient permissions |
| **404** | Not Found | Resource not found |
| **409** | Conflict | Resource already exists |
| **500** | Server Error | Internal server error |
| **503** | Service Unavailable | Maintenance mode |

### Error Response Format

```json
{
  "status": "error",
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input data",
    "details": [
      {
        "field": "email",
        "message": "Must be valid email"
      }
    ]
  },
  "timestamp": "2026-01-24T17:30:00Z"
}
```

### Common Error Codes

```javascript
// Auth errors
"INVALID_CREDENTIALS"      // Wrong email/password
"TOKEN_EXPIRED"            // JWT expired
"TOKEN_INVALID"            // Invalid JWT
"UNAUTHORIZED"             // Missing authorization
"INSUFFICIENT_PERMISSIONS" // User doesn't have permission

// Validation errors
"VALIDATION_ERROR"         // Input validation failed
"REQUIRED_FIELD"           // Missing required field
"INVALID_FORMAT"           // Invalid data format
"DUPLICATE_ENTRY"          // Resource already exists

// Server errors
"DATABASE_ERROR"           // Database connection error
"INTERNAL_ERROR"           // Unexpected server error
"SERVICE_UNAVAILABLE"      // Service in maintenance
```

### Error Handling Example

```javascript
try {
  const response = await axios.post('/api/parcelles', data);
  console.log('Success:', response.data);
} catch (error) {
  if (error.response) {
    // Server responded with error
    switch (error.response.status) {
      case 400:
        console.log('Validation error:', error.response.data.error.details);
        break;
      case 401:
        console.log('Need to re-login');
        // Refresh token or redirect to login
        break;
      case 404:
        console.log('Resource not found');
        break;
      default:
        console.log('Server error:', error.response.data.error.message);
    }
  } else if (error.request) {
    console.log('No response from server');
  } else {
    console.log('Error:', error.message);
  }
}
```

---

## Endpoints Index

### Authentication

```
POST   /auth/login              - User login
POST   /auth/logout             - User logout
POST   /auth/refresh            - Refresh JWT token
POST   /auth/register           - Register new user
POST   /auth/change-password    - Change password
```

### Parcelles (Plots)

```
GET    /parcelles               - List all plots
GET    /parcelles/:id           - Get plot details
GET    /parcelles/search        - Search plots
POST   /parcelles               - Create new plot
PUT    /parcelles/:id           - Update plot
DELETE /parcelles/:id           - Delete plot
GET    /parcelles/:id/arbres    - Get trees in plot
GET    /parcelles/:id/stats     - Get plot statistics
```

### Arbres (Trees)

```
GET    /arbres                  - List all trees
GET    /arbres/:id              - Get tree details
POST   /arbres                  - Create new tree
PUT    /arbres/:id              - Update tree
DELETE /arbres/:id              - Delete tree
GET    /arbres/search           - Search trees
GET    /arbres/:id/sante        - Get tree health
GET    /arbres/:id/historique   - Get tree history
```

### Récoltes (Harvests)

```
GET    /recoltes               - List all harvests
GET    /recoltes/:id           - Get harvest details
POST   /recoltes               - Record harvest
PUT    /recoltes/:id           - Update harvest
DELETE /recoltes/:id           - Delete harvest
GET    /recoltes/parcelle/:id  - Get harvests by plot
GET    /recoltes/stats         - Harvest statistics
```

### Interventions

```
GET    /interventions          - List all interventions
GET    /interventions/:id      - Get intervention details
POST   /interventions          - Create intervention
PUT    /interventions/:id      - Update intervention
DELETE /interventions/:id      - Delete intervention
GET    /interventions/search   - Search interventions
GET    /interventions/stats    - Intervention statistics
```

### Statistics

```
GET    /statistiques           - Get dashboard stats
GET    /statistiques/recoltes  - Harvest statistics
GET    /statistiques/arbres    - Tree health stats
GET    /statistiques/sante     - Health status overview
GET    /statistiques/rendement - Yield analysis
GET    /statistiques/cout      - Cost analysis
```

### Users Management (Admin only)

```
GET    /users                  - List all users
GET    /users/:id              - Get user details
POST   /users                  - Create new user
PUT    /users/:id              - Update user
DELETE /users/:id              - Delete user
GET    /users/current          - Get current user
GET    /users/:id/activity     - User activity log
```

### System

```
GET    /health                 - Health check
GET    /version                - API version
GET    /status                 - System status
```

---

## Auth Endpoints

### POST /auth/login

**Login user and get JWT tokens**

#### Request

```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "admin@example.com",
  "password": "SecurePassword123!"
}
```

#### Response (200 OK)

```json
{
  "status": "success",
  "data": {
    "user": {
      "id": 1,
      "email": "admin@example.com",
      "nom": "Admin",
      "prenom": "User",
      "role": "admin",
      "created_at": "2026-01-09T10:00:00Z"
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsImVtYWlsIjoiYWRtaW5AZXhhbXBsZS5jb20iLCJyb2xlIjoiYWRtaW4iLCJpYXQiOjE2NDIwODY2MDAsImV4cCI6MTY0MjA5MDIwMH0.abc123xyz",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsInR5cGUiOiJyZWZyZXNoIiwiaWF0IjoxNjQyMDg2NjAwLCJleHAiOjE2NDI2OTE0MDB9.def456uvw",
    "expiresIn": 3600
  },
  "timestamp": "2026-01-24T17:30:00Z"
}
```

#### Errors

```json
// 400 Bad Request
{
  "status": "error",
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Email and password are required"
  }
}

// 401 Unauthorized
{
  "status": "error",
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "Invalid email or password"
  }
}
```

#### cURL Example

```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "SecurePassword123!"
  }'
```

---

### POST /auth/refresh

**Get new access token using refresh token**

#### Request

```http
POST /api/auth/refresh
Content-Type: application/json

{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

#### Response (200 OK)

```json
{
  "status": "success",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsImVtYWlsIjoiYWRtaW5AZXhhbXBsZS5jb20iLCJyb2xlIjoiYWRtaW4iLCJpYXQiOjE2NDIwODcyMDAsImV4cCI6MTY0MjA5MDgwMH0.new123xyz",
    "expiresIn": 3600
  },
  "timestamp": "2026-01-24T17:31:00Z"
}
```

---

### POST /auth/logout

**Logout user (invalidate tokens)**

#### Request

```http
POST /api/auth/logout
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

#### Response (200 OK)

```json
{
  "status": "success",
  "message": "Logged out successfully"
}
```

---

## Parcelles Endpoints

### GET /parcelles

**List all plots with pagination**

#### Request

```http
GET /api/parcelles?page=1&limit=20&sort=nom&order=asc
Authorization: Bearer <token>
```

#### Query Parameters

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `page` | number | 1 | Page number |
| `limit` | number | 20 | Items per page (max 100) |
| `sort` | string | created_at | Sort field |
| `order` | string | desc | asc or desc |
| `search` | string | - | Search in nom/localisation |

#### Response (200 OK)

```json
{
  "status": "success",
  "data": {
    "items": [
      {
        "id": 1,
        "nom": "Parcelle 1",
        "localisation": "POINT(2.5 48.2)",
        "surface_hectares": 2.5,
        "created_at": "2026-01-09T10:00:00Z",
        "updated_at": "2026-01-24T15:30:00Z"
      },
      {
        "id": 2,
        "nom": "Parcelle 2",
        "localisation": "POINT(2.6 48.3)",
        "surface_hectares": 1.8,
        "created_at": "2026-01-10T10:00:00Z",
        "updated_at": "2026-01-20T14:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 2,
      "pages": 1
    }
  },
  "timestamp": "2026-01-24T17:30:00Z"
}
```

#### cURL Example

```bash
curl -X GET "http://localhost:5000/api/parcelles?page=1&limit=20" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

### GET /parcelles/:id

**Get detailed plot information**

#### Request

```http
GET /api/parcelles/1
Authorization: Bearer <token>
```

#### Response (200 OK)

```json
{
  "status": "success",
  "data": {
    "id": 1,
    "nom": "Parcelle 1",
    "localisation": "POINT(2.5 48.2)",
    "surface_hectares": 2.5,
    "composition": "Perigord noir, Alba",
    "created_at": "2026-01-09T10:00:00Z",
    "updated_at": "2026-01-24T15:30:00Z",
    "arbres_count": 125,
    "recoltes_count": 3,
    "interventions_count": 12,
    "stats": {
      "rendement_moyen": 2.5,
      "production_totale": 7.5,
      "couts_totaux": 3500
    }
  },
  "timestamp": "2026-01-24T17:30:00Z"
}
```

---

### POST /parcelles

**Create new plot**

#### Request

```http
POST /api/parcelles
Authorization: Bearer <token>
Content-Type: application/json

{
  "nom": "Parcelle Nouvelle",
  "localisation": "POINT(2.7 48.4)",
  "surface_hectares": 3.0,
  "composition": "Perigord noir, Alba, Scorzone"
}
```

#### Response (201 Created)

```json
{
  "status": "success",
  "data": {
    "id": 3,
    "nom": "Parcelle Nouvelle",
    "localisation": "POINT(2.7 48.4)",
    "surface_hectares": 3.0,
    "composition": "Perigord noir, Alba, Scorzone",
    "created_at": "2026-01-24T17:30:00Z",
    "updated_at": "2026-01-24T17:30:00Z"
  },
  "timestamp": "2026-01-24T17:30:00Z"
}
```

#### Validation Rules

```javascript
{
  "nom": "required|string|max:100|unique",
  "localisation": "required|geometry|point",
  "surface_hectares": "required|number|min:0.1|max:100",
  "composition": "string|max:500"
}
```

---

### PUT /parcelles/:id

**Update plot**

#### Request

```http
PUT /api/parcelles/1
Authorization: Bearer <token>
Content-Type: application/json

{
  "nom": "Parcelle 1 - Updated",
  "surface_hectares": 2.8
}
```

#### Response (200 OK)

```json
{
  "status": "success",
  "data": {
    "id": 1,
    "nom": "Parcelle 1 - Updated",
    "localisation": "POINT(2.5 48.2)",
    "surface_hectares": 2.8,
    "composition": "Perigord noir, Alba",
    "created_at": "2026-01-09T10:00:00Z",
    "updated_at": "2026-01-24T17:35:00Z"
  },
  "timestamp": "2026-01-24T17:35:00Z"
}
```

---

### DELETE /parcelles/:id

**Delete plot (cascade: deletes related trees, harvests, etc.)**

#### Request

```http
DELETE /api/parcelles/1
Authorization: Bearer <token>
```

#### Response (204 No Content)

```
No body, just status 204
```

#### Warning

⚠️ **This is destructive** - All related data will be deleted:
- All trees in the plot
- All harvests
- All interventions
- All related data

Consider archiving instead of deleting.

---

## Arbres Endpoints

### POST /arbres

**Create new tree**

#### Request

```http
POST /api/arbres
Authorization: Bearer <token>
Content-Type: application/json

{
  "parcelle_id": 1,
  "variete": "Perigord noir",
  "date_plantation": "2020-03-15",
  "etat_sanitaire": "sain",
  "localisation": "POINT(2.5 48.2)"
}
```

#### Response (201 Created)

```json
{
  "status": "success",
  "data": {
    "id": 500,
    "parcelle_id": 1,
    "variete": "Perigord noir",
    "date_plantation": "2020-03-15",
    "etat_sanitaire": "sain",
    "localisation": "POINT(2.5 48.2)",
    "created_at": "2026-01-24T17:30:00Z",
    "updated_at": "2026-01-24T17:30:00Z"
  }
}
```

#### Validation Rules

```javascript
{
  "parcelle_id": "required|exists:parcelles|integer",
  "variete": "required|string|max:100",
  "date_plantation": "required|date|before:today",
  "etat_sanitaire": "required|in:sain,malade,traitement,other",
  "localisation": "geometry|point"
}
```

---

### GET /arbres/:id/sante

**Get tree health status**

#### Request

```http
GET /api/arbres/500/sante
Authorization: Bearer <token>
```

#### Response (200 OK)

```json
{
  "status": "success",
  "data": {
    "arbre_id": 500,
    "etat_actuel": "sain",
    "dernier_traitement": "2026-01-20",
    "maladies_historique": [
      {
        "nom": "Puceron",
        "date_detection": "2025-08-15",
        "date_traitement": "2025-08-20",
        "traitement": "Insecticide biologique"
      }
    ],
    "score_sante": 9.2,
    "recommandations": [
      "Inspection prunier recommandée",
      "Traitement préventif avant printemps"
    ]
  }
}
```

---

## Récoltes Endpoints

### POST /recoltes

**Record harvest**

#### Request

```http
POST /api/recoltes
Authorization: Bearer <token>
Content-Type: application/json

{
  "parcelle_id": 1,
  "date_recolte": "2025-11-20",
  "quantite_kg": 125.5,
  "qualite": "Extra",
  "notes": "Récolte manuelle, bonnes conditions"
}
```

#### Response (201 Created)

```json
{
  "status": "success",
  "data": {
    "id": 45,
    "parcelle_id": 1,
    "date_recolte": "2025-11-20",
    "quantite_kg": 125.5,
    "qualite": "Extra",
    "notes": "Récolte manuelle, bonnes conditions",
    "created_at": "2026-01-24T17:30:00Z"
  }
}
```

#### Validation Rules

```javascript
{
  "parcelle_id": "required|exists:parcelles|integer",
  "date_recolte": "required|date|before_or_equal:today",
  "quantite_kg": "required|number|min:0|max:10000",
  "qualite": "required|in:Extra,1ère,2ème,Confection",
  "notes": "string|max:500"
}
```

---

## Interventions Endpoints

### POST /interventions

**Create new intervention**

#### Request

```http
POST /api/interventions
Authorization: Bearer <token>
Content-Type: application/json

{
  "parcelle_id": 1,
  "type": "traitement",
  "description": "Traitement insecticide préventif",
  "date_intervention": "2026-01-24",
  "responsable": "Jean Dupont",
  "coût": 250.50,
  "notes": "Application réussie, arbres en bonne santé"
}
```

#### Response (201 Created)

```json
{
  "status": "success",
  "data": {
    "id": 120,
    "parcelle_id": 1,
    "type": "traitement",
    "description": "Traitement insecticide préventif",
    "date_intervention": "2026-01-24",
    "responsable": "Jean Dupont",
    "coût": 250.50,
    "notes": "Application réussie, arbres en bonne santé",
    "created_at": "2026-01-24T17:30:00Z"
  }
}
```

#### Validation Rules

```javascript
{
  "parcelle_id": "required|exists:parcelles|integer",
  "type": "required|in:traitement,taille,engrais,autre",
  "description": "required|string|max:500",
  "date_intervention": "required|date|before_or_equal:today",
  "responsable": "string|max:100",
  "coût": "number|min:0|max:100000",
  "notes": "string|max:500"
}
```

---

## Statistics Endpoints

### GET /statistiques

**Get dashboard statistics**

#### Request

```http
GET /api/statistiques
Authorization: Bearer <token>
```

#### Response (200 OK)

```json
{
  "status": "success",
  "data": {
    "summary": {
      "total_parcelles": 8,
      "total_arbres": 1250,
      "arbres_sains": 1200,
      "arbres_malades": 50,
      "production_annuelle": 3125,
      "rendement_moyen": 2.5
    },
    "recoltes": {
      "total_kg_annee": 3125,
      "recoltes_count": 12,
      "moyenne_par_recolte": 260.42,
      "meilleure_recolte": 425
    },
    "sante": {
      "arbres_sains": 1200,
      "arbres_malades": 50,
      "taux_sante": 96
    },
    "finances": {
      "couts_totaux": 12500,
      "revenue_estimée": 25000,
      "marge_brute": 12500,
      "cout_par_kg": 4
    }
  }
}
```

---

## Users Management Endpoints

### GET /users (Admin only)

**List all users**

#### Request

```http
GET /api/users?page=1&limit=20
Authorization: Bearer <admin_token>
```

#### Response (200 OK)

```json
{
  "status": "success",
  "data": {
    "items": [
      {
        "id": 1,
        "email": "admin@example.com",
        "nom": "Admin",
        "prenom": "User",
        "role": "admin",
        "created_at": "2026-01-09T10:00:00Z",
        "last_login": "2026-01-24T17:30:00Z",
        "is_active": true
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 1,
      "pages": 1
    }
  }
}
```

---

### POST /users (Admin only)

**Create new user**

#### Request

```http
POST /api/users
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "email": "newuser@example.com",
  "password": "SecurePassword123!",
  "nom": "Dupont",
  "prenom": "Jean",
  "role": "user"
}
```

#### Response (201 Created)

```json
{
  "status": "success",
  "data": {
    "id": 2,
    "email": "newuser@example.com",
    "nom": "Dupont",
    "prenom": "Jean",
    "role": "user",
    "created_at": "2026-01-24T17:30:00Z",
    "is_active": true
  }
}
```

---

### PUT /users/:id (Admin only)

**Update user**

#### Request

```http
PUT /api/users/2
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "nom": "Dupont",
  "prenom": "Jean-Pierre",
  "role": "user",
  "is_active": true
}
```

#### Response (200 OK)

```json
{
  "status": "success",
  "data": {
    "id": 2,
    "email": "newuser@example.com",
    "nom": "Dupont",
    "prenom": "Jean-Pierre",
    "role": "user",
    "updated_at": "2026-01-24T17:45:00Z"
  }
}
```

---

### DELETE /users/:id (Admin only)

**Delete user**

#### Request

```http
DELETE /api/users/2
Authorization: Bearer <admin_token>
```

#### Response (204 No Content)

```
No body, just status 204
```

---

## Rate Limiting & Pagination

### Rate Limiting

API implements rate limiting to prevent abuse:

```
Limit: 1000 requests per hour per user
Window: 1 hour rolling window
```

#### Rate Limit Headers

```http
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1642090200
```

#### Rate Limit Exceeded Response

```http
HTTP/1.1 429 Too Many Requests

{
  "status": "error",
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests. Try again after 30 seconds."
  }
}
```

### Pagination

List endpoints support pagination:

```http
GET /api/parcelles?page=2&limit=50&sort=nom&order=asc
```

#### Pagination Parameters

| Param | Type | Default | Max | Description |
|-------|------|---------|-----|-------------|
| `page` | number | 1 | - | Page number (starts at 1) |
| `limit` | number | 20 | 100 | Items per page |
| `sort` | string | created_at | - | Field to sort by |
| `order` | string | desc | - | asc (ascending) or desc (descending) |

#### Pagination Response

```json
{
  "status": "success",
  "data": {
    "items": [ ... ],
    "pagination": {
      "page": 2,
      "limit": 50,
      "total": 150,
      "pages": 3,
      "hasMore": true,
      "hasBeforeFirst": true
    }
  }
}
```

#### Pagination Examples

```bash
# Get page 1 (default)
GET /api/parcelles

# Get page 2 with 50 items
GET /api/parcelles?page=2&limit=50

# Sort by nom ascending
GET /api/parcelles?sort=nom&order=asc

# All together
GET /api/parcelles?page=2&limit=50&sort=nom&order=asc
```

---

## Best Practices

### Client Best Practices

#### 1. Always handle errors

```javascript
try {
  const response = await api.get('/parcelles');
  // Handle success
} catch (error) {
  if (error.response?.status === 401) {
    // Redirect to login
  } else if (error.response?.status === 403) {
    // Show permission denied
  } else {
    // Handle other errors
  }
}
```

#### 2. Use token refresh automatically

```javascript
// Setup Axios interceptor
axios.interceptors.response.use(
  response => response,
  async error => {
    if (error.response?.status === 401) {
      // Try to refresh token
      const refreshed = await refreshToken();
      if (refreshed) {
        // Retry original request
        return axios.request(error.config);
      }
    }
    return Promise.reject(error);
  }
);
```

#### 3. Cache responses appropriately

```javascript
// Don't cache sensitive data
// Cache GET requests with ETags
const response = await api.get('/parcelles', {
  headers: { 'If-None-Match': etag }
});
```

#### 4. Use reasonable timeout

```javascript
const api = axios.create({
  baseURL: 'http://localhost:5000/api',
  timeout: 30000  // 30 seconds
});
```

### Server Best Practices

#### 1. Validate all input

The API validates:
- Required fields
- Data types
- Format (email, date, etc.)
- Relationships (foreign keys)
- Permissions (user can access resource)

#### 2. Use appropriate status codes

```javascript
// Good
if (!resource) return res.status(404).json(...);
if (!authorized) return res.status(403).json(...);
if (validation failed) return res.status(400).json(...);
if (created) return res.status(201).json(...);

// Bad
return res.status(200).json({ success: false, error: ... });
```

#### 3. Log important events

```javascript
logger.info('User login', { userId, email, timestamp });
logger.error('Database error', { error, query });
```

#### 4. Return consistent formats

```javascript
// Always use same structure
return res.status(200).json({
  status: 'success',
  data: { ... },
  timestamp: new Date().toISOString()
});
```

---

## Testing the API

### Using cURL

```bash
# Login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"password"}'

# Use token in requests
curl -X GET http://localhost:5000/api/parcelles \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Using Postman

1. Import this collection
2. Set environment variable `base_url` = http://localhost:5000/api
3. Set environment variable `token` after login
4. Run requests

### Using Insomnia

Same as Postman - import the collection and set variables.

---

## Changelog

### v1.0.0 - 2026-01-24
- ✅ Initial API documentation
- ✅ All endpoints documented
- ✅ Error handling documented
- ✅ Authentication explained
- ✅ Rate limiting documented
- ✅ Pagination documented
- ✅ Examples provided

---

**Last updated: 2026-01-24**  
**API Version: 1.0**  
**Status: Production Ready**
