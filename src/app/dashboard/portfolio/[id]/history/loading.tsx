import { DetailPageSkeleton } from "@/components/detail-page-skeleton";

export default function RepaymentHistoryLoading() {
  return (
    <DetailPageSkeleton
      title="Loading repayment history"
      subtitle="Preparing repayment totals and the visit timeline for this loan."
      metrics={4}
      rows={5}
    />
  );
}
