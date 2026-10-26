"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Send, Sparkles, Trash2, Loader2, Car, MapPin, BadgeCheck, Inbox } from "lucide-react";
import { api } from "@/lib/api";
import { formatINR } from "@/lib/utils";
import { useChatStore } from "@/lib/chat-store";
import { Markdown } from "@/components/markdown";
import type {
  ChatAction,
  ChatEnquiry,
  ChatVehicle,
  ComparisonResult,
  StructuredChatResponse,
} from "@/lib/types";

export type { Msg } from "@/lib/chat-store";

export type ChatConfig = {
  endpoint: string;
  heading: string;
  subtext: string;
  statusLabel: string;
  placeholder: string;
  suggestions: string[];
};

export const CONSUMER_CHAT: ChatConfig = {
  endpoint: "/api/ai/chat",
  heading: "DriveEdge AI Assistant",
  subtext: "Explore cars, compare variants, discover dealerships, and understand your buying options.",
  statusLabel: "Online",
  placeholder: "Ask about cars, comparisons, dealers\u2026",
  suggestions: [
    "Find an SUV under 15 lakh",
    "Compare Tata Nexon and Hyundai Venue",
    "Recommend a family car for city driving",
    "Find dealerships near Pune",
    "Help me compare dealer quotations",
  ],
};

export const DEALER_CHAT: ChatConfig = {
  endpoint: "/api/ai/dealer-chat",
  heading: "DriveEdge Dealer AI",
  subtext: "Review your performance, triage enquiries, draft quotations and plan competitive pricing.",
  statusLabel: "Dealer workspace",
  placeholder: "Ask about enquiries, quotations, pricing\u2026",
  suggestions: [
    "How is my dealership performing?",
    "Show my pending enquiries",
    "What should I price the Tata Nexon at?",
    "Help me draft a quotation",
  ],
};

export function chatConfigForRole(role?: string): ChatConfig {
  if (role === "dealer") return DEALER_CHAT;
  if (role === "admin") return ADMIN_CHAT;
  return CONSUMER_CHAT;
}

export const ADMIN_CHAT: ChatConfig = {
  endpoint: "/api/ai/admin-chat",
  heading: "DriveEdge Admin AI",
  subtext: "Get platform-wide insights and aggregate answers across customers, dealers and catalogue.",
  statusLabel: "Admin workspace",
  placeholder: "Ask about platform health, totals\u2026",
  suggestions: [
    "Give me a platform health summary",
    "How many dealers are pending approval?",
    "Which manufacturers get the most enquiries?",
    "How many enquiries so far?",
  ],
};

function price(n?: number | null): string {
  if (n === null || n === undefined) return "Price N/A";
  return formatINR(String(n));
}

function VehicleResultCard({ v }: { v: ChatVehicle }) {
  const id = v.vehicle_id ?? v.id;
  return (
    <div className="rounded-lg border border-line bg-card p-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted">{v.manufacturer}</p>
          <p className="font-semibold text-navy">{v.model}</p>
        </div>
        <span className="text-sm font-bold text-ink">{price(v.min_price)}</span>
      </div>
      {v.matches && v.matches.length > 0 && (
        <ul className="mt-2 space-y-0.5">
          {v.matches.slice(0, 3).map((m) => (
            <li key={m} className="flex items-start gap-1.5 text-xs text-ink">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-teal" />
              {m}
            </li>
          ))}
        </ul>
      )}
      {v.tradeoffs && v.tradeoffs.length > 0 && (
        <p className="mt-1 text-xs text-warning">Trade-off: {v.tradeoffs[0]}</p>
      )}
      {id && (
        <div className="mt-2 flex gap-2">
          <Link href={`/cars/${id}`} className="text-xs font-semibold text-brand hover:underline">
            View details &rarr;
          </Link>
        </div>
      )}
    </div>
  );
}

function ComparisonTable({ c }: { c: ComparisonResult }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-line">
      <table className="w-full text-left text-xs">
        <thead>
          <tr className="bg-soft">
            <th className="p-2 font-semibold text-muted">Attribute</th>
            {c.vehicles.map((n) => (
              <th key={n} className="p-2 font-semibold text-navy">{n}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {c.rows.map((r) => (
            <tr key={r.attribute} className="border-t border-line">
              <td className="p-2 text-muted">{r.attribute}</td>
              {r.values.map((val, i) => (
                <td key={i} className="p-2 text-ink">{val}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DealerResult({ d }: { d: Record<string, unknown> }) {
  return (
    <div className="flex items-start justify-between rounded-lg border border-line bg-card p-3">
      <div>
        <p className="flex items-center gap-1 font-semibold text-navy">
          {String(d.name)}
          {d.verified ? <BadgeCheck className="h-4 w-4 text-teal" /> : null}
        </p>
        <p className="flex items-center gap-1 text-xs text-muted">
          <MapPin className="h-3 w-3" /> {String(d.city)}
          {d.state ? `, ${String(d.state)}` : ""}
        </p>
      </div>
      <Link href={`/dealers/${d.dealer_id}`} className="text-xs font-semibold text-brand hover:underline">
        View
      </Link>
    </div>
  );
}

function QuoteResult({ q }: { q: Record<string, unknown> }) {
  const lowest = Boolean(q.is_lowest);
  const offer = q.special_offer ? String(q.special_offer) : "";
  return (
    <div className={`rounded-lg border p-3 ${lowest ? "border-teal bg-teal/5" : "border-line bg-card"}`}>
      {q.model ? <p className="text-xs uppercase tracking-wide text-muted">{String(q.model)}</p> : null}
      <div className="flex items-center justify-between">
        <p className="font-semibold text-navy">{String(q.dealer)}</p>
        <span className="text-sm font-bold text-ink">{price(Number(q.final_price))}</span>
      </div>
      {offer && <p className="mt-1 text-xs text-teal">{offer}</p>}
      {lowest && <span className="badge-success mt-1 inline-block">Lowest final price</span>}
    </div>
  );
}

function EnquiryResult({ e }: { e: ChatEnquiry }) {
  return (
    <div className="flex items-start justify-between rounded-lg border border-line bg-card p-3">
      <div>
        <p className="flex items-center gap-1.5 font-semibold text-navy">
          <Inbox className="h-4 w-4 text-brand" />
          {e.vehicle_label ?? "Enquiry"}
        </p>
        <p className="text-xs text-muted">
          {e.customer_name ? `${e.customer_name}` : "Customer"}
          {e.location ? ` \u00b7 ${e.location}` : ""}
        </p>
      </div>
      <Link href="/dealer/enquiries" className="text-xs font-semibold text-brand hover:underline">
        Respond
      </Link>
    </div>
  );
}

export function AiChat({
  embedded = false,
  config = CONSUMER_CHAT,
}: {
  embedded?: boolean;
  config?: ChatConfig;
}) {
  const { messages, setMessages, conversationId, setConversationId, resetChat } = useChatStore();
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", text: trimmed }]);
    setLoading(true);
    try {
      const res = await api.post<StructuredChatResponse>(config.endpoint, {
        message: trimmed,
        conversation_id: conversationId,
      });
      if (res.conversation_id) setConversationId(res.conversation_id);
      setMessages((m) => [...m, { role: "assistant", data: res }]);
    } catch {
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          data: {
            intent: "error",
            message: "Sorry, I couldn't reach the assistant. Please try again.",
            data: { vehicles: [], dealers: [], quotations: [] },
            actions: [],
            clarification_required: false,
            ai_generated: false,
          },
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  async function clear() {
    if (conversationId) {
      try {
        await api.del(`/api/ai/conversations/${conversationId}`);
      } catch {
        /* ignore - may be a guest conversation */
      }
    }
    resetChat();
  }

  function runAction(a: ChatAction) {
    if (a.type === "suggest" && typeof a.payload.message === "string") {
      send(a.payload.message);
    } else if (a.type === "compare_vehicles" && Array.isArray(a.payload.vehicle_ids)) {
      router.push(`/compare-cars?ids=${(a.payload.vehicle_ids as number[]).join(",")}`);
    } else if (a.type === "request_quotes" && a.payload.vehicle_id) {
      router.push(`/cars/${a.payload.vehicle_id}`);
    }
  }

  return (
    <div className={`flex flex-col ${embedded ? "h-full" : "h-full"}`}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-hero text-white">
            <Sparkles className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-semibold text-navy">{config.heading}</p>
            <p className="flex items-center gap-1 text-xs text-muted">
              <span className="h-2 w-2 rounded-full bg-success" /> {config.statusLabel}
            </p>
          </div>
        </div>
        <button onClick={clear} className="rounded-lg p-2 text-muted hover:bg-soft" aria-label="Clear conversation">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-4">
        {messages.length === 0 && (
          <div className="py-6 text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand">
              <Car className="h-6 w-6" />
            </span>
            <h3 className="mt-3 font-semibold text-navy">{config.heading}</h3>
            <p className="mt-1 text-sm text-muted">{config.subtext}</p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {config.suggestions.map((s) => (
                <button key={s} onClick={() => send(s)} className="chip hover:border-brand hover:text-brand">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) =>
          m.role === "user" ? (
            <div key={i} className="flex justify-end">
              <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-brand px-4 py-2 text-sm text-white">
                {m.text}
              </div>
            </div>
          ) : (
            <div key={i} className="space-y-3">
              <div className="max-w-[90%] rounded-2xl rounded-bl-sm bg-soft px-4 py-2 text-sm text-ink">
                <Markdown>{m.data.message}</Markdown>
                {!m.data.ai_generated && (
                  <span className="mt-1 block text-[10px] uppercase tracking-wide text-muted">
                    Rule-based response
                  </span>
                )}
              </div>
              {m.data.data.vehicles.length > 0 && (
                <div className="grid gap-2">
                  {m.data.data.vehicles.slice(0, 4).map((v, k) => (
                    <VehicleResultCard key={k} v={v} />
                  ))}
                </div>
              )}
              {m.data.data.comparison && <ComparisonTable c={m.data.data.comparison} />}
              {m.data.data.dealers.length > 0 && (
                <div className="grid gap-2">
                  {m.data.data.dealers.slice(0, 5).map((d, k) => (
                    <DealerResult key={k} d={d} />
                  ))}
                </div>
              )}
              {m.data.data.quotations.length > 0 && (
                <div className="grid gap-2">
                  {m.data.data.quotations.map((q, k) => (
                    <QuoteResult key={k} q={q} />
                  ))}
                </div>
              )}
              {m.data.data.enquiries && m.data.data.enquiries.length > 0 && (
                <div className="grid gap-2">
                  {m.data.data.enquiries.map((e, k) => (
                    <EnquiryResult key={k} e={e} />
                  ))}
                </div>
              )}
              {m.data.actions.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {m.data.actions.map((a, k) => (
                    <button key={k} onClick={() => runAction(a)} className="btn-outline text-xs">
                      {a.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        )}

        {loading && (
          <div className="flex items-center gap-2 text-sm text-muted">
            <Loader2 className="h-4 w-4 animate-spin" /> Thinking&hellip;
          </div>
        )}
      </div>

      {/* Input */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="flex items-center gap-2 border-t border-line p-3"
      >
        <input
          className="input"
          placeholder={config.placeholder}
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <button type="submit" className="btn-primary" disabled={loading || !input.trim()} aria-label="Send">
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}
