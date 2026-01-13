// ========================================
// server.js - API Truffière CORRIGÉ
// Version 2.0.1 - Fix middlewares
// Encodage: UTF-8
// ========================================

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { Pool } = require('pg');

require('dotenv').config();

const app = express();
app.set('trust proxy', 1);

const PORT = process.env.PORT || 3001;

// ========================================
// CONFIGURATION
// ========================================

const JWT_SECRET = process.env.JWT_SECRET || 'CHANGEZ_MOI_EN_PRODUCTION_minimum_64_caracteres_de_securite';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m';
const REFRESH_TOKEN_EXPIRES_DAYS = parseInt(process.env.REFRESH_TOKEN_EXPIRES_DAYS || '7');
const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '12');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'truffiere',
  user: process.env.DB_USER || 'unstuffed1004',
  password: process.env.DB_PASSWORD || 'WeR87fFC8SN5IJUGz4w6Tl87t1Fm2840GepKl82Xe666J0D7hD',
});

pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ Erreur de connexion à la base de données:', err.stack);
  } else {
    console.log('✅ Connecté à la base de données PostgreSQL');
    release();
  }
});

// ========================================
// MIDDLEWARES GLOBAUX
// ========================================

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));

const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      process.env.FRONTEND_URL || 'http://localhost:3000',
      'https://m-a-truffes.sytes.net',
      'http://localhost:3000',
      'http://127.0.0.1:3000'
    ];
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Non autorisé par CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());
app.use(morgan('dev'));

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: { error: 'Trop de requêtes', code: 'RATE_LIMIT' }
});
app.use(globalLimiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Trop de tentatives de connexion', code: 'AUTH_RATE_LIMIT' },
  skipSuccessfulRequests: true
});

// ========================================
// MAPPING TABLES SÉPARÉES
// ========================================

const INTERVENTION_DETAILS_TABLES = {
  'Irrigation': 'irrigation_details',
  'Traitement': 'traitement_phyto_details',
  'Amendement': 'amendement_details',
  'Taille': 'taille_details',
  'Travail du sol': 'travail_sol_details',
  'Observation': 'observation_details',
  'Paillage': 'paillage_details',
  'Plantation': 'plantation_details',
  'Analyse de sol': 'analyse_sol_details',
  'Piégeage': 'piegeage_details',
  'Inoculation': 'inoculation_details'
};

const FIELD_MAPPINGS = {
  irrigation_details: {
    volumeEauM3: 'volume_eau_m3',
    volumeEauParArbreL: 'volume_eau_par_arbre_l',
    methodeIrrigation: 'methode_irrigation',
    sourceEau: 'source_eau',
    debitLh: 'debit_l_h',
    pressionBar: 'pression_bar',
    frequenceIrrigation: 'frequence_irrigation',
    humiditeSolAvant: 'humidite_sol_avant',
    humiditeSolApres: 'humidite_sol_apres'
  },
  traitement_phyto_details: {
    categorieTraitement: 'categorie_traitement',
    nomCommercial: 'nom_commercial',
    matiereActive: 'matiere_active',
    numeroAmm: 'numero_amm',
    fabricant: 'fabricant',
    doseProduitHa: 'dose_produit_ha',
    doseProduitArbre: 'dose_produit_arbre',
    concentration: 'concentration',
    volumeBouillieL: 'volume_bouillie_l',
    surfaceTraiteeHa: 'surface_traitee_ha',
    methodeApplication: 'methode_application',
    cibleTraitement: 'cible_traitement',
    delaiAvantRecolteJours: 'delai_avant_recolte_jours',
    zoneNonTraiteeM: 'zone_non_traitee_m',
    equipementProtection: 'equipement_protection',
    conditionsApplication: 'conditions_application'
  },
  amendement_details: {
    typeAmendement: 'type_amendement',
    nomProduitAmendement: 'nom_produit_amendement',
    origineProduit: 'origine_produit',
    numeroLot: 'numero_lot',
    certificationBio: 'certification_bio',
    compositionNpk: 'composition_npk',
    compositionCao: 'composition_cao',
    compositionMgo: 'composition_mgo',
    compositionAutres: 'composition_autres',
    doseKgHa: 'dose_kg_ha',
    doseKgArbre: 'dose_kg_arbre',
    quantiteTotaleKg: 'quantite_totale_kg',
    methodeEpandage: 'methode_epandage',
    incorporation: 'incorporation',
    profondeurIncorporationCm: 'profondeur_incorporation_cm',
    phSolAvant: 'ph_sol_avant',
    phSolApres: 'ph_sol_apres'
  },
  taille_details: {
    typeTaille: 'type_taille',
    intensiteTaille: 'intensite_taille',
    hauteurAvantCm: 'hauteur_avant_cm',
    hauteurApresCm: 'hauteur_apres_cm',
    diametreCouronneAvantM: 'diametre_couronne_avant_m',
    diametreCouronneApresM: 'diametre_couronne_apres_m',
    branchesSupprimees: 'branches_supprimees',
    diametreMaxCoupeCm: 'diametre_max_coupe_cm',
    volumeResidusM3: 'volume_residus_m3',
    destinationResidus: 'destination_residus',
    outilsTaille: 'outils_taille',
    desinfectionOutils: 'desinfection_outils',
    produitDesinfection: 'produit_desinfection'
  },
  travail_sol_details: {
    typeTravailSol: 'type_travail_sol',
    outilTravailSol: 'outil_travail_sol',
    zoneTravaillee: 'zone_travaillee',
    profondeurTravailCm: 'profondeur_travail_cm',
    largeurTravailM: 'largeur_travail_m',
    distanceTroncM: 'distance_tronc_m',
    etatSolAvant: 'etat_sol_avant',
    enherbementAvant: 'enherbement_avant',
    enherbementApres: 'enherbement_apres',
    presenceCailloux: 'presence_cailloux'
  },
  observation_details: {
    typeObservation: 'type_observation',
    niveauUrgence: 'niveau_urgence',
    etatBrule: 'etat_brule',
    diametreBruleM: 'diametre_brule_m',
    evolutionBrule: 'evolution_brule',
    presenceAscomes: 'presence_ascomes',
    nombreAscomes: 'nombre_ascomes',
    indiceMycorhization: 'indice_mycorhization',
    symptomesObserves: 'symptomes_observes',
    ravageursIdentifies: 'ravageurs_identifies',
    degatsConstates: 'degats_constates',
    preconisations: 'preconisations'
  },
  paillage_details: {
    typePaillage: 'type_paillage',
    epaisseurCm: 'epaisseur_cm',
    surfacePailleeM2: 'surface_paillee_m2',
    quantitePaillageM3: 'quantite_paillage_m3',
    originePaillage: 'origine_paillage'
  },
  plantation_details: {
    especePlantee: 'espece_plantee',
    varietePlant: 'variete_plant',
    typeMycorhization: 'type_mycorhization',
    fournisseurPlant: 'fournisseur_plant',
    certificationPlant: 'certification_plant',
    numeroLotPlant: 'numero_lot_plant',
    taillePlantCm: 'taille_plant_cm',
    diametreColletMm: 'diametre_collet_mm',
    dimensionsTrouCm: 'dimensions_trou_cm',
    amendementPlantation: 'amendement_plantation',
    arrosagePlantationL: 'arrosage_plantation_l',
    tuteur: 'tuteur',
    protectionGibier: 'protection_gibier',
    typeProtection: 'type_protection'
  },
  analyse_sol_details: {
    profondeurPrelevementCm: 'profondeur_prelevement_cm',
    nombreEchantillons: 'nombre_echantillons',
    laboratoire: 'laboratoire',
    referenceAnalyse: 'reference_analyse',
    resultatsPh: 'resultats_ph',
    resultatsCalcaireActif: 'resultats_calcaire_actif',
    resultatsMatiereOrganique: 'resultats_matiere_organique',
    resultatsAzote: 'resultats_azote',
    resultatsPhosphore: 'resultats_phosphore',
    resultatsPotassium: 'resultats_potassium',
    resultatsCec: 'resultats_cec',
    interpretation: 'interpretation'
  },
  piegeage_details: {
    typePiege: 'type_piege',
    ciblePiegeage: 'cible_piegeage',
    nombrePieges: 'nombre_pieges',
    densitePiegesHa: 'densite_pieges_ha',
    dateReleve: 'date_releve',
    captures: 'captures',
    actionSuite: 'action_suite'
  },
  inoculation_details: {
    typeInoculum: 'type_inoculum',
    especeTruffeInoculation: 'espece_truffe_inoculation',
    quantiteInoculum: 'quantite_inoculum',
    methodeInoculation: 'methode_inoculation',
    fournisseurInoculum: 'fournisseur_inoculum'
  }
};

// ========================================
// FONCTIONS UTILITAIRES
// ========================================

const emptyToNull = (value) => {
  if (value === '' || value === undefined || value === null) return null;
  return value;
};

const camelToSnake = (str) => {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
};

const snakeToCamel = (str) => {
  return str.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
};

const convertKeysToSnake = (obj, mapping) => {
  const result = {};
  for (const [camelKey, value] of Object.entries(obj)) {
    if (value !== undefined && value !== null && value !== '') {
      const snakeKey = mapping[camelKey] || camelToSnake(camelKey);
      result[snakeKey] = value;
    }
  }
  return result;
};

const convertKeysToCamel = (obj) => {
  if (!obj) return null;
  const result = {};
  for (const [snakeKey, value] of Object.entries(obj)) {
    const camelKey = snakeToCamel(snakeKey);
    result[camelKey] = value;
  }
  return result;
};

const generateAccessToken = (user) => {
  return jwt.sign(
    { userId: user.id, email: user.email, role: user.role, nom: user.nom },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
};

const generateRefreshToken = () => {
  const token = crypto.randomBytes(64).toString('hex');
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRES_DAYS);
  return { token, hash, expiresAt };
};

const hashRefreshToken = (token) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

const logLoginAttempt = async (email, ip, userAgent, success, reason) => {
  try {
    await pool.query(
      `INSERT INTO login_attempts (email, ip_address, user_agent, success, failure_reason)
       VALUES ($1, $2, $3, $4, $5)`,
      [email, ip, userAgent?.substring(0, 500), success, reason]
    );
  } catch (err) {
    console.error('❌ Erreur log login:', err);
  }
};

// ========================================
// MIDDLEWARES D'AUTHENTIFICATION
// ========================================

const authMiddleware = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'Token requis', code: 'NO_TOKEN' });
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return res.status(401).json({ error: 'Format de token invalide', code: 'INVALID_FORMAT' });
    }

    const decoded = jwt.verify(parts[1], JWT_SECRET);
    req.user = {
      id: decoded.userId,
      email: decoded.email,
      role: decoded.role,
      nom: decoded.nom
    };
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expiré', code: 'TOKEN_EXPIRED' });
    }
    return res.status(401).json({ error: 'Token invalide', code: 'INVALID_TOKEN' });
  }
};

const requireRole = (...roles) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Non authentifié', code: 'NOT_AUTHENTICATED' });
  }
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ error: 'Accès non autorisé', code: 'FORBIDDEN' });
  }
  next();
};

// ✅ CORRECTION : requireWriteAccess vérifie req.user seulement s'il existe
const requireWriteAccess = (req, res, next) => {
  if (req.user && req.user.role === 'readonly') {
    return res.status(403).json({ error: 'Accès en lecture seule', code: 'READONLY' });
  }
  next();
};

// ========================================
// ROUTES PUBLIQUES
// ========================================

app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'API Truffière fonctionnelle',
    version: '2.0.1',
    timestamp: new Date().toISOString()
  });
});

// ========================================
// ROUTES D'AUTHENTIFICATION
// ========================================

app.post('/api/auth/login', authLimiter, async (req, res) => {
  const { email, password } = req.body;
  const clientIp = req.ip || req.connection.remoteAddress;
  const userAgent = req.get('User-Agent') || 'Unknown';

  try {
    if (!email || !password) {
      return res.status(400).json({ error: 'Email et mot de passe requis', code: 'MISSING_FIELDS' });
    }

    const lockCheck = await pool.query(
      `SELECT locked_until, failed_login_attempts FROM users WHERE email = $1`,
      [email]
    );

    if (lockCheck.rows.length > 0 && lockCheck.rows[0].locked_until) {
      if (new Date(lockCheck.rows[0].locked_until) > new Date()) {
        await logLoginAttempt(email, clientIp, userAgent, false, 'account_locked');
        return res.status(423).json({
          error: 'Compte temporairement verrouillé',
          code: 'ACCOUNT_LOCKED',
          lockedUntil: lockCheck.rows[0].locked_until
        });
      }
    }

    const userResult = await pool.query(
      `SELECT id, email, password_hash, nom, prenom, role, is_active
       FROM users WHERE email = $1`,
      [email]
    );

    if (userResult.rows.length === 0) {
      await logLoginAttempt(email, clientIp, userAgent, false, 'invalid_email');
      return res.status(401).json({ error: 'Email ou mot de passe incorrect', code: 'INVALID_CREDENTIALS' });
    }

    const user = userResult.rows[0];

    if (!user.is_active) {
      await logLoginAttempt(email, clientIp, userAgent, false, 'account_inactive');
      return res.status(403).json({ error: 'Compte désactivé', code: 'ACCOUNT_DISABLED' });
    }

    const passwordValid = await bcrypt.compare(password, user.password_hash);

    if (!passwordValid) {
      await logLoginAttempt(email, clientIp, userAgent, false, 'invalid_password');

      const failures = (lockCheck.rows[0]?.failed_login_attempts || 0) + 1;
      if (failures >= 5) {
        await pool.query(
          `UPDATE users SET failed_login_attempts = $1, locked_until = NOW() + INTERVAL '15 minutes'
           WHERE email = $2`,
          [failures, email]
        );
      } else {
        await pool.query(
          `UPDATE users SET failed_login_attempts = $1 WHERE email = $2`,
          [failures, email]
        );
      }

      return res.status(401).json({ error: 'Email ou mot de passe incorrect', code: 'INVALID_CREDENTIALS' });
    }

    const accessToken = generateAccessToken(user);
    const { token: refreshToken, hash: refreshTokenHash, expiresAt } = generateRefreshToken();

    await pool.query(
      `INSERT INTO refresh_tokens (user_id, token_hash, device_info, ip_address, expires_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [user.id, refreshTokenHash, userAgent.substring(0, 255), clientIp, expiresAt]
    );

    await pool.query(
      `UPDATE users SET failed_login_attempts = 0, locked_until = NULL, last_login = NOW()
       WHERE id = $1`,
      [user.id]
    );

    await logLoginAttempt(email, clientIp, userAgent, true, null);

    res.json({
      message: 'Connexion réussie',
      accessToken,
      refreshToken,
      expiresIn: JWT_EXPIRES_IN,
      user: {
        id: user.id,
        email: user.email,
        nom: user.nom,
        prenom: user.prenom,
        role: user.role
      }
    });
  } catch (err) {
    console.error('❌ Erreur login:', err);
    res.status(500).json({ error: 'Erreur lors de la connexion', code: 'LOGIN_ERROR' });
  }
});

app.post('/api/auth/refresh', async (req, res) => {
  const { refreshToken } = req.body;

  try {
    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token requis', code: 'MISSING_TOKEN' });
    }

    const tokenHash = hashRefreshToken(refreshToken);

    const tokenResult = await pool.query(
      `SELECT rt.*, u.id as user_id, u.email, u.nom, u.prenom, u.role, u.is_active
       FROM refresh_tokens rt
       JOIN users u ON rt.user_id = u.id
       WHERE rt.token_hash = $1 AND rt.revoked = false AND rt.expires_at > NOW()`,
      [tokenHash]
    );

    if (tokenResult.rows.length === 0) {
      return res.status(401).json({ error: 'Token invalide ou expiré', code: 'INVALID_REFRESH_TOKEN' });
    }

    const tokenData = tokenResult.rows[0];

    if (!tokenData.is_active) {
      await pool.query(
        `UPDATE refresh_tokens SET revoked = true, revoked_at = NOW(), revoked_reason = 'account_disabled'
         WHERE id = $1`,
        [tokenData.id]
      );
      return res.status(403).json({ error: 'Compte désactivé', code: 'ACCOUNT_DISABLED' });
    }

    const accessToken = generateAccessToken({
      id: tokenData.user_id,
      email: tokenData.email,
      nom: tokenData.nom,
      role: tokenData.role
    });

    res.json({ accessToken, expiresIn: JWT_EXPIRES_IN });
  } catch (err) {
    console.error('❌ Erreur refresh:', err);
    res.status(500).json({ error: 'Erreur lors du rafraîchissement', code: 'REFRESH_ERROR' });
  }
});

app.post('/api/auth/logout', authMiddleware, async (req, res) => {
  const { refreshToken } = req.body;

  try {
    if (refreshToken) {
      const tokenHash = hashRefreshToken(refreshToken);
      await pool.query(
        `UPDATE refresh_tokens SET revoked = true, revoked_at = NOW(), revoked_reason = 'logout'
         WHERE token_hash = $1 AND user_id = $2`,
        [tokenHash, req.user.id]
      );
    }

    res.json({ message: 'Déconnexion réussie' });
  } catch (err) {
    console.error('❌ Erreur logout:', err);
    res.status(500).json({ error: 'Erreur lors de la déconnexion', code: 'LOGOUT_ERROR' });
  }
});

app.post('/api/auth/logout-all', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE refresh_tokens
       SET revoked = true, revoked_at = NOW(), revoked_reason = 'logout_all'
       WHERE user_id = $1 AND revoked = false
       RETURNING id`,
      [req.user.id]
    );

    res.json({
      message: 'Déconnexion de tous les appareils',
      sessionsRevoked: result.rows.length
    });
  } catch (err) {
    console.error('❌ Erreur logout-all:', err);
    res.status(500).json({ error: 'Erreur', code: 'LOGOUT_ALL_ERROR' });
  }
});

app.get('/api/auth/me', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, email, nom, prenom, role, is_active, last_login, created_at
       FROM users WHERE id = $1`,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Utilisateur non trouvé', code: 'USER_NOT_FOUND' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('❌ Erreur get me:', err);
    res.status(500).json({ error: 'Erreur', code: 'PROFILE_ERROR' });
  }
});

app.post('/api/auth/register', authMiddleware, requireRole('admin'), async (req, res) => {
  const { email, password, nom, prenom, role = 'user' } = req.body;

  try {
    if (!email || !password || !nom) {
      return res.status(400).json({ error: 'Email, mot de passe et nom requis', code: 'MISSING_FIELDS' });
    }

    const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      return res.status(409).json({ error: 'Email déjà utilisé', code: 'EMAIL_EXISTS' });
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    const result = await pool.query(
      `INSERT INTO users (email, password_hash, nom, prenom, role, is_active, email_verified)
       VALUES ($1, $2, $3, $4, $5, true, true)
       RETURNING id, email, nom, prenom, role, is_active, created_at`,
      [email, passwordHash, nom, prenom || null, role]
    );

    res.status(201).json({
      message: 'Utilisateur créé',
      user: result.rows[0]
    });
  } catch (err) {
    console.error('❌ Erreur register:', err);
    res.status(500).json({ error: 'Erreur lors de la création', code: 'REGISTER_ERROR' });
  }
});

app.get('/api/auth/users', authMiddleware, requireRole('admin'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, email, nom, prenom, role, is_active, last_login, created_at
       FROM users ORDER BY created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('❌ Erreur list users:', err);
    res.status(500).json({ error: 'Erreur', code: 'LIST_USERS_ERROR' });
  }
});

app.get('/api/auth/users/:id', authMiddleware, requireRole('admin'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, email, nom, prenom, role, is_active, email_verified, last_login,
              failed_login_attempts, locked_until, created_at, updated_at
       FROM users WHERE id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Utilisateur non trouvé', code: 'USER_NOT_FOUND' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('❌ Erreur get user:', err);
    res.status(500).json({ error: 'Erreur', code: 'GET_USER_ERROR' });
  }
});

app.put('/api/auth/users/:id', authMiddleware, requireRole('admin'), async (req, res) => {
  const { id } = req.params;
  const { email, nom, prenom, role, isActive } = req.body;

  try {
    const updates = [];
    const values = [];
    let idx = 1;

    if (email !== undefined) {
      const emailCheck = await pool.query(
        'SELECT id FROM users WHERE email = $1 AND id != $2',
        [email, id]
      );
      if (emailCheck.rows.length > 0) {
        return res.status(409).json({ error: 'Email déjà utilisé', code: 'EMAIL_EXISTS' });
      }
      updates.push(`email = $${idx}`);
      values.push(email);
      idx++;
    }

    if (nom !== undefined) {
      updates.push(`nom = $${idx}`);
      values.push(nom);
      idx++;
    }

    if (prenom !== undefined) {
      updates.push(`prenom = $${idx}`);
      values.push(prenom);
      idx++;
    }

    if (role !== undefined) {
      updates.push(`role = $${idx}`);
      values.push(role);
      idx++;
    }

    if (isActive !== undefined) {
      updates.push(`is_active = $${idx}`);
      values.push(isActive);
      idx++;

      if (!isActive) {
        await pool.query(
          `UPDATE refresh_tokens SET revoked = true, revoked_at = NOW(), revoked_reason = 'account_disabled'
           WHERE user_id = $1`,
          [id]
        );
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'Aucune donnée à mettre à jour', code: 'NO_DATA' });
    }

    values.push(id);

    const result = await pool.query(
      `UPDATE users SET ${updates.join(', ')}, updated_at = NOW()
       WHERE id = $${idx}
       RETURNING id, email, nom, prenom, role, is_active`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Utilisateur non trouvé', code: 'USER_NOT_FOUND' });
    }

    res.json({
      message: 'Utilisateur mis à jour',
      user: result.rows[0]
    });
  } catch (err) {
    console.error('❌ Erreur update user:', err);
    res.status(500).json({ error: 'Erreur', code: 'UPDATE_USER_ERROR' });
  }
});

app.delete('/api/auth/users/:id', authMiddleware, requireRole('admin'), async (req, res) => {
  const { id } = req.params;

  try {
    if (parseInt(id) === req.user.id) {
      return res.status(400).json({ error: 'Impossible de supprimer votre propre compte', code: 'SELF_DELETE' });
    }

    const result = await pool.query('DELETE FROM users WHERE id = $1 RETURNING id', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Utilisateur non trouvé', code: 'USER_NOT_FOUND' });
    }

    res.json({ message: 'Utilisateur supprimé' });
  } catch (err) {
    console.error('❌ Erreur delete user:', err);
    res.status(500).json({ error: 'Erreur', code: 'DELETE_USER_ERROR' });
  }
});

// ========================================
// ROUTES PARCELLES (PAS D'AUTH REQUISE)
// ========================================

app.get('/api/parcelles', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM parcelles ORDER BY nom');
    res.json(result.rows);
  } catch (err) {
    console.error('❌ Erreur GET parcelles:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération des parcelles' });
  }
});

app.get('/api/parcelles/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM parcelles WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Parcelle non trouvée' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('❌ Erreur GET parcelle:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération de la parcelle' });
  }
});

app.post('/api/parcelles', async (req, res) => {
  const { nom, surface, exposition, type_sol, ph_moyen, calcaire_actif, geolocalisation, notes } = req.body;

  try {
    const result = await pool.query(
      `INSERT INTO parcelles (nom, surface, exposition, type_sol, ph_moyen, calcaire_actif, geolocalisation, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [nom, emptyToNull(surface), emptyToNull(exposition), emptyToNull(type_sol),
       emptyToNull(ph_moyen), emptyToNull(calcaire_actif), emptyToNull(geolocalisation), emptyToNull(notes)]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('❌ Erreur POST parcelle:', err);
    res.status(500).json({ error: 'Erreur lors de la création de la parcelle' });
  }
});

app.put('/api/parcelles/:id', async (req, res) => {
  const { nom, surface, exposition, type_sol, ph_moyen, calcaire_actif, geolocalisation, notes } = req.body;

  try {
    const result = await pool.query(
      `UPDATE parcelles
       SET nom = $1, surface = $2, exposition = $3, type_sol = $4, ph_moyen = $5,
           calcaire_actif = $6, geolocalisation = $7, notes = $8, updated_at = CURRENT_TIMESTAMP
       WHERE id = $9 RETURNING *`,
      [nom, emptyToNull(surface), emptyToNull(exposition), emptyToNull(type_sol),
       emptyToNull(ph_moyen), emptyToNull(calcaire_actif), emptyToNull(geolocalisation),
       emptyToNull(notes), req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Parcelle non trouvée' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('❌ Erreur PUT parcelle:', err);
    res.status(500).json({ error: 'Erreur lors de la mise à jour de la parcelle' });
  }
});

app.delete('/api/parcelles/:id', async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM parcelles WHERE id = $1 RETURNING id', [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Parcelle non trouvée' });
    }

    res.json({ message: 'Parcelle supprimée', id: result.rows[0].id });
  } catch (err) {
    console.error('❌ Erreur DELETE parcelle:', err);
    res.status(500).json({ error: 'Erreur lors de la suppression de la parcelle' });
  }
});

// ========================================
// ROUTES ARBRES (PAS D'AUTH REQUISE)
// ========================================

app.get('/api/arbres', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT a.*, p.nom as parcelle_nom
       FROM arbres a
       LEFT JOIN parcelles p ON a.parcelle_id = p.id
       ORDER BY a.numero`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('❌ Erreur GET arbres:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération des arbres' });
  }
});

app.get('/api/arbres/:id', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT a.*, p.nom as parcelle_nom
       FROM arbres a
       LEFT JOIN parcelles p ON a.parcelle_id = p.id
       WHERE a.id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Arbre non trouvé' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('❌ Erreur GET arbre:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération de l\'arbre' });
  }
});

app.post('/api/arbres', async (req, res) => {
  const {
    numero, parcelle_id, espece, variete_truffe, date_plantation, age_plantation,
    etat, hauteur_cm, diametre_tronc_cm, diametre_couronne_m, notes, geolocalisation
  } = req.body;

  try {
    const result = await pool.query(
      `INSERT INTO arbres (numero, parcelle_id, espece, variete_truffe, date_plantation,
                          age_plantation, etat, hauteur_cm, diametre_tronc_cm,
                          diametre_couronne_m, notes, geolocalisation)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
      [numero, emptyToNull(parcelle_id), espece, emptyToNull(variete_truffe),
       emptyToNull(date_plantation), emptyToNull(age_plantation), emptyToNull(etat),
       emptyToNull(hauteur_cm), emptyToNull(diametre_tronc_cm), emptyToNull(diametre_couronne_m),
       emptyToNull(notes), emptyToNull(geolocalisation)]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('❌ Erreur POST arbre:', err);
    res.status(500).json({ error: 'Erreur lors de la création de l\'arbre' });
  }
});

app.put('/api/arbres/:id', async (req, res) => {
  const {
    numero, parcelle_id, espece, variete_truffe, date_plantation, age_plantation,
    etat, hauteur_cm, diametre_tronc_cm, diametre_couronne_m, notes, geolocalisation
  } = req.body;

  try {
    const result = await pool.query(
      `UPDATE arbres
       SET numero = $1, parcelle_id = $2, espece = $3, variete_truffe = $4,
           date_plantation = $5, age_plantation = $6, etat = $7, hauteur_cm = $8,
           diametre_tronc_cm = $9, diametre_couronne_m = $10, notes = $11,
           geolocalisation = $12, updated_at = CURRENT_TIMESTAMP
       WHERE id = $13 RETURNING *`,
      [numero, emptyToNull(parcelle_id), espece, emptyToNull(variete_truffe),
       emptyToNull(date_plantation), emptyToNull(age_plantation), emptyToNull(etat),
       emptyToNull(hauteur_cm), emptyToNull(diametre_tronc_cm), emptyToNull(diametre_couronne_m),
       emptyToNull(notes), emptyToNull(geolocalisation), req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Arbre non trouvé' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('❌ Erreur PUT arbre:', err);
    res.status(500).json({ error: 'Erreur lors de la mise à jour de l\'arbre' });
  }
});

app.delete('/api/arbres/:id', async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM arbres WHERE id = $1 RETURNING id', [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Arbre non trouvé' });
    }

    res.json({ message: 'Arbre supprimé', id: result.rows[0].id });
  } catch (err) {
    console.error('❌ Erreur DELETE arbre:', err);
    res.status(500).json({ error: 'Erreur lors de la suppression de l\'arbre' });
  }
});

// ========================================
// ROUTES TYPES D'INTERVENTION
// ========================================

app.get('/api/types-intervention', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM types_intervention ORDER BY nom');
    res.json(result.rows);
  } catch (err) {
    console.error('❌ Erreur GET types intervention:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération des types d\'intervention' });
  }
});

// ========================================
// ROUTES INTERVENTIONS
// ========================================

app.get('/api/interventions', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT i.*,
              t.nom as type_nom,
              p.nom as parcelle_nom,
              a.numero as arbre_numero
       FROM interventions i
       LEFT JOIN types_intervention t ON i.type_intervention_id = t.id
       LEFT JOIN parcelles p ON i.parcelle_id = p.id
       LEFT JOIN arbres a ON i.arbre_id = a.id
       ORDER BY i.date_prevue DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('❌ Erreur GET interventions:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération des interventions' });
  }
});

app.get('/api/interventions/:id', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT i.*,
              t.nom as type_nom,
              p.nom as parcelle_nom,
              a.numero as arbre_numero
       FROM interventions i
       LEFT JOIN types_intervention t ON i.type_intervention_id = t.id
       LEFT JOIN parcelles p ON i.parcelle_id = p.id
       LEFT JOIN arbres a ON i.arbre_id = a.id
       WHERE i.id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Intervention non trouvée' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('❌ Erreur GET intervention:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération de l\'intervention' });
  }
});

app.post('/api/interventions', async (req, res) => {
  const {
    type_intervention_id, typeInterventionId, parcelle_id, parcelleId,
    arbre_id, arbreId, date_prevue, datePrevue, date_realisee, dateRealisee,
    statut, description, notes, cout, duree_minutes, dureeMinutes,
    meteo, personnel, caveur_id, caveurId
  } = req.body;

  try {
    const result = await pool.query(
      `INSERT INTO interventions (type_intervention_id, parcelle_id, arbre_id, date_prevue,
                                 date_realisee, statut, description, notes, cout,
                                 duree_minutes, meteo, personnel, caveur_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *`,
      [
        type_intervention_id || typeInterventionId,
        emptyToNull(parcelle_id || parcelleId),
        emptyToNull(arbre_id || arbreId),
        date_prevue || datePrevue,
        emptyToNull(date_realisee || dateRealisee),
        statut || 'Planifié',
        emptyToNull(description),
        emptyToNull(notes),
        emptyToNull(cout),
        emptyToNull(duree_minutes || dureeMinutes),
        emptyToNull(meteo),
        emptyToNull(personnel),
        emptyToNull(caveur_id || caveurId)
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('❌ Erreur POST intervention:', err);
    res.status(500).json({ error: 'Erreur lors de la création de l\'intervention' });
  }
});

app.put('/api/interventions/:id', async (req, res) => {
  const {
    type_intervention_id, typeInterventionId, parcelle_id, parcelleId,
    arbre_id, arbreId, date_prevue, datePrevue, date_realisee, dateRealisee,
    statut, description, notes, cout, duree_minutes, dureeMinutes,
    meteo, personnel, caveur_id, caveurId
  } = req.body;

  try {
    const result = await pool.query(
      `UPDATE interventions
       SET type_intervention_id = $1, parcelle_id = $2, arbre_id = $3, date_prevue = $4,
           date_realisee = $5, statut = $6, description = $7, notes = $8, cout = $9,
           duree_minutes = $10, meteo = $11, personnel = $12, caveur_id = $13,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $14 RETURNING *`,
      [
        type_intervention_id || typeInterventionId,
        emptyToNull(parcelle_id || parcelleId),
        emptyToNull(arbre_id || arbreId),
        date_prevue || datePrevue,
        emptyToNull(date_realisee || dateRealisee),
        statut,
        emptyToNull(description),
        emptyToNull(notes),
        emptyToNull(cout),
        emptyToNull(duree_minutes || dureeMinutes),
        emptyToNull(meteo),
        emptyToNull(personnel),
        emptyToNull(caveur_id || caveurId),
        req.params.id
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Intervention non trouvée' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('❌ Erreur PUT intervention:', err);
    res.status(500).json({ error: 'Erreur lors de la mise à jour de l\'intervention' });
  }
});

app.delete('/api/interventions/:id', async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM interventions WHERE id = $1 RETURNING id', [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Intervention non trouvée' });
    }

    res.json({ message: 'Intervention supprimée', id: result.rows[0].id });
  } catch (err) {
    console.error('❌ Erreur DELETE intervention:', err);
    res.status(500).json({ error: 'Erreur lors de la suppression de l\'intervention' });
  }
});

// ========================================
// ROUTES DÉTAILS D'INTERVENTIONS
// ========================================

app.get('/api/interventions/:id/details', async (req, res) => {
  try {
    const { id } = req.params;

    const interventionResult = await pool.query(
      `SELECT i.*, t.nom as type_nom
       FROM interventions i
       LEFT JOIN types_intervention t ON i.type_intervention_id = t.id
       WHERE i.id = $1`,
      [id]
    );

    if (interventionResult.rows.length === 0) {
      return res.status(404).json({ error: 'Intervention non trouvée' });
    }

    const intervention = interventionResult.rows[0];
    const tableName = INTERVENTION_DETAILS_TABLES[intervention.type_nom];

    if (!tableName) {
      return res.json(null);
    }

    const detailsResult = await pool.query(
      `SELECT * FROM ${tableName} WHERE intervention_id = $1`,
      [id]
    );

    if (detailsResult.rows.length === 0) {
      return res.json(null);
    }

    const details = convertKeysToCamel(detailsResult.rows[0]);
    res.json(details);
  } catch (err) {
    console.error('❌ Erreur récupération détails intervention:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération des détails' });
  }
});

app.post('/api/interventions/:id/details', async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const details = req.body;

    await client.query('BEGIN');

    const interventionResult = await client.query(
      `SELECT i.*, t.nom as type_nom
       FROM interventions i
       LEFT JOIN types_intervention t ON i.type_intervention_id = t.id
       WHERE i.id = $1`,
      [id]
    );

    if (interventionResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Intervention non trouvée' });
    }

    const intervention = interventionResult.rows[0];
    const tableName = INTERVENTION_DETAILS_TABLES[intervention.type_nom];

    if (!tableName) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: `Pas de table de détails pour le type "${intervention.type_nom}"`
      });
    }

    const mapping = FIELD_MAPPINGS[tableName];
    const dbFields = convertKeysToSnake(details, mapping);

    const fields = Object.keys(dbFields).filter(key =>
      dbFields[key] !== undefined && dbFields[key] !== null && dbFields[key] !== ''
    );

    if (fields.length === 0) {
      await client.query('COMMIT');
      return res.json({ message: 'Aucun détail à enregistrer' });
    }

    const existingDetails = await client.query(
      `SELECT id FROM ${tableName} WHERE intervention_id = $1`,
      [id]
    );

    let result;

    if (existingDetails.rows.length > 0) {
      const setClauses = fields.map((field, index) => `${field} = $${index + 1}`);
      const values = fields.map(field => dbFields[field]);
      values.push(id);

      result = await client.query(
        `UPDATE ${tableName}
         SET ${setClauses.join(', ')}, updated_at = CURRENT_TIMESTAMP
         WHERE intervention_id = $${values.length}
         RETURNING *`,
        values
      );
    } else {
      const columns = ['intervention_id', ...fields];
      const placeholders = columns.map((_, index) => `$${index + 1}`);
      const values = [id, ...fields.map(field => dbFields[field])];

      result = await client.query(
        `INSERT INTO ${tableName} (${columns.join(', ')})
         VALUES (${placeholders.join(', ')})
         RETURNING *`,
        values
      );
    }

    await client.query('COMMIT');

    const savedDetails = convertKeysToCamel(result.rows[0]);
    res.json(savedDetails);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Erreur sauvegarde détails intervention:', err);
    res.status(500).json({
      error: 'Erreur lors de la sauvegarde des détails',
      details: err.message
    });
  } finally {
    client.release();
  }
});

app.delete('/api/interventions/:id/details', async (req, res) => {
  try {
    const { id } = req.params;

    const interventionResult = await pool.query(
      `SELECT i.*, t.nom as type_nom
       FROM interventions i
       LEFT JOIN types_intervention t ON i.type_intervention_id = t.id
       WHERE i.id = $1`,
      [id]
    );

    if (interventionResult.rows.length === 0) {
      return res.status(404).json({ error: 'Intervention non trouvée' });
    }

    const intervention = interventionResult.rows[0];
    const tableName = INTERVENTION_DETAILS_TABLES[intervention.type_nom];

    if (!tableName) {
      return res.json({ message: 'Aucun détail à supprimer' });
    }

    await pool.query(
      `DELETE FROM ${tableName} WHERE intervention_id = $1`,
      [id]
    );

    res.json({ message: 'Détails supprimés avec succès' });
  } catch (err) {
    console.error('❌ Erreur suppression détails intervention:', err);
    res.status(500).json({ error: 'Erreur lors de la suppression des détails' });
  }
});

// ========================================
// ROUTES RÉCOLTES
// ========================================

app.get('/api/recoltes', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT r.*,
              p.nom as parcelle_nom,
              a.numero as arbre_numero,
              c.nom as caveur_nom,
              c.prenom as caveur_prenom
       FROM recoltes r
       LEFT JOIN parcelles p ON r.parcelle_id = p.id
       LEFT JOIN arbres a ON r.arbre_id = a.id
       LEFT JOIN caveurs c ON r.caveur_id = c.id
       ORDER BY r.date_recolte DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('❌ Erreur GET récoltes:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération des récoltes' });
  }
});

app.post('/api/recoltes', async (req, res) => {
  const {
    date_recolte, parcelle_id, arbre_id, poids_grammes, qualite,
    profondeur_cm, caveur_id, meteo, notes
  } = req.body;

  try {
    const result = await pool.query(
      `INSERT INTO recoltes (date_recolte, parcelle_id, arbre_id, poids_grammes,
                            qualite, profondeur_cm, caveur_id, meteo, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [date_recolte, emptyToNull(parcelle_id), emptyToNull(arbre_id),
       poids_grammes, emptyToNull(qualite), emptyToNull(profondeur_cm),
       emptyToNull(caveur_id), emptyToNull(meteo), emptyToNull(notes)]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('❌ Erreur POST récolte:', err);
    res.status(500).json({ error: 'Erreur lors de la création de la récolte' });
  }
});

app.put('/api/recoltes/:id', async (req, res) => {
  const {
    date_recolte, parcelle_id, arbre_id, poids_grammes, qualite,
    profondeur_cm, caveur_id, meteo, notes
  } = req.body;

  try {
    const result = await pool.query(
      `UPDATE recoltes
       SET date_recolte = $1, parcelle_id = $2, arbre_id = $3, poids_grammes = $4,
           qualite = $5, profondeur_cm = $6, caveur_id = $7, meteo = $8, notes = $9,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $10 RETURNING *`,
      [date_recolte, emptyToNull(parcelle_id), emptyToNull(arbre_id),
       poids_grammes, emptyToNull(qualite), emptyToNull(profondeur_cm),
       emptyToNull(caveur_id), emptyToNull(meteo), emptyToNull(notes), req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Récolte non trouvée' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('❌ Erreur PUT récolte:', err);
    res.status(500).json({ error: 'Erreur lors de la mise à jour de la récolte' });
  }
});

app.delete('/api/recoltes/:id', async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM recoltes WHERE id = $1 RETURNING id', [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Récolte non trouvée' });
    }

    res.json({ message: 'Récolte supprimée', id: result.rows[0].id });
  } catch (err) {
    console.error('❌ Erreur DELETE récolte:', err);
    res.status(500).json({ error: 'Erreur lors de la suppression de la récolte' });
  }
});

// ========================================
// ROUTES CAVEURS
// ========================================

app.get('/api/caveurs', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM caveurs ORDER BY nom, prenom');
    res.json(result.rows);
  } catch (err) {
    console.error('❌ Erreur GET caveurs:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération des caveurs' });
  }
});

app.post('/api/caveurs', async (req, res) => {
  const { nom, prenom, telephone, email, notes } = req.body;

  try {
    const result = await pool.query(
      `INSERT INTO caveurs (nom, prenom, telephone, email, notes)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [nom, emptyToNull(prenom), emptyToNull(telephone), emptyToNull(email), emptyToNull(notes)]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('❌ Erreur POST caveur:', err);
    res.status(500).json({ error: 'Erreur lors de la création du caveur' });
  }
});

app.put('/api/caveurs/:id', async (req, res) => {
  const { nom, prenom, telephone, email, notes } = req.body;

  try {
    const result = await pool.query(
      `UPDATE caveurs
       SET nom = $1, prenom = $2, telephone = $3, email = $4, notes = $5,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $6 RETURNING *`,
      [nom, emptyToNull(prenom), emptyToNull(telephone), emptyToNull(email),
       emptyToNull(notes), req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Caveur non trouvé' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('❌ Erreur PUT caveur:', err);
    res.status(500).json({ error: 'Erreur lors de la mise à jour du caveur' });
  }
});

app.delete('/api/caveurs/:id', async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM caveurs WHERE id = $1 RETURNING id', [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Caveur non trouvé' });
    }

    res.json({ message: 'Caveur supprimé', id: result.rows[0].id });
  } catch (err) {
    console.error('❌ Erreur DELETE caveur:', err);
    res.status(500).json({ error: 'Erreur lors de la suppression du caveur' });
  }
});

// ========================================
// ROUTES PRODUITS PHYTOSANITAIRES
// ========================================

app.get('/api/produits-phyto', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM produits_phyto ORDER BY nom_commercial');
    res.json(result.rows);
  } catch (err) {
    console.error('❌ Erreur GET produits phyto:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération des produits phytosanitaires' });
  }
});

app.post('/api/produits-phyto', async (req, res) => {
  const {
    nom_commercial, matiere_active, numero_amm, fabricant, categorie,
    dar_jours, znt_metres, notes
  } = req.body;

  try {
    const result = await pool.query(
      `INSERT INTO produits_phyto (nom_commercial, matiere_active, numero_amm,
                                   fabricant, categorie, dar_jours, znt_metres, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [nom_commercial, emptyToNull(matiere_active), emptyToNull(numero_amm),
       emptyToNull(fabricant), emptyToNull(categorie), emptyToNull(dar_jours),
       emptyToNull(znt_metres), emptyToNull(notes)]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('❌ Erreur POST produit phyto:', err);
    res.status(500).json({ error: 'Erreur lors de la création du produit phytosanitaire' });
  }
});

app.put('/api/produits-phyto/:id', async (req, res) => {
  const {
    nom_commercial, matiere_active, numero_amm, fabricant, categorie,
    dar_jours, znt_metres, notes
  } = req.body;

  try {
    const result = await pool.query(
      `UPDATE produits_phyto
       SET nom_commercial = $1, matiere_active = $2, numero_amm = $3,
           fabricant = $4, categorie = $5, dar_jours = $6, znt_metres = $7,
           notes = $8, updated_at = CURRENT_TIMESTAMP
       WHERE id = $9 RETURNING *`,
      [nom_commercial, emptyToNull(matiere_active), emptyToNull(numero_amm),
       emptyToNull(fabricant), emptyToNull(categorie), emptyToNull(dar_jours),
       emptyToNull(znt_metres), emptyToNull(notes), req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Produit phytosanitaire non trouvé' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('❌ Erreur PUT produit phyto:', err);
    res.status(500).json({ error: 'Erreur lors de la mise à jour du produit phytosanitaire' });
  }
});

app.delete('/api/produits-phyto/:id', async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM produits_phyto WHERE id = $1 RETURNING id', [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Produit phytosanitaire non trouvé' });
    }

    res.json({ message: 'Produit phytosanitaire supprimé', id: result.rows[0].id });
  } catch (err) {
    console.error('❌ Erreur DELETE produit phyto:', err);
    res.status(500).json({ error: 'Erreur lors de la suppression du produit phytosanitaire' });
  }
});

// ========================================
// ROUTES AMENDEMENTS
// ========================================

app.get('/api/amendements', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM amendements_ref ORDER BY nom');
    res.json(result.rows);
  } catch (err) {
    console.error('❌ Erreur GET amendements:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération des amendements' });
  }
});

app.post('/api/amendements', async (req, res) => {
  const {
    nom, type_amendement, npk, cao, utilisable_bio, notes
  } = req.body;

  try {
    const result = await pool.query(
      `INSERT INTO amendements_ref (nom, type_amendement, npk, cao, utilisable_bio, notes)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [nom, emptyToNull(type_amendement), emptyToNull(npk), emptyToNull(cao),
       utilisable_bio || false, emptyToNull(notes)]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('❌ Erreur POST amendement:', err);
    res.status(500).json({ error: 'Erreur lors de la création de l\'amendement' });
  }
});

// ========================================
// GESTION DES ERREURS
// ========================================

app.use((req, res) => {
  res.status(404).json({ error: 'Route non trouvée', code: 'NOT_FOUND' });
});

app.use((err, req, res, next) => {
  console.error('❌ Erreur serveur:', err.stack);
  res.status(500).json({
    error: 'Erreur interne du serveur',
    code: 'INTERNAL_ERROR',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// ========================================
// DÉMARRAGE
// ========================================

app.listen(PORT, () => {
  console.log('========================================');
  console.log('🌳 Serveur API Truffière V2.0.1 CORRIGÉ');
  console.log('========================================');
  console.log(`✅ Serveur démarré sur le port ${PORT}`);
  console.log(`📡 API: http://localhost:${PORT}/api`);
  console.log(`🔐 Auth JWT activée`);
  console.log(`💾 DB: PostgreSQL (${process.env.DB_NAME})`);
  console.log(`📊 Tables séparées: 11 types`);
  console.log('========================================');
});

process.on('SIGTERM', () => {
  console.log('⚠️  SIGTERM reçu, arrêt propre...');
  pool.end(() => {
    console.log('✅ Connexions DB fermées');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('\n⚠️  SIGINT reçu, arrêt propre...');
  pool.end(() => {
    console.log('✅ Connexions DB fermées');
    process.exit(0);
  });
});
