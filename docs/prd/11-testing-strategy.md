## 11. Testing Strategy

### 11.1 Unit Testing

**pytest для Python кода:**

```python
# tests/test_auth.py
def test_telegram_hash_validation():
    data = {
        'id': 123456789,
        'first_name': 'Test',
        'hash': 'expected_hash'
    }
    assert validate_telegram_hash(data, 'bot_token') == True

def test_create_access_token():
    token = create_access_token(user_id=1)
    assert token is not None
    payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
    assert payload['user_id'] == 1
```

**Coverage target:** 80%+

**Мокирование внешних зависимостей:**

```python
from unittest.mock import Mock, patch

@patch('app.services.telegram.bot.send_message')
def test_send_weekly_report(mock_send):
    send_weekly_report(user_id=1)
    mock_send.assert_called_once()
```

### 11.2 Integration Testing

**API endpoint tests:**

```python
from fastapi.testclient import TestClient

client = TestClient(app)

def test_create_fact():
    response = client.post(
        "/api/v1/facts",
        json={
            "article_id": 1,
            "amount": 1500.00,
            "record_type": "fact"
        },
        headers={"Authorization": f"Bearer {test_token}"}
    )
    assert response.status_code == 201
```

**Database integration tests:**

```python
def test_scd2_update():
    # Create initial record
    article = create_article(code="TEST", name="Test")
    assert article.is_current == True
    
    # Update record (SCD2)
    new_article = update_article(article.id, name="Test Updated")
    
    # Verify old record closed
    old = get_article(article.id)
    assert old.is_current == False
    
    # Verify new record created
    assert new_article.is_current == True
    assert new_article.name == "Test Updated"
```

### 11.3 End-to-End Testing

**User journey tests:**

```python
def test_add_expense_journey():
    # 1. User starts conversation
    bot.send_message(chat_id, "/add_expense")
    
    # 2. Bot asks for amount
    assert last_message.text == "Введите сумму"
    
    # 3. User enters amount
    bot.send_message(chat_id, "1500")
    
    # 4. Bot shows article selection
    assert "Выберите статью" in last_message.text
    
    # ... и так далее
```

**Playwright для веб UI (опционально):**

```javascript
test('user can view analytics', async ({ page }) => {
  await page.goto('/login');
  await page.click('[data-telegram-login]');
  await page.goto('/analytics');
  await expect(page.locator('canvas')).toBeVisible();
});
```

### 11.4 Manual Testing Checklist

**Deployment на чистом VPS:**
- [ ] `./scripts/install.sh` выполняется без ошибок
- [ ] `./scripts/setup.sh` корректно настраивает .env
- [ ] `./scripts/deploy.sh` запускает все сервисы
- [ ] Веб-интерфейс доступен по HTTPS
- [ ] Telegram бот отвечает на команды

**User Journeys:**
- [ ] Добавление расхода через бота (< 1 мин)
- [ ] Просмотр аналитики в веб
- [ ] CRUD справочников (admin)
- [ ] Получение еженедельного отчета
- [ ] Уведомление о превышении бюджета

**Backup/Restore:**
- [ ] Бэкап создается автоматически
- [ ] Восстановление из бэкапа работает
- [ ] Бэкап загружается в S3 (если настроено)

### 11.5 Bug Fixes and Improvements (2025-11-05)

#### Fix: Race Condition при удалении транзакций

**Проблема:**
- Кнопки удаления перестают работать после первого клика
- При быстрых повторных кликах происходит race condition
- После DELETE 404 таблица не перезагружается → UI в несогласованном состоянии

**Решение (Frontend - `web/templates/facts.html`, `web/templates/plan.html`):**

1. **Tracking Set для ongoing deletions:**
   ```javascript
   let deletingFactIds = new Set(); // Предотвращает повторные запросы

   async function deleteFact(factId, event) {
       if (deletingFactIds.has(factId)) {
           console.warn('Delete already in progress for fact:', factId);
           return;
       }
       // ...
   }
   ```

2. **Disabled button state:**
   ```javascript
   const button = event?.target?.closest('button');
   button.disabled = true;
   button.classList.add('loading', 'loading-spinner');
   ```

3. **try-finally для UI consistency:**
   ```javascript
   try {
       const response = await fetch(`/api/v1/admin/facts/${factId}`, {
           method: 'DELETE'
       });
       // ...
   } finally {
       // ВСЕГДА перезагружаем таблицу (даже при 404!)
       deletingFactIds.delete(factId);
       await loadFacts();
   }
   ```

**Решение (Backend - `backend/app/api/v1/admin.py`):**

**Idempotent DELETE endpoint:**
```python
@router.delete("/facts/{fact_id}")
async def delete_fact(fact_id: int, current_admin: CurrentAdmin, ...):
    """Idempotent DELETE - returns 200 OK even if fact is already deleted."""

    fact = await session.get(Fact, fact_id)

    if not fact:
        # Вместо 404 → 200 OK с status="already_deleted"
        logger.warning(f"DELETE attempt on non-existent fact_id={fact_id}")
        return {
            "message": "Fact already deleted or never existed",
            "fact_id": fact_id,
            "status": "already_deleted"
        }

    await session.delete(fact)
    await session.commit()

    return {
        "message": "Fact deleted successfully",
        "fact_id": fact_id,
        "status": "deleted"
    }
```

**Тесты:**
- ✅ Integration tests: `tests/integration/backend/test_admin_delete.py`
- ✅ Unit test docs: `tests/unit/web/test_delete_fact.md` (требует Jest setup)

**Результат:**
- ✅ Кнопки работают корректно даже при множественных кликах
- ✅ UI всегда синхронизирован с backend state
- ✅ WARNING логи для debugging race conditions в production
- ✅ Idempotent DELETE (RESTful best practice)

---

