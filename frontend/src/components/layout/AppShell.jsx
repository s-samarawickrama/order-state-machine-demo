import React from "react";
import {
  Workflow, LayoutDashboard, Box, Play, Clock, Settings, Terminal
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import {
  SidebarProvider, Sidebar, SidebarHeader, SidebarContent,
  SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarTrigger,
} from "@/components/ui/sidebar";

const NAVIGATION_ITEMS = [
  { id: "dashboard",     label: "Dashboard",      icon: LayoutDashboard },
  { id: "orders",        label: "Orders",         icon: Box },
  { id: "simulator",     label: "Simulator",      icon: Play },
  { id: "audit",         label: "Audit Explorer", icon: Clock },
  { id: "configuration", label: "Configuration",  icon: Settings },
  { id: "api-tester",     label: "API Tester",     icon: Terminal },
];

const ROLE_OPTIONS = [
  { value: "CUSTOMER",       label: "Customer" },
  { value: "PHARMACY_STAFF", label: "Pharmacy Staff" },
  { value: "PHARMACIST",     label: "Pharmacist (Licensed)" },
  { value: "ADMIN",          label: "Admin" },
  { value: "SYSTEM",         label: "System" },
];

export default function AppShell({
  activeView,
  onViewChange,
  activeRole,
  onRoleChange,
  order,
  children,
}) {
  return (
    <SidebarProvider>
      <div className="flex h-screen w-full bg-zinc-950 text-zinc-50 overflow-hidden font-sans">

        {/* ── Sidebar ── */}
        <Sidebar className="border-r border-zinc-800 bg-zinc-900">
          <SidebarHeader className="p-4 border-b border-zinc-800">
            <h1 className="text-xl font-bold flex items-center gap-2 text-white">
              <Workflow className="text-indigo-500" /> MediPick Engine
            </h1>
          </SidebarHeader>
          <SidebarContent className="p-2">
            <SidebarMenu>
              {NAVIGATION_ITEMS.map((item) => (
                <SidebarMenuItem key={item.id}>
                  <SidebarMenuButton
                    isActive={activeView === item.id}
                    onClick={() => onViewChange(item.id)}
                    className={`text-zinc-400 hover:text-white hover:bg-zinc-800 ${
                      activeView === item.id ? "bg-zinc-800 text-white font-semibold" : ""
                    }`}
                  >
                    <item.icon size={16} /> <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarContent>
        </Sidebar>

        {/* ── Main Workspace ── */}
        <div className="flex-1 overflow-auto bg-zinc-950">

          {/* ── Header ── */}
          <div className="h-14 border-b border-zinc-800 px-6 flex items-center justify-between sticky top-0 bg-zinc-950/80 backdrop-blur z-10">
            <div className="flex items-center gap-4">
              <SidebarTrigger className="text-zinc-400 hover:text-white hover:bg-zinc-800 -ml-2 mr-1" />
              <span className="font-bold text-zinc-200">
                {NAVIGATION_ITEMS.find((n) => n.id === activeView)?.label ?? activeView}
              </span>
              {order && (
                <Badge variant="outline" className="bg-zinc-900 border-zinc-700 font-mono text-zinc-300">
                  {order.order_id}
                </Badge>
              )}
              {order?.parent_order_id && (
                <Badge variant="outline" className="bg-amber-950/40 border-amber-800 text-amber-400 text-[10px] font-mono">
                  Parent: {order.parent_order_id}
                </Badge>
              )}
              {order?.replacement_order_id && (
                <Badge variant="outline" className="bg-indigo-950/40 border-indigo-800 text-indigo-400 text-[10px] font-mono">
                  Replacement: {order.replacement_order_id}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-3">
              {order?.states?.ORDER_LIFECYCLE === "PRESCRIPTION_VALIDATION" && activeRole !== "PHARMACIST" && (
                <button
                  onClick={() => onRoleChange("PHARMACIST")}
                  className="px-3 py-1 bg-amber-500/20 border border-amber-500/40 text-amber-300 hover:bg-amber-500/30 text-xs font-semibold rounded-md animate-pulse flex items-center gap-1.5 transition"
                >
                  <span>Action Pending: Switch to Pharmacist</span>
                </button>
              )}
              <span className="text-xs text-zinc-500 font-bold uppercase tracking-widest">
                Active Role
              </span>
              <Select value={activeRole} onValueChange={onRoleChange}>
                <SelectTrigger className="w-[200px] h-8 bg-zinc-900 border-zinc-700">
                  <SelectValue placeholder="Select Role" />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* ── Page Content ── */}
          <div className="p-6">{children}</div>
        </div>
      </div>
    </SidebarProvider>
  );
}
