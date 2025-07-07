#!/bin/bash

# Emergency Rollback Script - Restore Python Backend API
# Use this script to quickly restore Python API in case of issues

set -e

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${RED}Emergency Rollback to Python Backend API${NC}"
echo "========================================="
echo ""

# Function to prompt for confirmation
confirm() {
    read -p "$1 (y/N): " response
    case "$response" in
        [yY][eE][sS]|[yY]) 
            return 0
            ;;
        *)
            return 1
            ;;
    esac
}

# Function for quick rollback (5 minutes)
quick_rollback() {
    echo -e "${YELLOW}Performing quick rollback...${NC}"
    
    # Option 1: Use backup configuration
    if [ -f "docker-compose-with-python-backup.yaml" ]; then
        echo "Using backup configuration..."
        cp docker-compose-with-python-backup.yaml docker-compose.yaml
        
        # Update environment to disable unified API
        if [ -f ".env" ]; then
            sed -i 's/USE_UNIFIED_API=.*/USE_UNIFIED_API=false/' .env
        fi
        
        # Restart services
        docker-compose down
        docker-compose up -d
        
        echo -e "${GREEN}✓ Quick rollback completed${NC}"
        return 0
    fi
    
    # Option 2: Git rollback
    if git status > /dev/null 2>&1; then
        echo "Using git to restore configuration..."
        git checkout HEAD~1 -- docker-compose.yaml
        
        # Update environment
        if [ -f ".env" ]; then
            sed -i 's/USE_UNIFIED_API=.*/USE_UNIFIED_API=false/' .env
        fi
        
        # Restart services
        docker-compose down
        docker-compose up -d
        
        echo -e "${GREEN}✓ Git rollback completed${NC}"
        return 0
    fi
    
    echo -e "${RED}✗ No backup configuration found${NC}"
    return 1
}

# Function for complete rollback (30 minutes)
complete_rollback() {
    echo -e "${YELLOW}Performing complete rollback...${NC}"
    
    # Find latest backup
    LATEST_BACKUP=$(find backups/ -name "python-api-*" -type d | sort | tail -n 1)
    
    if [ -n "$LATEST_BACKUP" ] && [ -d "$LATEST_BACKUP" ]; then
        echo "Restoring from backup: $LATEST_BACKUP"
        
        # Restore configuration
        cp "$LATEST_BACKUP/docker-compose.yaml" ./
        
        # Restore Python API code if archived
        ARCHIVE_FILE=$(find archive/ -name "python-api-*.tar.gz" | sort | tail -n 1)
        if [ -n "$ARCHIVE_FILE" ] && [ -f "$ARCHIVE_FILE" ]; then
            echo "Restoring Python API code..."
            tar -xzf "$ARCHIVE_FILE"
        fi
        
        # Restore environment
        if [ -f "$LATEST_BACKUP/.env" ]; then
            cp "$LATEST_BACKUP/.env" ./
        fi
        
        # Update to use Python API
        if [ -f ".env" ]; then
            sed -i 's/USE_UNIFIED_API=.*/USE_UNIFIED_API=false/' .env
        fi
        
        # Rebuild and restart
        docker-compose down
        docker-compose build budget-api
        docker-compose up -d
        
        echo -e "${GREEN}✓ Complete rollback completed${NC}"
        return 0
    fi
    
    echo -e "${RED}✗ No backup found for complete rollback${NC}"
    return 1
}

# Function to test rollback success
test_rollback() {
    echo -e "${YELLOW}Testing rollback success...${NC}"
    
    # Wait for services
    sleep 15
    
    # Test Python API
    if curl -f -s http://localhost:8888/health > /dev/null; then
        echo -e "${GREEN}✓ Python API responding${NC}"
    else
        echo -e "${RED}✗ Python API not responding${NC}"
        return 1
    fi
    
    # Test frontend API
    if curl -f -s http://localhost:4000/health > /dev/null; then
        echo -e "${GREEN}✓ Frontend API responding${NC}"
    else
        echo -e "${RED}✗ Frontend API not responding${NC}"
        return 1
    fi
    
    echo -e "${GREEN}✓ Rollback validation successful${NC}"
}

# Function to show rollback status
show_status() {
    echo -e "${BLUE}Current System Status:${NC}"
    echo ""
    
    # Check running containers
    echo "Running containers:"
    docker-compose ps
    
    echo ""
    echo "Service endpoints:"
    echo "• Python API: http://localhost:8888/health"
    echo "• Frontend API: http://localhost:4000/health"
    echo "• Frontend: http://localhost:3000"
    
    echo ""
    echo "Environment:"
    if [ -f ".env" ]; then
        grep -E "(USE_UNIFIED_API|SECURE_API)" .env || echo "No API flags found in .env"
    else
        echo ".env file not found"
    fi
}

# Main execution
main() {
    echo "This script will restore Python Backend API"
    echo ""
    echo "Available rollback options:"
    echo "1. Quick rollback (5 minutes) - Restore from backup config"
    echo "2. Complete rollback (30 minutes) - Restore full Python API"
    echo "3. Status check only"
    echo ""
    
    read -p "Choose option (1/2/3): " choice
    
    case $choice in
        1)
            if confirm "Perform quick rollback?"; then
                quick_rollback
                if [ $? -eq 0 ]; then
                    test_rollback
                    show_status
                fi
            fi
            ;;
        2)
            if confirm "Perform complete rollback? (This will rebuild services)"; then
                complete_rollback
                if [ $? -eq 0 ]; then
                    test_rollback
                    show_status
                fi
            fi
            ;;
        3)
            show_status
            ;;
        *)
            echo "Invalid option"
            exit 1
            ;;
    esac
    
    echo ""
    echo -e "${BLUE}Rollback Instructions for Manual Recovery:${NC}"
    echo ""
    echo "If automated rollback fails, manually:"
    echo "1. Stop services: docker-compose down"
    echo "2. Restore config: cp docker-compose-with-python-backup.yaml docker-compose.yaml"
    echo "3. Set environment: echo 'USE_UNIFIED_API=false' >> .env"
    echo "4. Start services: docker-compose up -d"
    echo ""
    echo "For issues, check:"
    echo "• Docker logs: docker-compose logs budget-api"
    echo "• Service health: curl http://localhost:8888/health"
    echo "• Container status: docker-compose ps"
}

# Check if we're in the right directory
if [ ! -f "docker-compose.yaml" ]; then
    echo -e "${RED}Error: docker-compose.yaml not found. Run this script from the project root.${NC}"
    exit 1
fi

# Run main function
main "$@"