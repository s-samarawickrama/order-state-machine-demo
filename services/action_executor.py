from datetime import datetime
from typing import List, Dict, Any

class ActionExecutor:
    def __init__(self, store: Dict[str, Any], audit_service=None):
        self.store = store
        self.audit_service = audit_service

    def execute(self, order_id: str, actions: List[Dict[str, Any]], audit_id: str = None) -> List[Dict[str, Any]]:
        results = []
        order = self.store.get(order_id)

        for action in actions:
            action_type = action.get("type")
            try:
                if action_type == "CREATE_NOTIFICATION":
                    title = action.get("title", "Order Update")
                    message_text = action.get("message", "Status updated.")

                    if order:
                        order.setdefault("notifications", []).append({
                            "title": title,
                            "message": message_text,
                            "timestamp": datetime.now().isoformat()
                        })

                    results.append({"action": action_type, "status": "SUCCESS", "title": title})

                elif action_type == "CLOSE_ORDER":
                    if order:
                        order["context"].setdefault("order", {})["cancellable"] = False
                    results.append({"action": action_type, "status": "SUCCESS", "details": "Order marked archived"})

                elif action_type == "CREATE_RESERVATION":
                    if order:
                        # Log reservation creation in order state
                        order.setdefault("reservations", {})["status"] = "RESERVED"
                        order["reservations"]["timestamp"] = datetime.now().isoformat()
                    results.append({"action": action_type, "status": "SUCCESS", "details": "Medicine stock reserved"})

                elif action_type == "RELEASE_RESERVATION":
                    if order:
                        order.setdefault("reservations", {})["status"] = "RELEASED"
                        order["reservations"]["released_at"] = datetime.now().isoformat()
                    results.append({"action": action_type, "status": "SUCCESS", "details": "Medicine reservation released"})


                elif action_type == "REFUND_PAYMENT":
                    if order:
                        order["context"]["payment_status"] = "REFUNDED"
                    results.append({"action": action_type, "status": "SUCCESS", "details": "Gateway refund requested"})

                elif action_type == "STRIP_UNAVAILABLE_ITEMS":
                    if order and "order_items" in order:
                        order["order_items"] = [
                            item for item in order["order_items"] 
                            if item.get("availability_result") == "AVAILABLE"
                        ]
                        order["context"]["fulfillment_availability_checked"] = True
                    results.append({"action": action_type, "status": "SUCCESS", "details": "Unavailable items removed"})

                elif action_type == "LOG_SECURITY_EVENT":
                    results.append({"action": action_type, "status": "SUCCESS", "event": action.get("event")})

                elif action_type == "DISPATCH_EVENT":
                    # This allows a transition in one workflow to automatically trigger an event in another.
                    # For example, marking an order ready can dispatch the 'request_pickup_otp' event automatically.
                    event_to_dispatch = action.get("event")
                    if order and event_to_dispatch:
                        from api.dependencies import order_service
                        # We must dispatch this asynchronously or directly if we have the service.
                        # For simplicity in this executor, we can just invoke the order_service sync method.
                        try:
                            # Use SYSTEM role for automatic internal dispatches
                            order_service.execute_order_event_sync(
                                order_id=order_id, 
                                event=event_to_dispatch, 
                                role_claim="SYSTEM", 
                                request_id=f"AUTO-{order_id}"
                            )
                            results.append({"action": action_type, "status": "SUCCESS", "dispatched": event_to_dispatch})
                        except Exception as e:
                            results.append({"action": action_type, "status": "FAILED", "error": f"Failed to dispatch {event_to_dispatch}: {str(e)}"})

                elif action_type == "CREATE_REPLACEMENT_ORDER":
                    if order:
                        import uuid
                        replacement_id = f"REPL-{uuid.uuid4().hex[:4].upper()}"
                        replacement_order = {
                            "order_id": replacement_id,
                            "parent_order_id": order_id,
                            "order_type": order.get("order_type", "OTC"),
                            "is_replacement": True,
                            "states": {
                                "ORDER_LIFECYCLE": "PREPARING",
                                "PAYMENT": "PAID",
                                "PICKUP_VERIFICATION": "WAITING_FOR_PICKUP",
                                "ISSUE_MANAGEMENT": "NO_ISSUE"
                            },
                            "customer_id": order.get("customer_id", "CUS-001"),
                            "chat_messages": [],
                            "context": {
                                "order_type": order.get("order_type", "OTC"),
                                "parent_order_id": order_id,
                                "prescription": {"status": "APPROVED"},
                                "payment": {"status": "PAID", "amount_due": 0.0},
                                "pickup": {"otp_generated": False, "otp_verified": False, "deadline": None},
                                "availability": {"status": "AVAILABLE"}
                            },
                            "order_items": order.get("order_items", []),
                            "order_event_history": [{
                                "event_id": f"EVT-{uuid.uuid4().hex[:6].upper()}",
                                "order_id": replacement_id,
                                "workflow": "ORDER_LIFECYCLE",
                                "event": "create_replacement",
                                "previous_state": None,
                                "new_state": "PREPARING_ORDER",
                                "performed_by": "SYSTEM",
                                "timestamp": datetime.now().isoformat()
                            }],
                            "notifications": [{
                                "title": "Replacement Order Created",
                                "message": f"Replacement order {replacement_id} created for parent order {order_id}.",
                                "timestamp": datetime.now().isoformat()
                            }],
                            "reservations": {"status": "RESERVED", "timestamp": datetime.now().isoformat()}
                        }
                        self.store[replacement_id] = replacement_order
                        order["replacement_order_id"] = replacement_id
                        results.append({"action": action_type, "status": "SUCCESS", "replacement_order_id": replacement_id})
                    else:
                        results.append({"action": action_type, "status": "FAILED", "error": "Order not found"})

                elif action_type == "set_context":
                    path = action.get("path")
                    value = action.get("value")
                    if order and path:
                        keys = path.split(".")
                        current = order.setdefault("context", {})
                        for key in keys[:-1]:
                            if not isinstance(current, dict):
                                current = {}
                            current = current.setdefault(key, {})
                        
                        if isinstance(value, str) and value.startswith("+") and value.endswith("h"):
                            from datetime import timedelta
                            hours = int(value[1:-1])
                            value = (datetime.now() + timedelta(hours=hours)).isoformat()
                            
                        if isinstance(current, dict):
                            current[keys[-1]] = value
                    results.append({"action": action_type, "status": "SUCCESS", "details": f"Context {path} updated"})

                else:
                    results.append({"action": action_type, "status": "UNKNOWN", "details": "Unrecognized action type"})
                    
            except Exception as e:
                results.append({"action": action_type, "status": "FAILED", "error": str(e)})

        if audit_id and self.audit_service:
            self.audit_service.update_actions(audit_id, results)

        return results
