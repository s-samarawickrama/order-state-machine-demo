import React from "react";
import { ListTodo, ShieldAlert } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

/**
 * Displays available transition actions for the current order state.
 * Shows RBAC restrictions, condition blockers, and danger warnings.
 */
export default function ActionPanel({ order, activeRole, onExecuteTransition, onRoleChange }) {
  // Only display actions that are currently allowed and valid in this state.
  // System-only actions are auto-dispatched by the engine — not shown to human roles.
  const availableActions = order?.available_actions?.filter(
    (a) => a.allowed && !a.allowed_roles?.every((r) => r === "SYSTEM")
  );

  return (
    <Card className="bg-zinc-900 border-zinc-800 h-[600px] flex flex-col">
      <CardHeader className="pb-3 shrink-0">
        <CardTitle className="text-sm font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
          <ListTodo size={16} /> Valid Process Actions
        </CardTitle>
        <div className="text-[11px] text-zinc-500 pt-1">
          Only showing actions valid for the order's current state and process step.
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-y-auto space-y-4">
        {availableActions && availableActions.length > 0 ? (
          availableActions.map((action) => {
            return (
              <div
                key={`${action.workflow}-${action.event}`}
                className={`bg-zinc-950 rounded-lg p-4 flex flex-col gap-3 border ${
                  action.danger 
                    ? "border-red-900/60" 
                    : ["reject_prescription", "request_clarification", "reject_claim"].includes(action.event) || (action.event === "cancel_order" && activeRole !== "CUSTOMER")
                    ? "border-amber-900/60"
                    : "border-zinc-800"
                }`}
              >
                {/* Action header row */}
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0 mr-3">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">
                        {action.workflow}
                      </div>
                      {action.danger && (
                        <Badge variant="destructive" className="text-[9px] h-4 px-1.5">
                          DANGER
                        </Badge>
                      )}
                      {(["reject_prescription", "request_clarification", "reject_claim"].includes(action.event) || (action.event === "cancel_order" && activeRole !== "CUSTOMER")) && (
                        <Badge className="text-[9px] h-4 px-1.5 bg-amber-600/80 hover:bg-amber-600 text-white">
                          REASON REQUIRED
                        </Badge>
                      )}
                    </div>
                    <div
                      className={`font-medium text-sm ${
                         action.danger ? "text-red-400" : "text-zinc-200"
                      }`}
                    >
                      {action.display_name}
                    </div>
                    <div className="text-[10px] text-zinc-600 font-mono mt-0.5">
                      {action.event}
                    </div>
                  </div>

                  <Button
                    size="sm"
                    onClick={() => {
                      if (action.event === "cancel_order" && activeRole === "CUSTOMER") {
                        // Customer cancels: no reason needed
                        onExecuteTransition(action.event);
                        return;
                      }

                      const hasReason = ["cancel_order", "reject_prescription", "request_clarification", "reject_claim"].includes(action.event);
                      if (hasReason) {
                        const actionName = action.event === "cancel_order" ? "cancellation" : (action.event === "request_clarification" ? "clarification request" : "rejection");
                        const reason = window.prompt(`Please enter the reason for this ${actionName}:`);
                        if (reason === null) return;
                        const trimmedReason = reason.trim();
                        if (!trimmedReason) {
                          window.alert("A reason is required to perform this action.");
                          return;
                        }

                        // Validate rejection/cancellation reasons to ensure it's a valid pharmacy/clinical reason
                        const lowerReason = trimmedReason.toLowerCase();
                        if (
                          (action.event === "reject_prescription" || action.event === "reject_claim" || (action.event === "cancel_order" && activeRole !== "CUSTOMER")) &&
                          (lowerReason.includes("dont want") || lowerReason.includes("don't want") || lowerReason.includes("customer changed") || lowerReason.includes("no longer need"))
                        ) {
                          window.alert("Invalid reason. The reason must be a valid pharmacy-side or clinical issue (e.g., blurry image, invalid signature, expired prescription, wrong dosage, pharmacy error) and cannot be just 'customer dont want' or 'no longer need'.");
                          return;
                        }

                        onExecuteTransition(action.event, { ...order?.context, reason: trimmedReason });
                      } else {
                        onExecuteTransition(action.event);
                      }
                    }}
                    className={`shrink-0 ${
                      action.danger
                        ? "bg-red-900 hover:bg-red-800 text-red-100"
                        : ["reject_prescription", "request_clarification", "reject_claim"].includes(action.event) || (action.event === "cancel_order" && activeRole !== "CUSTOMER")
                        ? "bg-amber-600 hover:bg-amber-700 text-white"
                        : "bg-indigo-600 hover:bg-indigo-700 text-white"
                    }`}
                  >
                    Execute
                  </Button>
                </div>

                {/* Explanation text inside the card for reason-requiring triggers */}
                {action.event === "start_preparing" && (
                  <div className="text-[11px] text-zinc-400 bg-zinc-900 border border-zinc-800 p-2 rounded">
                    <strong>Note:</strong> This locks the order for preparation by the current staff member, preventing other staff from working on it, and notifies the customer.
                  </div>
                )}
                {action.event === "mark_ready" && (
                  <div className="text-[11px] text-zinc-400 bg-zinc-900 border border-zinc-800 p-2 rounded">
                    <strong>Note:</strong> Marking the order ready triggers OTP generation in the background. The customer will receive this OTP on their side for counter verification.
                  </div>
                )}
                {action.event === "request_clarification" && (
                  <div className="text-[11px] text-amber-500 bg-amber-950/20 border border-amber-900/40 p-2 rounded">
                    <strong>Note:</strong> This starts a clarification query to the customer. You will be prompted to enter your question as a reason.
                  </div>
                )}
                {(action.event === "reject_prescription" || action.event === "reject_claim" || (action.event === "cancel_order" && activeRole !== "CUSTOMER")) && (
                  <div className="text-[11px] text-amber-500 bg-amber-950/20 border border-amber-900/40 p-2 rounded">
                    <strong>Note:</strong> A valid pharmacy/clinical reason is required. Cannot be "customer doesn't want" or "no longer need".
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div className="text-sm text-zinc-500 italic text-center mt-10 p-4 border border-dashed border-zinc-800 rounded-lg">
            No valid actions available in this state for role <strong>{activeRole}</strong>.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
