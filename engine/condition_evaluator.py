from typing import Dict, Any, Tuple, List

class ConditionEvaluator:
    @staticmethod
    def get_nested_value(data: Dict[str, Any], path: str) -> Any:
        keys = path.split(".")
        val = data
        for k in keys:
            if isinstance(val, dict):
                val = val.get(k)
            else:
                return None
        return val

    @classmethod
    def evaluate_detailed(
        cls, 
        conditions: List[Dict[str, Any]], 
        workflow_context: Dict[str, Any], 
        validation_errors_meta: Dict[str, Any]
    ) -> Tuple[bool, List[Dict[str, str]]]:
        failures = []

        if not isinstance(conditions, list):
            # Fallback for old tests/dicts if any
            conditions_list = []
            if isinstance(conditions, dict):
                for k, v in conditions.items():
                    conditions_list.append({"field": k, "operator": "equals", "value": v})
            conditions = conditions_list

        for condition in conditions:
            field = condition.get("field", condition.get("path"))
            op = condition.get("operator", "equals")
            expected = condition.get("value")

            if field is None:
                continue

            val = cls.get_nested_value(workflow_context, field)
            passed = True

            if val is None and op != "not_equals" and op != "not_in" and not (op == "in" and isinstance(expected, (list, tuple, set)) and None in expected):
                passed = False
            elif op == "equals" and not (val == expected): passed = False
            elif op == "not_equals" and not (val != expected): passed = False
            elif op == "greater_than" and not (val > expected): passed = False
            elif (op == "less_than" or op == "lt") and not (val < expected): passed = False
            elif op == "gte" and not (val >= expected): passed = False
            elif op == "lte" and not (val <= expected): passed = False
            elif op == "in" and val not in expected: passed = False
            elif op == "not_in" and val in expected: passed = False
            elif op == "within_hours":
                try:
                    from datetime import datetime
                    completed_time = datetime.fromisoformat(val)
                    limit_val = expected
                    if isinstance(expected, str) and not str(expected).isdigit():
                        limit_val = cls.get_nested_value(workflow_context, expected)
                    
                    limit_hours = float(limit_val) if limit_val is not None else 48.0
                    elapsed_seconds = (datetime.now() - completed_time).total_seconds()
                    passed = (elapsed_seconds / 3600.0) <= limit_hours
                except Exception:
                    passed = False

            if not passed:
                err_meta = validation_errors_meta.get(field, {
                    "code": "CONDITION_FAILED",
                    "severity": "BLOCKING",
                    "message": f"Condition rule '{field}' failed (expected {expected}, got {val})."
                })
                failures.append(err_meta)

        return (len(failures) == 0), failures
