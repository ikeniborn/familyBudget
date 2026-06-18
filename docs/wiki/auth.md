# Authentication

Family Budget supports four login methods (Telegram OAuth, email+password+2FA, WebAuthn biometrics, Telegram Mini App) plus JWT sessions, refresh-token rotation, GDPR consent records, and an internal service key. See [[architecture]] and [[api#Auth & Identity Endpoints]].

## User Model & Auth Methods

The `User` model (SCD Type 1, table `t_d_user`) holds all credentials and a `CheckConstraint` requiring at least one of `telegram_id` or `email`. Profile changes are in-place; history lives in `UserHistory` ([[database]]).

- File: `backend/app/models/user.py:24`
- Three method combinations: Telegram-only, email-only, or both linked (`backend/app/models/user.py:38`).
- Credential fields: `password_hash` (Argon2), `two_factor_secret`, `two_factor_enabled`, `backup_codes` (JSON of hashed codes); these are deliberately NOT mirrored into history (`user.py:279`).
- Status flags: `is_admin`, `is_active` (admin must activate new accounts). `merged_into_user_id` supports account merge.
- Email is unique via partial index `ix_t_d_user_email_unique` (only non-null), looked up case-insensitively.

## JWT Tokens

JWT is issued with HS256 using `settings.JWT_SECRET`. Access tokens carry both `user_id` (legacy) and `telegram_id` (SCD-stable business key); decoding prefers `telegram_id`, falling back to `user_id`. See `backend/app/services/jwt.py`.

- `create_access_token(user_id, telegram_id)` — exp = `JWT_EXPIRE_DAYS` (docs: 7 days); claims `user_id`, `telegram_id`, `exp`, `iat` (`jwt.py:45`).
- `decode_access_token` returns telegram_id-or-user_id; `decode_access_token_full` returns `(user_id, telegram_id)` used by middleware (`jwt.py:195`).
- WebSocket tokens: `create_ws_token`/`decode_ws_token`, 5-minute TTL, `type: "ws"` claim, `sub`=user_id — see [[realtime#WebSocket Endpoint & Token Handshake]] (`jwt.py:91`).
- Tokens are delivered in httpOnly cookies (`access_token`, `refresh_token`) and also in the response body for bot clients.

## JWT Middleware

`JWTAuthMiddleware` extracts a token from the `access_token` cookie or `Authorization: Bearer` header on every request, validates it, and injects `request.state.user_id` / `request.state.telegram_id`. Public paths are whitelisted; protected paths without a valid token get a type-aware 401.

- File: `backend/app/middleware/jwt_middleware.py:30`
- Token extraction: cookie first, then Bearer header (`jwt_middleware.py:251`).
- Public exact paths and prefixes (`/api/v1/auth/`, `/static/`, `/webapp/`, WebAuthn auth endpoints, email/2FA pages) at `jwt_middleware.py:48`.
- 401 dispatch by client type: HTMX → 401 + `HX-Redirect`; API (JSON/Authorization) → JSON 401; browser → 303 redirect to `/api/v1/auth/telegram-login` (`jwt_middleware.py:174`).
- It always tries to decode the token even on public paths, so `CurrentUserOptional` pages can read the user.

## Auth Dependencies

FastAPI dependencies in `backend/app/core/auth.py` turn `request.state.user_id` into a loaded `User`, enforcing active-account and admin checks. Type aliases `CurrentUser`, `CurrentAdmin`, `CurrentUserOptional` are used across endpoints ([[api#Common Dependencies]]).

- `get_current_user` → 401 if no `user_id`, 404 if user deleted, 403 if `is_active` is False (`core/auth.py:25`).
- `get_current_admin` → 403 unless `is_admin` (`core/auth.py:101`).
- `get_current_user_optional` → returns `None` instead of raising, for public pages (`core/auth.py:142`).

## Password Hashing

Passwords use Argon2id (OWASP params: time_cost=3, memory_cost=64 MB, parallelism=4) with timing-safe verification. A constant dummy hash is verified when the user is absent to prevent email enumeration. See `backend/app/services/password_service.py`.

- `hash_password`, `verify_password`, `verify_password_with_dummy` (`password_service.py:55`).
- `needs_rehash` supports transparent parameter upgrades; not currently called in the login path.
- `validate_password_strength` requires 12–128 chars with upper/lower/digit/special and blocks a top-100 common-password list (`password_service.py:159`). Error messages are Russian.

## Telegram OAuth Login

Telegram Login Widget data is validated by HMAC-SHA256 where `secret_key = SHA256(bot_token)`, compared with `hmac.compare_digest`, then `auth_date` is checked (<5 min) after the hash to avoid a timing oracle. See `backend/app/services/telegram_auth.py:313` and endpoints in `backend/app/api/v1/endpoints/auth.py`.

- `validate_telegram_auth(data)` builds a sorted `key=value` check string excluding `hash` (`telegram_auth.py:313`). `AUTH_DATE_EXPIRATION = 300`.
- `GET /auth/telegram-callback` (widget redirect): validates hash, **auto-creates** the user (admin auto-activated, others inactive), updates profile/avatar, issues tokens, sets cookies, returns `auth_redirect.html` (`auth.py:211`). Rate limited 10/min.
- `POST /auth/telegram` (API/bot): validates hash but does **not** auto-create — unknown users get 403; returns tokens in body + cookies (`auth.py:430`). Rate limited 10/min.
- Helpers `get_bot_username`, `validate_telegram_user`, `fetch_telegram_user_info` call the Bot API (getMe/getChat/getFile) for admin user creation.

## Email + Password Login

Email login is two-phase: `POST /auth/login` verifies the password (timing-safe) and starts a 5-minute 2FA session; `POST /auth/verify-2fa` validates the TOTP/backup code and issues JWTs. Admins bypass 2FA and get tokens immediately. See `backend/app/api/v1/endpoints/auth.py:985`.

- `POST /auth/register` — creates an email-only user, `is_active=False`, validates strength; rate limit 3/hour (`auth.py:917`). Generic error on duplicate email (anti-enumeration).
- `POST /auth/login` — returns `EmailLoginResponse` with `requires_2fa` or `requires_2fa_setup` + `session_token`; admins instead get `AuthResponse` with tokens (`auth.py:985`). Rate limit 5/min.
- Inactive users get 403; invalid credentials get 401 (logged with hashed email).
- `add_email_to_user`, `set_user_password`, `link_telegram_to_user` in `backend/app/services/auth_service.py` back `/auth/add-email`, `/auth/set-password`, `/auth/link-telegram`.

## Two-Factor Authentication (TOTP)

2FA uses RFC-6238 TOTP (6 digits, 30s step, ±1 window) via `pyotp`, plus 8 single-use backup codes (Argon2-hashed, stored as JSON). Required for non-admin email login. See `backend/app/services/totp_service.py`.

- `generate_secret`, `get_totp_uri` (issuer "Family Budget"), `verify_totp`, `generate_backup_codes`, `verify_backup_code` (consumes the matched code) (`totp_service.py:57`).
- Login-time setup: `POST /auth/setup-and-verify-2fa` enables 2FA and completes login, returning backup codes once (`auth.py:1304`).
- Authenticated management: `POST /auth/setup-2fa` (needs email+password set), `POST /auth/verify-2fa-setup`, `POST /auth/disable-2fa` (password+TOTP), `POST /auth/backup-codes` (regenerate) (`auth.py:1441`+).

## Two-Factor Session

`TwoFactorSession` (table `t_2fa_session`) bridges password verification and TOTP entry. The token is returned plaintext to the client and stored only as a SHA-256 hash, with a 5-minute TTL and single-use `used` flag. See `backend/app/services/two_factor_session_service.py` and `backend/app/models/two_factor_session.py`.

- `create_session` (token = `secrets.token_urlsafe(32)`), `verify_session` (checks not used / not expired), `consume_session` (marks used) (`two_factor_session_service.py:66`).
- `cleanup_expired_sessions` deletes expired/used rows; `invalidate_user_sessions` revokes on password change/2FA disable.
- Model `is_valid()` at `models/two_factor_session.py:143`; index `ix_t_2fa_session_expires_at` for cleanup.

## WebAuthn Biometrics

WebAuthn (passkeys / TouchID / FaceID / Windows Hello) provides registration and authentication ceremonies. Challenges are single-use with a 10-minute TTL; platform authenticators with required user verification (ES256/RS256) are enforced. See `backend/app/services/webauthn_service.py` and `backend/app/api/v1/endpoints/webauthn.py`.

- RP config: `WEBAUTHN_RP_ID`, `WEBAUTHN_RP_NAME`, `WEBAUTHN_ORIGIN`. Registration uses `AuthenticatorAttachment.PLATFORM`, `resident_key=DISCOURAGED`, `user_verification=REQUIRED` (`webauthn_service.py:142`).
- Registration: `POST /webauthn/register/options` (auth required) → `create_registration_challenge`; `POST /webauthn/register/verify` → `verify_and_store_credential` (attestation check, duplicate-credential guard, challenge consume) (`webauthn_service.py:73`, `:170`).
- Authentication (public, identifier-first): `POST /webauthn/authenticate/options` → `create_authentication_challenge` (looks up user by email/username, lists active creds); `POST /webauthn/authenticate/verify` → `verify_authentication_and_issue_tokens` returning `(User, access, refresh)` (`webauthn_service.py:319`, `:439`).
- Credential management: `GET /webauthn/credentials`, `DELETE /webauthn/credentials/{credential_id}` (requires password OR TOTP confirmation) (`webauthn.py:449`, `:500`).
- Onboarding check: `GET /auth/webauthn-status`; method discovery: `GET /auth/methods` (`auth.py:1993`, `:1904`).

### WebAuthn Challenges, Credentials, Audit

Challenges, stored credentials, and an immutable audit log are persisted across three tables. Challenge validation (`_validate_challenge`) checks existence, type, expiry, consumption, and ownership. See [[database]].

- `WebAuthnChallenge` (`t_f_webauthn_challenge`): `challenge` (Base64URL), `challenge_type` in {registration, authentication}, `expires_at`, `consumed_at`, IP/UA. Hourly cleanup. `models/webauthn_challenge.py:42`.
- `WebAuthnCredential` (`t_d_webauthn_credential`): `credential_id` (Base64URL, unique), `public_key` (CBOR/COSE BYTEA), `sign_count`, `transports`, `aaguid`, `device_name`, `backup_eligible`/`backup_state`, soft-delete `is_revoked`/`revoked_at`. `models/webauthn_credential.py:32`.
- `WebAuthnAuditLog` (`t_f_webauthn_audit_log`): event types registration_success/failure, authentication_success/failure, credential_revoked, credential_compromised; `user_id` SET NULL on delete to retain history. `models/webauthn_audit_log.py:34`.

### Cloned-Credential Detection

During authentication, a sign-count regression (`new_sign_count > 0 and <= stored`) is treated as a cloned authenticator: the credential is auto-revoked, two audit rows are written, and a `credential_compromised` event is broadcast over WebSocket. See `backend/app/services/webauthn_service.py:566` and [[realtime]].

## Refresh-Token Rotation

Refresh tokens are 30-day HS256 JWTs (`token_type: "refresh"`) issued alongside access tokens and stored in the database only as a SHA-256 hash. `POST /auth/refresh` validates the JWT, looks up the hash, checks revocation/expiry, then rotates: the old row is revoked and a new token is issued. See `backend/app/api/v1/endpoints/auth.py:658`.

- `create_refresh_token(user_id)` → `(token, expires_at)`; `decode_refresh_token` enforces `token_type == "refresh"`; `hash_token` = SHA-256 hex (`backend/app/services/jwt.py:238`).
- The `RefreshToken` row (created as `RefreshToken(user_id=, token_hash=, expires_at=)`) exposes `is_valid()`, `revoke()`, `mark_used()`, and `is_revoked` (used in `auth.py`, `webauthn.py`).
- `POST /auth/logout` revokes the stored refresh token and clears both cookies (`auth.py:836`).
- Note: `backend/app/api/v1/endpoints/auth_refresh.py` is a legacy duplicate `/auth/refresh` referencing `verify_refresh_token` and a `RefreshToken.token` column not present in the active `jwt.py`/model; the live implementation is in `auth.py`.

## Internal Service Auth

Bot-to-backend calls authenticate with a static shared key via the `X-Api-Key` header, compared against `settings.API_INTERNAL_KEY`. Endpoints opt in with the `InternalAPIKey` dependency. See `backend/app/core/internal_auth.py` and [[bot]].

- `verify_internal_api_key` raises 401 on missing or mismatched key (`internal_auth.py:14`).

## Consent Records (GDPR)

`UserConsent` (table `t_user_consent`) is an append-only log of consent grants/withdrawals with IP, user agent, and privacy-policy version kept as legal proof. Current state = latest row per `(user_id, consent_type)`. See `backend/app/api/v1/endpoints/consent.py` and `backend/app/models/user_consent.py`.

- Consent types: `essential` (cannot be denied/withdrawn — forced True), `analytics`, `push_notifications`, `personalization` (`user_consent.py:165`).
- `GET /consent/status` (optional auth), `POST /consent` (auth, records each item), `POST /consent/withdraw/{consent_type}` (auth, writes `consent_given=False`) (`consent.py:61`+).
- Schemas: `ConsentCreate`, `ConsentItem`, `ConsentStatusResponse`, `ConsentRecordResponse` (`backend/app/schemas/consent.py`).

## Telegram Mini App Auth

Telegram Web Apps `initData` is validated separately from the Login Widget: `secret_key = HMAC-SHA256("WebAppData", bot_token)`, hash compared timing-safely, then `auth_date` checked (<1 hour). See `backend/app/services/webapp_auth.py` and [[frontend#Telegram Web App Pages]].

- `validate_webapp_initdata(init_data)` parses the query string, recomputes the hash, and returns `(is_valid, user_data)` (`webapp_auth.py:31`). `AUTH_DATE_EXPIRATION = 3600`.
- `extract_user_from_initdata` normalizes the user object (no `photo_url` in initData) (`webapp_auth.py:124`).
- The `/api/v1/webapp/validate` prefix is whitelisted (no JWT required) in the middleware.
