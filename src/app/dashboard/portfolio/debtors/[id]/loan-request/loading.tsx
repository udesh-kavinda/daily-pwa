import { DetailPageSkeleton } from "@/components/detail-page-skeleton";

export default function LoanRequestLoading() {
  return (
    <DetailPageSkeleton
      title="Loading loan request flow"
      subtitle="Preparing debtor eligibility, KYC readiness, and proposal defaults."
      metrics={4}
      rows={4}
    />
  );
}
