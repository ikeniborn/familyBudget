#!/bin/bash
#
# firewall.sh - Firewall Management
#
# Module for configuring UFW firewall rules
#
# Dependencies: config.sh, utils.sh
#

# Configure firewall for SSL
configure_firewall_for_ssl() {
    # Check if UFW is available
    if ! command_exists ufw; then
        warning "UFW is not installed, skipping firewall configuration"
        return 0
    fi

    step "Configuring Firewall for SSL"

    # Check current status
    local port_80_status="closed"
    local port_443_status="not configured"

    if sudo ufw status 2>/dev/null | grep -q "80/tcp.*ALLOW"; then
        port_80_status="✓ OPEN"
    fi

    if sudo ufw status 2>/dev/null | grep -q "443/tcp.*ALLOW"; then
        port_443_status="✓ configured"
    fi

    info "Current firewall status:"
    echo "  Port 80 (HTTP):   $port_80_status"
    echo "  Port 443 (HTTPS): $port_443_status"
    echo ""

    # Traefik needs port 80 for HTTP-01 challenges and HTTP-to-HTTPS redirects.
    if ! sudo ufw status 2>/dev/null | grep -q "80/tcp.*ALLOW"; then
        sudo ufw allow 80/tcp comment 'Traefik HTTP-01 for Family Budget' >> "$LOG_FILE" 2>&1 || true
        success "✓ Port 80 (HTTP) opened for Traefik HTTP-01"
    else
        info "✓ Port 80 (HTTP) already OPEN for Traefik HTTP-01"
    fi

    # Open port 443 (HTTPS) - this should be ALWAYS open
    if ! sudo ufw status 2>/dev/null | grep -q "443/tcp.*ALLOW"; then
        sudo ufw allow 443/tcp comment 'HTTPS for Family Budget' >> "$LOG_FILE" 2>&1 || true
        success "✓ Port 443 (HTTPS) opened in firewall"
    else
        info "✓ Port 443 (HTTPS) already open"
    fi

    echo ""
    success "Firewall configured for SSL"
    info "Security policy:"
    echo "  ✓ Port 443 (HTTPS): OPEN permanently"
    echo "  ✓ Port 80 (HTTP): OPEN for Traefik HTTP-01 and redirect"
}

# Validate UFW configuration (added for SEC-004, SEC-005 audit compliance)
validate_ufw_rules() {
    step "Validating UFW Configuration"

    # Check if UFW is available
    if ! command_exists ufw; then
        warning "UFW is not installed, skipping validation"
        return 0
    fi

    # Check UFW is active
    if ! sudo ufw status 2>/dev/null | grep -q "Status: active"; then
        error "UFW is not active!"
        warning "To enable: sudo ufw enable"
        return 1
    fi

    local ufw_verbose=$(sudo ufw status verbose)
    local ufw_numbered=$(sudo ufw status numbered)

    # Check default policies
    info "Checking default policies..."
    if echo "$ufw_verbose" | grep -q "Default:.*deny (incoming)"; then
        success "  ✓ Default incoming: DENY"
    else
        error "  ✗ Default incoming policy is NOT deny!"
        warning "    Run: sudo ufw default deny incoming"
    fi

    if echo "$ufw_verbose" | grep -q "Default:.*allow (outgoing)"; then
        success "  ✓ Default outgoing: ALLOW"
    else
        warning "  ⚠ Default outgoing policy is NOT allow (unusual but may be intentional)"
    fi

    # Check required ports
    info "Checking required ports..."

    if echo "$ufw_numbered" | grep -q "22.*ALLOW IN"; then
        success "  ✓ SSH port 22: ALLOWED"
    else
        error "  ✗ SSH port 22 is not allowed!"
        warning "    Run: sudo ufw allow 22/tcp"
    fi

    if echo "$ufw_numbered" | grep -q "443.*ALLOW IN"; then
        success "  ✓ HTTPS port 443: ALLOWED"
    else
        error "  ✗ HTTPS port 443 is not allowed!"
        warning "    Run: sudo ufw allow 443/tcp"
    fi

    # Port 80 is required for Traefik HTTP-01 challenge and HTTP redirect
    if echo "$ufw_numbered" | grep -q "80.*ALLOW IN"; then
        success "  ✓ HTTP port 80: ALLOWED (Traefik HTTP-01)"
    else
        warning "  ⚠ HTTP port 80: CLOSED (Traefik HTTP-01 will fail)"
    fi

    info "Internal-service isolation is checked from Compose and Docker inspect, not UFW INPUT."
    success "UFW validation completed"
    return 0
}

# Reject obsolete publication before any deployment mutation.
validate_internal_service_settings() {
    if [[ "${POSTGRES_EXTERNAL_ACCESS:-false}" == "true" ]]; then
        echo 'POSTGRES_EXTERNAL_ACCESS=true is unsupported. Set it to false explicitly and use SSH forwarding.' >&2
        return 1
    fi
    local port="${BACKEND_PORT:-8000}"
    if [[ ! "$port" =~ ^[0-9]{1,5}$ ]] || (( 10#$port < 1 || 10#$port > 65535 )); then
        echo 'backend: invalid BACKEND_PORT; require numeric TCP port 1..65535' >&2
        return 1
    fi
}

# Read rendered data through a private file so renderer failures cannot be masked.
# Pass false before registry pull; default true requires prebuilt local images.
validate_internal_service_publication() (
    validate_internal_service_settings || exit 1
    umask 077
    local rendered
    rendered=$(mktemp) || exit 1
    trap 'rm -f "$rendered"' EXIT
    if ! compose_cmd config --format json > "$rendered" 2>/dev/null; then
        echo 'publication: Compose rendering failed; check selected files and configuration' >&2
        exit 1
    fi
    python3 "${SCRIPT_DIR}/scripts/validate_service_bindings.py" compose --backend-port "${BACKEND_PORT:-8000}" < "$rendered" || exit 1
    # An override cannot introduce a server-side application build.
    python3 -c 'import json,sys; data=json.load(open(sys.argv[1])); sys.exit(any("build" in s for s in data["services"].values()))' "$rendered" || {
        echo 'publication: build configuration is unsupported; use CI-built images' >&2
        exit 1
    }
    if [[ "${1:-true}" == true ]]; then
        local images image
        images=$(python3 -c 'import json,sys; d=json.load(open(sys.argv[1]))["services"]; names=["postgres","redis","backend"] + (["bot","traefik"] if sys.argv[2]=="full" else []); print("\n".join(d[n].get("image", "") for n in names))' "$rendered" "${DEPLOYMENT_PROFILE:-basic}") || exit 1
        while IFS= read -r image; do
            if [[ -z "$image" ]] || ! docker image inspect "$image" >/dev/null 2>&1; then
                echo 'publication: required prebuilt image missing; pull CI images before deployment' >&2
                exit 1
            fi
        done <<< "$images"
    fi
)

# Request migration even when the ordinary image/change detector finds no change.
mark_internal_publication_recreation() {
    local ids inspected
    ids=$(compose_cmd ps -q postgres redis backend) || return 1
    [[ -n "$ids" ]] || return 0
    inspected=$(mktemp) || return 1
    chmod 600 "$inspected"
    local -a containers
    mapfile -t containers <<< "$ids"
    if ! docker inspect "${containers[@]}" > "$inspected" 2>/dev/null; then
        rm -f "$inspected"
        echo 'publication: cannot inspect existing services before migration' >&2
        return 1
    fi
    if ! python3 "${SCRIPT_DIR}/scripts/validate_service_bindings.py" runtime --backend-port "${BACKEND_PORT:-8000}" < "$inspected" >/dev/null 2>&1; then
        export NEEDS_POSTGRES_RECREATE=true NEEDS_REDIS_RECREATE=true NEEDS_BACKEND_RECREATE=true
        echo 'Publication migration requires internal-service recreation; volumes remain attached.'
    fi
    rm -f "$inspected"
}

# Inspect the selected containers, then prove host and Docker-name connectivity.
verify_internal_service_publication() (
    validate_internal_service_settings || exit 1
    umask 077
    local inspected ids
    inspected=$(mktemp) || exit 1
    trap 'rm -f "$inspected"' EXIT
    ids=$(compose_cmd ps -q postgres redis backend) || exit 1
    [[ -n "$ids" ]] || { echo 'publication: service containers missing' >&2; exit 1; }
    local -a containers
    mapfile -t containers <<< "$ids"
    docker inspect "${containers[@]}" > "$inspected" 2>/dev/null || {
        echo 'publication: container inspection failed' >&2; exit 1;
    }
    python3 "${SCRIPT_DIR}/scripts/validate_service_bindings.py" runtime --backend-port "${BACKEND_PORT:-8000}" < "$inspected" || exit 1
    python3 -c 'import json,sys; d=json.load(open(sys.argv[1])); sys.exit(any(c.get("State",{}).get("Health",{}).get("Status")!="healthy" for c in d))' "$inspected" || {
        echo 'publication: internal service health check failed' >&2; exit 1;
    }
    python3 -c 'import socket,sys; ports=[5432,6379,int(sys.argv[1])]; [(socket.create_connection(("127.0.0.1",p),timeout=3).close()) for p in ports]' "${BACKEND_PORT:-8000}" 2>/dev/null || {
        echo 'publication: host loopback TCP check failed' >&2; exit 1;
    }
    curl --fail --silent --output /dev/null --connect-timeout 3 --max-time 10 "http://127.0.0.1:${BACKEND_PORT:-8000}/health" || {
        echo 'publication: backend loopback health request failed' >&2; exit 1;
    }
    compose_cmd exec -T backend python -c 'import socket; [(socket.create_connection((host,port),timeout=3).close()) for host,port in [("postgres",5432),("redis",6379)]]' >/dev/null 2>&1 || {
        echo 'publication: backend Docker service-name connectivity failed' >&2; exit 1;
    }
    echo 'Internal publications verified: loopback, healthy services, host and Docker connectivity. External release probe remains required.'
)

# Preserve operator firewall rules. Loopback publication replaces global chain edits.
configure_docker_firewall() {
    validate_internal_service_settings || return 1
    echo 'Docker firewall rules preserved; verify actual loopback publication.'
}

configure_ufw_for_postgres() {
    validate_internal_service_settings || return 1
    echo 'PostgreSQL UFW rules preserved; administration uses loopback or SSH forwarding.'
}
