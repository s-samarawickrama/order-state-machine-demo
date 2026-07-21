import React, { useEffect, useState } from "react";
import { Stethoscope } from "lucide-react";
import ScenarioSelector from "./ScenarioSelector";
import WorkflowMonitor from "./WorkflowMonitor";
import WorkflowGraph from "./WorkflowGraph";
import ActionPanel from "./ActionPanel";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

/**
 * Dashboard view — composes the main operating view:
 * - Scenario loader (top-left)
 * - Multi-workflow monitor (top-right)
 * - FSM graph (bottom-left)
 * - Action panel (bottom-right)
 */
export default function DashboardView({
  workflowConfig,
  order,
  activeRole,
  onLoadScenario,
  onExecuteTransition,
  onUpdateContext,
  onRoleChange,
}) {
  const [activeWorkflowId, setActiveWorkflowId] = useState("ORDER_LIFECYCLE");
  const [demoScore, setDemoScore] = useState(75);

  useEffect(() => {
    if (order?.context?.prescription?.clarity_score != null) {
      setDemoScore(order.context.prescription.clarity_score);
    }
  }, [order?.context?.prescription?.clarity_score]);

  // Reset to ORDER_LIFECYCLE if selected workflow doesn't exist on the order
  const effectiveWorkflowId =
    order?.states?.[activeWorkflowId] !== undefined
      ? activeWorkflowId
      : "ORDER_LIFECYCLE";

  const isPrescriptionOrder = order?.order_type === "PRESCRIPTION" || order?.order_type === "MIXED";
  const rxPathHint = demoScore < 20 ? "REUPLOAD_REQUIRED" : "PHARMACIST_REVIEW";

  const handleSaveDemoScore = async () => {
    if (!onUpdateContext) return;
    await onUpdateContext({ prescription: { clarity_score: Number(demoScore) } });
    if (onExecuteTransition) {
      await onExecuteTransition("start_validation");
    }
  };

  return (
    <div className="grid grid-cols-12 gap-6">
      {isPrescriptionOrder && (
        <div className="col-span-12">
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                <Stethoscope size={16} /> Quick Rx Demo Controls
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 md:flex-row md:items-end">
              <div className="flex-1 space-y-2">
                <div className="flex justify-between items-center text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">
                  <span>Prescription clarity score: <strong className="text-indigo-400 font-mono text-sm">{demoScore}%</strong></span>
                  <span className="text-zinc-500">Rx State: <strong className="text-white">{order?.states?.PRESCRIPTION_VALIDATION}</strong></span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={demoScore}
                  onChange={(e) => setDemoScore(Number(e.target.value))}
                  className="w-full accent-indigo-500 h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
                />
                <div className="text-xs text-zinc-400">
                  {demoScore < 20
                    ? "Below 20% score marks prescription as unreadable (customer re-upload required)."
                    : "20% or above routes prescription to Pharmacist Review for approval/rejection."}
                </div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-indigo-400">
                  Expected Route: {rxPathHint}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={handleSaveDemoScore} className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shadow">
                  Save & Process Score
                </Button>
                {order?.states?.PRESCRIPTION_VALIDATION === "PHARMACIST_REVIEW" && activeRole !== "PHARMACIST" && (
                  <Button variant="default" onClick={() => onRoleChange?.("PHARMACIST")} className="bg-amber-600 hover:bg-amber-700 text-white font-semibold">
                    Switch to Pharmacist to Review
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
      {/* Scenario Simulator (top-left) */}
      <div className="col-span-12 md:col-span-4">
        <ScenarioSelector onSelectScenario={onLoadScenario} />
      </div>

      {/* Multi Workflow Monitor (top-right) */}
      <div className="col-span-12 md:col-span-8">
        <WorkflowMonitor order={order} />
      </div>

      {/* FSM Graph + Action Panel (bottom row) */}
      <div className="col-span-12 grid grid-cols-12 gap-6">
        <div className="col-span-12 md:col-span-6">
          <WorkflowGraph
            workflowConfig={workflowConfig}
            order={order}
            activeWorkflowId={effectiveWorkflowId}
            onWorkflowChange={setActiveWorkflowId}
          />
        </div>
        <div className="col-span-12 md:col-span-6">
          <ActionPanel
            order={order}
            activeRole={activeRole}
            onExecuteTransition={onExecuteTransition}
            onRoleChange={onRoleChange}
          />
        </div>
      </div>
    </div>
  );
}
