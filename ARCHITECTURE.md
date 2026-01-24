# 🏗️ Architecture Documentation - Gestion-Truffière v6

> **Comprehensive technical architecture guide covering system design, data flow, security, and deployment**

---

## 📋 Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Technology Stack](#technology-stack)
3. [System Layers](#system-layers)
4. [Directory Structure](#directory-structure)
5. [Data Flow](#data-flow)
6. [Database Schema](#database-schema)
7. [Security & Authentication](#security--authentication)
8. [Performance & Optimization](#performance--optimization)
9. [Deployment & DevOps](#deployment--devops)
10. [Monitoring & Logging](#monitoring--logging)
11. [Scalability](#scalability)
12. [Troubleshooting](#troubleshooting)

---

## Architecture Overview

### High-Level Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                      CLIENT BROWSER                          │
│                   (React.js + Leaflet)                       │
│                    HTML/CSS/JavaScript                       │
└──────────────────────┬──────────────────────────────────────┘
                       │
          ┌────────────┴─────────────┐
          │   HTTPS / WebSocket      │
          │   (Port 443/80)          │
          └────────────┬─────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│                   API GATEWAY                                │
│            (Load Balancer, Rate Limiting, CORS)              │
└────────────────────┬─────────────────────────────────────────┘
                     │
┌────────────────────▼──────────────────────────────────────┐
│                EXPRESS.JS SERVER                           │
│                   (Node.js Runtime)                        │
├────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────┐  │
│  │  Auth Layer  │  │ Routing      │  │ Middleware     │  │
│  │  (JWT)       │  │ Layer        │  │ (Validation)   │  │
│  └──────────────┘  └──────────────┘  └────────────────┘  │
│                                                            │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────┐  │
│  │  Controllers │  │  Services    │  │  Utils         │  │
│  │  (Handlers)  │  │  (Business   │  │  (Helpers,     │  │
│  │              │  │   Logic)     │  │   Constants)   │  │
│  └──────────────┘  └──────────────┘  └────────────────┘  │
└────────────────────┬─────────────────────────────────────┘
                     │
        ┌────────────┴──────────────┐
        │                           │
   ┌────▼────┐              ┌──────▼──────┐
   │ DATABASE │              │ CACHE LAYER │
   │ MySQL/   │              │ Redis       │
   │ PostgrSQL│              │ (Optional)  │
   │          │              │             │
   │ - Users  │              │ Sessions    │
   │ - Parcelles             │ Queries     │
   │ - Arbres │              │ Tokens      │
   │ - Récoltes              │             │
   │ - Interventions         │             │
   └──────────┘              └─────────────┘
```

### Architecture Patterns

**Pattern Used**: **MVC (Model-View-Controller)** + **Layered Architecture**

```
┌─────────────────────┐
│  PRESENTATION LAYER │  ← React Components, Forms, UI
│  (Frontend)         │
├─────────────────────┤
│  API LAYER          │  ← REST Endpoints, Routes
│  (Express.js)       │
├─────────────────────┤
│  BUSINESS LOGIC     │  ← Services, Controllers, Validation
│  LAYER              │
├─────────────────────┤
│  DATA ACCESS LAYER  │  ← Database Queries, Models
│  (Repositories)     │
├─────────────────────┤
│  DATA LAYER         │  ← MySQL/PostgreSQL, Cache
│  (Storage)          │
└─────────────────────┘
```

---

## Technology Stack

### Backend

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|----------|
| **Runtime** | Node.js | ≥14.x | JavaScript runtime |
| **Framework** | Express.js | 4.x | HTTP server & routing |
| **Language** | JavaScript (ES6+) | - | Main language |
| **Database** | MySQL/PostgreSQL | 5.7+/12+ | Data persistence |
| **Auth** | JWT (jsonwebtoken) | 8.x+ | Token-based auth |
| **Validation** | joi / express-validator | - | Input validation |
| **Logging** | winston / pino | - | Logging (optional) |
| **Testing** | Jest | 27.x+ | Unit & integration tests |
| **API Docs** | Swagger/OpenAPI | 3.0 | API documentation |

### Frontend

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|----------|
| **Library** | React | 18.x | UI library |
| **Language** | JavaScript (ES6+) | - | Main language |
| **HTTP Client** | Axios | 0.27+ | API communication |
| **State Mgmt** | Context API | - | Global state |
| **Maps** | Leaflet | 1.7+ | Interactive maps |
| **Styling** | CSS3 | - | Component styles |
| **Build Tool** | Webpack (CRA) | - | Module bundling |
| **Package Mgr** | npm / yarn | - | Dependency mgmt |
| **Charting** | Chart.js | 3.x+ | Data visualizations |

### Infrastructure

| Component | Technology | Purpose |
|-----------|-----------|----------|
| **Containerization** | Docker | Container images |
| **Orchestration** | Docker Compose | Multi-container apps |
| **Web Server** | Nginx/Apache | Reverse proxy |
| **Reverse Proxy** | Nginx | Load balancing |
| **SSL/TLS** | Let's Encrypt | HTTPS certificates |
| **CDN** | CloudFlare (optional) | Content delivery |
| **Version Control** | Git | Source management |
| **CI/CD** | GitHub Actions (optional) | Automation |

---

## System Layers

### 1. Presentation Layer (Frontend - React)

**Responsibility**: User interface and interaction

#### Components

```javascript
frontend/src/components/
├── Dashboard.js          // Main dashboard
├── Parcelles.js          // Plot management
├── Arbres.js             // Tree management
├── Recoltes.js           // Harvest tracking
├── Interventions.js      // Intervention logging
├── Statistiques.js       // Analytics
├── Carte.js              // Map visualization
├── Login.js              // Authentication UI
├── UserManagement.js     // User admin
└── ...                   // Other components
```

#### State Management (Context API)

```javascript
frontend/src/context/
├── AuthContext.js        // Authentication state
├── AppContext.js         // App-wide state
├── ThemeContext.js       // Dark/light mode
└── DataContext.js        // Cached data
```

#### Responsibilities

- ✅ Render UI components
- ✅ Handle user interactions
- ✅ Manage local component state
- ✅ Call API services
- ✅ Display data and errors
- ✅ Form validation (client-side)
- ✅ Route navigation

### 2. API Layer (Express.js Routes)

**Responsibility**: HTTP request/response handling

#### Route Structure

```javascript
backend/routes/
├── auth.js               // POST /auth/login, /auth/logout
├── parcelles.js          // GET/POST/PUT/DELETE /parcelles
├── arbres.js             // GET/POST/PUT/DELETE /arbres
├── recoltes.js           // GET/POST/PUT/DELETE /recoltes
├── interventions.js      // GET/POST/PUT/DELETE /interventions
├── statistiques.js       // GET /statistiques
├── users.js              // GET/POST/PUT/DELETE /users
└── health.js             // GET /health
```

#### Route Handler Pattern

```javascript
router.get('/parcelles', 
  middleware.authenticate,        // Check JWT
  middleware.validate(schema),    // Validate input
  controller.listParcelles        // Handle request
);
```

#### Responsibilities

- ✅ Route HTTP requests to handlers
- ✅ Apply middleware (auth, validation, logging)
- ✅ Parse request data
- ✅ Call service layer
- ✅ Return JSON responses
- ✅ Handle HTTP status codes

### 3. Business Logic Layer (Services)

**Responsibility**: Core application logic and business rules

#### Service Structure

```javascript
backend/services/
├── parcelleService.js
│   ├── getParcelle(id)
│   ├── createParcelle(data)
│   ├── updateParcelle(id, data)
│   ├── deleteParcelle(id)
│   └── searchParcelles(query)
├── arbreService.js
├── recolteService.js
├── interventionService.js
├── statistiquesService.js
└── authService.js
```

#### Example Service

```javascript
class ParcelleService {
  async getParcelle(id) {
    // 1. Validate input
    if (!id) throw new Error('ID required');
    
    // 2. Check authorization
    // (user can access this parcelle?)
    
    // 3. Query database
    const parcelle = await db.query(
      'SELECT * FROM parcelles WHERE id = ?',
      [id]
    );
    
    // 4. Transform data
    return this.transformParcelle(parcelle);
  }
  
  async createParcelle(data) {
    // 1. Validate input
    const validation = await schema.validate(data);
    if (validation.error) throw validation.error;
    
    // 2. Check business rules
    if (data.surface > 100) {
      throw new Error('Max surface is 100 hectares');
    }
    
    // 3. Create in database
    const result = await db.query(
      'INSERT INTO parcelles SET ?',
      [data]
    );
    
    // 4. Return created record
    return { id: result.insertId, ...data };
  }
}
```

#### Responsibilities

- ✅ Implement business logic
- ✅ Data validation
- ✅ Authorization checks
- ✅ Database operations coordination
- ✅ Error handling
- ✅ Transactions management
- ✅ Caching logic

### 4. Data Access Layer (Models)

**Responsibility**: Database interactions

#### Model Structure

```javascript
backend/models/
├── User.js
├── Parcelle.js
├── Arbre.js
├── Recolte.js
├── Intervention.js
├── Base.js              // Abstract base model
└── queries.js           // Reusable SQL queries
```

#### Example Model

```javascript
class Parcelle {
  static async findById(id) {
    const query = `
      SELECT * FROM parcelles 
      WHERE id = ? AND deleted_at IS NULL
    `;
    const [results] = await db.execute(query, [id]);
    return results[0];
  }
  
  static async create(data) {
    const query = `
      INSERT INTO parcelles 
      (nom, localisation, surface_hectares, created_at)
      VALUES (?, ST_GeomFromText(?), ?, NOW())
    `;
    const [result] = await db.execute(query, [
      data.nom,
      data.localisation,
      data.surface_hectares
    ]);
    return { id: result.insertId };
  }
}
```

#### Responsibilities

- ✅ SQL query construction
- ✅ Database connection management
- ✅ Result mapping
- ✅ Transaction handling
- ✅ Migration management

### 5. Data Layer (Database)

**Responsibility**: Data persistence and retrieval

#### Database Engine

- **Primary**: MySQL 5.7+ or PostgreSQL 12+
- **Development**: SQLite (optional)
- **Cache**: Redis (optional)

#### Database Features Used

```sql
-- Spatial queries (Geometry for GPS coordinates)
SELECT * FROM parcelles 
WHERE ST_Distance(localisation, target) < 1000;

-- Transactions
START TRANSACTION;
  INSERT INTO recoltes ...;
  UPDATE arbres ...;
COMMIT;

-- Indexes for performance
CREATE INDEX idx_parcelle_user ON parcelles(user_id);
CREATE INDEX idx_arbre_parcelle ON arbres(parcelle_id);

-- Views for complex queries
CREATE VIEW vue_statistiques AS
SELECT parcelle_id, COUNT(*) as arbres_count
FROM arbres
GROUP BY parcelle_id;
```

#### Responsibilities

- ✅ Store data persistently
- ✅ ACID transactions
- ✅ Data relationships
- ✅ Indexing for performance
- ✅ Backup and recovery

---

## Directory Structure

### Detailed Backend Structure

```
Gestion-Truffiere/
│
├── backend/
│   │
│   ├── server.js                 # Express app entry point
│   ├── package.json              # npm dependencies
│   ├── .env.example              # Env template
│   ├── Dockerfile                # Docker image
│   │
│   ├── /config
│   │   ├── database.js           # DB connection config
│   │   ├── security.js           # CORS, headers
│   │   └── constants.js          # App constants
│   │
│   ├── /middleware
│   │   ├── authenticate.js       # JWT verification
│   │   ├── authorize.js          # Role checking
│   │   ├── validate.js           # Input validation
│   │   ├── errorHandler.js       # Error handling
│   │   └── logging.js            # Request logging
│   │
│   ├── /routes
│   │   ├── auth.js               # Auth endpoints
│   │   ├── parcelles.js          # Parcelles CRUD
│   │   ├── arbres.js             # Arbres CRUD
│   │   ├── recoltes.js           # Recoltes CRUD
│   │   ├── interventions.js      # Interventions CRUD
│   │   ├── statistiques.js       # Stats endpoints
│   │   ├── users.js              # Users CRUD (admin)
│   │   ├── index.js              # Route aggregator
│   │   └── health.js             # Health check
│   │
│   ├── /controllers
│   │   ├── authController.js
│   │   ├── parcelleController.js
│   │   ├── arbreController.js
│   │   ├── recolteController.js
│   │   ├── interventionController.js
│   │   ├── statistiquesController.js
│   │   └── userController.js
│   │
│   ├── /services
│   │   ├── authService.js
│   │   ├── parcelleService.js
│   │   ├── arbreService.js
│   │   ├── recolteService.js
│   │   ├── interventionService.js
│   │   ├── statistiquesService.js
│   │   └── userService.js
│   │
│   ├── /models
│   │   ├── User.js
│   │   ├── Parcelle.js
│   │   ├── Arbre.js
│   │   ├── Recolte.js
│   │   ├── Intervention.js
│   │   ├── Base.js
│   │   └── index.js
│   │
│   ├── /utils
│   │   ├── tokenUtils.js         # JWT operations
│   │   ├── passwordUtils.js      # Hashing
│   │   ├── dateUtils.js          # Date helpers
│   │   ├── validators.js         # Validation functions
│   │   ├── errorMessages.js      # Error constants
│   │   └── logger.js             # Logging setup
│   │
│   ├── /migrations
│   │   ├── 001_initial_schema.sql
│   │   ├── 002_add_users.sql
│   │   └── migrate.js            # Migration runner
│   │
│   ├── /tests
│   │   ├── unit/
│   │   │   ├── services/
│   │   │   └── models/
│   │   ├── integration/
│   │   │   └── api/
│   │   └── setup.js              # Test configuration
│   │
│   └── /docs
│       └── API_SWAGGER.json      # Swagger/OpenAPI spec
│
├── frontend/
│   │
│   ├── package.json              # npm dependencies
│   ├── package-lock.json
│   ├── Dockerfile                # Docker image
│   ├── .env.example              # Env template
│   │
│   ├── /public
│   │   ├── index.html            # HTML template
│   │   ├── favicon.ico           # App icon
│   │   └── manifest.json         # PWA manifest
│   │
│   └── /src
│       ├── index.js              # React entry point
│       ├── App.js                # Root component
│       ├── App.css               # Global styles
│       ├── index.css
│       │
│       ├── /components           # React components
│       │   ├── Dashboard.js
│       │   ├── Parcelles.js
│       │   ├── Arbres.js
│       │   ├── Recoltes.js
│       │   ├── Interventions.js
│       │   ├── Statistiques.js
│       │   ├── Previsions.js
│       │   ├── Carte.js
│       │   ├── WeatherWidget.js
│       │   ├── GlobalSearch.js
│       │   ├── Historique.js
│       │   ├── Login.js
│       │   ├── UserManagement.js
│       │   ├── ChangePassword.js
│       │   ├── Parametres.js
│       │   ├── Commercial.js
│       │   └── CSVImportModal.js
│       │
│       ├── /services
│       │   ├── api.js            # Axios instance
│       │   ├── axiosConfig.js    # Axios config
│       │   └── endpoints.js      # API endpoints
│       │
│       ├── /context
│       │   ├── AuthContext.js
│       │   ├── AppContext.js
│       │   └── ThemeContext.js
│       │
│       ├── /hooks
│       │   ├── useAuth.js
│       │   ├── useFetch.js
│       │   ├── useColumnSettings.js
│       │   └── useLocalStorage.js
│       │
│       └── /utils
│           ├── csvImport.js
│           ├── pdfExport.js
│           ├── validators.js
│           ├── formatters.js
│           ├── constants.js
│           └── helpers.js
│
├── database/
│   ├── init-db.sql               # Schema + seed data
│   ├── migrations/
│   │   ├── 001_initial_schema.sql
│   │   ├── 002_add_indexes.sql
│   │   └── migrate.js
│   └── backups/
│       └── backup_2026-01-24.sql
│
├── docker-compose.yml            # Compose orchestration
│
├── .gitignore                    # Git ignore rules
├── .env.example                  # Env template
├── LICENSE                       # MIT License
├── README.md                     # Main documentation
├── API.md                        # API documentation
├── ARCHITECTURE.md               # This file
├── ROADMAP_V6_FEATURES.md       # Feature roadmap
└── CHANGELOG.md                  # Version history
```

---

## Data Flow

### Request/Response Cycle

```
1. USER INTERACTION
   └─ User clicks button / fills form in React component

2. FRONTEND PROCESSING
   └─ onClick handler triggered
   └─ Form validation (client-side)
   └─ Call API service (e.g., api.post('/parcelles', data))

3. HTTP REQUEST
   ├─ Method: POST
   ├─ URL: /api/parcelles
   ├─ Headers: { Authorization: "Bearer <JWT_TOKEN>" }
   └─ Body: { nom: "Parcelle 1", ... }

4. SERVER PROCESSING
   ├─ Route matching: Find POST /parcelles handler
   ├─ Middleware chain execution:
   │  ├─ Authentication: Verify JWT token
   │  ├─ Validation: Check request body
   │  ├─ Authorization: Verify user permissions
   │  └─ Logging: Log the request
   ├─ Controller execution:
   │  ├─ Parse request data
   │  ├─ Call service layer
   │  └─ Handle service response
   └─ Service execution:
      ├─ Business logic (validation, calculations)
      ├─ Database transaction
      │  ├─ INSERT into database
      │  ├─ Return inserted record
      │  └─ COMMIT transaction
      └─ Return result to controller

5. HTTP RESPONSE
   ├─ Status: 201 Created
   ├─ Headers: { Content-Type: application/json }
   └─ Body: { status: "success", data: {...}, timestamp: "..." }

6. FRONTEND DISPLAY
   ├─ API response received
   ├─ Update React state
   ├─ Component re-renders
   ├─ Show success notification
   └─ Update UI with new data
```

### Data Flow Diagram

```
┌──────────────────────┐
│  React Component     │
│  (Dashboard)         │
└──────┬───────────────┘
       │ onChange/onClick
       │
       ▼
┌──────────────────────┐
│  API Service         │
│  (Axios)             │
│  api.post(..., data) │
└──────┬───────────────┘
       │ HTTP POST /api/parcelles
       │ + JWT Token
       │
       ▼
┌──────────────────────────────────┐
│  Express Route Handler           │
│  /api/parcelles (POST)           │
└──────┬───────────────────────────┘
       │
       ├──► Middleware.authenticate
       │    └─ Verify JWT
       │
       ├──► Middleware.validate
       │    └─ Check input schema
       │
       ├──► Middleware.authorize
       │    └─ Check permissions
       │
       ▼
┌──────────────────────────────────┐
│  Controller                      │
│  parcelleController.create()     │
└──────┬───────────────────────────┘
       │ Call service
       │
       ▼
┌──────────────────────────────────┐
│  Service                         │
│  parcelleService.create(data)    │
├──────────────────────────────────┤
│ 1. Validate business rules       │
│ 2. Transform input data          │
│ 3. Call model layer              │
└──────┬───────────────────────────┘
       │
       ▼
┌──────────────────────────────────┐
│  Model / Database Query          │
│  Parcelle.create()               │
│  INSERT INTO parcelles ...       │
└──────┬───────────────────────────┘
       │
       ▼
┌──────────────────────────────────┐
│  Database (MySQL/PostgreSQL)     │
│ INSERT parcelle data             │
└──────┬───────────────────────────┘
       │
       ▼
┌──────────────────────────────────┐
│  Return Result                   │
│  { id: 1, nom: "...", ... }     │
│  (unwound through layers)        │
└──────┬───────────────────────────┘
       │
       ▼
┌──────────────────────────────────┐
│  HTTP Response                   │
│  201 Created                     │
│  { status: "success", data: ... }│
└──────┬───────────────────────────┘
       │
       ▼
┌──────────────────────────────────┐
│  React Component                 │
│  - Receive response              │
│  - Update state                  │
│  - Re-render UI                  │
│  - Show success toast            │
└──────────────────────────────────┘
```

---

## Database Schema

### Entity Relationship Diagram

```
┌─────────────┐
│   USERS     │
├─────────────┤
│ id (PK)     │──┐
│ email       │  │
│ password    │  │ 1
│ nom         │  │
│ prenom      │  │
│ role        │  └────┐
│ created_at  │       │
└─────────────┘       │
                      │ N
┌──────────────┐      │
│  PARCELLES   │◄─────┘
├──────────────┤
│ id (PK)      │────┐
│ user_id (FK) │    │ 1
│ nom          │    │
│ localisation │    │ N
│ surface      │    │
│ created_at   │    └─────┐
└──────────────┘          │
                          │
┌──────────────┐          │
│   ARBRES     │◄─────────┘
├──────────────┤
│ id (PK)      │────┐
│ parcelle_id (FK) │ 1
│ variete      │    │ N
│ date_plant   │    │
│ etat_sanitaire   └─────┐
│ created_at   │        │
└──────────────┘        │
                        │
        ┌───────────────┴───────────────┐
        │                               │
┌───────▼────────┐         ┌────────────▼──────┐
│   RECOLTES     │         │  INTERVENTIONS    │
├────────────────┤         ├───────────────────┤
│ id (PK)        │         │ id (PK)           │
│ parcelle_id(FK)│         │ parcelle_id (FK)  │
│ date_recolte   │         │ type              │
│ quantite_kg    │         │ description       │
│ qualite        │         │ date_intervention │
│ created_at     │         │ coût              │
└────────────────┘         │ created_at        │
                           └───────────────────┘

                        ┌──────────────┐
                        │ FOURNISSEURS │ (TODO)
                        ├──────────────┤
                        │ id (PK)      │────┐
                        │ nom          │    │ 1
                        │ contact      │    │ N
                        │ email        │    │
                        │ telephone    │    └──────┐
                        │ created_at   │           │
                        └──────────────┘           │
                                                   │
                                        ┌──────────▼──────┐
                                        │    ACHATS       │
                                        ├─────────────────┤
                                        │ id (PK)         │
                                        │ fournisseur_id(FK)
                                        │ produit         │
                                        │ quantité        │
                                        │ prix_unitaire   │
                                        │ date_achat      │
                                        │ created_at      │
                                        └─────────────────┘
```

### Key Tables

#### Users Table

```sql
CREATE TABLE users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  nom VARCHAR(100) NOT NULL,
  prenom VARCHAR(100) NOT NULL,
  role ENUM('admin', 'user', 'viewer') DEFAULT 'user',
  is_active BOOLEAN DEFAULT TRUE,
  last_login TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_email (email),
  INDEX idx_role (role)
);
```

#### Parcelles Table

```sql
CREATE TABLE parcelles (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  nom VARCHAR(255) NOT NULL,
  localisation POINT NOT NULL,  -- GEOMETRY type for GPS
  surface_hectares DECIMAL(6, 2) NOT NULL,
  composition VARCHAR(500),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id),
  SPATIAL INDEX idx_localisation (localisation)
);
```

#### Arbres Table

```sql
CREATE TABLE arbres (
  id INT PRIMARY KEY AUTO_INCREMENT,
  parcelle_id INT NOT NULL,
  variete VARCHAR(100) NOT NULL,
  date_plantation DATE NOT NULL,
  etat_sanitaire ENUM('sain', 'malade', 'traitement') DEFAULT 'sain',
  localisation POINT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (parcelle_id) REFERENCES parcelles(id) ON DELETE CASCADE,
  INDEX idx_parcelle_id (parcelle_id),
  INDEX idx_etat_sanitaire (etat_sanitaire)
);
```

---

## Security & Authentication

### JWT Authentication Flow

```
1. LOGIN REQUEST
   POST /api/auth/login
   {
     "email": "user@example.com",
     "password": "password"
   }

2. SERVER PROCESSING
   ├─ Find user by email
   ├─ Hash provided password
   ├─ Compare with stored hash
   └─ If match: Generate JWT

3. JWT TOKENS RETURNED
   ├─ Access Token (exp: 1 hour)
   │  {
   │    "userId": 1,
   │    "email": "user@example.com",
   │    "role": "admin",
   │    "iat": 1642086600,
   │    "exp": 1642090200
   │  }
   └─ Refresh Token (exp: 7 days)
      {
        "userId": 1,
        "type": "refresh",
        "iat": 1642086600,
        "exp": 1642691400
      }

4. CLIENT STORES TOKENS
   localStorage.setItem('accessToken', token)
   localStorage.setItem('refreshToken', token)

5. SUBSEQUENT REQUESTS
   GET /api/parcelles
   Authorization: Bearer <accessToken>

6. SERVER VERIFICATION
   ├─ Extract token from header
   ├─ Verify signature (using JWT_SECRET)
   ├─ Check expiration
   └─ If valid: Allow request

7. TOKEN REFRESH
   POST /api/auth/refresh
   {
     "refreshToken": "<refreshToken>"
   }
   
   Response:
   {
     "accessToken": "<new_token>",
     "expiresIn": 3600
   }
```

### Security Best Practices

#### Implemented

- ✅ JWT tokens for stateless auth
- ✅ bcryptjs for password hashing
- ✅ CORS policy enforcement
- ✅ HTTPS/TLS for encryption
- ✅ Input validation & sanitization
- ✅ SQL injection prevention (parameterized queries)
- ✅ Rate limiting (optional)
- ✅ CSRF protection (cookies HttpOnly)
- ✅ XSS prevention (output encoding)
- ✅ Environment variables for secrets

#### To Implement

- [ ] OAuth2/OpenID Connect
- [ ] Two-factor authentication (2FA)
- [ ] API key management
- [ ] Audit logging
- [ ] Encryption at rest
- [ ] Regular security audits
- [ ] Penetration testing
- [ ] WAF (Web Application Firewall)

### Role-Based Access Control (RBAC)

```javascript
// Roles
const ROLES = {
  ADMIN: 'admin',          // Full access
  USER: 'user',            // Can read/write own data
  VIEWER: 'viewer'         // Read-only access
};

// Permissions
const PERMISSIONS = {
  ADMIN: ['read', 'write', 'delete', 'admin'],
  USER: ['read', 'write'],
  VIEWER: ['read']
};

// Usage in routes
router.delete('/parcelles/:id',
  middleware.authenticate,
  middleware.authorize(['admin']),  // Only admins
  controller.deleteParcelle
);
```

---

## Performance & Optimization

### Database Optimization

#### Indexes

```sql
-- Frequently queried columns
CREATE INDEX idx_parcelle_user ON parcelles(user_id);
CREATE INDEX idx_arbre_parcelle ON arbres(parcelle_id);
CREATE INDEX idx_arbre_sante ON arbres(etat_sanitaire);
CREATE INDEX idx_intervention_date ON interventions(date_intervention);
CREATE INDEX idx_recolte_date ON recoltes(date_recolte);

-- Spatial index for geography queries
SPATIAL INDEX idx_parcelle_location ON parcelles(localisation);

-- Composite indexes for common filters
CREATE INDEX idx_arbre_parcelle_sante ON arbres(parcelle_id, etat_sanitaire);
```

#### Query Optimization

```javascript
// GOOD: Select only needed columns
const query = `
  SELECT id, nom, surface_hectares 
  FROM parcelles 
  WHERE user_id = ?`;

// BAD: SELECT *
const query = `SELECT * FROM parcelles WHERE user_id = ?`;

// GOOD: Use LIMIT for pagination
const query = `
  SELECT * FROM parcelles 
  LIMIT 20 OFFSET 0`;

// GOOD: Eager load relations
const query = `
  SELECT p.*, COUNT(a.id) as arbres_count
  FROM parcelles p
  LEFT JOIN arbres a ON p.id = a.parcelle_id
  GROUP BY p.id`;
```

#### Connection Pooling

```javascript
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DATABASE_HOST,
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
  waitForConnections: true,
  connectionLimit: 10,    // Max connections
  queueLimit: 0,         // Queue unlimited
  enableKeepAlive: true,
  keepAliveInitialDelayMs: 0
});

module.exports = pool;
```

### Backend Optimization

#### Caching

```javascript
// Cache frequently accessed data
const cache = new Map();

function getCacheKey(type, id) {
  return `${type}:${id}`;
}

router.get('/parcelles/:id', async (req, res) => {
  const key = getCacheKey('parcelle', req.params.id);
  
  // Check cache first
  if (cache.has(key)) {
    return res.json(cache.get(key));
  }
  
  // If not in cache, query DB
  const parcelle = await parcelleService.getParcelle(req.params.id);
  
  // Store in cache (with TTL)
  cache.set(key, parcelle);
  setTimeout(() => cache.delete(key), 5 * 60 * 1000); // 5 mins
  
  res.json(parcelle);
});
```

#### Compression

```javascript
const compression = require('compression');

app.use(compression());
// Gzips responses > 1KB automatically
```

#### Request Timeout

```javascript
const timeout = require('connect-timeout');

app.use(timeout('30s'));
app.use((req, res, next) => {
  if (!req.timedout) next();
});
```

### Frontend Optimization

#### Code Splitting

```javascript
// React lazy loading
const Dashboard = React.lazy(() => import('./Dashboard'));
const Parcelles = React.lazy(() => import('./Parcelles'));

// Usage
<Suspense fallback={<Loading />}>
  <Dashboard />
</Suspense>
```

#### Memoization

```javascript
// Prevent unnecessary re-renders
const Parcelle = React.memo(({ parcelleId }) => {
  return <div>{parcelleId}</div>;
}, (prevProps, nextProps) => {
  return prevProps.parcelleId === nextProps.parcelleId;
});
```

#### Image Optimization

```javascript
// Use WebP with fallback
<picture>
  <source srcSet="image.webp" type="image/webp" />
  <img src="image.png" alt="" />
</picture>
```

---

## Deployment & DevOps

### Docker Setup

#### Backend Dockerfile

```dockerfile
FROM node:16-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 5000

CMD ["npm", "start"]
```

#### Docker Compose

```yaml
version: '3.8'

services:
  db:
    image: mysql:8.0
    environment:
      MYSQL_ROOT_PASSWORD: root
      MYSQL_DATABASE: gestion_truffiere
    volumes:
      - db_data:/var/lib/mysql
      - ./init-db.sql:/docker-entrypoint-initdb.d/
    ports:
      - "3306:3306"

  backend:
    build: ./backend
    environment:
      NODE_ENV: production
      DATABASE_HOST: db
      DATABASE_USER: root
      DATABASE_PASSWORD: root
      DATABASE_NAME: gestion_truffiere
      JWT_SECRET: ${JWT_SECRET}
    ports:
      - "5000:5000"
    depends_on:
      - db

  frontend:
    build: ./frontend
    environment:
      REACT_APP_API_URL: http://localhost:5000/api
    ports:
      - "3000:3000"
    depends_on:
      - backend

volumes:
  db_data:
```

### Deployment Strategies

#### Development

```bash
# Local development with hot reload
docker-compose up
```

#### Staging

```bash
# Build production images
docker build -t gestion-truffiere:backend .
docker build -t gestion-truffiere:frontend .

# Push to registry
docker push registry.example.com/gestion-truffiere:backend
docker push registry.example.com/gestion-truffiere:frontend

# Deploy to staging server
ssh staging.example.com
docker pull registry.example.com/gestion-truffiere:backend
docker pull registry.example.com/gestion-truffiere:frontend
docker-compose -f docker-compose.staging.yml up -d
```

#### Production

```bash
# Using Kubernetes (optional)
kubectl apply -f k8s/deployment.yaml

# Or using Docker Swarm
docker swarm init
docker stack deploy -c docker-stack.yml gestion-truffiere
```

---

## Monitoring & Logging

### Logging Architecture

```
┌─────────────────┐
│ Application     │
│ Logger Calls    │
└────────┬────────┘
         │ logger.info/error/debug
         │
         ▼
┌─────────────────┐
│ Winston/Pino    │  ← Log aggregator
│ (Node Logger)   │
└────────┬────────┘
         │
    ┌────┴────┬──────────┬────────┐
    │          │          │        │
    ▼          ▼          ▼        ▼
┌────────┐ ┌────┐ ┌──────────┐ ┌──────┐
│Console │ │File│ │Cloudwatch│ │Sentry│
│ (Dev)  │ │    │ │  (AWS)   │ │ (ER) │
└────────┘ └────┘ └──────────┘ └──────┘
```

### Logging Implementation

```javascript
// backend/utils/logger.js
const winston = require('winston');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.json(),
  defaultMeta: { service: 'gestion-truffiere' },
  transports: [
    // Console (development)
    new winston.transports.Console({
      format: winston.format.simple()
    }),
    // File (production)
    new winston.transports.File({ 
      filename: 'error.log', 
      level: 'error' 
    }),
    new winston.transports.File({ 
      filename: 'combined.log' 
    })
  ]
});

// Usage
logger.info('User logged in', { userId, email });
logger.error('Database error', { error: err.message });
logger.debug('Processing request', { route, params });
```

### Key Metrics to Monitor

```
├─ Response Time
│  └─ p50, p95, p99 latencies
│
├─ Error Rate
│  └─ 4xx, 5xx errors per minute
│
├─ Database
│  ├─ Query execution time
│  ├─ Connection pool utilization
│  └─ Slow queries
│
├─ Server Health
│  ├─ CPU usage
│  ├─ Memory usage
│  ├─ Disk space
│  └─ Network I/O
│
└─ Business Metrics
   ├─ Active users
   ├─ API calls per minute
   └─ Data volume growth
```

---

## Scalability

### Horizontal Scaling

```
With Load Balancer:

            ┌─────────┐
            │ Client  │
            └────┬────┘
                 │
            ┌────▼────┐
            │Nginx LB │
            └────┬────┘
            ┌────┴─────────┬──────────┐
            │              │          │
      ┌─────▼────┐  ┌─────▼────┐  ┌─▼────────┐
      │Backend 1 │  │Backend 2 │  │Backend N │
      └─────┬────┘  └─────┬────┘  └─┬────────┘
            │              │          │
            └──────────┬───┴──────────┘
                       │
                ┌──────▼──────┐
                │  Database   │
                │   (Shared)  │
                └─────────────┘
```

### Vertical Scaling

- Increase server resources (CPU, RAM)
- Better database indexing
- Query optimization

---

## Troubleshooting

### Common Issues

#### 1. Database Connection Error

```
Error: connect ECONNREFUSED 127.0.0.1:3306

Solution:
1. Verify DB is running: docker ps | grep mysql
2. Check credentials in .env
3. Verify DB URL/host/port
4. Check firewall rules
```

#### 2. JWT Token Expired

```
Error: TokenExpiredError: jwt expired

Solution:
1. Use refresh token endpoint
2. Get new access token
3. Retry original request
```

#### 3. CORS Issues

```
Error: Access to XMLHttpRequest blocked by CORS policy

Solution:
1. Check CORS_ORIGIN in .env
2. Verify allowed origin matches request
3. Check credentials: true setting
```

---

**Last updated: 2026-01-24**  
**Status: Production Ready**  
**Maintained by: lepekinoi**
