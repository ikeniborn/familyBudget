# Environment File Conventions

## Overview

This project uses a simple and consistent naming convention for environment files:

- **`.env`** - The active environment file used by Docker Compose (not committed to git)
- **`.env.dev`** - Development environment template (committed to git)
- **`.env.example`** - Production environment template (committed to git)

## Usage

### Development

```bash
# Copy development template
cp .env.dev .env

# Or use the development script (automatically copies .env.dev to .env)
./scripts/dev.sh
```

### Production

```bash
# Copy production template
cp .env.example .env

# Edit with your production values
nano .env

# Deploy
./scripts/prod.sh
# or
docker-compose up -d
```

## Git Configuration

The `.gitignore` file is configured to:
- **Ignore** `.env` (contains sensitive production values)
- **Track** `.env.dev` (safe development defaults)
- **Track** `.env.example` (production template without sensitive data)

## Docker Compose Behavior

Docker Compose automatically loads the `.env` file from the project root. This means:
- No need to specify `--env-file` for standard deployments
- The same commands work for both development and production
- Environment is determined by which template you copied to `.env`

## Best Practices

1. **Never commit `.env`** - It contains sensitive data
2. **Always update both templates** - When adding new variables, update both `.env.dev` and `.env.example`
3. **Use descriptive examples** - In `.env.example`, use placeholders like `your_secure_password`
4. **Document new variables** - Update `ENVIRONMENT_VARIABLES.md` when adding new variables

## Migration from Old Convention

If you have existing files:
- `web.env` → rename to `.env`
- `.env.development` → rename to `.env.dev`
- `web_dev.env` → rename to `.env.dev`

## Quick Reference

| File | Purpose | Git Status | When to Use |
|------|---------|------------|-------------|
| `.env` | Active configuration | Ignored | Always (auto-loaded) |
| `.env.dev` | Development template | Tracked | Copy for development |
| `.env.example` | Production template | Tracked | Copy for production |