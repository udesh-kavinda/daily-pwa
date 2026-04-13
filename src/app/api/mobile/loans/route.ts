import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAppSessionContextByClerkId } from "@/lib/auth/get-app-session-context";

type LoanRow = {
  id: string;
  loan_number: string;
  status: string;
  total_amount: number;
  amount_remaining: number;
  daily_installment: number;
  debtor_id: string;
  collector_id: string | null;
  end_date: string | null;
};

function fullName(firstName: string | null, lastName: string | null) {
  return `${firstName || ""} ${lastName || ""}`.trim() || "Member";
}

function formatDate(date: string | null) {
  if (!date) return "No end date";
  return new Intl.DateTimeFormat("en-LK", { month: "short", day: "numeric" }).format(new Date(date));
}

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createAdminClient();
    const session = await getAppSessionContextByClerkId(userId);

    let query = supabase
      .from("loans")
      .select("id, loan_number, status, total_amount, amount_remaining, daily_installment, debtor_id, collector_id, end_date")
      .order("updated_at", { ascending: false });

    if (session.role === "debtor" && session.debtors.length > 0) {
      query = query.in("debtor_id", session.debtors.map((entry) => entry.id));
    } else {
      query = query.eq("creditor_id", session.creditorId);
      if (session.role === "collector" && session.collector) {
        query = query.eq("collector_id", session.collector.id);
      }
    }

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const loans = (data as LoanRow[] | null) || [];
    const debtorIds = [...new Set(loans.map((row) => row.debtor_id).filter(Boolean))];
    const collectorIds = [...new Set(loans.map((row) => row.collector_id).filter(Boolean))] as string[];

    const [{ data: debtors }, { data: collectors }] = await Promise.all([
      debtorIds.length > 0
        ? supabase.from("debtors").select("id, first_name, last_name").in("id", debtorIds)
        : Promise.resolve({ data: [] as Array<{ id: string; first_name: string | null; last_name: string | null }>, error: null }),
      collectorIds.length > 0
        ? supabase.from("collectors").select("id, first_name, last_name, employee_code").in("id", collectorIds)
        : Promise.resolve({ data: [] as Array<{ id: string; first_name: string | null; last_name: string | null; employee_code: string | null }>, error: null }),
    ]);

    const debtorMap = new Map(
      ((debtors as Array<{ id: string; first_name: string | null; last_name: string | null }> | null) || []).map((row) => [row.id, fullName(row.first_name, row.last_name)])
    );
    const collectorMap = new Map(
      ((collectors as Array<{ id: string; first_name: string | null; last_name: string | null; employee_code: string | null }> | null) || []).map((row) => [
        row.id,
        fullName(row.first_name, row.last_name) === "Member" ? row.employee_code || "Collector" : fullName(row.first_name, row.last_name),
      ])
    );

    return NextResponse.json({
      rows: loans.map((row) => ({
        id: row.id,
        loanNumber: row.loan_number,
        debtor: debtorMap.get(row.debtor_id) || "Debtor",
        collector: row.collector_id ? collectorMap.get(row.collector_id) || "Collector" : "Unassigned",
        dailyPay: row.daily_installment,
        outstanding: row.amount_remaining,
        totalAmount: row.total_amount,
        endDate: formatDate(row.end_date),
        status: row.status,
      })),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load loans";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
