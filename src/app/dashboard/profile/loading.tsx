import { DetailPageSkeleton } from "@/components/detail-page-skeleton";

export default function ProfileLoading() {
  return (
    <DetailPageSkeleton
      title="Loading profile"
      subtitle="Preparing identity, workspace relationships, and account summary."
      metrics={3}
      rows={4}
    />
  );
}
