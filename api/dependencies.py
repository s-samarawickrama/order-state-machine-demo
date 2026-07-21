import json
from engine.workflow_engine import WorkflowEngine
from engine.validator import WorkflowValidator
from storage.memory_store import ORDERS_DATABASE
from services.order_service import OrderService
from services.audit_service import AuditService
from services.action_executor import ActionExecutor

with open("config/transitions.json", "r") as f:
    config = json.load(f)

WorkflowValidator.validate(config)

engine = WorkflowEngine(config)
audit_service = AuditService()
action_executor = ActionExecutor(ORDERS_DATABASE, audit_service)
order_service = OrderService(
    engine=engine, 
    store=ORDERS_DATABASE, 
    audit_service=audit_service, 
    action_executor=action_executor
)
