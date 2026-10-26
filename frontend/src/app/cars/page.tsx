import { Suspense } from "react";
import { CarsBrowser } from "@/components/cars-browser";
import { LoadingBlock } from "@/components/ui";

export default function CarsPage() {
  return (
    <div className="container-xl py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-navy">Explore All Cars in India</h1>
        <p className="mt-1 text-muted">
          Discover cars across brands, compare specifications and variants, and find the right
          vehicle for your budget.
        </p>
      </div>
      <Suspense fallback={<LoadingBlock />}>
        <CarsBrowser />
      </Suspense>
    </div>
  );
}
