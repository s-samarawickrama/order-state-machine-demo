import React from "react";
import { Box } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";

/**
 * Pharmacy items catalogue showing order items with availability toggles.
 */
export default function OrderItemsList({ order, onUpdateItemAvailability }) {
  if (!order) {
    return (
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
            <Box size={16} /> Pharmacy Items Catalogue & Checkout Checklist
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-zinc-500 text-center py-10 italic">
            No order active. Load a scenario first.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-zinc-900 border-zinc-800">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
          <Box size={16} /> Pharmacy Items Catalogue & Checkout Checklist
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          <div className="text-xs text-zinc-500 mb-2">
            Updating item availability simulates real-world inventory checks.
          </div>
          {order.order_items?.map((item) => (
            <div
              key={item.order_item_id}
              className="bg-zinc-950 p-4 rounded-lg border border-zinc-800 flex justify-between items-center"
            >
              <div>
                <div className="font-bold text-zinc-200">{item.medicine_name_snapshot}</div>
                <div className="text-[10px] text-zinc-500 font-mono mt-0.5">
                  {item.medicine_catalogue_id} • {item.category}
                </div>
              </div>
              <div className="flex items-center gap-4">
                <Badge
                  className={
                    item.requires_prescription
                      ? "bg-red-950/40 text-red-400 border border-red-900"
                      : "bg-green-950/40 text-green-400 border border-green-900"
                  }
                >
                  {item.requires_prescription ? "Prescription" : "OTC"}
                </Badge>
                <Select
                  value={item.availability_result}
                  onValueChange={(value) =>
                    onUpdateItemAvailability(item.order_item_id, value)
                  }
                >
                  <SelectTrigger className="w-[130px] h-8 bg-zinc-900 border-zinc-700 text-xs text-zinc-300">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-800">
                    <SelectItem value="AVAILABLE">Available</SelectItem>
                    <SelectItem value="OUT_OF_STOCK">Out of Stock</SelectItem>
                    <SelectItem value="BRAND_SUBSTITUTION_REQUIRED">Substitute</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
