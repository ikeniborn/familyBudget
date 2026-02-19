# Admin Email/Password Setup Guide

## Overview

This guide walks through configuring admin email/password authentication for emergency access to Family Budget without 2FA requirement.

**⚠️ Security Note:** This feature allows admin to bypass 2FA. Regular users are NOT affected and still require 2FA for email/password login.

---

## Prerequisites

Before starting, ensure you have:

- [ ] Root access to the server
- [ ] Family Budget repository cloned (`~/familyBudget`)
- [ ] `setup.sh` not yet run (or willing to reconfigure)
- [ ] Valid email address for admin account
- [ ] Understanding of security implications

---

## Step 1: Run Interactive Setup

Navigate to repository and run setup script:

```bash
cd ~/familyBudget
sudo ./setup.sh
```

The script will guide you through configuration, including standard sections for PostgreSQL, Telegram bot, etc.

---

## Step 2: Configure Admin Email (Interactive Prompt)

When you reach the **Admin Email Authentication** section:

```
▶ Admin Email Authentication (Optional - Emergency Access)
[INFO] Admin can login via email/password WITHOUT 2FA (security exception)
[INFO] Regular users ALWAYS require 2FA for email/password login
[INFO] Leave blank to use Telegram authentication only

Configure admin email login? [y/N]:
```

**Answer:** `y` (yes)

---

## Step 3: Enter Admin Email

```
Admin email (optional):
```

**Enter:** Your admin email address (e.g., `admin@example.com`)

**Validation:**
- Must be valid email format
- Will be converted to lowercase
- Can be same as or different from your personal email

**Example:**
```
Admin email (optional): admin@example.com
```

---

## Step 4: Review Password Requirements

The script will display OWASP 2023 password requirements:

```
Password requirements (OWASP 2023):
  ✓ Minimum 12 characters
  ✓ At least one uppercase letter (A-Z)
  ✓ At least one lowercase letter (a-z)
  ✓ At least one digit (0-9)
  ✓ At least one special character (!@#$%^&*...)
```

**Note:** These are the minimum requirements. Setup.sh auto-generates **24-character** passwords for enhanced security.

---

## Step 5: Accept or Enter Password

The script auto-generates a secure 24-character password:

```
[SUCCESS] Auto-generated secure password: Xy5!a7bF3cG9hJ2kP8qR4tU6
[INFO] Accept this or enter your own (hidden input)

Admin password (or press Enter for auto-generated):
```

**Options:**

**Option A: Accept auto-generated (RECOMMENDED)**
- Press `Enter` to accept
- Password is OWASP 2023 compliant (24 characters)
- Strong, random, unique

**Option B: Enter custom password**
- Type your own password (hidden input)
- Must meet OWASP 2023 requirements (minimum 12 characters)
- Will be validated before saving

**Example (accepting auto-generated):**
```
Admin password (or press Enter for auto-generated): [Enter]

[SUCCESS] Admin email authentication configured
[INFO] Admin: admin@example.com
[WARNING] SECURITY: Password is for INITIAL login only
[WARNING] Change password after first login (optional)
```

---

## Step 6: Save Password Securely

**CRITICAL:** Copy the auto-generated password immediately!

**Recommended storage methods:**
1. Password manager (1Password, Bitwarden, KeePassXC)
2. Encrypted notes app (Standard Notes, Joplin)
3. Secure offline storage (encrypted USB drive)

**Never store in:**
- ❌ Plain text files
- ❌ Shared documents
- ❌ Unencrypted cloud storage
- ❌ Email or messaging apps

---

## Step 7: Complete Setup

Continue with remaining `setup.sh` prompts:
- Application settings (environment, domain, port)
- SSL configuration (if using nginx profile)
- S3 backup (optional)
- Redis configuration

Setup will save all configuration to `/opt/budget/.env`.

---

## Step 8: Deploy Application

Deploy the application to create admin user:

```bash
cd ~/familyBudget
sudo ./deploy.sh
```

**Watch for admin user creation output:**

```
━━━ Creating Admin User ━━━
[INFO] Checking if admin email/password configured...
[INFO] [ADMIN_USER] Creating admin user: admin@example.com
[INFO] [ADMIN_USER] Password validation passed (OWASP 2023 compliant)
[INFO] [ADMIN_USER] ✓ Admin user created successfully
[INFO] [ADMIN_USER] User ID: 1
[INFO] [ADMIN_USER] Email: admin@example.com
[INFO] [ADMIN_USER] is_admin: True
[INFO] [ADMIN_USER] is_active: True
[INFO] [ADMIN_USER] two_factor_enabled: False (admin bypasses 2FA)
[SUCCESS] Admin user creation completed
[INFO] Admin can now login via:
[INFO]   - Telegram OAuth (ADMIN_TELEGRAM_ID)
[INFO]   - Email + Password (ADMIN_EMAIL) - bypasses 2FA
```

**If admin creation skipped:**
```
[WARNING] Admin user creation skipped or failed
[INFO] This is not critical - admin can still use Telegram authentication
[INFO] Check logs above for details
```

---

## Step 9: First Login (Email + Password)

Navigate to login page:

```
https://your-domain.com/auth/login-email
```

Or for local testing:
```
http://localhost:8000/auth/login-email
```

**Login credentials:**
- Email: `admin@example.com`
- Password: `Xy5!a7bF3cG9hJ2kP8qR4tU6` (your auto-generated password)

**Expected behavior:**
1. Enter email and password
2. Click "Войти" (Login)
3. **No 2FA prompt** (admin bypass)
4. Redirected to dashboard immediately

**Browser console (DevTools → Console):**
```
[AUTH_EMAIL] Login attempt: admin@example.com
[AUTH_EMAIL] Admin bypass detected - JWT tokens received
[AUTH_EMAIL] Redirecting to dashboard (2FA skipped)
```

---

## Step 10: Verify Admin Access

After successful login, verify admin privileges:

**Dashboard indicators:**
- [ ] Admin menu visible (if implemented)
- [ ] Access to `/admin` routes
- [ ] User profile shows `is_admin: true`

**Database verification:**
```bash
docker compose exec postgres psql -U familybudget -d familybudget -c \
  "SELECT id, email, is_admin, is_active, two_factor_enabled FROM t_d_user WHERE email='admin@example.com';"
```

**Expected output:**
```
 id |       email        | is_admin | is_active | two_factor_enabled
----+--------------------+----------+-----------+--------------------
  1 | admin@example.com  | t        | t         | f
```

---

## Optional: Change Password

Although not required, you may change the auto-generated password:

### Via Web UI (Recommended)

1. Login as admin
2. Navigate to **Security Settings** (`/security`)
3. Click **Change Password**
4. Enter:
   - Current password (auto-generated)
   - New password (must meet OWASP 2023 requirements)
   - Confirm new password
5. Click **Update Password**

### Via Database (Advanced)

```bash
# Generate new password hash
docker compose exec backend python3 -c "
from backend.app.services.password_service import hash_password
print(hash_password('YourNewPassword123!'))
"

# Update database
docker compose exec postgres psql -U familybudget -d familybudget -c \
  "UPDATE t_d_user SET password_hash='$argon2id$...' WHERE email='admin@example.com';"
```

---

## Troubleshooting

### Issue: Admin email prompt not showing during setup.sh

**Cause:** Using old version of `setup.sh`

**Solution:**
```bash
cd ~/familyBudget
git pull origin main
sudo ./setup.sh  # Re-run setup
```

### Issue: Admin user not created during deploy.sh

**Cause:** `ADMIN_EMAIL` or `ADMIN_PASSWORD` not set in `.env`

**Solution:**
```bash
# Check .env file
cat /opt/budget/.env | grep ADMIN_EMAIL
cat /opt/budget/.env | grep ADMIN_PASSWORD

# Manual admin creation
cd /opt/budget
docker compose exec -T backend python scripts/create_admin_user.py
```

### Issue: Admin login still requires 2FA

**Cause:** `two_factor_enabled=true` in database

**Solution:**
```bash
# Check database
docker compose exec postgres psql -U familybudget -d familybudget -c \
  "SELECT two_factor_enabled FROM t_d_user WHERE email='admin@example.com';"

# Fix if needed
docker compose exec postgres psql -U familybudget -d familybudget -c \
  "UPDATE t_d_user SET two_factor_enabled=false WHERE email='admin@example.com';"
```

### Issue: Password validation fails

**Cause:** Custom password doesn't meet OWASP 2023 requirements

**Solution:**
Use auto-generated password OR ensure custom password has:
- Minimum 12 characters
- At least one uppercase letter (A-Z)
- At least one lowercase letter (a-z)
- At least one digit (0-9)
- At least one special character (!@#$%^&*...)
- Not in common passwords list

**Test password strength:**
```bash
docker compose exec backend python3 -c "
from backend.app.services.password_service import validate_password_strength
is_valid, error = validate_password_strength('YourPassword123!')
print(f'Valid: {is_valid}')
if not is_valid:
    print(f'Error: {error}')
"
```

### Issue: Forgot admin password

**Solution 1: Check .env file** (if not changed)
```bash
cat /opt/budget/.env | grep ADMIN_PASSWORD
```

**Solution 2: Generate new password and update**
```bash
# Generate new password
cd ~/familyBudget
source scripts/lib/utils.sh
generate_admin_password

# Update .env
sudo nano /opt/budget/.env
# Change ADMIN_PASSWORD= line

# Re-run admin creation script
cd /opt/budget
docker compose exec -T backend python scripts/create_admin_user.py
```

### Issue: Admin login logs show errors

**Solution:** Check backend logs
```bash
docker compose logs backend | grep "\[AUTH_EMAIL\]"
docker compose logs backend | grep "\[ADMIN_USER\]"
```

Common errors:
- `Invalid email or password` → Check credentials
- `Account pending activation` → User `is_active=false` in DB
- `Password validation failed` → Password doesn't meet requirements

---

## Security Best Practices

### DO ✅

- Use auto-generated 24-character password
- Store password in password manager
- Enable Telegram OAuth as primary method
- Monitor authentication logs regularly
- Restrict admin email login to trusted networks (future)
- Consider voluntary 2FA for admin (bypass remains as fallback)

### DON'T ❌

- Share admin password with team members
- Store password in plain text
- Use weak or common passwords
- Disable logging for admin logins
- Forget to save auto-generated password

---

## Next Steps

After successful admin setup:

1. **Test Telegram OAuth** (if configured)
   - Navigate to `/auth/telegram-login`
   - Click "Login with Telegram"
   - Verify both auth methods work

2. **Review authentication logs**
   ```bash
   docker compose logs backend | grep "\[AUTH_EMAIL\]" | tail -20
   ```

3. **Read comprehensive authentication docs**
   - [authentication.md](../core/authentication.md) - Complete architecture
   - [CLAUDE.md](../../CLAUDE.md) - Developer guide

4. **Configure monitoring** (optional)
   - Set up email alerts for admin logins
   - Monitor failed login attempts
   - Track IP addresses for admin access

---

## Related Documentation

- [Authentication Architecture](../core/authentication.md) - Complete authentication system
- [CLAUDE.md](../../CLAUDE.md) - Developer documentation
- [START.md](../../START.md) - Installation guide
