import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getAppSessionContextByClerkId } from "@/lib/auth/get-app-session-context";
import { getDebtorLoanDetail } from "@/lib/debtor-portal";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const session = await getAppSessionContextByClerkId(userId);
    if (session.role !== "debtor" || session.debtors.length === 0) {
      return NextResponse.json({ error: "Debtor portal only" }, { status: 403 });
    }

    const { id } = await params;
    const detail = await getDebtorLoanDetail(session, id);

    if (!detail) {
      return NextResponse.json({ error: "Loan not found" }, { status: 404 });
    }

    return NextResponse.json({
      loan: detail.loan,
      organization: detail.organization,
      historySummary: detail.historySummary,
      collections: detail.collections,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load repayment history";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
