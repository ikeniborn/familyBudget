-- Test 1: Database Connection Test
-- Purpose: Verify connectivity and basic permissions

-- Check current database and user
SELECT
    current_database() AS database_name,
    current_user AS user_name,
    version() AS postgres_version;

-- Check if we can create tables (schema permissions)
SELECT has_schema_privilege(current_user, 'public', 'CREATE') AS can_create_tables;

-- Check connection parameters
SELECT
    inet_server_addr() AS server_ip,
    inet_server_port() AS server_port,
    pg_backend_pid() AS backend_pid;
