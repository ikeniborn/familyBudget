# Admin Setup and Deployment Guide

**Last Updated:** 2025-09-08  
**Version:** 1.0.0  
**Target Environment:** Production, Staging, Development

## Overview

This guide covers the setup and deployment of admin access control functionality in the Family Budget application. The admin system provides system-wide management capabilities restricted to designated administrator users.

## Prerequisites

- Family Budget application v1.0+ deployed
- Docker and Docker Compose installed
- PostgreSQL database running
- Redis cache running
- Valid SSL certificates (production only)

## Admin User Creation

### Automatic Setup (Recommended)

The admin user is automatically designated as **User ID 1** in the system. No special setup is required - the first user to register becomes the admin.

#### Development Environment

```bash
# Start development environment
cd /home/ikeniborn/Documents/Project/familyBudget
./scripts/dev.sh --init-db

# Access the application
open http://localhost:5173

# Register first user - this becomes the admin (ID 1)
# Use Telegram authentication or password login
```

#### Production Environment

```bash
# Deploy production environment
./scripts/prod.sh

# Access the application
open https://your-domain.com

# Register first user through Telegram bot or password login
```

### Manual Admin Assignment

If you need to designate a different user as admin:

```bash
# Connect to PostgreSQL
docker exec -it budget-postgres psql -U budget -d budgetdb

# Check current users
SELECT id, telegram_id, username, first_name FROM t_d_user ORDER BY id;

# Swap user IDs (if needed)
BEGIN;
UPDATE t_d_user SET id = -999 WHERE id = 1;  -- Temp ID for current admin
UPDATE t_d_user SET id = 1 WHERE id = 2;     -- New admin user
UPDATE t_d_user SET id = 2 WHERE id = -999;  -- Old admin becomes regular user
COMMIT;

# Verify changes
SELECT id, telegram_id, username, first_name FROM t_d_user ORDER BY id;
```

**⚠️ Warning:** This operation affects data relationships. Test thoroughly in staging first.

## Configuration Changes

### Environment Variables

No additional environment variables are required. The admin system uses existing configuration.

#### Optional Security Enhancements

Add to `.env` file:

```bash
# Admin session timeout (default: 4 hours)
ADMIN_SESSION_TIMEOUT=14400

# Enable admin audit logging (default: true)
ADMIN_AUDIT_ENABLED=true

# Admin IP restrictions (comma-separated, optional)
ADMIN_ALLOWED_IPS=192.168.1.100,10.0.0.0/8

# Admin rate limits (requests per minute)
ADMIN_RATE_LIMIT=100
ADMIN_BULK_RATE_LIMIT=10
ADMIN_SYSTEM_RATE_LIMIT=5
```

### Docker Compose Updates

No changes needed to existing `docker-compose.yml`. The admin functionality is included in the standard deployment.

## Security Configuration

### SSL/TLS Setup (Production)

Admin endpoints require HTTPS in production:

```yaml
# docker-compose.prod.yml
services:
  traefik:
    command:
      - --certificatesresolvers.letsencrypt.acme.tlschallenge=true
      - --certificatesresolvers.letsencrypt.acme.email=admin@your-domain.com
      - --certificatesresolvers.letsencrypt.acme.storage=/letsencrypt/acme.json
    volumes:
      - ./letsencrypt:/letsencrypt
    
  frontend:
    labels:
      - "traefik.http.routers.frontend.tls=true"
      - "traefik.http.routers.frontend.tls.certresolver=letsencrypt"
```

### Firewall Configuration

Restrict admin access at the network level:

```bash
# Allow admin access only from specific IPs
sudo ufw allow from 192.168.1.100 to any port 443
sudo ufw allow from 10.0.0.0/8 to any port 443

# Block all other admin access (optional - use with caution)
# sudo ufw deny from any to any port 443
```

## Database Migration

No database migrations are required. The admin system works with existing schema:

```bash
# Verify database structure
docker exec budget-backend alembic current
docker exec budget-backend alembic check

# If migrations pending, run them
docker exec budget-backend alembic upgrade head
```

## Deployment Steps

### Development Deployment

```bash
# 1. Pull latest code
git pull origin master

# 2. Build and start services
./scripts/dev.sh -d

# 3. Verify admin functionality
curl -H "Cookie: connect.sid=..." http://localhost:4000/api/users/

# 4. Run admin tests
docker exec budget-backend python -m pytest tests/test_admin_api.py -v
docker exec budget-frontend npm run test -- auth.store.test.ts
```

### Staging Deployment

```bash
# 1. Deploy to staging environment
./scripts/staging.sh

# 2. Run full test suite
./scripts/test-all.sh

# 3. Test admin functionality
curl -H "Cookie: connect.sid=..." https://staging.your-domain.com/api/users/

# 4. Verify security measures
docker exec budget-backend python -m pytest tests/security/ -v
```

### Production Deployment

```bash
# 1. Create backup before deployment
docker exec budget-postgres pg_dump -U budget budgetdb > backup-pre-admin.sql

# 2. Deploy production
./scripts/prod.sh

# 3. Verify services are running
docker ps -a | grep budget

# 4. Test admin access
# (Use actual admin credentials)

# 5. Monitor logs for errors
docker logs budget-backend --tail 100 -f
docker logs budget-frontend --tail 100 -f
```

## Verification and Testing

### Functional Testing

```bash
# Test admin access (replace with actual session)
export ADMIN_SESSION="s%3A..."

# 1. Test user list access
curl -H "Cookie: connect.sid=$ADMIN_SESSION" \
     https://your-domain.com/api/users/

# 2. Test system info access  
curl -H "Cookie: connect.sid=$ADMIN_SESSION" \
     https://your-domain.com/api/admin/system-info

# 3. Test non-admin rejection (use regular user session)
export USER_SESSION="s%3A..."
curl -H "Cookie: connect.sid=$USER_SESSION" \
     https://your-domain.com/api/users/
# Should return 403 Forbidden
```

### Security Testing

```bash
# Run security test suite
docker exec budget-backend python -m pytest tests/security/test_admin_access.py -v

# Test unauthorized access attempts
curl https://your-domain.com/api/users/
# Should return 401 Unauthorized

# Test privilege escalation prevention
# (Attempt to access admin endpoints with regular user)
```

### Performance Testing

```bash
# Test admin endpoint performance
time curl -H "Cookie: connect.sid=$ADMIN_SESSION" \
          https://your-domain.com/api/users/

# Load test admin endpoints
docker exec budget-backend python scripts/load-test-admin.py
```

## Monitoring Setup

### Application Metrics

Monitor admin-specific metrics:

```yaml
# prometheus/admin-metrics.yml
- name: admin_endpoint_requests_total
  help: Total admin endpoint requests
  type: counter
  labels: [endpoint, user_id, status_code]

- name: admin_session_duration_seconds
  help: Admin session duration
  type: histogram
  
- name: admin_failed_access_attempts_total
  help: Failed admin access attempts
  type: counter
  labels: [endpoint, user_id, ip_address]
```

### Log Monitoring

Configure log aggregation for admin actions:

```json
{
  "admin_audit_log": {
    "enabled": true,
    "level": "INFO",
    "format": "json",
    "fields": [
      "timestamp",
      "user_id", 
      "endpoint",
      "method",
      "ip_address",
      "user_agent",
      "response_code",
      "duration_ms"
    ]
  }
}
```

### Alert Configuration

Set up alerts for admin activities:

```yaml
# alerts/admin-alerts.yml
groups:
  - name: admin_security
    rules:
      - alert: HighAdminFailedAttempts
        expr: rate(admin_failed_access_attempts_total[5m]) > 0.1
        for: 1m
        annotations:
          summary: High rate of failed admin access attempts
          
      - alert: UnusualAdminActivity  
        expr: hour() < 6 or hour() > 22
        for: 0m
        annotations:
          summary: Admin access outside business hours
          
      - alert: AdminBulkOperation
        expr: increase(admin_bulk_operations_total[1h]) > 5
        for: 0m
        annotations:
          summary: High volume of admin bulk operations
```

## Troubleshooting

### Common Issues

#### 1. Admin User Cannot Access Admin Features

**Symptoms:**
- 403 Forbidden errors on admin endpoints
- Admin UI elements hidden

**Diagnosis:**
```bash
# Check user ID
docker exec -it budget-postgres psql -U budget -d budgetdb -c \
  "SELECT id, username FROM t_d_user WHERE id = 1;"

# Check session  
docker exec -it budget-redis redis-cli
> KEYS "sess:*"
> GET "sess:session_id_here"
```

**Solutions:**
```bash
# Ensure user ID 1 exists and is correct admin
# If needed, reassign admin privileges (see Manual Admin Assignment)

# Clear and regenerate session
# Log out and log back in as admin user
```

#### 2. Regular Users See Admin Features

**Symptoms:**
- Non-admin users see system settings
- Non-admin users can access admin routes

**Diagnosis:**
```bash
# Check frontend auth store
# Open browser dev tools
# Application > Local Storage > Check user data

# Check API responses
curl -H "Cookie: connect.sid=..." http://localhost:4000/api/auth/me
```

**Solutions:**
```bash
# Clear browser cache and local storage
# Restart frontend service
docker-compose restart budget-frontend

# Verify isAdmin utility is working
docker exec budget-frontend npm run test -- auth.store.test.ts
```

#### 3. 500 Internal Server Errors on Admin Endpoints

**Symptoms:**
- Admin endpoints return 500 errors
- Database connection errors in logs

**Diagnosis:**
```bash
# Check backend logs
docker logs budget-backend --tail 100

# Check database connectivity
docker exec budget-backend python -c "from app.db.database import engine; print(engine.execute('SELECT 1').scalar())"

# Check admin dependency
docker exec budget-backend python -c "from app.core.security import require_admin_access; print('OK')"
```

**Solutions:**
```bash
# Restart backend service
docker-compose restart budget-backend

# Check and update dependencies
docker exec budget-backend pip list | grep fastapi

# Run database health check
docker exec budget-postgres pg_isready -U budget
```

### Debug Commands

```bash
# Check all containers status
docker ps -a

# View real-time logs
docker logs -f budget-backend | grep admin
docker logs -f budget-frontend | grep admin

# Test database connection
docker exec -it budget-postgres psql -U budget -d budgetdb -c "SELECT version();"

# Check Redis sessions
docker exec -it budget-redis redis-cli INFO
docker exec -it budget-redis redis-cli KEYS "*"

# Verify API endpoints
docker exec budget-backend python scripts/list-endpoints.py | grep admin
```

## Rollback Procedures

### Emergency Rollback

If admin functionality causes issues:

```bash
# 1. Immediate rollback to previous version
git log --oneline -5  # Find previous commit
git checkout <previous-commit-hash>

# 2. Rebuild and restart
docker-compose down
docker-compose up -d --build

# 3. Verify system functionality
curl http://localhost:4000/health
```

### Selective Rollback

To disable admin features without full rollback:

```bash
# 1. Disable admin endpoints temporarily
docker exec budget-backend python scripts/disable-admin-endpoints.py

# 2. Hide admin UI elements
docker exec budget-frontend npm run build -- --disable-admin

# 3. Clear admin-related cache
docker exec budget-redis redis-cli FLUSHDB
```

## Backup and Recovery

### Pre-Deployment Backup

```bash
# Create full system backup before deploying admin features
mkdir -p backups/$(date +%Y%m%d)

# Database backup
docker exec budget-postgres pg_dump -U budget budgetdb > backups/$(date +%Y%m%d)/database.sql

# Configuration backup  
cp -r .env docker-compose.yml backups/$(date +%Y%m%d)/

# Code backup
git archive HEAD > backups/$(date +%Y%m%d)/codebase.tar
```

### Recovery Procedures

```bash
# Restore database
docker exec -i budget-postgres psql -U budget budgetdb < backups/20240908/database.sql

# Restore configuration
cp backups/20240908/.env .
cp backups/20240908/docker-compose.yml .

# Restart services
docker-compose down && docker-compose up -d
```

## Security Checklist

### Deployment Security

- [ ] Admin user (ID 1) properly configured
- [ ] HTTPS enabled for production
- [ ] Session security configured
- [ ] IP restrictions configured (if needed)
- [ ] Rate limiting enabled
- [ ] Audit logging enabled
- [ ] Backup encryption enabled
- [ ] Firewall rules configured

### Post-Deployment Verification

- [ ] Admin can access all admin endpoints
- [ ] Regular users get 403 on admin endpoints
- [ ] Unauthenticated users get 401 on admin endpoints
- [ ] Admin UI elements show/hide correctly
- [ ] Session timeout working properly
- [ ] Audit logs being generated
- [ ] Monitoring alerts configured
- [ ] Backup procedures tested

## Maintenance

### Regular Tasks

**Daily:**
- Monitor admin access logs
- Check for failed authentication attempts
- Verify system health metrics

**Weekly:**
- Review admin audit logs
- Test backup and recovery procedures
- Update security patches if available

**Monthly:**
- Review admin access patterns
- Update documentation if needed
- Conduct security assessment
- Test disaster recovery procedures

### Updates and Patches

```bash
# Update admin-related dependencies
docker exec budget-backend pip install --upgrade fastapi sqlalchemy
docker exec budget-frontend npm update

# Apply security patches
# Follow security advisory procedures

# Test after updates
./scripts/test-all.sh
```

## Support and Documentation

### Internal Documentation
- [Architecture Decision Record](/docs/architecture/adr-001-admin-access-control.md)
- [API Security Changes](/docs/api/security-changes.md)  
- [Admin Endpoints Documentation](/docs/api/admin-endpoints.md)

### External Resources
- [FastAPI Security Guide](https://fastapi.tiangolo.com/tutorial/security/)
- [Docker Security Best Practices](https://docs.docker.com/engine/security/)
- [PostgreSQL Security Guide](https://www.postgresql.org/docs/current/security.html)

### Emergency Contacts
- System Administrator: admin@your-domain.com
- Development Team: dev-team@your-domain.com
- Security Team: security@your-domain.com

## Changelog

**v1.0.0 (2024-09-08)**
- Initial admin setup and deployment guide
- Security configuration procedures
- Troubleshooting and maintenance guides
- Complete deployment workflows