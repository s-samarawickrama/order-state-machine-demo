import uuid
from copy import deepcopy
from datetime import datetime
from typing import Dict, Any, Optional, Tuple, List
from services.action_executor import ActionExecutor
from engine.policy_engine import PolicyEngine

class OrderService:
    def __init__(self, engine, store: Dict[str, Any], audit_service, action_executor: Optional[ActionExecutor] = None, policy_engine: Optional[PolicyEngine] = None):
        self.engine = engine
        self.store = store
        self.audit_service = audit_service
        self.action_executor = action_executor or ActionExecutor(store, audit_service)
        self.action_executor.order_service = self
        self.policy_engine = policy_engine or PolicyEngine()

    def _compute_derived_context(self, order: Dict[str, Any], evaluation_context: Dict[str, Any]) -> None:
        order_items = order.get("order_items", [])
        if order_items:
            num_available = sum(1 for item in order_items if item.get("availability_result") == "AVAILABLE")
            num_substituted = sum(1 for item in order_items if item.get("availability_result") == "BRAND_SUBSTITUTION_REQUIRED")
            
            if num_available == len(order_items):
                evaluation_context["availability"] = {"status": "AVAILABLE"}
            elif num_available > 0 or num_substituted > 0:
                evaluation_context["availability"] = {"status": "PARTIAL"}
            else:
                evaluation_context["availability"] = {"status": "UNAVAILABLE"}
        
        # Ensure context structure exists for rules to evaluate safely
        evaluation_context.setdefault("prescription", {"status": "NOT_REQUIRED"})
        evaluation_context.setdefault("payment", {"status": "UNPAID"})
        evaluation_context.setdefault("pickup", {"otp_verified": False})
        evaluation_context["states"] = order.get("states", {})

    def execute_order_event_sync(
        self, 
        order_id: str, 
        event: str, 
        role_claim: str,
        request_id: str,
        context_updates: Optional[Dict[str, Any]] = None
    ) -> Tuple[Optional[Dict[str, Any]], List[Dict[str, str]], List[Dict[str, Any]], Optional[str]]:
        order = self.store.get(order_id)
        if not order:
            raise LookupError(f"Order {order_id} not found.")

        if context_updates:
            self._apply_updates(order["context"], context_updates)

        evaluation_context = deepcopy(order["context"])
        evaluation_context["user_role"] = role_claim
        self._compute_derived_context(order, evaluation_context)

        decision, errors = self.engine.execute_transition_with_reasons(
            current_states=order["states"],
            event=event,
            workflow_context=evaluation_context
        )

        if errors:
            return None, errors, [], None

        # Automatically log cancellation, rejection, or clarification with reasons in chat history
        if event in ("cancel_order", "reject_prescription", "request_clarification", "reject_claim") and context_updates and "reason" in context_updates:
            reason = context_updates["reason"]
            order.setdefault("chat_messages", []).append({
                "sender": role_claim,
                "message": f"Action: {event.replace('_', ' ').title()}. Reason: {reason}",
                "timestamp": datetime.now().isoformat()
            })

        wf_name = decision["workflow"]
        previous_state = order["states"][wf_name]
        next_state = decision["next_state"]

        # 1. State-first commit
        order["states"][wf_name] = next_state

        # --- Policy Engine Post-Transition Hook ---
        if wf_name == "ORDER_LIFECYCLE" and next_state == "COMPLETED":
            order.setdefault("context", {}).setdefault("pickup", {})["completed_at"] = datetime.now().isoformat()
            order.setdefault("context", {})["issue_reporting_window_hours"] = order.get("context", {}).get("issue_reporting_window_hours", 48)

        if event == "cancel_order" and wf_name == "ORDER_LIFECYCLE":
            policy_res = self.policy_engine.evaluate_cancellation(order, previous_state)
            order.setdefault("context", {})["late_cancellation"] = policy_res.get("late_cancellation", False)
            if policy_res.get("cancel_stage"):
                order["context"]["cancel_stage"] = policy_res["cancel_stage"]
            
            order["context"]["refund_authorized"] = policy_res.get("refund_authorized", False)
            order["context"]["late_cancel_count"] = policy_res.get("late_cancel_count", 0)
            
            if policy_res.get("chat_message"):
                order.setdefault("chat_messages", []).append({
                    "sender": "SYSTEM",
                    "message": policy_res["chat_message"],
                    "timestamp": datetime.now().isoformat()
                })
            
            # Execute refund if authorized
            is_paid = order["states"].get("PAYMENT") == "PAID"
            if order.get("context", {}).get("refund_authorized") is True and is_paid:
                try:
                    self.execute_order_event_sync(
                        order_id=order_id,
                        event="refund_payment",
                        role_claim="SYSTEM",
                        request_id=f"AUTO-REF-{order_id}"
                    )
                except Exception:
                    pass

        elif event == "resolve_issue" and wf_name == "ORDER_LIFECYCLE" and next_state == "RESOLVED":
            policy_res = self.policy_engine.evaluate_issue_resolution(order)
            order.setdefault("context", {})["refund_authorized"] = policy_res.get("refund_authorized", True)
            if order["states"].get("PAYMENT") == "PAID":
                try:
                    self.execute_order_event_sync(
                        order_id=order_id,
                        event="refund_payment",
                        role_claim="SYSTEM",
                        request_id=f"AUTO-REF-DISP-{order_id}"
                    )
                except Exception:
                    pass

        elif event == "pickup_deadline_expired" and wf_name == "ORDER_LIFECYCLE":
            policy_res = self.policy_engine.evaluate_no_show(order)
            order.setdefault("context", {})["no_show_count"] = policy_res.get("no_show_count", 0)
            
            if policy_res.get("chat_message"):
                order.setdefault("chat_messages", []).append({
                    "sender": "SYSTEM",
                    "message": policy_res["chat_message"],
                    "timestamp": datetime.now().isoformat()
                })
        # ------------------------------------------

        policy = decision["transition"].get("policy")

        # 2. Append to immutable entity event history
        event_record = {
            "event_id": f"EVT-{uuid.uuid4().hex[:6].upper()}",
            "order_id": order_id,
            "workflow": wf_name,
            "event": event,
            "previous_state": previous_state,
            "new_state": next_state,
            "performed_by": role_claim,
            "request_id": request_id,
            "timestamp": datetime.now().isoformat()
        }
        if policy:
            event_record["policy"] = policy
            
        order.setdefault("order_event_history", []).append(event_record)

        # 3. Create initial audit log entry
        audit_context = deepcopy(evaluation_context)
        if policy:
            audit_context["policy"] = policy
            
        audit_id = self.audit_service.log(
            request_id=request_id,
            order_id=order_id,
            transition_id=decision["transition"]["id"],
            from_state=previous_state,
            to_state=next_state,
            event=event,
            context=audit_context,
            action_results=[]
        )

        actions_to_dispatch = decision.get("actions", [])
        if actions_to_dispatch:
            self.action_executor.execute(order_id, actions_to_dispatch, audit_id)

        return {
            "success": True,
            "order_id": order_id,
            "workflow": wf_name,
            "previous_state": previous_state,
            "new_state": next_state,
            "transition_id": decision["transition"]["id"],
            "audit_id": audit_id
        }, [], actions_to_dispatch, audit_id

    def _apply_updates(self, d: Dict[str, Any], u: Dict[str, Any]):
        for k, v in u.items():
            if isinstance(v, dict) and k in d and isinstance(d[k], dict):
                self._apply_updates(d[k], v)
            else:
                d[k] = v

    def simulate_transition(
        self,
        order_id: str,
        event: str,
        role_claim: str,
        context_updates: Optional[Dict[str, Any]] = None
    ) -> Tuple[Optional[Dict[str, Any]], List[Dict[str, str]]]:
        order = self.store.get(order_id)
        if not order:
            raise LookupError(f"Order {order_id} not found.")

        evaluation_context = deepcopy(order["context"])
        if context_updates:
            self._apply_updates(evaluation_context, context_updates)

        evaluation_context["user_role"] = role_claim
        temp_order = deepcopy(order)
        temp_order["context"] = evaluation_context
        self._compute_derived_context(temp_order, evaluation_context)

        # BUG-005 fix: if context_updates includes state overrides, apply them
        # _compute_derived_context sets states from temp_order["states"] (original).
        # Any state overrides in context_updates must be merged on top.
        if context_updates and "states" in context_updates:
            evaluation_context["states"].update(context_updates["states"])

        return self.engine.execute_transition_with_reasons(
            current_states=order["states"],
            event=event,
            workflow_context=evaluation_context
        )

    def get_order(self, order_id: str, role_claim: str = "SYSTEM") -> Optional[Dict[str, Any]]:
        order = self.store.get(order_id)
        if order:
            # BUG-004 fix: build a clean evaluation context — do NOT mutate order["context"] in place.
            # _compute_derived_context previously wrote "states" into order["context"],
            # permanently polluting the stored context on every GET.
            evaluation_context = deepcopy(order["context"])
            evaluation_context["user_role"] = role_claim
            self._compute_derived_context(order, evaluation_context)
            actions = self.engine.get_available_actions(order["states"], evaluation_context, role_claim)

            result = dict(order)
            result["available_actions"] = actions
            return result
        return order
