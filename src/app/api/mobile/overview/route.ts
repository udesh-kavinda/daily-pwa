import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getAppSessionContextByClerkId } from "@/lib/auth/get-app-session-context";
import { loadMobileOverview } from "@/lib/mobile-data";

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const session = await getAppSessionContextByClerkId(userId);
    const payload = await loadMobileOverview(session);
    return NextResponse.json(payload);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load overview";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
