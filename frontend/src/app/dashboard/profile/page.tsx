"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { RoleGuard } from "@/components/role-guard";
import { useAuth } from "@/lib/auth";
import { Spinner, FadeIn } from "@/components/ui";
import { useToast } from "@/components/toast";

function Profile() {
  const { user, refresh } = useAuth();
  const toast = useToast();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setName(user.name);
      setPhone(user.phone || "");
    }
  }, [user]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.patch("/api/auth/me", { name, phone });
      await refresh();
      toast.success("Profile updated");
    } catch (err) {
      toast.error("Could not save", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="container-xl py-8">
      <FadeIn>
        <h1 className="text-3xl font-bold text-navy">Profile</h1>
        <p className="mt-1 text-muted">Manage your account details.</p>
      </FadeIn>
      <FadeIn delay={0.1}>
        <form onSubmit={save} className="card mt-6 max-w-lg space-y-4 p-6">
          <div>
            <label className="label" htmlFor="p-name">Name</label>
            <input id="p-name" className="input focus-ring" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="p-email">Email</label>
            <input id="p-email" className="input" value={user?.email || ""} disabled />
          </div>
          <div>
            <label className="label" htmlFor="p-phone">Phone</label>
            <input id="p-phone" className="input focus-ring" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <button className="btn-gradient" disabled={saving}>
            {saving ? <Spinner className="h-4 w-4 text-white" /> : "Save changes"}
          </button>
        </form>
      </FadeIn>
    </div>
  );
}

export default function Page() {
  return <RoleGuard role="customer"><Profile /></RoleGuard>;
}
