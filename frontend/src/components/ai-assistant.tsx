"use client";

import { useEffect, useRef, useState } from "react";
import { Sparkles, X } from "lucide-react";
import { AiChat, chatConfigForRole } from "@/components/ai-chat";
import { useAuth } from "@/lib/auth";
import { useChatStore } from "@/lib/chat-store";

export function AiAssistant() {
  const [open, setOpen] = useState(false);
  const { user, loading } = useAuth();
  const { resetChat } = useChatStore();

  // Clear the in-memory conversation whenever the signed-in identity/persona
  // changes, so a customer's chat never bleeds into a dealer/admin session.
  const identity = loading ? null : user ? `${user.id}:${user.role}` : null;
  const prevIdentity = useRef<string | null>(identity);
  useEffect(() => {
    if (prevIdentity.current !== identity) {
      prevIdentity.current = identity;
      resetChat();
    }
  }, [identity, resetChat]);

  const role = loading ? undefined : user?.role;
  const config = chatConfigForRole(role);
  const launcherLabel =
    role === "dealer" ? "Dealer AI" : role === "admin" ? "Admin AI" : "Ask AI";

  // AI assistance is only available to signed-in users (guests must log in first).
  if (loading || !user) return null;

  return (
    <>
      {/* Floating launcher */}
      <button
        onClick={() => setOpen(true)}
        className={`fab-launcher fixed z-40 flex items-center gap-2 rounded-full bg-brand px-4 py-3 text-sm font-semibold text-white shadow-pop transition hover:bg-brand-700 ${open ? "hidden" : ""}`}
        aria-label={`Open ${config.heading}`}
      >
        <Sparkles className="h-5 w-5" /> {launcherLabel}
      </button>

      {/* Drawer */}
      {open && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col bg-card shadow-pop">
            <button
              onClick={() => setOpen(false)}
              className="absolute right-3 top-3 z-10 rounded-lg p-1.5 text-muted hover:bg-soft"
              aria-label="Close assistant"
            >
              <X className="h-5 w-5" />
            </button>
            <AiChat config={config} />
          </div>
        </div>
      )}
    </>
  );
}
