# 🏠 Architecture - Gestion-Truffière

> Description complète de l'architecture technique, patterns et flux de données.

---

## Table des Matières

1. [Vue d'Ensemble](#vue-densemble)
2. [Stack Technologique](#stack-technologique)
3. [Architecture Backend](#architecture-backend)
4. [Architecture Frontend](#architecture-frontend)
5. [Schéma Base de Données](#schéma-base-de-données)
6. [Flux de Données](#flux-de-données)
7. [Sécurité](#sécurité)
8. [Performance](#performance)
9. [DevOps & Déploiement](#devops--déploiement)
10. [Monitoring & Logging](#monitoring--logging)

---

## Vue d'Ensemble

### Diagramme d'Architecture Globale

```
┌─────────────────────────────────────────────────────────────┐
│                     CLIENT LAYER                             │
├─────────────────────────────────────────────────────────────┤
│ Web (React)          │ PWA (Service Worker)  │ Mobile (RN)   │
│ - Dashboard          │ - Offline Sync        │ - iOS/Android │
│ - Parcelles UI       │ - Cache Management    │ - Native APIs │
│ - Reporting          │ - Background Sync     │ - Sensors     │
└────────────┬──────────────────┬──────────────────────┬──────┘
             │                  │                      │
        HTTP/HTTPS          WebSocket          Native Modules
             │                  │                      │
┌────────────▼──────────────────▼──────────────────────▼──────┐
│                    API GATEWAY LAYER                         │
├─────────────────────────────────────────────────────────────┤
│ - Rate Limiting        - Request Validation    - CORS        │
│ - Auth Middleware      - Response Formatting   - Logging     │
└────────────┬──────────────────────────────────────────────┬──┘
             │                                              │
┌────────────▼──────────────────────────────────────────────▼──┐
│                    APPLICATION LAYER                         │
├─────────────────────────────────────────────────────────────┤
│  Controllers  │ Services  │ Models  │ Middleware  │ Utils   │
│  - Auth       │ - Business│ - User  │ - Auth JWT  │ - Help  │
│  - Parcelles  │  Logic    │ - Alert │ - Validation│ - Valid │
│  - Reports    │           │ - Report│ - ErrorHdl  │ - Utils │
└────────────┬──────────────────────────────────────────────┬──┘
             │                                              │
┌────────────▼──────────────────────────────────────────────▼──┐
│                    DATA LAYER                                │
├─────────────────────────────────────────────────────────────┤
│  PostgreSQL/MySQL   │   Redis Cache   │   File Storage      │
│  - Schemas          │   - Sessions    │   - Uploads         │
│  - Relationships    │   - Queue       │   - Reports         │
│  - Indexes          │   - Cache       │   - Documents       │
└─────────────────────────────────────────────────────────────┘
```

---

## Stack Technologique

### Backend

```
┌─────────────────────────────────┐
│  Node.js / Express.js v4.x      │
├─────────────────────────────────┤
│ Authentification                 │
│ ├─ jsonwebtoken (JWT)           │
│ ├─ bcryptjs (password hashing)  │
│ └─ passport (auth strategies)   │
├─────────────────────────────────┤
│ Database ORM                     │
│ ├─ Sequelize / TypeORM          │
│ ├─ Migrations                    │
│ └─ Connection pooling            │
├─────────────────────────────────┤
│ Validation                       │
│ ├─ joi / yup                     │
│ ├─ express-validator            │
│ └─ Custom validators            │
├─────────────────────────────────┤
│ Async Jobs                       │
│ ├─ Bull (Redis queues)          │
│ ├─ node-cron (scheduled tasks)  │
│ └─ Worker processes             │
├─────────────────────────────────┤
│ File & PDF Generation           │
│ ├─ pdfkit                        │
│ ├─ sharp (image processing)     │
│ └─ multer (file uploads)        │
├─────────────────────────────────┤
│ Logging & Monitoring             │
│ ├─ winston                       │
│ ├─ morgan (HTTP logging)        │
│ └─ sentry (error tracking)      │
└─────────────────────────────────┘
```

### Frontend

```
┌─────────────────────────────────┐
│  React 18.x                     │
├─────────────────────────────────┤
│ State Management                 │
│ ├─ Context API                  │
│ ├─ useReducer (complex logic)   │
│ └─ Custom hooks                 │
├─────────────────────────────────┤
│ HTTP Client                      │
│ ├─ axios                         │
│ ├─ SWR / React Query            │
│ └─ Interceptors                 │
├─────────────────────────────────┤
│ UI Components                    │
│ ├─ Material-UI / Custom CSS     │
│ ├─ React-Select (dropdowns)    │
│ └─ React-Table (tables)        │
├─────────────────────────────────┤
│ Maps & Location                  │
│ ├─ Leaflet / React-Leaflet     │
│ ├─ Geolocation API              │
│ └─ Geocoding services           │
├─────────────────────────────────┤
│ Forms                            │
│ ├─ React Hook Form              │
│ ├─ yup / zod (validation)       │
│ └─ Custom form components       │
├─────────────────────────────────┤
│ Charts & Visualization           │
│ ├─ Chart.js / Recharts          │
│ ├─ D3.js (advanced)             │
│ └─ HTML Canvas                  │
├─────────────────────────────────┤
│ PWA Features                     │
│ ├─ Service Workers              │
│ ├─ IndexedDB                    │
│ └─ Web App Manifest             │
└─────────────────────────────────┘
```

### Database

```
PostgreSQL / MySQL 5.7+
├─ utf8mb4 encoding
├─ InnoDB engine (MySQL)
├─ Connection pooling (PgBouncer)
├─ Replication ready
├─ Backup system
└─ Monitoring
```

### Infrastructure

```
Docker / Kubernetes (optional)
├─ Docker Compose (development)
├─ Docker images (backend, frontend)
├─ CI/CD (GitHub Actions)
├─ Nginx (reverse proxy)
├─ Redis (session & cache)
└─ PostgreSQL (containerized)
```

---

## Architecture Backend

### Structure de Dossiers

```
backend/
├── src/
│   ├── config/
│   │   ├── database.js          # DB connection & pooling
│   │   ├── redis.js             # Redis cache config
│   │   ├── jwt.js               # JWT configuration
│   │   └── env.js               # Environment variables
│   │
│   ├── features/                # Feature-based organization
│   │   ├── auth/
│   │   │   ├── auth.controller.js
│   │   │   ├── auth.service.js
│   │   │   ├── auth.routes.js
│   │   │   └── auth.middleware.js
│   │   │
│   │   ├── parcelles/
│   │   │   ├── parcelles.controller.js
│   │   │   ├── parcelles.service.js
│   │   │   ├── Parcelle.model.js
│   │   │   ├── parcelles.routes.js
│   │   │   └── parcelles.validation.js
│   │   │
│   │   ├── interventions/
│   │   ├── recoltes/
│   │   ├── fournisseurs/
│   │   ├── achats/
│   │   ├── alertes/
│   │   ├── rapports/
│   │   └── notifications/
│   │
│   ├── middleware/
│   │   ├── auth.middleware.js   # JWT verification
│   │   ├── errorHandler.js      # Global error handling
│   │   ├── validation.js        # Request validation
│   │   ├── rateLimit.js         # Rate limiting
│   │   ├── cors.js              # CORS configuration
│   │   └── logging.js           # Request logging
│   │
│   ├── services/
│   │   ├── auth.service.js      # Authentication logic
│   │   ├── email.service.js     # Email sending
│   │   ├── pdf.service.js       # PDF generation
│   │   ├── storage.service.js   # File storage
│   │   ├── weather.service.js   # External weather API
│   │   └── notification.service.js
│   │
│   ├── jobs/
│   │   ├── healthCheck.job.js
│   │   ├── alerts.job.js
│   │   ├── cleanup.job.js
│   │   └── reports.job.js
│   │
│   ├── utils/
│   │   ├── logger.js            # Winston logger
│   │   ├── validators.js        # Custom validators
│   │   ├── errors.js            # Custom error classes
│   │   └── helpers.js           # Utility functions
│   │
│   ├── models/
│   │   └── (Sequelize/TypeORM models)
│   │
│   └── app.js                   # Express app setup
│
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
│
├── migrations/                   # Database migrations
├── seeds/                        # Database seeds
├── docker-compose.yml
├── Dockerfile
└── package.json
```

### Flux de Requête

```
1. Request arrives at API Gateway
   ↓
2. CORS & Rate Limit Check
   ↓
3. Request Logging
   ↓
4. Auth Middleware (JWT verification)
   ↓
5. Route Matching
   ↓
6. Controller receives request
   ↓
7. Input Validation
   ↓
8. Business Logic (Service)
   ↓
9. Database Operations (Model)
   ↓
10. Response Formatting
    ↓
11. Send Response to Client
    ↓
12. Log Response
```

---

## Architecture Frontend

### Structure de Dossiers

```
frontend/src/
├── components/
│   ├── layout/
│   │   ├── Header.jsx
│   │   ├── Sidebar.jsx
│   │   ├── Footer.jsx
│   │   └── MainLayout.jsx
│   │
│   ├── features/
│   │   ├── parcelles/
│   │   │   ├── ParcellesList.jsx
│   │   │   ├── ParcelleDetail.jsx
│   │   │   ├── ParcelleForm.jsx
│   │   │   └── ParcelleMap.jsx
│   │   │
│   │   ├── interventions/
│   │   ├── recoltes/
│   │   ├── rapports/
│   │   └── dashboard/
│   │
│   └── common/
│       ├── Button.jsx
│       ├── Card.jsx
│       ├── Modal.jsx
│       ├── Spinner.jsx
│       ├── Alerts.jsx
│       └── Toasts.jsx
│
├── pages/
│   ├── Home.jsx
│   ├── Dashboard.jsx
│   ├── Login.jsx
│   ├── NotFound.jsx
│   └── Unauthorized.jsx
│
├── services/
│   ├── api.js               # Axios configuration
│   ├── auth.service.js      # Auth API calls
│   ├── parcelles.service.js # Parcelles API calls
│   ├── interventions.service.js
│   └── storage.service.js   # LocalStorage/IndexedDB
│
├── hooks/
│   ├── useAuth.js           # Auth context hook
│   ├── useFetch.js          # Data fetching hook
│   ├── useForm.js           # Form handling
│   ├── useOnline.js         # Online/Offline detection
│   ├── useLocalStorage.js   # LocalStorage management
│   └── useNotifications.js  # Notifications hook
│
├── context/
│   ├── AuthContext.jsx      # Auth state management
│   ├── NotificationContext.jsx
│   └── AppContext.jsx       # Global app state
│
├── utils/
│   ├── formatters.js        # Date, currency formatting
│   ├── validators.js        # Form validation rules
│   ├── constants.js         # App constants
│   └── helpers.js           # Helper functions
│
├── styles/
│   ├── index.css            # Global styles
│   ├── variables.css        # CSS variables
│   └── responsive.css       # Media queries
│
├── pwa/
│   ├── serviceWorker.js     # Service Worker
│   ├── offlineManager.js    # Offline management
│   └── syncManager.js       # Background sync
│
└── App.jsx
```

---

## Schéma Base de Données

### Entités Principales

```
users
├─ id (PK)
├─ email (UNIQUE)
├─ password_hash
├─ first_name
├─ last_name
├─ role (farmer, admin, advisor)
├─ created_at
├─ updated_at
└─ deleted_at (soft delete)

parcelles
├─ id (PK)
├─ user_id (FK -> users)
├─ nom
├─ surface_m2
├─ nombre_arbres
├─ localisation (JSON: {lat, lng})
├─ etat_general (bon, moyen, mauvais)
├─ sol_type
├─ drainage
├─ exposition
├─ created_at
├─ updated_at
└─ deleted_at

arbres
├─ id (PK)
├─ parcelle_id (FK -> parcelles)
├─ numero (unique per parcelle)
├─ variete
├─ age_annees
├─ date_plantation
├─ etat_sanitaire (sain, suspect, malade)
├─ dernier_rendement_kg
├─ notes
├─ created_at
├─ updated_at
└─ deleted_at

interventions
├─ id (PK)
├─ parcelle_id (FK -> parcelles)
├─ type (traitement, maintenance, inspection)
├─ date
├─ description
├─ produit
├─ quantite
├─ unite (kg, L, pcs)
├─ cout
├─ responsable
├─ notes
├─ created_at
├─ updated_at
└─ deleted_at

recoltes
├─ id (PK)
├─ parcelle_id (FK -> parcelles)
├─ date_recolte
├─ quantite_kg
├─ qualite (extra, premiere, deuxieme)
├─ prix_vente_kg
├─ revenus_totaux
├─ notes
├─ created_at
├─ updated_at
└─ deleted_at

fournisseurs
├─ id (PK)
├─ user_id (FK -> users)
├─ nom
├─ type_produit
├─ contact
├─ telephone
├─ adresse
├─ ville
├─ code_postal
├─ conditions_paiement
├─ created_at
├─ updated_at
└─ deleted_at

achats
├─ id (PK)
├─ fournisseur_id (FK -> fournisseurs)
├─ date_commande
├─ date_livraison
├─ cout_total
├─ statut (commande, livré, facturé)
├─ produits (JSON array)
├─ notes
├─ created_at
├─ updated_at
└─ deleted_at

alertes
├─ id (PK)
├─ user_id (FK -> users)
├─ parcelle_id (FK -> parcelles) [nullable]
├─ type (sante_arbre, meteo, maintenance, etc)
├─ severite (info, warning, error, critical)
├─ titre
├─ message
├─ actions_suggerees (JSON array)
├─ lue (boolean)
├─ date_alerte
├─ created_at
└─ deleted_at

rapports
├─ id (PK)
├─ user_id (FK -> users)
├─ parcelle_id (FK -> parcelles) [nullable]
├─ type (bilan-annuel, sanitaire, finançier)
├─ url_fichier
├─ format (pdf, excel)
├─ annee [nullable]
├─ date_debut [nullable]
├─ date_fin [nullable]
├─ date_generation
├─ created_at
└─ deleted_at
```

### Indexes

```sql
-- Performance indexes
CREATE INDEX idx_parcelles_user_id ON parcelles(user_id);
CREATE INDEX idx_arbres_parcelle_id ON arbres(parcelle_id);
CREATE INDEX idx_interventions_parcelle_id ON interventions(parcelle_id);
CREATE INDEX idx_interventions_date ON interventions(date);
CREATE INDEX idx_recoltes_parcelle_id ON recoltes(parcelle_id);
CREATE INDEX idx_achats_fournisseur_id ON achats(fournisseur_id);
CREATE INDEX idx_alertes_user_id ON alertes(user_id);
CREATE INDEX idx_alertes_lue ON alertes(lue);
CREATE INDEX idx_rapports_user_id ON rapports(user_id);

-- Full-text search
CREATE FULLTEXT INDEX idx_search_parcelles ON parcelles(nom, description);
```

---

## Flux de Données

### Enregistrement Intervention

```
Frontend Form
     ↓
  Submit
     ↓
Validation Client-side
     ↓
API Call (axios)
     ↓
Auth Middleware (verify JWT)
     ↓
Validation Server-side
     ↓
InterventionService.create()
     ↓
Intervention.model.create() [DB]
     ↓
Check Alert Rules
     ↓
Queue Alert Notifications
     ↓
Response to Frontend
     ↓
UI Update (React)
     ↓
Cache Invalidation (SWR/React Query)
     ↓
Show Success Toast
```

### Génération Rapport

```
Frontend Request
     ↓
API: POST /rapports/bilan-annuel
     ↓
Queue Background Job
     ↓
Worker picks up job
     ↓
Fetch data from DB
     ↓
Generate PDF (pdfkit)
     ↓
Save to File Storage
     ↓
Update Report record
     ↓
Notify user via WebSocket
     ↓
Frontend shows "Report Ready"
```

---

## Sécurité

### Authentication

```
1. Login: Email + Password
   ↓
2. Verify credentials
   ↓
3. Generate JWT token (exp: 24h)
   ↓
4. Generate Refresh token (exp: 30d)
   ↓
5. Return both tokens to client
   ↓
6. Store in secure HTTP-only cookie / localStorage
   ↓
7. Include in Authorization header for subsequent requests
   ↓
8. Verify JWT signature on each request
```

### RBAC (Role-Based Access Control)

```
Roles:
├─ farmer (owner of parcelles)
├─ advisor (can view/suggest)
├─ admin (full access)
└─ guest (read-only)

Middleware checks:
- Is user authenticated?
- Does user have required role?
- Does user own the resource?
```

### Password Security

```
- Bcrypt hashing (10+ rounds)
- Minimum 12 characters
- Complexity rules enforced
- Password reset via email token (15min expiry)
- No password reset without email verification
```

### API Security

```
- HTTPS only (production)
- CORS configured (trusted domains only)
- Rate limiting (1000 req/15min)
- Input validation on all endpoints
- SQL injection prevention (parameterized queries)
- XSS protection (input sanitization)
- CSRF protection (token-based)
```

### Data Protection

```
- Soft deletes (data retention)
- Audit logs (who changed what, when)
- Encrypted sensitive fields
- Database backups (daily)
- SSL/TLS certificates
```

---

## Performance

### Frontend Optimization

```
✓ Code Splitting (React.lazy)
✓ Image Optimization (sharp, webp)
✓ Lazy Loading (Intersection Observer)
✓ Memoization (React.memo, useMemo)
✓ Virtual Scrolling (large lists)
✓ Service Worker Caching
✓ IndexedDB for offline data
✓ Minification & Compression
```

### Backend Optimization

```
✓ Connection Pooling
✓ Database Indexes
✓ Query Optimization
✓ Redis Caching
✓ Pagination (limit 100 items/page)
✓ Field Selection (projection)
✓ Async operations with Bull
✓ CDN for static assets
```

### Monitoring

```
Metrics:
- Response times (p50, p95, p99)
- Error rates
- Database query times
- Cache hit/miss rates
- Active connections
- Disk usage
- Memory usage

Tools:
- Prometheus (metrics)
- Grafana (dashboards)
- Jaeger (distributed tracing)
- ELK (logging)
```

---

## DevOps & Déploiement

### Development

```
docker-compose up
├─ backend (Node.js)
├─ frontend (React dev server)
├─ postgres (database)
├─ redis (cache & queue)
└─ pgadmin (DB UI)
```

### Staging

```
Git push to develop
  ↓
GitHub Actions CI/CD
  ↓
Run tests (Jest, Cypress)
  ↓
Build Docker images
  ↓
Deploy to staging server
  ↓
Run smoke tests
  ↓
Deploy to CDN
```

### Production

```
Git push to main
  ↓
GitHub Actions
  ↓
Run full test suite
  ↓
Build & tag Docker images
  ↓
Deploy to production cluster
  ↓
Health checks
  ↓
Smoke tests
  ↓
Notify team
```

### Infrastructure

```
- Docker (containerization)
- Docker Compose (dev environment)
- Kubernetes (production orchestration)
- Nginx (reverse proxy)
- PostgreSQL (database)
- Redis (cache & queue)
- S3 / MinIO (file storage)
```

---

## Monitoring & Logging

### Application Logs

```javascript
// Winston logger configuration
Logger.info('Event description', { userId: '123', action: 'create' });
Logger.error('Error occurred', { error: err, stack: err.stack });
Logger.warn('Warning message', { data: {} });
```

### Structured Logging Format

```json
{
  "timestamp": "2026-01-24T16:00:00Z",
  "level": "info",
  "service": "api",
  "message": "Intervention created",
  "userId": "user_001",
  "parcelleId": "p_001",
  "requestId": "req_abc123",
  "duration": 245
}
```

---

**Architecture Version**: 1.0  
**Last Updated**: January 2026  
**Maintainer**: Development Team