"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import type { Enquiry } from "@/lib/types";
import { ArrowRight } from "lucide-react";
import { RoleGuard } from "@/components/role-guard";
import { EmptyState, LoadingBlock, StatusBadge, FadeIn, Stagger, StaggerItem } from "@/components/ui";

function Enquiries() {
  const [enquiries, setEnquiries] = useState<Enquiry[] | null>(null);

  useEffect(() => {
    api.get<Enquiry[]>("/api/enquiries").then(setEnquiries).catch(() => setEnquiries([]));
  }, []);

  return (
    <div className="container-xl py-8">
      <FadeIn>
        <h1 className="text-3xl font-bold text-navy">My Enquiries</h1>
        <p className="mt-1 text-muted">Track the dealers you have contacted and their responses.</p>
      </FadeIn>
      <div className="mt-6">
        {!enquiries ? (
          <LoadingBlock />
        ) : enquiries.length === 0 ? (
          <EmptyState title="No enquiries yet" message="Browse cars and request dealer quotes." action={<Link href="/cars" className="btn-gradient">Browse cars</Link>} />
        ) : (
          <Stagger className="space-y-3">
            {enquiries.map((e) => (
              <StaggerItem key={e.id}>
                <Link href={`/dashboard/enquiries/${e.id}`} className="card card-hover block p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-navy">{e.vehicle_label || `Enquiry #${e.id}`}</p>
                      <p className="text-xs text-muted">{e.location || "—"} &middot; {new Date(e.created_at).toLocaleDateString()}</p>
                    </div>
                    <StatusBadge status={e.status} />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {e.dealers.map((d) => (
                      <span key={d.id} className="chip">
                        {d.dealer_name} {d.has_quotation ? "· quoted" : `· ${d.response_status}`}
                      </span>
                    ))}
                  </div>
                  <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-brand">
                    View details &amp; quotations <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </Link>
              </StaggerItem>
            ))}
          </Stagger>
        )}
      </div>
    </div>
  );
}

export default function Page() {
  return <RoleGuard role="customer"><Enquiries /></RoleGuard>;
}
