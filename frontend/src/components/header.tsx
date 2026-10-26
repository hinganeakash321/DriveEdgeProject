"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Car, Menu, User as UserIcon, LogOut, Sun, Moon } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { Drawer } from "@/components/overlay";

function ThemeToggle() {
  const { theme, toggle } = useTheme();
  return (
    <button
      onClick={toggle}
      className="focus-ring rounded-lg p-2 text-ink transition-colors hover:bg-soft"
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      title={theme === "dark" ? "Light mode" : "Dark mode"}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={theme}
          initial={{ rotate: -90, opacity: 0, scale: 0.6 }}
          animate={{ rotate: 0, opacity: 1, scale: 1 }}
          exit={{ rotate: 90, opacity: 0, scale: 0.6 }}
          transition={{ duration: 0.2 }}
          className="block"
        >
          {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}

type NavItem = { href: string; label: string };

// The consumer "Home" target depends on auth: guests land on the common landing
// page (/), signed-in customers land on their marketplace home (/browse).
// Find Dealers, Compare Quotes and AI Assistant are only shown once signed in.
function consumerNav(isAuthenticated: boolean): NavItem[] {
  return [
    { href: isAuthenticated ? "/browse" : "/", label: "Home" },
    { href: "/cars", label: "All Cars" },
    ...(isAuthenticated ? [{ href: "/dealers", label: "Find Dealers" }] : []),
    { href: "/compare-cars", label: "Compare Cars" },
    ...(isAuthenticated
      ? [
          { href: "/compare-quotes", label: "Compare Quotes" },
          { href: "/ai-assistant", label: "AI Assistant" },
        ]
      : []),
  ];
}

const DEALER_NAV: NavItem[] = [
  { href: "/dealer", label: "Dashboard" },
  { href: "/dealer/enquiries", label: "Enquiries" },
  { href: "/dealer/quotations", label: "Quotations" },
  { href: "/dealer/profile", label: "Profile" },
  { href: "/ai-assistant", label: "AI Assistant" },
];

const ADMIN_NAV: NavItem[] = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/vehicles", label: "Catalogue" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/dealers", label: "Dealers" },
  { href: "/admin/enquiries", label: "Enquiries" },
  { href: "/admin/quotations", label: "Quotations" },
  { href: "/admin/audit", label: "Audit" },
];

function navForRole(role: string | undefined, isAuthenticated: boolean): NavItem[] {
  if (role === "dealer") return DEALER_NAV;
  if (role === "admin") return ADMIN_NAV;
  return consumerNav(isAuthenticated);
}

function dashboardHref(role?: string) {
  if (role === "dealer") return "/dealer";
  if (role === "admin") return "/admin";
  return "/dashboard";
}

// The brand/home link keeps each role in their own space: dealers/admins in
// their workspace, signed-in customers on the marketplace, guests on the landing.
function homeHref(role: string | undefined, isAuthenticated: boolean) {
  if (role === "dealer") return "/dealer";
  if (role === "admin") return "/admin";
  return isAuthenticated ? "/browse" : "/";
}

function isActive(pathname: string, href: string) {
  if (href === "/" || href === "/dealer" || href === "/admin") return pathname === href;
  return pathname.startsWith(href);
}

export function Header() {
  const pathname = usePathname();
  const { user, logout, loading } = useAuth();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const indicatorId = useId();

  // Default to the consumer nav until auth resolves to avoid flashing wrong tabs.
  const role = loading ? undefined : user?.role;
  const isAuthenticated = !loading && !!user;
  const nav = navForRole(role, isAuthenticated);

  // Scroll-aware chrome: tighten padding + strengthen blur/shadow after scroll.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close the mobile drawer whenever the route changes.
  useEffect(() => setOpen(false), [pathname]);

  return (
    <header
      className={cn(
        "sticky top-0 z-40 border-b transition-all duration-300",
        scrolled ? "border-line bg-card/80 shadow-card backdrop-blur-xl" : "border-transparent bg-card/50 backdrop-blur-md",
      )}
    >
      <div className={cn("container-xl flex items-center justify-between gap-4 transition-all duration-300", scrolled ? "h-14" : "h-16")}>
        <Link href={homeHref(role, isAuthenticated)} className="group flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-brand to-teal text-white shadow-glow transition-transform group-hover:scale-105 group-hover:rotate-3">
            <Car className="h-5 w-5" />
          </span>
          <span className="text-lg font-bold tracking-tight text-navy">DriveEdge</span>
        </Link>

        <nav className="hidden items-center gap-1 lg:flex">
          {nav.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "focus-ring relative rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active ? "text-brand-700" : "text-ink hover:bg-soft",
                )}
              >
                {active && (
                  <motion.span
                    layoutId={`nav-${indicatorId}`}
                    className="absolute inset-0 -z-10 rounded-lg bg-brand-50"
                    transition={{ type: "spring", stiffness: 420, damping: 36 }}
                  />
                )}
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          <ThemeToggle />
          {user ? (
            <>
              <Link href={dashboardHref(user.role)} className="btn-outline">
                <UserIcon className="h-4 w-4" />
                {user.name.split(" ")[0]}
              </Link>
              <button onClick={logout} className="btn-ghost" aria-label="Log out">
                <LogOut className="h-4 w-4" />
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="btn-ghost">
                Login
              </Link>
              <Link href="/register" className="btn-primary">
                Sign Up
              </Link>
            </>
          )}
        </div>

        <div className="flex items-center gap-1 lg:hidden">
          <ThemeToggle />
          <button
            className="focus-ring rounded-lg p-2 text-ink transition-colors hover:bg-soft"
            onClick={() => setOpen(true)}
            aria-label="Open menu"
            aria-expanded={open}
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </div>

      <Drawer open={open} onClose={() => setOpen(false)} side="right" title="Menu">
        <nav className="flex flex-col p-3">
          {nav.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={cn(
                  "rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  active ? "bg-brand-50 text-brand-700" : "text-ink hover:bg-soft",
                )}
              >
                {item.label}
              </Link>
            );
          })}
          <div className="mt-3 flex gap-2 border-t border-line pt-3">
            {user ? (
              <>
                <Link href={dashboardHref(user.role)} onClick={() => setOpen(false)} className="btn-outline flex-1">
                  Dashboard
                </Link>
                <button onClick={() => { logout(); setOpen(false); }} className="btn-ghost" aria-label="Log out">
                  <LogOut className="h-4 w-4" />
                </button>
              </>
            ) : (
              <>
                <Link href="/login" onClick={() => setOpen(false)} className="btn-outline flex-1">
                  Login
                </Link>
                <Link href="/register" onClick={() => setOpen(false)} className="btn-primary flex-1">
                  Sign Up
                </Link>
              </>
            )}
          </div>
        </nav>
      </Drawer>
    </header>
  );
}
