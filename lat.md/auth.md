# Authentication

Three auth methods supported: Telegram OAuth (primary), Email+Password, WebAuthn biometrics. All issue JWT access + refresh tokens.

## Telegram OAuth

Primary auth flow. User authenticates via Telegram Widget or Telegram Web App. Backend validates HMAC signature of Telegram auth data using bot token. Only pre-registered users (admin-created) can log in — no self-registration.

Handler: `backend/app/services/telegram_auth.py`. Security invariant: `get_user_by_telegram_id()` only retrieves existing users; it never creates them.

## Email + Password

Secondary method for users who added an email to their Telegram account. Passwords hashed with bcrypt. Dummy verification on unknown email to prevent timing attacks.

Service: `backend/app/services/auth_service.py`, `backend/app/services/password_service.py`.

## WebAuthn (Biometrics)

FIDO2/WebAuthn for passwordless login via device biometrics or security keys. Registration stores credential in `t_d_webauthn_credential`. Audit log in `t_d_webauthn_audit_log`.

Service: `backend/app/services/webauthn_service.py`. Endpoint: `api/v1/endpoints/webauthn.py`.

## Two-Factor Authentication (TOTP)

Optional TOTP 2FA on top of email+password. Session-based: after password auth, a `TwoFactorSession` token is issued; full JWT requires TOTP confirmation. Service: `backend/app/services/totp_service.py`.

## JWT Tokens

Access token (short-lived) + refresh token (long-lived, stored in `t_d_refresh_token`). Refresh endpoint: `api/v1/endpoints/auth_refresh.py`. Token validation: `backend/app/services/jwt.py`.

Claims include `user_id`, `telegram_id`, `roles`. Middleware (`backend/app/middleware/`) validates token on every request.

## Webapp Auth

Telegram Web App authentication flow for bot mini-apps. Validates `initData` from Telegram WebApp JS SDK. Service: `backend/app/services/webapp_auth.py`.

## User Consent

GDPR-style consent tracking. Users must accept terms before accessing the system. Model: `backend/app/models/user_consent.py`.
