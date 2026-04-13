import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAppSessionContextByClerkId } from "@/lib/auth/get-app-session-context";
import { getDebtorLoanDetail } from "@/lib/debtor-portal";

function fullName(firstName: string | null, lastName: string | null) {
  return `${firstName || ""} ${lastName || ""}`.trim() || "Member";
}

function toNumber(value: number | string | null | undefined) {
  return Number(value || 0);
}

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const session = await getAppSessionContextByClerkId(userId);
    const { id } = await params;

    if (session.role === "debtor") {
      const detail = await getDebtorLoanDetail(session, id);
      if (!detail) {
        return NextResponse.json({ error: "Loan not found" }, { status: 404 });
      }
      return NextResponse.json(detail);
    }

    const supabase = createAdminClient();
    let query = supabase
      .from("loans")
      .select("id, loan_number, status, principal_amount, interest_amount, total_amount, amount_collected, amount_remaining, daily_installment, tenure_days, start_date, end_date, notes, debtor_id, collector_id, creditor_id")
      .eq("id", id)
      .eq("creditor_id", session.creditorId);

    if (session.role === "collector" && session.collector) {
      query = query.eq("collector_id", session.collector.id);
    }

    const { data: loan, error: loanError } = await query.maybeSingle();
    if (loanError || !loan) {
      return NextResponse.json({ error: loanError?.message || "Loan not found" }, { status: 404 });
    }

    const [{ data: debtor }, { data: collector }, { data: collections }, { data: creditorUser }, { data: creditorSettings }] = await Promise.all([
      supabase.from("debtors").select("id, first_name, last_name, phone").eq("id", loan.debtor_id).maybeSingle(),
      loan.collector_id
        ? supabase.from("collectors").select("id, first_name, last_name, employee_code, phone").eq("id", loan.collector_id).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      supabase
        .from("collections")
        .select("id, status, amount_due, amount_collected, payment_method, collection_date, collected_at")
        .eq("loan_id", loan.id)
        .order("collection_date", { ascending: false })
        .limit(12),
      supabase.from("users").select("id, first_name, last_name").eq("id", loan.creditor_id).maybeSingle(),
      supabase.from("creditor_settings").select("user_id, business_name").eq("user_id", loan.creditor_id).maybeSingle(),
    ]);

    const creditorName = creditorSettings?.business_name || fullName(creditorUser?.first_name || null, creditorUser?.last_name || null);
    const collectorName = collector ? fullName(collector.first_name, collector.last_name) : "Unassigned";
    const progressPercent = loan.total_amount ? Math.round((toNumber(loan.amount_collected) / toNumber(loan.total_amount)) * 100) : 0;
    const nextCollection = (collections || [])
      .filter((entry) => ["pending", "partial", "deferred"].includes(String(entry.status || "")))
      .sort((left, right) => String(left.collection_date).localeCompare(String(right.collection_date)))[0] || null;

    return NextResponse.json({
      loan: {
        id: loan.id,
        loanNumber: loan.loan_number,
        status: String(loan.status || "pending_approval"),
        principalAmount: toNumber(loan.principal_amount),
        totalAmount: toNumber(loan.total_amount),
        amountCollected: toNumber(loan.amount_collected),
        amountRemaining: toNumber(loan.amount_remaining),
        dailyInstallment: toNumber(loan.daily_installment),
        tenureDays: Number(loan.tenure_days || 0),
        startDate: loan.start_date || null,
        endDate: loan.end_date || null,
        creditorName,
        collectorName,
        collectorPhone: collector?.phone || null,
        rejectionNote: null,
        notes: loan.notes || null,
        progressPercent,
        estimated30DayCommitment: toNumber(loan.daily_installment) * 30,
        nextCollection: nextCollection
          ? {
              date: nextCollection.collection_date,
              amountDue: toNumber(nextCollection.amount_due),
              status: String(nextCollection.status || "pending"),
            }
          : null,
      },
      organization: { name: creditorName, ownerName: creditorName, ownerEmail: null },
      collections: (collections || []).map((entry) => ({
        id: entry.id,
        status: String(entry.status || "pending"),
        amountDue: toNumber(entry.amount_due),
        amountCollected: toNumber(entry.amount_collected),
        paymentMethod: entry.payment_method || null,
        collectionDate: entry.collection_date,
        collectedAt: entry.collected_at || null,
      })),
      historySummary: {
        totalEntries: (collections || []).length,
        successfulEntries: (collections || []).filter((entry) => entry.status === "collected").length,
        missedEntries: (collections || []).filter((entry) => entry.status === "missed").length,
        deferredEntries: (collections || []).filter((entry) => entry.status === "deferred").length,
        totalCaptured: (collections || []).reduce((sum, entry) => sum + toNumber(entry.amount_collected), 0),
        averageCaptured: (collections || []).length > 0
          ? (collections || []).reduce((sum, entry) => sum + toNumber(entry.amount_collected), 0) / (collections || []).length
          : 0,
        lastPaymentDate: (collections || []).find((entry) => entry.collected_at)?.collected_at || null,
      },
      context: {
        debtorName: debtor ? fullName(debtor.first_name, debtor.last_name) : "Debtor",
        debtorPhone: debtor?.phone || null,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load loan detail";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
