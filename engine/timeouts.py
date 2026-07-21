"""
MediPick Timeout & Expiration Manager

In this simulator, timeouts (e.g., the 48-hour pickup deadline) are triggered 
manually via the simulator dashboard or evaluated dynamically on transition queries.

For a production environment, this module would run as a background task runner 
(e.g., using Celery Beat or APScheduler) to automatically query and transition expired orders.
"""

from datetime import datetime
from typing import Dict, Any, List

class TimeoutManager:
    def __init__(self, store: Dict[str, Any], order_service):
        self.store = store
        self.order_service = order_service

    def scan_and_expire_orders(self) -> List[str]:
        """
        Production draft: Scans database for orders in READY_FOR_PICKUP 
        where the deadline has passed, and dispatches the 'pickup_deadline_expired' event.
        """
        expired_order_ids = []
        now = datetime.now()

        for order_id, order in self.store.items():
            states = order.get("states", {})
            context = order.get("context", {})
            
            # Check if order is waiting for pickup and deadline has passed
            if states.get("ORDER_LIFECYCLE") == "READY_FOR_PICKUP":
                deadline_str = context.get("pickup", {}).get("deadline")
                if deadline_str:
                    try:
                        deadline = datetime.fromisoformat(deadline_str)
                        if now > deadline:
                            # Trigger the expiry event automatically as SYSTEM
                            self.order_service.execute_order_event_sync(
                                order_id=order_id,
                                event="pickup_deadline_expired",
                                role_claim="SYSTEM",
                                request_id=f"TIMEOUT-CRON-{order_id}"
                            )
                            expired_order_ids.append(order_id)
                    except Exception:
                        pass
        return expired_order_ids
