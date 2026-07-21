import React from "react";
import { Settings } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import ScenarioSelector from "./ScenarioSelector";
import ContextEditor from "./ContextEditor";

/**
 * Simulator view — scenario loader + dynamic context editor.
 * Allows pre-setting order context variables before executing transitions.
 */
export default function SimulatorView({ order, onLoadScenario, onUpdateContext }) {
  return (
    <div className="grid grid-cols-12 gap-6">
      {/* Scenario Loader */}
      <div className="col-span-12 md:col-span-4">
        <ScenarioSelector
          onSelectScenario={onLoadScenario}
          description="Choose a predefined state to load a specific workflow configuration in the database."
        />
      </div>

      {/* Dynamic Context Editor */}
      <div className="col-span-12 md:col-span-8">
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-sm font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
              <Settings size={16} /> Dynamic Context Simulator
            </CardTitle>
          </CardHeader>
          <CardContent>
            {order ? (
              <ContextEditor order={order} onUpdateContext={onUpdateContext} />
            ) : (
              <div className="text-zinc-500 text-center py-10 italic">
                No order loaded. Load a scenario preset first.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
