"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Search, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { api, buildQuery } from "@/lib/api";
import type { FilterOptions } from "@/lib/types";
import { titleCase } from "@/lib/utils";

const BUDGETS = [
  { label: "Any budget", max: "" },
  { label: "Under ₹5 lakh", max: "500000" },
  { label: "₹5–10 lakh", max: "1000000" },
  { label: "₹10–15 lakh", max: "1500000" },
  { label: "₹15–20 lakh", max: "2000000" },
  { label: "Above ₹20 lakh", max: "" },
];

export function HomeHero() {
  const router = useRouter();
  const [opts, setOpts] = useState<FilterOptions | null>(null);
  const [q, setQ] = useState("");
  const [manufacturer, setManufacturer] = useState("");
  const [budget, setBudget] = useState("");
  const [bodyType, setBodyType] = useState("");

  useEffect(() => {
    api.get<FilterOptions>("/api/cars/filters").then(setOpts).catch(() => {});
  }, []);

  const search = () => {
    const query = buildQuery({ q, manufacturer_id: manufacturer, max_price: budget, body_type: bodyType });
    router.push(`/cars${query}`);
  };

  return (
    <section className="hero-dark hero-grid">
      <span className="glow-blob -right-20 -top-24 h-72 w-72 bg-teal/20" />
      <span className="glow-blob -left-24 top-10 h-72 w-72 bg-brand/25" />
      <div className="container-xl relative py-16 md:py-24">
        <motion.div
          className="max-w-3xl"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        >
          <h1 className="text-3xl font-extrabold leading-[1.1] tracking-tight sm:text-4xl md:text-6xl">
            Find Your Next Car. <span className="bg-gradient-to-r from-teal via-brand to-teal bg-clip-text text-transparent">Make a Smarter Deal.</span>
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-white/70">
            Explore cars across India, compare specifications, discover dealerships, and get
            competitive quotations with AI-powered guidance.
          </p>
        </motion.div>

        <motion.div
          className="card mt-8 p-4 text-ink shadow-pop md:p-5"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="grid gap-3 md:grid-cols-5">
            <div className="md:col-span-2">
              <label className="label">Search</label>
              <input
                className="input"
                placeholder="Search by model or brand"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && search()}
              />
            </div>
            <div>
              <label className="label">Manufacturer</label>
              <select className="input" value={manufacturer} onChange={(e) => setManufacturer(e.target.value)}>
                <option value="">All</option>
                {opts?.manufacturers.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Budget</label>
              <select className="input" value={budget} onChange={(e) => setBudget(e.target.value)}>
                {BUDGETS.map((b) => (
                  <option key={b.label} value={b.max}>{b.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Body type</label>
              <select className="input" value={bodyType} onChange={(e) => setBodyType(e.target.value)}>
                <option value="">All</option>
                {opts?.body_types.map((b) => (
                  <option key={b} value={b}>{titleCase(b)}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <button onClick={search} className="btn-gradient">
              <Search className="h-4 w-4" /> Search Cars
            </button>
            <Link href="/ai-car-finder" className="btn-outline">
              <Sparkles className="h-4 w-4" /> AI Car Finder
            </Link>
          </div>
        </motion.div>

        {opts && (
          <p className="mt-4 text-sm text-white/60">
            {opts.total_models} models across {opts.total_manufacturers} manufacturers in the DriveEdge catalogue.
          </p>
        )}
      </div>
    </section>
  );
}
