"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import type { Paged, VehicleCard as VehicleCardType } from "@/lib/types";
import { VehicleCard } from "@/components/vehicle-card";
import { SectionHeading, Skeleton } from "@/components/ui";
import { useCompare } from "@/lib/compare";

export function PopularCars() {
  const [cars, setCars] = useState<VehicleCardType[] | null>(null);
  const { ids, toggle } = useCompare();

  useEffect(() => {
    api
      .get<Paged<VehicleCardType>>("/api/cars?page_size=8&sort=price_asc")
      .then((p) => setCars(p.items))
      .catch(() => setCars([]));
  }, []);

  return (
    <div>
      <SectionHeading
        title="Popular Cars"
        subtitle="Database-backed listings from the DriveEdge catalogue"
        action={<Link href="/cars" className="btn-ghost text-sm">View all</Link>}
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {!cars
          ? Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-72 rounded-2xl" />)
          : cars.map((v) => (
              <VehicleCard key={v.id} v={v} onCompare={toggle} compared={ids.includes(v.id)} />
            ))}
      </div>
    </div>
  );
}
