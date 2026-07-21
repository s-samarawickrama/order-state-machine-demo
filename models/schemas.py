from pydantic import BaseModel
from typing import Dict, Any, Optional, List

class EventRequest(BaseModel):
    event: str
    user_role: str = "PHARMACY_STAFF"
    context_updates: Optional[Dict[str, Any]] = None

class SimulateRequest(BaseModel):
    event: str
    user_role: str = "PHARMACY_STAFF"
    context_updates: Optional[Dict[str, Any]] = None

class ScenarioRequest(BaseModel):
    scenario: str

class ChatRequest(BaseModel):
    sender: str
    message: str

class ItemAvailabilityUpdate(BaseModel):
    order_item_id: str
    availability_result: str
