import { DetailPageSkeleton } from "@/components/detail-page-skeleton";

export default function DebtorKycLoading() {
  return (
    <DetailPageSkeleton
      title="Loading KYC workspace"
      subtitle="Preparing the debtor verification pack and current uploaded files."
      metrics={3}
      rows={4}
    />
  );
}
