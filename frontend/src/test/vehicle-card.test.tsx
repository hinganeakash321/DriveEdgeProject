import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { VehicleCard } from "@/components/vehicle-card";
import { AuthProvider } from "@/lib/auth";
import { FavouritesProvider } from "@/lib/favourites";
import type { VehicleCard as VehicleCardType } from "@/lib/types";

function renderWithProviders(ui: React.ReactElement) {
  return render(
    <AuthProvider>
      <FavouritesProvider>{ui}</FavouritesProvider>
    </AuthProvider>
  );
}

const sample: VehicleCardType = {
  id: 1,
  manufacturer_id: 1,
  manufacturer_name: "Tata Motors",
  model_name: "Nexon",
  slug: "tata-nexon",
  body_type: "Compact SUV",
  image_url: null,
  status: "available",
  min_price: "800000",
  max_price: "1300000",
  fuel_types: ["petrol", "diesel"],
  transmissions: ["manual", "amt"],
  seating_capacities: [5],
  variant_count: 2,
};

describe("VehicleCard", () => {
  it("renders model, manufacturer and price range", () => {
    renderWithProviders(<VehicleCard v={sample} />);
    expect(screen.getByText("Nexon")).toBeInTheDocument();
    expect(screen.getAllByText("Tata Motors").length).toBeGreaterThan(0);
    expect(screen.getByText(/8.00 lakh/)).toBeInTheDocument();
    expect(screen.getByText(/2 variants/)).toBeInTheDocument();
  });
});
