# Real-time Update Flow Example

## Scenario: User creates transaction

```
1. User submits form (POST /api/v1/facts)
2. Backend creates BudgetFact record
3. Backend broadcasts WebSocket event:
   await ws_manager.broadcast("budget_fact_created", fact_data)
4. All connected clients receive event
5. Frontend updates UI via HTMX refresh:
   htmx.trigger('#recent-transactions', 'refresh')
```

## Code Flow

**Backend** (`backend/app/api/v1/endpoints/facts.py:200`):
```python
fact = await fact_service.create_fact(session, fact_data)
await ws_manager.broadcast("budget_fact_created", {...})
```

**Frontend** (`frontend/web/static/js/budget/budgetWSClient.js:300`):
```javascript
budgetWS.on('budget_fact_created', (data) => {
    htmx.trigger('#recent-transactions', 'refresh');
});
```

**Latency**: <50ms (same worker), N/A (different workers without Redis)
