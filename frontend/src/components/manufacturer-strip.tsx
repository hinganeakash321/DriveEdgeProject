"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import type { FilterOptions } from "@/lib/types";
import { SectionHeading, Skeleton } from "@/components/ui";
import { pluralize } from "@/lib/utils";

export function ManufacturerStrip() {
  const [opts, setOpts] = useState<FilterOptions | null>(null);

  useEffect(() => {
    api.get<FilterOptions>("/api/cars/filters").then(setOpts).catch(() => {});
  }, []);

  return (
    <div>
      <SectionHeading
        title="Browse by Manufacturer"
        subtitle="Explore cars from brands available in India"
        action={<Link href="/cars" className="btn-ghost text-sm">View all</Link>}
      />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        {!opts
          ? Array.from({ length: 12 }).map((_, i) => <Skeleton key={i} className="h-24" />)
          : opts.manufacturers.map((m) => (
              <Link
                key={m.id}
                href={`/cars?manufacturer_id=${m.id}`}
                className="card card-hover flex flex-col items-center justify-center gap-1 rounded-2xl p-4 text-center"
              >
                <span className="text-base font-bold text-navy">{m.name}</span>
                <span className="text-xs text-muted">{pluralize(m.model_count ?? 0, "model")}</span>
              </Link>
            ))}
      </div>
    </div>
  );
}
