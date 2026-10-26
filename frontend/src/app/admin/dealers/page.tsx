"use client";

import { AdminDealerApprovals } from "@/components/admin-dealer-approvals";

export default function AdminDealersPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-navy">Dealers</h1>
      <p className="mt-1 text-muted">Review and verify dealership accounts.</p>
      <div className="mt-6">
        <AdminDealerApprovals />
      </div>
    </div>
  );
}
