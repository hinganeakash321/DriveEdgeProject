"use client";

import { Star, Gift } from "lucide-react";
import type { Quotation } from "@/lib/types";
import { formatINR } from "@/lib/utils";
import { StatusBadge } from "@/components/ui";

export function QuotationCompareTable({
  quotations,
  onPrefer,
}: {
  quotations: Quotation[];
  onPrefer?: (id: number) => void;
}) {
  const rows: { label: string; key: keyof Quotation }[] = [
    { label: "Ex-showroom", key: "ex_showroom_price" },
    { label: "Registration", key: "registration_charges" },
    { label: "Insurance", key: "insurance_amount" },
    { label: "Accessories", key: "accessories_amount" },
    { label: "Other charges", key: "other_charges" },
    { label: "Discount", key: "discount_amount" },
  ];

  return (
    <>
    <div className="card hidden overflow-x-auto md:block">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b border-line">
            <th className="p-4 text-left font-medium text-muted">Component</th>
            {quotations.map((q) => (
              <th key={q.id} className="p-4 text-left">
                <p className="font-semibold text-navy">{q.dealer_name}</p>
                <p className="text-xs text-muted">{q.dealer_city}</p>
                <div className="mt-1"><StatusBadge status={q.status} /></div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr key={row.label} className={idx % 2 ? "bg-soft/40" : ""}>
              <td className="p-4 text-muted">{row.label}</td>
              {quotations.map((q) => (
                <td key={q.id} className="p-4 text-ink">
                  {row.key === "discount_amount" && Number(q[row.key]) > 0 ? "-" : ""}
                  {formatINR(q[row.key] as string)}
                </td>
              ))}
            </tr>
          ))}
          <tr className="border-t-2 border-line bg-card">
            <td className="p-4 font-semibold text-ink">Final price</td>
            {quotations.map((q) => (
              <td key={q.id} className="p-4">
                <span className="text-lg font-bold text-navy">{formatINR(q.final_price)}</span>
                {q.is_lowest && <span className="badge-success ml-2">Lowest</span>}
              </td>
            ))}
          </tr>
          <tr>
            <td className="p-4 text-muted">Value score</td>
            {quotations.map((q) => (
              <td key={q.id} className="p-4 text-ink">{q.value_score != null ? `${q.value_score}/100` : "—"}</td>
            ))}
          </tr>
          <tr>
            <td className="p-4 text-muted">Est. delivery</td>
            {quotations.map((q) => (
              <td key={q.id} className="p-4 text-ink">{q.estimated_delivery || "Not specified"}</td>
            ))}
          </tr>
          <tr>
            <td className="p-4 text-muted">Valid until</td>
            {quotations.map((q) => (
              <td key={q.id} className="p-4 text-ink">{q.validity_date || "Not specified"}</td>
            ))}
          </tr>
          {quotations.some((q) => q.special_offer) && (
            <tr>
              <td className="p-4 text-muted">Special offer</td>
              {quotations.map((q) => (
                <td key={q.id} className="p-4">
                  {q.special_offer ? (
                    <span className="inline-flex items-center gap-1 rounded-lg bg-teal/10 px-2.5 py-1 text-xs font-semibold text-teal">
                      <Gift className="h-3.5 w-3.5" /> {q.special_offer}
                    </span>
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </td>
              ))}
            </tr>
          )}
          {onPrefer && (
            <tr>
              <td className="p-4" />
              {quotations.map((q) => (
                <td key={q.id} className="p-4">
                  <button
                    onClick={() => onPrefer(q.id)}
                    disabled={q.status === "preferred"}
                    className={q.status === "preferred" ? "btn-outline border-teal text-teal" : "btn-primary"}
                  >
                    <Star className="h-4 w-4" /> {q.status === "preferred" ? "Preferred" : "Mark preferred"}
                  </button>
                </td>
              ))}
            </tr>
          )}
        </tbody>
      </table>
    </div>

    {/* Mobile: one card per quotation */}
    <div className="space-y-4 md:hidden">
      {quotations.map((q) => (
        <div key={q.id} className={`card p-4 ${q.is_lowest ? "border-teal" : ""}`}>
          <div className="mb-3 flex items-start justify-between gap-2 border-b border-line/60 pb-2">
            <div>
              <p className="font-semibold text-navy">{q.dealer_name}</p>
              <p className="text-xs text-muted">{q.dealer_city}</p>
            </div>
            <StatusBadge status={q.status} />
          </div>
          <dl className="space-y-2">
            {rows.map((row) => (
              <div key={row.label} className="flex items-center justify-between gap-3">
                <dt className="text-xs font-medium uppercase tracking-wide text-muted">{row.label}</dt>
                <dd className="text-sm text-ink">
                  {row.key === "discount_amount" && Number(q[row.key]) > 0 ? "-" : ""}
                  {formatINR(q[row.key] as string)}
                </dd>
              </div>
            ))}
            <div className="flex items-center justify-between gap-3">
              <dt className="text-xs font-medium uppercase tracking-wide text-muted">Value score</dt>
              <dd className="text-sm text-ink">{q.value_score != null ? `${q.value_score}/100` : "—"}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-xs font-medium uppercase tracking-wide text-muted">Est. delivery</dt>
              <dd className="text-sm text-ink">{q.estimated_delivery || "Not specified"}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-xs font-medium uppercase tracking-wide text-muted">Valid until</dt>
              <dd className="text-sm text-ink">{q.validity_date || "Not specified"}</dd>
            </div>
            {q.special_offer && (
              <div className="flex items-start justify-between gap-3">
                <dt className="shrink-0 text-xs font-medium uppercase tracking-wide text-muted">Special offer</dt>
                <dd>
                  <span className="inline-flex items-center gap-1 rounded-lg bg-teal/10 px-2.5 py-1 text-xs font-semibold text-teal">
                    <Gift className="h-3.5 w-3.5" /> {q.special_offer}
                  </span>
                </dd>
              </div>
            )}
          </dl>
          <div className="mt-3 flex items-center justify-between gap-2 border-t border-line/60 pt-3">
            <span className="text-lg font-bold text-navy">
              {formatINR(q.final_price)}
              {q.is_lowest && <span className="badge-success ml-2">Lowest</span>}
            </span>
            {onPrefer && (
              <button
                onClick={() => onPrefer(q.id)}
                disabled={q.status === "preferred"}
                className={q.status === "preferred" ? "btn-outline border-teal text-teal" : "btn-primary"}
              >
                <Star className="h-4 w-4" /> {q.status === "preferred" ? "Preferred" : "Mark preferred"}
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
    </>
  );
}
