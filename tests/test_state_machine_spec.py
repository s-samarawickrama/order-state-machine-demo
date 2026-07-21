import json
from api.dependencies import ORDERS_DATABASE, order_service
from engine.workflow_engine import WorkflowEngine
from engine.validator import WorkflowValidator


def load_config():
    with open("config/transitions.json", "r") as f:
        return json.load(f)


def test_payment_is_blocked_before_customer_confirmation():
    config = load_config()
    WorkflowValidator.validate(config)
    engine = WorkflowEngine(config)

    current_states = {
        "ORDER_LIFECYCLE": "WAITING_PHARMACY_CONFIRMATION",
        "PAYMENT": "UNPAID",
        "PICKUP_VERIFICATION": "WAITING_FOR_PICKUP",
        "ISSUE_MANAGEMENT": "NO_ISSUE",
        "PRESCRIPTION_VALIDATION": "UPLOADED",
    }
    context = {"states": current_states, "user_role": "CUSTOMER"}

    decision, errors = engine.execute_transition_with_reasons(
        current_states=current_states,
        event="pay_online",
        workflow_context=context,
    )

    assert decision is None
    assert any(error["code"] == "PAYMENT_NOT_ALLOWED_YET" for error in errors)


def test_payment_becomes_available_after_customer_confirmation():
    config = load_config()
    WorkflowValidator.validate(config)
    engine = WorkflowEngine(config)

    current_states = {
        "ORDER_LIFECYCLE": "PREPARING",
        "PAYMENT": "UNPAID",
        "PICKUP_VERIFICATION": "WAITING_FOR_PICKUP",
        "ISSUE_MANAGEMENT": "NO_ISSUE",
    }
    context = {"states": current_states, "user_role": "CUSTOMER"}

    decision, errors = engine.execute_transition_with_reasons(
        current_states=current_states,
        event="pay_online",
        workflow_context=context,
    )

    assert not errors
    assert decision is not None
    assert decision["next_state"] == "PAID"


def test_handover_requires_otp_and_payment():
    config = load_config()
    WorkflowValidator.validate(config)
    engine = WorkflowEngine(config)

    current_states = {
        "ORDER_LIFECYCLE": "READY_FOR_PICKUP",
        "PAYMENT": "UNPAID",
        "PICKUP_VERIFICATION": "OTP_VERIFIED",
        "ISSUE_MANAGEMENT": "NO_ISSUE",
    }
    context = {"states": current_states, "user_role": "PHARMACY_STAFF"}

    decision, errors = engine.execute_transition_with_reasons(
        current_states=current_states,
        event="complete_handover",
        workflow_context=context,
    )

    assert decision is None
    assert any(error["code"] == "PAYMENT_REQUIRED" for error in errors)


def test_prescription_approval_requires_pharmacist():
    config = load_config()
    WorkflowValidator.validate(config)
    engine = WorkflowEngine(config)

    current_states = {
        "ORDER_LIFECYCLE": "SUBMITTED",
        "PAYMENT": "UNPAID",
        "PICKUP_VERIFICATION": "WAITING_FOR_PICKUP",
        "ISSUE_MANAGEMENT": "NO_ISSUE",
        "PRESCRIPTION_VALIDATION": "PHARMACIST_REVIEW",
    }
    context = {"states": current_states, "user_role": "CUSTOMER"}

    decision, errors = engine.execute_transition_with_reasons(
        current_states=current_states,
        event="approve_prescription",
        workflow_context=context,
    )

    assert decision is None
    assert any(error["code"] == "UNAUTHORIZED_ROLE" for error in errors)


def test_issue_management_starts_after_completion():
    config = load_config()
    WorkflowValidator.validate(config)
    engine = WorkflowEngine(config)

    current_states = {
        "ORDER_LIFECYCLE": "SUBMITTED",
        "PAYMENT": "PAID",
        "PICKUP_VERIFICATION": "WAITING_FOR_PICKUP",
        "ISSUE_MANAGEMENT": "NO_ISSUE",
    }
    context = {"states": current_states, "user_role": "CUSTOMER"}

    decision, errors = engine.execute_transition_with_reasons(
        current_states=current_states,
        event="report_issue",
        workflow_context=context,
    )

    assert decision is None
    assert any(error["code"] == "ORDER_NOT_COMPLETED" for error in errors)


def test_prescription_submit_routes_to_pharmacist_when_score_is_high():
    order_id = "TEST-RX-ROUTE"
    ORDERS_DATABASE[order_id] = {
        "order_id": order_id,
        "order_type": "PRESCRIPTION",
        "states": {
            "ORDER_LIFECYCLE": "DRAFT",
            "PAYMENT": "UNPAID",
            "PICKUP_VERIFICATION": "WAITING_FOR_PICKUP",
            "ISSUE_MANAGEMENT": "NO_ISSUE"
        },
        "customer_id": "CUS-001",
        "chat_messages": [],
        "context": {
            "order_type": "PRESCRIPTION",
            "prescription": {"clarity_score": 75},
            "pickup": {"otp_generated": False, "otp_verified": False, "deadline": None},
            "availability": {"status": "AVAILABLE"},
        },
        "order_items": [],
        "order_event_history": [],
        "notifications": [],
        "reservations": {},
    }

    order_service.execute_order_event_sync(order_id, "submit_order", "CUSTOMER", "REQ-RX")

    assert ORDERS_DATABASE[order_id]["states"]["PRESCRIPTION_VALIDATION"] == "PHARMACIST_REVIEW"


def test_pharmacist_can_reject_prescription_or_cancel_order_during_review():
    config = load_config()
    WorkflowValidator.validate(config)
    engine = WorkflowEngine(config)

    # State during review phase
    current_states = {
        "ORDER_LIFECYCLE": "WAITING_PHARMACY_CONFIRMATION",
        "PRESCRIPTION_VALIDATION": "PHARMACIST_REVIEW",
        "PAYMENT": "UNPAID",
        "PICKUP_VERIFICATION": "WAITING_FOR_PICKUP",
        "ISSUE_MANAGEMENT": "NO_ISSUE",
    }
    context = {"states": current_states, "user_role": "PHARMACIST"}

    # 1. Pharmacist rejects prescription -> PRESCRIPTION_VALIDATION moves to REJECTED
    decision_reject, errors_reject = engine.execute_transition_with_reasons(
        current_states=current_states,
        event="reject_prescription",
        workflow_context=context,
    )
    assert errors_reject == []
    assert decision_reject is not None
    assert decision_reject["next_state"] == "REJECTED"

    # 2. Pharmacist cancels entire order -> ORDER_LIFECYCLE moves to CANCELLED
    decision_cancel, errors_cancel = engine.execute_transition_with_reasons(
        current_states=current_states,
        event="cancel_order",
        workflow_context=context,
    )
    assert errors_cancel == []
    assert decision_cancel is not None
    assert decision_cancel["next_state"] == "CANCELLED"


