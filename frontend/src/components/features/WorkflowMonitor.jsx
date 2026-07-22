import React from "react";
import { Activity } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

/**
 * Derives a human-readable pickup/OTP state label from context.pickup fields,
 * mirroring the PICKUP_VERIFICATION FSM states in the 5-FSM architecture.
 * This is purely data-driven — the values come from set_context actions in transitions.json.
 */
function derivePickupState(pickup) {
  if (!pickup) return null;
  if (pickup.completed_at) return "HANDED_OVER";
  if (pickup.otp_verified)  return "OTP_VERIFIED";
  if (pickup.otp_generated) return "OTP_AVAILABLE";
  return "WAITING_FOR_PICKUP";
}

/**
 * Displays the current state of each workflow in a compact grid.
 * Each cell shows the workflow name and its current state.
 * Also surfaces the pickup/OTP lifecycle from context, mirroring the 5-FSM PICKUP_VERIFICATION track.
 */
export default function WorkflowMonitor({ order }) {
  const pickupState = derivePickupState(order?.context?.pickup);

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

          {/* Pickup/OTP track — mirrors 5-FSM PICKUP_VERIFICATION workflow */}
          {pickupState && (
            <div className="bg-zinc-950 p-3 rounded-md border border-zinc-800">
              <div className="text-[10px] text-zinc-500 font-bold mb-1 truncate">
                PICKUP_VERIFICATION
              </div>
              <div className="flex items-center justify-between">
                <span className={`font-mono text-xs font-bold ${
                  pickupState === "HANDED_OVER"      ? "text-emerald-400" :
                  pickupState === "OTP_VERIFIED"     ? "text-orange-400"  :
                  pickupState === "OTP_AVAILABLE"    ? "text-blue-400"    :
                                                       "text-zinc-400"
                }`}>
                  {pickupState}
                </span>
                <div className={`w-2 h-2 rounded-full ${
                  pickupState === "HANDED_OVER"   ? "bg-emerald-500 shadow-[0_0_8px_rgba(52,211,153,0.6)]" :
                  pickupState === "OTP_VERIFIED"  ? "bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.6)]"  :
                  pickupState === "OTP_AVAILABLE" ? "bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]"    :
                                                    "bg-zinc-600"
                }`} />
              </div>
            </div>
          )}

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
