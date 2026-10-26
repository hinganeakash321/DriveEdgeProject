"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { LoadingBlock, StatusBadge, FadeIn } from "@/components/ui";
import { DataTable } from "@/components/data-table";

interface AdminUser {
  id: number;
  name: string;
  email: string;
  role: string;
  status: string;
  created_at: string;
}

const ROLES = ["", "customer", "dealer", "admin"];

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [role, setRole] = useState("");

  useEffect(() => {
    const q = role ? `?role=${role}` : "";
    api.get<AdminUser[]>(`/api/admin/users${q}`).then(setUsers).catch(() => setUsers([]));
  }, [role]);

  return (
    <div>
      <FadeIn className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-navy">Users</h1>
        <select className="input focus-ring w-40" value={role} onChange={(e) => setRole(e.target.value)} aria-label="Filter by role">
          {ROLES.map((r) => <option key={r} value={r}>{r ? r : "All roles"}</option>)}
        </select>
      </FadeIn>
      {!users ? (
        <LoadingBlock />
      ) : (
        <FadeIn>
          <DataTable
            className="mt-6"
            rows={users}
            rowKey={(u) => u.id}
            mobileTitle={(u) => u.name}
            columns={[
              { key: "name", header: "Name", cell: (u) => <span className="font-medium text-ink">{u.name}</span> },
              { key: "email", header: "Email", cell: (u) => <span className="text-muted">{u.email}</span>, mobileValueClassName: "break-all" },
              { key: "role", header: "Role", cell: (u) => <span className="capitalize text-ink">{u.role}</span> },
              { key: "status", header: "Status", cell: (u) => <StatusBadge status={u.status} /> },
            ]}
          />
        </FadeIn>
      )}
    </div>
  );
}
