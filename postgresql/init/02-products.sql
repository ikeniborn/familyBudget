-- Initialize products tables
-- This script will be executed during PostgreSQL container initialization

-- Check if products tables already exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_tables WHERE tablename = 't_d_product') THEN
        -- Execute the products DDL script
        \i /docker-entrypoint-initdb.d/products.sql
        
        RAISE NOTICE 'Products tables created successfully';
    ELSE
        RAISE NOTICE 'Products tables already exist, skipping creation';
    END IF;
END
$$;