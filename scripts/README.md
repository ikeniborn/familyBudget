# Family Budget - Scripts Directory

**Version:** 1.0
**Task:** TASK-051 (EPIC-005)
**Date:** 2025-10-14

---

## Overview

This directory contains automation scripts for the Family Budget application, including backup, deployment, and maintenance utilities.

---

## Scripts

### clean_old_certificates.sh

**Purpose:** Clean old SSL certificates from certbot configuration

**Features:**
- Interactive mode with confirmation prompts
- Automatic mode (`--auto`) for script integration
- Displays existing certificates before cleanup
- Proper exit codes (0=success, 1=cancelled/error)
- Safe deletion with user confirmation
- Optional host system cleanup (`/etc/letsencrypt/`)

**Usage:**

```bash
# Interactive mode (with prompts)
./scripts/clean_old_certificates.sh

# Automatic mode (no prompts, for scripts)
./scripts/clean_old_certificates.sh --auto
```

**What it cleans:**
- `certbot/conf/live/` - active certificate symlinks
- `certbot/conf/archive/` - archived certificates
- `certbot/conf/renewal/` - renewal configurations
- `certbot/conf/accounts/` - Let's Encrypt accounts
- Optionally: `/etc/letsencrypt/*` on host system (with confirmation)

**Exit Codes:**
- `0` - Success (cleanup completed or nothing to clean)
- `1` - Error or user cancelled

**Examples:**

```bash
# Check and clean certificates interactively
./scripts/clean_old_certificates.sh
# Type 'DELETE' to confirm

# Use in scripts (automatic mode)
./scripts/clean_old_certificates.sh --auto && echo "Cleaned!"

# Called from check_certificates.sh
# (happens automatically during setup/deploy)
```

**Integration:**
- Used by `scripts/check_certificates.sh` when domain mismatch detected
- Automatically invoked during `setup.sh` and `deploy.sh` if needed

---

### check_certificates.sh

**Purpose:** Intelligent SSL certificate checking and management helper

**Features:**
- Detects existing SSL certificates
- Compares existing domain with new domain
- Smart scenarios handling:
  - Same domain → reuse certificate (saves Let's Encrypt limits)
  - Different domain → offer cleanup with confirmation
  - Localhost → optional cleanup for tidiness
- Never deletes automatically - always asks for confirmation
- Integration with `clean_old_certificates.sh`

**Usage:**

```bash
# Source in other scripts
source scripts/check_certificates.sh

# Use the main function
check_and_offer_certificate_cleanup "domain.com" "/path/to/certbot/conf"
```

**Functions:**
- `get_existing_domains(certbot_conf_dir)` - List certificate domains
- `get_cert_expiry(certbot_conf_dir, domain)` - Get expiration date
- `check_and_offer_certificate_cleanup(new_domain, certbot_conf_dir)` - Main logic

**Return Codes:**
- `0` - Success (no action needed or cleanup completed)
- `1` - Cleanup was offered but declined

**Scenarios:**

1. **Same Domain:**
   ```
   [SUCCESS] Найден сертификат для domain.com
   [SUCCESS] Сертификат будет переиспользован (экономия лимитов Let's Encrypt)
   ```

2. **Different Domain:**
   ```
   [WARNING] Несоответствие доменов:
     Существующие: old-domain.com
     Новый:        new-domain.com

   Очистить старые сертификаты сейчас? [Y/n]:
   ```

3. **Localhost:**
   ```
   [INFO] Выбрана локальная разработка (localhost)
   Очистить неиспользуемые сертификаты для порядка? [y/N]:
   ```

**Integration:**
- Automatically used by `setup.sh` in `configure_domain_ssl()`
- Automatically used by `deploy.sh` in `setup_ssl_certificates()`

---

### backup.sh

**Purpose:** Automated PostgreSQL backup with local storage and S3 upload

**Features:**
- Daily compressed backups (gzip format)
- Local retention: 7 days
- Weekly S3 upload (Sundays): 28 days retention
- Lock file to prevent concurrent runs
- Comprehensive logging
- Retry logic for S3 uploads
- Error notifications

**Usage:**

```bash
# Basic usage (runs from cron)
./scripts/backup.sh

# Force S3 upload regardless of day
./scripts/backup.sh --force-s3

# Verbose logging
./scripts/backup.sh --verbose

# Combined options
./scripts/backup.sh --force-s3 --verbose
```

**Environment Variables:**

Required:
```bash
POSTGRES_USER=familybudget
POSTGRES_DB=familybudget_db
```

Optional (for S3):
```bash
AWS_ACCESS_KEY_ID=<your_access_key>
AWS_SECRET_ACCESS_KEY=<your_secret_key>
S3_BUCKET_NAME=familybudget-backups
S3_ENDPOINT_URL=https://storage.yandexcloud.net
```

**Directory Structure:**

```
/path/to/project/
├── backups/
│   ├── backup_20251014_020000.sql.gz
│   ├── backup_20251013_020000.sql.gz
│   ├── ...
│   └── logs/
│       ├── backup_20251014.log
│       └── backup_20251013.log
└── scripts/
    └── backup.sh
```

**Exit Codes:**

- `0` - Success
- `1` - Backup failed
- `2` - Configuration error
- `3` - Lock file exists (another instance running)
- `4` - S3 upload failed (backup still saved locally)

**Examples:**

```bash
# Set environment variables from .env
set -a && source .env && set +a

# Run backup
./scripts/backup.sh

# Check logs
tail -f backups/logs/backup_$(date +%Y%m%d).log

# List backups
ls -lh backups/backup_*.sql.gz

# Restore from backup
gunzip < backups/backup_20251014_020000.sql.gz | \
  docker compose exec -T postgres psql -U familybudget -d familybudget_db
```

**Cron Setup:**

Daily at 2 AM:
```bash
0 2 * * * cd /path/to/project && ./scripts/backup.sh >> backups/logs/cron.log 2>&1
```

Or using environment file:
```bash
0 2 * * * cd /path/to/project && set -a && source .env && set +a && ./scripts/backup.sh >> backups/logs/cron.log 2>&1
```

---

## Backup Strategy

### Local Backups

- **Frequency:** Daily at 2:00 AM
- **Format:** Compressed SQL dump (.sql.gz)
- **Retention:** 7 days
- **Location:** `./backups/backup_YYYYMMDD_HHMMSS.sql.gz`

### S3 Backups (Optional)

- **Frequency:** Weekly (Sundays)
- **Format:** Same as local
- **Retention:** 28 days (4 weeks)
- **Location:** `s3://bucket-name/YYYY/MM/backup_YYYYMMDD_HHMMSS.sql.gz`
- **Provider:** Yandex Object Storage (S3-compatible)

### Recovery Procedures

#### From Local Backup:

```bash
# 1. List available backups
ls -lh backups/backup_*.sql.gz

# 2. Restore (will overwrite current database!)
gunzip < backups/backup_20251014_020000.sql.gz | \
  docker compose exec -T postgres psql -U familybudget -d familybudget_db

# 3. Verify
docker compose exec postgres psql -U familybudget -d familybudget_db \
  -c "SELECT COUNT(*) FROM t_f_budget_fact;"
```

#### From S3 Backup:

```bash
# 1. List S3 backups
aws s3 ls s3://familybudget-backups/ \
  --endpoint-url https://storage.yandexcloud.net \
  --recursive

# 2. Download backup
aws s3 cp s3://familybudget-backups/2025/10/backup_20251014_020000.sql.gz . \
  --endpoint-url https://storage.yandexcloud.net

# 3. Restore
gunzip < backup_20251014_020000.sql.gz | \
  docker compose exec -T postgres psql -U familybudget -d familybudget_db

# 4. Verify
docker compose exec postgres psql -U familybudget -d familybudget_db \
  -c "SELECT COUNT(*) FROM t_f_budget_fact;"
```

---

## Testing

### Test Local Backup:

```bash
# Create test backup
./scripts/backup.sh --verbose

# Verify backup exists
ls -lh backups/backup_$(date +%Y%m%d)*.sql.gz

# Test restore to temporary database
docker compose exec postgres createdb -U familybudget test_restore
gunzip < backups/backup_*.sql.gz | \
  docker compose exec -T postgres psql -U familybudget -d test_restore

# Verify data
docker compose exec postgres psql -U familybudget -d test_restore \
  -c "SELECT COUNT(*) as user_count FROM t_d_user;"

# Drop test database
docker compose exec postgres dropdb -U familybudget test_restore
```

### Test S3 Upload:

```bash
# Force S3 upload (even if not Sunday)
./scripts/backup.sh --force-s3 --verbose

# Verify upload
aws s3 ls s3://familybudget-backups/ \
  --endpoint-url https://storage.yandexcloud.net \
  --recursive | tail -5
```

---

## Monitoring

### Check Backup Status:

```bash
# View today's log
cat backups/logs/backup_$(date +%Y%m%d).log

# Check for errors in last 7 days
grep ERROR backups/logs/backup_*.log

# List recent backups with sizes
ls -lht backups/backup_*.sql.gz | head -10

# Calculate total backup size
du -sh backups/
```

### Automated Monitoring:

Add to your monitoring system:

```bash
# Check if backup ran today
if [ ! -f "backups/backup_$(date +%Y%m%d)_*.sql.gz" ]; then
  echo "ALERT: No backup created today!"
fi

# Check log for errors
if grep -q "ERROR" "backups/logs/backup_$(date +%Y%m%d).log" 2>/dev/null; then
  echo "ALERT: Backup errors detected!"
fi
```

---

## Troubleshooting

### Issue: Lock File Exists

**Error:** `Another backup instance is running (PID: 12345)`

**Solution:**
```bash
# Check if process is actually running
ps -p 12345

# If not running (stale lock), remove lock file
rm -f /tmp/familybudget_backup.lock

# Re-run backup
./scripts/backup.sh
```

### Issue: Docker Container Not Found

**Error:** `PostgreSQL container not found or not running`

**Solution:**
```bash
# Check container status
docker compose ps

# Start containers
docker compose up -d

# Verify PostgreSQL is healthy
docker compose exec postgres psql -U familybudget -d familybudget_db -c "SELECT 1;"
```

### Issue: S3 Upload Failed

**Error:** `S3 upload failed after 3 attempts`

**Possible Causes:**
1. Invalid credentials
2. Network issues
3. Bucket doesn't exist
4. Endpoint URL incorrect

**Solution:**
```bash
# Test credentials
aws s3 ls s3://familybudget-backups/ \
  --endpoint-url https://storage.yandexcloud.net

# Check environment variables
echo $AWS_ACCESS_KEY_ID
echo $S3_BUCKET_NAME
echo $S3_ENDPOINT_URL

# Manual upload test
aws s3 cp backups/backup_*.sql.gz \
  s3://familybudget-backups/test/backup.sql.gz \
  --endpoint-url https://storage.yandexcloud.net
```

### Issue: Backup File Size Too Large

**Problem:** Backup file growing too large for efficient upload

**Solution:**
```bash
# Check backup sizes
ls -lh backups/backup_*.sql.gz | tail -10

# Analyze database size
docker compose exec postgres psql -U familybudget -d familybudget_db <<EOF
SELECT
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
EOF

# Consider:
# 1. Archiving old facts to separate table
# 2. Implementing incremental backups
# 3. Using pg_dump -Fc (custom format) instead of gzip
```

---

## Security

### File Permissions:

```bash
# Backup script
chmod 700 scripts/backup.sh

# Backup directory
chmod 700 backups/

# Log files
chmod 600 backups/logs/*.log
```

### S3 Credentials:

- Store credentials in `.env` file (not in Git)
- Use IAM user with minimal permissions (S3 PutObject, GetObject, DeleteObject only)
- Rotate credentials periodically
- Enable MFA for S3 bucket

### Backup Encryption:

For sensitive data, consider encrypting backups:

```bash
# Encrypt backup before S3 upload
openssl enc -aes-256-cbc -salt -in backup.sql.gz -out backup.sql.gz.enc -k "your-password"

# Decrypt when restoring
openssl enc -aes-256-cbc -d -in backup.sql.gz.enc -out backup.sql.gz -k "your-password"
```

---

## Future Enhancements

Potential improvements for future versions:

1. **Telegram Notifications**
   - Send success/failure notifications to admin
   - Daily backup status summary

2. **Incremental Backups**
   - WAL archiving for point-in-time recovery
   - Reduce backup size and upload time

3. **Multiple S3 Regions**
   - Cross-region replication for disaster recovery
   - Automatic failover to secondary region

4. **Backup Verification**
   - Automated restore testing
   - Checksum validation

5. **Grafana Dashboard**
   - Backup metrics visualization
   - Alert rules for failures

---

## References

- **PostgreSQL Backup Documentation:** https://www.postgresql.org/docs/current/backup.html
- **AWS CLI S3 Commands:** https://docs.aws.amazon.com/cli/latest/reference/s3/
- **Yandex Object Storage:** https://cloud.yandex.com/en/docs/storage/

---

**Document Version:** 1.0
**Last Updated:** 2025-10-14
**Status:** ✅ Production Ready
**Maintainer:** Family Budget Team
