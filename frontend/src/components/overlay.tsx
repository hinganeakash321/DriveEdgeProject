"use client";

import { useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { modalBackdrop, modalPanel, drawerPanel } from "@/lib/motion";

/* Focus-trap + Escape + body scroll-lock shared by Modal and Drawer. */
function useOverlayBehavior(open: boolean, onClose: () => void) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Move focus into the panel.
    const t = window.setTimeout(() => {
      const panel = panelRef.current;
      if (!panel) return;
      const focusable = panel.querySelector<HTMLElement>(
        'a[href],button:not([disabled]),textarea,input,select,[tabindex]:not([tabindex="-1"])',
      );
      (focusable ?? panel).focus();
    }, 20);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const panel = panelRef.current;
      if (!panel) return;
      const nodes = Array.from(
        panel.querySelectorAll<HTMLElement>(
          'a[href],button:not([disabled]),textarea,input,select,[tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => el.offsetParent !== null);
      if (nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener("keydown", onKey, true);
      document.body.style.overflow = prevOverflow;
      previouslyFocused.current?.focus?.();
    };
  }, [open, onClose]);

  return panelRef;
}

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  className,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  const panelRef = useOverlayBehavior(open, onClose);
  const onBackdrop = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) onClose();
    },
    [onClose],
  );

  if (typeof document === "undefined") return null;
  const sizes = { sm: "max-w-sm", md: "max-w-lg", lg: "max-w-2xl", xl: "max-w-4xl" } as const;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[70] flex items-center justify-center p-4"
          variants={modalBackdrop}
          initial="hidden"
          animate="show"
          exit="exit"
          onMouseDown={onBackdrop}
        >
          <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            tabIndex={-1}
            variants={modalPanel}
            className={cn(
              "card relative z-10 flex w-full flex-col overflow-hidden rounded-2xl shadow-pop focus:outline-none",
              sizes[size],
              className,
            )}
          >
            {(title || description) && (
              <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
                <div>
                  {title && <h2 className="text-lg font-semibold text-navy">{title}</h2>}
                  {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close dialog"
                  className="focus-ring -mr-1 rounded-lg p-1.5 text-muted transition hover:bg-soft hover:text-ink"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            )}
            <div className="max-h-[70vh] overflow-y-auto px-5 py-4">{children}</div>
            {footer && <div className="border-t border-line bg-soft/40 px-5 py-3">{footer}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

export function Drawer({
  open,
  onClose,
  title,
  children,
  side = "right",
  className,
}: {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children: React.ReactNode;
  side?: "left" | "right" | "bottom";
  className?: string;
}) {
  const panelRef = useOverlayBehavior(open, onClose);
  if (typeof document === "undefined") return null;

  const sidePos =
    side === "left"
      ? "left-0 top-0 h-full w-[88%] max-w-sm"
      : side === "right"
        ? "right-0 top-0 h-full w-[88%] max-w-sm"
        : "inset-x-0 bottom-0 max-h-[85vh] w-full rounded-t-2xl";

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[70]"
          variants={modalBackdrop}
          initial="hidden"
          animate="show"
          exit="exit"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            tabIndex={-1}
            variants={drawerPanel(side)}
            initial="hidden"
            animate="show"
            exit="exit"
            className={cn("absolute flex flex-col border-line bg-card shadow-pop focus:outline-none", sidePos, className)}
          >
            {title && (
              <div className="flex items-center justify-between border-b border-line px-5 py-4">
                <h2 className="text-base font-semibold text-navy">{title}</h2>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close"
                  className="focus-ring rounded-lg p-1.5 text-muted transition hover:bg-soft hover:text-ink"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            )}
            <div className="flex-1 overflow-y-auto">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
