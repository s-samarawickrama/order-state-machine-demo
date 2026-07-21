import copy
import uuid
from datetime import datetime
from typing import Dict, Any, List

class AuditService:
    def __init__(self):
        self._history: List[Dict[str, Any]] = []

    def log(
        self, 
        request_id: str, 
        order_id: str, 
        transition_id: str, 
        from_state: str, 
        to_state: str, 
        event: str, 
        context: Dict[str, Any], 
        action_results: List[Dict[str, Any]] = None
    ) -> str:
        audit_id = f"AUD-{uuid.uuid4().hex[:8].upper()}"
        record = {
            "audit_id": audit_id,
            "request_id": request_id,
            "order_id": order_id,
            "transition": {
                "transition_id": transition_id,
                "from": from_state,
                "to": to_state,
                "event": event
            },
            "actions": action_results or [],
            "workflow_context": copy.deepcopy(context),
            "timestamp": datetime.now().isoformat()
        }
        self._history.append(record)
        return audit_id

    def update_actions(self, audit_id: str, action_results: List[Dict[str, Any]]) -> None:
        for record in self._history:
            if record["audit_id"] == audit_id:
                record["actions"] = action_results
                break

    def get_all(self) -> List[Dict[str, Any]]:
        return self._history
