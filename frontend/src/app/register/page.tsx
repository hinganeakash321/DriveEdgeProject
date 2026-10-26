"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { Spinner } from "@/components/ui";
import { AuthShell } from "@/components/auth-shell";
import { useToast } from "@/components/toast";

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const [form, setForm] = useState({ name: "", email: "", password: "", phone: "", role: "customer" });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Preselect the account type when arriving from a role entry card.
  useEffect(() => {
    const role = new URLSearchParams(window.location.search).get("role");
    if (role === "dealer" || role === "customer") setForm((f) => ({ ...f, role }));
  }, []);

  const update = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const user = await register(form);
      toast.success("Account created", "Welcome to DriveEdge!");
      router.push(user.role === "dealer" ? "/dealer" : "/browse");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Registration failed";
      setError(msg);
      toast.error("Registration failed", msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell>
      <div className="card p-8">
        <h1 className="text-2xl font-bold text-navy">Create your account</h1>
        <p className="mt-1 text-sm text-muted">Join DriveEdge to track enquiries and quotations.</p>
        <form onSubmit={submit} className="mt-6 space-y-4">
          <div>
            <label className="label" htmlFor="reg-name">Full name</label>
            <input id="reg-name" className="input focus-ring" autoComplete="name" required value={form.name} onChange={(e) => update("name", e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="reg-email">Email</label>
            <input id="reg-email" className="input focus-ring" type="email" autoComplete="email" required value={form.email} onChange={(e) => update("email", e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="reg-phone">Phone (optional)</label>
            <input id="reg-phone" className="input focus-ring" autoComplete="tel" value={form.phone} onChange={(e) => update("phone", e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="reg-password">Password</label>
            <input id="reg-password" className="input focus-ring" type="password" autoComplete="new-password" required minLength={8} value={form.password} onChange={(e) => update("password", e.target.value)} />
            <p className="mt-1 text-xs text-muted">At least 8 characters.</p>
          </div>
          <div>
            <label className="label" htmlFor="reg-role">Account type</label>
            <select id="reg-role" className="input focus-ring" value={form.role} onChange={(e) => update("role", e.target.value)}>
              <option value="customer">Customer</option>
              <option value="dealer">Dealer (requires admin approval)</option>
            </select>
          </div>
          {error && <p className="text-sm text-danger" role="alert">{error}</p>}
          <button className="btn-gradient w-full" disabled={loading}>
            {loading ? <Spinner className="h-4 w-4 text-white" /> : "Create account"}
          </button>
        </form>
        <p className="mt-4 text-sm text-muted">
          Already have an account? <Link href="/login" className="font-medium text-brand hover:underline">Log in</Link>
        </p>
      </div>
    </AuthShell>
  );
}
