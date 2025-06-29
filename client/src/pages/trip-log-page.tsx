import { TripLogbook } from "@/components/trip-logbook/trip-logbook";
import DefaultLayout from "@/components/layout/default-layout";

export default function TripLogPageRoute() {
  return (
    <DefaultLayout activeTab="trip-summary">
      <TripLogbook />
    </DefaultLayout>
  );
}