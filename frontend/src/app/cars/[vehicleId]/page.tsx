import { VehicleDetailView } from "@/components/vehicle-detail";

export default function VehicleDetailPage({ params }: { params: { vehicleId: string } }) {
  return <VehicleDetailView vehicleId={params.vehicleId} />;
}
