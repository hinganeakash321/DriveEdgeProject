import type { Config } from "tailwindcss";

// Semantic tokens (page/card/ink/navy/muted/line/soft) are driven by CSS
// variables defined in globals.css so they adapt to light/dark themes.
// Brand/teal/status colors are intentionally fixed across themes.
const rgb = (v: string) => `rgb(var(${v}) / <alpha-value>)`;

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: rgb("--c-navy"),
        // Fixed dark surface for hero/branded bands (does not flip in dark mode).
        hero: "#101828",
        ink: rgb("--c-ink"),
        muted: rgb("--c-muted"),
        line: rgb("--c-line"),
        page: rgb("--c-page"),
        card: rgb("--c-card"),
        soft: rgb("--c-soft"),
        brand: {
          DEFAULT: "#2563EB",
          50: rgb("--c-brand-50"),
          100: "#DBEAFE",
          600: "#2563EB",
          700: "#1D4ED8",
        },
        teal: {
          DEFAULT: "#14B8A6",
          50: rgb("--c-teal-50"),
        },
        success: "#16A34A",
        warning: "#F59E0B",
        danger: "#DC2626",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 3px 0 rgb(16 24 40 / 0.08), 0 1px 2px -1px rgb(16 24 40 / 0.06)",
        pop: "0 18px 40px -12px rgb(16 24 40 / 0.28)",
        glow: "0 8px 24px -6px rgb(37 99 235 / 0.45)",
      },
      borderRadius: {
        xl: "0.875rem",
      },
    },
  },
  plugins: [],
};

export default config;
