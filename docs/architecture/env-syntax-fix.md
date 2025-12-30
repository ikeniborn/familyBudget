# .env File Syntax Fix

**Version:** 6.5.1
**Date:** 2025-12-30
**Type:** Bugfix

## Problem

Deployment failed during environment variable validation with error:

```bash
[INFO] Validating environment variables...
/opt/budget/.env: line 193: Budget: command not found
```

**Root Cause:**
Line 193 in `.env.example` contained unquoted value with whitespace:

```bash
WEBAUTHN_RP_NAME=Family Budget
```

When `bash` or `source` loads this file, it interprets:
- `WEBAUTHN_RP_NAME=Family` (variable assignment)
- `Budget` (command to execute - not found!)

## Solution

**Changed line 193 in `.env.example`:**

```diff
- WEBAUTHN_RP_NAME=Family Budget
+ WEBAUTHN_RP_NAME="Family Budget"
```

**Validation:**
```bash
# Syntax check passes
bash -n .env.example

# Grep for similar issues
grep -nE '^[A-Z_]+=.+\s+\w' .env.example
# Returns: (no matches)
```

## Impact

**Affected Files:**
- `.env.example` (template file)

**Affected Deployments:**
- All new deployments using `setup.sh`
- All deployments copying `.env.example` to `.env`

**Backward Compatibility:**
✅ **No breaking changes**
- Quoted values are fully compatible with bash `source` command
- Existing `.env` files NOT affected (user-managed)
- Only template file updated

## Validation Rules

**Added to deployment validation:**

All environment variables with whitespace in values MUST be quoted:

```bash
# ✅ CORRECT
WEBAUTHN_RP_NAME="Family Budget"
APP_NAME="My Application"
DESCRIPTION="Multi word description"

# ❌ INCORRECT (causes "command not found" error)
WEBAUTHN_RP_NAME=Family Budget
APP_NAME=My Application
```

**Shell interpretation:**
```bash
# Unquoted with space
VAR=Hello World
# Bash sees: VAR=Hello (assignment) + World (command)

# Quoted
VAR="Hello World"
# Bash sees: VAR="Hello World" (single assignment)
```

## Testing

**Syntax validation:**
```bash
# Check .env.example syntax
bash -n .env.example
# Exit code: 0 (success)

# Search for unquoted multi-word values
grep -nE '^[A-Z_]+=.+\s+\w' .env.example
# Output: (empty - no matches found)

# Test sourcing
source .env.example
echo $WEBAUTHN_RP_NAME
# Output: Family Budget
```

**Deployment test:**
```bash
cd ~/familyBudget
sudo ./deploy.sh --sync-mode update --cleanup-mode smart --patch

# Expected output:
# [INFO] Validating environment variables...
# [SUCCESS] Environment validation passed
```

## Related Files

- `.env.example:193` - Fixed line
- `scripts/lib/config.sh` - Environment validation logic (uses `source`)
- `deploy.sh` - Calls config validation before deployment

## Prevention

**Recommendation for new variables:**

When adding environment variables with multi-word values:

1. **ALWAYS quote the value** if it contains spaces
2. **Run syntax validation** after editing `.env.example`:
   ```bash
   bash -n .env.example
   ```
3. **Check for similar issues** across entire file:
   ```bash
   grep -nE '^[A-Z_]+=.+\s+\w' .env.example
   ```

## References

- Bash quoting rules: https://www.gnu.org/software/bash/manual/html_node/Quoting.html
- Environment file best practices: https://docs.docker.com/compose/environment-variables/
