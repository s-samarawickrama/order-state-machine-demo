import { useState, useCallback } from "react";
import {
  fetchOrder,
  loadScenario as apiLoadScenario,
  executeTransition as apiExecuteTransition,
  updateItemAvailability as apiUpdateItemAvailability,
  updateOrderContext as apiUpdateOrderContext,
  sendChatMessage as apiSendChatMessage,
} from "@/api/workflowApi";

/**
 * Manages the current order lifecycle:
 * - Loading scenarios
 * - Executing transitions
 * - Updating items, context, and chat
 */
export function useOrder() {
  const [order, setOrder] = useState(null);
  const [activeRole, setActiveRole] = useState("CUSTOMER");
  const [isLoading, setIsLoading] = useState(false);

  const refetchOrder = useCallback(
    async (orderId = null, role = null) => {
      const targetId = orderId || order?.order_id;
      const targetRole = role || activeRole;
      if (!targetId) return;

      try {
        const data = await fetchOrder(targetId, targetRole);
        setOrder(data);
        return data;
      } catch (err) {
        console.error("Failed to fetch order:", err);
      }
    },
    [order?.order_id, activeRole]
  );

  const handleLoadScenario = useCallback(
    async (scenarioName) => {
      setIsLoading(true);
      try {
        const json = await apiLoadScenario(scenarioName);
        if (json.success && json.data) {
          setOrder(json.data);
          // Re-fetch with role applied to get available_actions
          await refetchOrder(json.data.order_id);
        }
        return json;
      } catch (err) {
        console.error("Failed to load scenario:", err);
      } finally {
        setIsLoading(false);
      }
    },
    [refetchOrder]
  );

  const handleExecuteTransition = useCallback(
    async (event, contextUpdates = null) => {
      if (!order) return;
      try {
        // Only send contextUpdates if explicitly provided.
        // Sending order.context unconditionally overwrites backend-managed
        // set_context action results (e.g. pickup.otp_verified, pickup.otp_generated).
        const json = await apiExecuteTransition(
          order.order_id,
          event,
          activeRole,
          contextUpdates  // null = backend keeps its own stored context
        );
        if (json.success) {
          await refetchOrder();
          return { success: true };
        } else {
          return { success: false, errors: json.errors };
        }
      } catch (err) {
        console.error("Transition execution failed:", err);
        return { success: false, errors: [{ code: "ERROR", message: err.message }] };
      }
    },
    [order, activeRole, refetchOrder]
  );

  const handleUpdateItemAvailability = useCallback(
    async (orderItemId, availabilityResult) => {
      if (!order) return;
      try {
        await apiUpdateItemAvailability(order.order_id, orderItemId, availabilityResult);
        await refetchOrder();
      } catch (err) {
        console.error("Item availability update failed:", err);
      }
    },
    [order, refetchOrder]
  );

  const handleUpdateContext = useCallback(
    async (contextUpdates) => {
      if (!order) return;
      try {
        await apiUpdateOrderContext(order.order_id, contextUpdates);
        await refetchOrder();
      } catch (err) {
        console.error("Context update failed:", err);
      }
    },
    [order, refetchOrder]
  );

  const handleSendMessage = useCallback(
    async (sender, message) => {
      if (!order) return;
      try {
        await apiSendChatMessage(order.order_id, sender, message);
        await refetchOrder();
      } catch (err) {
        console.error("Chat message failed:", err);
      }
    },
    [order, refetchOrder]
  );

  const handleRoleChange = useCallback(
    async (newRole) => {
      setActiveRole(newRole);
      if (order) {
        // Re-fetch to get new available_actions for the new role
        const targetId = order.order_id;
        try {
          const data = await fetchOrder(targetId, newRole);
          setOrder(data);
        } catch (err) {
          console.error("Failed to refresh order for new role:", err);
        }
      }
    },
    [order]
  );

  return {
    order,
    activeRole,
    isLoading,
    setActiveRole: handleRoleChange,
    loadScenario: handleLoadScenario,
    executeTransition: handleExecuteTransition,
    updateItemAvailability: handleUpdateItemAvailability,
    updateContext: handleUpdateContext,
    sendMessage: handleSendMessage,
    refetchOrder,
  };
}
