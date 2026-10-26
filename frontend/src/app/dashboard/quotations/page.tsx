"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Quotation } from "@/lib/types";
import { RoleGuard } from "@/components/role-guard";
import { EmptyState, LoadingBlock, FadeIn } from "@/components/ui";
import { QuotationCompareTable } from "@/components/quotation-compare-table";
import { useToast } from "@/components/toast";

function Quotations() {
  const [quotations, setQuotations] = useState<Quotation[] | null>(null);
  const toast = useToast();

  const load = () => api.get<Quotation[]>("/api/quotations").then(setQuotations).catch(() => setQuotations([]));

  useEffect(() => {
    load();
  }, []);

  const prefer = async (id: number) => {
    try {
      await api.post(`/api/quotations/${id}/prefer`);
      toast.success("Marked as preferred", "The dealer has been notified of your interest.");
      load();
    } catch (e) {
      toast.error("Could not update", e instanceof Error ? e.message : "Please try again.");
    }
  };

  return (
    <div className="container-xl py-8">
      <FadeIn>
        <h1 className="text-3xl font-bold text-navy">My Quotations</h1>
        <p className="mt-1 text-muted">Compare dealership offers. The lowest valid final price is highlighted, but you decide what is best for you.</p>
      </FadeIn>

      <div className="mt-6">
        {!quotations ? (
          <LoadingBlock />
        ) : quotations.length === 0 ? (
          <EmptyState title="No quotations yet" message="Request quotes from dealers to see offers here." />
        ) : (
          <QuotationCompareTable quotations={quotations} onPrefer={prefer} />
        )}
      </div>
    </div>
  );
}

export default function Page() {
  return <RoleGuard role="customer"><Quotations /></RoleGuard>;
}
