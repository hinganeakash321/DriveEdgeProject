import type { Metadata } from "next";
import { Mail, MessageSquare, Building2 } from "lucide-react";
import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Contact — DriveEdge",
  description: "Get in touch with the DriveEdge team for support, dealership onboarding, or general enquiries.",
};

const CHANNELS = [
  {
    icon: Mail,
    title: "Customer support",
    body: "Questions about enquiries, quotations, or your account.",
    action: { label: "support@driveedge.in", href: "mailto:support@driveedge.in" },
  },
  {
    icon: Building2,
    title: "Dealership onboarding",
    body: "Want to list your dealership and receive qualified leads?",
    action: { label: "dealers@driveedge.in", href: "mailto:dealers@driveedge.in" },
  },
  {
    icon: MessageSquare,
    title: "Press & partnerships",
    body: "Media, partnerships, and everything else.",
    action: { label: "hello@driveedge.in", href: "mailto:hello@driveedge.in" },
  },
];

export default function ContactPage() {
  return (
    <LegalPage title="Contact us" updated="We usually reply within 1–2 business days.">
      <div className="grid gap-4 sm:grid-cols-3">
        {CHANNELS.map((c) => (
          <div key={c.title} className="card p-5">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand">
              <c.icon className="h-5 w-5" />
            </span>
            <h3 className="mt-3 font-semibold text-navy">{c.title}</h3>
            <p className="mt-1 text-sm text-muted">{c.body}</p>
            <a href={c.action.href} className="mt-3 inline-block text-sm font-semibold text-brand hover:underline">
              {c.action.label}
            </a>
          </div>
        ))}
      </div>
    </LegalPage>
  );
}
