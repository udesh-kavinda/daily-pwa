import { DetailPageSkeleton } from "@/components/detail-page-skeleton";

export default function Loading() {
  return (
    <DetailPageSkeleton
      title="Loading collector detail"
      subtitle="Preparing contact details, route coverage, and portfolio totals."
      metrics={3}
      rows={4}
    />
  );
}
