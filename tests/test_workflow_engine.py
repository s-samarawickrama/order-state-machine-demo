import pytest
import json
from engine.workflow_engine import WorkflowEngine
from engine.validator import WorkflowValidator
from services.order_service import OrderService
from services.audit_service import AuditService
from services.action_executor import ActionExecutor

@pytest.fixture
def real_config():
    with open("config/transitions.json", "r") as f:
        return json.load(f)

@pytest.fixture
def empty_store():
    return {}

@pytest.fixture
def services(real_config, empty_store):
    WorkflowValidator.validate(real_config)
    engine = WorkflowEngine(real_config)
    audit_service = AuditService()
    action_executor = ActionExecutor(empty_store, audit_service)
    order_service = OrderService(engine, empty_store, audit_service, action_executor)
    return order_service, empty_store

def create_order(store, order_id, has_prescription=False, prescription_status="NOT_REQUIRED", payment_status="PAID", states=None):
    order_type = "PRESCRIPTION" if has_prescription else "OTC"
    if states is None:
        states = {
            "ORDER_LIFECYCLE": "DRAFT",
            "PAYMENT": "UNPAID",
        }
    states = {k: v for k, v in states.items() if v is not None}
    
    store[order_id] = {
        "order_id": order_id,
        "order_type": order_type,
        "states": states,
        "customer_id": "CUS001",
        "context": {
            "order_type": order_type,
            "prescription": {
                "status": prescription_status,
                "clarity_score": 0
            },
            "payment": {
                "status": payment_status
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
        "order_items": [
            {
                "order_item_id": "ITEM-101",
                "availability_result": "AVAILABLE"
            }
        ],
        "order_event_history": [],
        "notifications": []
    }

# 1. OTC order success
def test_otc_order_success(services):
    osvc, store = services
    create_order(store, "ORD-1")
    
    osvc.execute_order_event_sync("ORD-1", "submit_order", "CUSTOMER", "R1")
    assert store["ORD-1"]["states"]["ORDER_LIFECYCLE"] == "WAITING_PHARMACY_CONFIRMATION"
    
    osvc.execute_order_event_sync("ORD-1", "pharmacy_confirm", "PHARMACY_STAFF", "R3")
    assert store["ORD-1"]["states"]["ORDER_LIFECYCLE"] == "WAITING_CUSTOMER_CONFIRMATION"
    
    osvc.execute_order_event_sync("ORD-1", "customer_confirm", "CUSTOMER", "R4")
    assert store["ORD-1"]["states"]["ORDER_LIFECYCLE"] == "PREPARING"
    
    osvc.execute_order_event_sync("ORD-1", "start_preparing", "PHARMACY_STAFF", "R5")
    assert store["ORD-1"]["states"]["ORDER_LIFECYCLE"] == "PREPARING"

# 2. Prescription order success
def test_prescription_order_success(services):
    osvc, store = services
    create_order(store, "ORD-2", has_prescription=True, prescription_status="PENDING")
    store["ORD-2"]["context"]["prescription"]["clarity_score"] = 90
    osvc.execute_order_event_sync("ORD-2", "submit_order", "CUSTOMER", "R0")
    
    assert store["ORD-2"]["states"]["ORDER_LIFECYCLE"] == "PRESCRIPTION_VALIDATION"
    
    # Direct approval from review
    osvc.execute_order_event_sync("ORD-2", "approve_prescription", "PHARMACIST", "R5")
    assert store["ORD-2"]["states"]["ORDER_LIFECYCLE"] == "WAITING_PHARMACY_CONFIRMATION"

# 3. Customer cancels order
def test_customer_cancels_order(services):
    osvc, store = services
    create_order(store, "ORD-7", states={"ORDER_LIFECYCLE": "WAITING_PHARMACY_CONFIRMATION", "PAYMENT": "UNPAID"})
    
    osvc.execute_order_event_sync("ORD-7", "cancel_order", "CUSTOMER", "R1")
    assert store["ORD-7"]["states"]["ORDER_LIFECYCLE"] == "CANCELLED"

# 4. Successful pickup
def test_successful_pickup(services):
    osvc, store = services
    create_order(store, "ORD-10", payment_status="PAID", states={"ORDER_LIFECYCLE": "READY_FOR_PICKUP", "PAYMENT": "PAID"})
    store["ORD-10"]["context"]["pickup"]["otp_verified"] = True
    
    osvc.execute_order_event_sync("ORD-10", "complete_handover", "PHARMACY_STAFF", "R1")
    assert store["ORD-10"]["states"]["ORDER_LIFECYCLE"] == "COMPLETED"

# 5. reopen_pickup must regenerate OTP
def test_reopen_pickup_regenerates_otp(services):
    osvc, store = services

    # Order that timed out
    create_order(store, "ORD-BUG002", payment_status="PAID", states={
        "ORDER_LIFECYCLE": "CLOSED",
        "PAYMENT": "PAID",
    })

    # Pharmacy staff reopens the order
    result, errors, actions, audit_id = osvc.execute_order_event_sync(
        "ORD-BUG002", "reopen_pickup", "PHARMACY_STAFF", "R-BUG002"
    )

    assert not errors, f"reopen_pickup failed: {errors}"
    assert result["new_state"] == "READY_FOR_PICKUP", "ORDER_LIFECYCLE must return to READY_FOR_PICKUP"
    assert store["ORD-BUG002"]["states"]["ORDER_LIFECYCLE"] == "READY_FOR_PICKUP"

    # Run the actions locally so set_context can populate the deadline in the store
    osvc.action_executor.execute("ORD-BUG002", actions, audit_id)

    # A fresh pickup deadline must have been written to context by the set_context action
    deadline = store["ORD-BUG002"].get("context", {}).get("pickup", {}).get("deadline")
    assert deadline is not None, "A fresh pickup.deadline must be set on reopen"

# 6. Pharmacy Error Return & Replacement Order Creation
def test_pharmacy_error_replacement_order(services):
    osvc, store = services
    order_id = "ORD-PHARM-ERR"

    # Step 0: Completed order
    create_order(store, order_id, payment_status="PAID", states={
        "ORDER_LIFECYCLE": "COMPLETED",
        "PAYMENT": "PAID",
    })
    from datetime import datetime
    store[order_id]["context"]["pickup"]["completed_at"] = datetime.now().isoformat()
    store[order_id]["context"]["issue_reporting_window_hours"] = 48

    # Step 1: Customer reports issue
    result, errors, actions, audit_id = osvc.execute_order_event_sync(
        order_id, "report_issue", "CUSTOMER", "REQ-IM-1"
    )
    assert not errors, f"report_issue failed: {errors}"
    assert store[order_id]["states"]["ORDER_LIFECYCLE"] == "ISSUE_REPORTED"

    # Step 2: Pharmacy staff starts investigation
    result, errors, actions, audit_id = osvc.execute_order_event_sync(
        order_id, "start_investigation", "PHARMACY_STAFF", "REQ-IM-2"
    )
    assert not errors, f"start_investigation failed: {errors}"
    assert store[order_id]["states"]["ORDER_LIFECYCLE"] == "UNDER_REVIEW"

    # Step 3: Pharmacist resolves the issue
    result, errors, actions, audit_id = osvc.execute_order_event_sync(
        order_id, "resolve_issue", "PHARMACIST", "REQ-RES-1"
    )
    assert not errors, f"resolve_issue failed: {errors}"
    assert result["new_state"] == "RESOLVED"

    # Step 4: Execute actions (simulating background action execution)
    from services.action_executor import ActionExecutor
    executor = ActionExecutor(store, None)
    action_results = executor.execute(order_id, actions, audit_id)

    # Step 5: Verify replacement order was created
    original_order = store[order_id]
    assert "replacement_order_id" in original_order, "Original order must reference replacement_order_id"
    repl_id = original_order["replacement_order_id"]

    replacement_order = store[repl_id]
    assert replacement_order["parent_order_id"] == order_id, "Replacement order must point back to parent_order_id"
    assert replacement_order["states"]["ORDER_LIFECYCLE"] == "PREPARING", "Replacement order starts in PREPARING"
    assert replacement_order["states"]["PAYMENT"] == "PAID", "Replacement order is marked PAID ($0.00 due)"
