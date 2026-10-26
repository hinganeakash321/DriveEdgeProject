import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format an INR amount (number or numeric string) into "₹7.50 lakh" / "₹1.20 crore". */
export function formatINR(value?: number | string | null): string {
  if (value === null || value === undefined || value === "") return "N/A";
  const n = typeof value === "string" ? parseFloat(value) : value;
  if (Number.isNaN(n)) return "N/A";
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)} crore`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(2)} lakh`;
  return `₹${n.toLocaleString("en-IN")}`;
}

export function formatPriceRange(min?: number | string | null, max?: number | string | null): string {
  if (!min && !max) return "Price on request";
  if (min && max && String(min) !== String(max)) {
    return `${formatINR(min)} - ${formatINR(max)}`;
  }
  return `${formatINR(min || max)} onwards`;
}

export function titleCase(s?: string | null): string {
  if (!s) return "";
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Grammatically-correct count label, e.g. `pluralize(1, "dealer") === "1 dealer"`,
 * `pluralize(3, "dealer") === "3 dealers"`. Pass an explicit plural for irregulars.
 */
export function pluralize(count: number, singular: string, plural?: string): string {
  const word = count === 1 ? singular : plural ?? `${singular}s`;
  return `${count} ${word}`;
}
