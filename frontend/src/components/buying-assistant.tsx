"use client";

import { useState } from "react";
import Link from "next/link";
import { Send, Sparkles } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Spinner } from "@/components/ui";
import { Drawer } from "@/components/overlay";
import { Markdown } from "@/components/markdown";

interface Msg {
  role: "user" | "assistant";
  content: string;
  ai?: boolean;
}

export function BuyingAssistant({
  vehicleId,
  enquiryId,
  context,
  onClose,
}: {
  vehicleId?: number;
  enquiryId?: number;
  context?: string;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Msg[]>([
    { role: "assistant", content: `Hi! Ask me anything about ${context || "this vehicle"} or your quotations. I use only DriveEdge's verified data.`, ai: false },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<number | undefined>();

  const send = async () => {
    if (!input.trim()) return;
    const text = input.trim();
    setInput("");
    setMessages((m) => [...m, { role: "user", content: text }]);
    setLoading(true);
    try {
      const res = await api.post<{ reply: string; ai_generated: boolean; conversation_id?: number }>(
        "/api/ai/buying-assistant",
        { message: text, vehicle_id: vehicleId, enquiry_id: enquiryId, conversation_id: conversationId }
      );
      setConversationId(res.conversation_id);
      setMessages((m) => [...m, { role: "assistant", content: res.reply, ai: res.ai_generated }]);
    } catch (e) {
      setMessages((m) => [...m, { role: "assistant", content: e instanceof Error ? e.message : "Something went wrong.", ai: false }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Drawer
      open
      onClose={onClose}
      side="right"
      title={<span className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-teal" /> AI Buying Assistant</span>}
    >
      <div className="flex h-full flex-col">
        {!user ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
            <p className="text-sm text-muted">Log in as a customer to use the AI Buying Assistant.</p>
            <Link href="/login" className="btn-gradient">Log in</Link>
          </div>
        ) : (
          <>
            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              {messages.map((m, i) => (
                <div key={i} className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${m.role === "user" ? "ml-auto bg-brand text-white" : "bg-soft text-ink"}`}>
                  {m.role === "assistant" ? <Markdown>{m.content}</Markdown> : m.content}
                  {m.role === "assistant" && !m.ai && <span className="mt-1 block text-[10px] uppercase text-muted">Non-AI fallback</span>}
                </div>
              ))}
              {loading && <div className="flex items-center gap-2 text-sm text-muted"><Spinner className="h-4 w-4" /> Thinking...</div>}
            </div>
            <div className="border-t border-line p-3">
              <div className="flex gap-2">
                <input
                  className="input focus-ring"
                  placeholder="Ask about specs, offers, trade-offs..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && send()}
                />
                <button className="btn-gradient" onClick={send} disabled={loading} aria-label="Send"><Send className="h-4 w-4" /></button>
              </div>
            </div>
          </>
        )}
      </div>
    </Drawer>
  );
}
