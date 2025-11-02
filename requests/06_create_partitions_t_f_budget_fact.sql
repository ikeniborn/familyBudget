-- ============================================================================
-- CREATE PARTITIONS: t_f_budget_fact
-- Description: Monthly partitions for budget fact table
-- Generated: 2025-11-02 11:50:50
-- ============================================================================

-- Date range: 2023-01-01 to 2026-01-01
-- Creating monthly partitions using RANGE partitioning

CREATE TABLE IF NOT EXISTS t_f_budget_fact_2023_01 PARTITION OF t_f_budget_fact FOR VALUES FROM ('2023-01-01') TO ('2023-02-01');
CREATE TABLE IF NOT EXISTS t_f_budget_fact_2023_02 PARTITION OF t_f_budget_fact FOR VALUES FROM ('2023-02-01') TO ('2023-03-01');
CREATE TABLE IF NOT EXISTS t_f_budget_fact_2023_03 PARTITION OF t_f_budget_fact FOR VALUES FROM ('2023-03-01') TO ('2023-04-01');
CREATE TABLE IF NOT EXISTS t_f_budget_fact_2023_04 PARTITION OF t_f_budget_fact FOR VALUES FROM ('2023-04-01') TO ('2023-05-01');
CREATE TABLE IF NOT EXISTS t_f_budget_fact_2023_05 PARTITION OF t_f_budget_fact FOR VALUES FROM ('2023-05-01') TO ('2023-06-01');
CREATE TABLE IF NOT EXISTS t_f_budget_fact_2023_06 PARTITION OF t_f_budget_fact FOR VALUES FROM ('2023-06-01') TO ('2023-07-01');
CREATE TABLE IF NOT EXISTS t_f_budget_fact_2023_07 PARTITION OF t_f_budget_fact FOR VALUES FROM ('2023-07-01') TO ('2023-08-01');
CREATE TABLE IF NOT EXISTS t_f_budget_fact_2023_08 PARTITION OF t_f_budget_fact FOR VALUES FROM ('2023-08-01') TO ('2023-09-01');
CREATE TABLE IF NOT EXISTS t_f_budget_fact_2023_09 PARTITION OF t_f_budget_fact FOR VALUES FROM ('2023-09-01') TO ('2023-10-01');
CREATE TABLE IF NOT EXISTS t_f_budget_fact_2023_10 PARTITION OF t_f_budget_fact FOR VALUES FROM ('2023-10-01') TO ('2023-11-01');
CREATE TABLE IF NOT EXISTS t_f_budget_fact_2023_11 PARTITION OF t_f_budget_fact FOR VALUES FROM ('2023-11-01') TO ('2023-12-01');
CREATE TABLE IF NOT EXISTS t_f_budget_fact_2023_12 PARTITION OF t_f_budget_fact FOR VALUES FROM ('2023-12-01') TO ('2024-01-01');
CREATE TABLE IF NOT EXISTS t_f_budget_fact_2024_01 PARTITION OF t_f_budget_fact FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');
CREATE TABLE IF NOT EXISTS t_f_budget_fact_2024_02 PARTITION OF t_f_budget_fact FOR VALUES FROM ('2024-02-01') TO ('2024-03-01');
CREATE TABLE IF NOT EXISTS t_f_budget_fact_2024_03 PARTITION OF t_f_budget_fact FOR VALUES FROM ('2024-03-01') TO ('2024-04-01');
CREATE TABLE IF NOT EXISTS t_f_budget_fact_2024_04 PARTITION OF t_f_budget_fact FOR VALUES FROM ('2024-04-01') TO ('2024-05-01');
CREATE TABLE IF NOT EXISTS t_f_budget_fact_2024_05 PARTITION OF t_f_budget_fact FOR VALUES FROM ('2024-05-01') TO ('2024-06-01');
CREATE TABLE IF NOT EXISTS t_f_budget_fact_2024_06 PARTITION OF t_f_budget_fact FOR VALUES FROM ('2024-06-01') TO ('2024-07-01');
CREATE TABLE IF NOT EXISTS t_f_budget_fact_2024_07 PARTITION OF t_f_budget_fact FOR VALUES FROM ('2024-07-01') TO ('2024-08-01');
CREATE TABLE IF NOT EXISTS t_f_budget_fact_2024_08 PARTITION OF t_f_budget_fact FOR VALUES FROM ('2024-08-01') TO ('2024-09-01');
CREATE TABLE IF NOT EXISTS t_f_budget_fact_2024_09 PARTITION OF t_f_budget_fact FOR VALUES FROM ('2024-09-01') TO ('2024-10-01');
CREATE TABLE IF NOT EXISTS t_f_budget_fact_2024_10 PARTITION OF t_f_budget_fact FOR VALUES FROM ('2024-10-01') TO ('2024-11-01');
CREATE TABLE IF NOT EXISTS t_f_budget_fact_2024_11 PARTITION OF t_f_budget_fact FOR VALUES FROM ('2024-11-01') TO ('2024-12-01');
CREATE TABLE IF NOT EXISTS t_f_budget_fact_2024_12 PARTITION OF t_f_budget_fact FOR VALUES FROM ('2024-12-01') TO ('2025-01-01');
CREATE TABLE IF NOT EXISTS t_f_budget_fact_2025_01 PARTITION OF t_f_budget_fact FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');
CREATE TABLE IF NOT EXISTS t_f_budget_fact_2025_02 PARTITION OF t_f_budget_fact FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');
CREATE TABLE IF NOT EXISTS t_f_budget_fact_2025_03 PARTITION OF t_f_budget_fact FOR VALUES FROM ('2025-03-01') TO ('2025-04-01');
CREATE TABLE IF NOT EXISTS t_f_budget_fact_2025_04 PARTITION OF t_f_budget_fact FOR VALUES FROM ('2025-04-01') TO ('2025-05-01');
CREATE TABLE IF NOT EXISTS t_f_budget_fact_2025_05 PARTITION OF t_f_budget_fact FOR VALUES FROM ('2025-05-01') TO ('2025-06-01');
CREATE TABLE IF NOT EXISTS t_f_budget_fact_2025_06 PARTITION OF t_f_budget_fact FOR VALUES FROM ('2025-06-01') TO ('2025-07-01');
CREATE TABLE IF NOT EXISTS t_f_budget_fact_2025_07 PARTITION OF t_f_budget_fact FOR VALUES FROM ('2025-07-01') TO ('2025-08-01');
CREATE TABLE IF NOT EXISTS t_f_budget_fact_2025_08 PARTITION OF t_f_budget_fact FOR VALUES FROM ('2025-08-01') TO ('2025-09-01');
CREATE TABLE IF NOT EXISTS t_f_budget_fact_2025_09 PARTITION OF t_f_budget_fact FOR VALUES FROM ('2025-09-01') TO ('2025-10-01');
CREATE TABLE IF NOT EXISTS t_f_budget_fact_2025_10 PARTITION OF t_f_budget_fact FOR VALUES FROM ('2025-10-01') TO ('2025-11-01');
CREATE TABLE IF NOT EXISTS t_f_budget_fact_2025_11 PARTITION OF t_f_budget_fact FOR VALUES FROM ('2025-11-01') TO ('2025-12-01');
CREATE TABLE IF NOT EXISTS t_f_budget_fact_2025_12 PARTITION OF t_f_budget_fact FOR VALUES FROM ('2025-12-01') TO ('2026-01-01');

-- Total: 36 monthly partitions created

-- Verify partitions:
-- SELECT tablename FROM pg_tables WHERE tablename LIKE 't_f_budget_fact_%' ORDER BY tablename;