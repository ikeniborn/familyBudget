#!/bin/sh
set -eu

if [ -z "${DOMAIN:-}" ]; then
    echo "ERROR: DOMAIN environment variable is not set" >&2
    exit 1
fi

if [ -z "${LETSENCRYPT_EMAIL:-}" ]; then
    echo "ERROR: LETSENCRYPT_EMAIL environment variable is not set" >&2
    exit 1
fi

mkdir -p /conf.d /data
touch /data/acme.json
chmod 600 /data/acme.json

for template in /conf.d/*.tmpl; do
    [ -f "$template" ] || continue
    target="${template%.tmpl}"
    sed "s|{{DOMAIN}}|$DOMAIN|g" "$template" > "$target"
done

exec traefik --configFile=/traefik.yml
