import { redirect } from "next/navigation";

// Compatibility route: /vehicles -> /cars
export default function VehiclesRedirect() {
  redirect("/cars");
}
