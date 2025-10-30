# Family Budget 💰

> **Personal family budget management system with Telegram bot integration and web analytics dashboard**

![Version](https://img.shields.io/badge/version-5.0.0--beta-blue)
![Python](https://img.shields.io/badge/python-3.11+-green)
![PostgreSQL](https://img.shields.io/badge/postgresql-16+-blue)
![License](https://img.shields.io/badge/license-MIT-green)

---

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Technology Stack](#technology-stack)
- [Quick Start](#quick-start)
- [Installation](#installation)
- [Configuration](#configuration)
- [Usage](#usage)
- [Architecture](#architecture)
- [Security](#security)
- [Development](#development)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [License](#license)

---

## 🎯 Overview

**Family Budget** is a comprehensive personal finance management system designed for families and individuals to track income and expenses through a convenient Telegram bot interface with powerful web analytics.

### Key Highlights

- 💬 **Telegram Bot Commands** - Add transactions on the go with simple text commands
- 📱 **Telegram Web Apps** - 8 interactive web forms via Menu Button (Phase 3 - NEW!)
- 📊 **Web Analytics Dashboard** - Beautiful charts and reports powered by ECharts
- 🔐 **Secure Authentication** - Telegram OAuth with JWT tokens
- 📂 **Hierarchical Categories** - Organize expenses with parent-child relationships
- 👥 **Multi-user Support** - Each family member has isolated data
- 🔄 **Historical Tracking** - SCD Type 2 dimension tables for audit trail
- 🚀 **One-Command Deployment** - Three scripts for complete setup
- 🔒 **Production-Ready Security** - UFW firewall, encrypted secrets, non-root containers

---

## ✨ Features

### Telegram Bot Commands

**8 Bot Commands:**

- `/start` - **Telegram OAuth authentication** - Instant registration with JWT tokens
- `/add` - **Add transaction (expense/income)** - Multi-step conversation with inline keyboards
  - Select category (hierarchical with parent/child support)
  - Enter amount (validated, up to 2 decimal places)
  - Choose date (calendar picker, cannot be future for facts)
  - Add description (optional)
  - Select ЦФО (Financial Center) - optional
  - Select МВЗ (Cost Center) - optional
  - Review and confirm
- `/addplan` - **Add budget plan** - Same UX as `/add` but for future planning
  - Supports future dates
  - Creates record_type="plan"
- `/summary` - **Plan vs Fact comparison** - View budget performance
  - Period selection: today, week, month, quarter, year
  - Shows: plan, fact, deviation (amount + percentage)
  - Grouped by top-level categories
- `/edit` - **Edit/delete transactions** - Manage last 10 transactions
  - Inline keyboard to select transaction
  - Edit any field (amount, category, date, etc.)
  - Delete with confirmation
  - Security: only your own transactions
- `/today` - **Today's statistics** - Quick summary for current day
- `/stats` - **All-time statistics** - Historical overview with category breakdown
- `/settings` - **User settings** - Configure notifications and reports
  - Enable/disable weekly reports
  - Set notification threshold (default 90%)
  - Choose report schedule

**Automated Features:**

- 📧 **Weekly budget reports** - Every Sunday 20:00 (configurable)
  - Plan vs Fact summary
  - Top-3 expense categories
  - Deviation analysis
- 🚨 **Budget threshold notifications** - Real-time alerts when spending exceeds 90% of plan
- 🔔 **Notification history** - No duplicate alerts for same category/period

### Telegram Web Apps (Phase 3 - READY!)

**8 Interactive Web Forms** accessible via **Menu Button** in the bot:

- 📋 **Main Menu (index.html)** - Dashboard with 3x3 grid navigation
  - Quick Stats widget (today's income/expense/balance)
  - Fast access to all 7 forms
  - User personalization with greeting

- ➕ **Add Transaction (add.html)** - Quick expense/income entry
  - Segmented control for type selection
  - Quick amount buttons (100, 500, 1000, 5000)
  - Hierarchical category selection
  - Client-side validation
  - Date picker (max: today)

- 📅 **Today's View (today.html)** - Daily transaction summary
  - Summary card (income/expense/balance)
  - Transaction list grouped by time
  - Color-coded amounts (green/red)
  - Click to edit

- 📋 **Transaction List (list.html)** - Full history with filters
  - Collapsible filters panel
  - Date range filter
  - Type & category filters
  - Pagination (20 items/page)

- ✏️ **Edit Transaction (edit.html)** - Modify or delete
  - Pre-filled form
  - Delete button with confirmation
  - Same validation as add form
  - History navigation support

- 📊 **Statistics (stats.html)** - Category breakdown
  - Period selector (Today/Week/Month/Year)
  - Top 5 expense categories
  - Top 5 income categories
  - Progress bars with percentages

- 📝 **Add Plan (addplan.html)** - Budget planning
  - Quick amount buttons (5k, 10k, 20k, 50k)
  - Period selector (Month/Quarter/Year/Custom)
  - Auto date calculation
  - Recurring plans UI (backend support TODO)

- 📊 **Plan vs Fact Summary (summary.html)** - Budget performance
  - Total summary card (plan/fact/diff)
  - Category-level comparison
  - Progress bars with color indicators
  - Economy vs overspending highlights

- 🔍 **Advanced Search (search.html)** - Filter & export
  - 5 filter types (date, type, category, amount, description)
  - CSV export with BOM (Excel compatible)
  - Hybrid filtering (backend + client)
  - Results count display

**Technology:**
- **Telegram Web Apps SDK** - Native integration with Menu Button
- **Vanilla JavaScript ES6+** - No frameworks, modular architecture
- **7 Core Modules:** app.js, api.js, auth.js, ui.js, validators.js, theme.js, storage.js
- **Telegram Theme Support** - Auto light/dark mode
- **Bundle Size:** ~190KB total (HTML + JS + CSS) - excellent for mobile

**Key Features:**
- ✅ JWT Bearer token authentication
- ✅ Period selectors (Month/Quarter/Year/Custom)
- ✅ CSV export (Excel compatible with BOM)
- ✅ Hybrid filtering (backend reduces data, client filters)
- ✅ Client-side aggregation & grouping
- ✅ Haptic feedback (via Telegram SDK)
- ✅ Responsive design for all devices
- ✅ User data isolation (current_user.id filter)

**Status:** Phase 0-3 Complete | Ready for Manual Testing

### Web Analytics

- **Interactive Charts:**
  - Bar charts (monthly expenses by category)
  - Line charts (trend analysis)
  - Pie charts (expense distribution)
  - Waterfall charts (cash flow analysis)
  - Heatmap (spending patterns)

- **Filtering Options:**
  - Date range selection
  - Category filtering
  - Transaction type (income/expense)
  - Period comparison (month-over-month, year-over-year)

### Financial/Cost Centers (Phase 2 - NEW!)

- **ЦФО (Financial Centers)** - Track accounts, wallets, cash
  - Bank accounts
  - Cash wallets
  - Credit cards
  - Investment accounts
- **МВЗ (Cost Centers)** - Track projects, departments, budget groups
  - Family members
  - Projects/goals
  - Business departments
  - Budget categories
- **Features:**
  - Full CRUD via REST API (10 endpoints)
  - Admin panel UI management
  - SCD Type 2 historical tracking
  - Integration in transaction creation (Web + Telegram Bot)
  - Optional fields - backward compatible with existing data

### Administration

- User management (admin panel)
- Global categories management
- ЦФО/МВЗ management (Financial and Cost Centers)
- Automatic database backups to S3
- Health checks and monitoring
- Structured logging
- System statistics dashboard

---

## 🛠️ Technology Stack

### Backend

- **FastAPI** 0.104+ - Modern Python web framework
- **SQLModel** - SQL database models with Pydantic validation
- **PostgreSQL** 16+ - Database with SCD Type 2 and Closure Table
- **Alembic** - Database migrations
- **python-telegram-bot** 20.x - Telegram bot framework

### Frontend

**Web Analytics:**
- **HTMX** - Dynamic UI without complex JavaScript
- **Jinja2** - Server-side templating
- **ECharts** 5.5+ - Beautiful interactive charts
- **TailwindCSS** - Utility-first CSS framework

**Telegram Web Apps:**
- **Telegram Web Apps SDK** - Native integration with Menu Button
- **Vanilla JavaScript ES6+** - Modular architecture (7 core modules)
- **Telegram Theme API** - Auto light/dark mode support
- **CSS Variables** - Responsive design with Telegram theme integration

### Infrastructure

- **Docker** & **Docker Compose** - Containerization
- **Nginx** - Reverse proxy and SSL termination
- **UFW** - Firewall with IP restrictions
- **Certbot** - Automatic SSL certificates (Let's Encrypt)
- **systemd** & **cron** - Backup automation

---

## 🚀 Quick Start

### Prerequisites

- Ubuntu 20.04+ or Debian 11+
- Telegram bot token (from [@BotFather](https://t.me/BotFather))
- Your Telegram ID (from [@userinfobot](https://t.me/userinfobot))
- Root/sudo access
- Internet connection

### Three-Command Deployment

```bash
# 1. Install Docker, UFW, and system dependencies
sudo ./install.sh

# 2. Configure application (interactive setup)
./setup.sh

# 3. Deploy application
./deploy.sh
```

**That's it!** Your Family Budget system is now running.

---

## 📦 Installation

### Step 1: System Preparation (`install.sh`)

This script installs all required system dependencies.

**IMPORTANT:** Run install.sh from your git repository directory.

```bash
# Clone repository first
git clone https://github.com/yourusername/familyBudget.git ~/familyBudget
cd ~/familyBudget

# Run install script
sudo ./install.sh
```

**What it does:**
- ✅ Installs Docker Engine and Docker Compose
- ✅ Configures UFW firewall (allows SSH, HTTP, HTTPS)
- ✅ Installs utilities (curl, git, jq, vim, etc.)
- ✅ Creates project directory structure in `/opt/budget`
- ✅ Copies template files (nginx, .env.example) to `/opt/budget`
- ✅ Adds user to docker group
- ✅ Verifies installation with hello-world container

**Duration:** 5-10 minutes

**Output:**
```
[INFO] Detected OS: ubuntu 22.04
[INFO] Installing Docker...
[SUCCESS] Docker installed successfully (version: 24.0.7)
[INFO] Configuring UFW firewall...
[SUCCESS] UFW configured successfully
[SUCCESS] Installation Complete!
```

**After installation:**
```bash
# Log out and log in (for docker group activation)
# Or run:
newgrp docker

# Verify Docker works
docker ps
```

---

### Step 2: Application Configuration (`setup.sh`)

This script provides interactive configuration for your application.

```bash
cd ~/familyBudget
./setup.sh
```

**What it does:**
- ✅ Validates deployment directory and template files
- ✅ Creates `.env` file in `/opt/budget` with configuration
- ✅ Generates secure passwords and JWT secrets
- ✅ Configures PostgreSQL access and firewall (UFW)
- ✅ Optionally configures domain and SSL
- ✅ Validates Telegram bot token

**Note:** This script does NOT copy source code. Code synchronization happens in Step 3 (deploy.sh).

**What it configures:**

1. **Database Settings:**
   - PostgreSQL database name (default: `familybudget`)
   - PostgreSQL username (default: `familybudget`)
   - PostgreSQL password (auto-generated or custom)

2. **Security:**
   - JWT secret key (auto-generated 64 hex chars)
   - JWT expiration period (default: 7 days)

3. **Telegram Bot:**
   - Bot token (from @BotFather) ⚠️ **REQUIRED**
   - Bot username (optional)
   - Admin Telegram ID (from @userinfobot) ⚠️ **REQUIRED**

4. **Application Settings:**
   - Environment (development/staging/production)
   - Domain name (or localhost)
   - Backend port (default: 8000)
   - Number of workers (default: 4)
   - Log level (default: INFO)

5. **🔒 CRITICAL: PostgreSQL External Access** (optional)
   - **Default:** Disabled (most secure)
   - **If enabled:** UFW IP restriction configured
   - Only specified IP can access PostgreSQL
   - All other IPs blocked by firewall

**Interactive Example:**

```
▶ Database Configuration
PostgreSQL database name [familybudget]: <Enter>
PostgreSQL password [auto-generated]: <Enter>

▶ Telegram Bot Configuration
Telegram bot token: 1234567890:ABCdefGHIjklMNOpqrsTUVwxyz
Admin Telegram ID: 123456789

▶ PostgreSQL External Access Configuration (CRITICAL SECURITY)

[WARNING] SECURITY WARNING:
  By default, PostgreSQL is NOT accessible from outside the Docker network.
  This is the most secure configuration.

Enable PostgreSQL external access? [y/N]: n

[SUCCESS] PostgreSQL external access disabled (most secure)
```

**Security Features:**
- 🔐 Auto-generates strong passwords (32 characters)
- 🔐 Auto-generates JWT secrets (64 hex characters)
- 🔐 IP validation for PostgreSQL access
- 🔐 .env file permissions set to 600 (owner read/write only)
- 🔐 UFW firewall configuration for database protection

**Duration:** 2-5 minutes

**Note:** deploy.sh can be run from anywhere - it always deploys from `/opt/budget`

---

### Step 3: Application Deployment (`deploy.sh`)

This script deploys and starts all services from `/opt/budget`.

**Note:** Can be run from repository or from `/opt/budget` - always deploys from `/opt/budget`.

```bash
./deploy.sh
# Or with full profile (includes nginx, bot, certbot)
./deploy.sh --profile full
```

**What it does:**

1. **Validation:**
   - Checks Docker installation
   - Validates .env file exists
   - Checks required environment variables
   - Verifies no default placeholders

2. **Deployment:**
   - Builds Docker images (if needed)
   - Stops existing services (if running)
   - Starts all services with Docker Compose
   - Waits for services to become healthy (max 120s each)
   - Runs database migrations (Alembic)

3. **Verification:**
   - Displays service statuses
   - Shows access URLs
   - Provides useful commands

**Output:**

```
========================================================================
           Family Budget - Deployment Status
========================================================================

Services:
  ✓ postgres: healthy
  ✓ backend: healthy

Access URLs:
  Backend:     http://localhost:8000

Useful commands:
  View logs:           docker compose logs -f
  View service logs:   docker compose logs -f <service>
  Restart service:     docker compose restart <service>
  Stop all:            docker compose down
========================================================================
```

**Duration:** 3-5 minutes

---

### Deployment Options

```bash
# Build images before deploying
./deploy.sh --build

# Deploy with all services (nginx, certbot, bot)
./deploy.sh --profile full

# Clean deployment (removes all data!)
./deploy.sh --clean

# Show logs in foreground
./deploy.sh --foreground

# Skip database migrations
./deploy.sh --no-migrate
```

---

## ⚙️ Configuration

### Environment Variables

All configuration is stored in `.env` file (created by `setup.sh`).

**Required Variables:**

```bash
# Database
POSTGRES_PASSWORD=<strong-password>

# Security
JWT_SECRET=<generated-secret>

# Telegram
TELEGRAM_BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz
ADMIN_TELEGRAM_ID=123456789
```

**Optional Variables:**

```bash
# Application
APP_ENV=production
DOMAIN=localhost
BACKEND_PORT=8000
WORKERS=4
LOG_LEVEL=INFO

# PostgreSQL External Access (CRITICAL)
# Port 5432 is exposed in Docker but blocked by UFW firewall by default
POSTGRES_EXTERNAL_ACCESS=false
POSTGRES_ALLOWED_IP=

# S3 Backup (optional)
S3_ENDPOINT_URL=https://nyc3.digitaloceanspaces.com
S3_ACCESS_KEY_ID=<access-key>
S3_SECRET_ACCESS_KEY=<secret-key>
S3_BUCKET_NAME=familybudget-backups

# Nginx (for --profile full)
HTTP_PORT=80
HTTPS_PORT=443
SSL_TYPE=letsencrypt
LETSENCRYPT_EMAIL=admin@example.com
```

### Editing Configuration

```bash
# Edit .env file
nano .env

# Restart services after changes
docker compose restart backend
```

### Generating Secrets

```bash
# Generate JWT secret
openssl rand -hex 32

# Generate strong password
openssl rand -base64 32
```

---

## 📱 Usage

### Telegram Bot

#### Setup (First Time)

1. **Create Telegram Bot** (if you haven't):
   - Open Telegram and find [@BotFather](https://t.me/BotFather)
   - Send `/newbot` command
   - Follow instructions to create your bot
   - Save the **bot token** (format: `1234567890:ABCdefGHIjklMNOpqrsTUVwxyz`)
   - (Optional) Set bot description, about text, and profile picture

2. **Get Your Telegram ID**:
   - Open [@userinfobot](https://t.me/userinfobot) in Telegram
   - Send `/start` to get your Telegram User ID
   - Save this ID (format: `123456789`)

3. **Configure Application** (during `setup.sh`):
   ```bash
   ./setup.sh
   ```
   When prompted, enter:
   - Telegram bot token: `1234567890:ABCdefGHIjklMNOpqrsTUVwxyz`
   - Admin Telegram ID: `123456789`

4. **Deploy and Start Bot:**
   ```bash
   ./deploy.sh --profile full
   ```

5. **First Login:**
   - Open Telegram
   - Search for your bot username (e.g., `@FamilyBudgetBot`)
   - Send `/start`
   - Bot will respond with authentication button
   - Click "Login with Telegram"
   - You're authenticated! 🎉

#### Daily Usage

**Add Expense (Full Flow):**
1. Send `/add` command
2. Select category from inline keyboard (e.g., "Food → Groceries")
3. Enter amount: `50.75`
4. Choose date or skip for today
5. Add description (optional): `Weekly shopping`
6. Select ЦФО (optional): `Main Bank Account`
7. Select МВЗ (optional): `Family Budget`
8. Review and confirm
9. Done! Transaction saved ✅

**Add Budget Plan:**
1. Send `/addplan` command
2. Follow same steps as `/add`
3. Can select future dates
4. Plan vs Fact comparison available later

**View Summary:**
1. Send `/summary` command
2. Choose period: today, week, month, quarter, year
3. View:
   - Total plan
   - Total fact
   - Deviation (₽ and %)
   - Per-category breakdown

**Edit/Delete Transaction:**
1. Send `/edit` command
2. Select transaction from last 10
3. Choose action:
   - Edit amount
   - Edit category
   - Edit date
   - Edit description
   - **Delete** (with confirmation)

**Quick Statistics:**
- `/today` - Today's income/expenses
- `/stats` - All-time statistics with charts

**Configure Settings:**
1. Send `/settings` command
2. Options:
   - Enable/disable weekly reports
   - Set notification threshold (default 90%)
   - Choose report day/time

### Telegram Web Apps (Menu Button)

**Access Interactive Forms:**
1. Open bot chat in Telegram
2. Click **Menu Button** (three horizontal lines icon near message input)
3. Web Apps interface opens with 3x3 grid menu
4. Select any form to use

**Available Forms:**
- **📋 Main Menu** - Dashboard with Quick Stats (today's balance)
- **➕ Add Transaction** - Quick expense/income entry form
- **📅 Today** - View all today's transactions with summary
- **📋 List** - Full transaction history with filters and pagination
- **✏️ Edit** - Modify or delete any transaction
- **📊 Statistics** - Category breakdown with period selector
- **📝 Add Plan** - Create budget plans for month/quarter/year
- **📊 Summary** - Compare plan vs fact by categories
- **🔍 Search** - Advanced search with CSV export

**Example Workflow (Add Transaction via Web App):**
1. Click Menu Button → Select "Add Transaction"
2. Choose type (Expense/Income) with segmented control
3. Click quick amount button (100/500/1000/5000) or enter custom
4. Select category from scrollable list
5. Choose date (max: today) or keep default
6. Add description (optional)
7. Click "Save" button
8. Done! Web Apps closes automatically

**Example Workflow (CSV Export):**
1. Click Menu Button → Select "Search"
2. Set filters (date range, category, amount, etc.)
3. Click "🔍 Find Transactions"
4. Review results (count displayed)
5. Click "📥 Export to CSV"
6. File downloads automatically (Excel compatible with Cyrillic support)

**Key Advantages:**
- ✅ Faster than bot commands (no typing)
- ✅ Visual interface with quick buttons
- ✅ Auto theme (light/dark follows Telegram)
- ✅ Full keyboard support for amounts
- ✅ Native validation with error messages
- ✅ Haptic feedback on actions
- ✅ Works offline after initial load

### Web Interface

1. **Access dashboard:**
   ```
   http://your-domain:8000
   ```
   or
   ```
   http://localhost:8000
   ```

2. **Login:**
   - Click "Login with Telegram"
   - Authorize in Telegram
   - Redirected to dashboard

3. **View analytics:**
   - Navigate to "Analytics" tab
   - Select date range
   - View charts (bar, line, pie, waterfall, heatmap)
   - Filter by category

4. **Manage transactions:**
   - Navigate to "Transactions" tab
   - View all transactions
   - Edit or delete transactions

### Admin Panel

**Access:** `http://your-domain:8000/admin` (admin users only)

**Features:**
- User management (create, edit, deactivate)
- Global categories management
- System statistics
- Database backup status

---

## 🏗️ Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────┐
│                      Internet                             │
└────────────────────┬────────────────────────────────────┘
                     │
              ┌──────▼──────┐
              │    Nginx    │ (optional, --profile full)
              │  :80, :443  │ SSL termination, reverse proxy
              └──────┬──────┘
                     │
         ┌───────────┼───────────┐
         │                       │
    ┌────▼─────┐         ┌──────▼──────┐
    │ Backend  │         │ Telegram    │
    │ :8000    │         │     Bot     │
    └────┬─────┘         └──────┬──────┘
         │                      │
         └───────────┬──────────┘
                     │
              ┌──────▼──────┐
              │  PostgreSQL │
              │    :5432    │ (internal network only)
              └─────────────┘
```

### Network Segmentation

**External Network (`172.29.0.0/16`):**
- nginx (public-facing)
- backend (API endpoints)
- bot (Telegram integration)

**Internal Network (`172.28.0.0/16`):**
- postgres (no internet access)
- backend (database access)
- bot (database access)

**Security:** PostgreSQL isolated from internet, accessible only from backend/bot containers.

---

### Database Schema

**Dimension Tables (SCD Type 2):**

- `t_d_user` - Users with historical tracking
- `t_d_article` - Categories with hierarchical structure
- `t_d_article_hierarchy` - Closure Table for category hierarchy
- `t_d_financial_center` - Financial Centers (ЦФО) - Phase 2
- `t_d_cost_center` - Cost Centers (МВЗ) - Phase 2

**Fact Tables:**

- `t_f_budget_fact` - Income/expense transactions with plan/fact support
  - Includes `record_type` (fact/plan)
  - Optional `financial_center_id` and `cost_center_id`
- `t_notification` - Notification history for budget alerts

**Key Features:**
- SCD Type 2: Tracks all changes to users, categories, and centers
- Closure Table: Enables efficient hierarchical queries
- Plan vs Fact: Single table for both actual and planned transactions
- Partitioning: Fact table partitioned by month for performance
- Indexes: Optimized for common query patterns and joins

---

## 🔒 Security

### Security Features Implemented

1. **🔥 UFW Firewall:**
   - Default deny incoming
   - SSH (22), HTTP (80), HTTPS (443) allowed
   - PostgreSQL (5432) blocked by default
   - Optional: PostgreSQL access from single IP only

2. **🔐 Authentication:**
   - Telegram OAuth with HMAC-SHA256 validation
   - JWT tokens (httpOnly cookies)
   - 7-day token expiration
   - No password storage

3. **🏗️ Network Isolation:**
   - PostgreSQL on internal network (no internet)
   - Backend/bot on both networks
   - Network segmentation

4. **🐳 Container Security:**
   - Non-root user in containers
   - Multi-stage Docker builds (minimal attack surface)
   - Read-only root filesystem where possible
   - Resource limits (CPU, memory)

5. **🔑 Secrets Management:**
   - .env file with 600 permissions
   - Auto-generated strong passwords (32 chars)
   - Auto-generated JWT secrets (64 hex chars)
   - No secrets in code or docker-compose.yml

6. **📊 Data Isolation:**
   - User-based data isolation (WHERE user_id = current_user)
   - Admin role separation
   - SCD Type 2 audit trail

### Security Best Practices

**Production Checklist:**

- [ ] Run `setup.sh` interactively (not `--yes`)
- [ ] Disable PostgreSQL external access if not needed
- [ ] If external access needed, use specific IP (not 0.0.0.0/0)
- [ ] Verify UFW rules: `sudo ufw status`
- [ ] Review .env permissions: `ls -la .env` (should be 600)
- [ ] Never commit .env to git
- [ ] Use strong passwords (32+ characters)
- [ ] Rotate secrets every 90 days
- [ ] Enable HTTPS (use `--profile full` with SSL)

**UFW Configuration Example:**

```bash
# View current rules
sudo ufw status numbered

# Add PostgreSQL rule for specific IP
sudo ufw allow from 203.0.113.50 to any port 5432 comment "PostgreSQL from office"

# Remove rule if IP changes
sudo ufw delete <rule-number>
```

---

## 👨‍💻 Development

### Local Development Setup

```bash
# Clone repository
git clone <repository-url>
cd familyBudget

# Create Python virtual environment
python3.11 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r backend/requirements.txt

# Start PostgreSQL (Docker)
docker run -d --name familybudget-postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=familybudget \
  -p 5432:5432 \
  postgres:16-alpine

# Run database migrations
cd backend
alembic upgrade head

# Start backend development server
uvicorn backend.app.main:app --reload --host 0.0.0.0 --port 8000
```

### Running Tests

```bash
# Unit tests
pytest backend/tests/unit

# Integration tests
pytest backend/tests/integration

# E2E tests
pytest backend/tests/e2e

# Coverage report
pytest --cov=backend --cov-report=html
```

### Code Quality

```bash
# Linting
ruff check backend/

# Formatting
black backend/

# Type checking
mypy backend/
```

### Database Migrations

```bash
# Create new migration
alembic revision --autogenerate -m "Add new feature"

# Apply migrations
alembic upgrade head

# Rollback migration
alembic downgrade -1

# View migration history
alembic history
```

---

## 🔧 Troubleshooting

### Service Won't Start

```bash
# Check service logs
docker compose logs backend

# Check service status
docker compose ps

# Restart service
docker compose restart backend

# Rebuild and restart
docker compose down
./deploy.sh --build
```

### Database Connection Failed

```bash
# Check PostgreSQL health
docker compose exec postgres pg_isready -U familybudget

# Check DATABASE_URL in .env
grep DATABASE_URL .env

# Restart PostgreSQL
docker compose restart postgres

# Check PostgreSQL logs
docker compose logs postgres
```

### Port Already in Use

```bash
# Find what's using port
sudo lsof -i :8000

# Kill process
sudo kill -9 <PID>

# Or change port in .env
nano .env
# Set BACKEND_PORT=8001

# Restart
docker compose down
docker compose up -d
```

### UFW Blocking Connection

```bash
# Check UFW status
sudo ufw status verbose

# Allow custom port
sudo ufw allow 8000/tcp comment "Backend"

# Reload UFW
sudo ufw reload
```

### Telegram Bot Not Responding

```bash
# Check bot logs
docker compose logs bot

# Verify bot token
grep TELEGRAM_BOT_TOKEN .env

# Test webhook (if using webhook mode)
curl https://api.telegram.org/bot<BOT_TOKEN>/getWebhookInfo

# Restart bot
docker compose restart bot
```

### Clean Restart

```bash
# Stop all services
docker compose down

# Remove volumes (WARNING: deletes data!)
docker compose down -v

# Clean deployment
./deploy.sh --clean --build
```

---

## 📊 Monitoring

### Service Health Checks

```bash
# Check all services
docker compose ps

# Backend health endpoint
curl http://localhost:8000/health

# PostgreSQL connection
docker compose exec postgres psql -U familybudget -d familybudget -c "SELECT 1"
```

### Logs

```bash
# View all logs
docker compose logs -f

# View specific service logs
docker compose logs -f backend

# Last 100 lines
docker compose logs --tail=100 backend

# Follow specific service
docker compose logs -f backend | grep ERROR
```

### Resource Usage

```bash
# Docker stats
docker stats

# Disk usage
df -h

# Check Docker disk usage
docker system df
```

---

## 🤝 Contributing

Contributions are welcome! Please follow these guidelines:

1. **Fork the repository**

2. **Create a feature branch:**
   ```bash
   git checkout -b feature/amazing-feature
   ```

3. **Make your changes:**
   - Follow code style (black, ruff)
   - Add tests for new features
   - Update documentation

4. **Test your changes:**
   ```bash
   pytest
   ```

5. **Commit your changes:**
   ```bash
   git commit -m "feat: Add amazing feature"
   ```

6. **Push to your fork:**
   ```bash
   git push origin feature/amazing-feature
   ```

7. **Open a Pull Request**

### Code Style

- Python: PEP 8, black formatter, ruff linter
- SQL: Lowercase keywords, snake_case identifiers
- Bash: Google Shell Style Guide
- Commit messages: Conventional Commits

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- [FastAPI](https://fastapi.tiangolo.com/) - Modern Python web framework
- [python-telegram-bot](https://github.com/python-telegram-bot/python-telegram-bot) - Telegram bot framework
- [ECharts](https://echarts.apache.org/) - Beautiful charts
- [HTMX](https://htmx.org/) - Dynamic UI
- [PostgreSQL](https://www.postgresql.org/) - Powerful database
- [Docker](https://www.docker.com/) - Containerization

---

## 📞 Support

- **Issues:** [GitHub Issues](https://github.com/your-repo/issues)
- **Telegram:** [@your_support_bot](https://t.me/your_support_bot)
- **Email:** support@example.com

---

## 🔧 Troubleshooting

### "Nginx template not found" Error

**Error message:**
```
[ERROR] Nginx template not found: /opt/budget/nginx/conf.d/app.conf.template
```

**Cause:** `install.sh` was not run from the repository directory, so template files were not copied to `/opt/budget`.

**Solution:**
```bash
# 1. Navigate to repository
cd ~/familyBudget  # (or your repository location)

# 2. Re-run install.sh from repository
sudo ./install.sh

# 3. Verify template files exist
ls -la /opt/budget/nginx/conf.d/app.conf.template
ls -la /opt/budget/.env.example

# 4. Continue with setup
./setup.sh
```

### "Required template files are missing" Error

**Error message:**
```
[ERROR] Required template files are missing:
  ✗ /opt/budget/nginx/conf.d/app.conf.template
  ✗ /opt/budget/.env.example
```

**Cause:** Same as above - template files not initialized.

**Solution:** Follow the same steps as "Nginx template not found" error above.

### Correct Installation Workflow

**IMPORTANT:** Always follow this sequence:

```bash
# Step 1: Clone repository
git clone https://github.com/yourusername/familyBudget.git ~/familyBudget

# Step 2: Run install.sh FROM repository directory
cd ~/familyBudget
sudo ./install.sh

# Step 3: Run setup.sh (can be from anywhere)
./setup.sh

# Step 4: Run deploy.sh (can be from anywhere)
./deploy.sh
```

**Why this order matters:**
- `install.sh` needs access to repository files to copy templates
- `setup.sh` needs templates to be present in `/opt/budget`
- `deploy.sh` needs `.env` to be configured

---

## 📈 Roadmap

### ✅ Completed (v5.0.0-beta)
- [x] **Telegram Bot** - Full-featured bot with 8 commands
- [x] **ЦФО/МВЗ Integration** - Financial and Cost Centers
- [x] **Advanced Analytics** - Waterfall and Heatmap charts
- [x] **Budget Planning** - Plan vs Fact comparison
- [x] **Automated Notifications** - Budget threshold alerts and weekly reports

### 🚧 In Progress (v5.1.0 - v5.2.0)
- [ ] **Database Performance Optimization** - Indexes, query tuning
- [ ] **JWT Refresh Token** - Auto token renewal
- [ ] **Admin Dashboard Analytics** - System statistics
- [ ] **CSV/Excel/PDF Export** - Data export functionality
- [ ] **Load Testing** - Performance and stress testing

### 🔮 Future (v6.0+)
- [ ] Mobile app (React Native)
- [ ] Multi-currency support
- [ ] Recurring transactions automation
- [ ] Family budget sharing (multi-user budgets)
- [ ] Bank integration (Open Banking API)
- [ ] AI-powered expense categorization
- [ ] Receipt OCR scanning
- [ ] Voice commands via Telegram

---

**Made with ❤️ by Family Budget Team**

**Version:** 5.0.0-beta | **Last Updated:** 2025-10-15
