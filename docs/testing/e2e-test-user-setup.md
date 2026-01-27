# E2E Test User Setup Guide

This guide explains how to create a test user for Playwright E2E tests.

---

## Prerequisites

- Access to Family Budget production instance (`https://fbd.ikeniborn.ru`)
- Administrator permissions (for user creation)

---

## Option 1: Manual Registration via UI (Recommended)

### Step 1: Register Test User

1. Open `https://fbd.ikeniborn.ru/register` in browser
2. Fill registration form:
   - **Email:** `e2e-test@example.com` (or your test email)
   - **Password:** `E2eTestPassword123!` (strong password required)
   - **Display Name:** `E2E Test User`
3. Click "Зарегистрироваться" (Register)
4. Verify email if required

### Step 2: Save Credentials

Save credentials to `.env.test` (local, not in git):

```bash
# Create .env.test in project root
cat > .env.test << 'EOF'
TEST_USER_EMAIL=e2e-test@example.com
TEST_USER_PASSWORD=E2eTestPassword123!
EOF

# Secure the file
chmod 600 .env.test
```

**Important:** `.env.test` is excluded from git via `.gitignore`.

---

## Option 2: API Registration via curl

### Step 1: Register via API

```bash
curl -X POST https://fbd.ikeniborn.ru/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "e2e-test@example.com",
    "password": "E2eTestPassword123!",
    "display_name": "E2E Test User"
  }'
```

**Response (success):**
```json
{
  "message": "Registration successful. Please check your email to verify your account.",
  "user_id": 123
}
```

### Step 2: Verify Email (if enabled)

Check email inbox and click verification link, or ask administrator to mark user as verified.

---

## Option 3: Admin Panel (If Available)

1. Login as administrator
2. Navigate to Users management
3. Create new user:
   - Email: `e2e-test@example.com`
   - Password: `E2eTestPassword123!`
   - Role: Regular user
4. Save credentials to `.env.test` (see Option 1, Step 2)

---

## GitHub Secrets Setup (For CI/CD)

After creating test user locally, add credentials to GitHub repository:

### Step 1: Navigate to Repository Settings

1. Open https://github.com/YOUR_USERNAME/familyBudget
2. Go to **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**

### Step 2: Add Secrets

Create 2 secrets:

**Secret 1: TEST_USER_EMAIL**
- Name: `TEST_USER_EMAIL`
- Value: `e2e-test@example.com`
- Click "Add secret"

**Secret 2: TEST_USER_PASSWORD**
- Name: `TEST_USER_PASSWORD`
- Value: `E2eTestPassword123!`
- Click "Add secret"

### Step 3: Verify Secrets

Secrets should appear in the list:
- ✅ `TEST_USER_EMAIL`
- ✅ `TEST_USER_PASSWORD`

These secrets are now available to GitHub Actions workflows.

---

## Verify Test User

Test login manually before running E2E tests:

```bash
# Test login via API
curl -X POST https://fbd.ikeniborn.ru/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "e2e-test@example.com",
    "password": "E2eTestPassword123!"
  }'
```

**Expected response:**
```json
{
  "access_token": "eyJ...",
  "token_type": "bearer",
  "user": {
    "id": 123,
    "email": "e2e-test@example.com",
    "display_name": "E2E Test User"
  }
}
```

If login fails, check:
- Password strength requirements met?
- Email verified (if verification enabled)?
- User account not locked/disabled?

---

## Security Considerations

### Test User Isolation

**Best Practices:**
- Use dedicated test email (not personal email)
- Use strong password (min 8 chars, uppercase, lowercase, numbers, special chars)
- Do not use production/personal data in test user account
- Regularly rotate test user password

### Credentials Storage

**Local Development:**
- Store in `.env.test` (excluded from git)
- Use `chmod 600 .env.test` (owner-only read/write)

**CI/CD (GitHub Actions):**
- Use GitHub Secrets (encrypted at rest)
- Never commit credentials to repository
- Use different credentials for staging/production

### Rate Limiting

Registration endpoint has rate limit: **3 attempts per hour**

If you exceed limit:
- Wait 1 hour before retrying
- Or ask administrator to create user manually

---

## Troubleshooting

### Issue: "Email already in use"

**Solution:** User already exists. Skip registration and use existing credentials.

### Issue: "Password too weak"

**Requirements:**
- Minimum 8 characters
- At least 1 uppercase letter
- At least 1 lowercase letter
- At least 1 number
- At least 1 special character (!@#$%^&*()_+-=[]{}|;:,.<>?)

**Example strong password:** `E2eTestPassword123!`

### Issue: "Registration failed"

**Possible causes:**
- Email validation error (invalid format)
- Rate limit exceeded (wait 1 hour)
- Server error (check backend logs)

**Solution:** Check error message details and retry with valid data.

### Issue: Login fails in E2E tests

**Debug steps:**
1. Verify credentials in `.env.test` are correct
2. Test login manually via curl (see "Verify Test User" section)
3. Check Playwright test output for error details
4. Enable `--headed` mode to see browser UI: `npx playwright test --headed`

---

## Next Steps

After creating test user and saving credentials:

1. ✅ Test user created
2. ✅ Credentials saved to `.env.test` (local)
3. ✅ GitHub Secrets configured (CI/CD)
4. ▶️ Run E2E tests: `npm run test:e2e`

**See also:**
- `tests/e2e/webapp/test_mobile_navigation.spec.ts` - Mobile navigation tests
- `docs/architecture/guides/browser-testing-workarounds.md` - Playwright setup
- `playwright.config.ts` - Test configuration

---

**Last Updated:** 2026-01-27
