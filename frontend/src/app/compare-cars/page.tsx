"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { api } from "@/lib/api";
import type { VehicleDetail } from "@/lib/types";
import { useCompare } from "@/lib/compare";
import { EmptyState, LoadingBlock, FadeIn } from "@/components/ui";
import { formatINR, formatPriceRange, titleCase } from "@/lib/utils";

export default function CompareCarsPage() {
  const { ids, toggle, clear, setAll } = useCompare();
  const [vehicles, setVehicles] = useState<VehicleDetail[]>([]);
  const [loading, setLoading] = useState(false);

  // Allow deep-linking from the AI assistant: /compare-cars?ids=1,2,3
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get("ids");
    if (raw) {
      const parsed = raw.split(",").map((s) => parseInt(s, 10)).filter((n) => !Number.isNaN(n));
      if (parsed.length) setAll(parsed);
      window.history.replaceState({}, "", "/compare-cars");
    }
  }, [setAll]);

  useEffect(() => {
    if (ids.length < 1) {
      setVehicles([]);
      return;
    }
    setLoading(true);
    Promise.all(ids.map((id) => api.get<VehicleDetail>(`/api/cars/${id}`).catch(() => null)))
      .then((res) => setVehicles(res.filter((v): v is VehicleDetail => v !== null)))
      .finally(() => setLoading(false));
  }, [ids]);

  const rows: { label: string; get: (v: VehicleDetail) => string }[] = [
    { label: "Starting price", get: (v) => formatINR(v.min_price) },
    { label: "Price range", get: (v) => formatPriceRange(v.min_price, v.max_price) },
    { label: "Body type", get: (v) => v.body_type },
    { label: "Fuel options", get: (v) => v.fuel_types.map(titleCase).join(", ") },
    { label: "Transmissions", get: (v) => v.transmissions.map((t) => t.toUpperCase()).join(", ") },
    { label: "Seating", get: (v) => v.seating_capacities.join("/") + " seats" },
    { label: "Variants", get: (v) => String(v.variant_count) },
    { label: "Top variant mileage", get: (v) => v.variants[0]?.mileage || "Not available" },
    { label: "Top variant power", get: (v) => v.variants[0]?.power || "Not available" },
  ];

  return (
    <div className="container-xl py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-navy">Compare Cars</h1>
          <p className="mt-1 text-muted">Side-by-side comparison. Missing values are shown honestly.</p>
        </div>
        {vehicles.length > 0 && <button onClick={clear} className="btn-outline"><X className="h-4 w-4" /> Clear all</button>}
      </div>

      {loading ? (
        <LoadingBlock />
      ) : vehicles.length === 0 ? (
        <EmptyState
          title="No cars to compare yet"
          message="Add cars using the Compare button on any vehicle card."
          action={<Link href="/cars" className="btn-gradient">Browse cars</Link>}
        />
      ) : (
        <>
        <FadeIn className="card hidden overflow-x-auto md:block">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-line">
                <th className="p-4 text-left font-medium text-muted">Specification</th>
                {vehicles.map((v) => (
                  <th key={v.id} className="p-4 text-left">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-xs uppercase text-muted">{v.manufacturer_name}</p>
                        <Link href={`/cars/${v.id}`} className="font-semibold text-navy hover:text-brand">{v.model_name}</Link>
                      </div>
                      <button onClick={() => toggle(v.id)} className="text-muted hover:text-danger"><X className="h-4 w-4" /></button>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr key={row.label} className={idx % 2 ? "bg-soft/40" : ""}>
                  <td className="p-4 font-medium text-ink">{row.label}</td>
                  {vehicles.map((v) => (
                    <td key={v.id} className="p-4 text-ink">{row.get(v)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </FadeIn>

        {/* Mobile: one card per car with stacked spec rows */}
        <div className="space-y-4 md:hidden">
          {vehicles.map((v) => (
            <div key={v.id} className="card p-4">
              <div className="mb-3 flex items-start justify-between gap-2 border-b border-line/60 pb-2">
                <div>
                  <p className="text-xs uppercase text-muted">{v.manufacturer_name}</p>
                  <Link href={`/cars/${v.id}`} className="font-semibold text-navy hover:text-brand">{v.model_name}</Link>
                </div>
                <button onClick={() => toggle(v.id)} className="text-muted hover:text-danger" aria-label={`Remove ${v.model_name}`}><X className="h-4 w-4" /></button>
              </div>
              <dl className="space-y-2">
                {rows.map((row) => (
                  <div key={row.label} className="flex items-start justify-between gap-3">
                    <dt className="shrink-0 text-xs font-medium uppercase tracking-wide text-muted">{row.label}</dt>
                    <dd className="text-right text-sm text-ink">{row.get(v)}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
        </>
      )}
    </div>
  );
}
