# MediPick Backend Demo Guide (2-FSM Version)

This guide is meant for live presentation. It shows how to explain the backend workflow engine, the JSON-driven configuration model, and the frontend demo experience in a simple sequence.

## 1. Core idea

The backend is not a pile of hardcoded if/else rules. It uses a configuration-driven state-machine engine.

- The business rules live in [config/transitions.json](../config/transitions.json).
- The runtime engine in [engine/workflow_engine.py](../engine/workflow_engine.py) evaluates the rules.
- The frontend in [frontend/src](../frontend/src) simply reads the metadata and executes transitions.

That means the same backend can support many scenarios by changing configuration, not Python code.

## 2. What the config contains

The config defines two workflows:

- ORDER_LIFECYCLE
- PAYMENT

Each workflow contains:

- states
- transitions
- allowed roles
- conditions
- validation errors
- side effects

A transition looks like this conceptually:

```json
{
  "current_state": "DRAFT",
  "event": "submit_order",
  "allowed_roles": ["CUSTOMER"],
  "next_state": "SUBMITTED"
}
```

The engine reads these definitions at runtime and decides whether a transition is allowed.

## 3. How a transition flows

1. The frontend sends an event to the backend.
2. The order service builds the evaluation context.
3. The workflow engine checks the current workflow state and the event.
4. It evaluates conditions such as role permission, payment state, or OTP verification.
5. If valid, it commits the next state and dispatches any side effects.

## 4. Presentation demo flow

### Scenario A — OTC order

- Load the OTC draft scenario.
- Submit the order as CUSTOMER.
- Switch to PHARMACY_STAFF and confirm availability.
- Return to CUSTOMER and confirm the quote.
- Move the order into preparation and pickup.

### Scenario B — Prescription order

- Load the prescription scenario.
- Submit the order.
- Show that the prescription validation state is now active within `ORDER_LIFECYCLE`.
- Switch to PHARMACIST to review and approve the prescription.
- Continue the rest of the lifecycle.

### Scenario C — Payment gate

- Show that payment is blocked before the order is confirmed.
- Once the order reaches the correct lifecycle state, payment becomes available.
- This demonstrates how cross-workflow conditions work.

### Scenario D — Handover and completion

- Move the order to ready-for-pickup.
- Verify OTP (updates context metadata).
- Complete handover (transitions to `COMPLETED`) only when payment is paid and OTP is verified.

### Scenario E — Post-collection issue

- Load the issue scenario.
- Show issue reporting (transitions to `ISSUE_REPORTED`) and investigation (transitions to `UNDER_REVIEW`).
- Resolve the issue (transitions to `RESOLVED`) as pharmacist and observe the automatic creation of a replacement order in the audit logs.

## 5. How to present the frontend

Open the app and explain the four main panels:

- Scenario selector: choose a prebuilt scenario.
- Workflow monitor: see all active FSM states at a glance.
- Workflow graph: inspect the active state machine.
- Action panel: see which actions are allowed or blocked.
