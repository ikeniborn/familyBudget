# Validation Scripts

This directory contains automated validation scripts for code quality and standards compliance.

## Available Scripts

### check-headers.sh

Validates header standardization across all template files.

**Usage:**
```bash
bash scripts/validation/check-headers.sh
```

**What it checks:**
- All H1/H2/H3 headers follow responsive standard
- No inline CSS in template files
- Modal headers use H2 (semantic correctness)
- All headers have responsive classes (sm:)

**Expected output:**
```
✅ All headers compliant (160/160)
✅ No inline CSS found
✅ All modals use H2
✅ All responsive classes present
```

**Integration:**
- Run manually after template changes
- Can be integrated into pre-commit hooks
- CI/CD pipeline validation

**Related documentation:**
- [Header Standards Guide](../../docs/architecture/frontend/header-standards.md)

---

## Adding New Validation Scripts

When adding new validation scripts:

1. **Name:** Use `check-*.sh` pattern
2. **Executable:** `chmod +x scripts/validation/check-*.sh`
3. **Exit codes:**
   - 0 = all checks passed
   - 1 = validation failures found
4. **Output:** Clear success/failure messages with emojis
5. **Documentation:** Update this README

---

## Future Scripts

Planned validation scripts:

- `check-imports.sh` - Validate ES module imports
- `check-css.sh` - Ensure no utility class conflicts
- `check-a11y.sh` - Accessibility standards
- `check-responsive.sh` - Responsive design patterns
