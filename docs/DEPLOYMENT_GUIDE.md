# Deployment Guide - Family Budget Frontend Migration

## Overview

This guide covers the deployment process for migrating from Streamlit to React frontend.

## Prerequisites

- Docker and Docker Compose installed
- Access to production server
- Environment variables configured
- Traefik reverse proxy running on the server

## Environment Setup

### Required Environment Variables

Create a `.env` file with:

```bash
# Domain Configuration
DOMAIN=example.com
FRONTEND_SUBDOMAIN=app
FRONTEND_API_SUBDOMAIN=api

# Database
# POSTGRES_PASSWORD - PostgreSQL superuser password (postgres user)
POSTGRES_PASSWORD=<secure_password>
# BUDGET_DB_PASSWORD - Application database password (budget user)
BUDGET_DB_PASSWORD=<secure_password>

# Frontend API
SESSION_SECRET=<secure_secret>
TELEGRAM_BOT_TOKEN=<bot_token>

# Environment
NODE_ENV=production
USE_UNIFIED_API=true
```

## Deployment Steps

### 1. Initial Deployment

```bash
# Using production script (recommended)
./scripts/prod.sh

# Or manually
docker-compose up -d --build
```

This will:
- Build Docker images for all services
- Deploy services with production configuration
- Apply environment variables from web.env
- Start services in detached mode

### 2. Monitor Deployment

Check service health:
```bash
docker-compose --env-file web.env ps
```

View logs:
```bash
# Frontend logs
docker-compose logs -f frontend

# API logs
docker-compose logs -f frontend-api
```

## Rollback Procedure

If issues occur, restore from backup:

```bash
# Restore previous version
docker-compose down
git checkout <previous-version>
docker-compose up -d
```

## Health Checks

### Frontend Health
- URL: `https://app.example.com/`
- Expected: 200 OK

### Frontend API Health
- URL: `https://api-app.example.com/health`
- Expected: `{"status": "healthy"}`


## Monitoring

### Key Metrics to Monitor

1. **Response Times**
   - Frontend API: < 200ms average
   - Static assets: < 100ms

2. **Error Rates**
   - 4xx errors: < 1%
   - 5xx errors: < 0.1%

3. **Resource Usage**
   - CPU: < 50% per container
   - Memory: Within limits

### Logs to Watch

```bash
# Check for errors
docker-compose logs frontend-api | grep ERROR

# Monitor feature flag decisions
docker-compose logs frontend-api | grep "UI version"
```

## Troubleshooting

### Common Issues

1. **Users stuck on old UI**
   - Clear browser cache
   - Check feature flag configuration
   - Verify cookie settings

2. **API connection errors**
   - Check network connectivity
   - Verify service discovery
   - Check CORS settings

3. **Performance issues**
   - Monitor container resources
   - Check database queries
   - Review browser console

### Debug Mode

Enable debug logging:
```bash
export LOG_LEVEL=debug
docker-compose up -d frontend-api
```

## Post-Deployment

### 1. Update DNS (if needed)
```bash
# Add new subdomains
app.example.com -> Traefik
api-app.example.com -> Traefik
```

### 2. SSL Certificates
Traefik should automatically obtain certificates via Let's Encrypt.

### 3. Backup
Ensure backups include new service data:
- Session data
- User preferences
- Feature flag states

## CI/CD Integration

The deployment is automated via GitHub Actions:

1. **Push to develop** -> Deploy to dev environment
2. **Push to main** -> Deploy to production with feature flag
3. **Manual trigger** -> Full rollout

## Security Considerations

1. **Session Security**
   - Use secure session secret
   - Enable HTTPS only cookies
   - Set appropriate CORS headers

2. **API Security**
   - Validate all inputs
   - Rate limiting enabled
   - Authentication required

3. **Frontend Security**
   - CSP headers configured
   - XSS protection enabled
   - Secure asset delivery

## Success Criteria

Deployment is considered successful when:
- [ ] All services are healthy
- [ ] No increase in error rates
- [ ] Performance metrics maintained
- [ ] User feedback positive
- [ ] No data loss or corruption

## Contact

For deployment support:
- DevOps Team: devops@example.com
- On-call: +1-234-567-8900
- Slack: #deployment-support