"""
P2P Sync API endpoint for Family Budget PWA.

Provides a lightweight info endpoint for P2P capability detection.
The actual P2P sync is fully client-side (WebRTC RTCDataChannel) and
does NOT require server relay. This endpoint exists for:
  1. P2P capability check / STUN server list discovery
  2. Relay signaling for cross-platform P2P (iOS↔Android via 6-digit code)

@version 1.1.0
"""

import logging
import re
import secrets
import string
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, Field

from backend.app.core.auth import get_current_user
from backend.app.middleware.rate_limiter import limiter
from backend.app.models.user import User
from backend.app.services.redis_service import get_redis

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/p2p", tags=["p2p"])

# Public STUN servers for WebRTC ICE (no cost, no auth required)
STUN_SERVERS = [
    {"urls": "stun:stun.l.google.com:19302"},
    {"urls": "stun:stun1.l.google.com:19302"},
    {"urls": "stun:stun.cloudflare.com:3478"},
]

RELAY_TTL_SECONDS = 120
_RELAY_CODE_CHARS = string.ascii_uppercase + string.digits


# WebRTC SDP + ICE candidates compressed typically fit in <4KB; 10KB is a safe ceiling.
_RELAY_PAYLOAD_MAX_LEN = 10_000


class RelayOfferRequest(BaseModel):
    payload: str = Field(max_length=_RELAY_PAYLOAD_MAX_LEN)  # compressed SDP + ICE candidates


class RelayAnswerRequest(BaseModel):
    payload: str = Field(max_length=_RELAY_PAYLOAD_MAX_LEN)  # compressed SDP + ICE candidates


_RELAY_CODE_RE = re.compile(r"^[A-Z0-9]{6}$")


def _generate_relay_code() -> str:
    return "".join(secrets.choice(_RELAY_CODE_CHARS) for _ in range(6))


def _validate_relay_code(code: str) -> str:
    code = code.upper()
    if not _RELAY_CODE_RE.match(code):
        raise HTTPException(status_code=400, detail="Invalid relay code format")
    return code


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
        "version": "1.1",
        "stun_servers": STUN_SERVERS,
        "max_facts_per_sync": 500,
        "chunk_size_bytes": 10240,
        "relay_enabled": True,
        "relay_ttl_seconds": RELAY_TTL_SECONDS,
    }


# ── Relay endpoints (unauthenticated — codes are ephemeral & unknown) ─────────


@router.post("/relay", status_code=201)
@limiter.limit("10/minute")
async def create_relay_offer(request: Request, body: RelayOfferRequest) -> dict[str, str]:
    """
    Store offer SDP under a generated 6-character code in Redis (TTL 120s).
    Returns { code } to display on the initiator device.
    """
    code = _generate_relay_code()

    async with get_redis() as redis:
        await redis.set(f"p2p:relay:{code}:offer", body.payload, ex=RELAY_TTL_SECONDS)

    logger.debug("[P2P relay] Created offer code=%s", code)
    return {"code": code}


@router.get("/relay/{code}")
@limiter.limit("30/minute")
async def get_relay_offer(request: Request, code: str) -> dict[str, Any]:
    """
    Retrieve the offer SDP for the given relay code.
    Returns 404 if the code is unknown or expired.
    """
    code = _validate_relay_code(code)
    async with get_redis() as redis:
        raw = await redis.get(f"p2p:relay:{code}:offer")

    if not raw:
        raise HTTPException(status_code=404, detail="Relay code not found or expired")

    return {"payload": raw.decode() if isinstance(raw, bytes) else raw}


@router.post("/relay/{code}/answer", status_code=200)
@limiter.limit("10/minute")
async def post_relay_answer(request: Request, code: str, body: RelayAnswerRequest) -> dict[str, str]:
    """
    Store the answer SDP for the given relay code in Redis (TTL 120s).
    Returns 404 if the offer code is unknown (expired or wrong code).
    """
    code = _validate_relay_code(code)
    async with get_redis() as redis:
        offer_exists = await redis.exists(f"p2p:relay:{code}:offer")
        if not offer_exists:
            raise HTTPException(status_code=404, detail="Relay code not found or expired")

        await redis.set(f"p2p:relay:{code}:answer", body.payload, ex=RELAY_TTL_SECONDS)

    logger.debug("[P2P relay] Stored answer for code=%s", code)
    return {"status": "ok"}


@router.get("/relay/{code}/answer")
@limiter.limit("30/minute")
async def get_relay_answer(request: Request, code: str, response: Response) -> dict[str, Any]:
    """
    Poll for the answer SDP.
    Returns 200 + answer when available, 202 while still waiting.
    Returns 404 if the offer code itself is gone (expired).
    """
    code = _validate_relay_code(code)
    async with get_redis() as redis:
        raw_answer = await redis.get(f"p2p:relay:{code}:answer")
        if raw_answer:
            return {"payload": raw_answer.decode() if isinstance(raw_answer, bytes) else raw_answer}

        offer_exists = await redis.exists(f"p2p:relay:{code}:offer")

    if not offer_exists:
        raise HTTPException(status_code=404, detail="Relay code not found or expired")

    response.status_code = 202
    return {"status": "waiting"}
