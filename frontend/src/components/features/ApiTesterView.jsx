import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Play, Send, RefreshCw, Terminal, Eye, EyeOff, ShieldAlert } from "lucide-react";
import { fetchScenarioList } from "@/api/workflowApi";

export default function ApiTesterView({ workflowConfig, order, activeRole, onLoadScenario }) {
  const [scenarios, setScenarios] = useState([]);
  const [selectedScenario, setSelectedScenario] = useState("");
  const [selectedEndpoint, setSelectedEndpoint] = useState("POST_TRANSITION");
  
  // FSM interactive helpers
  const [selectedWorkflow, setSelectedWorkflow] = useState("");
  const [selectedState, setSelectedState] = useState("");
  const [selectedEvent, setSelectedEvent] = useState("");
  
  // JSON Body and request parameters
  const [requestBody, setRequestBody] = useState("");
  const [activeHeaders, setActiveHeaders] = useState({ "Content-Type": "application/json" });
  
  // Response panel state
  const [responseStatus, setResponseStatus] = useState(null);
  const [responseTimeMs, setResponseTimeMs] = useState(null);
  const [responsePayload, setResponsePayload] = useState(null);
  const [isSending, setIsSending] = useState(false);
  
  // Request log history
  const [history, setHistory] = useState([]);

  // Load scenario options
  useEffect(() => {
    async function loadScenarios() {
      try {
        const list = await fetchScenarioList();
        setScenarios(list);
      } catch (err) {
        console.error("Failed to load scenarios:", err);
      }
    }
    loadScenarios();
  }, []);

  // Set default workflow when config loads
  useEffect(() => {
    if (workflowConfig && Object.keys(workflowConfig.workflows).length > 0) {
      setSelectedWorkflow(Object.keys(workflowConfig.workflows)[0]);
    }
  }, [workflowConfig]);

  // When selected workflow changes, set the first state as default
  useEffect(() => {
    if (workflowConfig && selectedWorkflow) {
      const states = workflowConfig.workflows[selectedWorkflow]?.states || [];
      if (states.length > 0) {
        setSelectedState(states[0].id);
      }
    }
  }, [selectedWorkflow, workflowConfig]);

  // Automatically update JSON payload template based on selections
  useEffect(() => {
    if (selectedEndpoint === "POST_TRANSITION" || selectedEndpoint === "POST_SIMULATE") {
      const body = {
        event: selectedEvent || "submit_order",
        user_role: activeRole,
        context_updates: null
      };
      setRequestBody(JSON.stringify(body, null, 2));
    } else if (selectedEndpoint === "POST_CONTEXT") {
      const body = {
        context_updates: {
          prescription: { clarity_score: 95 },
          payment: { status: "PAID" }
        }
      };
      setRequestBody(JSON.stringify(body, null, 2));
    } else {
      setRequestBody("");
    }
  }, [selectedEndpoint, selectedEvent, activeRole]);

  // Get list of transitions for the selected workflow and state
  const getAvailableTransitions = () => {
    if (!workflowConfig || !selectedWorkflow || !selectedState) return [];
    const workflow = workflowConfig.workflows[selectedWorkflow];
    if (!workflow) return [];
    return (workflow.transitions || []).filter(t => t.current_state === selectedState);
  };

  // Helper to auto-select matching transition
  const handleTransitionSelect = (eventVal) => {
    setSelectedEvent(eventVal);
  };

  // Send the actual API Request
  const handleSendRequest = async () => {
    if (!order && selectedEndpoint !== "POST_SCENARIO") {
      alert("Please load or create an order scenario first.");
      return;
    }

    setIsSending(true);
    setResponseStatus(null);
    setResponsePayload(null);
    setResponseTimeMs(null);

    const orderId = order?.order_id;
    let url = "";
    let method = "GET";
    let bodyData = null;

    if (selectedEndpoint === "GET_ORDER") {
      url = `/orders/${orderId}?role=${activeRole}`;
      method = "GET";
    } else if (selectedEndpoint === "POST_TRANSITION") {
      url = `/orders/${orderId}/transition`;
      method = "POST";
      bodyData = requestBody;
    } else if (selectedEndpoint === "POST_SIMULATE") {
      url = `/orders/${orderId}/simulate`;
      method = "POST";
      bodyData = requestBody;
    } else if (selectedEndpoint === "POST_CONTEXT") {
      url = `/orders/${orderId}/context?role=${activeRole}`;
      method = "POST";
      bodyData = JSON.stringify(JSON.parse(requestBody).context_updates || {});
    }

    const startTime = performance.now();
    try {
      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          "X-Request-ID": `REQ-${Math.random().toString(36).substring(2, 9).toUpperCase()}`
        },
        body: bodyData
      });

      const endTime = performance.now();
      setResponseTimeMs(Math.round(endTime - startTime));
      setResponseStatus(`${response.status} ${response.statusText}`);
      
      const text = await response.text();
      let parsed = text;
      try { parsed = JSON.parse(text); } catch(e) {}
      setResponsePayload(parsed);

      // Append to local history log
      setHistory(prev => [
        {
          timestamp: new Date().toLocaleTimeString(),
          method,
          endpoint: url,
          status: response.status,
          success: response.ok
        },
        ...prev.slice(0, 19)
      ]);

      // If transition was successful, trigger state refresh in main App.jsx
      if (response.ok && method === "POST" && selectedEndpoint === "POST_TRANSITION") {
        onLoadScenario(null); // Triggers audit log and state refetching implicitly
      }

    } catch (error) {
      const endTime = performance.now();
      setResponseTimeMs(Math.round(endTime - startTime));
      setResponseStatus("Network Error / Failed connection");
      setResponsePayload({ error: error.message });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      
      {/* ── Left Control Column ── */}
      <div className="lg:col-span-5 space-y-6">
        
        {/* Scenario Loader Card */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-sm font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
              <Play className="h-4 w-4 text-indigo-500" /> Initialize Scenario
            </CardTitle>
            <CardDescription className="text-zinc-500 text-xs">
              Load an active order scenario into memory to start sending requests.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Select value={selectedScenario} onValueChange={setSelectedScenario}>
                <SelectTrigger className="bg-zinc-950 border-zinc-800">
                  <SelectValue placeholder="Select a Scenario" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-950 border-zinc-800 text-zinc-300">
                  {scenarios.map(sc => (
                    <SelectItem key={sc.id} value={sc.id}>
                      {sc.description} ({sc.order_type})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button 
                onClick={() => onLoadScenario(selectedScenario)}
                disabled={!selectedScenario}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold flex gap-1.5 items-center shrink-0"
              >
                <RefreshCw className="h-4 w-4" /> Load
              </Button>
            </div>
            {order && (
              <div className="bg-zinc-950/50 p-3 rounded-lg border border-zinc-800/80 space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-zinc-500">Active Order ID:</span>
                  <span className="font-mono font-bold text-emerald-400">{order.order_id}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-zinc-500">Order Type:</span>
                  <span className="text-zinc-300 font-semibold">{order.order_type}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* API Endpoint Selector */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-sm font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
              <Terminal className="h-4 w-4 text-emerald-500" /> Select API Endpoint
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs text-zinc-500 font-bold uppercase">Endpoint</label>
              <Select value={selectedEndpoint} onValueChange={setSelectedEndpoint}>
                <SelectTrigger className="bg-zinc-950 border-zinc-800 font-mono text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-zinc-950 border-zinc-800 text-zinc-300 font-mono text-xs">
                  <SelectItem value="GET_ORDER">GET /orders/&#123;id&#125;</SelectItem>
                  <SelectItem value="POST_TRANSITION">POST /orders/&#123;id&#125;/transition</SelectItem>
                  <SelectItem value="POST_SIMULATE">POST /orders/&#123;id&#125;/simulate</SelectItem>
                  <SelectItem value="POST_CONTEXT">POST /orders/&#123;id&#125;/context</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Dropdown FSM Helpers */}
            {(selectedEndpoint === "POST_TRANSITION" || selectedEndpoint === "POST_SIMULATE") && (
              <div className="bg-zinc-950/60 p-4 rounded-lg border border-zinc-800/80 space-y-4">
                <h4 className="text-xs text-zinc-400 font-bold uppercase tracking-wider">
                  State & Event Helper Selector
                </h4>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] text-zinc-500 font-bold uppercase">Workflow</label>
                    <Select value={selectedWorkflow} onValueChange={setSelectedWorkflow}>
                      <SelectTrigger className="bg-zinc-900 border-zinc-800 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-zinc-950 border-zinc-800 text-zinc-300 text-xs">
                        {workflowConfig && Object.keys(workflowConfig.workflows).map(wKey => (
                          <SelectItem key={wKey} value={wKey}>{wKey}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] text-zinc-500 font-bold uppercase">State</label>
                    <Select value={selectedState} onValueChange={setSelectedState}>
                      <SelectTrigger className="bg-zinc-900 border-zinc-800 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-zinc-950 border-zinc-800 text-zinc-300 text-xs">
                        {workflowConfig && selectedWorkflow && 
                          workflowConfig.workflows[selectedWorkflow]?.states.map(s => (
                            <SelectItem key={s.id} value={s.id}>{s.display_name}</SelectItem>
                          ))
                        }
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-zinc-500 font-bold uppercase">Available Event</label>
                  <Select value={selectedEvent} onValueChange={handleTransitionSelect}>
                    <SelectTrigger className="bg-zinc-900 border-zinc-800 text-xs">
                      <SelectValue placeholder="Select Event" />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-950 border-zinc-800 text-zinc-300 text-xs">
                      {getAvailableTransitions().map(t => (
                        <SelectItem key={t.id} value={t.event}>
                          {t.label} ({t.event})
                        </SelectItem>
                      ))}
                      {getAvailableTransitions().length === 0 && (
                        <SelectItem value="_no_event" disabled>No events available for this state</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {/* Request Body Payload Editor */}
            {selectedEndpoint !== "GET_ORDER" && (
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-xs text-zinc-500 font-bold uppercase">JSON Payload</label>
                  <Badge variant="outline" className="text-[10px] bg-zinc-950 border-zinc-800 font-mono">JSON</Badge>
                </div>
                <Textarea 
                  value={requestBody}
                  onChange={(e) => setRequestBody(e.target.value)}
                  className="font-mono text-xs h-[180px] bg-zinc-950 border-zinc-800 text-indigo-300 focus-visible:ring-indigo-600"
                />
              </div>
            )}

            <Button
              onClick={handleSendRequest}
              disabled={isSending}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex items-center justify-center gap-2"
            >
              {isSending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Send Request
            </Button>
          </CardContent>
        </Card>

      </div>

      {/* ── Right Output / History Column ── */}
      <div className="lg:col-span-7 space-y-6">
        
        {/* Live Response Panel */}
        <Card className="bg-zinc-900 border-zinc-800 h-[480px] flex flex-col">
          <CardHeader className="border-b border-zinc-800 pb-4">
            <div className="flex justify-between items-center">
              <div>
                <CardTitle className="text-sm font-bold text-zinc-400 uppercase tracking-widest">
                  HTTP Response
                </CardTitle>
                <CardDescription className="text-zinc-500 text-xs">
                  Raw API output returned from the backend order engine.
                </CardDescription>
              </div>
              
              <div className="flex items-center gap-2">
                {responseTimeMs && (
                  <Badge className="bg-zinc-950 border-zinc-800 text-zinc-400 text-[10px] font-mono">
                    {responseTimeMs} ms
                  </Badge>
                )}
                {responseStatus && (
                  <Badge className={`text-xs font-bold ${
                    responseStatus.startsWith("2") ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-red-500/10 text-red-400 border-red-500/20"
                  }`}>
                    {responseStatus}
                  </Badge>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex-1 p-0 overflow-hidden relative">
            {responsePayload ? (
              <pre className="h-full overflow-auto p-4 text-xs font-mono text-zinc-300 bg-zinc-950 selection:bg-zinc-800 selection:text-white leading-5">
                {JSON.stringify(responsePayload, null, 2)}
              </pre>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-zinc-600 bg-zinc-950/40 p-6 text-center">
                <Terminal className="h-10 w-10 mb-3 text-zinc-800" />
                <p className="text-sm font-semibold">No request dispatched yet</p>
                <p className="text-xs text-zinc-600 max-w-[280px] mt-1">
                  Select an endpoint and hit "Send Request" to trigger an API interaction.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Local Request History Log */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-sm font-bold text-zinc-400 uppercase tracking-widest">
              Request History
            </CardTitle>
            <CardDescription className="text-zinc-500 text-xs">
              Last 20 API requests made during this active browser session.
            </CardDescription>
          </CardHeader>
          <CardContent className="max-h-[200px] overflow-y-auto px-4 pb-4">
            <div className="divide-y divide-zinc-800/80">
              {history.map((log, index) => (
                <div key={index} className="py-2.5 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3">
                    <span className="text-zinc-500 font-mono">{log.timestamp}</span>
                    <span className={`font-bold ${log.method === "GET" ? "text-blue-400" : "text-amber-400"}`}>
                      {log.method}
                    </span>
                    <span className="font-mono text-zinc-400 select-all">{log.endpoint}</span>
                  </div>
                  <Badge variant="outline" className={`${
                    log.success ? "bg-emerald-950/30 border-emerald-900 text-emerald-400" : "bg-red-950/30 border-red-900 text-red-400"
                  } text-[10px] font-mono`}>
                    Status: {log.status}
                  </Badge>
                </div>
              ))}
              {history.length === 0 && (
                <div className="text-center py-6 text-zinc-600 text-xs">
                  Request history is empty.
                </div>
              )}
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
