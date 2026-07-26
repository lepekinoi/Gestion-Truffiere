# 🛠️ Utilitaires - API Truffière

Ce dossier contient toutes les fonctions utilitaires de l'application, organisées par catégorie.

## 📁 Structure

```
utils/
├── tokens.js           # Génération et validation JWT/tokens
├── tokenRotation.js    # Rotation sécurisée des refresh tokens
├── validation.js       # Validation et nettoyage des données
├── logging.js          # Logging et audit trail
├── helpers.js          # Fonctions helper générales
├── index.js            # Export centralisé
└── README.md           # Cette documentation
```

---

## 🔑 Tokens (`tokens.js`)

### Génération de tokens

#### `generateAccessToken(user)`
Génère un token JWT d'accès.

```javascript
const { generateAccessToken } = require('./utils');

const token = generateAccessToken({
  id: 1,
  email: 'user@example.com',
  role: 'admin',
  nom: 'Dupont'
});

// Résultat: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

#### `generateRefreshToken()`
Génère un refresh token aléatoire sécurisé.

```javascript
const { generateRefreshToken } = require('./utils');

const { token, hash, expiresAt } = generateRefreshToken();
// token: à envoyer au client
// hash: à stocker en BDD
// expiresAt: Date d'expiration
```

### Autres tokens

```javascript
const { 
  generatePasswordResetToken,      // Reset password (expire 1h)
  generateEmailVerificationToken   // Vérification email (expire 24h)
} = require('./utils');
```

### Validation

```javascript
const { verifyAccessToken, extractBearerToken } = require('./utils');

// Extraire le token du header
const token = extractBearerToken(req.headers.authorization);

// Vérifier et décoder
const payload = verifyAccessToken(token);
if (payload) {
  console.log(payload.userId, payload.role);
}
```

---

## 🔄 Rotation de tokens (`tokenRotation.js`)

### Création avec rotation

```javascript
const { createRotatedToken } = require('./utils');

const tokenData = await createRotatedToken(
  pool,
  userId,
  'Mozilla/5.0...',  // deviceInfo
  '192.168.1.1',     // IP
  'Mozilla/5.0...',  // userAgent
  null               // parentTokenId (null pour nouveau)
);

console.log(tokenData.token);         // Token à envoyer
console.log(tokenData.rotationCount); // Nombre de rotations
```

### Rotation automatique

```javascript
const { rotateRefreshToken } = require('./utils');

try {
  const result = await rotateRefreshToken(
    pool,
    oldToken,
    deviceInfo,
    ipAddress,
    userAgent
  );
  
  // Nouveau token généré, ancien révoqué
  res.json({ 
    accessToken: generateAccessToken(result.user),
    refreshToken: result.token 
  });
} catch (err) {
  if (err.message === 'TOKEN_REUSE_DETECTED') {
    // ⚠️ ALERTE SÉCURITÉ : toutes les sessions révoquées
  }
}
```

### Révocation

```javascript
const { 
  revokeTokenChain,      // Révoquer une chaîne complète
  revokeAllUserTokens    // Révoquer tous les tokens d'un user
} = require('./utils');

// Révoquer une session
await revokeTokenChain(pool, tokenId, 'user_logout');

// Déconnexion de tous les appareils
await revokeAllUserTokens(pool, userId, 'logout_all_devices');
```

---

## ✅ Validation (`validation.js`)

### Nettoyage des données

#### `emptyToNull(value)`
Convertit les valeurs vides en `null` (pour PostgreSQL).

```javascript
const { emptyToNull } = require('./utils');

const nom = emptyToNull(req.body.nom);           // '' → null
const prenom = emptyToNull(req.body.prenom);     // '  ' → null
const ville = emptyToNull(req.body.ville);       // 'Paris' → 'Paris'
```

#### `sanitizeInput(input)`
Nettoie les entrées utilisateur (XSS protection).

```javascript
const { sanitizeInput } = require('./utils');

const clean = sanitizeInput('<script>alert("XSS")</script>Hello');
// Résultat: 'Hello'
```

### Validations métier

```javascript
const { 
  validateEmail,
  validatePhone,
  validateSIRET,
  validateIBAN,
  validateCodePostal
} = require('./utils');

// Email
if (!validateEmail('user@example.com')) {
  throw new Error('Email invalide');
}

// Téléphone français
if (!validatePhone('0612345678')) {
  throw new Error('Téléphone invalide');
}

// SIRET (avec algo Luhn)
if (!validateSIRET('12345678901234')) {
  throw new Error('SIRET invalide');
}

// IBAN (avec mod-97)
if (!validateIBAN('FR76 1234 5678 9012 3456 7890 123')) {
  throw new Error('IBAN invalide');
}
```

### Normalisation

```javascript
const { normalizePhone } = require('./utils');

const phone = normalizePhone('06 12 34 56 78');
// Résultat: '+33612345678'
```

---

## 📝 Logging (`logging.js`)

### Logs métier

#### `logLoginAttempt(pool, email, ip, userAgent, success, reason)`

```javascript
const { logLoginAttempt } = require('./utils');

// Connexion réussie
await logLoginAttempt(pool, email, clientIp, userAgent, true, null);

// Connexion échouée
await logLoginAttempt(pool, email, clientIp, userAgent, false, 'INVALID_PASSWORD');
```

#### `logSecurityEvent(pool, userId, event, details)`

```javascript
const { logSecurityEvent } = require('./utils');

await logSecurityEvent(pool, userId, 'token_reuse_detected', {
  tokenId: 123,
  ipAddress: '192.168.1.1',
  timestamp: new Date()
});
```

#### `logAuditTrail(pool, userId, action, entity, entityId, oldValues, newValues)`

```javascript
const { logAuditTrail } = require('./utils');

// Création
await logAuditTrail(pool, userId, 'create', 'parcelle', 1, null, newData);

// Modification
await logAuditTrail(pool, userId, 'update', 'parcelle', 1, oldData, newData);

// Suppression
await logAuditTrail(pool, userId, 'delete', 'parcelle', 1, oldData, null);
```

### Logs génériques

```javascript
const { logInfo, logWarn, logError, logDebug } = require('./utils');

logInfo('Serveur démarré', { port: 3001 });
logWarn('Tentative suspecte', { ip: '1.2.3.4' });
logError(new Error('Erreur DB'), { query: 'SELECT...' });
logDebug('Variable d\'état', { value: 42 }); // Seulement en dev
```

---

## 🔧 Helpers (`helpers.js`)

### Numérotation

```javascript
const { generateNumeroFacture, generateNumeroCommande } = require('./utils');

const facture = generateNumeroFacture(2026, 1);  // 'FAC-2026-0001'
const commande = generateNumeroCommande(2026, 42); // 'CMD-2026-0042'
```

### Formatage dates

```javascript
const { formatDate } = require('./utils');

const date = new Date('2026-01-28');

formatDate(date, 'short');    // '28/01/2026'
formatDate(date, 'long');     // '28 janvier 2026'
formatDate(date, 'iso');      // '2026-01-28'
formatDate(date, 'datetime'); // '28/01/2026 21:30'
```

### Formatage montants

```javascript
const { formatCurrency, calculateTVA } = require('./utils');

formatCurrency(150.50);  // '150,50 €'
formatCurrency(1200);    // '1 200,00 €'

const { montantTVA, montantTTC } = calculateTVA(100, 20);
// montantTVA: 20.00
// montantTTC: 120.00
```

### Conversions poids

```javascript
const { grammesToKg, kgToGrammes, calculatePrixParKg } = require('./utils');

grammesToKg(1500);              // 1.500
kgToGrammes(2.5);               // 2500
calculatePrixParKg(150, 500);   // 300 (€/kg)
```

### Manipulation texte

```javascript
const { slugify, truncate, capitalize } = require('./utils');

slugify('Parcelle Sud-Ouest');        // 'parcelle-sud-ouest'
truncate('Texte très long...', 10);   // 'Texte t...'
capitalize('PARIS');                   // 'Paris'
```

---

## 📊 Tableau de référence rapide

| Catégorie | Fonction | Usage principal |
|-----------|----------|----------------|
| **Tokens** | `generateAccessToken` | Créer JWT |
| | `generateRefreshToken` | Créer refresh token |
| | `verifyAccessToken` | Valider JWT |
| **Rotation** | `createRotatedToken` | Nouveau token avec rotation |
| | `rotateRefreshToken` | Rotation automatique |
| | `revokeTokenChain` | Révoquer session |
| **Validation** | `emptyToNull` | Nettoyage NULL |
| | `validateEmail` | Valider email |
| | `validateSIRET` | Valider SIRET |
| | `sanitizeInput` | Protection XSS |
| **Logging** | `logLoginAttempt` | Tentative connexion |
| | `logSecurityEvent` | Événement sécurité |
| | `logAuditTrail` | Modification données |
| **Helpers** | `formatCurrency` | Formater montant |
| | `formatDate` | Formater date |
| | `generateNumeroFacture` | Numéro facture |
| | `slugify` | URL-friendly |

---

## 💡 Bonnes pratiques

### 1. Import centralisé

```javascript
// ✅ BON
const { emptyToNull, formatCurrency } = require('./utils');

// ❌ MAUVAIS
const { emptyToNull } = require('./utils/validation');
const { formatCurrency } = require('./utils/helpers');
```

### 2. Validation des entrées

```javascript
// ✅ BON
const { validateEmail, sanitizeInput } = require('./utils');

const email = sanitizeInput(req.body.email);
if (!validateEmail(email)) {
  return res.status(400).json({ error: 'Email invalide' });
}
```

### 3. Logging systématique

```javascript
// ✅ BON : Logger les tentatives de connexion
await logLoginAttempt(pool, email, ip, userAgent, success, reason);

// ✅ BON : Logger les modifications
await logAuditTrail(pool, userId, 'update', 'vente', venteId, old, new);
```

### 4. Gestion des erreurs

```javascript
// ✅ BON
const { logError } = require('./utils');

try {
  await riskyOperation();
} catch (err) {
  logError(err, { userId, action: 'risky_operation' });
  throw err;
}
```

---

## 🔗 Voir aussi

- [config/](../config/README.md) - Configuration centralisée
- [middleware/](../middleware/README.md) - Middlewares
- [routes/](../routes/) - Routes de l'API

---

**Documentation générée le** : 28 janvier 2026  
**Dernière mise à jour** : 14 mai 2026  
**Version** : V8 (2.0.3)
