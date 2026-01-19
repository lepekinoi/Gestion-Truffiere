# Guide d'Implémentation - Rotation Automatique des Refresh Tokens

## 🔒 Vue d'Ensemble

La rotation automatique des refresh tokens est une mesure de sécurité essentielle qui prévient la réutilisation de tokens volés. À chaque utilisation d'un refresh token pour obtenir un nouveau access token, l'ancien refresh token est révoqué et un nouveau est généré.

### Avantages de Sécurité

1. **Détection de vol de token** : Si un token volé est réutilisé, le système détecte la réutilisation
2. **Fenêtre d'exposition réduite** : Chaque token n'est valide qu'une seule fois
3. **Révocation en cascade** : En cas de détection d'attaque, toute la chaîne de tokens est révoquée
4. **Traçabilité** : Historique complet des rotations et utilisations

---

## 🛠️ Installation

### 1. Exécuter la Migration SQL

```bash
# Connectez-vous à PostgreSQL
psql -U votre_utilisateur -d truffiere

# Exécutez la migration
\i backend/migrations/002_refresh_token_rotation.sql
```

### 2. Vérifier la Migration

```sql
-- Vérifier la structure de la table
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'refresh_tokens';

-- Vérifier les fonctions
\df revoke_token_chain
\df cleanup_expired_refresh_tokens
```

### 3. Ajouter les Variables d'Environnement

Dans votre fichier `.env` :

```env
# Durée de validité des refresh tokens (en jours)
REFRESH_TOKEN_EXPIRES_DAYS=7

# Activer les logs de sécurité détaillés
SECURITY_LOGS=true
```

---

## 📝 Intégration dans server.js

### Étape 1: Importer le Module

Au début de `server.js`, après les autres imports :

```javascript
const tokenRotation = require('./utils/tokenRotation');
```

### Étape 2: Modifier la Route de Login

Remplacez la logique de génération de refresh token dans `POST /api/auth/login` :

```javascript
app.post('/api/auth/login', authLimiter, async (req, res) => {
  const { email, password } = req.body;
  const clientIp = req.ip || req.connection.remoteAddress;
  const userAgent = req.get('User-Agent') || 'Unknown';

  try {
    // ... (code existant de validation email/password)
    
    // Générer l'access token (inchangé)
    const accessToken = generateAccessToken(user);
    
    // **NOUVEAU: Utiliser la rotation pour créer le refresh token**
    const refreshTokenData = await tokenRotation.createRotatedToken(
      pool,
      user.id,
      userAgent.substring(0, 255),
      clientIp,
      userAgent
    );

    // Réinitialiser les échecs de connexion
    await pool.query(
      'UPDATE users SET failed_login_attempts = 0, locked_until = NULL, last_login = NOW() WHERE id = $1',
      [user.id]
    );

    await logLoginAttempt(email, clientIp, userAgent, true, null);

    res.json({
      message: 'Connexion réussie',
      accessToken,
      refreshToken: refreshTokenData.token,
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
    console.error('Erreur login:', err);
    res.status(500).json({ error: 'Erreur lors de la connexion', code: 'LOGIN_ERROR' });
  }
});
```

### Étape 3: Modifier la Route de Refresh (✨ CLÉ PRINCIPALE)

Remplacez ENTIÈREMENT la route `POST /api/auth/refresh` :

```javascript
app.post('/api/auth/refresh', async (req, res) => {
  const { refreshToken } = req.body;
  const clientIp = req.ip || req.connection.remoteAddress;
  const userAgent = req.get('User-Agent') || 'Unknown';

  try {
    if (!refreshToken) {
      return res.status(400).json({ 
        error: 'Refresh token requis', 
        code: 'MISSING_TOKEN' 
      });
    }

    // **ROTATION AUTOMATIQUE**
    const rotationResult = await tokenRotation.rotateRefreshToken(
      pool,
      refreshToken,
      userAgent.substring(0, 255),
      clientIp,
      userAgent
    );

    // Générer un nouveau access token
    const accessToken = generateAccessToken(rotationResult.user);

    res.json({ 
      accessToken, 
      refreshToken: rotationResult.token, // NOUVEAU token
      expiresIn: JWT_EXPIRES_IN 
    });

  } catch (err) {
    console.error('Erreur refresh:', err);

    // Gestion des erreurs spécifiques
    if (err.message === 'TOKEN_REUSE_DETECTED') {
      return res.status(401).json({ 
        error: 'Token réutilisé - Toutes les sessions ont été révoquées', 
        code: 'SECURITY_BREACH',
        action: 'FORCE_LOGOUT'
      });
    }

    if (err.message === 'TOKEN_EXPIRED') {
      return res.status(401).json({ 
        error: 'Token expiré', 
        code: 'TOKEN_EXPIRED' 
      });
    }

    if (err.message === 'INVALID_TOKEN') {
      return res.status(401).json({ 
        error: 'Token invalide', 
        code: 'INVALID_TOKEN' 
      });
    }

    if (err.message === 'USER_INACTIVE') {
      return res.status(403).json({ 
        error: 'Compte désactivé', 
        code: 'ACCOUNT_DISABLED' 
      });
    }

    if (err.message === 'MAX_ROTATION_EXCEEDED') {
      return res.status(401).json({ 
        error: 'Trop de rotations - Veuillez vous reconnecter', 
        code: 'MAX_ROTATION_EXCEEDED' 
      });
    }

    res.status(500).json({ 
      error: 'Erreur lors du rafraîchissement', 
      code: 'REFRESH_ERROR' 
    });
  }
});
```

### Étape 4: Modifier la Route de Logout

```javascript
app.post('/api/auth/logout', authMiddleware, async (req, res) => {
  const { refreshToken } = req.body;

  try {
    if (refreshToken) {
      const tokenHash = tokenRotation.hashToken(refreshToken);
      
      // Trouver l'ID du token
      const tokenResult = await pool.query(
        'SELECT id FROM refresh_tokens WHERE token_hash = $1',
        [tokenHash]
      );

      if (tokenResult.rows.length > 0) {
        // Révoquer la chaîne complète
        await tokenRotation.revokeTokenChain(
          pool, 
          tokenResult.rows[0].id, 
          'user_logout'
        );
      }
    }
    
    res.json({ message: 'Déconnexion réussie' });
  } catch (err) {
    console.error('Erreur logout:', err);
    res.status(500).json({ 
      error: 'Erreur lors de la déconnexion', 
      code: 'LOGOUT_ERROR' 
    });
  }
});
```

### Étape 5: Modifier Logout All Devices

```javascript
app.post('/api/auth/logout-all', authMiddleware, async (req, res) => {
  try {
    const revokedCount = await tokenRotation.revokeAllUserTokens(
      pool, 
      req.user.id, 
      'logout_all_devices'
    );
    
    res.json({ 
      message: 'Déconnexion de tous les appareils', 
      sessionsRevoked: revokedCount 
    });
  } catch (err) {
    console.error('Erreur logout-all:', err);
    res.status(500).json({ 
      error: 'Erreur', 
      code: 'LOGOUT_ALL_ERROR' 
    });
  }
});
```

### Étape 6: Ajouter des Routes Administratives

Ajoutez ces nouvelles routes pour la gestion :

```javascript
// GET /api/auth/sessions - Voir ses sessions actives
app.get('/api/auth/sessions', authMiddleware, async (req, res) => {
  try {
    const sessions = await tokenRotation.getActiveSessions(pool, req.user.id);
    res.json(sessions);
  } catch (err) {
    console.error('Erreur get sessions:', err);
    res.status(500).json({ 
      error: 'Erreur', 
      code: 'GET_SESSIONS_ERROR' 
    });
  }
});

// GET /api/auth/token-stats - Statistiques des tokens (admin)
app.get('/api/auth/token-stats', authMiddleware, requireRole('admin'), async (req, res) => {
  try {
    const stats = await tokenRotation.getTokenStats(pool, req.query.userId || req.user.id);
    res.json(stats);
  } catch (err) {
    console.error('Erreur token stats:', err);
    res.status(500).json({ 
      error: 'Erreur', 
      code: 'TOKEN_STATS_ERROR' 
    });
  }
});

// POST /api/auth/cleanup-tokens - Nettoyer les tokens expirés (admin)
app.post('/api/auth/cleanup-tokens', authMiddleware, requireRole('admin'), async (req, res) => {
  try {
    const daysOld = parseInt(req.body.daysOld) || 30;
    const deletedCount = await tokenRotation.cleanupExpiredTokens(pool, daysOld);
    
    res.json({ 
      message: 'Nettoyage effectué', 
      deletedCount 
    });
  } catch (err) {
    console.error('Erreur cleanup:', err);
    res.status(500).json({ 
      error: 'Erreur', 
      code: 'CLEANUP_ERROR' 
    });
  }
});
```

---

## 📱 Intégration Côté Frontend

### Gestion du Nouveau Refresh Token

Après chaque appel à `/api/auth/refresh`, le frontend DOIT :

1. **Remplacer** l'ancien refresh token par le nouveau
2. **Stocker** le nouveau token de manière sécurisée
3. **Gérer** l'erreur `TOKEN_REUSE_DETECTED` en déconnectant l'utilisateur

```javascript
// Exemple avec Axios
async function refreshAccessToken() {
  try {
    const oldRefreshToken = localStorage.getItem('refreshToken');
    
    const response = await axios.post('/api/auth/refresh', {
      refreshToken: oldRefreshToken
    });

    // ⚠️ IMPORTANT: Remplacer l'ancien token
    localStorage.setItem('accessToken', response.data.accessToken);
    localStorage.setItem('refreshToken', response.data.refreshToken);

    return response.data.accessToken;

  } catch (error) {
    if (error.response?.data?.code === 'SECURITY_BREACH') {
      // Attaque détectée - Déconnexion forcée
      alert('Sécurité: Activité suspecte détectée. Veuillez vous reconnecter.');
      logout();
    } else if (error.response?.data?.code === 'TOKEN_EXPIRED') {
      // Token expiré - Rediriger vers login
      window.location.href = '/login';
    }
    throw error;
  }
}
```

---

## 🐛 Dépannage

### Problème: "TOKEN_REUSE_DETECTED" en utilisation normale

**Cause**: Plusieurs onglets ou fenêtres utilisent le même refresh token simultanément.

**Solution**: Augmenter `ROTATION_WINDOW_SECONDS` dans `tokenRotation.js` :

```javascript
const ROTATION_CONFIG = {
  ROTATION_WINDOW_SECONDS: 60, // Au lieu de 30
};
```

### Problème: Tokens non nettoyés

**Solution**: Ajouter un cron job pour nettoyer automatiquement :

```javascript
// Dans server.js
const cron = require('node-cron');

// Tous les jours à 3h du matin
cron.schedule('0 3 * * *', async () => {
  try {
    const deleted = await tokenRotation.cleanupExpiredTokens(pool, 30);
    console.log(`✔ Nettoyage automatique: ${deleted} tokens supprimés`);
  } catch (err) {
    console.error('❌ Erreur nettoyage automatique:', err);
  }
});
```

---

## 📊 Monitoring et Alertes

### Logs de Sécurité

Tous les événements de sécurité sont loggés avec le préfixe `[⚠️ ALERTE SÉCURITÉ]`.

### Requêtes de Surveillance

```sql
-- Tokens récemment réutilisés (attaques potentielles)
SELECT 
  rt.id,
  u.email,
  rt.revoked_reason,
  rt.revoked_at,
  rt.ip_address
FROM refresh_tokens rt
JOIN users u ON rt.user_id = u.id
WHERE rt.revoked_reason LIKE '%reuse%'
  AND rt.revoked_at > NOW() - INTERVAL '24 hours'
ORDER BY rt.revoked_at DESC;

-- Utilisateurs avec le plus de rotations
SELECT 
  u.email,
  MAX(rt.rotation_count) as max_rotations,
  COUNT(rt.id) as total_tokens
FROM users u
JOIN refresh_tokens rt ON u.id = rt.user_id
GROUP BY u.email
ORDER BY max_rotations DESC
LIMIT 10;
```

---

## ✅ Liste de Vérification

- [ ] Migration SQL exécutée
- [ ] Module `tokenRotation.js` importé
- [ ] Route `/api/auth/login` modifiée
- [ ] Route `/api/auth/refresh` remplacée
- [ ] Route `/api/auth/logout` modifiée
- [ ] Routes administratives ajoutées
- [ ] Frontend mis à jour pour stocker le nouveau token
- [ ] Tests effectués en environnement de développement
- [ ] Monitoring mis en place
- [ ] Cron job de nettoyage configuré

---

## 📚 Références

- [OWASP: Token Binding](https://cheatsheetseries.owasp.org/cheatsheets/JSON_Web_Token_for_Java_Cheat_Sheet.html)
- [RFC 6819: OAuth 2.0 Threat Model](https://tools.ietf.org/html/rfc6819#section-5.2)
- [Auth0: Refresh Token Rotation](https://auth0.com/docs/secure/tokens/refresh-tokens/refresh-token-rotation)
