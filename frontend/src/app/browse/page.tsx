import Link from "next/link";
import {
  Car,
  Search,
  GitCompare,
  MapPin,
  FileText,
  Sparkles,
  ShieldCheck,
  Gauge,
  Handshake,
} from "lucide-react";
import { HomeHero } from "@/components/home-hero";
import { BestOfferKpi } from "@/components/best-offer-kpi";
import { ManufacturerStrip } from "@/components/manufacturer-strip";
import { PopularCars } from "@/components/popular-cars";
import { DealerStrip } from "@/components/dealer-strip";

export const metadata = {
  title: "Browse Cars - DriveEdge",
  description:
    "Browse the DriveEdge catalogue, compare specifications and dealership quotations, and discover dealers near you.",
};

const QUICK_ACTIONS = [
  { href: "/cars", label: "Explore All Cars", icon: Car },
  { href: "/compare-cars", label: "Compare Cars", icon: GitCompare },
  { href: "/dealers", label: "Find Dealers", icon: MapPin },
  { href: "/compare-quotes", label: "Request Quotations", icon: FileText },
  { href: "/ai-car-finder", label: "AI Car Finder", icon: Sparkles },
];

const STEPS = [
  { title: "Discover cars", desc: "Browse the catalogue, filter by budget and body type, and compare specifications.", icon: Search },
  { title: "Compare dealership quotations", desc: "Create an enquiry and receive competitive on-road quotations from multiple dealers.", icon: Handshake },
  { title: "Make an informed decision", desc: "Compare transparent price breakdowns and pick the offer that suits you.", icon: ShieldCheck },
];

const TRUST = [
  { title: "Vehicle comparison", icon: GitCompare },
  { title: "Dealer discovery", icon: MapPin },
  { title: "Multi-dealer quotations", icon: FileText },
  { title: "Enquiry tracking", icon: Gauge },
  { title: "AI-assisted recommendations", icon: Sparkles },
  { title: "Transparent price breakdowns", icon: ShieldCheck },
];

export default function BrowsePage() {
  return (
    <div>
      {/* Personalized best offer first (logged-in customers only) */}
      <BestOfferKpi />

      <HomeHero />

      {/* Quick actions */}
      <section className="container-xl -mt-8 relative z-10">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {QUICK_ACTIONS.map((a) => (
            <Link key={a.href} href={a.href} className="card card-hover flex flex-col items-center gap-2 rounded-2xl p-4 text-center">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand to-teal text-white shadow-glow">
                <a.icon className="h-5 w-5" />
              </span>
              <span className="text-sm font-medium text-ink">{a.label}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* Manufacturers */}
      <section className="container-xl py-14">
        <ManufacturerStrip />
      </section>

      {/* Popular cars */}
      <section className="bg-card py-14">
        <div className="container-xl">
          <PopularCars />
        </div>
      </section>

      {/* AI finder */}
      <section className="container-xl py-14">
        <div className="hero-dark hero-grid rounded-2xl p-8 md:p-12">
          <span className="glow-blob -right-16 -top-16 h-56 w-56 bg-teal/20" />
          <div className="relative max-w-2xl">
            <span className="chip border-white/20 bg-white/10 text-teal">
              <Sparkles className="h-3.5 w-3.5" /> AI Car Finder
            </span>
            <h2 className="mt-4 text-3xl font-bold text-white">Not Sure Which Car Fits You?</h2>
            <p className="mt-3 text-white/70">
              Tell us your budget, family needs, driving habits, and preferences. DriveEdge will help
              you discover suitable vehicles from our live catalogue.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/ai-assistant" className="btn-gradient">
                Find My Perfect Car
              </Link>
              <Link href="/ai-car-finder" className="btn-outline border-white/30 bg-white/10 text-white hover:bg-white/20">
                Use the guided finder
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Dealers */}
      <section className="bg-card py-14">
        <div className="container-xl">
          <DealerStrip />
        </div>
      </section>

      {/* How it works */}
      <section className="container-xl py-14">
        <h2 className="text-center text-2xl font-bold text-navy">How It Works</h2>
        <div className="mt-8 grid gap-6 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <div key={s.title} className="card p-6">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand">
                <s.icon className="h-5 w-5" />
              </span>
              <h3 className="mt-4 text-lg font-semibold text-navy">
                {i + 1}. {s.title}
              </h3>
              <p className="mt-2 text-sm text-muted">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Trust */}
      <section className="bg-card py-14">
        <div className="container-xl">
          <h2 className="text-center text-2xl font-bold text-navy">Built for Transparency</h2>
          <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
            {TRUST.map((t) => (
              <div key={t.title} className="card flex flex-col items-center gap-2 p-5 text-center">
                <t.icon className="h-6 w-6 text-teal" />
                <span className="text-sm font-medium text-ink">{t.title}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
