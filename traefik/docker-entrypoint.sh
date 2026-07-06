#!/bin/sh
set -eu

if [ -z "${DOMAIN:-}" ]; then
    echo "ERROR: DOMAIN environment variable is not set" >&2
    exit 1
fi

case "$DOMAIN" in
    *[!A-Za-z0-9.-]* | .* | *. | -* | *- | *..* | *.-* | *-.*)
        echo "ERROR: DOMAIN must be a valid hostname" >&2
        exit 1
        ;;
esac

if [ -z "${LETSENCRYPT_EMAIL:-}" ]; then
    echo "ERROR: LETSENCRYPT_EMAIL environment variable is not set" >&2
    exit 1
fi

mkdir -p /rendered-conf.d /data
touch /data/acme.json
chmod 600 /data/acme.json

sed "s|{{LETSENCRYPT_EMAIL}}|$LETSENCRYPT_EMAIL|g" /traefik.yml > /tmp/traefik.yml

for template in /conf.d/*.tmpl; do
    [ -f "$template" ] || continue
    filename="${template##*/}"
    target="/rendered-conf.d/${filename%.tmpl}"
    sed "s|{{DOMAIN}}|$DOMAIN|g" "$template" > "$target"
done

exec traefik --configFile=/tmp/traefik.yml
