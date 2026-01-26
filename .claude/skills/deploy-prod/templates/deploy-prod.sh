#!/usr/bin/env bash
# deploy-prod.sh v1.0.0  
# Automated deployment to budget-prod server (Registry-First Architecture)
# ⚠️ PRODUCTION DEPLOYMENT - REQUIRES EXPLICIT APPROVAL

set -euo pipefail

# Configuration (PRODUCTION)
SSH_HOST="budget-prod"
CODE_LOCATION="~/familyBudget"
DEPLOY_LOCATION="/opt/budget"
BRANCH="test"  # Production deploys from test branch
MIN_TEST_DAYS=7  # Minimum days on budget-test before production

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m'

log_critical() {
    echo -e "${RED}${BOLD}⚠️ CRITICAL:${NC} $*"
}

show_production_warning() {
    echo ""
    log_critical "========================================="
    log_critical "PRODUCTION DEPLOYMENT WARNING"
    log_critical "========================================="
    echo ""
    log_critical "You are about to deploy to PRODUCTION server: budget-prod"
    log_critical "This will affect LIVE USERS and REAL DATA"
    echo ""
    
    read -p "$(echo -e ${RED}${BOLD}Type 'PRODUCTION' to continue:${NC} )" -r
    echo
    
    if [[ "$REPLY" != "PRODUCTION" ]]; then
        echo "Deployment cancelled"
        exit 0
    fi
}

main() {
    show_production_warning
    echo "Production deployment would execute here"
    echo "TODO: Implement full workflow based on deploy-test.sh"
}

main "$@"
