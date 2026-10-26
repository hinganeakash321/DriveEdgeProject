"use client";

import { useId, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { EASE } from "@/lib/motion";

/* ---------------- Tabs with animated active indicator (layoutId) ---------------- */
export type TabItem = { id: string; label: React.ReactNode; content: React.ReactNode };

export function Tabs({ items, initial, className }: { items: TabItem[]; initial?: string; className?: string }) {
  const [active, setActive] = useState(initial ?? items[0]?.id);
  const layoutId = useId();
  const reduce = useReducedMotion();
  const current = items.find((t) => t.id === active) ?? items[0];

  return (
    <div className={className}>
      <div role="tablist" aria-orientation="horizontal" className="relative flex gap-1 overflow-x-auto rounded-xl border border-line bg-soft/60 p-1">
        {items.map((t) => {
          const selected = t.id === active;
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={selected}
              onClick={() => setActive(t.id)}
              className={cn(
                "focus-ring relative z-10 whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                selected ? "text-white" : "text-muted hover:text-ink",
              )}
            >
              {selected && (
                <motion.span
                  layoutId={`tab-${layoutId}`}
                  className="absolute inset-0 -z-10 rounded-lg bg-gradient-to-r from-brand to-teal shadow-sm"
                  transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 36 }}
                />
              )}
              {t.label}
            </button>
          );
        })}
      </div>
      <div className="mt-4">
        <AnimatePresence mode="wait">
          <motion.div
            key={current?.id}
            role="tabpanel"
            initial={reduce ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? undefined : { opacity: 0, y: -8 }}
            transition={{ duration: 0.22, ease: EASE }}
          >
            {current?.content}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

/* ---------------- Accordion ---------------- */
export function Accordion({ items, className }: { items: { id: string; title: React.ReactNode; content: React.ReactNode }[]; className?: string }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div className={cn("divide-y divide-line overflow-hidden rounded-xl border border-line", className)}>
      {items.map((it) => {
        const isOpen = open === it.id;
        return (
          <div key={it.id}>
            <button
              type="button"
              aria-expanded={isOpen}
              onClick={() => setOpen(isOpen ? null : it.id)}
              className="focus-ring flex w-full items-center justify-between gap-4 bg-card px-4 py-3.5 text-left text-sm font-medium text-ink transition hover:bg-soft/50"
            >
              <span>{it.title}</span>
              <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted transition-transform duration-300", isOpen && "rotate-180")} />
            </button>
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.28, ease: EASE }}
                  className="overflow-hidden bg-soft/30"
                >
                  <div className="px-4 py-3 text-sm text-muted">{it.content}</div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}

/* ---------------- Tooltip (hover/focus) ---------------- */
export function Tooltip({ label, children, side = "top" }: { label: string; children: React.ReactNode; side?: "top" | "bottom" }) {
  const [show, setShow] = useState(false);
  const pos = side === "top" ? "bottom-full mb-2" : "top-full mt-2";
  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      onFocus={() => setShow(true)}
      onBlur={() => setShow(false)}
    >
      {children}
      <AnimatePresence>
        {show && (
          <motion.span
            role="tooltip"
            initial={{ opacity: 0, y: side === "top" ? 4 : -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: side === "top" ? 4 : -4 }}
            transition={{ duration: 0.15 }}
            className={cn(
              "pointer-events-none absolute left-1/2 z-50 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-xs font-medium text-white shadow-pop",
              pos,
            )}
          >
            {label}
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}
