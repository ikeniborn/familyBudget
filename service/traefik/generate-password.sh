#!/bin/bash
# Generate htpasswd compatible password hash for Traefik basic auth

if [ -z "$1" ] || [ -z "$2" ]; then
    echo "Usage: $0 <username> <password>"
    echo "Example: $0 admin mypassword"
    exit 1
fi

USERNAME=$1
PASSWORD=$2

# Generate bcrypt hash using htpasswd
# The result needs to be escaped for docker-compose environment variable
if command -v htpasswd >/dev/null 2>&1; then
    HASH=$(htpasswd -nbB "$USERNAME" "$PASSWORD" | sed -e s/\\$/\\$\\$/g)
    echo "Generated hash for docker-compose .env file:"
    echo "TRAEFIK_DASHBOARD_PASSWORD=$HASH"
else
    echo "htpasswd not found. Install apache2-utils (Debian/Ubuntu) or httpd-tools (CentOS/RHEL)"
    echo "Alternatively, use online htpasswd generator and escape $ symbols by doubling them"
fi