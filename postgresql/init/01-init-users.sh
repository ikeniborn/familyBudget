#!/bin/bash
set -e

# This script runs during PostgreSQL container initialization
# It creates the budget user and budgetdb database

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    -- Create budget user if not exists
    DO
    \$do\$
    BEGIN
       IF NOT EXISTS (
          SELECT FROM pg_catalog.pg_user
          WHERE usename = 'budget') THEN
          CREATE USER budget WITH PASSWORD '$BUDGET_DB_PASSWORD';
       END IF;
    END
    \$do\$;

    -- Create budgetdb if not exists
    SELECT 'CREATE DATABASE budgetdb OWNER budget'
    WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'budgetdb')\\gexec

    -- Grant privileges
    GRANT ALL PRIVILEGES ON DATABASE budgetdb TO budget;
EOSQL

# Connect to budgetdb and set up permissions
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "budgetdb" <<-EOSQL
    -- Grant schema permissions
    GRANT ALL ON SCHEMA public TO budget;
    GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO budget;
    GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO budget;

    -- Set default privileges for future objects
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO budget;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO budget;
EOSQL

echo "Database initialization completed successfully"