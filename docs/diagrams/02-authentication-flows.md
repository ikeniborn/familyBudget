# Authentication Flows

**Type**: Sequence Diagrams
**Purpose**: Visual representation of all authentication methods in Family Budget
**Last Updated**: 2026-02-07

## Overview

Family Budget supports 4 authentication methods:
1. Telegram OAuth (HMAC-SHA256 validation)
2. Email + Password + 2FA (TOTP)
3. JWT Token Lifecycle (access + refresh rotation)
4. WebAuthn Biometric Authentication

---

## 1. Telegram OAuth Flow

```mermaid
sequenceDiagram
    participant User
    participant TelegramWidget as Telegram Widget
    participant Frontend as PWA Frontend
    participant API as FastAPI Backend
    participant TelegramAPI as Telegram API
    participant DB as PostgreSQL

    User->>TelegramWidget: Click "Login with Telegram"
    TelegramWidget->>TelegramAPI: Request OAuth
    TelegramAPI->>User: Redirect to Telegram app
    User->>TelegramAPI: Authorize app
    TelegramAPI->>TelegramWidget: Return auth data (hash, id, username)

    TelegramWidget->>Frontend: Callback with auth data
    Frontend->>API: POST /auth/telegram/callback<br>{hash, id, first_name, username, photo_url, auth_date}

    Note over API: Validate HMAC-SHA256<br>check_string = sorted key=value pairs<br>secret_key = SHA256(bot_token)<br>verify: hash == HMAC(check_string, secret_key)

    alt HMAC Valid & auth_date < 86400s
        API->>DB: SELECT user WHERE telegram_user_id = id
        alt User Exists
            DB->>API: Return user_id
        else New User
            API->>DB: INSERT INTO t_d_user (telegram_user_id, username, ...)
            DB->>API: Return new user_id
        end

        Note over API: Generate JWT tokens<br>access_token (7 days)<br>refresh_token (30 days)

        API->>DB: INSERT INTO user_sessions (refresh_token_hash, ...)
        API->>Frontend: 200 OK + Set-Cookie headers<br>httpOnly cookies (access_token, refresh_token)
        Frontend->>User: Redirect to dashboard (cookies auto-sent)
    else HMAC Invalid
        API->>Frontend: 401 Unauthorized<br>{error: "Invalid authentication data"}
        Frontend->>User: Show error message
    end
```

### Security Notes
- **HMAC Validation**: Prevents tampering with auth data
- **86400s Timeout**: Auth data expires after 24 hours
- **Secret Key**: Derived from bot token via SHA256
- **No Password**: Telegram handles user authentication

---

## 2. Email + Password + 2FA Flow

```mermaid
sequenceDiagram
    participant User
    participant Frontend as PWA Frontend
    participant API as FastAPI Backend
    participant DB as PostgreSQL
    participant TOTP as TOTP App

    User->>Frontend: Enter email + password
    Frontend->>API: POST /auth/login<br>{email, password}

    API->>DB: SELECT user WHERE email = ?
    DB->>API: Return user (hashed_password, totp_secret, totp_enabled)

    Note over API: Verify password<br>argon2id.verify(password, hashed_password)

    alt Password Valid
        alt 2FA Enabled
            API->>Frontend: 200 OK<br>{requires_2fa: true, temp_token}
            Frontend->>User: Show 2FA code input

            User->>TOTP: Open authenticator app
            TOTP->>User: Display 6-digit code
            User->>Frontend: Enter 2FA code

            Frontend->>API: POST /auth/verify-2fa<br>{temp_token, code}

            Note over API: Verify TOTP code<br>pyotp.TOTP(secret).verify(code, valid_window=1)

            alt 2FA Valid
                API->>DB: INSERT INTO user_sessions (refresh_token_hash, ...)
                Note over API: Generate JWT tokens
                API->>Frontend: 200 OK<br>{access_token, refresh_token, user}
            else 2FA Invalid
                API->>DB: UPDATE user SET failed_2fa_attempts + 1
                API->>Frontend: 401 Unauthorized<br>{error: "Invalid 2FA code", attempts_left}
            end
        else 2FA Disabled
            Note over API: Generate JWT tokens
            API->>DB: INSERT INTO user_sessions (refresh_token_hash, ...)
            API->>Frontend: 200 OK + Set-Cookie headers<br>httpOnly cookies (access_token, refresh_token)
        end

        Frontend->>User: Redirect to dashboard (cookies auto-sent)
    else Password Invalid
        API->>DB: UPDATE user SET failed_login_attempts + 1
        API->>Frontend: 401 Unauthorized<br>{error: "Invalid credentials", attempts_left}
    end
```

### Security Notes
- **Argon2id Hashing**: Password stored with memory-hard parameters (OWASP 2023)
- **TOTP (RFC 6238)**: Time-based one-time password with 30s window
- **Rate Limiting**: 5 failed attempts → 15min lockout
- **Backup Codes**: 10 single-use codes generated on 2FA setup

---

## 3. JWT Token Lifecycle

```mermaid
sequenceDiagram
    participant Frontend as PWA Frontend
    participant API as FastAPI Backend
    participant DB as PostgreSQL
    participant Redis

    Note over Frontend: User authenticated<br>access_token expires in 15min

    Frontend->>API: GET /api/budget/facts<br>Authorization: Bearer {access_token}

    API->>API: Decode JWT token

    alt Access Token Valid
        API->>Redis: GET user_session:{user_id}
        Redis->>API: Return cached user data
        API->>DB: SELECT budget_facts WHERE user_id = ?
        DB->>API: Return data
        API->>Frontend: 200 OK {data}
    else Access Token Expired (15min)
        API->>Frontend: 401 Unauthorized<br>{error: "Token expired"}

        Note over Frontend: Automatic token refresh
        Frontend->>API: POST /auth/refresh<br>{refresh_token}

        API->>DB: SELECT session WHERE refresh_token_hash = ?
        DB->>API: Return session (expires_at, revoked)

        alt Refresh Token Valid & Not Revoked & Not Expired (7d)
            Note over API: Token Rotation Strategy<br>1. Generate new access_token (7 days)<br>2. Generate new refresh_token (30 days)<br>3. Revoke old refresh_token

            API->>DB: UPDATE user_sessions<br>SET revoked = true WHERE id = old_session
            API->>DB: INSERT INTO user_sessions<br>(refresh_token_hash, expires_at, ...)
            API->>Frontend: 200 OK<br>{access_token, refresh_token}

            Frontend->>Frontend: Update stored tokens
            Frontend->>API: Retry original request with new access_token
            API->>Frontend: 200 OK {data}
        else Refresh Token Invalid/Expired/Revoked
            API->>Frontend: 401 Unauthorized<br>{error: "Session expired"}
            Frontend->>Frontend: Clear tokens
            Frontend->>User: Redirect to login page
        end
    end
```

### Token Specifications

| Token Type | Lifetime | Storage | Rotation |
|------------|----------|---------|----------|
| Access Token | 7 days | httpOnly cookies | No rotation |
| Refresh Token | 30 days | httpOnly cookies + DB (hashed) | Rotated on refresh |

### Security Notes
- **Token Rotation**: Each refresh generates new refresh_token, old one revoked
- **Refresh Token Hashing**: SHA256 hash stored in DB, not plaintext
- **Automatic Refresh**: Frontend intercepts 401 errors, refreshes transparently
- **Session Revocation**: Admin can revoke all sessions for security

---

## 4. WebAuthn Biometric Authentication

```mermaid
sequenceDiagram
    participant User
    participant Frontend as PWA Frontend
    participant API as FastAPI Backend
    participant Authenticator as Biometric Device
    participant DB as PostgreSQL

    Note over User,DB: Registration Flow

    User->>Frontend: Enable biometric login
    Frontend->>API: POST /auth/webauthn/register/begin<br>{user_id}

    API->>DB: SELECT user WHERE id = ?
    Note over API: Generate challenge (32 random bytes)
    API->>DB: INSERT INTO webauthn_challenges (challenge, user_id, expires_at)
    API->>Frontend: 200 OK<br>{challenge, user: {id, name, displayName}, rp: {name, id}}

    Frontend->>Authenticator: navigator.credentials.create({publicKey: options})
    Authenticator->>User: Prompt biometric (fingerprint/face)
    User->>Authenticator: Provide biometric
    Authenticator->>Authenticator: Generate key pair<br>Sign challenge with private key
    Authenticator->>Frontend: Return credential {id, publicKey, attestation}

    Frontend->>API: POST /auth/webauthn/register/complete<br>{credential, challenge}

    Note over API: Verify attestation<br>1. Challenge matches<br>2. Origin matches RP ID<br>3. User present flag set

    API->>DB: INSERT INTO webauthn_credentials<br>(credential_id, public_key, user_id, counter)
    API->>Frontend: 200 OK {success: true}
    Frontend->>User: Show success message

    Note over User,DB: Authentication Flow

    User->>Frontend: Click biometric login
    Frontend->>API: POST /auth/webauthn/login/begin

    Note over API: Generate challenge (32 random bytes)
    API->>DB: INSERT INTO webauthn_challenges (challenge, expires_at)
    API->>DB: SELECT all webauthn_credentials
    DB->>API: Return credential_ids
    API->>Frontend: 200 OK<br>{challenge, allowCredentials: [{id, type}]}

    Frontend->>Authenticator: navigator.credentials.get({publicKey: options})
    Authenticator->>User: Prompt biometric
    User->>Authenticator: Provide biometric
    Authenticator->>Authenticator: Sign challenge with private key
    Authenticator->>Frontend: Return assertion {credentialId, signature, authenticatorData}

    Frontend->>API: POST /auth/webauthn/login/complete<br>{assertion, challenge}

    API->>DB: SELECT credential WHERE credential_id = ?
    DB->>API: Return public_key, counter, user_id

    Note over API: Verify signature<br>1. Challenge matches<br>2. Origin matches RP ID<br>3. Counter > stored counter (prevent replay)<br>4. Signature valid with public_key

    alt Signature Valid
        API->>DB: UPDATE webauthn_credentials SET counter = new_counter
        Note over API: Generate JWT tokens
        API->>DB: INSERT INTO user_sessions (refresh_token_hash, ...)
        API->>Frontend: 200 OK<br>{access_token, refresh_token, user}
        Frontend->>User: Redirect to dashboard
    else Signature Invalid
        API->>Frontend: 401 Unauthorized<br>{error: "Authentication failed"}
    end
```

### Security Notes
- **Public Key Cryptography**: Private key never leaves device
- **Challenge-Response**: Prevents replay attacks
- **Counter Validation**: Detects cloned authenticators
- **User Presence**: Requires user interaction (biometric/PIN)
- **Origin Validation**: Prevents phishing attacks

### Supported Authenticators
- **Platform**: Touch ID, Face ID, Windows Hello
- **Roaming**: YubiKey, Google Titan Key, hardware tokens

---

## Authentication Comparison

| Method | Security | UX | Setup Complexity | Offline Support |
|--------|----------|----|--------------------|-----------------|
| Telegram OAuth | High | Excellent | Low | No |
| Email + Password | Medium | Good | Low | No |
| Email + Password + 2FA | Very High | Good | Medium | No (requires TOTP app) |
| WebAuthn | Very High | Excellent | Medium | No |

## References

- [Authentication Architecture](../architecture/core/authentication.md)
- [Security Best Practices](../architecture/operations/security-best-practices.md)
- [JWT Implementation](../architecture/backend/endpoints/auth.md)

---

**Version**: 11.4.4
**Created**: 2026-02-07
