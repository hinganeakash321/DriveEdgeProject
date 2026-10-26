"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import type { Enquiry, Quotation } from "@/lib/types";
import { Inbox, FileText, Clock, Star, Trophy, Store, TrendingDown } from "lucide-react";
import { RoleGuard } from "@/components/role-guard";
import { KpiCard, EmptyState, LoadingBlock, StatusBadge, FadeIn, Stagger, StaggerItem } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { formatINR } from "@/lib/utils";

function Dashboard() {
  const { user } = useAuth();
  const [enquiries, setEnquiries] = useState<Enquiry[] | null>(null);
  const [quotations, setQuotations] = useState<Quotation[] | null>(null);

  useEffect(() => {
    api.get<Enquiry[]>("/api/enquiries").then(setEnquiries).catch(() => setEnquiries([]));
    api.get<Quotation[]>("/api/quotations").then(setQuotations).catch(() => setQuotations([]));
  }, []);

  const activeEnquiries = enquiries?.filter((e) => !["cancelled", "expired"].includes(e.status)).length ?? 0;
  const received = quotations?.length ?? 0;
  const preferred = quotations?.filter((q) => q.status === "preferred").length ?? 0;
  const pending = enquiries?.filter((e) => e.status === "sent_to_dealer").length ?? 0;

  // Single best (lowest-price) dealer offer across the customer's enquiries.
  const validQuotes = (quotations ?? []).filter(
    (q) => (q.status === "submitted" || q.status === "preferred") && q.enquiry_id != null,
  );
  const best = validQuotes.length
    ? validQuotes.reduce((a, b) => (Number(a.final_price) <= Number(b.final_price) ? a : b))
    : null;
  // Savings for that enquiry = highest - lowest among its quotes.
  const bestSavings = best
    ? (() => {
        const prices = validQuotes
          .filter((q) => q.enquiry_id === best.enquiry_id)
          .map((q) => Number(q.final_price));
        return prices.length > 1 ? Math.max(...prices) - Math.min(...prices) : 0;
      })()
    : 0;

  return (
    <div className="container-xl py-8">
      <FadeIn className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-navy">Welcome, {user?.name.split(" ")[0]}</h1>
          <p className="mt-1 text-muted">Track your enquiries and compare dealership quotations.</p>
        </div>
        <Link href="/dashboard/favourites" className="btn-outline">Saved Cars</Link>
      </FadeIn>

      <Stagger className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StaggerItem><KpiCard label="Active Enquiries" value={activeEnquiries} icon={<Inbox className="h-5 w-5" />} accent /></StaggerItem>
        <StaggerItem><KpiCard label="Quotations Received" value={received} icon={<FileText className="h-5 w-5" />} /></StaggerItem>
        <StaggerItem><KpiCard label="Pending Quotations" value={pending} icon={<Clock className="h-5 w-5" />} /></StaggerItem>
        <StaggerItem><KpiCard label="Preferred Quotations" value={preferred} icon={<Star className="h-5 w-5" />} /></StaggerItem>
      </Stagger>

      {best && (
        <FadeIn className="mt-6">
          <Link
            href={`/compare-quotes?enquiry_id=${best.enquiry_id}`}
            className="card card-hover relative block overflow-hidden p-6"
          >
            <span className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand to-teal" />
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted">
                  <Trophy className="h-3.5 w-3.5 text-teal" /> Best offer on your enquiries
                </p>
                <p className="mt-2 text-lg font-semibold text-navy">{best.vehicle_label || `Enquiry #${best.enquiry_id}`}</p>
                <p className="mt-1 flex items-center gap-1.5 text-sm text-muted">
                  <Store className="h-4 w-4" /> {best.dealer_name}
                  {best.dealer_city ? ` · ${best.dealer_city}` : ""}
                </p>
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold text-navy">{formatINR(best.final_price)}</p>
                {bestSavings > 0 ? (
                  <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-success/10 px-2.5 py-1 text-xs font-semibold text-success">
                    <TrendingDown className="h-3.5 w-3.5" /> Save {formatINR(bestSavings)} vs highest
                  </p>
                ) : (
                  <span className="badge-success mt-1 inline-block">Lowest</span>
                )}
              </div>
            </div>
            <p className="mt-4 text-sm font-medium text-brand">Compare all dealer quotes →</p>
          </Link>
        </FadeIn>
      )}

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="card p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-navy">My Enquiries</h2>
            <Link href="/dashboard/enquiries" className="text-sm text-brand">View all</Link>
          </div>
          {!enquiries ? (
            <LoadingBlock />
          ) : enquiries.length === 0 ? (
            <EmptyState title="No enquiries yet" message="Browse cars and request dealer quotes to get started." action={<Link href="/cars" className="btn-primary">Browse cars</Link>} />
          ) : (
            <div className="space-y-3">
              {enquiries.slice(0, 5).map((e) => (
                <Link key={e.id} href={`/dashboard/enquiries`} className="flex items-center justify-between rounded-lg border border-line p-3 hover:bg-soft">
                  <div>
                    <p className="font-medium text-ink">{e.vehicle_label || `Enquiry #${e.id}`}</p>
                    <p className="text-xs text-muted">{e.dealers.length} dealer(s) &middot; {new Date(e.created_at).toLocaleDateString()}</p>
                  </div>
                  <StatusBadge status={e.status} />
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="card p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-navy">My Quotations</h2>
            <Link href="/dashboard/quotations" className="text-sm text-brand">Compare</Link>
          </div>
          {!quotations ? (
            <LoadingBlock />
          ) : quotations.length === 0 ? (
            <EmptyState title="No quotations yet" message="Once dealers respond, their offers appear here." />
          ) : (
            <div className="space-y-3">
              {quotations.slice(0, 5).map((q) => (
                <div key={q.id} className="flex items-center justify-between rounded-lg border border-line p-3">
                  <div>
                    <p className="font-medium text-ink">{q.dealer_name}</p>
                    <p className="text-xs text-muted">{q.vehicle_label}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-navy">{formatINR(q.final_price)}</p>
                    {q.is_lowest && <span className="badge-success">Lowest</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Page() {
  return <RoleGuard role="customer"><Dashboard /></RoleGuard>;
}
