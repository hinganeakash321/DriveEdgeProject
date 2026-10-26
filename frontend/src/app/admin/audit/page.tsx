"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { LoadingBlock, EmptyState } from "@/components/ui";
import { DataTable } from "@/components/data-table";

interface AuditLog {
  id: number;
  actor_user_id: number;
  action: string;
  entity_type: string;
  entity_id: number;
  detail?: string;
  created_at: string;
}

export default function AdminAuditPage() {
  const [logs, setLogs] = useState<AuditLog[] | null>(null);

  useEffect(() => {
    api.get<AuditLog[]>("/api/admin/audit-logs").then(setLogs).catch(() => setLogs([]));
  }, []);

  if (!logs) return <LoadingBlock />;

  return (
    <div>
      <h1 className="text-2xl font-bold text-navy">Audit Log</h1>
      <p className="mt-1 text-muted">Recent administrative actions.</p>
      {logs.length === 0 ? (
        <EmptyState title="No audit entries yet" />
      ) : (
        <DataTable
          className="mt-6"
          rows={logs}
          rowKey={(l) => l.id}
          mobileTitle={(l) => l.action}
          columns={[
            { key: "action", header: "Action", cell: (l) => <span className="font-medium text-ink">{l.action}</span> },
            { key: "entity", header: "Entity", cell: (l) => <span className="text-muted">{l.entity_type} #{l.entity_id}</span> },
            { key: "detail", header: "Detail", cell: (l) => <span className="text-muted">{l.detail || "—"}</span> },
            { key: "actor", header: "Actor", cell: (l) => <span className="text-muted">#{l.actor_user_id}</span> },
            { key: "when", header: "When", cell: (l) => <span className="text-muted">{new Date(l.created_at).toLocaleString()}</span> },
          ]}
        />
      )}
    </div>
  );
}
