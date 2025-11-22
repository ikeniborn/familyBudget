#!/bin/bash
#
# Family Budget - Docker & Cleanup Module
#
# This module provides Docker cleanup and smart restart functions
#
# Functions:
#   - detect_changed_files_rsync()         - Detect changed files using rsync
#   - categorize_file_changes()            - Categorize file changes
#   - cleanup_containers_networks_v2()     - Smart cleanup v2 (auto-detect restart strategy)
#   - cleanup_containers_networks_legacy() - Legacy cleanup
#   - cleanup_full()                       - Full cleanup (DELETES DATA)
#   - cleanup_old_deployment()             - Check and cleanup old deployments
#   - is_our_docker_container()            - Check if container belongs to our compose
#
# Dependencies:
#   - config.sh (DEPLOY_DIR, LOG_FILE, POSTGRES_WAS_STOPPED)
#   - utils.sh (info, success, warning, error, step, is_postgres_running, is_postgres_healthy)
#   - postgres.sh (initialize_postgres_directory, check_and_repair_postgres_data)
#
# Version: 1.0.0
# Phase: 3.1
#

# Detect changed files using rsync (reliable, works without git)
detect_changed_files_rsync() {
    local repo_dir="${1:-$SCRIPT_DIR}"
    local deploy_dir="${2:-$DEPLOY_DIR}"
    local changed_files=()

    # Use rsync --dry-run with checksum to find changed files
    # Format: file_type file_name (e.g., "f backend/app/main.py")
    # file_type: f=file, d=directory, L=symlink
    # We filter for files only (starts with non-d)

    local rsync_output=$(rsync -avnc \
        --exclude='.git' \
        --exclude='__pycache__' \
        --exclude='*.pyc' \
        --exclude='.pytest_cache' \
        --exclude='node_modules' \
        --exclude='.env.local' \
        --exclude='logs/' \
        --exclude='data/' \
        --exclude='.venv' \
        --exclude='venv' \
        "$repo_dir/" "$deploy_dir/" 2>/dev/null | grep -E "^[^d]" | awk '{print $2}' || echo "")

    # Convert to array
    while IFS= read -r line; do
        [[ -n "$line" ]] && changed_files+=("$line")
    done <<< "$rsync_output"

    # Return array as newline-separated string
    printf '%s\n' "${changed_files[@]}"
}

# Categorize file changes into action categories
categorize_file_changes() {
    local -n files_ref=$1  # Reference to array of changed files

    # Initialize category flags
    local needs_postgres_restart=false
    local needs_backend_restart=false
    local needs_bot_restart=false
    local needs_nginx_restart=false
    local needs_backend_rebuild=false
    local needs_bot_rebuild=false
    local needs_api_change=false
    local postgres_restart_reason=""

    # Category counters for reporting
    local count_postgres_critical=0
    local count_backend_code=0
    local count_bot_code=0
    local count_nginx_config=0
    local count_backend_deps=0
    local count_bot_deps=0
    local count_webapp=0

    # Categorize each file
    for file in "${files_ref[@]}"; do
        case "$file" in
            # PostgreSQL-critical changes (требуют полного перезапуска)
            backend/db/schema/*)
                needs_postgres_restart=true
                postgres_restart_reason="DB schema changed: $file"
                ((count_postgres_critical++))
                ;;
            backend/db/*)
                # DB models, alembic config - требуют полного перезапуска
                needs_postgres_restart=true
                postgres_restart_reason="DB schema/config changed: $file"
                ((count_postgres_critical++))
                ;;
            docker-compose.yml)
                needs_postgres_restart=true
                postgres_restart_reason="docker-compose.yml changed"
                ((count_postgres_critical++))
                ;;
            .env)
                # Check if PostgreSQL config changed (if file exists)
                if [[ -f "$SCRIPT_DIR/.env" ]] && grep -q "POSTGRES_" "$SCRIPT_DIR/.env" 2>/dev/null; then
                    needs_postgres_restart=true
                    postgres_restart_reason="PostgreSQL configuration changed in .env"
                    ((count_postgres_critical++))
                fi
                ;;

            # Backend dependencies (требуют пересборки образа)
            backend/requirements.txt)
                needs_backend_rebuild=true
                needs_backend_restart=true
                ((count_backend_deps++))
                ;;
            backend/Dockerfile)
                needs_backend_rebuild=true
                needs_backend_restart=true
                ((count_backend_deps++))
                ;;

            # Backend API endpoints (требуют перезапуска backend + могут влиять на bot)
            backend/app/api/*)
                needs_backend_restart=true
                needs_api_change=true
                ((count_backend_code++))
                ;;

            # Backend internal code (требуют только перезапуска backend)
            backend/app/schemas/*|backend/app/models/*|backend/app/services/*|backend/app/middleware/*|backend/app/core/*)
                needs_backend_restart=true
                ((count_backend_code++))
                ;;

            # Backend other code (fallback для backend/app/*)
            backend/app/*|backend/core/*|backend/services/*)
                needs_backend_restart=true
                ((count_backend_code++))
                ;;

            frontend/web/templates/*)
                # HTMX templates - backend serves them
                needs_backend_restart=true
                ((count_backend_code++))
                ;;
            frontend/web/static/*)
                # Static files - only nginx serves
                needs_nginx_restart=true
                ((count_nginx_config++))
                ;;
            frontend/webapp/*)
                # Telegram Web Apps - volume-mounted static files
                # Changes applied immediately via volume mount - no rebuild/restart needed
                # (docker-compose.yml: ./frontend/webapp:/app/webapp:ro)
                ((count_webapp++))
                ;;
            frontend/shared/*)
                # Shared frontend static files
                needs_nginx_restart=true
                ((count_nginx_config++))
                ;;

            # Bot dependencies (требуют пересборки образа)
            bot/requirements.txt)
                needs_bot_rebuild=true
                needs_bot_restart=true
                ((count_bot_deps++))
                ;;
            bot/Dockerfile)
                needs_bot_rebuild=true
                needs_bot_restart=true
                ((count_bot_deps++))
                ;;

            # Bot code (требуют только перезапуска, КРОМЕ webapp)
            bot/handlers/*|bot/utils/*|bot/jobs/*|bot/*.py)
                needs_bot_restart=true
                ((count_bot_code++))
                ;;

            # Nginx config (требуют только перезапуска)
            nginx/*.conf|nginx/conf.d/*.conf|nginx/conf.d/**/*.conf)
                needs_nginx_restart=true
                ((count_nginx_config++))
                ;;
        esac
    done

    # Return results as exported variables
    echo "needs_postgres_restart=$needs_postgres_restart"
    echo "needs_backend_restart=$needs_backend_restart"
    echo "needs_bot_restart=$needs_bot_restart"
    echo "needs_nginx_restart=$needs_nginx_restart"
    echo "needs_backend_rebuild=$needs_backend_rebuild"
    echo "needs_bot_rebuild=$needs_bot_rebuild"
    echo "needs_api_change=$needs_api_change"
    echo "postgres_restart_reason=$postgres_restart_reason"
    echo "count_postgres_critical=$count_postgres_critical"
    echo "count_backend_code=$count_backend_code"
    echo "count_bot_code=$count_bot_code"
    echo "count_nginx_config=$count_nginx_config"
    echo "count_backend_deps=$count_backend_deps"
    echo "count_bot_deps=$count_bot_deps"
    echo "count_webapp=$count_webapp"
}

# Enhanced Smart cleanup v2 - intelligent selective restarts based on actual changes
cleanup_containers_networks_v2() {
    info "Enhanced Smart cleanup - analyzing changes..."
    echo ""

    # === PHASE 0: CHECK FOR CLEAN SYNC MODE ===
    # Clean sync mode = все файлы были удалены и скопированы заново
    # Требуется полная пересборка образов и рестарт всех сервисов
    if [[ "${SYNC_MODE:-}" == "clean" ]]; then
        warning "Clean sync mode detected - all code was replaced"
        info "Full rebuild and restart required (Docker images contain old code)"
        echo ""

        # Принудительная полная пересборка
        local -a services_to_stop=("familybudget-postgres" "familybudget-backend" "familybudget-bot" "familybudget-nginx")
        local -a images_to_rebuild=("backend" "bot")

        # Остановить все сервисы
        info "Stopping ALL services for clean deployment..."
        if compose_cmd ps -q 2>/dev/null | grep -q .; then
            compose_cmd stop --timeout 90 >> "$LOG_FILE" 2>&1 || true
            success "All services stopped"
        fi

        # Удалить старые образы (содержат старый код)
        info "Removing old Docker images (contain old code)..."
        for service in "${images_to_rebuild[@]}"; do
            local image_name="familybudget-${service}"
            if docker images -q "$image_name" 2>/dev/null | grep -q .; then
                docker rmi "$image_name" >> "$LOG_FILE" 2>&1 || true
                info "Removed old image: $image_name"
            fi
        done

        # Cleanup containers and networks
        local containers=$(docker ps -a --filter "name=familybudget" --format "{{.Names}}" 2>/dev/null || echo "")
        if [[ -n "$containers" ]]; then
            info "Removing old containers"
            echo "$containers" | xargs docker rm >> "$LOG_FILE" 2>&1 || true
        fi

        local networks=$(docker network ls --filter "name=familybudget" --format "{{.Name}}" 2>/dev/null || echo "")
        if [[ -n "$networks" ]]; then
            for network in $networks; do
                if ! docker network inspect "$network" -f '{{range .Containers}}{{.Name}}{{end}}' 2>/dev/null | grep -q .; then
                    docker network rm "$network" >> "$LOG_FILE" 2>&1 || true
                fi
            done
        fi

        echo ""
        success "Clean sync deployment prepared"
        echo "  ✓ All services stopped"
        echo "  ✓ Old images removed: ${images_to_rebuild[*]}"
        echo "  ✓ Containers and networks cleaned"
        echo ""
        info "Images will be rebuilt with new code during 'docker compose up --build'"

        POSTGRES_WAS_STOPPED=true
        return 0
    fi

    # === PHASE 1: DETECT CHANGED FILES ===
    local changed_files_raw=$(detect_changed_files_rsync "$SCRIPT_DIR" "$DEPLOY_DIR")
    local -a changed_files=()

    # Convert to array
    while IFS= read -r line; do
        [[ -n "$line" ]] && changed_files+=("$line")
    done <<< "$changed_files_raw"

    local total_changed=${#changed_files[@]}

    if [[ $total_changed -eq 0 ]]; then
        success "No file changes detected - code is already in sync"
        info "Will perform minimal cleanup (stopped containers/networks only)"
        echo ""

        # Just cleanup stopped containers and networks
        local containers=$(docker ps -a --filter "name=familybudget" --filter "status=exited" --format "{{.Names}}" 2>/dev/null || echo "")
        if [[ -n "$containers" ]]; then
            info "Removing stopped containers: $containers"
            echo "$containers" | xargs docker rm >> "$LOG_FILE" 2>&1 || true
        fi

        local networks=$(docker network ls --filter "name=familybudget" --format "{{.Name}}" 2>/dev/null || echo "")
        if [[ -n "$networks" ]]; then
            # Check if network is in use
            for network in $networks; do
                if ! docker network inspect "$network" -f '{{range .Containers}}{{.Name}}{{end}}' 2>/dev/null | grep -q .; then
                    info "Removing unused network: $network"
                    docker network rm "$network" >> "$LOG_FILE" 2>&1 || true
                fi
            done
        fi

        POSTGRES_WAS_STOPPED=false
        return 0
    fi

    info "Detected $total_changed changed files"

    # Show first 10 changed files for transparency
    if [[ $total_changed -le 10 ]]; then
        for file in "${changed_files[@]}"; do
            echo "    • $file"
        done
    else
        for i in {0..9}; do
            echo "    • ${changed_files[$i]}"
        done
        echo "    ... and $((total_changed - 10)) more files"
    fi
    echo ""

    # === PHASE 2: CATEGORIZE CHANGES ===
    local categorization=$(categorize_file_changes changed_files)

    # Parse categorization results
    local needs_postgres_restart=false
    local needs_backend_restart=false
    local needs_bot_restart=false
    local needs_nginx_restart=false
    local needs_backend_rebuild=false
    local needs_bot_rebuild=false
    local needs_api_change=false
    local postgres_restart_reason=""
    local count_postgres_critical=0
    local count_backend_code=0
    local count_bot_code=0
    local count_nginx_config=0
    local count_backend_deps=0
    local count_bot_deps=0
    local count_webapp=0

    eval "$categorization"

    # === PHASE 3: DISPLAY ANALYSIS ===
    info "Change analysis:"

    local categories_found=()
    [[ $count_postgres_critical -gt 0 ]] && categories_found+=("postgres-critical ($count_postgres_critical files)")
    [[ $count_backend_deps -gt 0 ]] && categories_found+=("backend-deps ($count_backend_deps files)")
    [[ $count_backend_code -gt 0 ]] && categories_found+=("backend-code ($count_backend_code files)")
    [[ $count_bot_deps -gt 0 ]] && categories_found+=("bot-deps ($count_bot_deps files)")
    [[ $count_bot_code -gt 0 ]] && categories_found+=("bot-code ($count_bot_code files)")
    [[ $count_nginx_config -gt 0 ]] && categories_found+=("nginx-config ($count_nginx_config files)")
    [[ $count_webapp -gt 0 ]] && categories_found+=("webapp ($count_webapp files)")

    if [[ ${#categories_found[@]} -gt 0 ]]; then
        for category in "${categories_found[@]}"; do
            echo "    ✓ $category"
        done
    else
        echo "    • No categorized changes (other files)"
    fi
    echo ""

    # === PHASE 4: DETERMINE RESTART STRATEGY ===
    local -a services_to_stop=()
    local -a images_to_rebuild=()

    if [[ "$needs_postgres_restart" == "true" ]]; then
        warning "Full restart required: $postgres_restart_reason"
        info "Stopping ALL services including PostgreSQL..."
        echo ""

        services_to_stop=("familybudget-postgres" "familybudget-backend" "familybudget-bot" "familybudget-nginx")
        POSTGRES_WAS_STOPPED=true

    else
        success "Selective restart - PostgreSQL will keep running"
        echo ""

        # Determine minimal set of services to restart
        if [[ "$needs_backend_restart" == "true" ]]; then
            services_to_stop+=("familybudget-backend")
            info "Backend code changed → will restart backend"

            # Bot рестартится только при API changes или bot code changes
            if [[ "$needs_api_change" == "true" ]] || [[ "$needs_bot_restart" == "true" ]]; then
                services_to_stop+=("familybudget-bot")
                if [[ "$needs_api_change" == "true" ]]; then
                    info "API endpoints changed → will restart bot (API contract may have changed)"
                fi
                if [[ "$needs_bot_restart" == "true" ]]; then
                    info "Bot code changed → will restart bot"
                fi
            fi

            # Nginx рестартится только при nginx config/static files changes
            if [[ "$needs_nginx_restart" == "true" ]]; then
                services_to_stop+=("familybudget-nginx")
                info "Nginx config/static files changed → will restart nginx"
            fi
        else
            # Backend NOT changed - selective restarts
            [[ "$needs_bot_restart" == "true" ]] && services_to_stop+=("familybudget-bot") && info "Bot code changed → will restart bot"
            [[ "$needs_nginx_restart" == "true" ]] && services_to_stop+=("familybudget-nginx") && info "Nginx config changed → will restart nginx"
        fi

        POSTGRES_WAS_STOPPED=false
    fi

    # Determine images to rebuild
    [[ "$needs_backend_rebuild" == "true" ]] && images_to_rebuild+=("backend") && info "Backend dependencies changed → will rebuild backend image"
    [[ "$needs_bot_rebuild" == "true" ]] && images_to_rebuild+=("bot") && info "Bot dependencies changed → will rebuild bot image"

    echo ""

    # Display strategy summary
    info "Strategy summary:"
    echo "    • PostgreSQL: $([ "$POSTGRES_WAS_STOPPED" == "true" ] && echo "will restart" || echo "keep running ✓")"
    echo "    • Services to restart: ${#services_to_stop[@]}"
    [[ ${#services_to_stop[@]} -gt 0 ]] && echo "      → ${services_to_stop[*]}"
    echo "    • Images to rebuild: ${#images_to_rebuild[@]}"
    [[ ${#images_to_rebuild[@]} -gt 0 ]] && echo "      → ${images_to_rebuild[*]}"

    # Estimate downtime
    local estimated_downtime=0
    [[ "$POSTGRES_WAS_STOPPED" == "true" ]] && estimated_downtime=30
    [[ "$POSTGRES_WAS_STOPPED" == "false" && ${#services_to_stop[@]} -gt 0 ]] && estimated_downtime=10
    [[ ${#images_to_rebuild[@]} -gt 0 ]] && estimated_downtime=$((estimated_downtime + ${#images_to_rebuild[@]} * 15))

    [[ $estimated_downtime -gt 0 ]] && echo "    • Estimated downtime: ~${estimated_downtime}s"
    echo ""

    # Add note about Docker rebuild behavior for volume-mounted files
    if [[ ${#images_to_rebuild[@]} -eq 0 ]] && [[ $count_webapp -gt 0 || $count_backend_code -gt 0 ]]; then
        echo "    NOTE: Docker may still rebuild images if build context changed"
        echo "          (Dockerfile COPY includes volume-mounted directories)"
        echo "          This is normal - volume mounts will override built-in files"
        echo ""
    fi

    # === PHASE 5: STOP SERVICES ===
    if [[ ${#services_to_stop[@]} -gt 0 ]]; then
        if [[ "$POSTGRES_WAS_STOPPED" == "true" ]]; then
            # Full restart - use compose stop
            if compose_cmd ps -q 2>/dev/null | grep -q .; then
                info "Gracefully stopping all services with extended timeout..."
                compose_cmd stop --timeout 90 >> "$LOG_FILE" 2>&1 || true
                success "All services stopped"
            fi
        else
            # Selective restart - stop individual containers
            info "Stopping selected services: ${services_to_stop[*]}"
            for service in "${services_to_stop[@]}"; do
                if docker ps --format "{{.Names}}" 2>/dev/null | grep -q "^${service}$"; then
                    docker stop "$service" >> "$LOG_FILE" 2>&1 || true
                fi
            done
            success "Selected services stopped"
        fi
    else
        info "No services need restart - code changes are volume-mounted"
    fi

    # === PHASE 6: REBUILD IMAGES (if needed) ===
    if [[ ${#images_to_rebuild[@]} -gt 0 ]]; then
        echo ""
        info "Rebuilding images: ${images_to_rebuild[*]}"
        for service in "${images_to_rebuild[@]}"; do
            info "Building $service..."
            compose_cmd build "$service" >> "$LOG_FILE" 2>&1 || {
                error "Failed to build $service image"
                return 1
            }
            success "$service image rebuilt"
        done
    fi

    # === PHASE 7: CLEANUP STOPPED CONTAINERS AND NETWORKS ===
    echo ""

    # Remove stopped containers
    local containers=$(docker ps -a --filter "name=familybudget" --filter "status=exited" --format "{{.Names}}" 2>/dev/null || echo "")
    if [[ -n "$containers" ]]; then
        info "Removing stopped containers"
        echo "$containers" | xargs docker rm >> "$LOG_FILE" 2>&1 || true
        success "Stopped containers removed"
    fi

    # Remove unused networks
    local networks=$(docker network ls --filter "name=familybudget" --format "{{.Name}}" 2>/dev/null || echo "")
    if [[ -n "$networks" ]]; then
        for network in $networks; do
            # Only remove if not in use
            if ! docker network inspect "$network" -f '{{range .Containers}}{{.Name}}{{end}}' 2>/dev/null | grep -q .; then
                info "Removing unused network: $network"
                docker network rm "$network" >> "$LOG_FILE" 2>&1 || true
            fi
        done
    fi

    echo ""
    success "Enhanced Smart cleanup v2 completed"
    echo "  ✓ Changed files analyzed: $total_changed"
    echo "  ✓ PostgreSQL: $([ "$POSTGRES_WAS_STOPPED" == "true" ] && echo "restarted" || echo "kept running")"
    echo "  ✓ Services restarted: ${#services_to_stop[@]}"
    echo "  ✓ Images rebuilt: ${#images_to_rebuild[@]}"
}

# Smart cleanup - automatically decides if PostgreSQL needs restart
# LEGACY VERSION - kept for rollback if needed
cleanup_containers_networks_legacy() {
    info "Safe cleanup - analyzing changes to determine restart strategy..."
    echo ""

    # Check if PostgreSQL-related changes require full restart
    local needs_postgres_restart=false
    local reason=""

    # Check for DB schema changes
    if git diff --name-only HEAD~1 2>/dev/null | grep -q "backend/db/schema/"; then
        needs_postgres_restart=true
        reason="DB schema changed"
    fi

    # Check for docker-compose.yml changes
    if git diff --name-only HEAD~1 2>/dev/null | grep -q "docker-compose.yml"; then
        needs_postgres_restart=true
        reason="docker-compose.yml changed"
    fi

    # Check for PostgreSQL configuration changes
    if git diff --name-only HEAD~1 2>/dev/null | grep -q "\.env"; then
        if git diff HEAD~1 .env 2>/dev/null | grep -q "POSTGRES_"; then
            needs_postgres_restart=true
            reason="PostgreSQL configuration changed"
        fi
    fi

    # Decide strategy based on analysis
    if [[ "$needs_postgres_restart" == "true" ]]; then
        warning "Full restart required: $reason"
        info "Stopping ALL services including PostgreSQL..."
        echo ""

        # Stop all services including PostgreSQL
        if compose_cmd ps -q 2>/dev/null | grep -q .; then
            info "Gracefully stopping services with extended timeout..."
            compose_cmd stop --timeout 90 >> "$LOG_FILE" 2>&1 || true
            success "All services stopped gracefully"
        fi

        # Mark PostgreSQL as stopped
        POSTGRES_WAS_STOPPED=true
    else
        success "Smart restart: Only frontend/backend/bot changes detected"
        info "Keeping PostgreSQL running to prevent data directory corruption"
        echo ""

        # Stop only app containers (NOT postgres)
        local app_containers=("familybudget-backend" "familybudget-bot" "familybudget-nginx")
        for container in "${app_containers[@]}"; do
            if docker ps -a --format "{{.Names}}" 2>/dev/null | grep -q "^${container}$"; then
                info "Stopping $container..."
                docker stop "$container" >> "$LOG_FILE" 2>&1 || true
            fi
        done

        # Check if PostgreSQL is still running
        if is_postgres_running; then
            success "PostgreSQL kept running (no restart needed)"
            POSTGRES_WAS_STOPPED=false
        else
            warning "PostgreSQL not found - will be started fresh"
            POSTGRES_WAS_STOPPED=true
        fi
    fi

    # Remove stopped containers
    local containers=$(docker ps -a --filter "name=familybudget" --format "{{.Names}}" 2>/dev/null || echo "")
    if [[ -n "$containers" ]]; then
        echo ""
        info "Removing stopped containers: $containers"
        echo "$containers" | xargs docker rm >> "$LOG_FILE" 2>&1 || true
        success "Containers removed"
    fi

    # Remove all familybudget networks
    local networks=$(docker network ls --filter "name=familybudget" --format "{{.Name}}" 2>/dev/null || echo "")
    if [[ -n "$networks" ]]; then
        info "Removing networks: $networks"
        echo "$networks" | xargs docker network rm >> "$LOG_FILE" 2>&1 || true
        success "Networks removed"
    fi

    echo ""
    success "Safe cleanup completed (smart restart strategy applied)"
}

# =============================================================================
# POSTGRES FUNCTIONS (Loaded from scripts/lib/postgres.sh)
# =============================================================================
# Functions: initialize_postgres_directory, check_and_repair_postgres_data

# Full cleanup - stop all services + optional data deletion
cleanup_full() {
    warning "⚠️  FULL CLEANUP MODE"
    echo ""
    echo "This will:"
    echo "  1. Stop all containers (PostgreSQL, backend, bot, nginx)"
    echo "  2. Remove Docker networks"
    echo "  3. Run PostgreSQL data repair (if corrupted)"
    echo ""
    warning "⚠️  DATA DELETION (OPTIONAL):"
    echo "  - If you type 'DELETE': ALL DATA INCLUDING DATABASE WILL BE DELETED!"
    echo "  - If you press Enter or type anything else: DATA IS PRESERVED (containers stopped only)"
    echo ""

    # Check for root privileges (required for PostgreSQL data deletion)
    if ! check_root_privileges; then
        error "Full cleanup requires root privileges!"
        echo ""
        echo "Please run deploy.sh with sudo:"
        echo "  sudo $SCRIPT_DIR/deploy.sh [OPTIONS]"
        echo ""
        exit 1
    fi

    read -p "Type 'DELETE' to delete all data, or press Enter to preserve data: " confirm
    echo ""

    if [[ "$confirm" != "DELETE" ]]; then
        info "Full cleanup cancelled - data preserved"
        info "Containers stopped, PostgreSQL repair will run automatically"
        return 0
    fi

    info "Performing full cleanup..."

    # Stop and remove containers
    local containers=$(docker ps -a --filter "name=familybudget" --format "{{.Names}}" 2>/dev/null || echo "")
    if [[ -n "$containers" ]]; then
        info "Stopping containers..."
        echo "$containers" | xargs docker stop >> "$LOG_FILE" 2>&1 || true
        info "Removing containers..."
        echo "$containers" | xargs docker rm >> "$LOG_FILE" 2>&1 || true
    fi

    # Remove networks
    local networks=$(docker network ls --filter "name=familybudget" --format "{{.Name}}" 2>/dev/null || echo "")
    if [[ -n "$networks" ]]; then
        info "Removing networks..."
        echo "$networks" | xargs docker network rm >> "$LOG_FILE" 2>&1 || true
    fi

    # Remove volumes
    local volumes=$(docker volume ls --filter "name=familybudget" --format "{{.Name}}" 2>/dev/null || echo "")
    if [[ -n "$volumes" ]]; then
        warning "Removing volumes (DATA DELETION)..."
        echo "$volumes" | xargs docker volume rm >> "$LOG_FILE" 2>&1 || true
    fi

    # Remove data directories
    if [[ -d "$DEPLOY_DIR/data/postgres" ]]; then
        warning "Removing PostgreSQL data directory..."
        if ! sudo rm -rf "$DEPLOY_DIR/data/postgres"/* >> "$LOG_FILE" 2>&1; then
            error "Failed to remove PostgreSQL data directory. Check sudo privileges."
        fi
    fi

    # Mark PostgreSQL as stopped
    POSTGRES_WAS_STOPPED=true

    success "Full cleanup completed (ALL DATA DELETED)"
}


# Check for old deployments and offer cleanup options
cleanup_old_deployment() {
    step "Checking for Old Deployments"

    # Special handling for clean sync mode
    if [[ "${SYNC_MODE:-}" == "clean" ]]; then
        info "Cleanup step skipped (clean sync mode already removed all containers)"
        info "PostgreSQL will be initialized fresh, migrations will run automatically"
        echo ""
        # Ensure flag is set (should already be set by clean_sync, but double-check)
        POSTGRES_WAS_STOPPED=true
        return 0
    fi

    # Count old artifacts
    local old_containers=$(docker ps -a --filter "name=familybudget" --format "{{.Names}}" 2>/dev/null | wc -l)
    local old_networks=$(docker network ls --filter "name=familybudget" --format "{{.Name}}" 2>/dev/null | wc -l)
    local old_volumes=$(docker volume ls --filter "name=familybudget" --format "{{.Name}}" 2>/dev/null | wc -l)

    # If nothing found, skip
    if [[ $old_containers -eq 0 && $old_networks -eq 0 && $old_volumes -eq 0 ]]; then
        info "No old deployments found"
        return 0
    fi

    # Display findings
    warning "Found old deployment artifacts:"
    if [[ $old_containers -gt 0 ]]; then
        echo "  - Containers: $old_containers"
        docker ps -a --filter "name=familybudget" --format "    {{.Names}} ({{.Status}})" 2>/dev/null
    fi
    if [[ $old_networks -gt 0 ]]; then
        echo "  - Networks: $old_networks"
        docker network ls --filter "name=familybudget" --format "    {{.Name}}" 2>/dev/null
    fi
    if [[ $old_volumes -gt 0 ]]; then
        echo "  - Volumes: $old_volumes"
        docker volume ls --filter "name=familybudget" --format "    {{.Name}}" 2>/dev/null
    fi
    echo ""

    # Auto-select cleanup mode if --clean flag set
    if [[ "${CLEAN_DEPLOY:-false}" == "true" ]]; then
        info "Auto-selecting Full Cleanup (--clean flag specified)"
        cleanup_full
        return 0
    fi

    # Check if cleanup mode preset via environment
    local cleanup_mode="${CLEANUP_MODE:-}"

    # If no preset and we have interactive terminal, ask user
    if [[ -z "$cleanup_mode" ]] && [[ -t 0 ]]; then
        # Offer cleanup options
        echo ""
        warning "Old deployments may cause network conflicts!"
        echo ""
        echo "Choose cleanup action:"
        echo "  [1] Skip - deploy alongside old deployment (may cause subnet conflicts)"
        echo "  [2] Smart cleanup - auto-detect changes & restart strategy (RECOMMENDED)"
        echo "      ✓ Analyzes git diff to determine if PostgreSQL needs restart"
        echo "      ✓ Keeps PostgreSQL running for frontend/backend changes only"
        echo "      ✓ Full restart for DB migrations or config changes"
        echo "  [3] Full cleanup - containers + networks + volumes (DELETES ALL DATA!)"
        echo "      ⚠️  Requires sudo/root privileges"
        echo ""

        # Flush stdout/stderr before reading input (prevents terminal buffer issues)
        sync 2>/dev/null || true
        read -r -p "Select [1-3]: " choice < /dev/tty
        echo ""

        case $choice in
            1)
                cleanup_mode="skip"
                ;;
            2)
                cleanup_mode="smart"
                ;;
            3)
                cleanup_mode="full"
                ;;
            *)
                error "Invalid choice. Please select 1-3."
                exit 1
                ;;
        esac
    elif [[ -z "$cleanup_mode" ]]; then
        # Non-interactive mode (no TTY) - use smart cleanup as default
        cleanup_mode="smart"
        info "Non-interactive mode detected: using default cleanup mode 'smart'"
    fi

    # Execute cleanup based on selected mode
    case $cleanup_mode in
        skip)
            info "Skipping cleanup (network conflicts may occur)"
            return 0
            ;;
        smart)
            cleanup_containers_networks_v2
            ;;
        full)
            cleanup_full
            ;;
        *)
            error "Invalid cleanup mode: $cleanup_mode"
            exit 1
            ;;
    esac
}

# Find free subnets in range 172.20-172.30

# Check if port is used by our docker-compose services
is_our_docker_container() {
    local port=$1

    # Check if docker and docker compose are available
    if ! command_exists docker; then
        return 1
    fi

    # Get list of running containers from our docker-compose
    local running_containers=$(docker compose -f "$DEPLOY_DIR/docker-compose.yml" ps --services --filter "status=running" 2>/dev/null || echo "")

    if [[ -z "$running_containers" ]]; then
        return 1  # No containers running
    fi

    # Check each running container to see if it publishes this port
    while IFS= read -r container_name; do
        if [[ -n "$container_name" ]]; then
            # Check if this container publishes the port
            local port_info=$(docker compose -f "$DEPLOY_DIR/docker-compose.yml" port "$container_name" "$port" 2>/dev/null || echo "")
            if [[ -n "$port_info" ]]; then
                return 0  # This is our container
            fi
        fi
    done <<< "$running_containers"

    return 1  # Not our container
}