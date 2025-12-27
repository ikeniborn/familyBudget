#!/bin/bash
#
# scripts/lib/network_health.sh - Network Connectivity Pre-flight Checks
#
# This module provides network connectivity validation before installation:
# - Internet connectivity checks (ping)
# - DNS resolution validation
# - Repository accessibility checks
# - Troubleshooting suggestions
#
# Dependencies: config.sh, utils.sh
#
# Usage:
#   source scripts/lib/network_health.sh
#   network_preflight_check "false"
#
# Part of Installation Resilience Framework
#

# =============================================================================
# CORE CONNECTIVITY CHECKS
# =============================================================================

# Check internet connectivity using multiple methods
# Priority: 1. TCP connection test (bash built-in), 2. curl, 3. ping (if available)
# Returns: 0 if any succeed, 1 if all fail
check_internet_connectivity() {
    local test_servers=(
        "8.8.8.8:53"           # Google DNS (port 53)
        "1.1.1.1:53"           # Cloudflare DNS (port 53)
    )
    local test_urls=(
        "http://detectportal.firefox.com/success.txt"  # Mozilla connectivity check
        "http://www.google.com/generate_204"            # Google connectivity check
    )

    local success=false
    local method=""

    # Method 1: TCP connection test using bash built-in (no external tools required)
    for server in "${test_servers[@]}"; do
        local host="${server%:*}"
        local port="${server#*:}"

        if timeout 2 bash -c "echo >/dev/tcp/$host/$port" 2>/dev/null; then
            success=true
            method="TCP connection to $host:$port"
            break
        fi
    done

    # Method 2: Try curl if available (will be installed by install.sh)
    if [[ "$success" != "true" ]] && command -v curl &>/dev/null; then
        for url in "${test_urls[@]}"; do
            if curl -s --max-time 3 --head "$url" &>/dev/null; then
                success=true
                method="HTTP request to $url"
                break
            fi
        done
    fi

    # Method 3: Try ping if available (optional)
    if [[ "$success" != "true" ]] && command -v ping &>/dev/null; then
        for server in "8.8.8.8" "1.1.1.1"; do
            if ping -c 1 -W 2 "$server" &>/dev/null; then
                success=true
                method="ICMP ping to $server"
                break
            fi
        done
    fi

    if [[ "$success" == "true" ]]; then
        info "Internet connectivity: OK ($method)"
        return 0
    else
        warning "Internet connectivity: FAILED (no response from test servers)"
        if ! command -v curl &>/dev/null; then
            warning "  Note: curl not installed - install may fix this"
        fi
        return 1
    fi
}

# Check DNS resolution
# Tests resolution of common domains
# Returns: 0 if any succeed, 1 if all fail
check_dns_resolution() {
    local test_domains=(
        "google.com"
        "github.com"
        "download.docker.com"
    )

    local success=false
    local dns_tool=""

    # Determine available DNS tool
    if command -v getent &>/dev/null; then
        dns_tool="getent"
    elif command -v host &>/dev/null; then
        dns_tool="host"
    elif command -v nslookup &>/dev/null; then
        dns_tool="nslookup"
    elif command -v dig &>/dev/null; then
        dns_tool="dig"
    else
        warning "DNS resolution: SKIPPED (no DNS tools available: getent, host, nslookup, dig)"
        return 0  # Don't fail if no tools available
    fi

    for domain in "${test_domains[@]}"; do
        case "$dns_tool" in
            getent)
                if getent hosts "$domain" &>/dev/null; then
                    success=true
                    break
                fi
                ;;
            host)
                if host "$domain" &>/dev/null; then
                    success=true
                    break
                fi
                ;;
            nslookup)
                if nslookup "$domain" &>/dev/null; then
                    success=true
                    break
                fi
                ;;
            dig)
                if dig +short "$domain" &>/dev/null | grep -q .; then
                    success=true
                    break
                fi
                ;;
        esac
    done

    if [[ "$success" == "true" ]]; then
        info "DNS resolution: OK (resolved $domain using $dns_tool)"
        return 0
    else
        warning "DNS resolution: FAILED (could not resolve any test domains)"
        return 1
    fi
}

# Check repository accessibility
# Tests HTTP access to package repositories
# Returns: 0 if all accessible, 1 if any fail
check_repository_access() {
    local repositories=(
        "http://archive.ubuntu.com/ubuntu"
        "https://download.docker.com"
        "https://deb.nodesource.com"
    )

    local all_success=true

    # Check if curl is available
    if ! command -v curl &>/dev/null; then
        warning "Repository access: SKIPPED (curl not installed yet)"
        return 0  # Don't fail if curl not available
    fi

    for repo in "${repositories[@]}"; do
        if curl -fsSL --max-time 10 --head "$repo" &>/dev/null; then
            info "Repository access: OK ($repo)"
        else
            warning "Repository access: FAILED ($repo)"
            all_success=false
        fi
    done

    if [[ "$all_success" == "true" ]]; then
        return 0
    else
        return 1
    fi
}

# =============================================================================
# PRE-FLIGHT CHECK
# =============================================================================

# Combined network pre-flight check
# Args:
#   $1: strict_mode ("true" = exit on failure, "false" = warn and continue)
# Returns: 0 if all checks pass, 1 if any fail
network_preflight_check() {
    local strict_mode=${1:-false}
    local check_failed=false

    echo ""
    info "==================================================================="
    info "Network Pre-flight Checks"
    info "==================================================================="
    echo ""

    # Check 1: Internet connectivity
    if ! check_internet_connectivity; then
        check_failed=true
    fi

    # Check 2: DNS resolution
    if ! check_dns_resolution; then
        check_failed=true
    fi

    # Check 3: Repository access
    if ! check_repository_access; then
        check_failed=true
    fi

    echo ""
    if [[ "$check_failed" == "true" ]]; then
        warning "==================================================================="
        warning "Network Pre-flight: FAILED (one or more checks failed)"
        warning "==================================================================="
        echo ""

        if [[ "$strict_mode" == "true" ]]; then
            error "Network issues detected - installation cannot proceed in strict mode"
        else
            return 1
        fi
    else
        success "==================================================================="
        success "Network Pre-flight: PASSED (all checks successful)"
        success "==================================================================="
        echo ""
    fi

    return 0
}

# =============================================================================
# TROUBLESHOOTING SUGGESTIONS
# =============================================================================

# Suggest network troubleshooting steps
suggest_network_fixes() {
    echo ""
    echo "==================================================================="
    echo "Network Troubleshooting Suggestions"
    echo "==================================================================="
    echo ""

    echo "1. Check Internet Connectivity:"
    echo "   ping -c 3 8.8.8.8"
    echo "   ping -c 3 google.com"
    echo ""

    echo "2. Check DNS Configuration:"
    echo "   cat /etc/resolv.conf"
    echo "   # Should contain: nameserver 8.8.8.8 (or other DNS server)"
    echo ""

    echo "3. Test Repository Access:"
    echo "   curl -I http://archive.ubuntu.com/ubuntu"
    echo "   curl -I https://download.docker.com"
    echo ""

    echo "4. Check Firewall Rules:"
    echo "   sudo ufw status"
    echo "   sudo iptables -L -n"
    echo ""

    echo "5. Check Proxy Settings:"
    echo "   echo \$HTTP_PROXY"
    echo "   echo \$HTTPS_PROXY"
    echo "   # If proxy required, set:"
    echo "   export HTTP_PROXY=http://proxy:port"
    echo "   export HTTPS_PROXY=http://proxy:port"
    echo ""

    echo "6. Configure APT Proxy (if needed):"
    echo "   sudo bash -c 'echo \"Acquire::http::Proxy \\\"http://proxy:port\\\";\" > /etc/apt/apt.conf.d/proxy.conf'"
    echo ""

    echo "7. Restart Networking:"
    echo "   sudo systemctl restart systemd-networkd"
    echo "   sudo systemctl restart NetworkManager"
    echo ""

    echo "8. Verify Network Interface:"
    echo "   ip addr show"
    echo "   ip route show"
    echo ""

    echo "==================================================================="
    echo ""
}

# =============================================================================
# DIAGNOSTIC FUNCTIONS
# =============================================================================

# Display current network configuration
# For development/testing only
show_network_config() {
    echo "Network Configuration:"
    echo "  DNS servers:"
    cat /etc/resolv.conf | grep nameserver || echo "    (none found)"
    echo ""
    echo "  Default gateway:"
    ip route | grep default || echo "    (none found)"
    echo ""
    echo "  Active interfaces:"
    ip link show | grep -E "^[0-9]+: " | awk '{print "    " $2}' || echo "    (none found)"
    echo ""
    echo "  Proxy settings:"
    echo "    HTTP_PROXY: ${HTTP_PROXY:-not set}"
    echo "    HTTPS_PROXY: ${HTTPS_PROXY:-not set}"
}
