# MediPick System Architecture & Code Walkthrough Guide

This document provides a detailed technical reference for developers, architects, and stakeholders to understand the structure, execution lifecycle, and coding patterns of the **MediPick Unified Order Engine**.

---

## 1. System Design & Philosophy

The system's core design philosophy is **Configuration over Code (Declarative Architecture)**.

Instead of writing complex, nested, and hard-to-maintain `if/else` branching logic inside Python code, we define all business logic, authorization rules, states, transitions, validation conditions, and side effects within a single JSON blueprint: [transitions.json](file:///c:/Users/KINGSLEY/Desktop/order-state-machine-demo/config/transitions.json).

### The Five Coordinated FSMs
The engine coordinates five independent, cooperating Finite State Machines (FSMs) concurrently:
1. **`ORDER_LIFECYCLE`**: Tracks the master status of the order (`DRAFT` ➔ `SUBMITTED` ➔ `PREPARING` ➔ `READY_FOR_PICKUP` ➔ `COMPLETED` / `CANCELLED`).
2. **`PRESCRIPTION_VALIDATION`**: Manages pharmacist validation flows (`PENDING` ➔ `UPLOADED` ➔ `APPROVED` / `REJECTED`).
3. **`PAYMENT`**: Handles payment states (`UNPAID` ➔ `PAID` / `REFUNDED`).
4. **`PICKUP_VERIFICATION`**: Tracks secure customer pickup flow (`WAITING_FOR_PICKUP` ➔ `OTP_SENT` ➔ `COLLECTED`).
5. **`ISSUE_MANAGEMENT`**: Drives support ticket handling (`NO_ISSUE` ➔ `ISSUE_REPORTED` ➔ `UNDER_REVIEW` ➔ `RESOLVED`).

---

## 2. Technology Stack

### Backend Technologies
* **Python 3.x**: Core language.
* **FastAPI**: Modern, fast web framework for building APIs.
* **Uvicorn**: Lightweight, lightning-fast ASGI server.
* **Pydantic**: Structural type annotations and input schema validation.
* **InMemory Database**: Simple stateful memory store ([memory_store.py](file:///c:/Users/KINGSLEY/Desktop/order-state-machine-demo/storage/memory_store.py)) representing the active DB.

### Frontend Technologies
* **React 19**: Modern UI framework using Hooks and state orchestration.
* **Vite**: Ultra-fast frontend build tool and dev server.
* **Tailwind CSS & Shadcn UI**: Styling system and reusable UI component primitives.
* **ReactFlow**: Library for building node-based interactive workflow graph visualizations.
* **Framer Motion**: Smooth transition animations and state micro-animations.
* **Lucide React**: Vector icons.

---

## 3. How to Read the Code (Step-by-Step)

If you are opening this repository for the first time, read the code in this exact order to understand how it flows:

```mermaid
graph TD
    A["1. config/transitions.json (The Rules)"] --> B["2. engine/workflow_engine.py (The Matcher)"]
    B --> C["3. engine/condition_evaluator.py (The Evaluator)"]
    C --> D["4. services/order_service.py (The Glue/DB)"]
    D --> E["5. services/action_executor.py (The Side-Effects)"]
```

### Step 1: Open [config/transitions.json](file:///c:/Users/KINGSLEY/Desktop/order-state-machine-demo/config/transitions.json)
This file defines the states and transitions. Look at a transition block:
* Notice how it specifies the required `current_state` and matching `event`.
* Look at the `allowed_roles` checking who can trigger it.
* Look at `conditions`: these must evaluate to `True` for the transition to occur.
* Look at `actions`: these are side-effects dispatched upon success.

### Step 2: Open [engine/workflow_engine.py](file:///c:/Users/KINGSLEY/Desktop/order-state-machine-demo/engine/workflow_engine.py)
This is the machine itself.
* **`execute_transition_with_reasons`**: Searches the configured workflows for a transition matching the active state and incoming event.
* **Role Check**: Calls `_is_role_allowed` to match the user's role claim against configured role permissions.
* **Condition Delegation**: Passes transition condition objects to the `ConditionEvaluator`.

### Step 3: Open [engine/condition_evaluator.py](file:///c:/Users/KINGSLEY/Desktop/order-state-machine-demo/engine/condition_evaluator.py)
This is where variables are checked.
* **`evaluate_detailed`**: Iterates through each condition from the JSON config.
* **`get_nested_value`**: Uses dot-notation paths (e.g., `states.PRESCRIPTION_VALIDATION` or `context.payment.status`) to extract actual values from the order context.
* It compares values using operators (`equals`, `in`, `greater_than`, `within_hours`, etc.) completely dynamically.

### Step 4: Open [services/order_service.py](file:///c:/Users/KINGSLEY/Desktop/order-state-machine-demo/services/order_service.py)
This file orchestrates the workflow logic with persistent storage.
* **State-First Commits**: It updates the state dictionary (`order["states"][wf_name] = next_state`) **prior** to running external side effects to maintain transactional integrity.
* **Context Computation**: It computes derived context (like mapping order items' availability status to an overall order `availability.status` variable).
* **Policy Hook**: Invokes the `PolicyEngine` to run custom business calculations (like penalty points on late cancellations).

### Step 5: Open [services/action_executor.py](file:///c:/Users/KINGSLEY/Desktop/order-state-machine-demo/services/action_executor.py)
This executes side-effect commands:
* **`CREATE_RESERVATION`**: Reserves inventory.
* **`REFUND_PAYMENT`**: Issues digital payment refund requests.
* **`STRIP_UNAVAILABLE_ITEMS`**: Filters the order items to only keep verified available ones.
* **`CREATE_REPLACEMENT_ORDER`**: Spawns a brand new linked replacement order automatically on pharmacy error.
* **`DISPATCH_EVENT`**: Triggers a separate internal event cascade (e.g., starting automated OCR validation checks).

---

## 4. Key Execution Flow Trace
When a user clicks "Confirm Order" as a `CUSTOMER` in the UI:
1. **Frontend Request**: The browser issues a `POST` request to `http://localhost:8000/orders/{order_id}/transition` with the payload `{"event": "submit_order", "user_role": "CUSTOMER"}`.
2. **Controller Layer**: [api/routes.py](file:///c:/Users/KINGSLEY/Desktop/order-state-machine-demo/api/routes.py#L229) intercepts the API call and calls `order_service.execute_order_event_sync(...)`.
3. **Context Construction**: `OrderService` builds the evaluation context with active state, role, and metadata overrides.
4. **FSM Execution**: `WorkflowEngine` matches the transition `OL-001`. It verifies the role `CUSTOMER` is allowed and that all validation conditions are met.
5. **State Update**: `OrderService` commits the new state (`ORDER_LIFECYCLE` becomes `SUBMITTED`).
6. **Side Effect Dispatch**: The system notices `OL-001` has actions: `notify_pharmacy` and `start_validation`.
7. **Action Execution**: `ActionExecutor` executes `DISPATCH_EVENT` for `start_validation`. This advances the `PRESCRIPTION_VALIDATION` state-machine autonomously.
8. **Frontend Response**: The updated state schema is returned to the React frontend, which immediately updates the UI dashboard and workflow monitor graphs.
