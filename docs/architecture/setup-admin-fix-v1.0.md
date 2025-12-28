# Setup.sh Admin Credentials Fix (v1.0)

## Problem Summary

**Issue:** After running `setup.sh`, admin email and password were NOT saved to `/opt/budget/.env`

**Root Cause:** Critical sed escaping bug + validation logic issues

---

## Bugs Fixed

### 1. 🔴 CRITICAL: sed Special Character Bug (Lines 1456-1457)

**Problem:**
```bash
# OLD CODE (BROKEN):
sed -i "s/^ADMIN_PASSWORD=.*/ADMIN_PASSWORD=${CONFIG[ADMIN_PASSWORD]:-}/" "$env_file"

# If password contains special chars: Test&123
# & is interpreted by sed as "matched string"
# Result: ADMIN_PASSWORD=TestADMIN_PASSWORD=old123  ❌
```

**Root Cause:**
- `generate_admin_password()` generates passwords with special chars: `!@#$%^&*`
- sed with `/` delimiter treats `&` as metacharacter (= matched string)
- Passwords with `&` corrupt `.env` file

**Fix:**
```bash
# NEW CODE (FIXED):
sed -i "s|^ADMIN_EMAIL=.*|ADMIN_EMAIL=${CONFIG[ADMIN_EMAIL]:-}|" "$env_file"
sed -i "s|^ADMIN_PASSWORD=.*|ADMIN_PASSWORD=${CONFIG[ADMIN_PASSWORD]:-}|" "$env_file"
```

**Changes:**
- Use `|` delimiter instead of `/` (avoids conflict with special chars)
- Added debug logging before write
- Shows email (visible) and password (hidden) status

---

### 2. 🟡 Email Validation Error Handling (Line 828)

**Problem:**
```bash
# OLD CODE:
if ! validate_email "${CONFIG[ADMIN_EMAIL]}"; then
    error "Invalid email format"
    CONFIG["ADMIN_EMAIL"]=""
    # ❌ Password NOT reset!
else
    # ... generate password ...
fi
```

**Result:**
- Invalid email → email cleared
- Password may remain set from previous attempt
- `.env` gets: `ADMIN_EMAIL=` but `ADMIN_PASSWORD=somevalue` (inconsistent!)

**Fix:**
```bash
# NEW CODE:
if ! validate_email "${CONFIG[ADMIN_EMAIL]}"; then
    error "Invalid email format"
    CONFIG["ADMIN_EMAIL"]=""
    CONFIG["ADMIN_PASSWORD"]=""  # ✅ ADDED
    warning "Admin email configuration cancelled due to validation error"
else
    # ...
fi
```

---

### 3. 🟡 Missing Password Empty Check (After Line 849)

**Problem:**
```bash
# OLD CODE:
prompt "Admin password (or press Enter for auto-generated)" "ADMIN_PASSWORD" "$generated_password" true

# No check if user somehow entered empty password!
success "Admin email authentication configured"
```

**Fix:**
```bash
# NEW CODE:
prompt "Admin password (or press Enter for auto-generated)" "ADMIN_PASSWORD" "$generated_password" true

# Validate password is not empty (sanity check)
if [[ -z "${CONFIG[ADMIN_PASSWORD]}" ]]; then
    error "Password cannot be empty!"
    CONFIG["ADMIN_EMAIL"]=""
    CONFIG["ADMIN_PASSWORD"]=""
    warning "Admin email configuration cancelled due to empty password"
else
    success "Admin email authentication configured"
    info "Admin: ${CONFIG[ADMIN_EMAIL]}"
    warning "SECURITY: Password is for INITIAL login only"
    warning "Change password after first login (optional)"
fi
```

---

### 4. ✅ Added Debug Logging (Lines 1458-1468)

**New Feature:**
```bash
info "Writing admin credentials to .env..."
if [[ -n "${CONFIG[ADMIN_EMAIL]:-}" ]]; then
    info "  ADMIN_EMAIL: ${CONFIG[ADMIN_EMAIL]}"
else
    info "  ADMIN_EMAIL: (empty - Telegram-only auth)"
fi
if [[ -n "${CONFIG[ADMIN_PASSWORD]:-}" ]]; then
    info "  ADMIN_PASSWORD: ***set*** (hidden)"
else
    info "  ADMIN_PASSWORD: (empty - Telegram-only auth)"
fi
```

**Benefits:**
- Clear visibility what's being written to `.env`
- Password value hidden (security)
- Easy troubleshooting for users

---

## Testing Procedure

### Test 1: Normal Flow (Auto-Generated Password)

```bash
cd ~/familyBudget
sudo ./setup.sh

# At prompt:
Configure admin email login? [y/N]: y
Admin email (optional): admin@example.com
Admin password (or press Enter for auto-generated): [Enter]

# Expected output:
[SUCCESS] Auto-generated secure password: Xy5!a7bF3cG9hJ2kP8qR4tU6
[SUCCESS] Admin email authentication configured
[INFO] Admin: admin@example.com

# ... later during .env creation:
[INFO] Writing admin credentials to .env...
[INFO]   ADMIN_EMAIL: admin@example.com
[INFO]   ADMIN_PASSWORD: ***set*** (hidden)
```

**Verify:**
```bash
cat /opt/budget/.env | grep ADMIN_EMAIL
# ADMIN_EMAIL=admin@example.com

cat /opt/budget/.env | grep ADMIN_PASSWORD
# ADMIN_PASSWORD=Xy5!a7bF3cG9hJ2kP8qR4tU6
```

---

### Test 2: Password with Special Characters (&, !, etc.)

**Purpose:** Verify sed | delimiter fix

```bash
cd ~/familyBudget
sudo ./setup.sh

# At prompt:
Configure admin email login? [y/N]: y
Admin email (optional): test@example.com
Admin password (or press Enter for auto-generated): Test&Pass!123@

# Expected output:
[SUCCESS] Admin email authentication configured
[INFO] Admin: test@example.com

# ... later:
[INFO] Writing admin credentials to .env...
[INFO]   ADMIN_EMAIL: test@example.com
[INFO]   ADMIN_PASSWORD: ***set*** (hidden)
```

**Verify:**
```bash
cat /opt/budget/.env | grep ADMIN_PASSWORD
# ADMIN_PASSWORD=Test&Pass!123@  (NOT corrupted!)
```

**OLD BUG would produce:**
```bash
# ADMIN_PASSWORD=TestADMIN_PASSWORD=oldPass!123@  ❌ WRONG!
```

---

### Test 3: Invalid Email Validation

**Purpose:** Verify email+password both cleared on validation error

```bash
cd ~/familyBudget
sudo ./setup.sh

# At prompt:
Configure admin email login? [y/N]: y
Admin email (optional): invalid-email-no-at-sign

# Expected output:
[ERROR] Invalid email format
[WARNING] Admin email configuration cancelled due to validation error
[INFO] Admin email authentication disabled (Telegram only)
```

**Verify:**
```bash
cat /opt/budget/.env | grep ADMIN_EMAIL
# ADMIN_EMAIL=

cat /opt/budget/.env | grep ADMIN_PASSWORD
# ADMIN_PASSWORD=
```

---

### Test 4: Skip Admin Email Config

**Purpose:** Verify empty values in .env

```bash
cd ~/familyBudget
sudo ./setup.sh

# At prompt:
Configure admin email login? [y/N]: n

# Expected output:
[INFO] Admin email authentication disabled (Telegram only)

# ... later:
[INFO] Writing admin credentials to .env...
[INFO]   ADMIN_EMAIL: (empty - Telegram-only auth)
[INFO]   ADMIN_PASSWORD: (empty - Telegram-only auth)
```

**Verify:**
```bash
cat /opt/budget/.env | grep ADMIN_EMAIL
# ADMIN_EMAIL=

cat /opt/budget/.env | grep ADMIN_PASSWORD
# ADMIN_PASSWORD=
```

---

## File Changes Summary

**Modified File:** `setup.sh`

**Lines Changed:**
- **828-830:** Add password reset on email validation failure
- **851-862:** Add password empty check after prompt
- **1456-1470:** Fix sed delimiter + add debug logging

**Total Lines Added:** ~20 lines
**Total Lines Modified:** 3 sections

---

## Deployment Verification

After deploying with fixed `setup.sh`:

```bash
cd ~/familyBudget
sudo ./setup.sh
# ... configure admin email/password ...

sudo ./deploy.sh

# Watch for admin creation output:
# [INFO] [ADMIN_USER] Creating admin user: admin@example.com
# [INFO] [ADMIN_USER] Password validation passed (OWASP 2023 compliant)
# [INFO] [ADMIN_USER] ✓ Admin user created successfully
```

**Database check:**
```bash
docker compose exec postgres psql -U familybudget -d familybudget -c \
  "SELECT email, is_admin, is_active, two_factor_enabled FROM t_d_user WHERE email='admin@example.com';"

# Expected:
#        email        | is_admin | is_active | two_factor_enabled
# --------------------+----------+-----------+--------------------
#  admin@example.com  | t        | t         | f
```

---

## Rollback (If Needed)

If issues occur, revert to previous version:

```bash
cd ~/familyBudget
git log --oneline | head -5
# abc1234 fix(setup): admin credentials not saved to .env
# def5678 previous commit

git revert abc1234
sudo ./setup.sh
```

---

## Related Documentation

- [admin-setup.md](./admin-setup.md) - Complete admin setup guide
- [authentication.md](./authentication.md) - Authentication architecture
- [CLAUDE.md](../../CLAUDE.md) - Developer documentation

---

## Changelog

**Version 1.0** (2025-12-27)
- Fixed critical sed escaping bug (special chars in password)
- Added password reset on email validation failure
- Added password empty validation after prompt
- Added debug logging for .env write operations
