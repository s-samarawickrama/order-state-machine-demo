from typing import Dict, Any, List, Optional, Tuple
from engine.condition_evaluator import ConditionEvaluator

class WorkflowEngine:
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.workflows = config.get("workflows", {})

    def _is_role_allowed(self, transition: Dict[str, Any], workflow_context: Dict[str, Any]) -> bool:
        allowed_roles = transition.get("allowed_roles")
        if not allowed_roles:
            return True
        user_role = workflow_context.get("user_role")
        return user_role in allowed_roles

    def execute_transition_with_reasons(
        self, 
        current_states: Dict[str, str], 
        event: str, 
        workflow_context: Dict[str, Any]
    ) -> Tuple[Optional[Dict[str, Any]], List[Dict[str, str]]]:
        
        matched_event_exists = False
        
        # Search all active workflows for a transition matching the current state in that workflow + event
        for wf_name, wf_config in self.workflows.items():
            curr_state = current_states.get(wf_name)
            if not curr_state:
                continue

            transitions = sorted(wf_config.get("transitions", []), key=lambda x: x.get("priority", 0), reverse=True)
            for t in transitions:
                if t["current_state"] == curr_state and t["event"] == event:
                    matched_event_exists = True

                    if not self._is_role_allowed(t, workflow_context):
                        allowed = ", ".join(t.get("allowed_roles", []))
                        return None, [{
                            "code": "UNAUTHORIZED_ROLE",
                            "severity": "BLOCKING",
                            "message": f"Access denied: Action '{event}' requires one of roles [{allowed}]."
                        }]

                    validation_errors = t.get("validation_errors", {})
                    conditions = t.get("conditions", t.get("condition", []))
                    passed, errors = ConditionEvaluator.evaluate_detailed(
                        conditions, 
                        workflow_context, 
                        validation_errors
                    )

                    if not passed:
                        return None, errors

                    return {
                        "success": True,
                        "workflow": wf_name,
                        "transition": t,
                        "from_state": curr_state,
                        "next_state": t["next_state"],
                        "actions": t.get("actions", [])
                    }, []

        if not matched_event_exists:
            return None, [{
                "code": "INVALID_EVENT",
                "severity": "BLOCKING",
                "message": f"Invalid event '{event}' for current state configuration."
            }]

        return None, [{
            "code": "CONDITIONS_UNMET",
            "severity": "BLOCKING",
            "message": "Transition conditions not met."
        }]

    def get_available_actions(self, current_states: Dict[str, str], workflow_context: Dict[str, Any], user_role: str) -> List[Dict[str, Any]]:
        actions = []
        ctx = dict(workflow_context)
        ctx["user_role"] = user_role
        
        for wf_name, wf_config in self.workflows.items():
            curr_state = current_states.get(wf_name)
            if not curr_state:
                continue
                
            transitions = wf_config.get("transitions", [])
            for t in transitions:
                if t["current_state"] == curr_state:
                    is_allowed = self._is_role_allowed(t, ctx)
                    if not is_allowed:
                        allowed = ", ".join(t.get("allowed_roles", []))
                        actions.append({
                            "workflow": wf_name,
                            "event": t["event"],
                            "display_name": t.get("label", t["event"]),
                            "danger": t.get("danger", False),
                            "allowed_roles": t.get("allowed_roles", []),
                            "allowed": False,
                            "errors": [{
                                "code": "UNAUTHORIZED_ROLE",
                                "severity": "BLOCKING",
                                "message": f"Access denied: Action '{t['event']}' requires one of roles [{allowed}]."
                            }]
                        })
                        continue
                    
                    validation_errors = t.get("validation_errors", {})
                    conditions = t.get("conditions", t.get("condition", []))
                    passed, errors = ConditionEvaluator.evaluate_detailed(
                        conditions, 
                        ctx, 
                        validation_errors
                    )
                    
                    actions.append({
                        "workflow": wf_name,
                        "event": t["event"],
                        "display_name": t.get("label", t["event"]),
                        "danger": t.get("danger", False),
                        "allowed_roles": t.get("allowed_roles", []),
                        "allowed": passed,
                        "errors": errors if not passed else []
                    })
        return actions
