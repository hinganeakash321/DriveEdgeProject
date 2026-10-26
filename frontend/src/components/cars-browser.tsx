"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAutoAnimate } from "@formkit/auto-animate/react";
import { Filter, X } from "lucide-react";
import { api, buildQuery } from "@/lib/api";
import type { FilterOptions, Paged, VehicleCard as VehicleCardType } from "@/lib/types";
import { VehicleCard } from "@/components/vehicle-card";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui";
import { Drawer } from "@/components/overlay";
import { useCompare } from "@/lib/compare";
import { titleCase } from "@/lib/utils";

const SORTS = [
  { v: "popular", label: "Popular" },
  { v: "price_asc", label: "Price: Low to High" },
  { v: "price_desc", label: "Price: High to Low" },
  { v: "name_asc", label: "Name: A-Z" },
  { v: "name_desc", label: "Name: Z-A" },
];

type Params = Record<string, string>;

export function CarsBrowser() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { ids, toggle } = useCompare();
  const [gridRef] = useAutoAnimate<HTMLDivElement>();
  const [chipRef] = useAutoAnimate<HTMLDivElement>();

  const [opts, setOpts] = useState<FilterOptions | null>(null);
  const [data, setData] = useState<Paged<VehicleCardType> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const params: Params = useMemo(() => {
    const p: Params = {};
    searchParams.forEach((v, k) => (p[k] = v));
    return p;
  }, [searchParams]);

  const update = useCallback(
    (patch: Params) => {
      const next = { ...params, ...patch };
      if (!("page" in patch)) next.page = "1";
      Object.keys(next).forEach((k) => next[k] === "" && delete next[k]);
      router.push(`/cars${buildQuery(next)}`);
    },
    [params, router]
  );

  useEffect(() => {
    api.get<FilterOptions>("/api/cars/filters").then(setOpts).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    setError(false);
    const query = buildQuery({ page_size: 12, ...params });
    api
      .get<Paged<VehicleCardType>>(`/api/cars${query}`)
      .then(setData)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [params]);

  const activeChips = Object.entries(params).filter(([k]) =>
    ["q", "manufacturer_id", "body_type", "fuel_type", "transmission", "seating_capacity", "max_price", "min_price"].includes(k)
  );

  const manufacturerName = (id: string) => opts?.manufacturers.find((m) => String(m.id) === id)?.name || id;

  const page = parseInt(params.page || "1");
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.page_size)) : 1;

  const FilterPanel = (
    <div className="space-y-5">
      <FilterSelect label="Manufacturer" value={params.manufacturer_id || ""} onChange={(v) => update({ manufacturer_id: v })}
        options={[{ v: "", l: "All" }, ...(opts?.manufacturers.map((m) => ({ v: String(m.id), l: m.name })) || [])]} />
      <FilterSelect label="Body type" value={params.body_type || ""} onChange={(v) => update({ body_type: v })}
        options={[{ v: "", l: "All" }, ...(opts?.body_types.map((b) => ({ v: b, l: titleCase(b) })) || [])]} />
      <FilterSelect label="Fuel type" value={params.fuel_type || ""} onChange={(v) => update({ fuel_type: v })}
        options={[{ v: "", l: "All" }, ...(opts?.fuel_types.map((f) => ({ v: f, l: titleCase(f) })) || [])]} />
      <FilterSelect label="Transmission" value={params.transmission || ""} onChange={(v) => update({ transmission: v })}
        options={[{ v: "", l: "All" }, ...(opts?.transmissions.map((t) => ({ v: t, l: t.toUpperCase() })) || [])]} />
      <FilterSelect label="Seating" value={params.seating_capacity || ""} onChange={(v) => update({ seating_capacity: v })}
        options={[{ v: "", l: "Any" }, ...(opts?.seating_capacities.map((s) => ({ v: String(s), l: `${s} seats` })) || [])]} />
      <div>
        <label className="label">Max price (₹)</label>
        <input className="input" type="number" placeholder="e.g. 1500000" defaultValue={params.max_price || ""}
          onBlur={(e) => update({ max_price: e.target.value })} />
      </div>
    </div>
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
      <aside className="hidden lg:block">
        <div className="card sticky top-20 p-5">
          <h3 className="mb-4 flex items-center gap-2 font-semibold text-navy">
            <Filter className="h-4 w-4" /> Filters
          </h3>
          {FilterPanel}
        </div>
      </aside>

      <div>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button className="btn-outline lg:hidden" onClick={() => setShowFilters(true)}>
              <Filter className="h-4 w-4" /> Filters
            </button>
            <span className="text-sm text-muted">{data ? `${data.total} cars` : "..."}</span>
          </div>
          <select className="input w-auto" value={params.sort || "popular"} onChange={(e) => update({ sort: e.target.value })}>
            {SORTS.map((s) => (
              <option key={s.v} value={s.v}>{s.label}</option>
            ))}
          </select>
        </div>

        {activeChips.length > 0 && (
          <div ref={chipRef} className="mb-4 flex flex-wrap gap-2">
            {activeChips.map(([k, v]) => (
              <button key={k} className="chip hover:border-danger hover:text-danger" onClick={() => update({ [k]: "" })}>
                {k === "manufacturer_id" ? manufacturerName(v) : titleCase(v)}
                <X className="h-3 w-3" />
              </button>
            ))}
            <button className="chip hover:border-danger hover:text-danger" onClick={() => router.push("/cars")}>
              Clear all
            </button>
          </div>
        )}

        {error ? (
          <ErrorState />
        ) : loading ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-80" />)}
          </div>
        ) : data && data.items.length === 0 ? (
          <EmptyState title="No cars match your filters" message="Try widening your budget or clearing some filters." />
        ) : (
          <>
            <div ref={gridRef} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {data?.items.map((v) => (
                <VehicleCard key={v.id} v={v} onCompare={toggle} compared={ids.includes(v.id)} />
              ))}
            </div>
            {totalPages > 1 && (
              <div className="mt-8 flex items-center justify-center gap-2">
                <button className="btn-outline" disabled={page <= 1} onClick={() => update({ page: String(page - 1) })}>
                  Previous
                </button>
                <span className="text-sm text-muted">Page {page} of {totalPages}</span>
                <button className="btn-outline" disabled={page >= totalPages} onClick={() => update({ page: String(page + 1) })}>
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <Drawer open={showFilters} onClose={() => setShowFilters(false)} side="left" title="Filters">
        <div className="p-5">
          {FilterPanel}
          <button className="btn-gradient mt-6 w-full" onClick={() => setShowFilters(false)}>Show results</button>
        </div>
      </Drawer>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { v: string; l: string }[];
}) {
  return (
    <div>
      <label className="label">{label}</label>
      <select className="input" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o.v} value={o.v}>{o.l}</option>
        ))}
      </select>
    </div>
  );
}
