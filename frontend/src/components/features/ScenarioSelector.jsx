import React, { useEffect, useState } from "react";
import { Play } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { fetchScenarioList } from "@/api/workflowApi";

/**
 * Reusable scenario dropdown for loading pre-configured order states.
 * Used in both DashboardView and SimulatorView to eliminate duplication.
 */
export default function ScenarioSelector({ onSelectScenario, description }) {
  const [scenarios, setScenarios] = useState([]);
  const [selectedScenario, setSelectedScenario] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function loadScenarios() {
      try {
        const data = await fetchScenarioList();
        if (isMounted) {
          setScenarios(data || []);
          if (data?.length) {
            setSelectedScenario(data[0]);
          }
        }
      } catch (error) {
        console.error("Failed to load scenarios:", error);
        if (isMounted) {
          setScenarios([]);
          setSelectedScenario(null);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadScenarios();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleScenarioChange = (value) => {
    const match = scenarios.find((scenario) => scenario.id === value);
    setSelectedScenario(match || null);
    onSelectScenario(value);
  };

  return (
    <Card className="bg-zinc-900 border-zinc-800">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
          <Play size={16} /> Scenario Simulator
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-3">
          {description && (
            <div className="text-xs text-zinc-500">{description}</div>
          )}
          <Select onValueChange={handleScenarioChange} disabled={isLoading} value={selectedScenario?.id || ""}>
            <SelectTrigger className="bg-zinc-950 border-zinc-700">
              <SelectValue placeholder={isLoading ? "Loading scenarios..." : "Choose Scenario..."} />
            </SelectTrigger>
            <SelectContent className="max-h-80 bg-zinc-900 border-zinc-800 text-zinc-300">
              {scenarios.length > 0 ? (
                scenarios.map((scenario) => (
                  <SelectItem key={scenario.id} value={scenario.id}>
                    {scenario.description}
                  </SelectItem>
                ))
              ) : (
                <div className="px-2 py-2 text-sm text-zinc-500">No scenarios available.</div>
              )}
            </SelectContent>
          </Select>

          {selectedScenario && (
            <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-3 text-sm text-zinc-400 space-y-2">
              <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-indigo-400">
                Demo guide
              </div>
              <div className="font-medium text-zinc-200">{selectedScenario.summary}</div>
              <div className="text-xs text-zinc-500">
                Starting state: <span className="text-zinc-300">{selectedScenario.starting_state || "—"}</span>
              </div>
              <div className="text-xs text-zinc-500">
                Suggested role: <span className="text-zinc-300">{selectedScenario.role_hint || "CUSTOMER"}</span>
              </div>
              {selectedScenario.demo_steps?.length > 0 && (
                <ol className="list-decimal list-inside space-y-1 text-xs text-zinc-500">
                  {selectedScenario.demo_steps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
