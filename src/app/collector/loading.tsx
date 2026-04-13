import { DetailPageSkeleton } from "@/components/detail-page-skeleton";

export default function CollectorCaptureLoading() {
  return (
    <DetailPageSkeleton
      title="Loading live route capture"
      subtitle="Preparing today's route stops, capture queue, and save workspace."
      metrics={3}
      rows={4}
    />
  );
}
