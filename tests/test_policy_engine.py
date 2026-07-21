import pytest
from engine.policy_engine import PolicyEngine

def test_cancellation_policy_normal():
    engine = PolicyEngine()
    order = {
        "states": {"PAYMENT": "PAID"},
        "context": {}
    }
    # Cancel in normal state
    res = engine.evaluate_cancellation(order, previous_state="WAITING_CUSTOMER_CONFIRMATION")
    assert res["late_cancellation"] is False
    assert res["refund_authorized"] is True
    assert "NORMAL" in res["chat_message"]

def test_cancellation_policy_late_authorized():
    engine = PolicyEngine()
    order = {
        "states": {"PAYMENT": "PAID"},
        "context": {"late_cancel_count": 1}
    }
    res = engine.evaluate_cancellation(order, previous_state="PREPARING")
    assert res["late_cancellation"] is True
    assert res["refund_authorized"] is True
    assert res["late_cancel_count"] == 2
    assert "Penalty recorded" in res["chat_message"]

def test_cancellation_policy_late_abuser():
    engine = PolicyEngine()
    order = {
        "states": {"PAYMENT": "PAID"},
        "context": {"late_cancel_count": 3}
    }
    res = engine.evaluate_cancellation(order, previous_state="PREPARING")
    assert res["late_cancellation"] is True
    assert res["refund_authorized"] is False
    assert "manual review" in res["chat_message"]

def test_cancellation_policy_special_item():
    engine = PolicyEngine()
    order = {
        "states": {"PAYMENT": "PAID"},
        "context": {"late_cancel_count": 0, "is_special_item": True}
    }
    res = engine.evaluate_cancellation(order, previous_state="READY_FOR_PICKUP")
    assert res["late_cancellation"] is True
    assert res["refund_authorized"] is False
    assert "manual review" in res["chat_message"]

def test_no_show_policy():
    engine = PolicyEngine()
    order = {
        "states": {"PAYMENT": "PAID"},
        "context": {"no_show_count": 1}
    }
    res = engine.evaluate_no_show(order)
    assert res["no_show_count"] == 2
    assert res["refund_authorized"] is False
    assert "No-show recorded" in res["chat_message"]
