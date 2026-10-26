"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import type { Quotation } from "@/lib/types";
import { Gift } from "lucide-react";
import { RoleGuard } from "@/components/role-guard";
import { EmptyState, LoadingBlock, StatusBadge, FadeIn } from "@/components/ui";
import { formatINR } from "@/lib/utils";

function QuotationDetail() {
  const params = useParams();
  const quotationId = Number(params.quotationId);
  const [q, setQ] = useState<Quotation | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    api.get<Quotation>(`/api/quotations/${quotationId}`).then(setQ).catch(() => setError(true));
  }, [quotationId]);

  if (error) return <div className="container-xl py-8"><EmptyState title="Quotation not found" message="This quotation does not exist or is not yours." /></div>;
  if (!q) return <div className="container-xl"><LoadingBlock /></div>;

  const rows: { label: string; value: string; sub?: boolean }[] = [
    { label: "Ex-showroom price", value: formatINR(q.ex_showroom_price) },
    { label: "Registration charges", value: formatINR(q.registration_charges) },
    { label: "Insurance", value: formatINR(q.insurance_amount) },
    { label: "Accessories", value: formatINR(q.accessories_amount) },
    { label: "Other charges", value: formatINR(q.other_charges) },
    { label: "Discount", value: `- ${formatINR(q.discount_amount)}` },
  ];

  return (
    <div className="container-xl py-8">
      <Link href="/dashboard/quotations" className="text-sm text-brand hover:underline">&larr; Back to quotations</Link>
      <FadeIn className="mt-2 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy">{q.vehicle_label || `Quotation #${q.id}`}</h1>
          <p className="text-sm text-muted">{q.dealer_name} {q.dealer_city ? `· ${q.dealer_city}` : ""}</p>
        </div>
        <StatusBadge status={q.status} />
      </FadeIn>

      {q.special_offer && (
        <FadeIn delay={0.05} className="mt-4 flex items-center gap-2 rounded-xl border border-teal/30 bg-teal-50 p-3 text-sm text-teal">
          <Gift className="h-4 w-4 shrink-0" /> <span className="font-medium">Special offer:</span> {q.special_offer}
        </FadeIn>
      )}

      <FadeIn delay={0.1} className="card mt-6 max-w-lg p-6">
        <h2 className="mb-4 text-sm font-semibold text-ink">On-road price breakup</h2>
        <table className="w-full text-sm">
          <tbody>
            {rows.map((r) => (
              <tr key={r.label} className="border-b border-line/60">
                <td className="py-2.5 text-muted">{r.label}</td>
                <td className="py-2.5 text-right text-ink">{r.value}</td>
              </tr>
            ))}
            <tr>
              <td className="py-3 font-semibold text-navy">Final on-road price</td>
              <td className="py-3 text-right text-lg font-bold text-navy">{formatINR(q.final_price)}</td>
            </tr>
          </tbody>
        </table>
        {q.estimated_delivery && <p className="mt-3 text-sm text-muted">Estimated delivery: {q.estimated_delivery}</p>}
        {q.validity_date && <p className="text-sm text-muted">Valid until: {q.validity_date}</p>}
        {q.notes && <p className="mt-3 rounded-lg bg-soft p-3 text-sm text-ink">{q.notes}</p>}
      </FadeIn>
    </div>
  );
}

export default function Page() {
  return <RoleGuard role="customer"><QuotationDetail /></RoleGuard>;
}
