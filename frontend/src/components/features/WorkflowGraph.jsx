import React, { useMemo } from "react";
import { Workflow } from "lucide-react";
import ReactFlow, { Background, Controls, MarkerType } from "reactflow";
import "reactflow/dist/style.css";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

/**
 * Computes a Dagre-style layered layout for the FSM graph.
 * Nodes are positioned in layers based on topological order,
 * with horizontal spreading within each layer.
 */
function computeLayout(states, transitions) {
  const stateIds = states.map((s) => s.id);
  const adjacency = {};
  const inDegree = {};

  stateIds.forEach((id) => {
    adjacency[id] = [];
    inDegree[id] = 0;
  });

  transitions.forEach((t) => {
    if (adjacency[t.current_state] && stateIds.includes(t.next_state)) {
      adjacency[t.current_state].push(t.next_state);
      inDegree[t.next_state] = (inDegree[t.next_state] || 0) + 1;
    }
  });

  // Topological sort by layers (BFS Kahn's algorithm)
  const layers = [];
  let queue = stateIds.filter((id) => inDegree[id] === 0);
  const visited = new Set();

  while (queue.length > 0) {
    layers.push([...queue]);
    queue.forEach((id) => visited.add(id));
    const nextQueue = [];
    queue.forEach((id) => {
      (adjacency[id] || []).forEach((neighbor) => {
        inDegree[neighbor]--;
        if (inDegree[neighbor] === 0 && !visited.has(neighbor)) {
          nextQueue.push(neighbor);
        }
      });
    });
    queue = [...new Set(nextQueue)];
  }

  // Add any remaining nodes (cycles) to last layer
  const unvisited = stateIds.filter((id) => !visited.has(id));
  if (unvisited.length > 0) {
    layers.push(unvisited);
  }

  const NODE_WIDTH = 180;
  const NODE_HEIGHT = 50;
  const LAYER_GAP_Y = 120;
  const NODE_GAP_X = 200;

  const positions = {};
  layers.forEach((layer, layerIndex) => {
    const totalWidth = layer.length * NODE_WIDTH + (layer.length - 1) * (NODE_GAP_X - NODE_WIDTH);
    const startX = -totalWidth / 2;
    layer.forEach((id, nodeIndex) => {
      positions[id] = {
        x: startX + nodeIndex * NODE_GAP_X + 300,
        y: layerIndex * LAYER_GAP_Y + 50,
      };
    });
  });

  return positions;
}

/**
 * FSM Graph visualizer using React Flow.
 * Renders states as nodes and transitions as edges with auto-layout.
 */
export default function WorkflowGraph({
  workflowConfig,
  order,
  activeWorkflowId,
  onWorkflowChange,
}) {
  const flowData = useMemo(() => {
    if (!workflowConfig || !order) return { nodes: [], edges: [] };

    const workflowDefinition = workflowConfig.workflows[activeWorkflowId];
    if (!workflowDefinition) return { nodes: [], edges: [] };

    const currentState = order.states?.[activeWorkflowId];
    const positions = computeLayout(workflowDefinition.states, workflowDefinition.transitions);

    const nodes = workflowDefinition.states.map((state) => ({
      id: state.id,
      data: {
        label: (
          <div
            className={`p-2 w-40 text-center rounded text-xs font-bold ${
              state.id === currentState
                ? "bg-green-600 text-white border-green-400"
                : "bg-zinc-800 text-zinc-300 border-zinc-700"
            } border`}
          >
            {state.id === currentState && <span className="mr-1">✓</span>}
            {state.display_name}
          </div>
        ),
      },
      position: positions[state.id] || { x: 50, y: 50 },
      type: "default",
    }));

    // Deduplicate edges between same source→target to avoid overlap
    const edgeMap = new Map();
    workflowDefinition.transitions.forEach((transition, index) => {
      const edgeKey = `${transition.current_state}->${transition.next_state}`;
      if (!edgeMap.has(edgeKey)) {
        edgeMap.set(edgeKey, {
          id: `edge-${edgeKey}-${index}`,
          source: transition.current_state,
          target: transition.next_state,
          animated: transition.current_state === currentState,
          label: transition.label || transition.event,
          labelStyle: { fill: "#a1a1aa", fontSize: 10, fontWeight: "bold" },
          style: {
            stroke: transition.current_state === currentState ? "#22c55e" : "#52525b",
          },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: transition.current_state === currentState ? "#22c55e" : "#52525b",
          },
        });
      }
    });

    return { nodes, edges: Array.from(edgeMap.values()) };
  }, [workflowConfig, order, activeWorkflowId]);

  return (
    <Card className="bg-zinc-900 border-zinc-800 h-[600px] flex flex-col">
      <CardHeader className="pb-3 shrink-0 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
        <CardTitle className="text-sm font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
          <Workflow size={16} /> FSM Graph: {activeWorkflowId.replace(/_/g, " ")}
        </CardTitle>
        {order && (
          <div className="flex flex-wrap gap-1 bg-zinc-950 p-1 rounded-md border border-zinc-800">
            {Object.keys(order.states || {}).map((workflowId) => (
              <button
                key={workflowId}
                onClick={() => onWorkflowChange(workflowId)}
                className={`text-[9px] font-bold px-2 py-0.5 rounded transition-all ${
                  activeWorkflowId === workflowId
                    ? "bg-indigo-600 text-white font-extrabold shadow"
                    : "text-zinc-400 hover:text-white hover:bg-zinc-800"
                }`}
              >
                {workflowId
                  .replace("_LIFECYCLE", "")
                  .replace("_VALIDATION", "")
                  .replace("_VERIFICATION", "")
                  .replace("_MANAGEMENT", "")}
              </button>
            ))}
          </div>
        )}
      </CardHeader>
      <CardContent className="flex-1 p-0 rounded-b-xl overflow-hidden relative border-t border-zinc-800">
        {order ? (
          <ReactFlow
            nodes={flowData.nodes}
            edges={flowData.edges}
            fitView
            proOptions={{ hideAttribution: true }}
            className="bg-zinc-950"
          >
            <Background color="#27272a" gap={16} />
            <Controls className="bg-zinc-800 border-zinc-700 fill-zinc-300" />
          </ReactFlow>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-zinc-600">
            No order loaded
          </div>
        )}
      </CardContent>
    </Card>
  );
}
