import { DetailPageSkeleton } from "@/components/detail-page-skeleton";

export default function Loading() {
  return (
    <DetailPageSkeleton
      title="Loading debtor detail"
      subtitle="Preparing borrower profile, permissions, KYC, and loan summary."
      metrics={4}
      rows={5}
    />
  );
}
