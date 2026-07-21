# MediPick Backend Demo Guide

This guide is meant for live presentation. It shows how to explain the backend workflow engine, the JSON-driven configuration model, and the frontend demo experience in a simple sequence.

## 1. Core idea

The backend is not a pile of hardcoded if/else rules. It uses a configuration-driven state-machine engine.

- The business rules live in [config/transitions.json](../config/transitions.json).
- The runtime engine in [engine/workflow_engine.py](../engine/workflow_engine.py) evaluates the rules.
- The frontend in [frontend/src](../frontend/src) simply reads the metadata and executes transitions.

That means the same backend can support many scenarios by changing configuration, not Python code.

## 2. What the config contains

The config defines five workflows:

- ORDER_LIFECYCLE
- PRESCRIPTION_VALIDATION
- PAYMENT
- PICKUP_VERIFICATION
- ISSUE_MANAGEMENT

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
  "current_state": "SUBMITTED",
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
4. It evaluates conditions such as role permission, payment state, or prescription approval.
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
- Show that the prescription workflow is now active.
- Use PHARMACY_STAFF or PHARMACIST to advance the validation state.
- Approve the prescription and continue the rest of the lifecycle.

### Scenario C — Payment gate

- Show that payment is blocked before the order is confirmed.
- Once the order reaches the correct lifecycle state, payment becomes available.
- This demonstrates how cross-workflow conditions work.

### Scenario D — Handover and completion

- Move the order to ready-for-pickup.
- Verify OTP.
- Complete handover only when payment is paid.
- The order then flows into completion.

### Scenario E — Post-collection issue

- Load the issue scenario.
- Show issue reporting and investigation.
- Resolve the issue and observe the replacement-order path.

## 5. How to present the frontend

Open the app and explain the four main panels:

- Scenario selector: choose a prebuilt scenario.
- Workflow monitor: see all FSM states at a glance.
- Workflow graph: inspect the active state machine.
- Action panel: see which actions are allowed or blocked.

The important message is that the UI is a thin presenter over the backend state machine.

## 6. How to teach this live

Use this simple script:

- "This is a config-driven backend. Nothing is hardcoded in Python for every rule."
- "The config says what states exist, what transitions are allowed, and what conditions gate them."
- "The frontend simply calls the backend and shows the result."
- "If I want to change the business rule, I change the JSON configuration rather than rewriting Python logic."

## 7. Suggested demo commands

Run the backend:

```bash
uvicorn main:app --reload
```

Run the frontend:

```bash
npm run dev -- --host 127.0.0.1 --port 5173
```
