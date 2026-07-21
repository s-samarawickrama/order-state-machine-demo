import React, { useState, useEffect, useMemo } from 'react';
import { 
  RefreshCw, CheckCircle2, ShieldAlert, Activity, MessageSquare, 
  Terminal, Layers, Pill, ArrowRight, XCircle, Send
} from 'lucide-react';

const API_BASE = "http://localhost:8000";

// --- Utilities ---
const getPath = (obj, path) => path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
const setPath = (obj, path, value) => {
  const keys = path.split('.');
  const clone = JSON.parse(JSON.stringify(obj));
  let cur = clone;
  for (let i = 0; i < keys.length - 1; i++) {
    cur[keys[i]] = cur[keys[i]] || {};
    cur = cur[keys[i]];
  }
  cur[keys[keys.length - 1]] = value;
  return clone;
};

// --- Main Component ---
export default function WorkflowInspector() {
  const [metadata, setMetadata] = useState(null);
  const [order, setOrder] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [role, setRole] = useState("PHARMACY_STAFF");
  const [loading, setLoading] = useState(true);
  const [errorBanner, setErrorBanner] = useState(null);
  const [successBanner, setSuccessBanner] = useState(null);
  
  const [activeTab, setActiveTab] = useState("activity");
  const [chatDraft, setChatDraft] = useState("");
  const [chatSender, setChatSender] = useState("CUSTOMER");
  const [showMetadata, setShowMetadata] = useState(false);

  const request_id = useMemo(() => `REQ-${Math.random().toString(16).slice(2, 8).toUpperCase()}`, [order]);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [metaRes, orderRes, auditRes] = await Promise.all([
        fetch(`${API_BASE}/workflow/metadata`),
        fetch(`${API_BASE}/orders/ORD-001`),
        fetch(`${API_BASE}/audit-logs`)
      ]);
      if (metaRes.ok) setMetadata((await metaRes.json()).data);
      if (orderRes.ok) setOrder((await orderRes.json()).data);
      if (auditRes.ok) setAuditLogs((await auditRes.json()).data);
    } catch (e) {
      console.error("Fetch error:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const availableTransitions = useMemo(() => {
    if (!metadata || !order) return [];
    return metadata.transitions.filter(t => t.current_state === order.current_state);
  }, [metadata, order]);

  const allowedTransitions = useMemo(() => {
    return availableTransitions.filter(t => !t.allowed_roles || t.allowed_roles.includes(role));
  }, [availableTransitions, role]);

  const allContextFields = useMemo(() => {
    const fields = [];
    const seen = new Set();
    availableTransitions.forEach(t => {
      if (t.metadata?.context_fields) {
        t.metadata.context_fields.forEach(f => {
          if (!seen.has(f.path)) {
            seen.add(f.path);
            fields.push(f);
          }
        });
      }
    });
    return fields;
  }, [availableTransitions]);

  const handleContextChange = (path, value) => {
    setOrder(prev => ({ ...prev, context: setPath(prev.context, path, value) }));
  };

  const executeTransition = async (event) => {
    setErrorBanner(null);
    setSuccessBanner(null);
    try {
      const res = await fetch(`${API_BASE}/orders/ORD-001/transition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event, user_role: role, context_updates: order.context })
      });
      const json = await res.json();
      if (!json.success) {
        setErrorBanner(json.errors);
      } else {
        setSuccessBanner(json.data);
        await fetchAll();
      }
    } catch (e) {
      setErrorBanner([{ code: "NETWORK_ERROR", message: "Failed to connect to engine." }]);
    }
  };

  const sendChatMessage = async () => {
    if (!chatDraft.trim()) return;
    try {
      await fetch(`${API_BASE}/orders/ORD-001/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sender: chatSender, message: chatDraft })
      });
      setChatDraft("");
      await fetchAll();
    } catch (e) { console.error("Chat failure", e); }
  };

  if (loading && !order) return <div className="p-8 text-center text-gray-500">Loading Workflow Engine...</div>;
  if (!order || !metadata) return <div className="p-8 text-center text-red-500">Failed to load data. Ensure backend is running.</div>;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans p-4 space-y-4">
      {/* HEADER */}
      <header className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Layers className="text-indigo-600" />
            MediPick Workflow Orchestration Console
          </h1>
          <p className="text-sm text-slate-500 mt-1">Metadata Driven Enterprise Workflow Simulator v{metadata.version}</p>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <div className="px-3 py-1 bg-slate-100 rounded-md border text-slate-600 font-mono">
            {request_id}
          </div>
          <button onClick={fetchAll} className="flex items-center gap-1 px-4 py-2 bg-indigo-50 text-indigo-700 rounded-md hover:bg-indigo-100 transition">
            <RefreshCw size={16} /> Refresh State
          </button>
        </div>
      </header>

      <div className="grid grid-cols-12 gap-4">
        {/* LEFT PANEL: ORDER OVERVIEW */}
        <div className="col-span-12 md:col-span-3 space-y-4">
          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
            <h2 className="text-sm font-bold text-slate-400 uppercase mb-4 tracking-wider">Order Overview</h2>
            <div className="mb-4">
              <div className="text-xs text-slate-500 mb-1">Order ID</div>
              <div className="font-mono font-medium">{order.order_id}</div>
            </div>
            
            <div className="mb-4">
              <div className="text-xs text-slate-500 mb-1">Current State</div>
              <div className="px-3 py-1.5 bg-blue-100 text-blue-800 rounded-md font-bold text-sm inline-flex items-center gap-2 border border-blue-200">
                <Activity size={16} />
                {order.current_state}
              </div>
            </div>

            <div className="space-y-2 mt-6">
              <div className="text-xs font-bold text-slate-400 uppercase mb-2">Workflow Timeline</div>
              {metadata.states.map((s, idx) => {
                const isCurrent = s.id === order.current_state;
                const isPast = metadata.states.findIndex(x => x.id === order.current_state) > idx;
                return (
                  <div key={s.id} className={`flex items-center gap-3 text-sm ${isCurrent ? 'text-indigo-700 font-bold' : isPast ? 'text-slate-500' : 'text-slate-300'}`}>
                    {isCurrent ? <ArrowRight size={16} /> : isPast ? <CheckCircle2 size={16} /> : <div className="w-4 h-4 border-2 rounded-full" />}
                    <span>{s.display_name}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* CENTER PANEL: CONTEXT & ACTIONS */}
        <div className="col-span-12 md:col-span-6 space-y-4">
          {/* ROLE SIMULATOR */}
          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex justify-between items-center">
            <div className="font-medium text-slate-700">Simulate Role:</div>
            <select 
              value={role} 
              onChange={e => setRole(e.target.value)}
              className="border border-slate-300 rounded-md px-3 py-1.5 bg-slate-50 font-medium"
            >
              <option value="CUSTOMER">Customer</option>
              <option value="PHARMACY_STAFF">Pharmacy Staff</option>
              <option value="SYSTEM">System</option>
              <option value="ADMIN">Admin</option>
            </select>
          </div>

          {/* DYNAMIC CONTEXT SIMULATOR */}
          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
            <h2 className="text-sm font-bold text-slate-400 uppercase mb-4 tracking-wider flex items-center gap-2">
              <Terminal size={16}/> Dynamic Context Simulator
            </h2>
            {allContextFields.length === 0 ? (
              <div className="text-slate-400 text-sm italic">No active context fields for current state transitions.</div>
            ) : (
              <div className="space-y-4">
                {allContextFields.map(field => (
                  <div key={field.path} className="flex justify-between items-center p-3 bg-slate-50 border rounded-lg">
                    <div>
                      <div className="font-medium text-sm">{field.label}</div>
                      <div className="text-xs text-slate-500 font-mono mt-0.5">{field.path}</div>
                    </div>
                    {field.type === 'BOOLEAN' && (
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                          type="checkbox" 
                          className="sr-only peer"
                          disabled={!field.editable}
                          checked={!!getPath(order.context, field.path)}
                          onChange={e => handleContextChange(field.path, e.target.checked)}
                        />
                        <div className="w-11 h-6 bg-slate-200 rounded-full peer peer-checked:bg-indigo-600 peer-focus:ring-4 peer-focus:ring-indigo-300 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
                      </label>
                    )}
                    {field.type === 'SELECT' && (
                      <select 
                        disabled={!field.editable}
                        value={getPath(order.context, field.path) || ""}
                        onChange={e => handleContextChange(field.path, e.target.value)}
                        className="border rounded px-2 py-1 text-sm bg-white"
                      >
                        <option value="">Select...</option>
                        {field.options?.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* VALIDATION / SUCCESS BANNER */}
          {errorBanner && (
            <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg">
              <div className="flex items-center gap-2 text-red-800 font-bold mb-2"><XCircle size={18}/> Transition Blocked</div>
              <ul className="space-y-2">
                {errorBanner.map((err, i) => (
                  <li key={i} className="text-sm bg-white p-2 rounded border border-red-100 shadow-sm">
                    <span className="font-mono text-xs bg-red-100 text-red-800 px-1.5 py-0.5 rounded mr-2">{err.code}</span>
                    {err.message}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {successBanner && (
            <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-lg flex justify-between items-center">
              <div>
                <div className="flex items-center gap-2 text-emerald-800 font-bold"><CheckCircle2 size={18}/> Transition Successful</div>
                <div className="text-sm text-emerald-600 mt-1">Moved to: <b>{successBanner.new_state}</b></div>
              </div>
              <div className="text-xs font-mono bg-emerald-100 text-emerald-800 px-2 py-1 rounded border border-emerald-200">
                {successBanner.audit_id}
              </div>
            </div>
          )}

          {/* ACTIONS */}
          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
            <h2 className="text-sm font-bold text-slate-400 uppercase mb-4 tracking-wider">Available Actions</h2>
            {allowedTransitions.length === 0 ? (
              <div className="text-slate-400 text-sm italic">No actions available for role {role} in this state.</div>
            ) : (
              <div className="flex flex-wrap gap-3">
                {allowedTransitions.map(t => (
                  <button
                    key={t.id}
                    onClick={() => executeTransition(t.event)}
                    className={`px-4 py-2 rounded-lg font-medium text-sm border shadow-sm transition-all ${
                      t.danger 
                        ? 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
                        : 'bg-indigo-600 text-white border-indigo-700 hover:bg-indigo-700'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT PANEL: COMMUNICATION & AUDIT */}
        <div className="col-span-12 md:col-span-3 space-y-4">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-[500px]">
            <div className="flex border-b">
              <button 
                onClick={() => setActiveTab('activity')}
                className={`flex-1 py-3 text-sm font-medium ${activeTab === 'activity' ? 'bg-indigo-50 text-indigo-700 border-b-2 border-indigo-600' : 'text-slate-500 hover:bg-slate-50'}`}
              >
                Activity Timeline
              </button>
              <button 
                onClick={() => setActiveTab('chat')}
                className={`flex-1 py-3 text-sm font-medium ${activeTab === 'chat' ? 'bg-indigo-50 text-indigo-700 border-b-2 border-indigo-600' : 'text-slate-500 hover:bg-slate-50'}`}
              >
                Chat
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 bg-slate-50">
              {activeTab === 'activity' ? (
                <div className="space-y-4">
                  {order.order_event_history?.slice().reverse().map((evt, i) => (
                    <div key={i} className="bg-white p-3 rounded border shadow-sm text-sm border-l-2 border-l-indigo-400">
                      <div className="flex justify-between items-start mb-1">
                        <span className="font-bold text-slate-700">{evt.event}</span>
                        <span className="text-xs text-slate-400">{new Date(evt.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                      </div>
                      <div className="text-xs text-slate-500 mb-2">By: {evt.performed_by}</div>
                      <div className="text-xs px-2 py-1 bg-slate-100 rounded font-mono break-all inline-block">
                        {evt.previous_state} → {evt.new_state}
                      </div>
                    </div>
                  ))}
                  {order.notifications?.slice().reverse().map((notif, i) => (
                    <div key={`n-${i}`} className="bg-amber-50 p-3 rounded border border-amber-100 shadow-sm text-sm border-l-2 border-l-amber-400">
                      <div className="flex justify-between items-start mb-1">
                        <span className="font-bold text-amber-900">{notif.title}</span>
                        <span className="text-xs text-amber-500">{new Date(notif.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                      </div>
                      <div className="text-xs text-amber-700">{notif.message}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-4 flex flex-col h-full">
                  <div className="flex-1 space-y-3 overflow-y-auto">
                    {order.chat_messages?.map((msg, i) => (
                      <div key={i} className={`flex flex-col ${msg.sender === chatSender ? 'items-end' : 'items-start'}`}>
                        <span className="text-[10px] text-slate-400 mb-0.5">{msg.sender} • {new Date(msg.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                        <div className={`px-3 py-2 rounded-lg text-sm max-w-[85%] ${msg.sender === chatSender ? 'bg-indigo-600 text-white' : 'bg-white border text-slate-700'}`}>
                          {msg.message}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="pt-2 border-t mt-auto">
                    <select 
                      value={chatSender} onChange={e=>setChatSender(e.target.value)}
                      className="w-full mb-2 text-xs border rounded p-1 bg-white"
                    >
                      <option value="CUSTOMER">Customer</option>
                      <option value="PHARMACY_STAFF">Pharmacy Staff</option>
                    </select>
                    <div className="flex gap-2">
                      <input 
                        type="text" value={chatDraft} onChange={e=>setChatDraft(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && sendChatMessage()}
                        className="flex-1 border rounded px-2 py-1 text-sm"
                        placeholder="Type message..."
                      />
                      <button onClick={sendChatMessage} className="bg-slate-800 text-white p-1.5 rounded hover:bg-slate-700"><Send size={16}/></button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

      </div>

      {/* BOTTOM PANEL: AUDIT & METADATA */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
        {/* AUDIT CONSOLE */}
        <div className="bg-slate-900 text-green-400 p-4 rounded-xl shadow-sm font-mono text-xs overflow-y-auto h-64 border border-slate-800">
          <div className="flex items-center gap-2 text-slate-400 font-bold mb-4 uppercase tracking-widest pb-2 border-b border-slate-700">
            <Terminal size={14}/> Immutable Audit Trail
          </div>
          <div className="space-y-4">
            {auditLogs.slice().reverse().map(log => (
              <div key={log.audit_id} className="border-l border-green-800 pl-3">
                <div className="text-white">[{new Date(log.timestamp).toISOString()}] <span className="text-yellow-300">{log.audit_id}</span> ({log.request_id})</div>
                <div className="text-indigo-300 mt-1">TRANSITION: {log.transition.event} ({log.transition.from} {"->"} {log.transition.to})</div>
                {log.actions?.length > 0 && (
                  <div className="mt-1 space-y-1">
                    {log.actions.map((act, i) => (
                      <div key={i} className="text-slate-400">
                        &nbsp;&nbsp;→ {act.action} [<span className={act.status === 'SUCCESS' ? 'text-green-500' : 'text-red-500'}>{act.status}</span>]
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* METADATA INSPECTOR */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 overflow-y-auto h-64 relative">
          <div className="sticky top-0 bg-white/90 backdrop-blur pb-2 border-b mb-2 flex justify-between items-center">
            <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Raw Workflow Metadata</h2>
            <button onClick={() => setShowMetadata(!showMetadata)} className="text-xs text-indigo-600 font-medium">
              {showMetadata ? 'Hide' : 'View Raw JSON'}
            </button>
          </div>
          {showMetadata ? (
            <pre className="text-[10px] font-mono text-slate-600 whitespace-pre-wrap">{JSON.stringify(metadata, null, 2)}</pre>
          ) : (
            <div className="text-sm text-slate-500 italic mt-8 text-center px-8">
              "The evaluator should clearly see: Frontend did not know OTP existed. Frontend did not know payment existed. Frontend only rendered metadata."
              <br/><br/>Click 'View Raw JSON' to inspect the engine configuration driving this UI.
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
