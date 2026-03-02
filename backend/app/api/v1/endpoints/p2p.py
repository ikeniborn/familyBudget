"""
P2P Sync API endpoint for Family Budget PWA.

Provides a lightweight info endpoint for P2P capability detection.
The actual P2P sync is fully client-side (WebRTC RTCDataChannel) and
does NOT require server relay. This endpoint exists for:
  1. P2P capability check / STUN server list discovery
  2. Future: optional QR relay if direct P2P fails

@version 1.0.0
"""

import logging
from typing import Any

from fastapi import APIRouter, Depends

from backend.app.core.auth import get_current_user
from backend.app.models.user import User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/p2p", tags=["p2p"])

# Public STUN servers for WebRTC ICE (no cost, no auth required)
STUN_SERVERS = [
    {"urls": "stun:stun.l.google.com:19302"},
    {"urls": "stun:stun1.l.google.com:19302"},
    {"urls": "stun:stun.cloudflare.com:3478"},
]


@router.get("/config")
async def get_p2p_config(
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    """
    Return P2P sync configuration: STUN server list and feature flags.
    Authenticated endpoint — confirms user is logged in before P2P sync.
    """
    return {
        "enabled": True,
        "version": "1.0",
        "stun_servers": STUN_SERVERS,
        "max_facts_per_sync": 500,
        "chunk_size_bytes": 10240,
    }
