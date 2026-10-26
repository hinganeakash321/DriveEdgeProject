"use client";

import Link from "next/link";
import { Fuel, Settings2, Users, GitCompare } from "lucide-react";
import type { VehicleCard as VehicleCardType } from "@/lib/types";
import { formatPriceRange, titleCase } from "@/lib/utils";
import { FavouriteButton } from "@/components/favourite-button";

export function VehicleCard({
  v,
  onCompare,
  compared,
}: {
  v: VehicleCardType;
  onCompare?: (id: number) => void;
  compared?: boolean;
}) {
  return (
    <div className="card card-hover group relative flex flex-col overflow-hidden rounded-2xl">
      <Link href={`/cars/${v.id}`} className="block">
        <div className="relative flex h-44 items-center justify-center overflow-hidden bg-gradient-to-br from-slate-100 to-brand-50 dark:from-slate-800 dark:to-slate-900">
          {v.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={v.image_url} alt={`${v.manufacturer_name} ${v.model_name}`} loading="lazy" className="h-full w-full object-contain p-4 transition-transform duration-500 group-hover:scale-110" />
          ) : (
            <span className="text-2xl font-bold text-navy/15 sm:text-4xl">{v.manufacturer_name}</span>
          )}
          <span className="absolute left-3 top-3 inline-flex items-center rounded-full bg-slate-900/85 px-3 py-1 text-xs font-medium text-white shadow-sm backdrop-blur">{v.body_type}</span>
        </div>
      </Link>
      <div className="absolute right-2 top-2">
        <FavouriteButton modelId={v.id} className="bg-card/80 backdrop-blur" />
      </div>
      <div className="flex flex-1 flex-col p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted">{v.manufacturer_name}</p>
        <Link href={`/cars/${v.id}`}>
          <h3 className="mt-0.5 text-lg font-semibold text-navy hover:text-brand">{v.model_name}</h3>
        </Link>
        <p className="mt-1 text-lg font-bold text-ink">{formatPriceRange(v.min_price, v.max_price)}</p>
        <p className="text-xs text-muted">Ex-showroom &middot; {v.variant_count} variant{v.variant_count !== 1 ? "s" : ""}</p>

        <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted">
          <span className="inline-flex items-center gap-1"><Fuel className="h-3.5 w-3.5" />{v.fuel_types.map(titleCase).join(", ")}</span>
          <span className="inline-flex items-center gap-1"><Settings2 className="h-3.5 w-3.5" />{v.transmissions.map((t) => t.toUpperCase()).join(", ")}</span>
          {v.seating_capacities.length > 0 && (
            <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" />{v.seating_capacities.join("/")} seats</span>
          )}
        </div>

        <div className="mt-4 flex items-center gap-2 border-t border-line pt-3">
          <Link href={`/cars/${v.id}`} className="btn-gradient flex-1 text-xs">
            View Details
          </Link>
          {onCompare && (
            <button
              onClick={() => onCompare(v.id)}
              className={`btn-outline text-xs ${compared ? "border-brand bg-brand-50 text-brand-700" : ""}`}
            >
              <GitCompare className="h-4 w-4" />
              {compared ? "Added" : "Compare"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
