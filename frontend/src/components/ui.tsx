"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion, useScroll, useSpring, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { AlertCircle, ArrowUp, Inbox, Loader2 } from "lucide-react";
import { EASE, DURATION } from "@/lib/motion";

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn("h-5 w-5 animate-spin text-brand", className)} />;
}

/* ---- Motion primitives (all reduced-motion aware) ---- */

export function FadeIn({
  children,
  delay = 0,
  y = 12,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  y?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.45, delay, ease: EASE }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function ScaleIn({ children, delay = 0, className }: { children: React.ReactNode; delay?: number; className?: string }) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: DURATION.base, delay, ease: EASE }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function SlideIn({ children, from = "left", delay = 0, className }: { children: React.ReactNode; from?: "left" | "right"; delay?: number; className?: string }) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div
      initial={{ opacity: 0, x: from === "left" ? -24 : 24 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: DURATION.base, delay, ease: EASE }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function Stagger({ children, className }: { children: React.ReactNode; className?: string }) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-60px" }}
      variants={{ show: { transition: { staggerChildren: 0.07 } } }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({ children, className }: { children: React.ReactNode; className?: string }) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div
      variants={{ hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0 } }}
      transition={{ duration: DURATION.base, ease: EASE }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/** Word-by-word headline reveal. Renders a semantic heading-friendly span group. */
export function Reveal({ text, className, as: Tag = "span", delay = 0 }: { text: string; className?: string; as?: "span" | "h1" | "h2"; delay?: number }) {
  const reduce = useReducedMotion();
  if (reduce) return <Tag className={className}>{text}</Tag>;
  const words = text.split(" ");
  return (
    <Tag className={className}>
      {words.map((w, i) => (
        <span key={i} className="inline-block overflow-hidden align-bottom">
          <motion.span
            className="inline-block"
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.5, delay: delay + i * 0.06, ease: EASE }}
          >
            {w}&nbsp;
          </motion.span>
        </span>
      ))}
    </Tag>
  );
}

/** Count-up number used by KPI cards. Formats with an optional prefix/suffix. */
export function AnimatedNumber({
  value,
  prefix = "",
  suffix = "",
  decimals = 0,
  duration = 900,
}: {
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  duration?: number;
}) {
  const reduce = useReducedMotion();
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (reduce) {
      setDisplay(value);
      return;
    }
    let raf = 0;
    let cancelled = false;
    const start = performance.now();
    const tick = (now: number) => {
      if (cancelled) return;
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(value * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
      else setDisplay(value); // guarantee the exact final value
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [value, duration, reduce]);

  return (
    <span>
      {prefix}
      {display.toLocaleString("en-IN", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}
      {suffix}
    </span>
  );
}

export function LoadingBlock({ label = "Loading..." }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-muted">
      <Spinner /> <span className="text-sm">{label}</span>
    </div>
  );
}

export function EmptyState({ title, message, action }: { title: string; message?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-line bg-card py-16 text-center">
      <Inbox className="h-10 w-10 text-muted" />
      <h3 className="mt-4 text-base font-semibold text-ink">{title}</h3>
      {message && <p className="mt-1 max-w-md text-sm text-muted">{message}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ message }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-danger/20 bg-danger/5 py-12 text-center">
      <AlertCircle className="h-8 w-8 text-danger" />
      <p className="mt-3 text-sm font-medium text-danger">{message || "Something went wrong. Please try again."}</p>
    </div>
  );
}

export function SectionHeading({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-navy">{title}</h2>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function KpiCard({
  label,
  value,
  hint,
  icon,
  accent,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  icon?: React.ReactNode;
  accent?: boolean;
}) {
  // Animate plain numeric values with a count-up; pass strings/nodes through as-is.
  const rendered =
    typeof value === "number" ? <AnimatedNumber value={value} /> : value;
  return (
    <div className="card card-hover relative overflow-hidden p-5">
      {accent && (
        <span className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand to-teal" />
      )}
      <div className="flex items-start justify-between">
        <p className="text-sm font-medium text-muted">{label}</p>
        {icon && <span className="text-brand/70">{icon}</span>}
      </div>
      <p className="mt-2 text-3xl font-bold text-navy">{rendered}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    verified: "badge-success",
    submitted: "badge-success",
    preferred: "badge-success",
    quotation_submitted: "badge-success",
    pending: "badge-warning",
    requested: "badge-warning",
    sent_to_dealer: "badge-warning",
    draft: "badge-muted",
  };
  const cls = map[status] || "badge-muted";
  return <span className={cls}>{status.replace(/_/g, " ")}</span>;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("shimmer rounded-lg", className)} />;
}

/** Material-style click ripple. Drop inside any `relative overflow-hidden` button. */
export function Ripple({ color = "rgba(255,255,255,0.5)" }: { color?: string }) {
  const reduce = useReducedMotion();
  const [ripples, setRipples] = useState<{ id: number; x: number; y: number; size: number }[]>([]);
  const onDown = (e: React.PointerEvent<HTMLSpanElement>) => {
    if (reduce) return;
    const rect = (e.currentTarget.parentElement ?? e.currentTarget).getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const id = Date.now() + Math.random();
    setRipples((r) => [...r, { id, x: e.clientX - rect.left - size / 2, y: e.clientY - rect.top - size / 2, size }]);
    window.setTimeout(() => setRipples((r) => r.filter((x) => x.id !== id)), 600);
  };
  return (
    <span aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]" onPointerDown={onDown as unknown as React.PointerEventHandler}>
      <span className="pointer-events-auto absolute inset-0" onPointerDown={onDown} />
      <AnimatePresence>
        {ripples.map((r) => (
          <motion.span
            key={r.id}
            initial={{ opacity: 0.5, scale: 0 }}
            animate={{ opacity: 0, scale: 1 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            style={{ left: r.x, top: r.y, width: r.size, height: r.size, backgroundColor: color }}
            className="absolute rounded-full"
          />
        ))}
      </AnimatePresence>
    </span>
  );
}

/** Slim gradient reading-progress bar fixed under the header. */
export function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 140, damping: 30, mass: 0.3 });
  return (
    <motion.div
      aria-hidden
      style={{ scaleX }}
      className="fixed inset-x-0 top-0 z-[60] h-0.5 origin-left bg-gradient-to-r from-brand to-teal"
    />
  );
}

/** Floating back-to-top button that appears after scrolling down. */
export function BackToTop() {
  const reduce = useReducedMotion();
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 500);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <AnimatePresence>
      {visible && (
        <motion.button
          type="button"
          aria-label="Back to top"
          onClick={() => window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" })}
          initial={{ opacity: 0, scale: 0.8, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.8, y: 10 }}
          whileHover={{ y: -2 }}
          className="focus-ring fab-backtotop fixed z-40 flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-brand to-teal text-white shadow-glow"
        >
          <ArrowUp className="h-5 w-5" />
        </motion.button>
      )}
    </AnimatePresence>
  );
}
