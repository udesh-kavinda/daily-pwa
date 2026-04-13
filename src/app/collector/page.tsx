import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { CollectorCapturePageClient } from "@/components/collector-capture-page-client";
import { getAppSessionContextByClerkId } from "@/lib/auth/get-app-session-context";
import { loadMobileCollectorCaptureByClerkId, MobileCollectorCaptureError } from "@/lib/mobile-collector-capture";
import { normalizeMobileRole } from "@/lib/mobile-route-access";

export default async function CollectorCapturePage({
  searchParams,
}: {
  searchParams?: Promise<{ loanId?: string }>;
}) {
  const { userId } = await auth();
  if (!userId) {
    redirect("/sign-in");
  }

  const session = await getAppSessionContextByClerkId(userId);
  const role = normalizeMobileRole(session.role);
  const params = searchParams ? await searchParams : undefined;
  const preferredLoanId = params?.loanId || null;

  let initialCaptureContext = null;
  if (role === "collector") {
    try {
      initialCaptureContext = await loadMobileCollectorCaptureByClerkId(userId);
    } catch (error: unknown) {
      if (!(error instanceof MobileCollectorCaptureError) || error.status !== 403) {
        throw error;
      }
    }
  }

  return (
    <CollectorCapturePageClient
      initialRole={role}
      initialOrganization={session.organization}
      initialCaptureContext={initialCaptureContext}
      initialPreferredLoanId={preferredLoanId}
    />
  );
}
