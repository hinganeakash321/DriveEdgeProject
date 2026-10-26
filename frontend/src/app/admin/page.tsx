"use client";

import { useEffect, useState } from "react";
import { Users, Store, BadgeCheck, Car, Inbox, FileText, Clock } from "lucide-react";
import { api } from "@/lib/api";
import { KpiCard, LoadingBlock, FadeIn, Stagger, StaggerItem } from "@/components/ui";
import { AdminCharts } from "@/components/admin-charts";
import { AdminDealerApprovals } from "@/components/admin-dealer-approvals";
import { AiInsightsPanel } from "@/components/ai-insights-panel";

interface Overview {
  total_customers: number;
  total_dealers: number;
  verified_dealers: number;
  active_listings: number;
  total_enquiries: number;
  quotations_submitted: number;
  pending_dealer_approvals: number;
}

function AdminPortal() {
  const [overview, setOverview] = useState<Overview | null>(null);

  useEffect(() => {
    api.get<Overview>("/api/admin/overview").then(setOverview).catch(() => {});
  }, []);

  if (!overview) return <LoadingBlock />;

  return (
    <div>
      <FadeIn>
        <h1 className="text-3xl font-bold tracking-tight text-navy">Admin Overview</h1>
        <p className="mt-1 text-muted">Platform-wide metrics, analytics, and operations.</p>
      </FadeIn>

      <Stagger className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StaggerItem><KpiCard label="Total Customers" value={overview.total_customers} icon={<Users className="h-5 w-5" />} accent /></StaggerItem>
        <StaggerItem><KpiCard label="Total Dealers" value={overview.total_dealers} icon={<Store className="h-5 w-5" />} /></StaggerItem>
        <StaggerItem><KpiCard label="Verified Dealers" value={overview.verified_dealers} icon={<BadgeCheck className="h-5 w-5" />} /></StaggerItem>
        <StaggerItem><KpiCard label="Active Listings" value={overview.active_listings} icon={<Car className="h-5 w-5" />} /></StaggerItem>
        <StaggerItem><KpiCard label="Total Enquiries" value={overview.total_enquiries} icon={<Inbox className="h-5 w-5" />} /></StaggerItem>
        <StaggerItem><KpiCard label="Quotations Submitted" value={overview.quotations_submitted} icon={<FileText className="h-5 w-5" />} /></StaggerItem>
        <StaggerItem><KpiCard label="Pending Approvals" value={overview.pending_dealer_approvals} icon={<Clock className="h-5 w-5" />} /></StaggerItem>
      </Stagger>

      <div className="mt-8">
        <AiInsightsPanel endpoint="/api/ai/admin-insights" title="AI Executive Summary" />
      </div>

      <div className="mt-8">
        <AdminCharts />
      </div>

      <div className="mt-8">
        <AdminDealerApprovals />
      </div>
    </div>
  );
}

export default function Page() {
  return <AdminPortal />;
}
