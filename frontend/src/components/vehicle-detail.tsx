"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { GitCompare, MapPin, FileText, Sparkles, Fuel, Settings2, Users, Gauge } from "lucide-react";
import { api } from "@/lib/api";
import type { VehicleDetail, Variant } from "@/lib/types";
import { formatINR, formatPriceRange, titleCase, pluralize } from "@/lib/utils";
import { LoadingBlock, ErrorState, FadeIn } from "@/components/ui";
import { Tabs } from "@/components/disclosure";
import { RequestQuotesModal } from "@/components/request-quotes-modal";
import { BuyingAssistant } from "@/components/buying-assistant";
import { FavouriteButton } from "@/components/favourite-button";
import { useCompare } from "@/lib/compare";

function SpecRow({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div className="flex justify-between gap-4 border-b border-line py-2 text-sm">
      <span className="text-muted">{label}</span>
      <span className="font-medium text-ink">{value !== null && value !== undefined && value !== "" ? value : "Not available"}</span>
    </div>
  );
}

function FeatureList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <h4 className="font-semibold text-navy">{title}</h4>
      {items.length ? (
        <ul className="mt-2 grid gap-1 text-sm text-ink sm:grid-cols-2">
          {items.map((f) => <li key={f} className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-teal" />{f}</li>)}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-muted">Not available</p>
      )}
    </div>
  );
}

export function VehicleDetailView({ vehicleId }: { vehicleId: string }) {
  const [vehicle, setVehicle] = useState<VehicleDetail | null>(null);
  const [error, setError] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showQuotes, setShowQuotes] = useState(false);
  const [showAssistant, setShowAssistant] = useState(false);
  const { toggle } = useCompare();

  useEffect(() => {
    api
      .get<VehicleDetail>(`/api/cars/${vehicleId}`)
      .then((v) => {
        setVehicle(v);
        setSelectedId(v.variants[0]?.id ?? null);
        // Record view for signed-in customers (ignored/401 for others).
        api.post("/api/recently-viewed", { vehicle_model_id: v.id }).catch(() => {});
      })
      .catch(() => setError(true));
  }, [vehicleId]);

  // Client-rendered detail page: set a descriptive, car-specific tab title
  // (and restore the default on unmount) since metadata can't be computed here.
  useEffect(() => {
    if (!vehicle) return;
    const previous = document.title;
    document.title = `${vehicle.manufacturer_name} ${vehicle.model_name} — DriveEdge`;
    return () => {
      document.title = previous;
    };
  }, [vehicle]);

  const selected: Variant | undefined = useMemo(
    () => vehicle?.variants.find((v) => v.id === selectedId),
    [vehicle, selectedId]
  );

  if (error) return <div className="container-xl py-10"><ErrorState message="Vehicle not found." /></div>;
  if (!vehicle) return <div className="container-xl"><LoadingBlock /></div>;

  return (
    <div className="container-xl py-8">
      <nav className="mb-4 text-sm text-muted">
        <Link href="/cars" className="hover:text-brand">All Cars</Link> / <span className="text-ink">{vehicle.manufacturer_name} {vehicle.model_name}</span>
      </nav>

      <div className="grid gap-8 lg:grid-cols-[1.2fr_1fr]">
        {/* Gallery */}
        <FadeIn>
          <div className="card group flex aspect-[16/10] items-center justify-center overflow-hidden bg-gradient-to-br from-soft to-brand-50">
            {vehicle.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={vehicle.image_url} alt={vehicle.model_name} className="h-full w-full object-contain p-6 transition-transform duration-500 group-hover:scale-105" />
            ) : (
              <span className="text-3xl font-bold text-navy/15 sm:text-5xl">{vehicle.manufacturer_name}</span>
            )}
          </div>
        </FadeIn>

        {/* Header + variant selector */}
        <div className="lg:sticky lg:top-20 lg:self-start">
          <p className="text-sm font-medium uppercase tracking-wide text-muted">{vehicle.manufacturer_name}</p>
          <div className="flex items-center justify-between gap-2">
            <h1 className="text-3xl font-bold text-navy">{vehicle.model_name}</h1>
            <FavouriteButton modelId={vehicle.id} className="border border-line" />
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
            <span className="chip">{vehicle.body_type}</span>
            {vehicle.model_year && <span className="chip">{vehicle.model_year}</span>}
            <span className="chip">{pluralize(vehicle.variant_count, "variant")}</span>
          </div>
          <p className="mt-4 text-2xl font-bold text-ink">{formatPriceRange(vehicle.min_price, vehicle.max_price)}</p>
          <p className="text-xs text-muted">Ex-showroom price range across variants</p>

          <div className="mt-5">
            <label className="label">Select variant</label>
            <div className="flex flex-wrap gap-2">
              {vehicle.variants.map((v) => (
                <button
                  key={v.id}
                  onClick={() => setSelectedId(v.id)}
                  className={`rounded-lg border px-3 py-2 text-left text-xs transition ${
                    v.id === selectedId ? "border-brand bg-brand-50 text-brand-700" : "border-line bg-card text-ink hover:bg-soft"
                  }`}
                >
                  <div className="font-semibold">{v.variant_name}</div>
                  <div className="text-muted">{formatINR(v.ex_showroom_price)}</div>
                </button>
              ))}
            </div>
          </div>

          {selected && (
            <div className="card mt-5 p-4">
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-muted">{selected.variant_name}</span>
                <span className="text-xl font-bold text-navy">{formatINR(selected.ex_showroom_price)}</span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted">
                <span className="inline-flex items-center gap-1"><Fuel className="h-3.5 w-3.5" />{titleCase(selected.fuel_type)}</span>
                <span className="inline-flex items-center gap-1"><Settings2 className="h-3.5 w-3.5" />{selected.transmission.toUpperCase()}</span>
                {selected.seating_capacity && <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" />{selected.seating_capacity} seats</span>}
                {selected.mileage && <span className="inline-flex items-center gap-1"><Gauge className="h-3.5 w-3.5" />{selected.mileage}</span>}
              </div>
            </div>
          )}

          <div className="mt-5 grid grid-cols-2 gap-2">
            <button onClick={() => setShowQuotes(true)} className="btn-gradient col-span-2"><FileText className="h-4 w-4" /> Request Dealer Quotes</button>
            <Link href="/dealers" className="btn-outline"><MapPin className="h-4 w-4" /> Find Dealers</Link>
            <button onClick={() => { toggle(vehicle.id); }} className="btn-outline"><GitCompare className="h-4 w-4" /> Compare</button>
            <button onClick={() => setShowAssistant(true)} className="btn-outline col-span-2"><Sparkles className="h-4 w-4" /> Ask AI about this car</button>
          </div>
        </div>
      </div>

      {/* Specifications */}
      {selected && (
        <div className="mt-10">
          <h2 className="mb-4 text-xl font-bold text-navy">Specifications</h2>
          <Tabs
            items={[
              {
                id: "performance",
                label: "Engine & Performance",
                content: (
                  <div className="card p-6">
                    <SpecRow label="Fuel type" value={titleCase(selected.fuel_type)} />
                    <SpecRow label="Transmission" value={selected.transmission.toUpperCase()} />
                    <SpecRow label="Engine displacement" value={selected.engine_displacement ? `${selected.engine_displacement} cc` : null} />
                    <SpecRow label="Power" value={selected.power} />
                    <SpecRow label="Torque" value={selected.torque} />
                    <SpecRow label="Mileage" value={selected.mileage} />
                    <SpecRow label="Electric range" value={selected.electric_range ? `${selected.electric_range} km` : null} />
                    <SpecRow label="Battery" value={selected.battery_capacity} />
                  </div>
                ),
              },
              {
                id: "dimensions",
                label: "Dimensions & Capacity",
                content: (
                  <div className="card p-6">
                    <SpecRow label="Seating capacity" value={selected.seating_capacity} />
                    <SpecRow label="Boot space" value={selected.boot_space ? `${selected.boot_space} L` : null} />
                    <SpecRow label="Ground clearance" value={selected.ground_clearance ? `${selected.ground_clearance} mm` : null} />
                    <SpecRow label="Fuel tank" value={selected.fuel_tank_capacity ? `${selected.fuel_tank_capacity} L` : null} />
                  </div>
                ),
              },
              {
                id: "safety",
                label: "Safety",
                content: <div className="card p-6"><FeatureList title="Safety features" items={selected.safety_features} /></div>,
              },
              {
                id: "comfort",
                label: "Comfort & Tech",
                content: (
                  <div className="card space-y-5 p-6">
                    <FeatureList title="Comfort &amp; Convenience" items={selected.comfort_features} />
                    <FeatureList title="Infotainment" items={selected.infotainment_features} />
                  </div>
                ),
              },
            ]}
          />
        </div>
      )}

      <p className="mt-6 rounded-lg bg-soft p-4 text-xs text-muted">{vehicle.disclaimer}</p>

      {showQuotes && selected && (
        <RequestQuotesModal variant={selected} vehicleLabel={`${vehicle.manufacturer_name} ${vehicle.model_name}`} manufacturerId={vehicle.manufacturer_id} onClose={() => setShowQuotes(false)} />
      )}
      {showAssistant && (
        <BuyingAssistant vehicleId={vehicle.id} context={`${vehicle.manufacturer_name} ${vehicle.model_name}`} onClose={() => setShowAssistant(false)} />
      )}
    </div>
  );
}
