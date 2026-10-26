"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BadgeCheck, CheckCircle2, Circle } from "lucide-react";
import { api } from "@/lib/api";
import type { Dealer, Paged, Variant } from "@/lib/types";
import { useAuth } from "@/lib/auth";
import { pluralize } from "@/lib/utils";
import { Spinner } from "@/components/ui";
import { Modal } from "@/components/overlay";
import { useToast } from "@/components/toast";

export function RequestQuotesModal({
  variant,
  vehicleLabel,
  manufacturerId,
  onClose,
}: {
  variant: Variant;
  vehicleLabel: string;
  manufacturerId: number;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const toast = useToast();
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [location, setLocation] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Only offer dealers that actually sell this car's brand (single-brand
    // showrooms). The backend fan-out also enforces this.
    api
      .get<Paged<Dealer>>(`/api/dealers?manufacturer_id=${manufacturerId}&page_size=20`)
      .then((p) => setDealers(p.items))
      .catch(() => {});
  }, [manufacturerId]);

  const toggle = (id: number) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await api.post("/api/enquiries", {
        vehicle_variant_id: variant.id,
        location,
        message,
        dealer_ids: selected,
      });
      setDone(true);
      toast.success("Enquiry submitted", `Sent to ${pluralize(selected.length, "dealer")}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to submit enquiry";
      setError(msg);
      toast.error("Could not submit enquiry", msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Request Dealer Quotes"
      description={`${vehicleLabel} · ${variant.variant_name}`}
    >
      <div>
        {!user ? (
          <div className="rounded-lg bg-soft p-6 text-center">
            <p className="text-sm text-ink">Please log in as a customer to request quotations.</p>
            <Link href="/login" className="btn-gradient mt-4">Log in</Link>
          </div>
        ) : done ? (
          <div className="flex flex-col items-center gap-3 rounded-lg bg-success/5 p-6 text-center">
            <CheckCircle2 className="h-10 w-10 text-success" />
            <p className="font-medium text-ink">Enquiry submitted!</p>
            <p className="text-sm text-muted">Dealers have been notified. Track responses from your dashboard.</p>
            <Link href="/dashboard/enquiries" className="btn-gradient">View my enquiries</Link>
          </div>
        ) : (
          <>
            <div>
              <label className="label">Your location</label>
              <input className="input focus-ring" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Pune" />
            </div>
            <div className="mt-3">
              <label className="label">Message (optional)</label>
              <textarea className="input focus-ring" rows={2} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Any specific requirements?" />
            </div>
            <div className="mt-4">
              <label className="label">Select dealers ({selected.length})</label>
              {dealers.length === 0 && (
                <p className="rounded-lg bg-soft p-3 text-xs text-muted">
                  No dealerships for this brand are listed yet. Please check back soon.
                </p>
              )}
              <div className="max-h-48 space-y-2 overflow-y-auto pr-1">
                {dealers.map((d) => {
                  const isSelected = selected.includes(d.id);
                  return (
                    <button
                      key={d.id}
                      onClick={() => toggle(d.id)}
                      aria-pressed={isSelected}
                      className={`flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left text-sm transition ${
                        isSelected ? "border-brand bg-brand-50" : "border-line hover:bg-soft"
                      }`}
                    >
                      <span className="min-w-0">
                        <span className="flex items-center gap-1 font-medium text-ink">
                          <span className="truncate">{d.dealer_name}</span>
                          {d.verification_status === "verified" && <BadgeCheck className="h-4 w-4 shrink-0 text-teal" />}
                        </span>
                        <span className="block text-xs text-muted">{d.city}</span>
                      </span>
                      {isSelected ? (
                        <CheckCircle2 className="h-5 w-5 shrink-0 text-brand" />
                      ) : (
                        <Circle className="h-5 w-5 shrink-0 text-line" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
            {error && <p className="mt-3 text-sm text-danger" role="alert">{error}</p>}
            <button className="btn-gradient mt-5 w-full" disabled={submitting || selected.length === 0} onClick={submit}>
              {submitting ? <Spinner className="h-4 w-4 text-white" /> : selected.length === 0 ? "Select at least one dealer" : `Send enquiry to ${pluralize(selected.length, "dealer")}`}
            </button>
          </>
        )}
      </div>
    </Modal>
  );
}
