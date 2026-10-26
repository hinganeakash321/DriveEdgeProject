import Link from "next/link";
import { Car } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-line bg-card">
      <div className="container-xl grid gap-8 py-12 md:grid-cols-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-hero text-white">
              <Car className="h-4 w-4" />
            </span>
            <span className="font-bold text-navy">DriveEdge</span>
          </div>
          <p className="mt-3 text-sm text-muted">
            Find Your Car. Compare Dealers. Buy with Confidence.
          </p>
        </div>
        <div>
          <h4 className="text-sm font-semibold text-navy">Explore</h4>
          <ul className="mt-3 space-y-2 text-sm text-muted">
            <li><Link href="/cars" className="hover:text-brand">All Cars</Link></li>
            <li><Link href="/dealers" className="hover:text-brand">Find Dealers</Link></li>
            <li><Link href="/compare-cars" className="hover:text-brand">Compare Cars</Link></li>
            <li><Link href="/ai-car-finder" className="hover:text-brand">AI Car Finder</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="text-sm font-semibold text-navy">Company</h4>
          <ul className="mt-3 space-y-2 text-sm text-muted">
            <li><Link href="/" className="hover:text-brand">About</Link></li>
            <li><Link href="/contact" className="hover:text-brand">Contact</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="text-sm font-semibold text-navy">Legal</h4>
          <ul className="mt-3 space-y-2 text-sm text-muted">
            <li><Link href="/privacy" className="hover:text-brand">Privacy Policy</Link></li>
            <li><Link href="/terms" className="hover:text-brand">Terms &amp; Conditions</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-line">
        <div className="container-xl py-4 text-xs text-muted">
          Prices and specifications are indicative and may change. Confirm current details with the
          manufacturer or authorized dealership before purchasing. &copy; {new Date().getFullYear()} DriveEdge.
        </div>
      </div>
    </footer>
  );
}
