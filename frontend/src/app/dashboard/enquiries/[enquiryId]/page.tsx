"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import type { Enquiry, Quotation } from "@/lib/types";
import { RoleGuard } from "@/components/role-guard";
import { EmptyState, LoadingBlock, StatusBadge, FadeIn, Stagger, StaggerItem } from "@/components/ui";
import { useToast } from "@/components/toast";
import { formatINR } from "@/lib/utils";

function EnquiryDetail() {
  const toast = useToast();
  const params = useParams();
  const enquiryId = Number(params.enquiryId);
  const [enquiry, setEnquiry] = useState<Enquiry | null>(null);
  const [quotations, setQuotations] = useState<Quotation[] | null>(null);
  const [error, setError] = useState(false);

  const loadQuotes = () =>
    api.get<Quotation[]>(`/api/quotations?enquiry_id=${enquiryId}`).then(setQuotations).catch(() => setQuotations([]));

  useEffect(() => {
    api.get<Enquiry>(`/api/enquiries/${enquiryId}`).then(setEnquiry).catch(() => setError(true));
    loadQuotes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enquiryId]);

  const prefer = async (q: Quotation) => {
    try {
      await api.post(`/api/quotations/${q.id}/prefer`);
      toast.success("Marked as preferred", `${q.dealer_name} has been notified.`);
      loadQuotes();
    } catch (e) {
      toast.error("Could not update", e instanceof Error ? e.message : "Please try again.");
    }
  };

  if (error) return <div className="container-xl py-8"><EmptyState title="Enquiry not found" message="This enquiry does not exist or is not yours." /></div>;
  if (!enquiry) return <div className="container-xl"><LoadingBlock /></div>;

  const lowest = quotations && quotations.length ? Math.min(...quotations.map((q) => Number(q.final_price))) : null;

  return (
    <div className="container-xl py-8">
      <Link href="/dashboard/enquiries" className="text-sm text-brand hover:underline">&larr; Back to enquiries</Link>
      <FadeIn className="mt-2 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy">{enquiry.vehicle_label || `Enquiry #${enquiry.id}`}</h1>
          <p className="text-sm text-muted">{enquiry.location || "—"} &middot; {new Date(enquiry.created_at).toLocaleDateString()}</p>
        </div>
        <StatusBadge status={enquiry.status} />
      </FadeIn>
      {enquiry.message && <p className="mt-3 text-sm text-ink">&ldquo;{enquiry.message}&rdquo;</p>}

      <div className="card mt-6 p-5">
        <h2 className="mb-3 text-sm font-semibold text-ink">Dealers contacted ({enquiry.dealers.length})</h2>
        <div className="flex flex-wrap gap-2">
          {enquiry.dealers.map((d) => (
            <span key={d.id} className="chip">{d.dealer_name} · {d.has_quotation ? "quoted" : d.response_status}</span>
          ))}
        </div>
      </div>

      <h2 className="mt-8 text-lg font-semibold text-navy">Quotations</h2>
      {!quotations ? (
        <LoadingBlock />
      ) : quotations.length === 0 ? (
        <div className="mt-3"><EmptyState title="No quotations yet" message="Dealers have not responded with a quotation yet." /></div>
      ) : (
        <Stagger className="mt-3 space-y-3">
          {quotations.map((q) => {
            const isLowest = lowest !== null && Number(q.final_price) === lowest;
            return (
              <StaggerItem key={q.id} className={`card card-hover p-5 ${isLowest ? "ring-2 ring-success" : ""}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-navy">{q.dealer_name}</p>
                    <p className="text-xs text-muted">{q.dealer_city}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-ink">{formatINR(q.final_price)}</p>
                    {isLowest && <span className="text-xs font-medium text-success">Lowest final price</span>}
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <Link href={`/dashboard/quotations/${q.id}`} className="text-sm text-brand">View breakup</Link>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={q.status} />
                    {q.status !== "preferred" && q.status !== "accepted" && (
                      <button className="btn-outline text-xs" onClick={() => prefer(q)}>Mark preferred</button>
                    )}
                  </div>
                </div>
              </StaggerItem>
            );
          })}
        </Stagger>
      )}
    </div>
  );
}

export default function Page() {
  return <RoleGuard role="customer"><EnquiryDetail /></RoleGuard>;
}
