import json
from datetime import datetime
from typing import Dict, Any, Tuple

class PolicyEngine:
    def __init__(self, config_path: str = "config/policies.json"):
        try:
            with open(config_path, "r") as f:
                self.config = json.load(f)
        except Exception:
            self.config = {
                "cancellation": {
                    "late_cancel_states": ["PREPARING", "READY_FOR_PICKUP"],
                    "max_late_cancellations": 3
                },
                "no_show": {
                    "increase_count": true
                }
            }

    def evaluate_cancellation(self, order: Dict[str, Any], previous_state: str) -> Dict[str, Any]:
        cancel_cfg = self.config.get("cancellation", {})
        late_cancel_states = cancel_cfg.get("late_cancel_states", ["PREPARING", "READY_FOR_PICKUP"])
        max_late = cancel_cfg.get("max_late_cancellations", 3)

        is_late = previous_state in late_cancel_states
        is_paid = order.get("states", {}).get("PAYMENT") == "PAID"
        
        context = order.get("context", {})
        late_cancel_count = context.get("late_cancel_count", 0)
        is_special = context.get("is_special_item", False)

        result = {
            "late_cancellation": is_late,
            "refund_authorized": False,
            "late_cancel_count": late_cancel_count,
            "chat_message": "",
            "cancel_stage": previous_state if is_late else None
        }

        if not is_late:
            # Normal cancellation
            if is_paid:
                result["refund_authorized"] = True
            result["chat_message"] = "Cancellation type: NORMAL. Reason: Customer cancelled before preparation."
        else:
            # Late cancellation
            if late_cancel_count >= max_late or is_special:
                # Abuser or special item
                result["refund_authorized"] = False
                result["chat_message"] = f"Cancellation type: LATE. Refund requires manual review (Count: {late_cancel_count}, Special Item: {is_special})."
            else:
                if is_paid:
                    result["refund_authorized"] = True
                result["late_cancel_count"] = late_cancel_count + 1
                result["chat_message"] = "Cancellation type: LATE. Refund authorized. Penalty recorded."

        return result

    def evaluate_no_show(self, order: Dict[str, Any]) -> Dict[str, Any]:
        is_paid = order.get("states", {}).get("PAYMENT") == "PAID"
        context = order.get("context", {})
        no_show_count = context.get("no_show_count", 0) + 1

        result = {
            "no_show_count": no_show_count,
            "refund_authorized": False,  # No-show does not automatically refund
            "chat_message": "Customer failed to collect order. No-show recorded."
        }
        
        return result

    def evaluate_issue_resolution(self, order: Dict[str, Any]) -> Dict[str, Any]:
        return {
            "refund_authorized": True
        }
