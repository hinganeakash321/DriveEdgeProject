"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Car, ShieldCheck, Sparkles, Handshake } from "lucide-react";
import { EASE } from "@/lib/motion";

const HIGHLIGHTS = [
  { icon: Sparkles, text: "AI-guided recommendations tailored to your budget" },
  { icon: Handshake, text: "Competitive on-road quotations from multiple dealers" },
  { icon: ShieldCheck, text: "Transparent price breakdowns, no hidden charges" },
];

/**
 * Split-screen branded auth layout: cinematic dark marketing panel on the left,
 * the form card on the right. Used by both login and register.
 */
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="container-xl grid min-h-[calc(100vh-4rem)] items-stretch gap-8 py-10 lg:grid-cols-2 lg:gap-12">
      {/* Marketing panel */}
      <motion.aside
        initial={{ opacity: 0, x: -24 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6, ease: EASE }}
        className="hero-dark hero-grid relative hidden overflow-hidden rounded-3xl p-10 lg:flex lg:flex-col lg:justify-between"
      >
        <span className="glow-blob -right-16 -top-16 h-56 w-56 bg-teal/20" />
        <span className="glow-blob -left-16 bottom-0 h-56 w-56 bg-brand/25" />
        <Link href="/" className="relative flex items-center gap-2 text-white">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-brand to-teal shadow-glow">
            <Car className="h-5 w-5" />
          </span>
          <span className="text-lg font-bold tracking-tight">DriveEdge</span>
        </Link>

        <div className="relative">
          <h2 className="text-3xl font-extrabold leading-tight text-white">
            Find your car.
            <br />
            <span className="bg-gradient-to-r from-teal via-brand to-teal bg-clip-text text-transparent">Make a smarter deal.</span>
          </h2>
          <ul className="mt-8 space-y-4">
            {HIGHLIGHTS.map((h, i) => (
              <motion.li
                key={h.text}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.3 + i * 0.1, ease: EASE }}
                className="flex items-start gap-3 text-sm text-white/80"
              >
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/10 text-teal">
                  <h.icon className="h-4 w-4" />
                </span>
                {h.text}
              </motion.li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-white/50">Trusted by customers and dealerships across India.</p>
      </motion.aside>

      {/* Form panel */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1, ease: EASE }}
        className="flex items-center justify-center"
      >
        <div className="w-full max-w-md">{children}</div>
      </motion.div>
    </div>
  );
}
