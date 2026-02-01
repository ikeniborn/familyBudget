# Configuration Files

This directory contains all configuration files for build tools and development.

## Files

- `vite.config.ts` - Vite bundler configuration (main build config)
- `vite.config.single.ts` - Alternative Vite config for single-file builds
- `eslint.config.js` - ESLint flat config (linting rules)
- `tailwind.config.js` - Tailwind CSS utility classes configuration
- `postcss.config.js` - PostCSS CSS processing pipeline
- `playwright.config.ts` - Playwright E2E testing configuration
- `vitest.config.ts` - Vitest unit testing configuration
- `tsconfig.json` - TypeScript compiler options
- `pytest.ini` - Pytest Python testing configuration

## Usage

All npm scripts in `package.json` reference these configs with `--config` flags.

### Examples

```bash
# TypeScript type checking
npm run type-check
# Uses: tsc --noEmit -p config/tsconfig.json

# Linting
npm run lint
# Uses: eslint . --config config/eslint.config.js

# Build CSS
npm run build:tailwind
# Uses: tailwindcss -c config/tailwind.config.js ...

# Run tests
npm run test
# Uses: vitest --config config/vitest.config.ts

# E2E tests
npm run test:e2e
# Uses: playwright test -c config/playwright.config.ts
```

## Migration

These configs were moved from root directory to centralize configuration.
All tools support custom config paths via CLI flags.

See: `docs/architecture/config-migration-plan.md` for details.
