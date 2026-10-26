"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Car,
  Search,
  GitCompare,
  MapPin,
  FileText,
  Sparkles,
  ShieldCheck,
  Handshake,
  Users,
  Store,
  BarChart3,
  Inbox,
  ArrowRight,
  Star,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import type { FilterOptions, Paged, VehicleCard as VehicleCardType } from "@/lib/types";
import { formatPriceRange } from "@/lib/utils";
import { FadeIn, Stagger, StaggerItem, AnimatedNumber } from "@/components/ui";

function homeHrefFor(role?: string) {
  if (role === "dealer") return "/dealer";
  if (role === "admin") return "/admin";
  return "/browse";
}

const CUSTOMER_FEATURES = [
  { icon: Search, text: "Browse a catalogue of cars across India and filter by budget and body type" },
  { icon: GitCompare, text: "Compare specifications side by side to shortlist the right car" },
  { icon: FileText, text: "Request competitive on-road quotations from multiple dealers at once" },
  { icon: Sparkles, text: "Get AI-assisted recommendations tailored to your needs" },
];

const DEALER_FEATURES = [
  { icon: Inbox, text: "Receive and triage customer enquiries assigned to your dealership" },
  { icon: Handshake, text: "Send transparent on-road quotations and track their status" },
  { icon: Store, text: "Re-bid to improve your offer and win the deal" },
  { icon: BarChart3, text: "Dealer AI for performance insights and competitive pricing guidance" },
];

const STEPS = [
  { title: "Discover", desc: "Browse the catalogue, filter by budget and body type, and compare specifications.", icon: Search },
  { title: "Compare quotations", desc: "Create an enquiry and receive competitive on-road quotations from multiple dealers.", icon: Handshake },
  { title: "Decide with confidence", desc: "Compare transparent price breakdowns and pick the offer that suits you.", icon: ShieldCheck },
];

function HeroShowcase() {
  const [car, setCar] = useState<VehicleCardType | null>(null);

  useEffect(() => {
    api
      .get<Paged<VehicleCardType>>("/api/cars?page_size=6&sort=price_desc")
      .then((p) => {
        const withImg = p.items.find((c) => c.image_url) || p.items[0] || null;
        setCar(withImg);
      })
      .catch(() => {});
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.94, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.7, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
      className="relative"
    >
      <div className="card-glass-dark p-4 shadow-pop">
        <div className="relative flex h-56 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-slate-50 to-slate-200 sm:h-64">
          {car?.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={car.image_url} alt={`${car.manufacturer_name} ${car.model_name}`} className="h-full w-full object-contain p-4" />
          ) : (
            <Car className="h-16 w-16 text-slate-400" />
          )}
          {car?.body_type && (
            <span className="absolute left-3 top-3 inline-flex items-center rounded-full bg-slate-900/85 px-3 py-1 text-xs font-medium text-white shadow-sm backdrop-blur">{car.body_type}</span>
          )}
        </div>
        <div className="flex items-end justify-between px-1 pt-4 text-white">
          <div>
            <p className="text-xs uppercase tracking-wide text-white/60">{car?.manufacturer_name || "DriveEdge"}</p>
            <p className="text-lg font-bold">{car?.model_name || "Featured car"}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-white/60">Ex-showroom</p>
            <p className="font-bold text-teal">{car ? formatPriceRange(car.min_price, car.max_price) : "—"}</p>
          </div>
        </div>
      </div>

      {/* Floating accent card */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.5 }}
        className="absolute -bottom-5 -left-5 hidden rounded-xl bg-white p-3 shadow-pop sm:block"
      >
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-bold text-slate-900">Lowest price</p>
            <p className="text-xs text-slate-500">compared across dealers</p>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

export function Landing() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [opts, setOpts] = useState<FilterOptions | null>(null);

  // Already signed in? Load the role-appropriate workspace instead of marketing.
  useEffect(() => {
    if (!loading && user) {
      router.replace(homeHrefFor(user.role));
    }
  }, [loading, user, router]);

  useEffect(() => {
    api.get<FilterOptions>("/api/cars/filters").then(setOpts).catch(() => {});
  }, []);

  return (
    <div>
      {/* Cinematic hero */}
      <section className="hero-dark hero-grid">
        <span className="glow-blob -right-20 -top-24 h-72 w-72 bg-teal/20" />
        <span className="glow-blob -left-24 top-10 h-72 w-72 bg-brand/25" />
        <div className="container-xl relative grid items-center gap-12 py-20 lg:grid-cols-[1.1fr_0.9fr] lg:py-28">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          >
            <span className="chip border-white/15 bg-white/10 text-teal">
              <Sparkles className="h-3.5 w-3.5" /> AI-powered car marketplace for India
            </span>
            <h1 className="mt-5 text-3xl font-extrabold leading-[1.1] tracking-tight sm:text-4xl md:text-6xl">
              Find your car.
              <br />
              <span className="bg-gradient-to-r from-teal via-brand to-teal bg-clip-text text-transparent">
                Make a smarter deal.
              </span>
            </h1>
            <p className="mt-5 max-w-xl text-lg text-white/70">
              Discover cars across India, compare specifications, and collect competitive on-road
              quotations from multiple dealers — all in one place.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/browse" className="btn-gradient px-5 py-2.5 text-base">
                Explore cars <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="#choose" className="btn-outline border-white/25 bg-white/10 px-5 py-2.5 text-base text-white hover:bg-white/20">
                Get started
              </Link>
            </div>

            {/* Trust stats */}
            <div className="mt-10 grid max-w-md grid-cols-3 gap-4">
              {[
                { value: opts?.total_models ?? 92, label: "Models" },
                { value: opts?.total_manufacturers ?? 16, label: "Brands" },
                { value: 24, label: "Dealers" },
              ].map((s) => (
                <div key={s.label}>
                  <p className="text-3xl font-bold text-white">
                    <AnimatedNumber value={s.value} />+
                  </p>
                  <p className="text-xs uppercase tracking-wide text-white/55">{s.label}</p>
                </div>
              ))}
            </div>
          </motion.div>

          <HeroShowcase />
        </div>
      </section>

      {/* Role chooser */}
      <section id="choose" className="container-xl py-16">
        <FadeIn>
          <h2 className="text-center text-3xl font-bold tracking-tight text-navy">How would you like to use DriveEdge?</h2>
          <p className="mt-2 text-center text-muted">Choose your experience. Your account decides what you can access.</p>
        </FadeIn>

        <Stagger className="mt-10 grid gap-6 md:grid-cols-2">
          {/* Customers */}
          <StaggerItem>
            <div className="card card-hover flex h-full flex-col p-8">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-brand to-brand-700 text-white shadow-glow">
                <Users className="h-6 w-6" />
              </span>
              <h3 className="mt-4 text-xl font-bold text-navy">For Customers</h3>
              <p className="mt-1 text-sm text-muted">Find, compare and buy your next car.</p>
              <ul className="mt-5 flex-1 space-y-3">
                {CUSTOMER_FEATURES.map((f) => (
                  <li key={f.text} className="flex items-start gap-2.5 text-sm text-ink">
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-brand-50 text-brand">
                      <f.icon className="h-3.5 w-3.5" />
                    </span>
                    {f.text}
                  </li>
                ))}
              </ul>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link href="/login?role=customer" className="btn-gradient">
                  Continue as Customer <ArrowRight className="h-4 w-4" />
                </Link>
                <Link href="/browse" className="btn-outline">Browse without signing in</Link>
              </div>
            </div>
          </StaggerItem>

          {/* Dealers */}
          <StaggerItem>
            <div className="card card-hover flex h-full flex-col p-8">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-teal to-brand text-white shadow-glow">
                <Store className="h-6 w-6" />
              </span>
              <h3 className="mt-4 text-xl font-bold text-navy">For Dealers</h3>
              <p className="mt-1 text-sm text-muted">Grow your dealership with qualified leads.</p>
              <ul className="mt-5 flex-1 space-y-3">
                {DEALER_FEATURES.map((f) => (
                  <li key={f.text} className="flex items-start gap-2.5 text-sm text-ink">
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-teal/15 text-teal">
                      <f.icon className="h-3.5 w-3.5" />
                    </span>
                    {f.text}
                  </li>
                ))}
              </ul>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link href="/login?role=dealer" className="btn-gradient">
                  Continue as Dealer <ArrowRight className="h-4 w-4" />
                </Link>
                <Link href="/register?role=dealer" className="btn-outline">Register a dealership</Link>
              </div>
            </div>
          </StaggerItem>
        </Stagger>

        <p className="mt-8 text-center text-sm text-muted">
          New to DriveEdge? <Link href="/register" className="font-medium text-brand">Create an account</Link>
        </p>
      </section>

      {/* How it works */}
      <section className="bg-card py-16">
        <div className="container-xl">
          <FadeIn><h2 className="text-center text-3xl font-bold tracking-tight text-navy">How It Works</h2></FadeIn>
          <Stagger className="mt-8 grid gap-6 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <StaggerItem key={s.title}>
                <div className="card card-hover h-full p-6">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-brand to-teal text-white shadow-glow">
                    <s.icon className="h-5 w-5" />
                  </span>
                  <h3 className="mt-4 text-lg font-semibold text-navy">{i + 1}. {s.title}</h3>
                  <p className="mt-2 text-sm text-muted">{s.desc}</p>
                </div>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/* Trust */}
      <section className="container-xl py-16">
        <FadeIn><h2 className="text-center text-3xl font-bold tracking-tight text-navy">Built for Transparency</h2></FadeIn>
        <Stagger className="mx-auto mt-8 grid max-w-4xl grid-cols-2 gap-4 md:grid-cols-3">
          {[
            { title: "Vehicle comparison", icon: GitCompare },
            { title: "Dealer discovery", icon: MapPin },
            { title: "Multi-dealer quotations", icon: FileText },
            { title: "Transparent price breakdowns", icon: ShieldCheck },
            { title: "AI-assisted guidance", icon: Sparkles },
            { title: "Best-price bidding", icon: Star },
          ].map((t) => (
            <StaggerItem key={t.title}>
              <div className="card card-hover flex flex-col items-center gap-2 p-5 text-center">
                <t.icon className="h-6 w-6 text-teal" />
                <span className="text-sm font-medium text-ink">{t.title}</span>
              </div>
            </StaggerItem>
          ))}
        </Stagger>
      </section>
    </div>
  );
}
