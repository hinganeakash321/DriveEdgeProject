"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export interface PortalTab {
  href: string;
  label: string;
}

export function PortalNav({ tabs }: { tabs: PortalTab[] }) {
  const pathname = usePathname();
  return (
    <nav className="mb-6 flex flex-wrap gap-1 border-b border-line">
      {tabs.map((t) => {
        const active = pathname === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition ${
              active
                ? "border-brand text-brand"
                : "border-transparent text-muted hover:text-ink"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
