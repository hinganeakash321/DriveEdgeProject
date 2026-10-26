"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { BadgeCheck, List, Map as MapIcon, MapPin, Search, Store } from "lucide-react";
import { api, buildQuery } from "@/lib/api";
import type { Dealer, FilterOptions, Paged } from "@/lib/types";
import { EmptyState, LoadingBlock, SectionHeading, Stagger, StaggerItem } from "@/components/ui";
import { cn } from "@/lib/utils";

const DealerMap = dynamic(() => import("@/components/dealer-map"), {
  ssr: false,
  loading: () => <LoadingBlock />,
});

export default function DealersPage() {
  const [dealers, setDealers] = useState<Dealer[] | null>(null);
  const [opts, setOpts] = useState<FilterOptions | null>(null);
  const [q, setQ] = useState("");
  const [city, setCity] = useState("");
  const [manufacturer, setManufacturer] = useState("");
  const [view, setView] = useState<"list" | "map">("list");

  const load = () => {
    setDealers(null);
    const query = buildQuery({ q, city, manufacturer_id: manufacturer, page_size: 24 });
    api.get<Paged<Dealer>>(`/api/dealers${query}`).then((p) => setDealers(p.items)).catch(() => setDealers([]));
  };

  useEffect(() => {
    api.get<FilterOptions>("/api/cars/filters").then(setOpts).catch(() => {});
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="container-xl py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SectionHeading title="Find Dealerships" subtitle="Discover dealers across India and request quotations" />
        <div className="inline-flex rounded-lg border border-line p-0.5">
          <button
            onClick={() => setView("list")}
            className={cn("focus-ring inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors", view === "list" ? "bg-brand text-white shadow-sm" : "text-ink hover:bg-soft")}
          >
            <List className="h-4 w-4" /> List
          </button>
          <button
            onClick={() => setView("map")}
            className={cn("focus-ring inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors", view === "map" ? "bg-brand text-white shadow-sm" : "text-ink hover:bg-soft")}
          >
            <MapIcon className="h-4 w-4" /> Map
          </button>
        </div>
      </div>

      <div className="card mb-6 mt-4 grid gap-3 p-4 md:grid-cols-4">
        <input className="input md:col-span-2" placeholder="Search dealer name" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load()} />
        <input className="input" placeholder="City" value={city} onChange={(e) => setCity(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load()} />
        <div className="flex gap-2">
          <select className="input" value={manufacturer} onChange={(e) => setManufacturer(e.target.value)}>
            <option value="">All brands</option>
            {opts?.manufacturers.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
          <button className="btn-gradient" onClick={load} aria-label="Search dealers"><Search className="h-4 w-4" /></button>
        </div>
      </div>

      {!dealers ? (
        <LoadingBlock />
      ) : dealers.length === 0 ? (
        <EmptyState title="No dealers found" message="Try a different city or brand." />
      ) : view === "map" ? (
        <DealerMap dealers={dealers} />
      ) : (
        <Stagger className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {dealers.map((d) => (
            <StaggerItem key={d.id}>
              <Link href={`/dealers/${d.id}`} className="card card-hover block h-full p-5">
                <div className="flex items-start justify-between">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-brand to-teal text-white shadow-glow">
                    <Store className="h-5 w-5" />
                  </span>
                  {d.verification_status === "verified" && (
                    <span className="badge-success"><BadgeCheck className="mr-1 h-3.5 w-3.5" /> Verified</span>
                  )}
                </div>
                <h3 className="mt-3 font-semibold text-navy">{d.dealer_name}</h3>
                <p className="mt-1 flex items-center gap-1 text-sm text-muted"><MapPin className="h-4 w-4" /> {d.city}{d.state ? `, ${d.state}` : ""}</p>
                <div className="mt-3 flex flex-wrap gap-1">
                  {d.manufacturer_names.slice(0, 4).map((m) => <span key={m} className="chip">{m}</span>)}
                </div>
              </Link>
            </StaggerItem>
          ))}
        </Stagger>
      )}
    </div>
  );
}
