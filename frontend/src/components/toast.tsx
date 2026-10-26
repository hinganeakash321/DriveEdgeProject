"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastVariant = "success" | "error" | "info";
type Toast = { id: number; title: string; description?: string; variant: ToastVariant };

type ToastApi = {
  toast: (t: { title: string; description?: string; variant?: ToastVariant; duration?: number }) => void;
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
  return ctx;
}

const ICONS: Record<ToastVariant, React.ReactNode> = {
  success: <CheckCircle2 className="h-5 w-5 text-success" />,
  error: <AlertCircle className="h-5 w-5 text-danger" />,
  info: <Info className="h-5 w-5 text-brand" />,
};

const ACCENT: Record<ToastVariant, string> = {
  success: "border-l-success",
  error: "border-l-danger",
  info: "border-l-brand",
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counter = useRef(0);

  const remove = useCallback((id: number) => setToasts((prev) => prev.filter((t) => t.id !== id)), []);

  const push = useCallback(
    (t: { title: string; description?: string; variant?: ToastVariant; duration?: number }) => {
      const id = ++counter.current;
      const variant = t.variant ?? "info";
      setToasts((prev) => [...prev, { id, title: t.title, description: t.description, variant }]);
      const duration = t.duration ?? 4200;
      window.setTimeout(() => remove(id), duration);
    },
    [remove],
  );

  const api = useMemo<ToastApi>(
    () => ({
      toast: push,
      success: (title, description) => push({ title, description, variant: "success" }),
      error: (title, description) => push({ title, description, variant: "error" }),
      info: (title, description) => push({ title, description, variant: "info" }),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      {typeof document !== "undefined" &&
        createPortal(
          <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[90] flex flex-col items-center gap-2 p-4 sm:items-end sm:p-6" aria-live="polite" aria-atomic="false">
            <AnimatePresence>
              {toasts.map((t) => (
                <motion.div
                  key={t.id}
                  layout
                  initial={{ opacity: 0, y: 20, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, x: 40, scale: 0.96 }}
                  transition={{ type: "spring", stiffness: 420, damping: 34 }}
                  className={cn(
                    "card pointer-events-auto flex w-full max-w-sm items-start gap-3 border-l-4 px-4 py-3 shadow-pop",
                    ACCENT[t.variant],
                  )}
                  role="status"
                >
                  <span className="mt-0.5 shrink-0">{ICONS[t.variant]}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-ink">{t.title}</p>
                    {t.description && <p className="mt-0.5 text-xs text-muted">{t.description}</p>}
                  </div>
                  <button
                    type="button"
                    aria-label="Dismiss"
                    onClick={() => remove(t.id)}
                    className="focus-ring -mr-1 rounded p-0.5 text-muted transition hover:text-ink"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>,
          document.body,
        )}
    </ToastContext.Provider>
  );
}
