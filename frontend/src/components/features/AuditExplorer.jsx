import React from "react";
import { Clock } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

/**
 * Audit log timeline showing all state transitions with context and policy info.
 * Filters to the active order if one is loaded.
 */
export default function AuditExplorer({ auditLogs, order }) {
  const safeLogs = Array.isArray(auditLogs) ? auditLogs : [];
  const filteredLogs = order
    ? safeLogs.filter((log) => log.order_id === order.order_id)
    : safeLogs;

  return (
    <Card className="bg-zinc-900 border-zinc-800">
      <CardHeader>
        <CardTitle className="text-sm font-bold text-zinc-400 uppercase tracking-widest">
          Audit Timeline
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {filteredLogs.map((log, index) => {
            const eventName = log.transition?.event || log.event || "UNKNOWN_EVENT";
            const fromState = log.transition?.from || log.from_state || "UNKNOWN";
            const toState = log.transition?.to || log.to_state || "UNKNOWN";
            
            return (
              <div
                key={index}
                className="flex gap-4 p-4 border border-zinc-800 rounded-lg bg-zinc-950 items-start"
              >
                <div className="w-2 h-2 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
                <div className="flex-1">
                  <div className="flex justify-between mb-1">
                    <span className="font-bold text-zinc-200">
                      {eventName.toUpperCase()}
                    </span>
                    <span className="text-xs text-zinc-500 font-mono">
                      {log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : ""}
                    </span>
                  </div>
                  <div className="text-xs text-zinc-400">
                    State transition:{" "}
                    <Badge variant="outline" className="bg-zinc-800 border-zinc-700">
                      {fromState}
                    </Badge>{" "}
                    ➔{" "}
                    <Badge variant="outline" className="bg-zinc-800 border-zinc-700">
                      {toState}
                    </Badge>
                  </div>
                  {log.workflow_context?.policy && (
                    <div className="mt-2 bg-yellow-950/30 border border-yellow-900/50 p-2 rounded text-xs text-yellow-500">
                      <span className="font-bold block mb-1">Policy Enforcement:</span>
                      {log.workflow_context.policy.warning}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          {filteredLogs.length === 0 && (
            <div className="text-zinc-600 text-sm">No audit logs found.</div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

