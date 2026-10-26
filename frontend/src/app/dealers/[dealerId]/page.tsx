"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { BadgeCheck, MapPin, Mail, Phone, Store } from "lucide-react";
import { api } from "@/lib/api";
import type { Dealer } from "@/lib/types";
import { ErrorState, LoadingBlock, FadeIn } from "@/components/ui";

const DealerMap = dynamic(() => import("@/components/dealer-map"), { ssr: false });

export default function DealerDetailPage({ params }: { params: { dealerId: string } }) {
  const [dealer, setDealer] = useState<Dealer | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    api.get<Dealer>(`/api/dealers/${params.dealerId}`).then(setDealer).catch(() => setError(true));
  }, [params.dealerId]);

  if (error) return <div className="container-xl py-10"><ErrorState message="Dealer not found." /></div>;
  if (!dealer) return <div className="container-xl"><LoadingBlock /></div>;

  return (
    <div className="container-xl py-8">
      <nav className="mb-4 text-sm text-muted">
        <Link href="/dealers" className="hover:text-brand">Find Dealers</Link> / <span className="text-ink">{dealer.dealer_name}</span>
      </nav>
      <FadeIn className="card overflow-hidden p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand to-teal text-white shadow-glow">
              <Store className="h-7 w-7" />
            </span>
            <div>
              <h1 className="text-2xl font-bold text-navy">{dealer.dealer_name}</h1>
              <p className="mt-2 flex items-center gap-1 text-muted"><MapPin className="h-4 w-4" /> {dealer.address || dealer.city}</p>
            </div>
          </div>
          {dealer.verification_status === "verified" ? (
            <span className="badge-success inline-flex items-center gap-1"><BadgeCheck className="h-4 w-4" /> Verified</span>
          ) : (
            <span className="badge-muted">Unverified</span>
          )}
        </div>

        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <div>
            <h3 className="font-semibold text-navy">Supported manufacturers</h3>
            <div className="mt-2 flex flex-wrap gap-2">
              {dealer.manufacturer_names.length ? dealer.manufacturer_names.map((m) => <span key={m} className="chip">{m}</span>) : <span className="text-sm text-muted">Not listed</span>}
            </div>
          </div>
          <div>
            <h3 className="font-semibold text-navy">Contact</h3>
            <div className="mt-2 space-y-1 text-sm text-muted">
              {dealer.contact_email && <p className="flex items-center gap-2"><Mail className="h-4 w-4" /> {dealer.contact_email}</p>}
              {dealer.contact_phone && <p className="flex items-center gap-2"><Phone className="h-4 w-4" /> {dealer.contact_phone}</p>}
            </div>
          </div>
        </div>

        {typeof dealer.latitude === "number" && typeof dealer.longitude === "number" && (
          <div className="mt-6">
            <h3 className="mb-2 font-semibold text-navy">Location</h3>
            <DealerMap dealers={[dealer]} height={280} zoom={12} />
          </div>
        )}

        <div className="mt-6">
          <Link href="/cars" className="btn-gradient">Browse cars &amp; request quotes</Link>
        </div>
      </FadeIn>
    </div>
  );
}
