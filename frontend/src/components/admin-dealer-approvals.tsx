"use client";

import { useEffect, useState } from "react";
import { BadgeCheck, Check, X } from "lucide-react";
import { api } from "@/lib/api";
import { EmptyState, LoadingBlock, StatusBadge } from "@/components/ui";
import { DataTable } from "@/components/data-table";
import { Modal } from "@/components/overlay";
import { useToast } from "@/components/toast";

interface AdminDealer {
  id: number;
  dealer_name: string;
  city: string;
  verification_status: string;
  contact_email?: string;
}

export function AdminDealerApprovals() {
  const [dealers, setDealers] = useState<AdminDealer[] | null>(null);
  const [pending, setPending] = useState<{ dealer: AdminDealer; approve: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const load = () => api.get<AdminDealer[]>("/api/admin/dealers").then(setDealers).catch(() => setDealers([]));

  useEffect(() => {
    load();
  }, []);

  const confirmApproval = async () => {
    if (!pending) return;
    setBusy(true);
    try {
      await api.patch(`/api/admin/dealers/${pending.dealer.id}/approval`, { approve: pending.approve });
      toast.success(pending.approve ? "Dealer approved" : "Dealer rejected", pending.dealer.dealer_name);
      setPending(null);
      load();
    } catch (e) {
      toast.error("Action failed", e instanceof Error ? e.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card p-6">
      <h3 className="mb-4 flex items-center gap-2 font-semibold text-navy"><BadgeCheck className="h-5 w-5 text-teal" /> Dealer Approvals</h3>
      {!dealers ? (
        <LoadingBlock />
      ) : dealers.length === 0 ? (
        <EmptyState title="No dealers" />
      ) : (
        <DataTable
          className="mt-4"
          bare
          minWidthClass="min-w-[560px]"
          rows={dealers}
          rowKey={(d) => d.id}
          mobileTitle={(d) => d.dealer_name}
          columns={[
            { key: "dealer", header: "Dealer", cell: (d) => <span className="font-medium text-ink">{d.dealer_name}</span> },
            { key: "city", header: "City", cell: (d) => <span className="text-muted">{d.city || "—"}</span> },
            { key: "status", header: "Status", cell: (d) => <StatusBadge status={d.verification_status} /> },
            {
              key: "actions",
              header: <span className="block text-right">Actions</span>,
              fullWidthOnMobile: true,
              cell: (d) => (
                <div className="flex justify-end gap-2">
                  <button className="btn-outline border-success text-success" aria-label={`Approve ${d.dealer_name}`} onClick={() => setPending({ dealer: d, approve: true })}><Check className="h-4 w-4" /></button>
                  <button className="btn-outline border-danger text-danger" aria-label={`Reject ${d.dealer_name}`} onClick={() => setPending({ dealer: d, approve: false })}><X className="h-4 w-4" /></button>
                </div>
              ),
            },
          ]}
        />
      )}

      <Modal
        open={pending !== null}
        onClose={() => !busy && setPending(null)}
        title={pending?.approve ? "Approve dealer?" : "Reject dealer?"}
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <button className="btn-outline" disabled={busy} onClick={() => setPending(null)}>Cancel</button>
            <button className={pending?.approve ? "btn-gradient" : "btn bg-danger text-white hover:brightness-110"} disabled={busy} onClick={confirmApproval}>
              {pending?.approve ? "Approve" : "Reject"}
            </button>
          </div>
        }
      >
        <p className="text-sm text-muted">
          {pending?.approve
            ? `This will mark ${pending?.dealer.dealer_name} as a verified dealer, visible to customers.`
            : `This will reject ${pending?.dealer.dealer_name}. They will not appear as verified.`}
        </p>
      </Modal>
    </div>
  );
}
