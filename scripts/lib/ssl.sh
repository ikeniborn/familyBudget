#!/bin/bash
#
# scripts/lib/ssl.sh - Deprecated SSL rollback hooks
#
# Active deployments use Traefik native ACME. deploy.sh no longer sources this
# module. The functions remain as no-op placeholders so older manual rollback
# notes fail safely instead of invoking host certificate tooling.
#

setup_ssl_certificates() {
    warning "setup_ssl_certificates is deprecated: active deploys use Traefik native ACME"
    return 0
}

verify_ssl() {
    warning "verify_ssl is deprecated: active deploys use Traefik native ACME"
    return 0
}
