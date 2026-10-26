"use client";

import type { ReactNode } from "react";

export interface DataColumn<T> {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  /** Extra classes for the desktop <td>. */
  tdClassName?: string;
  /** Extra classes for the mobile value cell. */
  mobileValueClassName?: string;
  /** Render the cell full-width on mobile without a label (e.g. action buttons). */
  fullWidthOnMobile?: boolean;
}

/**
 * Responsive data table: a real <table> from md+ (horizontally scrollable as a
 * last resort) and a stacked card list on mobile, where each row becomes a card
 * with label/value pairs. Keeps data readable on phones without tiny text or a
 * sideways scroll.
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  minWidthClass = "min-w-[640px]",
  mobileTitle,
  className,
  bare = false,
}: {
  columns: DataColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string | number;
  minWidthClass?: string;
  /** Optional heading line shown at the top of each mobile card. */
  mobileTitle?: (row: T) => ReactNode;
  className?: string;
  /** Omit the .card wrapper on the desktop table (use when already inside a card). */
  bare?: boolean;
}) {
  return (
    <div className={className}>
      {/* Desktop / tablet: table */}
      <div className={`${bare ? "" : "card "}hidden overflow-x-auto md:block`}>
        <table className={`w-full ${minWidthClass} text-sm`}>
          <thead>
            <tr className="border-b border-line text-left text-muted">
              {columns.map((c) => (
                <th key={c.key} className="p-4 font-medium">
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={rowKey(row)} className="border-b border-line/60 transition-colors hover:bg-soft/50">
                {columns.map((c) => (
                  <td key={c.key} className={`p-4 ${c.tdClassName ?? ""}`}>
                    {c.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: stacked cards */}
      <div className="space-y-3 md:hidden">
        {rows.map((row) => (
          <div key={rowKey(row)} className="rounded-xl border border-line bg-card p-4">
            {mobileTitle ? (
              <div className="mb-3 border-b border-line/60 pb-2 font-semibold text-ink">{mobileTitle(row)}</div>
            ) : null}
            <dl className="space-y-2">
              {columns.map((c) =>
                c.fullWidthOnMobile ? (
                  <div key={c.key} className="pt-1">
                    {c.cell(row)}
                  </div>
                ) : (
                  <div key={c.key} className="flex items-center justify-between gap-3">
                    <dt className="shrink-0 text-xs font-medium uppercase tracking-wide text-muted">{c.header}</dt>
                    <dd className={`text-right text-sm text-ink ${c.mobileValueClassName ?? ""}`}>{c.cell(row)}</dd>
                  </div>
                )
              )}
            </dl>
          </div>
        ))}
      </div>
    </div>
  );
}
