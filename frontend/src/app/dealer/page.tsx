"use client";

import { useEffect, useState } from "react";
import { Inbox, Clock, FileText, Star } from "lucide-react";
import { api } from "@/lib/api";
import { KpiCard, EmptyState, LoadingBlock, FadeIn, Stagger, StaggerItem } from "@/components/ui";
import { DealerEnquiryList } from "@/components/dealer-enquiry-list";
import { DealerAnalytics } from "@/components/dealer-analytics";
import { AiInsightsPanel } from "@/components/ai-insights-panel";

interface Analytics {
  kpis: {
    new_enquiries: number;
    pending_responses: number;
    quotations_submitted: number;
    preferred_quotations: number;
    response_rate: number;
  };
  quotation_status_distribution: { status: string; count: number }[];
  top_models_by_enquiry: { model: string; count: number }[];
}

function DealerPortal() {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [error, setError] = useState(false);

  const load = () => api.get<Analytics>("/api/dealer/analytics").then(setAnalytics).catch(() => setError(true));

  useEffect(() => {
    load();
  }, []);

  if (error) return <EmptyState title="Dealer workspace unavailable" message="No dealership is linked to this account, or it is pending approval." />;
  if (!analytics) return <LoadingBlock />;

  const k = analytics.kpis;

  return (
    <div>
      <FadeIn>
        <h1 className="text-3xl font-bold tracking-tight text-navy">Dealer Portal</h1>
        <p className="mt-1 text-muted">Manage enquiries, submit quotations, and track performance.</p>
      </FadeIn>

      <Stagger className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StaggerItem><KpiCard label="New Enquiries" value={k.new_enquiries} icon={<Inbox className="h-5 w-5" />} accent /></StaggerItem>
        <StaggerItem><KpiCard label="Pending Responses" value={k.pending_responses} icon={<Clock className="h-5 w-5" />} /></StaggerItem>
        <StaggerItem><KpiCard label="Quotations Submitted" value={k.quotations_submitted} icon={<FileText className="h-5 w-5" />} /></StaggerItem>
        <StaggerItem><KpiCard label="Preferred Quotations" value={k.preferred_quotations} icon={<Star className="h-5 w-5" />} /></StaggerItem>
      </Stagger>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="card p-6">
          <h2 className="mb-4 text-lg font-semibold text-navy">Assigned Enquiries</h2>
          <DealerEnquiryList onChange={load} />
        </div>
        <div className="card p-6">
          <h2 className="mb-4 text-lg font-semibold text-navy">Analytics</h2>
          <p className="text-sm text-muted">Response rate: <span className="font-semibold text-ink">{k.response_rate}%</span></p>
          <DealerAnalytics data={analytics.quotation_status_distribution} />
        </div>
      </div>

      <div className="mt-6 card p-6">
        <h2 className="mb-1 text-lg font-semibold text-navy">Top models by enquiries</h2>
        <p className="mb-4 text-sm text-muted">Your most in-demand models by number of customer enquiries.</p>
        {analytics.top_models_by_enquiry.length === 0 ? (
          <EmptyState title="No enquiries yet" message="Model demand will appear here once customers start enquiring." />
        ) : (
          <ol className="space-y-2">
            {analytics.top_models_by_enquiry.map((m, i) => {
              const max = analytics.top_models_by_enquiry[0].count || 1;
              return (
                <li key={m.model} className="flex items-center gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand">
                    {i + 1}
                  </span>
                  <span className="w-40 shrink-0 truncate text-sm font-medium text-ink" title={m.model}>{m.model}</span>
                  <span className="relative h-2 flex-1 overflow-hidden rounded-full bg-soft">
                    <span
                      className="absolute inset-y-0 left-0 rounded-full bg-brand"
                      style={{ width: `${Math.max(8, (m.count / max) * 100)}%` }}
                    />
                  </span>
                  <span className="w-10 shrink-0 text-right text-sm font-semibold text-navy">{m.count}</span>
                </li>
              );
            })}
          </ol>
        )}
      </div>

      <div className="mt-6">
        <AiInsightsPanel endpoint="/api/ai/dealer-assistant" title="AI Performance Assistant" />
      </div>
    </div>
  );
}

export default function Page() {
  return <DealerPortal />;
}
