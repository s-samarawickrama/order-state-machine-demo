import React, { useState } from "react";
import { useWorkflowMetadata } from "@/hooks/useWorkflowMetadata";
import { useOrder } from "@/hooks/useOrder";
import { useAuditLogs } from "@/hooks/useAuditLogs";
import AppShell from "@/components/layout/AppShell";
import DashboardView from "@/components/features/DashboardView";
import OrdersView from "@/components/features/OrdersView";
import SimulatorView from "@/components/features/SimulatorView";
import AuditExplorer from "@/components/features/AuditExplorer";
import ConfigurationView from "@/components/features/ConfigurationView";

/**
 * Root application component.
 * Thin orchestration shell — all logic lives in hooks and feature components.
 */
export default function App() {
  const [activeView, setActiveView] = useState("dashboard");

  const { workflowConfig, isLoading: isMetadataLoading } = useWorkflowMetadata();
  const {
    order,
    activeRole,
    setActiveRole,
    loadScenario,
    executeTransition,
    updateItemAvailability,
    updateContext,
    sendMessage,
  } = useOrder();
  const { auditLogs, refetch: refetchAuditLogs } = useAuditLogs();

  const handleLoadScenario = async (scenarioName) => {
    await loadScenario(scenarioName);
    refetchAuditLogs();
  };

  const handleExecuteTransition = async (event, contextUpdates = null) => {
    const result = await executeTransition(event, contextUpdates);
    refetchAuditLogs();
    if (!result?.success) {
      console.warn("Transition not allowed:", result?.errors);
    }
  };

  if (isMetadataLoading || !workflowConfig) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-zinc-950 text-zinc-400">
        Loading Engine...
      </div>
    );
  }

  return (
    <AppShell
      activeView={activeView}
      onViewChange={setActiveView}
      activeRole={activeRole}
      onRoleChange={setActiveRole}
      order={order}
    >
      {activeView === "dashboard" && (
        <DashboardView
          workflowConfig={workflowConfig}
          order={order}
          activeRole={activeRole}
          onLoadScenario={handleLoadScenario}
          onExecuteTransition={handleExecuteTransition}
          onUpdateContext={updateContext}
          onRoleChange={setActiveRole}
        />
      )}

      {activeView === "orders" && (
        <OrdersView
          order={order}
          onUpdateItemAvailability={updateItemAvailability}
          onSendMessage={sendMessage}
        />
      )}

      {activeView === "simulator" && (
        <SimulatorView
          order={order}
          onLoadScenario={handleLoadScenario}
          onUpdateContext={updateContext}
        />
      )}

      {activeView === "audit" && (
        <AuditExplorer auditLogs={auditLogs} order={order} />
      )}

      {activeView === "configuration" && (
        <ConfigurationView workflowConfig={workflowConfig} />
      )}
    </AppShell>
  );
}
