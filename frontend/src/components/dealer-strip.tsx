"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BadgeCheck, MapPin, Store } from "lucide-react";
import { api } from "@/lib/api";
import type { Dealer, Paged } from "@/lib/types";
import { SectionHeading, Skeleton, Stagger, StaggerItem } from "@/components/ui";

export function DealerStrip() {
  const [dealers, setDealers] = useState<Dealer[] | null>(null);

  useEffect(() => {
    api.get<Paged<Dealer>>("/api/dealers?page_size=4").then((p) => setDealers(p.items)).catch(() => setDealers([]));
  }, []);

  return (
    <div>
      <SectionHeading
        title="Discover Dealerships"
        subtitle="Verified dealers across major Indian cities"
        action={<Link href="/dealers" className="btn-ghost text-sm">View all</Link>}
      />
      {!dealers ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-40" />)}
        </div>
      ) : (
        <Stagger className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {dealers.map((d) => (
            <StaggerItem key={d.id}>
              <Link href={`/dealers/${d.id}`} className="card card-hover block h-full p-5">
                <div className="flex items-start justify-between">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand to-teal text-white shadow-glow">
                    <Store className="h-5 w-5" />
                  </span>
                  {d.verification_status === "verified" && <BadgeCheck className="h-5 w-5 text-teal" />}
                </div>
                <h3 className="mt-3 font-semibold text-navy">{d.dealer_name}</h3>
                <p className="mt-1 flex items-center gap-1 text-sm text-muted">
                  <MapPin className="h-4 w-4" /> {d.city}
                </p>
                <p className="mt-3 text-xs text-muted">
                  {d.manufacturer_names.slice(0, 3).join(", ") || "Multiple brands"}
                </p>
              </Link>
            </StaggerItem>
          ))}
        </Stagger>
      )}
    </div>
  );
}
