# WebSocket Integration Example

Реальный пример из Family Budget: интеграция WebSocket для real-time обновлений.

## Files

- **WebSocket Client**: `frontend/web/static/js/budget/budgetWSClient.js`
- **Backend Manager**: `backend/app/api/v1/endpoints/budget_sse.py`
- **Usage**: `frontend/web/templates/base.html`

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│ Frontend: budgetWSClient.js                              │
│                                                           │
│  new BudgetWSClient() → WebSocket("/api/v1/budget/ws")  │
│         ↓                                                 │
│  Event handlers:                                          │
│  - budget_fact_created                                    │
│  - budget_fact_updated                                    │
│  - budget_fact_deleted                                    │
│  - article_updated                                        │
└──────────────────────────────────────────────────────────┘
                      ↓ (WebSocket)
┌──────────────────────────────────────────────────────────┐
│ Backend: BudgetConnectionManager (in-memory)             │
│                                                           │
│  - Active connections: Map<connection_id, WebSocket>     │
│  - Broadcast events to all connected clients             │
│  - WORKERS=1 constraint (no Redis Pub/Sub)              │
└──────────────────────────────────────────────────────────┘
                      ↑ (Broadcast)
┌──────────────────────────────────────────────────────────┐
│ API Endpoints: /api/v1/facts                             │
│                                                           │
│  POST /facts → ws_manager.broadcast("budget_fact_created", data) │
│  PUT /facts/{id} → ws_manager.broadcast("budget_fact_updated", data) │
│  DELETE /facts/{id} → ws_manager.broadcast("budget_fact_deleted", data) │
└──────────────────────────────────────────────────────────┘
```

## Frontend Implementation

### 1. Initialize WebSocket Client

```javascript
// In base.html (global scope)
<script type="module">
    import { BudgetWSClient } from '/static/js/budget/budgetWSClient.js';
    window.budgetWS = new BudgetWSClient();

    // Register event handlers
    budgetWS.on('budget_fact_created', (data) => {
        console.log('New fact created:', data);
        // Refresh HTMX content
        htmx.trigger('#recent-transactions', 'refresh');
        htmx.trigger('#quick-stats', 'refresh');
    });

    budgetWS.on('budget_fact_updated', (data) => {
        console.log('Fact updated:', data);
        htmx.trigger('#recent-transactions', 'refresh');
    });

    budgetWS.on('budget_fact_deleted', (data) => {
        console.log('Fact deleted:', data.id);
        htmx.trigger('#recent-transactions', 'refresh');
    });

    // Connect
    budgetWS.connect();
</script>
```

### 2. WebSocket Client (Simplified)

```javascript
export class BudgetWSClient {
    constructor() {
        this.ws = null;
        this.isConnected = false;
        this.handlers = {};
    }

    connect() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/api/v1/budget/ws`;

        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
            console.log('[BudgetWS] Connected');
            this.isConnected = true;
        };

        this.ws.onmessage = (event) => {
            const message = JSON.parse(event.data);
            const { event: eventType, data } = message;

            // Trigger registered handlers
            if (this.handlers[eventType]) {
                this.handlers[eventType].forEach(handler => handler(data));
            }
        };

        this.ws.onclose = () => {
            console.log('[BudgetWS] Disconnected');
            this.isConnected = false;
            // Reconnect after 3 seconds
            setTimeout(() => this.connect(), 3000);
        };

        this.ws.onerror = (error) => {
            console.error('[BudgetWS] Error:', error);
        };
    }

    on(event, handler) {
        if (!this.handlers[event]) {
            this.handlers[event] = [];
        }
        this.handlers[event].push(handler);
    }

    disconnect() {
        if (this.ws) {
            this.ws.close();
        }
    }
}
```

## Backend Implementation

### 1. WebSocket Manager

```python
# backend/app/api/v1/endpoints/budget_sse.py

from fastapi import WebSocket, WebSocketDisconnect
from typing import Dict
import logging

logger = logging.getLogger(__name__)

class BudgetConnectionManager:
    """
    In-memory WebSocket connection manager

    CRITICAL: Works only with WORKERS=1
    Multiple workers = separate managers = lost events
    """

    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}

    async def connect(self, websocket: WebSocket, connection_id: str):
        await websocket.accept()
        self.active_connections[connection_id] = websocket
        logger.info(f"WebSocket connected: {connection_id}")

    def disconnect(self, connection_id: str):
        if connection_id in self.active_connections:
            del self.active_connections[connection_id]
            logger.info(f"WebSocket disconnected: {connection_id}")

    async def broadcast(self, event: str, data: dict):
        """Broadcast event to all connected clients"""
        message = {"event": event, "data": data}

        disconnected = []
        for conn_id, websocket in self.active_connections.items():
            try:
                await websocket.send_json(message)
            except Exception as e:
                logger.error(f"Broadcast error to {conn_id}: {e}")
                disconnected.append(conn_id)

        # Remove disconnected clients
        for conn_id in disconnected:
            self.disconnect(conn_id)

# Global instance
ws_manager = BudgetConnectionManager()
```

### 2. WebSocket Endpoint

```python
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
import uuid

router = APIRouter()

@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    connection_id = str(uuid.uuid4())

    await ws_manager.connect(websocket, connection_id)

    try:
        while True:
            # Keep connection alive (receive pings)
            data = await websocket.receive_text()
            # Optional: handle client messages
    except WebSocketDisconnect:
        ws_manager.disconnect(connection_id)
```

### 3. Broadcast from API Endpoints

```python
# backend/app/api/v1/endpoints/facts.py

@router.post("/", response_model=FactResponse)
async def create_fact(
    fact_data: FactCreate,
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Create fact
    fact = await fact_service.create_fact(session, fact_data, current_user)

    # Broadcast WebSocket event
    await ws_manager.broadcast(
        "budget_fact_created",
        {
            "id": fact.id,
            "amount": fact.amount,
            "article_id": fact.article_id,
            "financial_center_id": fact.financial_center_id,
        }
    )

    return fact
```

## Key Features

### 1. Auto-Reconnect

```javascript
this.ws.onclose = () => {
    setTimeout(() => this.connect(), 3000); // Reconnect after 3 sec
};
```

### 2. Event-Driven Architecture

```javascript
// Register handler
budgetWS.on('budget_fact_created', (data) => {
    // Handle event
});

// Broadcast from backend
await ws_manager.broadcast("budget_fact_created", data);
```

### 3. HTMX Integration

```javascript
// Refresh HTMX content on WebSocket event
htmx.trigger('#recent-transactions', 'refresh');
```

### 4. Single Worker Constraint

```yaml
# docker-compose.yml
services:
  backend:
    command: uvicorn app.main:app --workers 1  # CRITICAL!
```

**Why WORKERS=1?**
- `BudgetConnectionManager` is in-memory
- Each worker has separate instance
- Events don't propagate between workers
- User A (worker 1) creates fact → only worker 1 clients receive event
- User B (worker 2) doesn't see update

**Future: Redis Pub/Sub**
- Use Redis for event broadcasting
- Workers subscribe to Redis channel
- Events propagate across all workers
- Can scale to multiple workers

## Performance

- **Connection time**: ~100ms
- **Event latency**: <50ms (same worker)
- **Reconnect time**: 3 seconds
- **Memory**: ~5KB per connection

## References

- **WebSocket API**: https://developer.mozilla.org/en-US/docs/Web/API/WebSocket
- **FastAPI WebSocket**: https://fastapi.tiangolo.com/advanced/websockets/
- **Real implementation**: `frontend/web/static/js/budget/budgetWSClient.js`
