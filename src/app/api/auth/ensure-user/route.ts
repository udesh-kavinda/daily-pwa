import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getAppSessionContextByClerkId } from "@/lib/auth/get-app-session-context";

export async function POST() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const session = await getAppSessionContextByClerkId(userId);

    return NextResponse.json({
      ok: true,
      user: session.appUser,
      role: session.role,
      creditorId: session.creditorId,
      collectorId: session.collector?.id || null,
      onboardingRequired: session.onboardingRequired,
      onboardingPath: session.onboardingPath,
      organization: session.organization,
      organizations: session.organizations,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to ensure user";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
