-- ============================================================================
-- MIGRATION 002B: Ajout des Colonnes de Rotation (CORRECTIF)
-- Date: 2026-01-20
-- Description: Ajoute les colonnes manquantes à la table refresh_tokens existante
-- ============================================================================

-- Vérifier les colonnes existantes
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'refresh_tokens'
ORDER BY ordinal_position;

COMMENT ON TABLE refresh_tokens IS 'Ajout des colonnes pour la rotation automatique';

-- ============================================================================
-- AJOUT DES COLONNES MANQUANTES
-- ============================================================================

-- 1. Colonne parent_token_id pour la chaîne de rotation
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'refresh_tokens' AND column_name = 'parent_token_id'
    ) THEN
        ALTER TABLE refresh_tokens ADD COLUMN parent_token_id INTEGER;
        ALTER TABLE refresh_tokens ADD CONSTRAINT fk_parent_token 
            FOREIGN KEY (parent_token_id) REFERENCES refresh_tokens(id) ON DELETE SET NULL;
        CREATE INDEX idx_refresh_tokens_parent ON refresh_tokens(parent_token_id);
        RAISE NOTICE '✅ Colonne parent_token_id ajoutée';
    ELSE
        RAISE NOTICE '⏭️  Colonne parent_token_id existe déjà';
    END IF;
END $$;

-- 2. Colonne rotation_count
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'refresh_tokens' AND column_name = 'rotation_count'
    ) THEN
        ALTER TABLE refresh_tokens ADD COLUMN rotation_count INTEGER DEFAULT 0 NOT NULL;
        ALTER TABLE refresh_tokens ADD CONSTRAINT rotation_count_positive CHECK (rotation_count >= 0);
        ALTER TABLE refresh_tokens ADD CONSTRAINT rotation_count_limit CHECK (rotation_count <= 10);
        RAISE NOTICE '✅ Colonne rotation_count ajoutée';
    ELSE
        RAISE NOTICE '⏭️  Colonne rotation_count existe déjà';
    END IF;
END $$;

-- 3. Colonne user_agent
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'refresh_tokens' AND column_name = 'user_agent'
    ) THEN
        ALTER TABLE refresh_tokens ADD COLUMN user_agent TEXT;
        RAISE NOTICE '✅ Colonne user_agent ajoutée';
    ELSE
        RAISE NOTICE '⏭️  Colonne user_agent existe déjà';
    END IF;
END $$;

-- 4. Colonne last_used_at
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'refresh_tokens' AND column_name = 'last_used_at'
    ) THEN
        ALTER TABLE refresh_tokens ADD COLUMN last_used_at TIMESTAMP;
        RAISE NOTICE '✅ Colonne last_used_at ajoutée';
    ELSE
        RAISE NOTICE '⏭️  Colonne last_used_at existe déjà';
    END IF;
END $$;

-- 5. Modifier token en token_hash si nécessaire
DO $$ 
BEGIN
    -- Vérifier si la colonne 'token' existe (ancienne version)
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'refresh_tokens' AND column_name = 'token'
    ) THEN
        -- Si token_hash n'existe pas encore, renommer
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'refresh_tokens' AND column_name = 'token_hash'
        ) THEN
            ALTER TABLE refresh_tokens RENAME COLUMN token TO token_hash;
            
            -- Ajouter contrainte UNIQUE sur token_hash
            ALTER TABLE refresh_tokens ADD CONSTRAINT refresh_tokens_token_hash_key UNIQUE (token_hash);
            
            RAISE NOTICE '✅ Colonne token renommée en token_hash';
            RAISE WARNING '⚠️  IMPORTANT: Les tokens existants doivent être hashés en SHA256!';
        END IF;
    ELSE
        RAISE NOTICE '✅ Colonne token_hash existe déjà';
    END IF;
END $$;

-- ============================================================================
-- MISE À JOUR DES INDEX
-- ============================================================================

-- Index sur parent_token_id (déjà créé ci-dessus)
-- CREATE INDEX IF NOT EXISTS idx_refresh_tokens_parent ON refresh_tokens(parent_token_id);

-- ============================================================================
-- FONCTIONS CORRIGÉES
-- ============================================================================

-- Supprimer l'ancienne fonction si elle existe
DROP FUNCTION IF EXISTS revoke_token_chain(INTEGER, VARCHAR);

-- Recréer la fonction de révocation en cascade
CREATE OR REPLACE FUNCTION revoke_token_chain(p_token_id INTEGER, p_reason VARCHAR)
RETURNS INTEGER AS $$
DECLARE
    v_revoked_count INTEGER := 0;
    v_child_count INTEGER := 0;
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
    
    GET DIAGNOSTICS v_child_count = ROW_COUNT;
    
    RETURN v_revoked_count + v_child_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION revoke_token_chain IS 'Révoque un token et toute sa chaîne de rotation';

-- Fonction de nettoyage
DROP FUNCTION IF EXISTS cleanup_expired_refresh_tokens(INTEGER);

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

-- Fonction de détection de réutilisation
DROP FUNCTION IF EXISTS detect_token_reuse(VARCHAR);

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
-- VUE DES STATISTIQUES (CORRIGÉE)
-- ============================================================================

DROP VIEW IF EXISTS v_token_stats;

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

-- ============================================================================
-- MIGRATION DES DONNÉES EXISTANTES
-- ============================================================================

DO $$
DECLARE
    v_token_count INTEGER;
BEGIN
    -- Compter les tokens existants
    SELECT COUNT(*) INTO v_token_count FROM refresh_tokens;
    
    IF v_token_count > 0 THEN
        RAISE WARNING '⚠️  ATTENTION: %s tokens existants détectés', v_token_count;
        RAISE WARNING '⚠️  Ces tokens utilisent probablement l''ancien format (non hashé)';
        RAISE WARNING '⚠️  Options:';
        RAISE WARNING '   1. Révoquer tous les tokens: UPDATE refresh_tokens SET revoked = TRUE, revoked_reason = ''migration''';
        RAISE WARNING '   2. Les utilisateurs devront se reconnecter après la migration';
        RAISE WARNING '';
        RAISE NOTICE 'Pour révoquer tous les tokens existants, exécutez:';
        RAISE NOTICE 'UPDATE refresh_tokens SET revoked = TRUE, revoked_at = NOW(), revoked_reason = ''migration_v6'' WHERE revoked = FALSE;';
    ELSE
        RAISE NOTICE '✅ Aucun token existant à migrer';
    END IF;
END $$;

-- ============================================================================
-- VALIDATION FINALE
-- ============================================================================

-- Afficher la structure finale
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'refresh_tokens'
ORDER BY ordinal_position;

-- Afficher les index
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'refresh_tokens'
ORDER BY indexname;

-- Afficher les fonctions
SELECT 
    routine_name,
    routine_type,
    data_type as return_type
FROM information_schema.routines
WHERE routine_name LIKE '%token%'
  AND routine_schema = 'public'
ORDER BY routine_name;

-- Message final
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '=========================================';
    RAISE NOTICE '✅ MIGRATION 002B TERMINÉE AVEC SUCCÈS';
    RAISE NOTICE '=========================================';
    RAISE NOTICE '';
    RAISE NOTICE 'Prochaines étapes:';
    RAISE NOTICE '1. Vérifier la structure de la table ci-dessus';
    RAISE NOTICE '2. Décider de révoquer ou non les tokens existants';
    RAISE NOTICE '3. Intégrer le module tokenRotation.js dans server.js';
    RAISE NOTICE '4. Tester avec: npm test backend/tests/tokenRotation.test.js';
    RAISE NOTICE '';
END $$;
