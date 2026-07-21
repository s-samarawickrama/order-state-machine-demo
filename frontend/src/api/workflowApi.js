const API_BASE = import.meta.env.VITE_API_BASE_URL || "";

/**
 * Centralized API client for the MediPick Workflow Engine backend.
 * Every backend endpoint is represented as a single exported function.
 */

function buildUrl(path) {
  return `${API_BASE}${path}`;
}

async function request(path, options = {}) {
  const response = await fetch(buildUrl(path), {
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
  });

  const rawText = await response.text();
  const json = rawText ? JSON.parse(rawText) : {};

  if (!response.ok) {
    throw new Error(json.detail || json.message || `Request failed: ${response.status}`);
  }

  return json;
}

// ── Metadata ──────────────────────────────────────────────

export async function fetchWorkflowMetadata() {
  const json = await request(`/workflow/metadata`);
  return json.data;
}

// ── Scenarios ─────────────────────────────────────────────

export async function fetchScenarioList() {
  const json = await request(`/scenarios`);
  return json.data;
}

export async function loadScenario(scenarioName) {
  const json = await request(`/orders/scenario`, {
    method: "POST",
    body: JSON.stringify({ scenario: scenarioName }),
  });
  return json;
}

// ── Orders ────────────────────────────────────────────────

export async function fetchOrder(orderId, role = "SYSTEM") {
  const json = await request(`/orders/${orderId}?role=${role}`);
  return json.data;
}

export async function executeTransition(orderId, event, userRole, contextUpdates = null) {
  const json = await request(`/orders/${orderId}/transition`, {
    method: "POST",
    body: JSON.stringify({
      event,
      user_role: userRole,
      context_updates: contextUpdates,
    }),
  });
  return json;
}

export async function simulateTransition(orderId, event, userRole, contextUpdates = null) {
  const json = await request(`/orders/${orderId}/simulate`, {
    method: "POST",
    body: JSON.stringify({
      event,
      user_role: userRole,
      context_updates: contextUpdates,
    }),
  });
  return json;
}

// ── Order Items ───────────────────────────────────────────

export async function updateItemAvailability(orderId, orderItemId, availabilityResult) {
  const json = await request(`/orders/${orderId}/items/status`, {
    method: "POST",
    body: JSON.stringify({
      order_item_id: orderItemId,
      availability_result: availabilityResult,
    }),
  });
  return json;
}

// ── Order Context ─────────────────────────────────────────

export async function updateOrderContext(orderId, contextUpdates) {
  const json = await request(`/orders/${orderId}/context`, {
    method: "POST",
    body: JSON.stringify(contextUpdates),
  });
  return json.data;
}

// ── Chat ──────────────────────────────────────────────────

export async function sendChatMessage(orderId, sender, message) {
  const json = await request(`/orders/${orderId}/chat`, {
    method: "POST",
    body: JSON.stringify({ sender, message }),
  });
  return json.data;
}

// ── Audit Logs ────────────────────────────────────────────

export async function fetchAuditLogs() {
  const json = await request(`/audit-logs`);
  return json.data;
}
