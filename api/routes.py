import uuid
from datetime import datetime
from fastapi import APIRouter, Request, BackgroundTasks, HTTPException, status
from models.schemas import EventRequest, ChatRequest, ItemAvailabilityUpdate, ScenarioRequest, SimulateRequest
from api.dependencies import config, order_service, audit_service, action_executor, ORDERS_DATABASE

router = APIRouter()

def _base_order(order_id: str, order_type: str, items: list, include_prescription: bool = False) -> dict:
    """Factory for a canonical blank order structure."""
    states = {
        "ORDER_LIFECYCLE": "DRAFT",
        "PAYMENT": "UNPAID",
        "PICKUP_VERIFICATION": "WAITING_FOR_PICKUP",
        "ISSUE_MANAGEMENT": "NO_ISSUE"
    }
    return {
        "order_id": order_id,
        "order_type": order_type,
        "states": states,
        "customer_id": "CUS-001",
        "chat_messages": [],
        "context": {
            "order_type": order_type,
            "prescription": {
                "clarity_score": 75 if include_prescription else 0
            },
            "pickup": {
                "otp_generated": False,
                "otp_verified": False,
                "deadline": None
            },
            "availability": {
                "status": "AVAILABLE"
            }
        },
        "order_items": items,
        "order_event_history": [],
        "notifications": [],
        "reservations": {}
    }

OTC_ITEMS = [
    {
        "order_item_id": "ITEM-101",
        "medicine_catalogue_id": "MED-001",
        "medicine_name_snapshot": "Panadol 500mg",
        "category": "OTC",
        "requires_prescription": False,
        "availability_result": "AVAILABLE"
    },
    {
        "order_item_id": "ITEM-102",
        "medicine_catalogue_id": "MED-002",
        "medicine_name_snapshot": "Vitamin C 1000mg",
        "category": "OTC",
        "requires_prescription": False,
        "availability_result": "AVAILABLE"
    },
    {
        "order_item_id": "ITEM-103",
        "medicine_catalogue_id": "MED-003",
        "medicine_name_snapshot": "Betadine Antiseptic",
        "category": "OTC",
        "requires_prescription": False,
        "availability_result": "AVAILABLE"
    }
]

PRESCRIPTION_ITEMS = [
    {
        "order_item_id": "ITEM-201",
        "medicine_catalogue_id": "MED-010",
        "medicine_name_snapshot": "Amoxicillin 500mg",
        "category": "PRESCRIPTION",
        "requires_prescription": True,
        "availability_result": "AVAILABLE"
    }
]

MIXED_ITEMS = [
    {
        "order_item_id": "ITEM-101",
        "medicine_catalogue_id": "MED-001",
        "medicine_name_snapshot": "Panadol 500mg",
        "category": "OTC",
        "requires_prescription": False,
        "availability_result": "AVAILABLE"
    },
    {
        "order_item_id": "ITEM-201",
        "medicine_catalogue_id": "MED-010",
        "medicine_name_snapshot": "Amoxicillin 500mg",
        "category": "PRESCRIPTION",
        "requires_prescription": True,
        "availability_result": "AVAILABLE"
    }
]

SCENARIOS = {
    "OTC_DRAFT": {
        "order_type": "OTC",
        "items": OTC_ITEMS,
        "include_prescription": False,
        "overrides": {},
        "summary": "Start with a simple OTC basket and walk through the customer-to-pharmacy flow.",
        "starting_state": "DRAFT",
        "role_hint": "CUSTOMER",
        "demo_steps": [
            "Submit the order as the customer.",
            "Switch to PHARMACY_STAFF to confirm availability.",
            "Use CUSTOMER again to confirm the quote and start preparation."
        ]
    },

    "PRESCRIPTION_DRAFT": {
        "order_type": "PRESCRIPTION",
        "items": PRESCRIPTION_ITEMS,
        "include_prescription": True,
        "overrides": {},
        "summary": "Demonstrate the pharmacist-gated prescription path with clinical validation first.",
        "starting_state": "DRAFT",
        "role_hint": "CUSTOMER",
        "demo_steps": [
            "Submit the order and let the prescription workflow start.",
            "Move the validation state to PHARMACIST_REVIEW.",
            "Use PHARMACIST to approve the prescription before pharmacy confirmation."
        ]
    },

    "MIXED_DRAFT": {
        "order_type": "MIXED",
        "items": MIXED_ITEMS,
        "include_prescription": True,
        "overrides": {},
        "summary": "Show a mixed order that needs both OTC handling and prescription approval.",
        "starting_state": "DRAFT",
        "role_hint": "CUSTOMER",
        "demo_steps": [
            "Submit the order as the customer.",
            "Use PHARMACIST to approve the prescription portion.",
            "Switch to PHARMACY_STAFF for availability and handover steps."
        ]
    },

    "COMPLETED_WITH_ISSUE": {
        "order_type": "OTC",
        "items": OTC_ITEMS,
        "include_prescription": False,
        "overrides": {
            "states": {
                "ORDER_LIFECYCLE": "COLLECTED",
                "PAYMENT": "PAID",
                "PICKUP_VERIFICATION": "COLLECTED",
                "ISSUE_MANAGEMENT": "ISSUE_REPORTED"
            }
        },
        "summary": "Open the issue-management workflow post-collection for a customer complaint.",
        "starting_state": "COLLECTED",
        "role_hint": "CUSTOMER",
        "demo_steps": [
            "Load the scenario and inspect the issue state.",
            "Use the issue actions to report and investigate the problem.",
            "Resolve the case as PHARMACIST or ADMIN."
        ]
    },

    "PHARMACY_ERROR_UNDER_REVIEW": {
        "order_type": "OTC",
        "items": OTC_ITEMS,
        "include_prescription": False,
        "overrides": {
            "states": {
                "ORDER_LIFECYCLE": "COLLECTED",
                "PAYMENT": "PAID",
                "PICKUP_VERIFICATION": "COLLECTED",
                "ISSUE_MANAGEMENT": "UNDER_REVIEW"
            }
        },
        "summary": "Show the pharmacist review and replacement-order path for a pharmacy error case.",
        "starting_state": "COLLECTED",
        "role_hint": "PHARMACIST",
        "demo_steps": [
            "Load the scenario and inspect the review state.",
            "Resolve the claim as a pharmacist.",
            "Observe the replacement-order workflow action in the audit trail."
        ]
    }
}


@router.get("/workflow/metadata")
def get_workflow_metadata(req: Request):
    request_id = req.headers.get("X-Request-ID", f"REQ-{uuid.uuid4().hex[:8].upper()}")
    return {"success": True, "request_id": request_id, "data": config}


@router.post("/orders/scenario")
def create_scenario(req: ScenarioRequest, request: Request):
    request_id = request.headers.get("X-Request-ID", f"REQ-{uuid.uuid4().hex[:8].upper()}")

    scenario_def = SCENARIOS.get(req.scenario)
    if not scenario_def:
        raise HTTPException(status_code=400, detail=f"Unknown scenario '{req.scenario}'. Valid: {list(SCENARIOS.keys())}")

    order_id = f"ORD-{uuid.uuid4().hex[:4].upper()}"
    order = _base_order(
        order_id=order_id,
        order_type=scenario_def["order_type"],
        items=scenario_def["items"],
        include_prescription=scenario_def["include_prescription"]
    )

    # Apply overrides
    overrides = scenario_def.get("overrides", {})
    if "states" in overrides:
        order["states"].update(overrides["states"])
    if "context" in overrides:
        for k, v in overrides["context"].items():
            if isinstance(v, dict) and k in order["context"]:
                order["context"][k].update(v)
            else:
                order["context"][k] = v

    ORDERS_DATABASE[order_id] = order
    return {"success": True, "request_id": request_id, "data": order_service.get_order(order_id)}


@router.post("/orders/{order_id}/transition")
def trigger_transition(order_id: str, request: EventRequest, req: Request, background_tasks: BackgroundTasks):
    request_id = req.headers.get("X-Request-ID", f"REQ-{uuid.uuid4().hex[:8].upper()}")
    try:
        result, errors, actions_to_dispatch, audit_id = order_service.execute_order_event_sync(
            order_id=order_id,
            event=request.event,
            role_claim=request.user_role,
            request_id=request_id,
            context_updates=request.context_updates
        )
        if errors:
            return {"success": False, "request_id": request_id, "errors": errors}

        return {"success": True, "request_id": request_id, "data": result}
    except LookupError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.post("/orders/{order_id}/simulate")
def simulate_transition(order_id: str, request: SimulateRequest, req: Request):
    request_id = req.headers.get("X-Request-ID", f"REQ-{uuid.uuid4().hex[:8].upper()}")
    try:
        decision, errors = order_service.simulate_transition(
            order_id=order_id,
            event=request.event,
            role_claim=request.user_role,
            context_updates=request.context_updates
        )
        if errors:
            return {"success": False, "allowed": False, "request_id": request_id, "errors": errors}
        return {"success": True, "allowed": True, "request_id": request_id, "data": decision}
    except LookupError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.post("/orders/{order_id}/items/status")
def update_item_status(order_id: str, update: ItemAvailabilityUpdate):
    order = ORDERS_DATABASE.get(order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found.")
    for item in order.get("order_items", []):
        if item["order_item_id"] == update.order_item_id:
            item["availability_result"] = update.availability_result
            item["availability_checked"] = datetime.now().isoformat()
            break
    return {"success": True, "data": order["order_items"]}


@router.post("/orders/{order_id}/chat")
def post_chat_message(order_id: str, chat: ChatRequest):
    order = ORDERS_DATABASE.get(order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found.")
    order.setdefault("chat_messages", []).append({
        "sender": chat.sender,
        "message": chat.message,
        "timestamp": datetime.now().isoformat()
    })
    return {"success": True, "data": order["chat_messages"][-1]}


@router.get("/orders/{order_id}/actions")
def get_order_actions(order_id: str, req: Request, role: str = "SYSTEM"):
    request_id = req.headers.get("X-Request-ID", f"REQ-{uuid.uuid4().hex[:8].upper()}")
    order = order_service.get_order(order_id, role_claim=role)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found.")
    return {
        "success": True,
        "request_id": request_id,
        "states": order["states"],
        "available_actions": order["available_actions"]
    }


@router.get("/orders/{order_id}")
def get_order(order_id: str, req: Request, role: str = "SYSTEM"):
    request_id = req.headers.get("X-Request-ID", f"REQ-{uuid.uuid4().hex[:8].upper()}")
    order = order_service.get_order(order_id, role_claim=role)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found.")
    return {"success": True, "request_id": request_id, "data": order}


@router.post("/orders/{order_id}/context")
def update_order_context(order_id: str, context_updates: dict, req: Request, role: str = "SYSTEM"):
    order = ORDERS_DATABASE.get(order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found.")
    order_service._apply_updates(order["context"], context_updates)
    
    # Auto-trigger prescription OCR validation if clarity score updated and validation is pending
    if "prescription" in context_updates and "clarity_score" in context_updates["prescription"]:
        rx_state = order.get("states", {}).get("PRESCRIPTION_VALIDATION")
        if rx_state in ["UPLOADED", "VALIDATING"]:
            # Perform automatic validation pass
            order_service.execute_order_event_sync(order_id, "start_validation", role_claim="SYSTEM")

    return {"success": True, "data": order_service.get_order(order_id, role_claim=role)}


@router.get("/audit-logs")
def get_audit_logs(req: Request):
    request_id = req.headers.get("X-Request-ID", f"REQ-{uuid.uuid4().hex[:8].upper()}")
    return {"success": True, "request_id": request_id, "data": audit_service.get_all()}


@router.get("/scenarios")
def list_scenarios():
    return {
        "success": True,
        "data": [
            {
                "id": k,
                "order_type": v["order_type"],
                "description": k.replace("_", " ").title(),
                "summary": v.get("summary", ""),
                "starting_state": v.get("starting_state", ""),
                "role_hint": v.get("role_hint", "CUSTOMER"),
                "demo_steps": v.get("demo_steps", [])
            }
            for k, v in SCENARIOS.items()
        ]
    }
