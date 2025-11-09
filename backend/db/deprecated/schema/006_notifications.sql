-- ============================================================================
-- Schema DDL: 006_notifications.sql  
-- Description: Budget threshold notifications
-- Version: 5.0.0 (Base Schema)
-- Date: 2025-11-08
-- ============================================================================
--
-- This file contains notification tables:
-- - t_notification: Budget threshold notifications
--
-- DO NOT MODIFY in Production Mode - use Alembic migrations instead!
-- ============================================================================

-- Create notifications table
CREATE TABLE IF NOT EXISTS t_notification (
    id SERIAL PRIMARY KEY,
    user_id INTEGER,  -- NULLABLE для broadcast notifications (NULL = all users)
    article_id INTEGER NOT NULL,
    notification_type VARCHAR(50) NOT NULL,
    threshold_percent INTEGER NOT NULL DEFAULT 90,
    plan_amount DECIMAL(15, 2) NOT NULL,
    actual_amount DECIMAL(15, 2) NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),

    -- Foreign keys
    CONSTRAINT fk_notification_user
        FOREIGN KEY (user_id)
        REFERENCES t_d_user(id)
        ON DELETE SET NULL,  -- При удалении user, notification остается (broadcast)

    CONSTRAINT fk_notification_article
        FOREIGN KEY (article_id)
        REFERENCES t_d_article(id)
        ON DELETE CASCADE,

    -- Ensure notification_type is valid
    CONSTRAINT check_notification_type
        CHECK (notification_type IN ('budget_threshold', 'budget_exceeded', 'weekly_report'))
);

-- Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_notification_user_id
    ON t_notification(user_id);

CREATE INDEX IF NOT EXISTS idx_notification_article_id
    ON t_notification(article_id);

CREATE INDEX IF NOT EXISTS idx_notification_type
    ON t_notification(notification_type);

CREATE INDEX IF NOT EXISTS idx_notification_created_at
    ON t_notification(created_at DESC);

-- Composite index for duplicate detection (user-specific notifications)
CREATE INDEX IF NOT EXISTS idx_notification_dedup
    ON t_notification(user_id, article_id, notification_type, period_start, period_end)
    WHERE user_id IS NOT NULL;

-- Partial index for broadcast notifications (user_id IS NULL)
CREATE INDEX IF NOT EXISTS idx_notification_broadcast
    ON t_notification(notification_type, created_at DESC)
    WHERE user_id IS NULL;

-- Unique constraint to prevent duplicate broadcast notifications
CREATE UNIQUE INDEX IF NOT EXISTS idx_notification_unique_broadcast
    ON t_notification(article_id, notification_type, period_start, period_end)
    WHERE user_id IS NULL;

-- Add comments
COMMENT ON TABLE t_notification IS 'Stores notification history for budget alerts and reports. user_id = NULL means broadcast to all users.';

COMMENT ON COLUMN t_notification.user_id IS
    'User ID for user-specific notifications. NULL = broadcast notification sent to all users. Broadcast notifications are used for shared budget alerts.';

COMMENT ON COLUMN t_notification.article_id IS
    'Category/article ID that triggered the notification';

COMMENT ON COLUMN t_notification.notification_type IS
    'Type: budget_threshold (90%), budget_exceeded (100%), weekly_report';

COMMENT ON COLUMN t_notification.threshold_percent IS
    'Threshold percentage that triggered the notification (e.g., 90 for 90%)';

COMMENT ON COLUMN t_notification.plan_amount IS
    'Planned budget amount for the period';

COMMENT ON COLUMN t_notification.actual_amount IS
    'Actual spending amount that triggered notification';

COMMENT ON COLUMN t_notification.period_start IS
    'Start of period being monitored (e.g., month start)';

COMMENT ON COLUMN t_notification.period_end IS
    'End of period being monitored (e.g., month end)';
