# Traefik Configuration

## Overview

This directory contains Traefik reverse proxy configuration with automatic SSL/TLS certificates from Let's Encrypt.

## Features

- Automatic HTTPS with Let's Encrypt
- HTTP to HTTPS redirection
- Security headers middleware
- Rate limiting
- Compression
- Dashboard with basic auth

## URLs

After deployment, services will be available at:

- `https://budget.${TRAEFIK_DOMAIN}` - Budget UI
- `https://api.${TRAEFIK_DOMAIN}` - Budget API
- `https://notes.${TRAEFIK_DOMAIN}` - CouchDB
- `https://traefik.${TRAEFIK_DOMAIN}` - Traefik Dashboard

## Configuration

### Static Configuration (traefik.yml)
- Entry points (HTTP/HTTPS)
- Let's Encrypt resolver
- Docker provider settings

### Dynamic Configuration (dynamic/)
- Middleware definitions
- Security headers
- Rate limiting
- Compression

## Setup

1. Set environment variables in `.env`:
   ```
   TRAEFIK_DOMAIN=yourdomain.com
   ACME_EMAIL=your-email@example.com
   TRAEFIK_DASHBOARD_USER=admin
   TRAEFIK_DASHBOARD_PASSWORD=<htpasswd_hash>
   ```

2. Generate password hash for dashboard:
   ```bash
   ./generate-password.sh admin yourpassword
   ```

3. For production, update `traefik.yml`:
   - Comment out staging CA server
   - Uncomment production CA server

## Troubleshooting

- Check Traefik logs: `docker logs traefik`
- Verify certificates: Check `/letsencrypt/acme.json` in container
- Dashboard access: Ensure password hash is properly escaped

## Security Notes

- Dashboard is protected with basic auth
- All services use HTTPS with proper security headers
- Rate limiting is enabled on API endpoints
- HSTS is enabled with preload