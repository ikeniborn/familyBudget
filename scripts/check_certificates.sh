#!/bin/bash
#
# Family Budget - SSL Certificate Check Helper
#
# This script provides intelligent certificate checking functionality:
# - Detects existing SSL certificates
# - Compares with new domain
# - Offers cleanup when needed
# - Never deletes automatically
#
# Usage:
#   source scripts/check_certificates.sh
#   check_and_offer_certificate_cleanup "new-domain.com" "/path/to/certbot/conf"
#
# Author: Family Budget Team
# Version: 1.0.0
#

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Print colored message
print_cert_message() {
    local color=$1
    shift
    echo -e "${color}$*${NC}"
}

# Check if certbot command exists (for getting certificate info)
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Get list of existing certificate domains
get_existing_domains() {
    local certbot_conf_dir=$1
    local live_dir="$certbot_conf_dir/live"

    if [[ ! -d "$live_dir" ]]; then
        echo ""
        return
    fi

    # List directories in live/ (each is a domain)
    find "$live_dir" -mindepth 1 -maxdepth 1 -type d -exec basename {} \; 2>/dev/null || echo ""
}

# Get certificate expiry date
get_cert_expiry() {
    local certbot_conf_dir=$1
    local domain=$2
    local cert_path="$certbot_conf_dir/live/$domain/fullchain.pem"

    if [[ ! -f "$cert_path" ]]; then
        echo "unknown"
        return
    fi

    if command_exists openssl; then
        local expiry_date
        expiry_date=$(openssl x509 -enddate -noout -in "$cert_path" 2>/dev/null | cut -d= -f2)

        if [[ -n "$expiry_date" ]]; then
            # Calculate days remaining
            local expiry_timestamp
            expiry_timestamp=$(date -d "$expiry_date" +%s 2>/dev/null)
            local now_timestamp
            now_timestamp=$(date +%s)
            local days_remaining=$(( (expiry_timestamp - now_timestamp) / 86400 ))

            echo "$expiry_date ($days_remaining дней)"
        else
            echo "unknown"
        fi
    else
        echo "unknown (openssl not available)"
    fi
}

# Check and offer certificate cleanup
# Args:
#   $1 - new domain
#   $2 - certbot conf directory path
# Returns:
#   0 - no action needed or cleanup completed
#   1 - cleanup was offered but declined
check_and_offer_certificate_cleanup() {
    local new_domain=$1
    local certbot_conf_dir=$2

    # Validate arguments
    if [[ -z "$new_domain" || -z "$certbot_conf_dir" ]]; then
        print_cert_message "$RED" "[ERROR] check_and_offer_certificate_cleanup: missing arguments"
        return 1
    fi

    # Check if certbot conf directory exists
    if [[ ! -d "$certbot_conf_dir" ]]; then
        # No certbot directory - nothing to clean
        return 0
    fi

    # Get existing domains
    local existing_domains
    existing_domains=$(get_existing_domains "$certbot_conf_dir")

    # If no existing certificates, nothing to do
    if [[ -z "$existing_domains" ]]; then
        return 0
    fi

    echo ""
    print_cert_message "$CYAN" "▶ Проверка существующих SSL сертификатов"
    echo ""

    # Show existing certificates
    print_cert_message "$BLUE" "[INFO] Найдены существующие сертификаты:"
    for domain in $existing_domains; do
        local expiry
        expiry=$(get_cert_expiry "$certbot_conf_dir" "$domain")
        echo "  • $domain (до $expiry)"
    done
    echo ""

    # Scenario 1: Same domain - reuse certificate
    if echo "$existing_domains" | grep -q "^${new_domain}$"; then
        print_cert_message "$GREEN" "[SUCCESS] Найден сертификат для $new_domain"
        local expiry
        expiry=$(get_cert_expiry "$certbot_conf_dir" "$new_domain")
        print_cert_message "$BLUE" "[INFO] Сертификат действителен до: $expiry"
        print_cert_message "$GREEN" "[SUCCESS] Сертификат будет переиспользован (экономия лимитов Let's Encrypt)"
        echo ""
        return 0
    fi

    # Scenario 2: Different domain - offer cleanup
    if [[ "$new_domain" != "localhost" ]]; then
        print_cert_message "$YELLOW" "[WARNING] Несоответствие доменов:"
        echo "  Существующие: $existing_domains"
        echo "  Новый:        $new_domain"
        echo ""
        print_cert_message "$BLUE" "[INFO] Старые сертификаты не подходят для нового домена"
        print_cert_message "$BLUE" "[INFO] Рекомендуется очистить их перед получением нового сертификата"
        echo ""

        read -p "Очистить старые сертификаты сейчас? [Y/n]: " cleanup_choice
        echo ""

        if [[ "${cleanup_choice,,}" != "n" ]]; then
            # Call cleanup script
            local cleanup_script
            cleanup_script="$(cd "$(dirname "$certbot_conf_dir")/.." && pwd)/scripts/clean_old_certificates.sh"

            if [[ -x "$cleanup_script" ]]; then
                print_cert_message "$BLUE" "[INFO] Запуск скрипта очистки..."
                echo ""

                if "$cleanup_script" --auto; then
                    print_cert_message "$GREEN" "[SUCCESS] Старые сертификаты очищены"
                    echo ""
                    return 0
                else
                    print_cert_message "$RED" "[ERROR] Ошибка при очистке сертификатов"
                    echo ""
                    return 1
                fi
            else
                print_cert_message "$YELLOW" "[WARNING] Скрипт очистки не найден: $cleanup_script"
                print_cert_message "$BLUE" "[INFO] Вы можете очистить вручную:"
                echo "  rm -rf $certbot_conf_dir/*"
                echo ""

                read -p "Продолжить без очистки? [y/N]: " continue_choice
                echo ""

                if [[ "${continue_choice,,}" == "y" ]]; then
                    return 0
                else
                    return 1
                fi
            fi
        else
            print_cert_message "$YELLOW" "[WARNING] Очистка пропущена"
            print_cert_message "$BLUE" "[INFO] Старые сертификаты могут вызвать конфликты"
            echo ""
            return 1
        fi
    fi

    # Scenario 3: localhost - offer cleanup for tidiness
    if [[ "$new_domain" == "localhost" ]]; then
        print_cert_message "$BLUE" "[INFO] Выбрана локальная разработка (localhost)"
        print_cert_message "$BLUE" "[INFO] Найдены SSL сертификаты от предыдущего деплоя"
        print_cert_message "$BLUE" "[INFO] Они не будут использованы в локальной разработке"
        echo ""

        read -p "Очистить неиспользуемые сертификаты для порядка? [y/N]: " cleanup_choice
        echo ""

        if [[ "${cleanup_choice,,}" == "y" ]]; then
            # Call cleanup script
            local cleanup_script
            cleanup_script="$(cd "$(dirname "$certbot_conf_dir")/.." && pwd)/scripts/clean_old_certificates.sh"

            if [[ -x "$cleanup_script" ]]; then
                if "$cleanup_script" --auto; then
                    print_cert_message "$GREEN" "[SUCCESS] Сертификаты очищены"
                    echo ""
                    return 0
                else
                    print_cert_message "$YELLOW" "[WARNING] Ошибка при очистке, но это не критично для localhost"
                    echo ""
                    return 0
                fi
            else
                print_cert_message "$YELLOW" "[WARNING] Скрипт очистки не найден"
                echo ""
                return 0
            fi
        else
            print_cert_message "$BLUE" "[INFO] Сертификаты сохранены (не влияет на локальную разработку)"
            echo ""
            return 0
        fi
    fi

    return 0
}

# Export function for use in other scripts
export -f check_and_offer_certificate_cleanup
