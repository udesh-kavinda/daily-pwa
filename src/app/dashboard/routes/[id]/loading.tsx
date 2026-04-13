import { DetailPageSkeleton } from "@/components/detail-page-skeleton";

export default function Loading() {
  return (
    <DetailPageSkeleton
      title="Loading route detail"
      subtitle="Preparing assigned collector, mapped debtors, and route totals."
      metrics={3}
      rows={4}
    />
  );
}
