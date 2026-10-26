"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { LoadingBlock, StatusBadge, FadeIn } from "@/components/ui";
import { useToast } from "@/components/toast";

interface DealerProfile {
  id: number;
  dealer_name: string;
  address?: string | null;
  city: string;
  state?: string | null;
  postal_code?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  verification_status: string;
  manufacturer_names: string[];
}

export default function DealerProfilePage() {
  const [profile, setProfile] = useState<DealerProfile | null>(null);
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  useEffect(() => {
    api.get<DealerProfile>("/api/dealer/profile").then(setProfile).catch(() => {});
  }, []);

  if (!profile) return <LoadingBlock />;

  const field = (key: keyof DealerProfile, value: string) =>
    setProfile({ ...profile, [key]: value });

  const save = async () => {
    setSaving(true);
    try {
      const updated = await api.patch<DealerProfile>("/api/dealer/profile", {
        address: profile.address,
        city: profile.city,
        state: profile.state,
        postal_code: profile.postal_code,
        contact_email: profile.contact_email,
        contact_phone: profile.contact_phone,
      });
      setProfile(updated);
      toast.success("Profile saved");
    } catch (e) {
      toast.error("Could not save", e instanceof Error ? e.message : "Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <FadeIn className="max-w-2xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-navy">{profile.dealer_name}</h1>
        <StatusBadge status={profile.verification_status} />
      </div>
      {profile.manufacturer_names.length > 0 && (
        <p className="mt-1 text-sm text-muted">Brands: {profile.manufacturer_names.join(", ")}</p>
      )}

      <div className="card mt-6 grid gap-4 p-6 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label">Address</label>
          <input className="input" value={profile.address || ""} onChange={(e) => field("address", e.target.value)} />
        </div>
        <div>
          <label className="label">City</label>
          <input className="input" value={profile.city || ""} onChange={(e) => field("city", e.target.value)} />
        </div>
        <div>
          <label className="label">State</label>
          <input className="input" value={profile.state || ""} onChange={(e) => field("state", e.target.value)} />
        </div>
        <div>
          <label className="label">Postal code</label>
          <input className="input" value={profile.postal_code || ""} onChange={(e) => field("postal_code", e.target.value)} />
        </div>
        <div>
          <label className="label">Contact phone</label>
          <input className="input" value={profile.contact_phone || ""} onChange={(e) => field("contact_phone", e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Contact email</label>
          <input className="input" value={profile.contact_email || ""} onChange={(e) => field("contact_email", e.target.value)} />
        </div>
        <div className="sm:col-span-2 flex items-center gap-3">
          <button className="btn-gradient" onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </FadeIn>
  );
}
