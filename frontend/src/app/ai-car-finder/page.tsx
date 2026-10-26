"use client";

import { useState } from "react";
import Link from "next/link";
import { Sparkles, CheckCircle2, AlertTriangle, HelpCircle } from "lucide-react";
import { api } from "@/lib/api";
import { formatINR } from "@/lib/utils";
import { Spinner, FadeIn, Stagger, StaggerItem } from "@/components/ui";

interface Recommendation {
  vehicle_id: number;
  manufacturer?: string;
  model?: string;
  min_price?: number;
  max_price?: number;
  matches: string[];
  tradeoffs: string[];
  unknowns: string[];
}

interface Result {
  preferences: Record<string, unknown>;
  recommendations: Recommendation[];
  explanation: string;
  ai_generated: boolean;
  disclaimer: string;
}

const EXAMPLES = [
  "I need a family car under ₹12 lakh in Pune, mostly city driving, automatic preferred.",
  "Looking for a 7-seater diesel SUV under ₹25 lakh for highway trips.",
  "Best electric car under ₹20 lakh with good range for daily commute.",
];

export default function AiCarFinderPage() {
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (text?: string) => {
    const msg = text ?? message;
    if (!msg.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.post<Result>("/api/ai/car-finder", { message: msg });
      setResult(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to get recommendations");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container-xl py-10">
      <FadeIn className="mx-auto max-w-3xl text-center">
        <span className="chip mx-auto"><Sparkles className="h-3.5 w-3.5 text-teal" /> AI Car Finder</span>
        <h1 className="mt-4 text-3xl font-bold tracking-tight md:text-4xl">
          Not sure which car <span className="text-gradient">fits you?</span>
        </h1>
        <p className="mt-2 text-muted">
          Tell us your budget, family needs, driving habits, and preferences. DriveEdge will find
          suitable vehicles from our live catalogue. Recommendations only include real vehicles.
        </p>
      </FadeIn>

      <div className="mx-auto mt-8 max-w-3xl">
        <div className="card p-4">
          <textarea
            className="input focus-ring min-h-[96px]"
            placeholder="Describe what you're looking for..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              {EXAMPLES.map((ex) => (
                <button key={ex} onClick={() => { setMessage(ex); run(ex); }} className="chip transition-colors hover:border-brand hover:text-brand">
                  {ex.slice(0, 32)}...
                </button>
              ))}
            </div>
            <button className="btn-gradient" disabled={loading} onClick={() => run()}>
              {loading ? <Spinner className="h-4 w-4 text-white" /> : "Find My Perfect Car"}
            </button>
          </div>
        </div>

        {error && <p className="mt-4 text-sm text-danger" role="alert">{error}</p>}

        {result && (
          <div className="mt-8 space-y-4">
            <div className="card p-5">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-navy">Our recommendation</h3>
                <span className={result.ai_generated ? "badge-success" : "badge-muted"}>
                  {result.ai_generated ? "AI-generated" : "Rule-based (AI unavailable)"}
                </span>
              </div>
              <p className="mt-2 text-sm text-ink">{result.explanation}</p>
            </div>

            {result.recommendations.length === 0 ? (
              <div className="card p-6 text-center text-muted">No catalogue vehicles match all hard constraints. Try relaxing your budget or preferences.</div>
            ) : (
              <Stagger className="space-y-4">
                {result.recommendations.map((r) => (
                  <StaggerItem key={r.vehicle_id}>
                    <div className="card card-hover p-5">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-xs uppercase text-muted">{r.manufacturer}</p>
                          <h4 className="text-lg font-semibold text-navy">{r.model}</h4>
                          <p className="font-medium text-ink">{formatINR(r.min_price)} onwards</p>
                        </div>
                        <Link href={`/cars/${r.vehicle_id}`} className="btn-outline text-xs">View details</Link>
                      </div>
                      <div className="mt-3 grid gap-3 sm:grid-cols-3">
                        <FeatureBlock icon={<CheckCircle2 className="h-4 w-4 text-success" />} title="Matches" items={r.matches} />
                        <FeatureBlock icon={<AlertTriangle className="h-4 w-4 text-warning" />} title="Trade-offs" items={r.tradeoffs} />
                        <FeatureBlock icon={<HelpCircle className="h-4 w-4 text-muted" />} title="Unknowns" items={r.unknowns} />
                      </div>
                    </div>
                  </StaggerItem>
                ))}
              </Stagger>
            )}
            <p className="rounded-lg bg-soft p-4 text-xs text-muted">{result.disclaimer}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function FeatureBlock({ icon, title, items }: { icon: React.ReactNode; title: string; items: string[] }) {
  return (
    <div>
      <p className="flex items-center gap-1 text-xs font-semibold text-ink">{icon} {title}</p>
      {items.length ? (
        <ul className="mt-1 space-y-1 text-xs text-muted">{items.map((i) => <li key={i}>{i}</li>)}</ul>
      ) : (
        <p className="mt-1 text-xs text-muted">—</p>
      )}
    </div>
  );
}
