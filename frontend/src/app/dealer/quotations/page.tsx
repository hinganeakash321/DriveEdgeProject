"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { EmptyState, LoadingBlock, StatusBadge, FadeIn } from "@/components/ui";
import { DataTable } from "@/components/data-table";
import { formatINR } from "@/lib/utils";

interface Quotation {
  id: number;
  vehicle_label?: string;
  final_price: number;
  ex_showroom_price: number;
  discount_amount: number;
  status: string;
  validity_date?: string;
  created_at: string;
}

export default function DealerQuotationsPage() {
  const [quotations, setQuotations] = useState<Quotation[] | null>(null);

  useEffect(() => {
    api.get<Quotation[]>("/api/dealer/quotations").then(setQuotations).catch(() => setQuotations([]));
  }, []);

  if (!quotations) return <LoadingBlock />;

  return (
    <div>
      <FadeIn>
        <h1 className="text-2xl font-bold text-navy">My Quotations</h1>
        <p className="mt-1 text-muted">All quotations you have drafted or submitted.</p>
      </FadeIn>
      {quotations.length === 0 ? (
        <EmptyState title="No quotations yet" message="Quotations you prepare for enquiries will appear here." />
      ) : (
        <FadeIn>
          <DataTable
            className="mt-6"
            minWidthClass="min-w-[720px]"
            rows={quotations}
            rowKey={(q) => q.id}
            mobileTitle={(q) => q.vehicle_label || `Quotation #${q.id}`}
            columns={[
              { key: "vehicle", header: "Vehicle", cell: (q) => <span className="font-medium text-ink">{q.vehicle_label || `Quotation #${q.id}`}</span> },
              { key: "ex", header: "Ex-showroom", cell: (q) => <span className="text-ink">{formatINR(q.ex_showroom_price)}</span> },
              { key: "disc", header: "Discount", cell: (q) => <span className="text-ink">{q.discount_amount ? formatINR(q.discount_amount) : "—"}</span> },
              { key: "final", header: "Final price", cell: (q) => <span className="font-semibold text-ink">{formatINR(q.final_price)}</span> },
              { key: "valid", header: "Valid till", cell: (q) => <span className="text-muted">{q.validity_date || "—"}</span> },
              { key: "status", header: "Status", cell: (q) => <StatusBadge status={q.status} /> },
            ]}
          />
        </FadeIn>
      )}
    </div>
  );
}
