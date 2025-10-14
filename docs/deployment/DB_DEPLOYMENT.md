# Family Budget - Database Deployment Guide

**Version:** 1.0
**Date:** 2025-10-09
**Task:** TASK-007

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Quick Start](#quick-start)
3. [Detailed Setup](#detailed-setup)
4. [Migration Management](#migration-management)
5. [Verification](#verification)
6. [Troubleshooting](#troubleshooting)
7. [Backup & Recovery](#backup--recovery)

---

## Prerequisites

### System Requirements

- **OS:** Ubuntu 20.04+ / Debian 11+ / macOS 12+
- **PostgreSQL:** 14+  (16+ recommended)
- **Disk Space:** 1GB minimum (10GB recommended for production)
- **RAM:** 2GB minimum (4GB+ recommended)

### Required Software

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install -y postgresql postgresql-client

# macOS
brew install postgresql@16

# Verify installation
psql --version
```

---

## Quick Start

### 1. Create Database

```bash
# Start PostgreSQL service
sudo systemctl start postgresql

# Create database and user
sudo -u postgres psql <<EOF
CREATE USER familybudget WITH PASSWORD 'your_password_here';
CREATE DATABASE familybudget_db OWNER familybudget;
GRANT ALL PRIVILEGES ON DATABASE familybudget_db TO familybudget;
EOF
```

### 2. Configure Environment

```bash
# Create .env file
cat > backend/db/.env <<EOF
DB_HOST=localhost
DB_PORT=5432
DB_NAME=familybudget_db
DB_USER=familybudget
DB_PASSWORD=your_password_here
EOF

# Secure the file
chmod 600 backend/db/.env
```

### 3. Run Migrations

```bash
cd backend/db

# Load environment variables
set -a && source .env && set +a

# Run all migrations
./run_migrations.sh

# Check status
./check_migrations.sh
```

**Expected output:**
```
========================================
Family Budget - Database Migrations
========================================

✓ Database connection successful
✓ Migration tracking table ready

✓ Migration applied successfully: 001_create_t_d_user.sql
✓ Migration applied successfully: 002_create_t_d_article.sql
...
✓ Migration applied successfully: 009_create_additional_indexes.sql

========================================
Migration Summary:
  Applied: 9
  Skipped: 0
  Failed:  0
========================================

✓ Migration process completed successfully
```

---

## Detailed Setup

### Step 1: PostgreSQL Installation & Configuration

#### Ubuntu/Debian

```bash
# Install PostgreSQL 16
sudo sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo apt-key add -
sudo apt update
sudo apt install -y postgresql-16 postgresql-client-16

# Start and enable service
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Verify status
sudo systemctl status postgresql
```

#### macOS

```bash
# Install via Homebrew
brew install postgresql@16

# Start service
brew services start postgresql@16

# Verify
psql postgres -c "SELECT version();"
```

### Step 2: Database Creation

#### Option A: Interactive Setup

```bash
sudo -u postgres createuser -P familybudget
# Enter password when prompted

sudo -u postgres createdb -O familybudget familybudget_db
```

#### Option B: Script Setup

```bash
# Create setup script
cat > setup_db.sh <<'EOF'
#!/bin/bash
set -e

# Configuration
DB_NAME="familybudget_db"
DB_USER="familybudget"
DB_PASSWORD="${1:-$(openssl rand -base64 24)}"

echo "Creating database..."
sudo -u postgres psql <<SQL
-- Create user
CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASSWORD}';

-- Create database
CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};

-- Connect to database and grant schema privileges
\c ${DB_NAME}
GRANT ALL ON SCHEMA public TO ${DB_USER};
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO ${DB_USER};
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO ${DB_USER};

-- Default privileges for future objects
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO ${DB_USER};
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO ${DB_USER};
SQL

echo "Database created successfully!"
echo ""
echo "Connection details:"
echo "  Database: ${DB_NAME}"
echo "  User:     ${DB_USER}"
echo "  Password: ${DB_PASSWORD}"
echo ""
echo "Save these credentials to backend/db/.env"
EOF

chmod +x setup_db.sh
./setup_db.sh
```

### Step 3: Configure pg_hba.conf (if needed)

```bash
# Find pg_hba.conf location
sudo -u postgres psql -c "SHOW hba_file;"

# Edit file
sudo nano /etc/postgresql/16/main/pg_hba.conf

# Add line for local connections
# TYPE  DATABASE        USER            ADDRESS                 METHOD
local   familybudget_db familybudget                            md5
host    familybudget_db familybudget    127.0.0.1/32            md5

# Reload PostgreSQL
sudo systemctl reload postgresql
```

### Step 4: Test Connection

```bash
# Test connection
PGPASSWORD='your_password' psql -h localhost -U familybudget -d familybudget_db -c "SELECT current_database();"

# Expected output:
#  current_database
# ------------------
#  familybudget_db
```

---

## Migration Management

### Migration Structure

```
backend/db/
├── migrations/
│   ├── 001_create_t_d_user.sql
│   ├── 002_create_t_d_article.sql
│   ├── 003_create_t_d_financial_center.sql
│   ├── 004_create_t_d_cost_center.sql
│   ├── 005_create_t_d_article_hierarchy.sql
│   ├── 006_create_t_f_budget_fact.sql
│   ├── 007_create_article_hierarchy_triggers.sql
│   ├── 008_create_scd2_triggers.sql
│   └── 009_create_additional_indexes.sql
├── tests/
│   ├── test_article_hierarchy_triggers.sql
│   └── test_scd2_triggers.sql
├── run_migrations.sh
├── check_migrations.sh
├── .env
└── DEPLOYMENT.md
```

### Running Migrations

#### Option 1: Environment Variables

```bash
export DB_HOST=localhost
export DB_PORT=5432
export DB_NAME=familybudget_db
export DB_USER=familybudget
export DB_PASSWORD=your_password

cd backend/db
./run_migrations.sh
```

#### Option 2: .env File (Recommended)

```bash
cd backend/db

# Create .env
cat > .env <<EOF
DB_HOST=localhost
DB_PORT=5432
DB_NAME=familybudget_db
DB_USER=familybudget
DB_PASSWORD=your_password
EOF

# Secure file
chmod 600 .env

# Load and run
set -a && source .env && set +a
./run_migrations.sh
```

### Migration Commands

```bash
# Apply all pending migrations
./run_migrations.sh run

# Check migration status
./run_migrations.sh status

# Full system check
./check_migrations.sh
```

### Migration Tracking

Migrations are tracked in `schema_migrations` table:

```sql
SELECT * FROM schema_migrations ORDER BY id;

-- Example output:
 id | migration_file                  | applied_at          | execution_time_ms
----+---------------------------------+---------------------+------------------
  1 | 001_create_t_d_user.sql        | 2025-10-09 10:00:00 | 45
  2 | 002_create_t_d_article.sql     | 2025-10-09 10:00:01 | 78
  ...
```

---

## Verification

### Automated Checks

```bash
# Run full check
./check_migrations.sh

# Expected output:
✓ Database connection
✓ Users dimension (t_d_user)
✓ Articles dimension (t_d_article)
✓ Financial centers dimension (t_d_financial_center)
✓ Cost centers dimension (t_d_cost_center)
✓ Hierarchy closure table (t_d_article_hierarchy)
✓ Budget facts (t_f_budget_fact)
✓ 7 triggers installed
✓ 63 indexes created
✓ 24 partitions created
✓ All migrations applied
✓ No duplicate current users
✓ No orphaned articles
```

### Manual Verification

```bash
# Connect to database
PGPASSWORD='your_password' psql -h localhost -U familybudget -d familybudget_db

# Check tables
\dt

# Check indexes
\di

# Check triggers
SELECT trigger_name, event_object_table
FROM information_schema.triggers
WHERE trigger_schema = 'public';

# Check partitions
SELECT tablename FROM pg_tables
WHERE tablename LIKE 't_f_budget_fact_%'
ORDER BY tablename;

# Check data integrity
SELECT
    (SELECT COUNT(*) FROM t_d_user WHERE is_current = TRUE) as current_users,
    (SELECT COUNT(*) FROM t_d_article WHERE is_current = TRUE) as current_articles,
    (SELECT COUNT(*) FROM t_f_budget_fact) as total_facts;
```

---

## Running Tests

### Unit Tests for Triggers

```bash
# Run hierarchy trigger tests
PGPASSWORD='your_password' psql -h localhost -U familybudget -d familybudget_db \
    -f backend/db/tests/test_article_hierarchy_triggers.sql

# Run SCD2 trigger tests
PGPASSWORD='your_password' psql -h localhost -U familybudget -d familybudget_db \
    -f backend/db/tests/test_scd2_triggers.sql
```

**Expected output:**
```
=== TEST 1: Insert root article (no parent) ===
NOTICE:  TEST 1 PASSED: Root article has 1 hierarchy entry
NOTICE:  TEST 1 PASSED: Self-reference has depth = 0
...
All 7 tests PASSED.
```

---

## Troubleshooting

### Issue: Connection Refused

```bash
# Check PostgreSQL status
sudo systemctl status postgresql

# Check port is listening
sudo netstat -tlnp | grep 5432

# Check pg_hba.conf
sudo cat /etc/postgresql/16/main/pg_hba.conf | grep familybudget
```

### Issue: Permission Denied

```bash
# Grant schema permissions
sudo -u postgres psql -d familybudget_db <<EOF
GRANT ALL ON SCHEMA public TO familybudget;
GRANT ALL ON ALL TABLES IN SCHEMA public TO familybudget;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO familybudget;
ALTER DEFAULT PRIVILEGES GRANT ALL ON TABLES TO familybudget;
EOF
```

### Issue: Migration Failed

```bash
# Check migration log
cat backend/db/migrations.log

# Check last applied migration
PGPASSWORD='your_password' psql -h localhost -U familybudget -d familybudget_db \
    -c "SELECT * FROM schema_migrations ORDER BY id DESC LIMIT 5;"

# Manually apply failed migration
PGPASSWORD='your_password' psql -h localhost -U familybudget -d familybudget_db \
    -f backend/db/migrations/00X_failed_migration.sql
```

### Issue: Duplicate Current Records

```bash
# Find duplicates
PGPASSWORD='your_password' psql -h localhost -U familybudget -d familybudget_db <<EOF
SELECT telegram_id, COUNT(*) as count
FROM t_d_user
WHERE is_current = TRUE
GROUP BY telegram_id
HAVING COUNT(*) > 1;
EOF

# Fix: manually close old versions
# (This should not happen with proper SCD2 triggers)
```

---

## Backup & Recovery

### Backup Database

```bash
# Full database backup
pg_dump -h localhost -U familybudget familybudget_db \
    > familybudget_backup_$(date +%Y%m%d_%H%M%S).sql

# Schema only (no data)
pg_dump -h localhost -U familybudget -s familybudget_db \
    > familybudget_schema_$(date +%Y%m%d).sql

# Data only (no schema)
pg_dump -h localhost -U familybudget -a familybudget_db \
    > familybudget_data_$(date +%Y%m%d).sql

# Compressed backup
pg_dump -h localhost -U familybudget -Fc familybudget_db \
    > familybudget_backup.dump
```

### Restore Database

```bash
# From SQL file
psql -h localhost -U familybudget familybudget_db < familybudget_backup.sql

# From compressed dump
pg_restore -h localhost -U familybudget -d familybudget_db familybudget_backup.dump

# Drop and recreate database before restore
sudo -u postgres psql <<EOF
DROP DATABASE IF EXISTS familybudget_db;
CREATE DATABASE familybudget_db OWNER familybudget;
EOF

psql -h localhost -U familybudget familybudget_db < familybudget_backup.sql
```

### Automated Backups

```bash
# Create backup script
cat > /usr/local/bin/backup_familybudget.sh <<'EOF'
#!/bin/bash
BACKUP_DIR="/var/backups/familybudget"
DATE=$(date +%Y%m%d_%H%M%S)
FILENAME="familybudget_${DATE}.sql.gz"

mkdir -p ${BACKUP_DIR}

pg_dump -h localhost -U familybudget familybudget_db | gzip > ${BACKUP_DIR}/${FILENAME}

# Keep only last 30 backups
find ${BACKUP_DIR} -name "familybudget_*.sql.gz" -mtime +30 -delete

echo "Backup created: ${BACKUP_DIR}/${FILENAME}"
EOF

chmod +x /usr/local/bin/backup_familybudget.sh

# Add to crontab (daily at 2 AM)
(crontab -l 2>/dev/null; echo "0 2 * * * /usr/local/bin/backup_familybudget.sh") | crontab -
```

---

## Production Deployment Checklist

### Pre-Deployment

- [ ] PostgreSQL 16+ installed
- [ ] Database and user created
- [ ] .env file configured with secure credentials
- [ ] pg_hba.conf configured for application access
- [ ] Firewall rules configured (if remote access needed)
- [ ] SSL/TLS certificates configured (production only)

### Deployment

- [ ] Run migrations: `./run_migrations.sh`
- [ ] Verify status: `./check_migrations.sh`
- [ ] Run trigger tests
- [ ] Check data integrity queries
- [ ] Verify partitions created (24+ for 2025-2026)
- [ ] Check index sizes (< 200MB for initial setup)

### Post-Deployment

- [ ] Setup automated backups (cron + S3/backup server)
- [ ] Configure monitoring (query performance, table sizes)
- [ ] Document connection credentials securely
- [ ] Setup log rotation for migrations.log
- [ ] Test application connectivity
- [ ] Run end-to-end tests from backend API

### Security Checklist

- [ ] .env file permissions: 600 (chmod 600 .env)
- [ ] Database password: Strong (24+ characters, random)
- [ ] pg_hba.conf: Restrict access to trusted IPs only
- [ ] PostgreSQL user: Limited privileges (no SUPERUSER)
- [ ] Firewall: PostgreSQL port 5432 not publicly exposed
- [ ] SSL/TLS: Enabled for production connections

---

## Performance Tuning

### PostgreSQL Configuration

```bash
# Edit postgresql.conf
sudo nano /etc/postgresql/16/main/postgresql.conf

# Recommended settings for Family Budget
shared_buffers = 256MB           # 25% of RAM
effective_cache_size = 1GB       # 50% of RAM
maintenance_work_mem = 128MB
work_mem = 16MB
max_connections = 100
checkpoint_completion_target = 0.9

# Restart PostgreSQL
sudo systemctl restart postgresql
```

### Index Maintenance

```bash
# Reindex if performance degrades
REINDEX DATABASE familybudget_db;

# Vacuum regularly (auto-vacuum enabled by default)
VACUUM ANALYZE;

# Check index usage
SELECT schemaname, tablename, indexrelname, idx_scan
FROM pg_stat_user_indexes
WHERE idx_scan = 0
ORDER BY pg_relation_size(indexrelid) DESC;
```

---

## Support

### Documentation

- **Project README:** `/README.md`
- **Migration Files:** `/backend/db/migrations/`
- **Test Files:** `/backend/db/tests/`
- **Verification Reports:** `/backend/db/TASK-*_VERIFICATION.md`

### Database Schema

- **Tables:** 6 (5 dimensions + 1 fact)
- **Partitions:** 24 (monthly for 2025-2026)
- **Indexes:** 63
- **Triggers:** 7
- **Functions:** 10

### Contact

For issues or questions, refer to project documentation or check migration logs.

---

**Document Version:** 1.0
**Last Updated:** 2025-10-09
**Status:** ✅ Production Ready
