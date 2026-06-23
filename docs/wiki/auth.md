# Authentication

Family Budget supports three sign-in methods — Telegram OAuth, Email + Password (with mandatory TOTP 2FA for non-admins), and WebAuthn biometrics — all of which converge on a single JWT access/refresh token pair carried in `httpOnly` cookies. A JWT middleware authenticates every request, FastAPI dependencies load the user, and per-user data isolation guarantees each user sees only their own records. Bot-to-backend traffic uses a separate shared-secret API key. This page documents the real flows in `backend/app/services/`, `backend/app/core/`, `backend/app/middleware/`, and the endpoints exposed under `/api/v1/auth/*` and `/api/v1/webauthn/*` (see [[api]] for the route catalogue).

Users are never auto-created on login. `get_user_by_telegram_id` only retrieves existing rows — accounts are provisioned by an admin and start with `is_active=False` (pending activation). The `User` model (`backend/app/models/user.py`, table `t_d_user`) requires at least one auth method via the `chk_user_has_auth_method` check constraint (`telegram_id IS NOT NULL OR email IS NOT NULL`); see [[database]] for the full schema and SCD history.

## Telegram OAuth

Telegram Login Widget authentication validated via HMAC-SHA256, implemented in `backend/app/services/telegram_auth.py` and exposed at `POST /api/v1/auth/telegram`. Validation rejects any payload whose hash or freshness check fails before a user is ever loaded.

`validate_telegram_auth(data)` follows Telegram's official algorithm: build a `data_check_string` from sorted `key=value` pairs (excluding `hash`), derive `secret_key = SHA256(bot_token)`, compute `HMAC-SHA256(secret_key, data_check_string)`, and compare against the received hash with `hmac.compare_digest` (timing-safe). Only after the hash passes does it check `auth_date` freshness — `AUTH_DATE_EXPIRATION = 300` seconds (5 minutes, stricter than Telegram's default) to block replay of captured callback URLs.

The `POST /api/v1/auth/telegram` endpoint (`backend/app/api/v1/endpoints/auth.py`) is rate-limited to 10/minute. On success it loads the existing user (403 if not registered), caches the avatar, applies any profile changes through `user_service.update_user_profile` (SCD history, change type `LOGIN`), updates `last_login_at`, then issues access + refresh tokens. Tokens are returned in **both** the response body (for the [[bot]] client) and `httpOnly` cookies (for the web client). The module also offers `validate_telegram_user` and `fetch_telegram_user_info` (Bot API `getChat`) used by the admin user-creation workflow.

Telegram **Web App** initData (Mini Apps) uses a different validation path — `backend/app/services/webapp_auth.py`, `validate_webapp_initdata`. The key difference: `secret_key = HMAC-SHA256("WebAppData", bot_token)` (not `SHA256(bot_token)`), and the freshness window is 1 hour (`AUTH_DATE_EXPIRATION = 3600`). It returns the parsed user dict on success.

## Email & Password

Email/password authentication backed by Argon2id hashing, with timing-attack resistance and a mandatory 2FA bridge for non-admin users. Implemented in `backend/app/services/auth_service.py` and `backend/app/services/password_service.py`, exposed at `POST /api/v1/auth/register` and `POST /api/v1/auth/login-email`.

Passwords are hashed with Argon2id (`password_service.hash_password`) using OWASP-recommended parameters (`time_cost=3`, `memory_cost=65536` / 64 MB, `parallelism=4`, `hash_len=32`, `salt_len=16`). `verify_password_with_dummy` always runs a hash operation — even when no user exists, it verifies against a constant `DUMMY_HASH` — so response timing cannot reveal whether an email is registered. `validate_password_strength` enforces 12–128 chars, upper/lower/digit/special character classes, and rejects a top-100 common-passwords list. Emails are stored and looked up lowercased.

`authenticate_with_password(session, email, password)` returns the user only on a valid match (`None` otherwise). The `login-email` endpoint then branches:

- **Admin users bypass 2FA** — tokens are issued directly and set in cookies.
- **Regular users** receive a short-lived 2FA session token (see [[auth#Two-Factor (TOTP)]]) and an `EmailLoginResponse`. If `two_factor_enabled` is false, the response carries `requires_2fa_setup=True` plus a freshly generated TOTP secret and `otpauth://` URI for first-time enrollment; otherwise `requires_2fa=True`.

Inactive accounts (`is_active=False`) are rejected with 403. Accounts can be linked: `add_email_to_user` adds an email to a Telegram account, and `link_telegram_to_user` adds Telegram to an email account (both reject collisions). `set_user_password` re-hashes with Argon2.

## WebAuthn Biometrics

Passwordless biometric login (TouchID/FaceID/platform authenticators) using the `webauthn` library, implemented in `backend/app/services/webauthn_service.py` and exposed under `/api/v1/webauthn/*`. Challenges are single-use with a 10-minute TTL; every event is written to an immutable audit log.

Registration requires an authenticated user (JWT). `POST /api/v1/webauthn/register/options` calls `create_registration_challenge`, which stores a 32-byte challenge (`WebAuthnChallenge`, table `t_f_webauthn_challenge`) and returns `PublicKeyCredentialCreationOptions`. Options require `PLATFORM` authenticators, `UserVerificationRequirement.REQUIRED` (biometric/PIN), `ResidentKeyRequirement.DISCOURAGED`, and ES256/RS256 algorithms. `POST /api/v1/webauthn/register/verify` runs `verify_and_store_credential`: it validates the challenge (existence, type, expiry, consumption, ownership), verifies the attestation against `WEBAUTHN_RP_ID` / `WEBAUTHN_ORIGIN`, rejects duplicate credential IDs, then stores a `WebAuthnCredential` (table `t_d_webauthn_credential`) with the Base64URL credential ID, CBOR-encoded COSE public key, `sign_count`, transports, AAGUID, and passkey backup flags.

Authentication is identifier-first and **public** (whitelisted in middleware). `POST /api/v1/webauthn/authenticate/options` (`create_authentication_challenge`) looks the user up by email or username, lists their active (non-revoked) credentials, and returns request options. `POST /api/v1/webauthn/authenticate/verify` (`verify_authentication_and_issue_tokens`) validates the challenge, loads the credential, asserts `credential.user_id == challenge.user_id`, and verifies the assertion signature. Its critical defense is **sign-count regression detection**: if the new sign count is not greater than the stored count, the credential is treated as cloned — it is auto-revoked, two audit events (`authentication_failure`, `credential_compromised`) are logged, a `credential_compromised` event is broadcast over WebSocket (see [[realtime]]), and the login fails. On success it updates `sign_count` + `last_used_at`, consumes the challenge, logs `authentication_success`, and issues access + refresh tokens.

`list_credentials` and `revoke_credential` (soft delete via `is_revoked`) manage enrolled devices. All events land in `WebAuthnAuditLog` (table `t_f_webauthn_audit_log`), retained even after user deletion (`user_id` set NULL).

## JWT Tokens & Refresh

Two HS256 JWTs underpin every authenticated session: a 7-day access token and a 30-day refresh token, both stored in `httpOnly`, `Secure`, `SameSite=Lax` cookies. Token logic lives in `backend/app/services/jwt.py`; refresh tokens are persisted as SHA-256 hashes in `RefreshToken` (table `t_refresh_token`, see [[database]]).

`create_access_token(user_id, telegram_id)` embeds both `user_id` (legacy) and `telegram_id` (the stable business key, safe across SCD profile changes) plus `exp`/`iat`. `decode_access_token_full` returns `(user_id, telegram_id)` and is what the middleware uses — `user_id` is always present, `telegram_id` is `None` for email-only users. `create_refresh_token(user_id)` adds a `token_type="refresh"` claim and a 30-day expiry; `decode_refresh_token` rejects tokens lacking that claim. The raw refresh token is only ever in the client cookie — the database stores `hash_token(token)` (SHA-256) so a DB leak cannot reproduce valid tokens.

There is also a 5-minute, `type=ws` WebSocket token (`create_ws_token` / `decode_ws_token`) used for the WebSocket handshake where the token rides in the URL query string (see [[realtime]]).

`POST /api/v1/auth/refresh` performs **rotation**: it decodes the cookie token, looks up the matching hash in `RefreshToken`, checks not-revoked / not-expired, issues a fresh access + refresh pair, revokes the old refresh row, and re-sets both cookies. `POST /api/v1/auth/logout` revokes the refresh token in the database and clears both cookies. (A simpler standalone `POST /auth/refresh` also exists in `backend/app/api/v1/endpoints/auth_refresh.py`.)

## Two-Factor (TOTP)

Mandatory TOTP-based 2FA for non-admin email logins (RFC 6238, compatible with Google Authenticator / Authy), bridged by a short-lived server session between password and code entry. TOTP logic is in `backend/app/services/totp_service.py`; the session bridge in `backend/app/services/two_factor_session_service.py`.

`generate_secret()` produces a Base32 secret; `get_totp_uri(secret, email)` builds the `otpauth://` URI for the QR code (issuer "Family Budget"). `verify_totp(secret, code)` accepts 6-digit codes with a ±1 period (±30 s) window for clock drift. Recovery uses `generate_backup_codes()` — 8 codes shown once, each Argon2-hashed and stored as JSON on `User.backup_codes`; `verify_backup_code` consumes (deletes) a code on match. The TOTP secret and backup codes are deliberately **excluded** from SCD user history for security.

The 2FA session bridges the two login steps. After password verification, `create_session(session, user_id)` mints a 256-bit `secrets.token_urlsafe` token, stores only its SHA-256 hash in `TwoFactorSession` (table `t_2fa_session`) with a 5-minute TTL and `used=False`, and returns the plain token to the client. `POST /api/v1/auth/verify-2fa` (rate-limited 5/minute) calls `verify_session` (exists, not expired, not used), checks the submitted TOTP or backup code, calls `consume_session` (single-use), and only then issues JWT tokens and cookies. `invalidate_user_sessions` voids all active sessions (e.g. on password change); `cleanup_expired_sessions` is a periodic GC job. First-time enrollment is handled by `POST /api/v1/auth/setup-and-verify-2fa`; management endpoints include `setup-2fa`, `verify-2fa-setup`, `disable-2fa`, and `regenerate-backup-codes`.

## Internal Service Auth

A separate shared-secret scheme authenticates bot-to-backend (and other internal) calls, independent of user JWTs. Implemented in `backend/app/core/internal_auth.py`.

`verify_internal_api_key` reads the `X-Api-Key` header and compares it to `settings.API_INTERNAL_KEY`, raising 401 if missing or mismatched. It is wired into endpoints as the `InternalAPIKey` dependency (`Annotated[None, Depends(verify_internal_api_key)]`). This lets the [[bot]] call backend endpoints without holding a user JWT, using only the configured shared secret.

## User Isolation

Per-user data isolation enforces "a user sees only their own rows" with admin bypass, implemented in `backend/app/core/user_isolation.py` (re-exported from `backend/app/core/dependencies.py`). The guiding rule is `WHERE user_id = current_user.id`.

`apply_user_filter(statement, user)` appends `WHERE user_id == user.id` to a SELECT unless `user.is_admin` (admins see everything). `can_access_resource(resource_user_id, current_user)` returns `True` for the owner or any admin; `ensure_user_owns_resource(...)` is the convenience wrapper that raises 403 otherwise. `get_user_id_for_create(current_user)` returns the owner ID to stamp on new rows — even admins create under their own `user_id`. Endpoints use `apply_user_filter` for list queries and `ensure_user_owns_resource` for single-object access (see [[api]] and the [[domain]] models that carry a `user_id`).

## Auth Middleware & Dependencies

`JWTAuthMiddleware` authenticates every request, while FastAPI dependencies turn the resulting `user_id` into a loaded `User`. The middleware is in `backend/app/middleware/jwt_middleware.py`; the dependencies in `backend/app/core/auth.py`.

The middleware (`dispatch`) always tries to extract a token — first the `access_token` cookie, then an `Authorization: Bearer` header — and on a valid token sets `request.state.user_id` and `request.state.telegram_id`. Public paths (exact set including `/health`, `/docs`, `/`, `/register`, `/login-email`, `/2fa-verify`, the WebAuthn authenticate endpoints, plus prefixes `/api/v1/auth/`, `/api/v1/webapp/validate`, `/static/`, `/shared/`, `/webapp/`) are allowed through without a token, so pages using `CurrentUserOptional` can still personalize when a cookie is present. Protected paths without a valid token get a request-type-aware 401: HTMX → 401 + `HX-Redirect`, JSON/API → JSON 401, browser → 303 redirect to `/api/v1/auth/telegram-login`.

Dependencies in `core/auth.py` load the user from `request.state.user_id`: `get_current_user` returns the active `User` (401 if no state user_id, 404 if deleted, 403 if `is_active=False`); `get_current_admin` additionally requires `is_admin` (403 otherwise); `get_current_user_optional` returns `User | None` for public pages. The `Annotated` aliases `CurrentUser`, `CurrentAdmin`, and `CurrentUserOptional` keep endpoint signatures terse.

## Consent (GDPR)

Append-only consent tracking for GDPR compliance, exposed under `/api/v1/consent`. Implemented in `backend/app/api/v1/endpoints/consent.py` over the `UserConsent` model (table `t_user_consent`).

Records are never updated or deleted — each grant or withdrawal is a new row capturing `consent_type`, `consent_given`, `privacy_policy_version`, plus `ip_address` and `user_agent` as legal proof. Valid types are `essential`, `analytics`, `push_notifications`, and `personalization` (`UserConsent.consent_types()`). `GET /status` returns the latest state per type for the current user (empty for anonymous); `POST ""` records choices (essential is forced to `True`); `POST /withdraw/{consent_type}` appends a `consent_given=False` row but refuses to withdraw `essential`. Pre-login consent can be tracked anonymously via `session_id` with a NULL `user_id`.
