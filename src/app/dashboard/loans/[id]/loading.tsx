import { DetailPageSkeleton } from "@/components/detail-page-skeleton";

export default function Loading() {
  return (
    <DetailPageSkeleton
      title="Loading loan detail"
      subtitle="Preparing balances, next collection, and repayment activity."
      metrics={4}
      rows={4}
    />
  );
}
