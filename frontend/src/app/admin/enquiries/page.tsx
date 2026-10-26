"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { LoadingBlock, StatusBadge, EmptyState } from "@/components/ui";
import { DataTable } from "@/components/data-table";

interface AdminEnquiry {
  id: number;
  customer_name?: string;
  status: string;
  dealer_count: number;
  created_at: string;
}

export default function AdminEnquiriesPage() {
  const [enquiries, setEnquiries] = useState<AdminEnquiry[] | null>(null);

  useEffect(() => {
    api.get<AdminEnquiry[]>("/api/admin/enquiries").then(setEnquiries).catch(() => setEnquiries([]));
  }, []);

  if (!enquiries) return <LoadingBlock />;

  return (
    <div>
      <h1 className="text-2xl font-bold text-navy">Enquiries</h1>
      <p className="mt-1 text-muted">Most recent customer enquiries across the platform.</p>
      {enquiries.length === 0 ? (
        <EmptyState title="No enquiries yet" />
      ) : (
        <DataTable
          className="mt-6"
          minWidthClass="min-w-[560px]"
          rows={enquiries}
          rowKey={(e) => e.id}
          mobileTitle={(e) => `Enquiry #${e.id}`}
          columns={[
            { key: "id", header: "Enquiry", cell: (e) => <span className="font-medium text-ink">#{e.id}</span> },
            { key: "customer", header: "Customer", cell: (e) => <span className="text-muted">{e.customer_name || "—"}</span> },
            { key: "dealers", header: "Dealers", cell: (e) => <span className="text-ink">{e.dealer_count}</span> },
            { key: "status", header: "Status", cell: (e) => <StatusBadge status={e.status} /> },
          ]}
        />
      )}
    </div>
  );
}
