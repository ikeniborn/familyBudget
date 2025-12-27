# Telegram OAuth Example

## Flow

```
1. User clicks "Login with Telegram" button
2. Telegram Login Widget validates user
3. Widget sends data to backend /auth/telegram
4. Backend validates hash, creates JWT
5. JWT stored in httpOnly cookie
6. User authenticated
```

## Frontend (Telegram Login Widget)

```html
<script async src="https://telegram.org/js/telegram-widget.js?22"
        data-telegram-login="YourBotName"
        data-size="large"
        data-auth-url="/auth/telegram"
        data-request-access="write">
</script>
```

## Backend Endpoint

```python
@router.post("/telegram")
async def telegram_oauth(
    request: Request,
    session: AsyncSession = Depends(get_db)
):
    # Validate Telegram data hash
    # Create or get user
    # Generate JWT token
    # Set httpOnly cookie
    return {"access_token": token}
```

**Reference**: `backend/app/api/v1/endpoints/auth.py:82-156`
