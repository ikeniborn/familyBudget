-- ============================================================================
-- INSERT: t_d_financial_center
-- Description: Financial centers (ЦФО) dimension
-- Generated: 2025-11-10 21:41:36
-- ============================================================================

-- Insert financial centers (shared across all users)
INSERT INTO t_d_financial_center (user_id, code, name, is_current) VALUES (1, 'CFO-1', 'Илья', true);
INSERT INTO t_d_financial_center (user_id, code, name, is_current) VALUES (1, 'CFO-2', 'Оксана', true);
INSERT INTO t_d_financial_center (user_id, code, name, is_current) VALUES (1, 'CFO-3', 'Радомир', true);
INSERT INTO t_d_financial_center (user_id, code, name, is_current) VALUES (1, 'CFO-4', 'Семья', true);

-- Total: 4 financial centers