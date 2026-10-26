"use client";

import { RoleGuard } from "@/components/role-guard";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleGuard role="admin">
      <div className="container-xl py-8">{children}</div>
    </RoleGuard>
  );
}
