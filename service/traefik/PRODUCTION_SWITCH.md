# Switching Traefik to Production Let's Encrypt

## Important Notes

1. **Before switching to production:**
   - Ensure your domain is correctly pointing to your server
   - Test with staging certificates first (already done)
   - Remove any existing staging certificates

2. **After switching:**
   - Remove the old `acme.json` file if it exists (contains staging certificates)
   - Restart Traefik container to get new production certificates
   - Verify certificates are issued correctly

## Steps to Apply

1. The configuration has been updated to use production Let's Encrypt
2. To apply changes:
   ```bash
   # Remove old staging certificates (if exists)
   docker-compose down traefik
   docker volume rm familybudget_letsencrypt_data 2>/dev/null || true
   
   # Start Traefik with production config
   docker-compose up -d traefik
   
   # Check logs for certificate issuance
   docker-compose logs -f traefik
   ```

3. Verify certificate:
   ```bash
   # Check certificate issuer (should be "Let's Encrypt Authority X3" not "Fake LE")
   openssl s_client -connect your-domain.com:443 -servername your-domain.com < /dev/null 2>/dev/null | openssl x509 -noout -issuer
   ```

## Rate Limits

Let's Encrypt has rate limits for production:
- 50 certificates per registered domain per week
- 5 duplicate certificates per week
- 300 new orders per account per 3 hours

## Rollback

If needed to rollback to staging:
1. Edit `traefik.yml`
2. Comment out production caServer
3. Uncomment staging caServer
4. Remove acme.json and restart