"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { LoadingBlock } from "@/components/ui";
import type { Role } from "@/lib/types";

export function RoleGuard({ role, children }: { role: Role; children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
    else if (!loading && user && user.role !== role) {
      router.replace(user.role === "dealer" ? "/dealer" : user.role === "admin" ? "/admin" : "/dashboard");
    }
  }, [user, loading, role, router]);

  if (loading || !user || user.role !== role) {
    return <div className="container-xl"><LoadingBlock label="Checking access..." /></div>;
  }
  return <>{children}</>;
}
