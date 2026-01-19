// ============================================================
// tokenRotation.test.js - Tests pour la rotation des tokens
// Exécutez avec: npm test
// ============================================================

const tokenRotation = require('../utils/tokenRotation');
const { Pool } = require('pg');
require('dotenv').config();

// Configuration de test
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'truffiere_test',
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

// Utilisateur de test
let testUserId = null;
const testEmail = 'test-token-rotation@example.com';

// ============================================================
// SETUP ET TEARDOWN
// ============================================================

beforeAll(async () => {
  console.log('\n🔧 Setup: Création de l\'utilisateur de test...');
  
  // Créer un utilisateur de test
  const result = await pool.query(
    `INSERT INTO users (email, password_hash, nom, role, is_active, email_verified)
     VALUES ($1, $2, $3, $4, true, true)
     ON CONFLICT (email) DO UPDATE SET nom = EXCLUDED.nom
     RETURNING id`,
    [testEmail, '$2a$12$dummyhash', 'Test User', 'user']
  );
  
  testUserId = result.rows[0].id;
  console.log(`✅ Utilisateur de test créé avec ID: ${testUserId}`);
});

afterAll(async () => {
  console.log('\n🧹 Teardown: Nettoyage...');
  
  // Supprimer tous les tokens de test
  await pool.query('DELETE FROM refresh_tokens WHERE user_id = $1', [testUserId]);
  
  // Supprimer l'utilisateur de test
  await pool.query('DELETE FROM users WHERE id = $1', [testUserId]);
  
  await pool.end();
  console.log('✅ Nettoyage terminé');
});

beforeEach(async () => {
  // Nettoyer les tokens avant chaque test
  await pool.query('DELETE FROM refresh_tokens WHERE user_id = $1', [testUserId]);
});

// ============================================================
// TESTS DE GÉNÉRATION DE TOKENS
// ============================================================

describe('Génération de Tokens', () => {
  test('generateRefreshToken() doit générer un token et son hash', () => {
    const { token, hash } = tokenRotation.generateRefreshToken();
    
    expect(token).toBeDefined();
    expect(hash).toBeDefined();
    expect(token).toHaveLength(128); // 64 bytes en hexadécimal
    expect(hash).toHaveLength(64); // SHA256 en hexadécimal
  });

  test('hashToken() doit produire le même hash pour le même token', () => {
    const { token, hash } = tokenRotation.generateRefreshToken();
    const computedHash = tokenRotation.hashToken(token);
    
    expect(computedHash).toBe(hash);
  });

  test('Deux tokens générés doivent être différents', () => {
    const token1 = tokenRotation.generateRefreshToken();
    const token2 = tokenRotation.generateRefreshToken();
    
    expect(token1.token).not.toBe(token2.token);
    expect(token1.hash).not.toBe(token2.hash);
  });
});

// ============================================================
// TESTS DE CRÉATION DE TOKENS
// ============================================================

describe('Création de Tokens', () => {
  test('createRotatedToken() doit créer un nouveau token en base', async () => {
    const result = await tokenRotation.createRotatedToken(
      pool,
      testUserId,
      'Chrome/91.0',
      '192.168.1.1',
      'Mozilla/5.0'
    );

    expect(result).toHaveProperty('token');
    expect(result).toHaveProperty('tokenId');
    expect(result).toHaveProperty('expiresAt');
    expect(result.rotationCount).toBe(0);

    // Vérifier en base
    const dbCheck = await pool.query(
      'SELECT * FROM refresh_tokens WHERE id = $1',
      [result.tokenId]
    );

    expect(dbCheck.rows).toHaveLength(1);
    expect(dbCheck.rows[0].user_id).toBe(testUserId);
    expect(dbCheck.rows[0].revoked).toBe(false);
  });

  test('createRotatedToken() avec parent doit incrémenter rotation_count', async () => {
    // Créer un token parent
    const parent = await tokenRotation.createRotatedToken(
      pool, testUserId, 'Device1', '192.168.1.1', 'UA1'
    );

    // Créer un token enfant
    const child = await tokenRotation.createRotatedToken(
      pool, testUserId, 'Device1', '192.168.1.1', 'UA1', parent.tokenId
    );

    expect(child.rotationCount).toBe(1);
  });

  test('createRotatedToken() doit refuser plus de 10 rotations', async () => {
    // Créer une chaîne de 10 rotations
    let currentTokenId = null;
    
    for (let i = 0; i < 10; i++) {
      const result = await tokenRotation.createRotatedToken(
        pool, testUserId, 'Device', '192.168.1.1', 'UA', currentTokenId
      );
      currentTokenId = result.tokenId;
    }

    // La 11ème rotation doit échouer
    await expect(
      tokenRotation.createRotatedToken(
        pool, testUserId, 'Device', '192.168.1.1', 'UA', currentTokenId
      )
    ).rejects.toThrow('MAX_ROTATION_EXCEEDED');
  });
});

// ============================================================
// TESTS DE ROTATION
// ============================================================

describe('Rotation de Tokens', () => {
  test('rotateRefreshToken() doit remplacer un token valide', async () => {
    // Créer un token initial
    const initial = await tokenRotation.createRotatedToken(
      pool, testUserId, 'Chrome', '192.168.1.1', 'UA'
    );

    // Effectuer la rotation
    const rotated = await tokenRotation.rotateRefreshToken(
      pool, initial.token, 'Chrome', '192.168.1.1', 'UA'
    );

    expect(rotated).toHaveProperty('token');
    expect(rotated.token).not.toBe(initial.token);
    expect(rotated.user).toHaveProperty('id', testUserId);

    // Vérifier que l'ancien token est révoqué
    const oldTokenCheck = await pool.query(
      'SELECT revoked, revoked_reason FROM refresh_tokens WHERE id = $1',
      [initial.tokenId]
    );

    expect(oldTokenCheck.rows[0].revoked).toBe(true);
    expect(oldTokenCheck.rows[0].revoked_reason).toBe('rotated');
  });

  test('rotateRefreshToken() doit refuser un token déjà utilisé', async () => {
    // Créer et utiliser un token
    const initial = await tokenRotation.createRotatedToken(
      pool, testUserId, 'Chrome', '192.168.1.1', 'UA'
    );

    // Première rotation (succès)
    await tokenRotation.rotateRefreshToken(
      pool, initial.token, 'Chrome', '192.168.1.1', 'UA'
    );

    // Deuxième rotation avec le même token (doit échouer)
    await expect(
      tokenRotation.rotateRefreshToken(
        pool, initial.token, 'Chrome', '192.168.1.1', 'UA'
      )
    ).rejects.toThrow('TOKEN_REUSE_DETECTED');
  });

  test('rotateRefreshToken() doit refuser un token expiré', async () => {
    // Créer un token expiré
    const { token, hash } = tokenRotation.generateRefreshToken();
    
    await pool.query(
      `INSERT INTO refresh_tokens (user_id, token_hash, device_info, ip_address, expires_at)
       VALUES ($1, $2, $3, $4, NOW() - INTERVAL '1 day')`,
      [testUserId, hash, 'Chrome', '192.168.1.1']
    );

    // Tenter la rotation
    await expect(
      tokenRotation.rotateRefreshToken(pool, token, 'Chrome', '192.168.1.1', 'UA')
    ).rejects.toThrow('TOKEN_EXPIRED');
  });

  test('rotateRefreshToken() doit refuser pour utilisateur inactif', async () => {
    // Désactiver l'utilisateur
    await pool.query('UPDATE users SET is_active = false WHERE id = $1', [testUserId]);

    // Créer un token
    const initial = await tokenRotation.createRotatedToken(
      pool, testUserId, 'Chrome', '192.168.1.1', 'UA'
    );

    // Tenter la rotation
    await expect(
      tokenRotation.rotateRefreshToken(pool, initial.token, 'Chrome', '192.168.1.1', 'UA')
    ).rejects.toThrow('USER_INACTIVE');

    // Réactiver pour les autres tests
    await pool.query('UPDATE users SET is_active = true WHERE id = $1', [testUserId]);
  });
});

// ============================================================
// TESTS DE RÉVOCATION
// ============================================================

describe('Révocation de Tokens', () => {
  test('revokeTokenChain() doit révoquer un token et ses enfants', async () => {
    // Créer une chaîne: parent -> child1 -> child2
    const parent = await tokenRotation.createRotatedToken(
      pool, testUserId, 'Device', '192.168.1.1', 'UA'
    );
    
    const child1 = await tokenRotation.createRotatedToken(
      pool, testUserId, 'Device', '192.168.1.1', 'UA', parent.tokenId
    );
    
    const child2 = await tokenRotation.createRotatedToken(
      pool, testUserId, 'Device', '192.168.1.1', 'UA', child1.tokenId
    );

    // Révoquer à partir du parent
    const revokedCount = await tokenRotation.revokeTokenChain(
      pool, parent.tokenId, 'test_revocation'
    );

    expect(revokedCount).toBeGreaterThanOrEqual(3);

    // Vérifier que tous sont révoqués
    const check = await pool.query(
      'SELECT COUNT(*) as count FROM refresh_tokens WHERE id IN ($1, $2, $3) AND revoked = true',
      [parent.tokenId, child1.tokenId, child2.tokenId]
    );

    expect(parseInt(check.rows[0].count)).toBe(3);
  });

  test('revokeAllUserTokens() doit révoquer tous les tokens actifs', async () => {
    // Créer plusieurs tokens
    await tokenRotation.createRotatedToken(pool, testUserId, 'Device1', '192.168.1.1', 'UA1');
    await tokenRotation.createRotatedToken(pool, testUserId, 'Device2', '192.168.1.2', 'UA2');
    await tokenRotation.createRotatedToken(pool, testUserId, 'Device3', '192.168.1.3', 'UA3');

    // Révoquer tous
    const revokedCount = await tokenRotation.revokeAllUserTokens(
      pool, testUserId, 'logout_all'
    );

    expect(revokedCount).toBe(3);

    // Vérifier
    const check = await pool.query(
      'SELECT COUNT(*) as count FROM refresh_tokens WHERE user_id = $1 AND revoked = false',
      [testUserId]
    );

    expect(parseInt(check.rows[0].count)).toBe(0);
  });
});

// ============================================================
// TESTS DE NETTOYAGE ET STATISTIQUES
// ============================================================

describe('Nettoyage et Statistiques', () => {
  test('getTokenStats() doit retourner des statistiques correctes', async () => {
    // Créer des tokens dans différents états
    const token1 = await tokenRotation.createRotatedToken(
      pool, testUserId, 'Device', '192.168.1.1', 'UA'
    );
    
    await tokenRotation.revokeTokenChain(pool, token1.tokenId, 'test');
    
    await tokenRotation.createRotatedToken(
      pool, testUserId, 'Device', '192.168.1.1', 'UA'
    );

    // Récupérer les stats
    const stats = await tokenRotation.getTokenStats(pool, testUserId);

    expect(stats).toHaveProperty('active_tokens');
    expect(stats).toHaveProperty('revoked_tokens');
    expect(parseInt(stats.active_tokens)).toBe(1);
    expect(parseInt(stats.revoked_tokens)).toBe(1);
  });

  test('getActiveSessions() doit retourner uniquement les sessions actives', async () => {
    // Créer tokens actifs et révoqués
    const token1 = await tokenRotation.createRotatedToken(
      pool, testUserId, 'Device1', '192.168.1.1', 'UA1'
    );
    
    await tokenRotation.createRotatedToken(
      pool, testUserId, 'Device2', '192.168.1.2', 'UA2'
    );
    
    await tokenRotation.revokeTokenChain(pool, token1.tokenId, 'test');

    // Récupérer les sessions actives
    const sessions = await tokenRotation.getActiveSessions(pool, testUserId);

    expect(sessions).toHaveLength(1);
    expect(sessions[0].device_info).toBe('Device2');
  });
});

// ============================================================
// EXECUTION
// ============================================================

console.log('\n🧪 Démarrage des tests de rotation de tokens...\n');
