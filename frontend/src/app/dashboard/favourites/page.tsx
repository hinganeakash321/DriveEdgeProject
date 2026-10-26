"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { RoleGuard } from "@/components/role-guard";
import { useFavourites } from "@/lib/favourites";
import { FavouriteButton } from "@/components/favourite-button";
import { EmptyState, LoadingBlock } from "@/components/ui";
import { formatINR } from "@/lib/utils";

interface RecentItem {
  id: number;
  vehicle_model_id: number;
  model_name: string;
  manufacturer_name?: string | null;
  body_type: string;
  image_url?: string | null;
  min_price?: number | null;
}

function Card({ item }: { item: RecentItem }) {
  return (
    <div className="card card-hover group overflow-hidden">
      <Link href={`/cars/${item.vehicle_model_id}`} className="block h-36 overflow-hidden bg-gradient-to-br from-soft to-brand-50">
        {item.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.image_url} alt={item.model_name} className="h-full w-full object-contain p-3 transition-transform duration-500 group-hover:scale-105" />
        ) : (
          <div className="flex h-full items-center justify-center text-2xl font-bold text-navy/15">{item.manufacturer_name}</div>
        )}
      </Link>
      <div className="flex items-center justify-between p-4">
        <div>
          <p className="text-xs uppercase text-muted">{item.manufacturer_name}</p>
          <Link href={`/cars/${item.vehicle_model_id}`} className="font-semibold text-navy hover:text-brand">{item.model_name}</Link>
          <p className="text-sm text-ink">{item.min_price ? `from ${formatINR(item.min_price)}` : "Price not available"}</p>
        </div>
        <FavouriteButton modelId={item.vehicle_model_id} />
      </div>
    </div>
  );
}

function FavouritesPage() {
  const { items, loading } = useFavourites();
  const [recent, setRecent] = useState<RecentItem[] | null>(null);

  useEffect(() => {
    api.get<RecentItem[]>("/api/recently-viewed").then(setRecent).catch(() => setRecent([]));
  }, []);

  return (
    <div className="container-xl py-8">
      <h1 className="text-3xl font-bold text-navy">Saved Cars</h1>
      <p className="mt-1 text-muted">Your favourites and recently viewed models.</p>

      <h2 className="mt-8 text-lg font-semibold text-navy">Favourites</h2>
      {loading ? (
        <LoadingBlock />
      ) : items.length === 0 ? (
        <div className="mt-3"><EmptyState title="No favourites yet" message="Tap the heart on any car to save it here." action={<Link href="/cars" className="btn-primary">Browse cars</Link>} /></div>
      ) : (
        <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((it) => <Card key={it.id} item={it} />)}
        </div>
      )}

      {recent && recent.length > 0 && (
        <>
          <h2 className="mt-10 text-lg font-semibold text-navy">Recently viewed</h2>
          <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {recent.map((it) => <Card key={it.id} item={it} />)}
          </div>
        </>
      )}
    </div>
  );
}

export default function Page() {
  return <RoleGuard role="customer"><FavouritesPage /></RoleGuard>;
}
