-- ============================================================================
-- INSERT: t_d_financial_center
-- Description: Financial centers (ЦФО) dimension
-- Generated: 2025-11-02 09:08:51
-- ============================================================================

-- Insert financial centers (shared across all users)
INSERT INTO t_d_financial_center (user_id, code, name, is_current) VALUES (1, 'FC_ИЛЬЯ', 'Илья', true);
INSERT INTO t_d_financial_center (user_id, code, name, is_current) VALUES (1, 'FC_ОКСАНА', 'Оксана', true);
INSERT INTO t_d_financial_center (user_id, code, name, is_current) VALUES (1, 'FC_РАДОМИР', 'Радомир', true);
INSERT INTO t_d_financial_center (user_id, code, name, is_current) VALUES (1, 'FC_СЕМЬЯ', 'Семья', true);

-- Total: 4 financial centers