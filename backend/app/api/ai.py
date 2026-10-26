"""AI endpoints: car finder, buying assistant, conversations."""
from __future__ import annotations

import json
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from pydantic import BaseModel

from app.ai.admin_agent import run_admin_chat
from app.ai.admin_insights import run_admin_insights
from app.ai.buying_assistant import run_buying_assistant
from app.ai.car_finder import run_car_finder
from app.ai.claude_service import get_claude
from app.ai.dealer_agent import run_dealer_chat
from app.ai.dealer_assistant import run_dealer_assistant
from app.ai.graph import run_chat
from app.ai.schemas import (
    CarFinderRequest,
    CarFinderResponse,
    ChatRequest,
    ChatRequestV2,
    ChatResponse,
    StructuredChatResponse,
)
from app.core.config import settings
from app.core.db import get_db
from app.models import AIConversation, Dealer, User
from app.models.enums import UserRole
from app.services.deps import (
    get_current_dealer,
    get_current_user,
    get_optional_user,
    require_role,
)

router = APIRouter(prefix="/api/ai", tags=["ai"])


@router.get("/status")
def ai_status():
    return get_claude().status


@router.post("/car-finder", response_model=CarFinderResponse)
def car_finder(
    payload: CarFinderRequest,
    db: Session = Depends(get_db),
    _user: Optional[User] = Depends(get_optional_user),
):
    # Public tool; works for anonymous visitors too.
    return run_car_finder(db, payload)


@router.post("/chat", response_model=StructuredChatResponse)
def chat(
    payload: ChatRequestV2,
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_optional_user),
):
    """Unified multi-agent chat. Works for guests (search/compare/dealers);
    quotation review and personal context require authentication."""
    # Load prior turns for memory (only for the owning authenticated user).
    conv: Optional[AIConversation] = None
    history = []
    if payload.conversation_id and user:
        conv = db.get(AIConversation, payload.conversation_id)
        if conv and conv.user_id != user.id:
            raise HTTPException(status_code=404, detail="Conversation not found")
        if conv:
            history = json.loads(conv.messages or "[]")

    response = run_chat(db, user, payload.message, history=history)

    # Persist conversation turns (no secrets) for signed-in users when memory is on.
    if user and settings.ai_enable_memory:
        if conv is None:
            conv = AIConversation(
                user_id=user.id, agent="supervisor", title=payload.message[:80], messages="[]"
            )
            db.add(conv)
            db.flush()
        turns = json.loads(conv.messages or "[]")
        turns.append({"role": "user", "content": payload.message})
        turns.append({"role": "assistant", "content": response.message})
        conv.messages = json.dumps(turns[-40:])
        db.commit()
        response.conversation_id = conv.id
    return response


def _persist_role_turn(
    db: Session, user: User, agent: str, conversation_id: Optional[int], message: str, reply: str
) -> Optional[int]:
    """Load/persist conversation memory for a role-scoped chat, owned by ``user``."""
    conv: Optional[AIConversation] = None
    if conversation_id:
        conv = db.get(AIConversation, conversation_id)
        if conv and (conv.user_id != user.id or conv.agent != agent):
            raise HTTPException(status_code=404, detail="Conversation not found")
    if not settings.ai_enable_memory:
        return conv.id if conv else None
    if conv is None:
        conv = AIConversation(user_id=user.id, agent=agent, title=message[:80], messages="[]")
        db.add(conv)
        db.flush()
    turns = json.loads(conv.messages or "[]")
    turns.append({"role": "user", "content": message})
    turns.append({"role": "assistant", "content": reply})
    conv.messages = json.dumps(turns[-40:])
    db.commit()
    return conv.id


def _load_role_history(
    db: Session, user: User, agent: str, conversation_id: Optional[int]
) -> list:
    if not conversation_id:
        return []
    conv = db.get(AIConversation, conversation_id)
    if conv and (conv.user_id != user.id or conv.agent != agent):
        raise HTTPException(status_code=404, detail="Conversation not found")
    return json.loads(conv.messages or "[]") if conv else []


@router.post("/dealer-chat", response_model=StructuredChatResponse)
def dealer_chat(
    payload: ChatRequestV2,
    db: Session = Depends(get_db),
    dealer: Dealer = Depends(get_current_dealer),
):
    """Conversational dealer assistant. Strictly scoped to the authenticated
    dealer's own dealership data."""
    user = dealer.owner
    history = _load_role_history(db, user, "dealer", payload.conversation_id)
    response = run_dealer_chat(db, dealer, payload.message, history=history)
    response.conversation_id = _persist_role_turn(
        db, user, "dealer", payload.conversation_id, payload.message, response.message
    )
    return response


@router.post("/admin-chat", response_model=StructuredChatResponse)
def admin_chat(
    payload: ChatRequestV2,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(UserRole.ADMIN)),
):
    """Conversational admin assistant operating on platform aggregates only."""
    history = _load_role_history(db, user, "admin", payload.conversation_id)
    response = run_admin_chat(db, payload.message, history=history)
    response.conversation_id = _persist_role_turn(
        db, user, "admin", payload.conversation_id, payload.message, response.message
    )
    return response


@router.delete("/conversations/{conversation_id}", status_code=204)
def delete_conversation(
    conversation_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)
):
    conv = db.get(AIConversation, conversation_id)
    if not conv or conv.user_id != user.id:
        raise HTTPException(status_code=404, detail="Conversation not found")
    db.delete(conv)
    db.commit()
    return None


class RoleAssistantRequest(BaseModel):
    message: Optional[str] = None


@router.post("/dealer-assistant")
def dealer_assistant(
    payload: RoleAssistantRequest,
    db: Session = Depends(get_db),
    dealer: Dealer = Depends(get_current_dealer),
):
    """Dealer-scoped performance insights. Only ever reads this dealer's own data."""
    return run_dealer_assistant(db, dealer, message=payload.message)


@router.post("/admin-insights")
def admin_insights(
    payload: RoleAssistantRequest,
    db: Session = Depends(get_db),
    _: User = Depends(require_role(UserRole.ADMIN)),
):
    """Platform-wide aggregate insights for administrators (aggregates only)."""
    return run_admin_insights(db, message=payload.message)


@router.post("/buying-assistant", response_model=ChatResponse)
def buying_assistant(
    payload: ChatRequest,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(UserRole.CUSTOMER)),
):
    response = run_buying_assistant(
        db, user, payload.message, vehicle_id=payload.vehicle_id, enquiry_id=payload.enquiry_id
    )
    # Persist conversation (minimal data; no secrets).
    conv = None
    if payload.conversation_id:
        conv = db.get(AIConversation, payload.conversation_id)
        if conv and conv.user_id != user.id:
            raise HTTPException(status_code=404, detail="Conversation not found")
    if conv is None:
        conv = AIConversation(user_id=user.id, agent="buying_assistant", title=payload.message[:80], messages="[]")
        db.add(conv)
        db.flush()
    history = json.loads(conv.messages or "[]")
    history.append({"role": "user", "content": payload.message})
    history.append({"role": "assistant", "content": response.reply})
    conv.messages = json.dumps(history[-40:])
    db.commit()
    response.conversation_id = conv.id
    return response


@router.post("/conversations")
def create_conversation(
    agent: str = "buying_assistant",
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    conv = AIConversation(user_id=user.id, agent=agent, messages="[]")
    db.add(conv)
    db.commit()
    db.refresh(conv)
    return {"id": conv.id, "agent": conv.agent}


@router.get("/conversations/{conversation_id}")
def get_conversation(
    conversation_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)
):
    conv = db.get(AIConversation, conversation_id)
    if not conv or conv.user_id != user.id:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return {
        "id": conv.id,
        "agent": conv.agent,
        "title": conv.title,
        "messages": json.loads(conv.messages or "[]"),
        "created_at": conv.created_at,
    }
