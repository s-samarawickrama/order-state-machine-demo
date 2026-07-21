import React from "react";
import { FileJson } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import OrderItemsList from "./OrderItemsList";
import ChatPanel from "./ChatPanel";

/**
 * Orders view — composes:
 * - Pharmacy items catalogue with availability toggles (left)
 * - Customer–pharmacy chat (right)
 * - Raw order JSON inspector (bottom)
 */
export default function OrdersView({
  order,
  onUpdateItemAvailability,
  onSendMessage,
}) {
  return (
    <div className="grid grid-cols-12 gap-6">
      {/* Order Items Checklist (left) */}
      <div className="col-span-12 md:col-span-7">
        <OrderItemsList
          order={order}
          onUpdateItemAvailability={onUpdateItemAvailability}
        />
      </div>

      {/* Chat Channel (right) */}
      <div className="col-span-12 md:col-span-5">
        <ChatPanel order={order} onSendMessage={onSendMessage} />
      </div>

      {/* Raw Order State Inspector (bottom) */}
      <div className="col-span-12">
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-sm font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
              <FileJson size={16} /> Immutable Workflow State Inspector
            </CardTitle>
          </CardHeader>
          <CardContent>
            {order ? (
              <Accordion type="single" collapsible className="border-t border-zinc-800">
                <AccordionItem value="raw-json" className="border-zinc-800">
                  <AccordionTrigger className="text-zinc-300 hover:text-white text-xs py-3">
                    View Full Order JSON State
                  </AccordionTrigger>
                  <AccordionContent>
                    <pre className="text-xs bg-zinc-950 text-indigo-400 p-4 rounded border border-zinc-800 overflow-x-auto max-h-96">
                      {JSON.stringify(order, null, 2)}
                    </pre>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            ) : (
              <div className="text-zinc-500 italic text-sm text-center py-4">
                No active order state.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
