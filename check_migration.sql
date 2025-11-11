-- Проверка установлена ли миграция pg_trgm

-- 1. Проверить наличие расширения pg_trgm
SELECT COUNT(*) as pg_trgm_installed
FROM pg_extension
WHERE extname = 'pg_trgm';
-- Ожидаемый результат: 1 (установлено), 0 (не установлено)

-- 2. Проверить наличие GIN индекса на description
SELECT
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 't_f_budget_fact'
AND indexname = 'idx_budget_fact_description_trgm';
-- Ожидаемый результат: 1 строка с определением индекса

-- 3. Проверить текущую ревизию Alembic
SELECT version_num, is_branch
FROM alembic_version;
-- Ожидаемый результат: c9f2a8b4e1d6 или позднее
