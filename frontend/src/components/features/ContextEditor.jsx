import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";

/**
 * Dynamic context editor for simulating order context variables.
 * Controls: prescription clarity score, OTP status, pickup deadline, availability status.
 */
export default function ContextEditor({ order, onUpdateContext }) {
  const [prescriptionClarityScore, setPrescriptionClarityScore] = useState(0);
  const [isOtpVerified, setIsOtpVerified] = useState(false);
  const [isOtpGenerated, setIsOtpGenerated] = useState(false);
  const [pickupDeadline, setPickupDeadline] = useState("");
  const [availabilityStatus, setAvailabilityStatus] = useState("AVAILABLE");
  const [lateCancelCount, setLateCancelCount] = useState(0);
  const [noShowCount, setNoShowCount] = useState(0);
  const [isSpecialItem, setIsSpecialItem] = useState(false);
  const [issueReportingWindowHours, setIssueReportingWindowHours] = useState(48);
  const [completedAt, setCompletedAt] = useState("");
  const [acceptSubstitutes, setAcceptSubstitutes] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Sync local state when order changes
  useEffect(() => {
    if (!order) return;
    setPrescriptionClarityScore(order.context?.prescription?.clarity_score ?? 0);
    setIsOtpVerified(order.context?.pickup?.otp_verified ?? false);
    setIsOtpGenerated(order.context?.pickup?.otp_generated ?? false);
    setPickupDeadline(order.context?.pickup?.deadline ?? "");
    setAvailabilityStatus(order.context?.availability?.status ?? "AVAILABLE");
    setLateCancelCount(order.context?.late_cancel_count ?? 0);
    setNoShowCount(order.context?.no_show_count ?? 0);
    setIsSpecialItem(order.context?.is_special_item ?? false);
    setIssueReportingWindowHours(order.context?.issue_reporting_window_hours ?? 48);
    setCompletedAt(order.context?.pickup?.completed_at ?? "");
    setAcceptSubstitutes(order.context?.preferences?.accept_substitutes ?? false);
  }, [order]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const contextUpdates = {
        prescription: { clarity_score: Number(prescriptionClarityScore) },
        pickup: {
          otp_generated: isOtpGenerated,
          otp_verified: isOtpVerified,
          deadline: pickupDeadline || null,
          completed_at: completedAt || null,
        },
        availability: { status: availabilityStatus },
        late_cancel_count: Number(lateCancelCount),
        no_show_count: Number(noShowCount),
        is_special_item: isSpecialItem,
        issue_reporting_window_hours: Number(issueReportingWindowHours),
        preferences: {
          accept_substitutes: acceptSubstitutes,
        },
      };
      await onUpdateContext(contextUpdates);
    } finally {
      setIsSaving(false);
    }
  };

  const setDeadlineFromNow = (hours) => {
    const date = new Date();
    date.setHours(date.getHours() + hours);
    setPickupDeadline(date.toISOString());
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Prescription Clarity Score */}
        <div className="space-y-2 bg-zinc-950 p-4 rounded-lg border border-zinc-800">
          <div className="flex justify-between items-center">
            <label className="text-xs font-bold text-zinc-300 uppercase tracking-wide">
              Prescription Clarity Score
            </label>
            <span className="font-mono text-xs text-indigo-400 font-bold">
              {prescriptionClarityScore}%
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            value={prescriptionClarityScore}
            onChange={(e) => setPrescriptionClarityScore(e.target.value)}
            className="w-full accent-indigo-500 bg-zinc-800"
          />
          <div className="text-[10px] text-zinc-500">
            Routes prescription review path: &lt;20 auto-requests clearer upload, &ge;20 routes to
            manual pharmacist review.
          </div>
        </div>

        {/* Pickup OTP Verification */}
        <div className="space-y-3 bg-zinc-950 p-4 rounded-lg border border-zinc-800 relative">
          <label className="text-xs font-bold text-zinc-300 uppercase tracking-wide block mb-1">
            Pickup OTP Verification
          </label>
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-400">OTP Generated Status</span>
            <Badge
              className={
                isOtpGenerated
                  ? "bg-green-950/40 text-green-400 border border-green-900"
                  : "bg-zinc-800 text-zinc-500"
              }
            >
              {isOtpGenerated ? "GENERATED" : "NOT_GENERATED"}
            </Badge>
          </div>
          <div className="flex items-center justify-between pt-1">
            <span className="text-xs text-zinc-400">OTP Verified Status (Claim)</span>
            <input
              type="checkbox"
              checked={isOtpVerified}
              onChange={(e) => setIsOtpVerified(e.target.checked)}
              className="accent-indigo-500 rounded bg-zinc-800 border-zinc-700 h-4 w-4"
            />
          </div>
          <div className="text-[10px] text-zinc-500">
            For PICKUP_VERIFICATION. OTP must be verified before performing the handover action.
          </div>
        </div>

        {/* Pickup Deadline */}
        <div className="space-y-3 bg-zinc-950 p-4 rounded-lg border border-zinc-800">
          <label className="text-xs font-bold text-zinc-300 uppercase tracking-wide block">
            Pickup Deadline
          </label>
          <input
            type="text"
            value={pickupDeadline}
            onChange={(e) => setPickupDeadline(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-800 rounded px-3 py-1.5 text-xs text-zinc-300 focus:outline-none font-mono"
            placeholder="ISO DateTime string or empty"
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="text-[10px] h-6 bg-zinc-900 border-zinc-800 text-zinc-300"
              onClick={() => setDeadlineFromNow(48)}
            >
              +48 Hours
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-[10px] h-6 bg-zinc-900 border-zinc-800 text-zinc-300"
              onClick={() => setDeadlineFromNow(-1)}
            >
              -1 Hour (Expired)
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-[10px] h-6 bg-zinc-900 border-zinc-800 text-zinc-300"
              onClick={() => setPickupDeadline("")}
            >
              Clear
            </Button>
          </div>
        </div>

        {/* Global Availability Status */}
        <div className="space-y-3 bg-zinc-950 p-4 rounded-lg border border-zinc-800">
          <label className="text-xs font-bold text-zinc-300 uppercase tracking-wide block">
            Global Availability Status
          </label>
          <Select value={availabilityStatus} onValueChange={setAvailabilityStatus}>
            <SelectTrigger className="w-full h-8 bg-zinc-900 border-zinc-700 text-xs text-zinc-300">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-zinc-900 border-zinc-800">
              <SelectItem value="AVAILABLE">Available (Full Quote)</SelectItem>
              <SelectItem value="PARTIAL">Partial Available</SelectItem>
              <SelectItem value="UNAVAILABLE">Unavailable (All Out of Stock)</SelectItem>
            </SelectContent>
          </Select>
          <div className="text-[10px] text-zinc-500">
            Controls medicine catalogue state. In STOCK_CHECK, a stock check action evaluates this
            value to route to Quote Ready/Partial Quote/Unavailable.
          </div>
        </div>

        {/* Customer Preferences */}
        <div className="space-y-3 bg-zinc-950 p-4 rounded-lg border border-zinc-800">
          <label className="text-xs font-bold text-zinc-300 uppercase tracking-wide block">
            Customer Checkout Preferences
          </label>
          <div className="flex items-center justify-between pt-1">
            <span className="text-xs text-zinc-400">Accept Brand Substitutes</span>
            <input
              type="checkbox"
              checked={acceptSubstitutes}
              onChange={(e) => setAcceptSubstitutes(e.target.checked)}
              className="accent-indigo-500 rounded bg-zinc-800 border-zinc-700 h-4 w-4"
            />
          </div>
          <div className="text-[10px] text-zinc-500">
            Indicates whether the customer has authorized the pharmacy to automatically replace out-of-stock items with equivalent substitutes.
          </div>
        </div>
      </div>

      <div className="flex justify-end pt-4 border-t border-zinc-800">
        <Button
          disabled={isSaving}
          onClick={handleSave}
          className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs px-6 h-9"
        >
          {isSaving ? "Saving Context..." : "Save Context Variables"}
        </Button>
      </div>
    </div>
  );
}
