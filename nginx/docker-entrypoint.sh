#!/bin/sh
set -e

# Process nginx configuration templates
# Replaces {{DOMAIN}} with value from DOMAIN environment variable

if [ -z "$DOMAIN" ]; then
    echo "ERROR: DOMAIN environment variable is not set"
    exit 1
fi

echo "Processing nginx templates with DOMAIN=$DOMAIN"

# Process all .template files in /etc/nginx/conf.d/
for template in /etc/nginx/conf.d/*.template; do
    if [ -f "$template" ]; then
        output="${template%.template}"
        echo "  Processing: $template -> $output"
        sed "s|{{DOMAIN}}|$DOMAIN|g" "$template" > "$output"
    fi
done

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
