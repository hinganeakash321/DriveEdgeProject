"""Pydantic schemas for AI inputs/outputs (validated model boundaries)."""
from __future__ import annotations

from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field, field_validator

_VALID_FUEL = {"petrol", "diesel", "cng", "electric", "hybrid"}
_VALID_TRANS = {"manual", "automatic", "amt", "cvt", "dct"}


class CarFinderRequest(BaseModel):
    # Allow very short queries (e.g. "EV", "SUV"); the supervisor may route any
    # phrase here, so over-strict length validation must not crash dispatch.
    message: str = Field(min_length=1, max_length=2000)
    budget_max: Optional[float] = Field(default=None, ge=0)
    budget_min: Optional[float] = Field(default=None, ge=0)
    city: Optional[str] = Field(default=None, max_length=80)
    body_type: Optional[str] = None
    fuel_type: Optional[str] = None
    transmission: Optional[str] = None
    seating_capacity: Optional[int] = Field(default=None, ge=1, le=12)


class ExtractedPreferences(BaseModel):
    """Structured preferences Claude extracts from free text."""

    budget_max: Optional[float] = Field(default=None, description="Max budget in INR (ex-showroom)")
    budget_min: Optional[float] = Field(default=None)
    body_type: Optional[str] = Field(default=None, description="e.g. SUV, Hatchback, Sedan, MUV")
    fuel_type: Optional[str] = Field(default=None, description="petrol/diesel/cng/electric/hybrid")
    transmission: Optional[str] = Field(default=None, description="manual/automatic")
    seating_capacity: Optional[int] = Field(default=None)
    city: Optional[str] = Field(default=None)

    @field_validator("fuel_type")
    @classmethod
    def _valid_fuel(cls, v: Optional[str]) -> Optional[str]:
        # Drop hallucinated/invalid values (e.g. '<UNKNOWN>') instead of propagating them.
        if not v:
            return None
        v = v.strip().lower()
        return v if v in _VALID_FUEL else None

    @field_validator("transmission")
    @classmethod
    def _valid_trans(cls, v: Optional[str]) -> Optional[str]:
        if not v:
            return None
        v = v.strip().lower()
        return v if v in _VALID_TRANS else None


class Recommendation(BaseModel):
    vehicle_id: int
    manufacturer: Optional[str] = None
    model: Optional[str] = None
    min_price: Optional[float] = None
    max_price: Optional[float] = None
    matches: List[str] = Field(default_factory=list)
    tradeoffs: List[str] = Field(default_factory=list)
    unknowns: List[str] = Field(default_factory=list)


class CarFinderResponse(BaseModel):
    preferences: ExtractedPreferences
    recommendations: List[Recommendation]
    explanation: str
    ai_generated: bool
    disclaimer: str


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=4000)
    conversation_id: Optional[int] = None
    vehicle_id: Optional[int] = None
    enquiry_id: Optional[int] = None


class ChatResponse(BaseModel):
    conversation_id: Optional[int] = None
    reply: str
    ai_generated: bool


# ---------------- Multi-agent chat contracts ----------------


class Intent(str, Enum):
    vehicle_search = "vehicle_search"
    comparison = "comparison"
    buying_advice = "buying_advice"
    dealer_search = "dealer_search"
    quote_review = "quote_review"
    unclear = "unclear"


class DealerIntent(str, Enum):
    performance = "performance"
    enquiries = "enquiries"
    quotation_help = "quotation_help"
    pricing_help = "pricing_help"
    general = "general"


class AdminIntent(str, Enum):
    insights = "insights"
    lookup = "lookup"
    general = "general"


class SupervisorDecision(BaseModel):
    """Claude's typed routing decision (validated before use)."""

    intent: Intent = Intent.unclear
    vehicle_names: List[str] = Field(default_factory=list, description="Model names mentioned, e.g. 'Tata Nexon'")
    preferences: ExtractedPreferences = Field(default_factory=ExtractedPreferences)
    clarifying_question: Optional[str] = None


class ComparisonRow(BaseModel):
    attribute: str
    values: List[str]  # one per vehicle, "Not available" when missing


class ComparisonResult(BaseModel):
    vehicles: List[str] = Field(default_factory=list)
    rows: List[ComparisonRow] = Field(default_factory=list)
    differences: List[str] = Field(default_factory=list)
    recommendation: Optional[str] = None


class ChatAction(BaseModel):
    type: str  # e.g. compare_vehicles, request_quotes, view_vehicle
    label: str
    payload: Dict[str, Any] = Field(default_factory=dict)


class ChatData(BaseModel):
    vehicles: List[Dict[str, Any]] = Field(default_factory=list)
    comparison: Optional[ComparisonResult] = None
    dealers: List[Dict[str, Any]] = Field(default_factory=list)
    quotations: List[Dict[str, Any]] = Field(default_factory=list)
    enquiries: List[Dict[str, Any]] = Field(default_factory=list)


class ChatRequestV2(BaseModel):
    message: str = Field(min_length=1, max_length=4000)
    conversation_id: Optional[int] = None


class StructuredChatResponse(BaseModel):
    conversation_id: Optional[int] = None
    # Plain string so the same response contract serves the consumer, dealer and
    # admin agents (each uses its own intent vocabulary). Serializes identically.
    intent: str = Intent.unclear.value
    message: str
    data: ChatData = Field(default_factory=ChatData)
    actions: List[ChatAction] = Field(default_factory=list)
    clarification_required: bool = False
    ai_generated: bool = False
    error: Optional[str] = None
