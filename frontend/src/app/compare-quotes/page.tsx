"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { X, TrendingDown, Store, Trophy } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "@/lib/api";
import type { Enquiry, Quotation } from "@/lib/types";
import { useAuth } from "@/lib/auth";
import { EmptyState, LoadingBlock, FadeIn, Stagger, StaggerItem } from "@/components/ui";
import { QuotationCompareTable } from "@/components/quotation-compare-table";
import { formatINR } from "@/lib/utils";

interface EnquiryGroup {
  enquiry: Enquiry;
  quotes: Quotation[];
  lowest?: Quotation;
  savings: number; // highest - lowest
}

export default function CompareQuotesPage() {
  const { user, loading } = useAuth();
  const [enquiries, setEnquiries] = useState<Enquiry[] | null>(null);
  const [quotes, setQuotes] = useState<Quotation[] | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);
  const [pendingEnquiryId, setPendingEnquiryId] = useState<number | null>(null);

  // Deep-link support: /compare-quotes?enquiry_id=123 pre-opens that enquiry's
  // comparison once its quotes have loaded (read once, then clean the URL).
  useEffect(() => {
    const raw = new URLSearchParams(window.location.search).get("enquiry_id");
    const id = raw ? parseInt(raw, 10) : NaN;
    if (!Number.isNaN(id)) {
      setPendingEnquiryId(id);
      window.history.replaceState({}, "", "/compare-quotes");
    }
  }, []);

  const load = () => {
    Promise.all([
      api.get<Enquiry[]>("/api/enquiries"),
      api.get<Quotation[]>("/api/quotations"),
    ])
      .then(([e, q]) => {
        setEnquiries(e);
        setQuotes(q);
      })
      .catch(() => {
        setEnquiries([]);
        setQuotes([]);
      });
  };

  useEffect(() => {
    if (user?.role === "customer") load();
  }, [user]);

  const prefer = async (id: number) => {
    await api.post(`/api/quotations/${id}/prefer`);
    load();
  };

  const groups: EnquiryGroup[] = useMemo(() => {
    if (!enquiries || !quotes) return [];
    const byEnquiry = new Map<number, Quotation[]>();
    for (const q of quotes) {
      const key = q.enquiry_id ?? -1;
      if (!byEnquiry.has(key)) byEnquiry.set(key, []);
      byEnquiry.get(key)!.push(q);
    }
    return enquiries.map((enquiry) => {
      const qs = (byEnquiry.get(enquiry.id) || []).slice().sort(
        (a, b) => Number(a.final_price) - Number(b.final_price),
      );
      const lowest = qs[0];
      const highest = qs[qs.length - 1];
      const savings = qs.length > 1 ? Number(highest.final_price) - Number(lowest.final_price) : 0;
      return { enquiry, quotes: qs, lowest, savings };
    });
  }, [enquiries, quotes]);

  // Once data is grouped, auto-open the deep-linked enquiry (if it has quotes).
  useEffect(() => {
    if (pendingEnquiryId == null) return;
    const g = groups.find((x) => x.enquiry.id === pendingEnquiryId);
    if (g && g.quotes.length > 0) {
      setOpenId(pendingEnquiryId);
      setPendingEnquiryId(null);
    }
  }, [pendingEnquiryId, groups]);

  const openGroup = groups.find((g) => g.enquiry.id === openId);

  if (loading) return <div className="container-xl"><LoadingBlock /></div>;

  if (!user || user.role !== "customer") {
    return (
      <div className="container-xl py-16">
        <EmptyState
          title="Compare dealership quotations"
          message="Log in as a customer to compare the offers you've received side by side."
          action={<Link href="/login" className="btn-primary">Log in</Link>}
        />
      </div>
    );
  }

  const withQuotes = groups.filter((g) => g.quotes.length > 0);
  const awaiting = groups.filter((g) => g.quotes.length === 0);

  return (
    <div className="container-xl py-8">
      <FadeIn>
        <h1 className="text-3xl font-bold tracking-tight text-navy">Compare Quotes</h1>
        <p className="mt-1 text-muted">
          The best offer for each of your enquiries at a glance. Tap a card to see every dealer side by side.
        </p>
      </FadeIn>

      {!enquiries || !quotes ? (
        <LoadingBlock />
      ) : groups.length === 0 ? (
        <EmptyState
          title="No enquiries yet"
          message="Request quotes from dealers first."
          action={<Link href="/cars" className="btn-primary">Browse cars</Link>}
        />
      ) : (
        <>
          {withQuotes.length > 0 ? (
            <Stagger className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {withQuotes.map((g) => (
                <StaggerItem key={g.enquiry.id}>
                  <button
                    onClick={() => setOpenId(g.enquiry.id)}
                    className="card card-hover relative w-full overflow-hidden p-5 text-left"
                  >
                    <span className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand to-teal" />
                    <div className="flex items-center justify-between gap-2">
                      <p className="line-clamp-1 font-semibold text-navy">
                        {g.enquiry.vehicle_label || `Enquiry #${g.enquiry.id}`}
                      </p>
                      <span className="badge-muted shrink-0">{g.quotes.length} quote{g.quotes.length !== 1 ? "s" : ""}</span>
                    </div>
                    <p className="mt-4 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted">
                      <Trophy className="h-3.5 w-3.5 text-teal" /> Best offer
                    </p>
                    <p className="mt-1 text-2xl font-bold text-navy">{formatINR(g.lowest!.final_price)}</p>
                    <p className="mt-1 flex items-center gap-1.5 text-sm text-muted">
                      <Store className="h-4 w-4" /> {g.lowest!.dealer_name}
                      {g.lowest!.dealer_city ? ` · ${g.lowest!.dealer_city}` : ""}
                    </p>
                    {g.savings > 0 && (
                      <p className="mt-3 inline-flex items-center gap-1 rounded-full bg-success/10 px-2.5 py-1 text-xs font-semibold text-success">
                        <TrendingDown className="h-3.5 w-3.5" /> Save {formatINR(g.savings)} vs highest
                      </p>
                    )}
                    <p className="mt-3 text-sm font-medium text-brand">Compare all quotes →</p>
                  </button>
                </StaggerItem>
              ))}
            </Stagger>
          ) : (
            <div className="mt-6">
              <EmptyState title="No quotations yet" message="Your dealers have not responded yet. We'll notify you as offers arrive." />
            </div>
          )}

          {awaiting.length > 0 && (
            <div className="mt-10">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Awaiting quotes</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {awaiting.map((g) => (
                  <Link
                    key={g.enquiry.id}
                    href={`/dashboard/enquiries/${g.enquiry.id}`}
                    className="chip hover:border-brand/40"
                  >
                    {g.enquiry.vehicle_label || `Enquiry #${g.enquiry.id}`}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <AnimatePresence>
        {openGroup && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setOpenId(null)} />
            <motion.div
              className="card relative z-10 max-h-[90vh] w-full max-w-5xl overflow-y-auto p-6"
              initial={{ opacity: 0, scale: 0.96, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 10 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            >
              <button
                className="absolute right-4 top-4 text-muted hover:text-ink"
                onClick={() => setOpenId(null)}
              >
                <X className="h-5 w-5" />
              </button>
              <h3 className="text-xl font-bold text-navy">
                {openGroup.enquiry.vehicle_label || `Enquiry #${openGroup.enquiry.id}`}
              </h3>
              <p className="mt-1 text-sm text-muted">
                Comparing {openGroup.quotes.length} dealer offer{openGroup.quotes.length !== 1 ? "s" : ""} · lowest highlighted
              </p>
              <div className="mt-5">
                <QuotationCompareTable quotations={openGroup.quotes} onPrefer={prefer} />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
