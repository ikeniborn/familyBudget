#!/bin/sh
set -e

# Process nginx configuration templates
# Replaces {{DOMAIN}} with value from DOMAIN environment variable
# Smart selection: HTTP-only OR HTTPS based on SSL certificate presence

if [ -z "$DOMAIN" ]; then
    echo "ERROR: DOMAIN environment variable is not set"
    exit 1
fi

echo "Processing nginx templates with DOMAIN=$DOMAIN"

# Check if SSL certificate exists
SSL_CERT="/etc/letsencrypt/live/$DOMAIN/fullchain.pem"
if [ -f "$SSL_CERT" ]; then
    echo "✓ SSL certificate found: $SSL_CERT"
    echo "  Using HTTPS configuration (app-https.conf)"

    # Process HTTPS template
    sed "s|{{DOMAIN}}|$DOMAIN|g" /etc/nginx/conf.d/app-https.conf.template > /etc/nginx/conf.d/app-https.conf

    # Remove HTTP template to avoid duplicate upstream
    rm -f /etc/nginx/conf.d/app-http.conf.template
else
    echo "⚠ SSL certificate not found: $SSL_CERT"
    echo "  Using HTTP-only configuration (app-http.conf)"

    # Process HTTP template
    sed "s|{{DOMAIN}}|$DOMAIN|g" /etc/nginx/conf.d/app-http.conf.template > /etc/nginx/conf.d/app-http.conf

    # Remove HTTPS template to avoid duplicate upstream
    rm -f /etc/nginx/conf.d/app-https.conf.template
fi

# Remove default.conf to avoid conflicts
if [ -f /etc/nginx/conf.d/default.conf ]; then
    echo "  Removing default.conf"
    rm /etc/nginx/conf.d/default.conf
fi

# Validate nginx configuration
echo "Validating nginx configuration..."
nginx -t

# Start nginx
echo "Starting nginx..."
exec nginx -g "daemon off;"
