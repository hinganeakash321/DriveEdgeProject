"use client";

import { useEffect, useState } from "react";
import { Trophy, TrendingDown, Pencil, Gift } from "lucide-react";
import { api } from "@/lib/api";
import { EmptyState, LoadingBlock, StatusBadge, Stagger, StaggerItem } from "@/components/ui";
import { QuotationForm } from "@/components/quotation-form";
import { formatINR } from "@/lib/utils";
import type { MarketPosition, Quotation } from "@/lib/types";

interface DealerEnquiry {
  enquiry_dealer_id: number;
  enquiry_id: number;
  customer_name?: string;
  vehicle_label?: string;
  vehicle_variant_id?: number;
  location?: string;
  message?: string;
  response_status: string;
  has_quotation: boolean;
  quotation_id?: number | null;
  quotation_status?: string;
  your_final_price?: number | null;
  market: MarketPosition;
}

export function DealerEnquiryList({ onChange }: { onChange?: () => void }) {
  const [enquiries, setEnquiries] = useState<DealerEnquiry[] | null>(null);
  const [quotes, setQuotes] = useState<Record<number, Quotation>>({});
  const [active, setActive] = useState<DealerEnquiry | null>(null);

  const load = () => {
    Promise.all([
      api.get<DealerEnquiry[]>("/api/dealer/enquiries"),
      api.get<Quotation[]>("/api/dealer/quotations"),
    ])
      .then(([e, qs]) => {
        setEnquiries(e);
        const map: Record<number, Quotation> = {};
        for (const q of qs) map[q.id] = q;
        setQuotes(map);
      })
      .catch(() => setEnquiries([]));
  };

  useEffect(() => {
    load();
  }, []);

  if (!enquiries) return <LoadingBlock />;
  if (enquiries.length === 0)
    return <EmptyState title="No enquiries yet" message="Assigned customer enquiries will appear here." />;

  return (
    <>
      <Stagger className="space-y-3">
        {enquiries.map((e) => {
          const m = e.market;
          const showPosition = e.has_quotation && m.total_quotes > 1;
          return (
            <StaggerItem key={e.enquiry_dealer_id} className="card card-hover p-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="font-semibold text-ink">{e.vehicle_label || `Enquiry #${e.enquiry_id}`}</p>
                  <p className="text-xs text-muted">{e.customer_name} &middot; {e.location || "—"}</p>
                </div>
                <StatusBadge status={e.quotation_status || e.response_status} />
              </div>
              {e.message && <p className="mt-2 text-sm text-muted">&ldquo;{e.message}&rdquo;</p>}

              {showPosition && (
                <div className="mt-3 grid grid-cols-3 gap-2 rounded-xl border border-line bg-soft/50 p-3 text-center text-xs">
                  <div>
                    <p className="text-muted">Your price</p>
                    <p className="mt-0.5 font-bold text-navy">{formatINR(e.your_final_price ?? 0)}</p>
                  </div>
                  <div>
                    <p className="flex items-center justify-center gap-1 text-muted"><Trophy className="h-3 w-3 text-teal" /> Lowest</p>
                    <p className="mt-0.5 font-bold text-navy">{formatINR(m.lowest_final_price ?? 0)}</p>
                  </div>
                  <div>
                    <p className="text-muted">Your rank</p>
                    <p className={`mt-0.5 font-bold ${m.is_lowest ? "text-success" : "text-ink"}`}>
                      #{m.your_rank ?? "—"} of {m.total_quotes}
                    </p>
                  </div>
                </div>
              )}

              {e.has_quotation && !m.is_lowest && (m.gap_to_lowest ?? 0) > 0 && (
                <p className="mt-2 flex items-center gap-1 text-xs font-medium text-warning">
                  <TrendingDown className="h-3.5 w-3.5" /> You are {formatINR(m.gap_to_lowest ?? 0)} above the lowest — improve your offer to win.
                </p>
              )}
              {e.has_quotation && m.is_lowest && m.total_quotes > 1 && (
                <p className="mt-2 flex items-center gap-1 text-xs font-medium text-success">
                  <Trophy className="h-3.5 w-3.5" /> You currently have the most competitive offer.
                </p>
              )}
              {e.has_quotation && quotes[e.quotation_id ?? -1]?.special_offer && (
                <p className="mt-2 flex items-center gap-1 text-xs text-teal">
                  <Gift className="h-3.5 w-3.5" /> {quotes[e.quotation_id ?? -1].special_offer}
                </p>
              )}

              <div className="mt-3">
                {e.has_quotation ? (
                  <button className="btn-outline text-xs" onClick={() => setActive(e)}>
                    <Pencil className="h-3.5 w-3.5" /> Edit / Improve offer
                  </button>
                ) : (
                  <button className="btn-gradient text-xs" onClick={() => setActive(e)}>Prepare Quotation</button>
                )}
              </div>
            </StaggerItem>
          );
        })}
      </Stagger>

      {active && active.vehicle_variant_id && (
        <QuotationForm
          enquiryDealerId={active.enquiry_dealer_id}
          variantId={active.vehicle_variant_id}
          vehicleLabel={active.vehicle_label || ""}
          quotationId={active.has_quotation ? active.quotation_id : null}
          initial={active.quotation_id ? quotes[active.quotation_id] : null}
          market={active.market}
          onClose={() => setActive(null)}
          onSubmitted={() => {
            setActive(null);
            load();
            onChange?.();
          }}
        />
      )}
    </>
  );
}
