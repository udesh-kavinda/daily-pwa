import { DetailPageSkeleton } from "@/components/detail-page-skeleton";

export default function LoanHistoryLoading() {
  return (
    <DetailPageSkeleton
      title="Loading loan history"
      subtitle="Preparing the collection timeline and repayment totals for this loan."
      metrics={4}
      rows={5}
    />
  );
}
