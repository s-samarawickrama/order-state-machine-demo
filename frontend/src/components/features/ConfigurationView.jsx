import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Sheet, SheetTrigger, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

/**
 * Configuration view — displays all workflow transitions as a searchable table.
 * Each row opens a slide-out sheet with full transition details.
 */
export default function ConfigurationView({ workflowConfig }) {
  if (!workflowConfig) return null;

  return (
    <Card className="bg-zinc-900 border-zinc-800">
      <CardHeader>
        <CardTitle className="text-sm font-bold text-zinc-400 uppercase tracking-widest">
          Transitions Metadata
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow className="border-zinc-800 hover:bg-zinc-800/50">
              <TableHead className="text-zinc-400">Workflow</TableHead>
              <TableHead className="text-zinc-400">Event</TableHead>
              <TableHead className="text-zinc-400">From</TableHead>
              <TableHead className="text-zinc-400">To</TableHead>
              <TableHead className="text-zinc-400">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Object.entries(workflowConfig.workflows).map(
              ([workflowId, workflowDefinition]) =>
                workflowDefinition.transitions.map((transition, index) => (
                  <Sheet key={`${workflowId}-${index}`}>
                    <SheetTrigger asChild>
                      <TableRow className="border-zinc-800 cursor-pointer hover:bg-zinc-800/50">
                        <TableCell className="font-mono text-xs text-indigo-400">
                          {workflowId}
                        </TableCell>
                        <TableCell className="font-bold text-zinc-300">
                          {transition.event}
                        </TableCell>
                        <TableCell className="text-zinc-400">
                          {transition.current_state}
                        </TableCell>
                        <TableCell className="text-zinc-400">
                          {transition.next_state}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-6 text-[10px] bg-zinc-900 border-zinc-700"
                          >
                            Inspect
                          </Button>
                        </TableCell>
                      </TableRow>
                    </SheetTrigger>
                    <SheetContent className="bg-zinc-950 border-zinc-800 text-zinc-200">
                      <SheetHeader>
                        <SheetTitle className="text-zinc-100 font-mono text-sm">
                          {transition.event}
                        </SheetTitle>
                      </SheetHeader>
                      <div className="mt-6 space-y-4 overflow-y-auto h-[calc(100vh-100px)] px-4 pb-10">
                        <div>
                          <div className="text-xs text-zinc-500 font-bold uppercase mb-1">
                            Transition ID
                          </div>
                          <div className="text-sm font-mono text-indigo-400">
                            {transition.id}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-zinc-500 font-bold uppercase mb-1">
                            Label
                          </div>
                          <div className="text-sm">{transition.label}</div>
                        </div>
                        <div>
                          <div className="text-xs text-zinc-500 font-bold uppercase mb-1">
                            State Change
                          </div>
                          <div className="text-sm">
                            {transition.current_state} ➔ {transition.next_state}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-zinc-500 font-bold uppercase mb-1">
                            Allowed Roles
                          </div>
                          <div className="text-sm font-mono">
                            {transition.allowed_roles?.join(", ") || "Any"}
                          </div>
                        </div>
                        {transition.conditions && (
                          <div>
                            <div className="text-xs text-zinc-500 font-bold uppercase mb-1">
                              Conditions
                            </div>
                            <pre className="text-[10px] bg-zinc-900 p-2 rounded border border-zinc-800 overflow-x-auto text-emerald-400">
                              {JSON.stringify(transition.conditions, null, 2)}
                            </pre>
                          </div>
                        )}
                        {transition.validation_errors && (
                          <div>
                            <div className="text-xs text-zinc-500 font-bold uppercase mb-1">
                              Validation Errors
                            </div>
                            <pre className="text-[10px] bg-zinc-900 p-2 rounded border border-zinc-800 overflow-x-auto text-amber-400">
                              {JSON.stringify(transition.validation_errors, null, 2)}
                            </pre>
                          </div>
                        )}
                        {transition.actions && (
                          <div>
                            <div className="text-xs text-zinc-500 font-bold uppercase mb-1">
                              Post Actions
                            </div>
                            <pre className="text-[10px] bg-zinc-900 p-2 rounded border border-zinc-800 overflow-x-auto text-blue-400">
                              {JSON.stringify(transition.actions, null, 2)}
                            </pre>
                          </div>
                        )}
                        {transition.policy && (
                          <div>
                            <div className="text-xs text-zinc-500 font-bold uppercase mb-1">
                              Policy
                            </div>
                            <pre className="text-[10px] bg-zinc-900 p-2 rounded border border-zinc-800 overflow-x-auto text-yellow-400">
                              {JSON.stringify(transition.policy, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    </SheetContent>
                  </Sheet>
                ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
