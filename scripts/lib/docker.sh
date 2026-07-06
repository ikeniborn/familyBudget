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
#   - cleanup_docker_images()              - Cleanup dangling images and build cache
#   - cleanup_old_image_versions()         - Remove old image versions (keep last N)
#   - check_and_restart_dockerd()          - Check dockerd CPU and restart if high
#   - is_our_docker_container()            - Check if container belongs to our compose
#
# Dependencies:
#   - config.sh (DEPLOY_DIR, LOG_FILE, POSTGRES_WAS_STOPPED)
#   - utils.sh (info, success, warning, error, step, is_postgres_running, is_postgres_healthy)
#   - postgres.sh (verify_postgres_health_post_start, create_deployment_safety_backup, check_postgres_health_pre_deploy)
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
    local needs_traefik_restart=false
    local needs_backend_rebuild=false
    local needs_bot_rebuild=false
    local needs_api_change=false
    local postgres_restart_reason=""

    # Category counters for reporting
    local count_postgres_critical=0
    local count_backend_code=0
    local count_bot_code=0
    local count_traefik_config=0
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
                # Static files are served by the backend behind Traefik
                needs_backend_restart=true
                ((count_backend_code++))
                ;;
            frontend/webapp/*)
                # Telegram Web Apps - volume-mounted static files
                # Changes applied immediately via volume mount - no rebuild/restart needed
                # (docker-compose.yml: ./frontend/webapp:/app/webapp:ro)
                ((count_webapp++))
                ;;
            frontend/shared/*)
                # Shared frontend static files are served by the backend behind Traefik
                needs_backend_restart=true
                ((count_backend_code++))
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

            # Traefik config (требуют только перезапуска)
            traefik/traefik.yml|traefik/conf.d/*.tmpl|traefik/docker-entrypoint.sh)
                needs_traefik_restart=true
                ((count_traefik_config++))
                ;;
        esac
    done

    # Return results as exported variables
    echo "needs_postgres_restart=$needs_postgres_restart"
    echo "needs_backend_restart=$needs_backend_restart"
    echo "needs_bot_restart=$needs_bot_restart"
    echo "needs_traefik_restart=$needs_traefik_restart"
    echo "needs_backend_rebuild=$needs_backend_rebuild"
    echo "needs_bot_rebuild=$needs_bot_rebuild"
    echo "needs_api_change=$needs_api_change"
    echo "postgres_restart_reason=$postgres_restart_reason"
    echo "count_postgres_critical=$count_postgres_critical"
    echo "count_backend_code=$count_backend_code"
    echo "count_bot_code=$count_bot_code"
    echo "count_traefik_config=$count_traefik_config"
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
        local -a services_to_stop=("familybudget-postgres" "familybudget-backend" "familybudget-bot" "familybudget-traefik")
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
    local needs_traefik_restart=false
    local needs_backend_rebuild=false
    local needs_bot_rebuild=false
    local needs_api_change=false
    local postgres_restart_reason=""
    local count_postgres_critical=0
    local count_backend_code=0
    local count_bot_code=0
    local count_traefik_config=0
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
    [[ $count_traefik_config -gt 0 ]] && categories_found+=("traefik-config ($count_traefik_config files)")
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

        services_to_stop=("familybudget-postgres" "familybudget-backend" "familybudget-bot" "familybudget-traefik")
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

            # Traefik рестартится только при Traefik config changes
            if [[ "$needs_traefik_restart" == "true" ]]; then
                services_to_stop+=("familybudget-traefik")
                info "Traefik config changed → will restart Traefik"
            fi
        else
            # Backend NOT changed - selective restarts
            [[ "$needs_bot_restart" == "true" ]] && services_to_stop+=("familybudget-bot") && info "Bot code changed → will restart bot"
            [[ "$needs_traefik_restart" == "true" ]] && services_to_stop+=("familybudget-traefik") && info "Traefik config changed → will restart Traefik"
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
        local app_containers=("familybudget-backend" "familybudget-bot" "familybudget-traefik")
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
# Functions: verify_postgres_health_post_start, create_deployment_safety_backup, check_postgres_health_pre_deploy
# NOTE: Repair functions removed after migration to Docker managed volume

# Full cleanup - stop all services + optional data deletion
cleanup_full() {
    warning "⚠️  FULL CLEANUP MODE"
    echo ""
    echo "This will:"
    echo "  1. Stop all containers (PostgreSQL, backend, bot, Traefik)"
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

    # Check if cleanup mode preset via environment or health check
    local cleanup_mode="${CLEANUP_MODE:-}"

    # If preset (from --cleanup-mode flag or health check), show info message
    if [[ -n "$cleanup_mode" ]]; then
        info "Cleanup mode preset: $cleanup_mode"
        if [[ "$cleanup_mode" == "full" ]]; then
            info "  (auto-selected by PostgreSQL health check or --clean flag)"
        fi
        echo ""
    # If no preset and we have interactive terminal, ask user
    elif [[ -t 0 ]]; then
        # Show STEP 2 header (moved from collect_deployment_params)
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        print_message "$BLUE" "  STEP 2: Choose Cleanup Action"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo ""
        warning "Old deployments may cause network conflicts!"
        echo ""
        echo "  [1] Skip - deploy alongside old deployment (may cause subnet conflicts)"
        echo "  [2] Smart cleanup - auto-detect changes & restart strategy (RECOMMENDED)"
        echo "      ✓ Analyzes git diff to determine if PostgreSQL needs restart"
        echo "      ✓ Keeps PostgreSQL running for frontend/backend changes only"
        echo "      ✓ Full restart for DB migrations or config changes"
        echo "  [3] Full cleanup - stop all services + repair corrupted data"
        echo "      ✓ Stops all containers, removes networks"
        echo "      ✓ Repairs PostgreSQL data directory if corrupted"
        echo "      ✓ DATA IS PRESERVED (volumes NOT deleted unless you confirm 'DELETE')"
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

        success "Cleanup mode selected: $cleanup_mode"
        echo ""
    else
        # Non-interactive mode (no TTY) - use smart cleanup as default
        cleanup_mode="smart"
        info "Non-interactive mode detected: using default cleanup mode 'smart'"
        echo ""
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

# Cleanup dangling Docker images and build cache
cleanup_docker_images() {
    local force_mode="${1:-false}"  # true = auto-cleanup, false = interactive

    info "Checking for dangling Docker images and build cache..."

    # Get dangling images count
    local dangling_images_count=$(docker images -f "dangling=true" -q 2>/dev/null | wc -l || echo "0")
    local dangling_images_size="0"

    if [[ $dangling_images_count -gt 0 ]]; then
        dangling_images_size=$(docker images -f "dangling=true" --format "{{.Size}}" 2>/dev/null | sed 's/MB//' | awk '{sum+=$1} END {printf "%.1f", sum}' || echo "0")
    fi

    # Get build cache size
    local build_cache_size=$(docker system df -v 2>/dev/null | grep "Build Cache" | awk '{print $NF}' || echo "0B")

    # Display findings
    if [[ $dangling_images_count -gt 0 ]] || [[ "$build_cache_size" != "0B" ]]; then
        warning "Found Docker cleanup candidates:"
        echo "  • Dangling images: $dangling_images_count (~${dangling_images_size}MB)"
        echo "  • Build cache: $build_cache_size"
        echo ""

        # Ask for confirmation unless force mode
        local should_cleanup=false
        if [[ "$force_mode" == "true" ]]; then
            should_cleanup=true
            info "Auto-cleanup mode enabled - removing dangling resources..."
        else
            if [[ -t 0 ]]; then  # Interactive mode
                echo "These resources are safe to remove and will be recreated when needed."
                read -p "Remove dangling images and build cache? [y/N]: " -r
                if [[ $REPLY =~ ^[Yy]$ ]]; then
                    should_cleanup=true
                fi
            else
                # Non-interactive mode - auto cleanup
                should_cleanup=true
                info "Non-interactive mode - auto-removing dangling resources"
            fi
        fi

        if [[ "$should_cleanup" == "true" ]]; then
            local cleanup_success=true

            # Remove dangling images
            if [[ $dangling_images_count -gt 0 ]]; then
                info "Removing $dangling_images_count dangling images..."
                if docker image prune -f >> "$LOG_FILE" 2>&1; then
                    success "Removed $dangling_images_count dangling images (~${dangling_images_size}MB freed)"
                else
                    warning "Failed to remove some dangling images"
                    cleanup_success=false
                fi
            fi

            # Remove build cache
            if [[ "$build_cache_size" != "0B" ]]; then
                info "Removing build cache ($build_cache_size)..."
                if docker builder prune -f >> "$LOG_FILE" 2>&1; then
                    success "Removed build cache ($build_cache_size freed)"
                else
                    warning "Failed to remove build cache"
                    cleanup_success=false
                fi
            fi

            if [[ "$cleanup_success" == "true" ]]; then
                echo ""
                success "Docker cleanup completed successfully"

                # Show new disk usage
                local new_docker_usage=$(docker system df 2>/dev/null | tail -n +2 || echo "")
                if [[ -n "$new_docker_usage" ]]; then
                    echo ""
                    info "Docker disk usage after cleanup:"
                    echo "$new_docker_usage"
                fi
            fi
        else
            info "Skipping Docker cleanup"
        fi
    else
        success "No dangling Docker resources found - cleanup not needed"
    fi

    echo ""
}

# Cleanup old Docker image versions (keep only N recent versions)
# This prevents accumulation of 100+ images that causes high dockerd CPU
cleanup_old_image_versions() {
    local keep_versions="${1:-3}"  # Keep last 3 versions by default

    info "Checking for old Docker image versions..."

    local images_cleaned=0
    local space_freed=0

    # Process each service (backend, bot)
    for service in "backend" "bot"; do
        local image_name="familybudget-${service}"

        # Get all versions of this image, sorted by creation time (newest first)
        local all_versions=$(docker images --format "{{.Tag}}" "$image_name" 2>/dev/null | grep -v '<none>' | sort -V -r)

        if [[ -z "$all_versions" ]]; then
            continue
        fi

        local version_count=$(echo "$all_versions" | wc -l)

        if [[ $version_count -le $keep_versions ]]; then
            continue
        fi

        # Get versions to remove (skip first N)
        local versions_to_remove=$(echo "$all_versions" | tail -n +$((keep_versions + 1)))

        if [[ -n "$versions_to_remove" ]]; then
            local remove_count=$(echo "$versions_to_remove" | wc -l)
            info "Removing $remove_count old versions of $image_name (keeping last $keep_versions)"

            while IFS= read -r version; do
                if [[ -n "$version" ]]; then
                    # Check if this exact image is referenced by our compose service
                    # Note: We don't use "ancestor" filter as it matches hierarchically
                    # (all images sharing base layers would match, causing false positives)
                    local current_image=$(docker inspect "familybudget-${service}" --format '{{.Config.Image}}' 2>/dev/null || echo "")
                    if [[ "$current_image" == "${image_name}:${version}" ]]; then
                        warning "  Skipping ${image_name}:${version} (current compose image)"
                        continue
                    fi

                    # Get size before removal
                    local img_size=$(docker images --format "{{.Size}}" "${image_name}:${version}" 2>/dev/null | head -1)

                    # Use subshell to isolate errors and prevent script exit on failure
                    local rmi_output
                    if rmi_output=$(docker rmi "${image_name}:${version}" 2>&1); then
                        ((images_cleaned++)) || true
                        echo "  ✓ Removed ${image_name}:${version} ($img_size)"
                        # Log the output
                        [[ -n "$rmi_output" ]] && echo "$rmi_output" >> "$LOG_FILE"
                    else
                        warning "  Failed to remove ${image_name}:${version}"
                        [[ -n "$rmi_output" ]] && echo "$rmi_output" >> "$LOG_FILE"
                    fi
                fi
            done <<< "$versions_to_remove"
        fi
    done

    if [[ $images_cleaned -gt 0 ]]; then
        success "Cleaned up $images_cleaned old image versions"
    else
        info "No old image versions to clean up"
    fi

    echo ""
}

# Check dockerd CPU usage and restart if too high
# High dockerd CPU (>50%) often indicates accumulated state that needs restart
# IMPORTANT: Uses 'top' for INSTANTANEOUS CPU, not 'ps' which shows lifetime average
check_and_restart_dockerd() {
    local cpu_threshold="${1:-50}"  # Restart if CPU > 50%

    info "Checking Docker daemon health..."

    # Get dockerd PID
    local dockerd_pid=$(pgrep -x dockerd 2>/dev/null | head -1)

    if [[ -z "$dockerd_pid" ]]; then
        warning "dockerd process not found"
        return 0
    fi

    # Get INSTANTANEOUS CPU usage using top (not ps which shows lifetime average)
    # top -bn2 runs 2 iterations: first is since boot, second is current
    # We take the second iteration for accurate current CPU
    local cpu_samples=()
    for i in 1 2 3; do
        # Use top with 2 iterations, 1 second delay, take second result
        local cpu=$(top -bn2 -d1 -p "$dockerd_pid" 2>/dev/null | grep -E "^\s*$dockerd_pid" | tail -1 | awk '{print int($9)}')
        if [[ -n "$cpu" && "$cpu" =~ ^[0-9]+$ ]]; then
            cpu_samples+=("$cpu")
        fi
    done

    if [[ ${#cpu_samples[@]} -eq 0 ]]; then
        warning "Could not measure dockerd CPU usage"
        return 0
    fi

    # Calculate average of instantaneous samples
    local total=0
    for cpu in "${cpu_samples[@]}"; do
        total=$((total + cpu))
    done
    local avg_cpu=$((total / ${#cpu_samples[@]}))

    # Get dockerd uptime for logging
    local dockerd_start=$(ps -p "$dockerd_pid" -o lstart= 2>/dev/null)
    local dockerd_time=$(ps -p "$dockerd_pid" -o time= 2>/dev/null | awk '{print $1}')

    if [[ $avg_cpu -gt $cpu_threshold ]]; then
        warning "Docker daemon CPU usage is high: ${avg_cpu}% (threshold: ${cpu_threshold}%)"
        info "dockerd uptime: $dockerd_time, started: $dockerd_start"
        echo ""

        # Only restart if running with sudo/root
        if [[ $EUID -eq 0 ]]; then
            info "Restarting Docker daemon to clear accumulated state..."

            # Stop all our containers gracefully first
            if compose_cmd ps -q 2>/dev/null | grep -q .; then
                info "Stopping containers before daemon restart..."
                compose_cmd stop --timeout 60 >> "$LOG_FILE" 2>&1 || true
            fi

            # Restart Docker
            if systemctl restart docker 2>/dev/null; then
                success "Docker daemon restarted"

                # Wait for Docker to be ready
                local wait_count=0
                while ! docker info >/dev/null 2>&1; do
                    ((wait_count++))
                    if [[ $wait_count -gt 30 ]]; then
                        error "Docker daemon failed to start within 30 seconds"
                        return 1
                    fi
                    sleep 1
                done

                success "Docker daemon is ready"

                # Mark that PostgreSQL was stopped
                POSTGRES_WAS_STOPPED=true

                # Check new CPU usage
                sleep 3
                local new_cpu=$(ps -p $(pgrep -x dockerd) -o %cpu= 2>/dev/null | awk '{print int($1)}')
                info "New dockerd CPU usage: ${new_cpu:-unknown}%"
            else
                error "Failed to restart Docker daemon"
                return 1
            fi
        else
            warning "Cannot restart Docker daemon without root privileges"
            warning "Run deploy.sh with sudo to enable automatic daemon restart"
            info "Manual restart: sudo systemctl restart docker"
        fi
    else
        success "Docker daemon CPU usage is normal: ${avg_cpu}%"
    fi

    echo ""
}

# Soft Docker system cleanup (alternative to dockerd restart)
# Cleans up unused resources without stopping running services
# Run this AFTER successful deployment to release accumulated Docker state
cleanup_docker_system_soft() {
    info "Running soft Docker system cleanup..."

    local cleaned_something=false

    # 1. Prune unused networks (safe - won't affect running containers)
    local unused_networks=$(docker network ls --filter "dangling=true" -q 2>/dev/null | wc -l || echo "0")
    if [[ $unused_networks -gt 0 ]]; then
        info "Removing $unused_networks unused networks..."
        if docker network prune -f >> "$LOG_FILE" 2>&1; then
            success "Removed unused networks"
            cleaned_something=true
        fi
    fi

    # 2. Prune stopped containers (safe - only removes exited containers)
    local stopped_containers=$(docker ps -a -f "status=exited" -q 2>/dev/null | wc -l || echo "0")
    if [[ $stopped_containers -gt 0 ]]; then
        info "Removing $stopped_containers stopped containers..."
        if docker container prune -f >> "$LOG_FILE" 2>&1; then
            success "Removed stopped containers"
            cleaned_something=true
        fi
    fi

    # 3. Light system prune (without volumes, without build cache)
    # This clears Docker daemon's internal tracking state
    info "Clearing Docker daemon cache..."
    if docker system prune -f --filter "until=1h" >> "$LOG_FILE" 2>&1; then
        cleaned_something=true
    fi

    # 4. Check dockerd INSTANTANEOUS CPU after cleanup (using top, not ps)
    local dockerd_pid=$(pgrep -x dockerd 2>/dev/null | head -1)
    if [[ -n "$dockerd_pid" ]]; then
        sleep 2
        # Use top for instantaneous CPU (ps shows lifetime average which is misleading)
        local cpu=$(top -bn2 -d1 -p "$dockerd_pid" 2>/dev/null | grep -E "^\s*$dockerd_pid" | tail -1 | awk '{print int($9)}')
        if [[ -n "$cpu" && "$cpu" =~ ^[0-9]+$ ]]; then
            if [[ $cpu -gt 50 ]]; then
                warning "dockerd CPU still elevated after cleanup: ${cpu}%"
                warning "Recommend: sudo systemctl restart docker"
            elif [[ $cpu -gt 30 ]]; then
                warning "dockerd CPU slightly elevated: ${cpu}%"
            else
                success "dockerd CPU after cleanup: ${cpu}%"
            fi
        fi
    fi

    if [[ "$cleaned_something" == "true" ]]; then
        success "Soft Docker cleanup completed"
    else
        info "No Docker resources needed cleanup"
    fi

    echo ""
}
export -f cleanup_docker_system_soft

# Final Docker daemon optimization after deployment
# Restarts dockerd if CPU is still high after soft cleanup
# Should be called as the LAST step of deployment
# Args:
#   $1 - force_restart: "true" to force restart regardless of CPU (default: "false")
# Returns: 0 on success, 1 on failure
final_dockerd_optimization() {
    local force_restart="${1:-false}"
    local cpu_threshold=50

    step "Final Docker daemon optimization"

    # Get dockerd PID
    local dockerd_pid=$(pgrep -x dockerd 2>/dev/null | head -1)
    if [[ -z "$dockerd_pid" ]]; then
        warning "dockerd process not found"
        return 0
    fi

    # Check instantaneous CPU using top (not ps which shows lifetime average)
    local cpu=$(top -bn2 -d1 -p "$dockerd_pid" 2>/dev/null | grep -E "^\s*$dockerd_pid" | tail -1 | awk '{print int($9)}')

    if [[ -z "$cpu" || ! "$cpu" =~ ^[0-9]+$ ]]; then
        warning "Could not measure dockerd CPU usage"
        return 0
    fi

    info "dockerd CPU after soft cleanup: ${cpu}%"

    # Check if restart is needed
    local needs_restart=false
    if [[ "$force_restart" == "true" ]]; then
        info "Force Docker daemon restart requested"
        needs_restart=true
    elif [[ "$cpu" -gt "$cpu_threshold" ]]; then
        warning "dockerd CPU still high: ${cpu}% (threshold: ${cpu_threshold}%)"
        needs_restart=true
    fi

    if [[ "$needs_restart" == "true" ]]; then
        # Check root privileges
        if [[ $EUID -ne 0 ]]; then
            warning "Cannot restart Docker daemon without root privileges"
            warning "Run deploy.sh with sudo to enable automatic daemon restart"
            return 0
        fi

        info "Performing final Docker daemon restart..."

        # 1. Stop all containers gracefully (60s timeout)
        if compose_cmd ps -q 2>/dev/null | grep -q .; then
            info "Stopping containers before daemon restart..."
            compose_cmd stop --timeout 60 >> "$LOG_FILE" 2>&1 || true
        fi

        # 2. Aggressive prune before restart (clears more state)
        info "Aggressive Docker cleanup before restart..."
        docker builder prune -f >> "$LOG_FILE" 2>&1 || true
        docker system prune -f >> "$LOG_FILE" 2>&1 || true

        # 3. Restart Docker daemon
        info "Restarting Docker daemon..."
        if ! systemctl restart docker 2>/dev/null; then
            error "Failed to restart Docker daemon"
            return 1
        fi

        # 4. Wait for Docker daemon to be ready
        local wait_count=0
        while ! docker info >/dev/null 2>&1; do
            ((wait_count++))
            if [[ $wait_count -gt 30 ]]; then
                error "Docker daemon failed to start within 30 seconds"
                return 1
            fi
            sleep 1
        done
        success "Docker daemon is ready"

        # 5. Restart services
        info "Restarting services after daemon restart..."
        if ! compose_cmd up -d >> "$LOG_FILE" 2>&1; then
            error "Failed to restart services after daemon restart"
            return 1
        fi

        # 6. Wait for containers to stabilize
        info "Waiting for services to become healthy..."
        sleep 10

        # Wait for health checks
        local health_wait=0
        local max_health_wait=60
        while [[ $health_wait -lt $max_health_wait ]]; do
            local unhealthy=$(docker ps --filter "health=unhealthy" -q 2>/dev/null | wc -l)
            local starting=$(docker ps --filter "health=starting" -q 2>/dev/null | wc -l)
            if [[ $unhealthy -eq 0 && $starting -eq 0 ]]; then
                break
            fi
            ((health_wait++))
            sleep 1
        done

        # 7. Report new CPU usage
        sleep 2
        local new_pid=$(pgrep -x dockerd 2>/dev/null | head -1)
        local new_cpu=$(top -bn2 -d1 -p "$new_pid" 2>/dev/null | grep -E "^\s*$new_pid" | tail -1 | awk '{print int($9)}')
        success "Docker daemon restarted. New CPU: ${new_cpu:-unknown}%"

        # 8. Show container status
        info "Container status after restart:"
        compose_cmd ps 2>/dev/null || true
    else
        success "dockerd CPU is normal: ${cpu}% - no restart needed"
    fi

    echo ""
}
export -f final_dockerd_optimization

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
