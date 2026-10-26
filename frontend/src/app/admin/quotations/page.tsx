"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { LoadingBlock, StatusBadge, EmptyState } from "@/components/ui";
import { DataTable } from "@/components/data-table";
import { formatINR } from "@/lib/utils";

interface AdminQuotation {
  id: number;
  dealer_name?: string;
  final_price: number;
  status: string;
  created_at: string;
}

export default function AdminQuotationsPage() {
  const [quotations, setQuotations] = useState<AdminQuotation[] | null>(null);

  useEffect(() => {
    api.get<AdminQuotation[]>("/api/admin/quotations").then(setQuotations).catch(() => setQuotations([]));
  }, []);

  if (!quotations) return <LoadingBlock />;

  return (
    <div>
      <h1 className="text-2xl font-bold text-navy">Quotations</h1>
      <p className="mt-1 text-muted">Most recent dealer quotations across the platform.</p>
      {quotations.length === 0 ? (
        <EmptyState title="No quotations yet" />
      ) : (
        <DataTable
          className="mt-6"
          minWidthClass="min-w-[560px]"
          rows={quotations}
          rowKey={(q) => q.id}
          mobileTitle={(q) => `Quotation #${q.id}`}
          columns={[
            { key: "id", header: "Quotation", cell: (q) => <span className="font-medium text-ink">#{q.id}</span> },
            { key: "dealer", header: "Dealer", cell: (q) => <span className="text-muted">{q.dealer_name || "—"}</span> },
            { key: "price", header: "Final price", cell: (q) => <span className="font-semibold text-ink">{formatINR(q.final_price)}</span> },
            { key: "status", header: "Status", cell: (q) => <StatusBadge status={q.status} /> },
          ]}
        />
      )}
    </div>
  );
}
