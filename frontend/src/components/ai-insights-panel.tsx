"use client";

import { useState } from "react";
import { Sparkles, RefreshCw } from "lucide-react";
import { api } from "@/lib/api";

interface InsightsResponse {
  summary: string;
  ai_generated: boolean;
  metrics?: Record<string, unknown>;
}

export function AiInsightsPanel({ endpoint, title = "AI Insights" }: { endpoint: string; title?: string }) {
  const [data, setData] = useState<InsightsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = () => {
    setLoading(true);
    setError(null);
    api
      .post<InsightsResponse>(endpoint, {})
      .then(setData)
      .catch(() => setError("Could not generate insights right now."))
      .finally(() => setLoading(false));
  };

  return (
    <div className="card p-6">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-navy">
          <Sparkles className="h-5 w-5 text-brand" /> {title}
        </h2>
        <button onClick={run} disabled={loading} className="btn-outline text-sm">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          {data ? "Refresh" : "Generate"}
        </button>
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
      {!data && !loading && !error && (
        <p className="text-sm text-muted">
          Generate an AI summary of your current performance and suggested next actions.
        </p>
      )}
      {loading && <p className="text-sm text-muted">Analysing your data…</p>}
      {data && (
        <>
          <p className="whitespace-pre-line text-sm text-ink">{data.summary}</p>
          {!data.ai_generated && (
            <p className="mt-2 text-xs text-muted">Rule-based summary (AI model not configured).</p>
          )}
        </>
      )}
    </div>
  );
}
