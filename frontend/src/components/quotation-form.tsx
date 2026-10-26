"use client";

import { useMemo, useState } from "react";
import { Gift, TrendingDown, Trophy } from "lucide-react";
import { api } from "@/lib/api";
import { formatINR } from "@/lib/utils";
import { Spinner } from "@/components/ui";
import { Modal } from "@/components/overlay";
import { useToast } from "@/components/toast";
import type { MarketPosition, Quotation } from "@/lib/types";

const FIELDS: { key: string; label: string; required?: boolean }[] = [
  { key: "ex_showroom_price", label: "Ex-showroom price", required: true },
  { key: "registration_charges", label: "Registration charges" },
  { key: "insurance_amount", label: "Insurance" },
  { key: "accessories_amount", label: "Accessories" },
  { key: "other_charges", label: "Other charges" },
  { key: "discount_amount", label: "Discount" },
];

function num(v: string | number | null | undefined): string {
  if (v === null || v === undefined || v === "") return "";
  return String(v);
}

export function QuotationForm({
  enquiryDealerId,
  variantId,
  vehicleLabel,
  quotationId,
  initial,
  market,
  onClose,
  onSubmitted,
}: {
  enquiryDealerId: number;
  variantId: number;
  vehicleLabel: string;
  quotationId?: number | null;
  initial?: Quotation | null;
  market?: MarketPosition | null;
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const isEdit = Boolean(quotationId);
  const toast = useToast();
  const [values, setValues] = useState<Record<string, string>>({
    ex_showroom_price: num(initial?.ex_showroom_price),
    registration_charges: num(initial?.registration_charges),
    insurance_amount: num(initial?.insurance_amount),
    accessories_amount: num(initial?.accessories_amount),
    other_charges: num(initial?.other_charges),
    discount_amount: num(initial?.discount_amount),
  });
  const [delivery, setDelivery] = useState(initial?.estimated_delivery || "");
  const [validity, setValidity] = useState(initial?.validity_date || "");
  const [notes, setNotes] = useState(initial?.notes || "");
  const [specialOffer, setSpecialOffer] = useState(initial?.special_offer || "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Live preview (display only; backend is authoritative).
  const finalPreview = useMemo(() => {
    const n = (k: string) => parseFloat(values[k] || "0") || 0;
    const total =
      n("ex_showroom_price") + n("registration_charges") + n("insurance_amount") +
      n("accessories_amount") + n("other_charges") - n("discount_amount");
    return Math.max(total, 0);
  }, [values]);

  // How does this preview compare to the current market lowest?
  const vsLowest = useMemo(() => {
    if (!market?.lowest_final_price) return null;
    return finalPreview - market.lowest_final_price;
  }, [finalPreview, market]);

  const submit = async (submitNow: boolean) => {
    setSubmitting(true);
    setError(null);
    try {
      const body = {
        ex_showroom_price: values.ex_showroom_price || "0",
        registration_charges: values.registration_charges || "0",
        insurance_amount: values.insurance_amount || "0",
        accessories_amount: values.accessories_amount || "0",
        other_charges: values.other_charges || "0",
        discount_amount: values.discount_amount || "0",
        estimated_delivery: delivery || null,
        validity_date: validity || null,
        notes: notes || null,
        special_offer: specialOffer || null,
      };
      if (isEdit) {
        await api.patch(`/api/dealer/quotations/${quotationId}`, { ...body, submit: submitNow });
      } else {
        await api.post("/api/dealer/quotations", {
          ...body,
          enquiry_dealer_id: enquiryDealerId,
          vehicle_variant_id: variantId,
          submit: submitNow,
        });
      }
      toast.success(
        submitNow ? (isEdit ? "Offer updated" : "Quotation submitted") : "Draft saved",
        submitNow ? "The customer has been notified." : undefined,
      );
      onSubmitted();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to save quotation";
      setError(msg);
      toast.error("Could not save quotation", msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={isEdit ? "Improve your offer" : "Prepare Quotation"}
      description={vehicleLabel}
    >
      <div>
        {market && market.total_quotes > 0 && (
          <div className="mt-4 rounded-xl border border-line bg-soft/60 p-3">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-1.5 font-medium text-ink">
                <Trophy className="h-4 w-4 text-teal" /> Market lowest
              </span>
              <span className="font-bold text-navy">{formatINR(market.lowest_final_price ?? 0)}</span>
            </div>
            <p className="mt-1 text-xs text-muted">
              {market.your_rank
                ? `You rank #${market.your_rank} of ${market.total_quotes}`
                : `${market.total_quotes} dealer${market.total_quotes !== 1 ? "s" : ""} competing`}
              {market.is_lowest ? " · you are the lowest" : ""}
              {" · competitor names are hidden"}
            </p>
          </div>
        )}

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {FIELDS.map((f) => (
            <div key={f.key}>
              <label className="label">{f.label}{f.required && " *"}</label>
              <input
                className="input"
                type="number"
                min="0"
                value={values[f.key]}
                onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
              />
            </div>
          ))}
        </div>

        <div className="mt-3">
          <label className="label flex items-center gap-1.5"><Gift className="h-4 w-4 text-teal" /> Special offer (shown to the customer)</label>
          <input
            className="input"
            maxLength={280}
            value={specialOffer}
            onChange={(e) => setSpecialOffer(e.target.value)}
            placeholder="e.g. Free 3-year service pack + ₹20k exchange bonus"
          />
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label">Estimated delivery</label>
            <input className="input" value={delivery} onChange={(e) => setDelivery(e.target.value)} placeholder="e.g. 3-4 weeks" />
          </div>
          <div>
            <label className="label">Valid until</label>
            <input className="input" type="date" value={validity} onChange={(e) => setValidity(e.target.value)} />
          </div>
        </div>
        <div className="mt-3">
          <label className="label">Notes</label>
          <textarea className="input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        <div className="mt-4 flex items-center justify-between rounded-lg bg-soft p-3">
          <span className="text-sm text-muted">Estimated final price</span>
          <span className="text-lg font-bold text-navy">{formatINR(finalPreview)}</span>
        </div>
        {vsLowest != null && (
          <p className={`mt-1 flex items-center gap-1 text-xs font-medium ${vsLowest <= 0 ? "text-success" : "text-warning"}`}>
            <TrendingDown className="h-3.5 w-3.5" />
            {vsLowest <= 0
              ? vsLowest === 0
                ? "Matches the current lowest offer"
                : `Beats the current lowest by ${formatINR(Math.abs(vsLowest))}`
              : `${formatINR(vsLowest)} above the current lowest`}
          </p>
        )}
        <p className="mt-1 text-xs text-muted">Final price is recalculated and validated on the backend.</p>

        {error && <p className="mt-3 text-sm text-danger">{error}</p>}

        <div className="mt-5 flex gap-2">
          {!isEdit && (
            <button className="btn-outline flex-1" disabled={submitting} onClick={() => submit(false)}>Save draft</button>
          )}
          <button className="btn-gradient flex-1" disabled={submitting || !values.ex_showroom_price} onClick={() => submit(true)}>
            {submitting ? <Spinner className="h-4 w-4 text-white" /> : isEdit ? "Update offer" : "Submit to customer"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
