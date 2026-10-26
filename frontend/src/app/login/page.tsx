"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { Spinner } from "@/components/ui";
import { AuthShell } from "@/components/auth-shell";
import { useToast } from "@/components/toast";

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // Cosmetic only: the account's real role governs access and routing.
  const [intent, setIntent] = useState<"dealer" | "customer" | null>(null);

  useEffect(() => {
    const role = new URLSearchParams(window.location.search).get("role");
    if (role === "dealer" || role === "customer") setIntent(role);
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const user = await login(email, password);
      toast.success("Welcome back", `Signed in as ${user.name.split(" ")[0]}`);
      router.push(user.role === "dealer" ? "/dealer" : user.role === "admin" ? "/admin" : "/browse");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Login failed";
      setError(msg);
      toast.error("Login failed", msg);
    } finally {
      setLoading(false);
    }
  };

  const heading =
    intent === "dealer" ? "Dealer login" : intent === "customer" ? "Customer login" : "Welcome back";
  const demo =
    intent === "dealer"
      ? "dealer@driveedge.in · dealer2@driveedge.in · dealer3@driveedge.in"
      : intent === "customer"
      ? "customer@driveedge.in · priya@driveedge.in · rohan@driveedge.in"
      : "customer@driveedge.in · dealer@driveedge.in · admin@driveedge.in";

  return (
    <AuthShell>
      <div className="card p-8">
        <h1 className="text-2xl font-bold text-navy">{heading}</h1>
        <p className="mt-1 text-sm text-muted">Log in to your DriveEdge account.</p>
        <form onSubmit={submit} className="mt-6 space-y-4">
          <div>
            <label className="label" htmlFor="login-email">Email</label>
            <input id="login-email" className="input focus-ring" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="login-password">Password</label>
            <input id="login-password" className="input focus-ring" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          {error && <p className="text-sm text-danger" role="alert">{error}</p>}
          <button className="btn-gradient w-full" disabled={loading}>
            {loading ? <Spinner className="h-4 w-4 text-white" /> : "Log in"}
          </button>
        </form>
        <p className="mt-4 text-sm text-muted">
          No account?{" "}
          <Link href={intent ? `/register?role=${intent}` : "/register"} className="font-medium text-brand hover:underline">
            Sign up
          </Link>
        </p>
        <div className="mt-6 rounded-lg bg-soft p-3 text-xs text-muted">
          <p className="font-medium text-ink">Demo logins (password: Password123)</p>
          <p>{demo}</p>
        </div>
      </div>
    </AuthShell>
  );
}
