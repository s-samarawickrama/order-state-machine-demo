import React, { useState } from "react";
import { Clock } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";

/**
 * Chat panel for customer–pharmacy communication.
 * Supports switching the sender role and sending messages.
 */
export default function ChatPanel({ order, onSendMessage }) {
  const [messageText, setMessageText] = useState("");
  const [activeSender, setActiveSender] = useState("CUSTOMER");
  const [isSending, setIsSending] = useState(false);

  const handleSend = async () => {
    if (!messageText.trim()) return;
    setIsSending(true);
    try {
      await onSendMessage(activeSender, messageText);
      setMessageText("");
    } finally {
      setIsSending(false);
    }
  };

  if (!order) {
    return (
      <Card className="bg-zinc-900 border-zinc-800 flex flex-col h-[500px]">
        <CardHeader className="pb-3 shrink-0">
          <CardTitle className="text-sm font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
            <Clock size={16} /> Communication Channel
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-zinc-500 text-center py-10 italic">
            No active order to chat.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-zinc-900 border-zinc-800 flex flex-col h-[500px]">
      <CardHeader className="pb-3 shrink-0 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
          <Clock size={16} /> Communication Channel
        </CardTitle>
        {order.states?.ORDER_LIFECYCLE === "READY_FOR_PICKUP" && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => onExecuteTransition && onExecuteTransition("request_extension")}
            className="text-[10px] bg-indigo-950/40 border-indigo-700/60 text-indigo-300 hover:bg-indigo-900/60 h-6 px-2"
          >
            ⏰ Request Extension (+24h)
          </Button>
        )}
      </CardHeader>
      <CardContent className="flex-1 flex flex-col overflow-hidden gap-3 pb-4">
        <div className="flex flex-col h-full justify-between">
          {/* Message list */}
          <div className="flex-1 overflow-y-auto space-y-3 pr-2 min-h-0 max-h-[290px]">
            {order.chat_messages?.map((msg, index) => (
              <div
                key={index}
                className={`flex flex-col ${
                  msg.sender === activeSender ? "items-end" : "items-start"
                }`}
              >
                <span className="text-[10px] text-zinc-500 mb-0.5">
                  {msg.sender} • {new Date(msg.timestamp).toLocaleTimeString()}
                </span>
                <div
                  className={`px-3 py-1.5 rounded-lg text-xs max-w-[85%] ${
                    msg.sender === "SYSTEM"
                      ? "bg-amber-950/50 text-amber-300 border border-amber-800/60 font-mono"
                      : msg.sender === activeSender
                      ? "bg-indigo-600 text-white"
                      : "bg-zinc-800 text-zinc-300 border border-zinc-700"
                  }`}
                >
                  {msg.message}
                </div>
              </div>
            ))}
            {(!order.chat_messages || order.chat_messages.length === 0) && (
              <div className="text-zinc-600 text-xs italic text-center pt-8">
                No messages. Start a conversation below.
              </div>
            )}
          </div>

          {/* Quick Chat Actions */}
          <div className="pt-2 flex flex-wrap gap-1.5">
            <button
              onClick={() => setMessageText("Can I get a 24h pickup extension?")}
              className="text-[10px] bg-zinc-950 hover:bg-zinc-800 text-zinc-400 border border-zinc-800 rounded px-2 py-0.5 flex items-center gap-1"
            >
              <MessageSquare size={12} /> "Can I get an extension?"
            </button>
            <button
              onClick={() => setMessageText("Is my prescription ready to pick up?")}
              className="text-[10px] bg-zinc-950 hover:bg-zinc-800 text-zinc-400 border border-zinc-800 rounded px-2 py-0.5 flex items-center gap-1"
            >
              <MessageSquare size={12} /> "Is it ready?"
            </button>
          </div>

          {/* Message input */}
          <div className="pt-2 border-t border-zinc-800 mt-auto flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">
                Send As:
              </span>
              <Select value={activeSender} onValueChange={setActiveSender}>
                <SelectTrigger className="w-[150px] h-6 bg-zinc-950 border-zinc-800 text-[10px] text-zinc-300">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-zinc-950 border-zinc-800">
                  <SelectItem value="CUSTOMER">Customer</SelectItem>
                  <SelectItem value="PHARMACY_STAFF">Pharmacy Staff</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSend();
                }}
                className="flex-1 bg-zinc-950 border border-zinc-800 rounded px-3 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-indigo-500"
                placeholder="Type your message..."
                disabled={isSending}
              />
              <Button
                size="sm"
                onClick={handleSend}
                disabled={isSending || !messageText.trim()}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs h-8"
              >
                Send
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
