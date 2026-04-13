import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getAppSessionContextByClerkId } from "@/lib/auth/get-app-session-context";
import { loadMobileLoanHistory, MobileLoanHistoryError } from "@/lib/mobile-loan-history";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const session = await getAppSessionContextByClerkId(userId);
    const { id } = await params;
    const payload = await loadMobileLoanHistory(session, id);
    return NextResponse.json(payload);
  } catch (error: unknown) {
    if (error instanceof MobileLoanHistoryError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    const message = error instanceof Error ? error.message : "Failed to load repayment history";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
