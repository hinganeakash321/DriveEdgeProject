"use client";

import { RoleGuard } from "@/components/role-guard";

export default function DealerLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleGuard role="dealer">
      <div className="container-xl py-8">{children}</div>
    </RoleGuard>
  );
}
