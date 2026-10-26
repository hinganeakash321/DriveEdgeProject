import type { ReactNode } from "react";

/** Shared shell for static informational pages (privacy, terms, contact). */
export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated?: string;
  children: ReactNode;
}) {
  return (
    <div className="container-xl max-w-3xl py-12">
      <h1 className="text-3xl font-bold text-navy">{title}</h1>
      {updated && <p className="mt-1 text-sm text-muted">{updated}</p>}
      <div className="mt-8 space-y-8 text-sm leading-relaxed text-ink">{children}</div>
    </div>
  );
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="text-lg font-semibold text-navy">{title}</h2>
      <div className="mt-2 space-y-2 text-ink">{children}</div>
    </section>
  );
}
