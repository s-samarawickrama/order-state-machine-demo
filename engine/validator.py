from collections import deque
from typing import Dict, Any, Set

class WorkflowValidator:
    @staticmethod
    def validate(config: Dict[str, Any]) -> None:
        if "workflows" not in config:
            raise ValueError("Configuration missing required top-level key: workflows")

        for wf_name, wf_config in config["workflows"].items():
            WorkflowValidator._validate_workflow(wf_name, wf_config)

    @staticmethod
    def _validate_workflow(wf_name: str, config: Dict[str, Any]) -> None:
        required_keys = {"initial_state", "states", "transitions"}
        if not required_keys.issubset(config.keys()):
            raise ValueError(f"Workflow '{wf_name}' missing required keys: {required_keys - config.keys()}")

        states = config.get("states", [])
        if not states:
            raise ValueError(f"Workflow '{wf_name}' must define at least one state.")

        state_ids: Set[str] = set()
        for s in states:
            if "id" not in s:
                raise ValueError(f"Workflow '{wf_name}' has a state missing an 'id' field.")
            if s["id"] in state_ids:
                raise ValueError(f"Workflow '{wf_name}' has duplicate state ID: {s['id']}")
            state_ids.add(s["id"])

        initial_state = config.get("initial_state")
        if not initial_state or initial_state not in state_ids:
            raise ValueError(f"Workflow '{wf_name}' has invalid or missing initial_state: '{initial_state}'")

        terminal_states = set(config.get("terminal_states", []))

        transition_ids: Set[str] = set()
        transition_keys = set()

        for t in config.get("transitions", []):
            for req in ("id", "current_state", "event", "next_state"):
                if req not in t:
                    raise ValueError(f"Workflow '{wf_name}' transition missing required field '{req}': {t}")
            
            if t["id"] in transition_ids:
                raise ValueError(f"Workflow '{wf_name}' duplicate transition ID detected: {t['id']}")
            transition_ids.add(t["id"])

            trigger_key = (t["current_state"], t["event"])
            has_conditions = bool(t.get("conditions") or t.get("condition"))
            if trigger_key in transition_keys and not has_conditions:
                # Only flag as ambiguous if NEITHER transition in the collision has conditions.
                # Multiple transitions sharing the same (state, event) key are valid when
                # they use conditions + priority to form conditional routing branches.
                # See: OL-002-OTC / OL-002-RX / OL-002-MIXED in transitions.json.
                raise ValueError(
                    f"Workflow '{wf_name}' ambiguous transition trigger detected for state "
                    f"'{t['current_state']}' and event '{t['event']}'. "
                    f"Add conditions and a 'priority' field to disambiguate."
                )
            transition_keys.add(trigger_key)

            if t["current_state"] not in state_ids:
                raise ValueError(f"Workflow '{wf_name}' Transition {t['id']} references unknown current_state '{t['current_state']}'")
            if t["next_state"] not in state_ids:
                raise ValueError(f"Workflow '{wf_name}' Transition {t['id']} references unknown next_state '{t['next_state']}'")

        reachable: Set[str] = {initial_state}
        queue = deque([initial_state])

        while queue:
            curr = queue.popleft()
            for t in config.get("transitions", []):
                if t["current_state"] == curr and t["next_state"] not in reachable:
                    reachable.add(t["next_state"])
                    queue.append(t["next_state"])

        unreachable = state_ids - reachable
        if unreachable:
            raise ValueError(f"Workflow '{wf_name}' unreachable states detected: {unreachable}")

        for s_id in state_ids:
            outgoing = [t for t in config.get("transitions", []) if t["current_state"] == s_id]
            if not outgoing and s_id not in terminal_states:
                raise ValueError(f"Workflow '{wf_name}' Dead-end state detected: State '{s_id}' has no outgoing transitions but is not designated terminal.")
