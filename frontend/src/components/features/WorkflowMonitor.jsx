import React from "react";
import { Activity } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

/**
 * Displays the current state of each workflow in a compact grid.
 * Each cell shows the workflow name and its current state.
 */
export default function WorkflowMonitor({ order }) {
  return (
    <Card className="bg-zinc-900 border-zinc-800">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
          <Activity size={16} /> Multi Workflow Monitor
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {order?.states &&
            Object.entries(order.states).map(([workflowId, currentState]) => (
              <div
                key={workflowId}
                className="bg-zinc-950 p-3 rounded-md border border-zinc-800"
              >
                <div className="text-[10px] text-zinc-500 font-bold mb-1 truncate">
                  {workflowId}
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-zinc-200">
                    {currentState}
                  </span>
                  <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
                </div>
              </div>
            ))}
          {!order && (
            <div className="text-sm text-zinc-600 italic col-span-4">
              Load a scenario to view state monitors.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
