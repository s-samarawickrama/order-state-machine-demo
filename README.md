# MediPick Workflow Engine Demo

A configuration-driven pharmacy order workflow management system showing how a backend Finite State Machine (FSM) engine and a React frontend coordinate order lifecycles for OTC, prescription, and mixed pharmaceutical orders.

---

## 💻 Tech Stack & Key Technologies

### Backend
* **Python 3.x**
* **FastAPI** — API Routing, Dependency Injection, and JSON request validation.
* **Uvicorn** — ASGI web server.
* **Pydantic** — Strict JSON-to-Python type validation.
* **pytest** — Unit testing framework.

### Frontend
* **React 19** — User Interface.
* **Vite** — Fast bundler & Dev server.
* **Shadcn UI & Tailwind CSS** — Visual components and styling system.
* **ReactFlow** — Interactive workflow state machine visualizations.
* **Framer Motion** — Smooth micro-animations.

---

## 🛠️ Main Files & Project Structure

* [config/transitions.json](file:///c:/Users/KINGSLEY/Desktop/order-state-machine-demo/config/transitions.json) — **The Blueprint**: Contains all transitions, permitted roles, validation conditions, and side-effect actions.
* [engine/workflow_engine.py](file:///c:/Users/KINGSLEY/Desktop/order-state-machine-demo/engine/workflow_engine.py) — **The Core Engine**: Resolves transitions and authorizes roles.
* [engine/condition_evaluator.py](file:///c:/Users/KINGSLEY/Desktop/order-state-machine-demo/engine/condition_evaluator.py) — **Condition Evaluator**: Computes rules dynamically without using hardcoded `if-else` branches.
* [services/order_service.py](file:///c:/Users/KINGSLEY/Desktop/order-state-machine-demo/services/order_service.py) — **Orchestrator**: Updates state store database, computes context variables, and executes policy hooks.
* [services/action_executor.py](file:///c:/Users/KINGSLEY/Desktop/order-state-machine-demo/services/action_executor.py) — **Side-Effect Handler**: Triggers secondary actions like stock reservation, payments, refunds, and order replication.
* [api/routes.py](file:///c:/Users/KINGSLEY/Desktop/order-state-machine-demo/api/routes.py) — **API Layer**: Connects the frontend to the backend services.

---

## 📖 How to Read the Code

To fully grasp how this system is designed, walk through the files in this logical sequence:

1. **Start with [config/transitions.json](file:///c:/Users/KINGSLEY/Desktop/order-state-machine-demo/config/transitions.json)**: Look at how states and transitions are written as data definitions.
2. **Read [engine/workflow_engine.py](file:///c:/Users/KINGSLEY/Desktop/order-state-machine-demo/engine/workflow_engine.py)**: See how the engine parses the JSON config file dynamically.
3. **Inspect [engine/condition_evaluator.py](file:///c:/Users/KINGSLEY/Desktop/order-state-machine-demo/engine/condition_evaluator.py)**: Learn how the system evaluates conditions (like checking if prescription validation equals `APPROVED`) completely via JSON rules.
4. **Inspect [services/order_service.py](file:///c:/Users/KINGSLEY/Desktop/order-state-machine-demo/services/order_service.py)**: Check the state-first update mechanism that ensures transactional safety before performing external actions.
5. **Inspect [services/action_executor.py](file:///c:/Users/KINGSLEY/Desktop/order-state-machine-demo/services/action_executor.py)**: Look at how secondary tasks (like sending OTPs, creating replacement orders, or reserving stock) are dispatched on transition success.

For a detailed step-by-step trace of how these files run during a request, see [docs/system_architecture_and_code_guide.md](file:///c:/Users/KINGSLEY/Desktop/order-state-machine-demo/docs/system_architecture_and_code_guide.md).

---

## 🚀 Running the App Locally

### 1. Start the Backend
Execute from the project root:
```powershell
.venv\Scripts\python.exe main.py
```
*Runs at `http://localhost:8000`*

### 2. Start the Frontend
Execute from the `frontend/` subdirectory:
```bash
npm run dev
```
*Runs at `http://localhost:5173`*

---

## 🧪 Running Unit Tests

To run the automated suite testing states and conditions:
```bash
pytest
```
