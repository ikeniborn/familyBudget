"""
WebSocket Connection Manager Template
Handles WebSocket connections and broadcasting

CRITICAL: WORKERS=1 required (or Redis Pub/Sub for multi-worker)
"""

from fastapi import WebSocket
from typing import Dict
import logging

logger = logging.getLogger(__name__)

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
    
    async def connect(self, websocket: WebSocket, connection_id: str):
        await websocket.accept()
        self.active_connections[connection_id] = websocket
        logger.info(f"WebSocket connected: {connection_id}")
    
    def disconnect(self, connection_id: str):
        if connection_id in self.active_connections:
            del self.active_connections[connection_id]
    
    async def broadcast(self, event: str, data: dict):
        """Broadcast to all connected clients"""
        message = {"event": event, "data": data}
        for conn_id, ws in list(self.active_connections.items()):
            try:
                await ws.send_json(message)
            except Exception as e:
                logger.error(f"Broadcast error: {e}")
                self.disconnect(conn_id)

# Global instance
ws_manager = ConnectionManager()
