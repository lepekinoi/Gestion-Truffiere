-- ============================================================================
-- MIGRATION 002: Rotation Automatique des Refresh Tokens
-- Date: 2026-01-20
-- Description: Amélioration de la sécurité avec rotation des tokens
-- ============================================================================

-- Supprimer l'ancienne table si elle existe (ATTENTION: perte de données)
-- DROP TABLE IF EXISTS refresh_tokens CASCADE;

-- Créer ou recréer la table avec les nouveaux champs
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Token hashé (jamais stocker le token en clair!)
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    
    -- Chaîne de rotation
    parent_token_id INTEGER REFERENCES refresh_tokens(id) ON DELETE SET NULL,
    rotation_count INTEGER DEFAULT 0 NOT NULL,
    
    -- Informations de session
    device_info VARCHAR(255),
    ip_address VARCHAR(45),
    user_agent TEXT,
    
    -- Gestion de la révocation
    revoked BOOLEAN DEFAULT FALSE NOT NULL,
    revoked_at TIMESTAMP,
    revoked_reason VARCHAR(100),
    
    -- Dates
    expires_at TIMESTAMP NOT NULL,
    last_used_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    
    -- Contraintes
    CONSTRAINT rotation_count_positive CHECK (rotation_count >= 0),
    CONSTRAINT rotation_count_limit CHECK (rotation_count <= 10)
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token_hash ON refresh_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_revoked ON refresh_tokens(revoked) WHERE revoked = FALSE;
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_parent ON refresh_tokens(parent_token_id);

-- Fonction pour révoquer automatiquement une chaîne de tokens
CREATE OR REPLACE FUNCTION revoke_token_chain(p_token_id INTEGER, p_reason VARCHAR)
RETURNS INTEGER AS $$
DECLARE
    v_revoked_count INTEGER := 0;
BEGIN
    -- Révoquer le token actuel
    UPDATE refresh_tokens
    SET revoked = TRUE,
        revoked_at = NOW(),
        revoked_reason = p_reason
    WHERE id = p_token_id
      AND revoked = FALSE;
    
    GET DIAGNOSTICS v_revoked_count = ROW_COUNT;
    
    -- Révoquer tous les tokens enfants (récursif)
    WITH RECURSIVE token_tree AS (
        SELECT id FROM refresh_tokens WHERE parent_token_id = p_token_id
        UNION ALL
        SELECT rt.id FROM refresh_tokens rt
        INNER JOIN token_tree tt ON rt.parent_token_id = tt.id
    )
    UPDATE refresh_tokens
    SET revoked = TRUE,
        revoked_at = NOW(),
        revoked_reason = p_reason || '_chain'
    WHERE id IN (SELECT id FROM token_tree)
      AND revoked = FALSE;
    
    GET DIAGNOSTICS v_revoked_count = v_revoked_count + ROW_COUNT;
    
    RETURN v_revoked_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION revoke_token_chain IS 'Révoque un token et toute sa chaîne de rotation';

-- Fonction pour nettoyer les tokens expirés et révoqués
CREATE OR REPLACE FUNCTION cleanup_expired_refresh_tokens(p_days_old INTEGER DEFAULT 30)
RETURNS INTEGER AS $$
DECLARE
    v_deleted_count INTEGER;
BEGIN
    DELETE FROM refresh_tokens
    WHERE (expires_at < NOW() - INTERVAL '1 day' * p_days_old)
       OR (revoked = TRUE AND revoked_at < NOW() - INTERVAL '1 day' * p_days_old);
    
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    
    RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_expired_refresh_tokens IS 'Supprime les tokens expirés ou révoqués de plus de X jours';

-- Vue pour obtenir les statistiques de tokens
CREATE OR REPLACE VIEW v_token_stats AS
SELECT 
    u.id as user_id,
    u.email,
    u.nom,
    COUNT(rt.id) FILTER (WHERE rt.revoked = FALSE AND rt.expires_at > NOW()) as active_tokens,
    COUNT(rt.id) FILTER (WHERE rt.revoked = TRUE) as revoked_tokens,
    COUNT(rt.id) FILTER (WHERE rt.expires_at < NOW()) as expired_tokens,
    MAX(rt.created_at) as last_token_created,
    MAX(rt.last_used_at) as last_token_used
FROM users u
LEFT JOIN refresh_tokens rt ON u.id = rt.user_id
GROUP BY u.id, u.email, u.nom;

COMMENT ON VIEW v_token_stats IS 'Statistiques des refresh tokens par utilisateur';

-- Trigger pour mettre à jour last_used_at automatiquement
CREATE OR REPLACE FUNCTION update_token_last_used()
RETURNS TRIGGER AS $$
BEGIN
    NEW.last_used_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Note: Le trigger sera créé manuellement si nécessaire pour éviter les mises à jour intempestives
-- CREATE TRIGGER refresh_tokens_update_last_used
-- BEFORE UPDATE ON refresh_tokens
-- FOR EACH ROW
-- WHEN (OLD.* IS DISTINCT FROM NEW.*)
-- EXECUTE FUNCTION update_token_last_used();

-- Fonction pour détecter la réutilisation de tokens (attaque potentielle)
CREATE OR REPLACE FUNCTION detect_token_reuse(p_token_hash VARCHAR)
RETURNS TABLE(
    is_reused BOOLEAN,
    user_id INTEGER,
    token_id INTEGER,
    last_used TIMESTAMP
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        rt.revoked OR rt.expires_at < NOW() as is_reused,
        rt.user_id,
        rt.id as token_id,
        rt.last_used_at
    FROM refresh_tokens rt
    WHERE rt.token_hash = p_token_hash;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION detect_token_reuse IS 'Détecte si un token a été réutilisé (possible attaque)';

-- ============================================================================
-- MIGRATION DES DONNÉES EXISTANTES (si applicable)
-- ============================================================================

-- Si vous avez des tokens existants, vous devrez les révoquer et forcer
-- une nouvelle connexion pour tous les utilisateurs:
-- UPDATE refresh_tokens SET revoked = TRUE, revoked_reason = 'migration' WHERE revoked = FALSE;

-- ============================================================================
-- GRANTS (ajustez selon vos besoins)
-- ============================================================================

-- GRANT SELECT, INSERT, UPDATE, DELETE ON refresh_tokens TO your_app_user;
-- GRANT USAGE ON SEQUENCE refresh_tokens_id_seq TO your_app_user;
-- GRANT EXECUTE ON FUNCTION revoke_token_chain TO your_app_user;
-- GRANT EXECUTE ON FUNCTION cleanup_expired_refresh_tokens TO your_app_user;
-- GRANT SELECT ON v_token_stats TO your_app_user;

-- ============================================================================
-- TESTS DE VALIDATION
-- ============================================================================

-- Test 1: Vérifier la structure
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'refresh_tokens'
ORDER BY ordinal_position;

-- Test 2: Vérifier les index
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'refresh_tokens';

-- ============================================================================
-- FIN DE LA MIGRATION
-- ============================================================================
