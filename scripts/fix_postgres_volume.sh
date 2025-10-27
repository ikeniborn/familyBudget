#!/bin/bash
#
# Fix corrupted PostgreSQL volume
#
# This script fixes the current PostgreSQL volume corruption issue by:
# 1. Gracefully stopping all services
# 2. Removing the corrupted postgres_data volume
# 3. Preparing for clean deployment
#
# WARNING: This will DELETE all data in PostgreSQL!
#
# Usage:
#   sudo bash scripts/fix_postgres_volume.sh
#

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  PostgreSQL Volume Corruption Fix${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   echo -e "${RED}[ERROR] This script must be run as root${NC}"
   echo "Usage: sudo bash scripts/fix_postgres_volume.sh"
   exit 1
fi

# Check if in /opt/budget directory
if [[ ! -f "docker-compose.yml" ]]; then
    echo -e "${RED}[ERROR] docker-compose.yml not found${NC}"
    echo "Please run this script from /opt/budget directory:"
    echo "  cd /opt/budget"
    echo "  sudo bash scripts/fix_postgres_volume.sh"
    exit 1
fi

echo -e "${YELLOW}[WARNING] This will DELETE all data in PostgreSQL!${NC}"
echo ""
echo "Current database will be completely removed."
echo "After this, you'll need to run deploy.sh to recreate the database."
echo ""
read -p "Type 'DELETE' to confirm: " confirm
echo ""

if [[ "$confirm" != "DELETE" ]]; then
    echo -e "${BLUE}[INFO] Fix cancelled${NC}"
    exit 0
fi

# Step 1: Gracefully stop all services
echo -e "${BLUE}[1/4] Stopping services gracefully...${NC}"
if docker compose stop --timeout 90 2>/dev/null; then
    echo -e "${GREEN}[SUCCESS] Services stopped${NC}"
else
    echo -e "${YELLOW}[WARNING] Some services may have already been stopped${NC}"
fi
echo ""

# Step 2: Remove containers
echo -e "${BLUE}[2/4] Removing containers...${NC}"
containers=$(docker ps -a --filter "name=familybudget" --format "{{.Names}}" 2>/dev/null || echo "")
if [[ -n "$containers" ]]; then
    echo "$containers" | xargs docker rm 2>/dev/null || true
    echo -e "${GREEN}[SUCCESS] Containers removed${NC}"
else
    echo -e "${BLUE}[INFO] No containers to remove${NC}"
fi
echo ""

# Step 3: Remove corrupted volume
echo -e "${BLUE}[3/4] Removing corrupted PostgreSQL volume...${NC}"
if docker volume rm budget_postgres_data 2>/dev/null; then
    echo -e "${GREEN}[SUCCESS] Volume 'budget_postgres_data' removed${NC}"
else
    echo -e "${YELLOW}[WARNING] Volume may not exist or already removed${NC}"
fi
echo ""

# Step 4: Remove networks
echo -e "${BLUE}[4/4] Removing networks...${NC}"
networks=$(docker network ls --filter "name=familybudget" --format "{{.Name}}" 2>/dev/null || echo "")
if [[ -n "$networks" ]]; then
    echo "$networks" | xargs docker network rm 2>/dev/null || true
    echo -e "${GREEN}[SUCCESS] Networks removed${NC}"
else
    echo -e "${BLUE}[INFO] No networks to remove${NC}"
fi
echo ""

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Fix completed successfully!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo "  1. Make sure docker-compose.yml and deploy.sh have the latest fixes"
echo "  2. Run deployment script:"
echo "     cd /opt/budget"
echo "     sudo bash deploy.sh"
echo ""
echo "The PostgreSQL database will be recreated from scratch."
echo ""
