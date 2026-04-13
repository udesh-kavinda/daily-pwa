import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { normalizeMobileRole } from "@/lib/mobile-route-access";
import { getAppSessionContextByClerkId } from "@/lib/auth/get-app-session-context";
import { loadMobileOverview } from "@/lib/mobile-data";
import { loadMobileApprovals } from "@/lib/mobile-approvals";
import { WorkPageClient } from "@/components/work-page-client";

export default async function WorkPage() {
  const { userId } = await auth();
  if (!userId) {
    redirect("/sign-in");
  }

  const session = await getAppSessionContextByClerkId(userId);
  const role = normalizeMobileRole(session.role);

  let initialApprovals = null;
  let initialFocus = null;
  let initialError: string | null = null;

  try {
    if (role === "creditor") {
      initialApprovals = await loadMobileApprovals(session);
    } else if (role === "debtor") {
      const overview = await loadMobileOverview(session);
      initialFocus = overview.overview.focus;
    }
  } catch (error: unknown) {
    initialError = error instanceof Error ? error.message : "Failed to load work data";
  }

  return (
    <WorkPageClient
      role={role}
      organizationName={session.organization?.name || null}
      initialApprovals={initialApprovals}
      initialFocus={initialFocus || undefined}
      initialError={initialError}
    />
  );
}
