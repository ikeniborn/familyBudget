-- ============================================================================
-- Migration: 012_create_refresh_tokens_table.sql
-- Description: Create refresh tokens table for JWT refresh token mechanism
-- Author: ClaudeCode Implementation System
-- Date: 2025-10-14
-- Task: EPIC-006: TASK-020 (JWT Refresh Token Mechanism)
-- ============================================================================

-- ============================================================================
-- TABLE: t_f_refresh_token
-- Purpose: Store refresh tokens for JWT authentication with rotation support
-- Pattern: Transactional fact table (NO SCD Type 2)
-- ============================================================================

CREATE TABLE IF NOT EXISTS t_f_refresh_token (
    -- Primary key
    id SERIAL PRIMARY KEY,

    -- Foreign key to user
    user_id INTEGER NOT NULL,

    -- Token security
    -- Store hash of token (not the actual token) for security
    -- Similar to password hashing - token is only known to client
    token_hash VARCHAR(255) NOT NULL UNIQUE,

    -- Token metadata
    expires_at TIMESTAMP NOT NULL,
    is_revoked BOOLEAN NOT NULL DEFAULT FALSE,

    -- Audit fields
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_used_at TIMESTAMP,
    revoked_at TIMESTAMP,

    -- Foreign key constraint
    CONSTRAINT fk_refresh_token_user
        FOREIGN KEY (user_id)
        REFERENCES t_d_user(id)
        ON DELETE CASCADE,

    -- Business rules
    CONSTRAINT check_expires_at_future
        CHECK (expires_at > created_at),

    CONSTRAINT check_revoked_at_consistency
        CHECK (
            (is_revoked = FALSE AND revoked_at IS NULL) OR
            (is_revoked = TRUE AND revoked_at IS NOT NULL)
        )
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Index on user_id for fast lookups of user's tokens
CREATE INDEX IF NOT EXISTS idx_refresh_token_user_id
    ON t_f_refresh_token(user_id);

-- Index on token_hash for fast validation (already unique, but explicit index)
CREATE INDEX IF NOT EXISTS idx_refresh_token_hash
    ON t_f_refresh_token(token_hash);

-- Index on active (non-revoked) tokens
-- Note: Cannot use expires_at > NOW() in predicate (NOW() is not IMMUTABLE)
CREATE INDEX IF NOT EXISTS idx_refresh_token_active
    ON t_f_refresh_token(user_id, is_revoked, expires_at)
    WHERE is_revoked = FALSE;

-- Index on expiration for cleanup jobs
CREATE INDEX IF NOT EXISTS idx_refresh_token_expires_at
    ON t_f_refresh_token(expires_at);

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE t_f_refresh_token IS 'Refresh token storage for JWT authentication with rotation support. Tokens are hashed before storage for security. Supports revocation on logout.';

COMMENT ON COLUMN t_f_refresh_token.id IS
    'Surrogate key (auto-increment primary key)';

COMMENT ON COLUMN t_f_refresh_token.user_id IS
    'Foreign key to t_d_user.id - token owner';

COMMENT ON COLUMN t_f_refresh_token.token_hash IS
    'SHA-256 hash of refresh token (actual token never stored in database)';

COMMENT ON COLUMN t_f_refresh_token.expires_at IS
    'Token expiration timestamp (typically 30 days from creation)';

COMMENT ON COLUMN t_f_refresh_token.is_revoked IS
    'Revocation flag - set TRUE on logout or security event';

COMMENT ON COLUMN t_f_refresh_token.created_at IS
    'Audit: Timestamp when token was created';

COMMENT ON COLUMN t_f_refresh_token.last_used_at IS
    'Audit: Last time token was used to refresh access token';

COMMENT ON COLUMN t_f_refresh_token.revoked_at IS
    'Audit: Timestamp when token was revoked (NULL if not revoked)';

-- ============================================================================
-- EXAMPLE USAGE
-- ============================================================================

-- Create new refresh token (on login)
-- INSERT INTO t_f_refresh_token (user_id, token_hash, expires_at)
-- VALUES (1, 'sha256_hash_here', NOW() + INTERVAL '30 days');

-- Check if token is valid (not revoked, not expired)
-- SELECT * FROM t_f_refresh_token
-- WHERE token_hash = 'sha256_hash'
--   AND is_revoked = FALSE
--   AND expires_at > NOW();

-- Revoke token (on logout)
-- UPDATE t_f_refresh_token
-- SET is_revoked = TRUE, revoked_at = NOW()
-- WHERE token_hash = 'sha256_hash';

-- Update last_used_at (on token refresh)
-- UPDATE t_f_refresh_token
-- SET last_used_at = NOW()
-- WHERE token_hash = 'sha256_hash';

-- Delete expired tokens (cleanup job)
-- DELETE FROM t_f_refresh_token
-- WHERE expires_at < NOW() - INTERVAL '7 days';

-- Delete revoked tokens older than retention period
-- DELETE FROM t_f_refresh_token
-- WHERE is_revoked = TRUE AND revoked_at < NOW() - INTERVAL '30 days';

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Verify table exists
-- SELECT table_name, table_type
-- FROM information_schema.tables
-- WHERE table_name = 't_f_refresh_token';

-- Verify columns
-- SELECT column_name, data_type, is_nullable, column_default
-- FROM information_schema.columns
-- WHERE table_name = 't_f_refresh_token'
-- ORDER BY ordinal_position;

-- Verify constraints
-- SELECT constraint_name, constraint_type
-- FROM information_schema.table_constraints
-- WHERE table_name = 't_f_refresh_token';

-- Verify indexes
-- SELECT indexname, indexdef
-- FROM pg_indexes
-- WHERE tablename = 't_f_refresh_token';

-- Verify foreign key relationship
-- SELECT
--     tc.constraint_name,
--     tc.table_name,
--     kcu.column_name,
--     ccu.table_name AS foreign_table_name,
--     ccu.column_name AS foreign_column_name
-- FROM information_schema.table_constraints AS tc
-- JOIN information_schema.key_column_usage AS kcu
--     ON tc.constraint_name = kcu.constraint_name
-- JOIN information_schema.constraint_column_usage AS ccu
--     ON ccu.constraint_name = tc.constraint_name
-- WHERE tc.constraint_type = 'FOREIGN KEY'
--   AND tc.table_name = 't_f_refresh_token';

-- ============================================================================
-- SECURITY NOTES
-- ============================================================================

-- 1. NEVER store actual refresh tokens in database
--    - Store only SHA-256 hash
--    - Token is only known to client (in httpOnly cookie)
--
-- 2. Token rotation on each refresh
--    - Old token is revoked after use
--    - New token is generated
--    - Prevents token replay attacks
--
-- 3. Revocation on logout
--    - Set is_revoked = TRUE
--    - Clear cookies on client
--    - Token cannot be used again
--
-- 4. Cleanup old tokens regularly
--    - Delete expired tokens after grace period (7 days)
--    - Delete revoked tokens after retention period (30 days)
--    - Prevents table bloat

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
