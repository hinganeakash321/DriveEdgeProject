"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, clearToken, getToken, setToken } from "./api";
import type { User } from "./types";

interface AuthState {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (payload: RegisterPayload) => Promise<User>;
  logout: () => void;
  refresh: () => Promise<void>;
}

interface RegisterPayload {
  name: string;
  email: string;
  password: string;
  phone?: string;
  role?: string;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const loadUser = async () => {
    if (!getToken()) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const me = await api.get<User>("/api/auth/me");
      setUser(me);
    } catch {
      clearToken();
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = async (email: string, password: string) => {
    const res = await api.post<{ access_token: string }>("/api/auth/login", { email, password });
    setToken(res.access_token);
    const me = await api.get<User>("/api/auth/me");
    setUser(me);
    return me;
  };

  const register = async (payload: RegisterPayload) => {
    const res = await api.post<{ access_token: string }>("/api/auth/register", payload);
    setToken(res.access_token);
    const me = await api.get<User>("/api/auth/me");
    setUser(me);
    return me;
  };

  const logout = useCallback(() => {
    clearToken();
    setUser(null);
    // Hard-navigate home so the redirect reliably wins over any protected-page
    // RoleGuard that would otherwise bounce the now-signed-out user to /login.
    // A full load also clears the in-memory chat, which is desired on sign-out.
    if (typeof window !== "undefined") {
      window.location.assign("/");
    } else {
      router.push("/");
    }
  }, [router]);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refresh: loadUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
