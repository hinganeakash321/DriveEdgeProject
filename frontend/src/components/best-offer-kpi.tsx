"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Trophy, ArrowRight } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { Quotation } from "@/lib/types";
import { formatINR } from "@/lib/utils";
import { FadeIn } from "@/components/ui";

/**
 * Personalized "Best offer" KPI tile for the customer home (/browse).
 * Renders nothing for guests, non-customers, or customers with no valid quotes,
 * so the server-rendered marketing page is unchanged for everyone else.
 */
export function BestOfferKpi() {
  const { user } = useAuth();
  const [quotations, setQuotations] = useState<Quotation[] | null>(null);

  const isCustomer = user?.role === "customer";

  useEffect(() => {
    if (!isCustomer) return;
    api
      .get<Quotation[]>("/api/quotations")
      .then(setQuotations)
      .catch(() => setQuotations([]));
  }, [isCustomer]);

  if (!isCustomer) return null;

  const validQuotes = (quotations ?? []).filter(
    (q) => (q.status === "submitted" || q.status === "preferred") && q.enquiry_id != null,
  );
  const best = validQuotes.length
    ? validQuotes.reduce((a, b) => (Number(a.final_price) <= Number(b.final_price) ? a : b))
    : null;

  if (!best) return null;

  return (
    <div className="container-xl pt-6">
      <FadeIn>
        <Link
          href={`/compare-quotes?enquiry_id=${best.enquiry_id}`}
          className="card card-hover relative flex flex-wrap items-center justify-between gap-x-5 gap-y-3 overflow-hidden p-4 sm:p-5"
        >
          <span className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand to-teal" />
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand to-teal text-white shadow-glow">
              <Trophy className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wide text-muted">Here is your best offer</p>
              <p className="truncate text-sm font-semibold text-navy">
                {best.vehicle_label || `Enquiry #${best.enquiry_id}`}
                {best.dealer_name ? ` \u00b7 ${best.dealer_name}` : ""}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <p className="text-2xl font-bold text-navy">{formatINR(best.final_price)}</p>
            <span className="inline-flex items-center gap-1 whitespace-nowrap text-sm font-medium text-brand">
              Compare quotes <ArrowRight className="h-4 w-4" />
            </span>
          </div>
        </Link>
      </FadeIn>
    </div>
  );
}
