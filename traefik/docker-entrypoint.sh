#!/bin/sh
set -eu

validate_hostname() {
    host=$1
    [ -n "$host" ] || return 1
    [ ${#host} -le 253 ] || return 1
    case "$host" in
        *[!A-Za-z0-9.-]* | .* | *. | *..*)
            return 1
            ;;
    esac

    old_ifs=$IFS
    IFS=.
    set -- $host
    IFS=$old_ifs

    for label do
        [ -n "$label" ] || return 1
        [ ${#label} -le 63 ] || return 1
        case "$label" in
            -* | *-)
                return 1
                ;;
        esac
    done

    return 0
}

if [ -z "${DOMAIN:-}" ]; then
    echo "ERROR: DOMAIN environment variable is not set" >&2
    exit 1
fi

if ! validate_hostname "$DOMAIN"; then
    echo "ERROR: DOMAIN must be a valid hostname" >&2
    exit 1
fi

if [ -z "${LETSENCRYPT_EMAIL:-}" ]; then
    echo "ERROR: LETSENCRYPT_EMAIL environment variable is not set" >&2
    exit 1
fi

case "$LETSENCRYPT_EMAIL" in
    *@*@* | @* | *@ | '')
        echo "ERROR: LETSENCRYPT_EMAIL must be a valid email address" >&2
        exit 1
        ;;
esac

local_part=${LETSENCRYPT_EMAIL%@*}
domain_part=${LETSENCRYPT_EMAIL#*@}

case "$local_part" in
    *[!A-Za-z0-9._%+-]* | '')
        echo "ERROR: LETSENCRYPT_EMAIL must be a valid email address" >&2
        exit 1
        ;;
esac

if ! validate_hostname "$domain_part"; then
    echo "ERROR: LETSENCRYPT_EMAIL must be a valid email address" >&2
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
