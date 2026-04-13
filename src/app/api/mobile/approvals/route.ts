import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAppSessionContextByClerkId } from "@/lib/auth/get-app-session-context";

type DebtorApprovalRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  address: string | null;
  approval_status: string | null;
  approval_requested_at: string | null;
  created_at: string;
  notes: string | null;
  route?: {
    id?: string | null;
    name?: string | null;
    area?: string | null;
  } | null;
  requested_collector?: {
    id?: string | null;
    employee_code?: string | null;
    user?: {
      first_name?: string | null;
      last_name?: string | null;
    } | null;
  } | null;
};

type LoanApprovalRow = {
  id: string;
  loan_number: string | null;
  principal_amount: number | string | null;
  total_amount: number | string | null;
  daily_installment: number | string | null;
  tenure_days: number | null;
  interest_rate: number | string | null;
  status: string | null;
  created_at: string;
  notes: string | null;
  rejection_note?: string | null;
  debtor?: {
    id?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    phone?: string | null;
  } | null;
  collector?: {
    id?: string | null;
    employee_code?: string | null;
    user?: {
      first_name?: string | null;
      last_name?: string | null;
    } | null;
  } | null;
  requested_collector?: {
    id?: string | null;
    employee_code?: string | null;
    user?: {
      first_name?: string | null;
      last_name?: string | null;
    } | null;
  } | null;
};

type ApprovalActionPayload = {
  kind?: "debtor" | "loan";
  id?: string;
  decision?: "approve" | "reject";
  note?: string | null;
};

function toNumber(value: string | number | null | undefined) {
  return Number(value || 0);
}

function getCollectorLabel(
  collector:
    | {
        employee_code?: string | null;
        user?: { first_name?: string | null; last_name?: string | null } | null;
      }
    | null
    | undefined,
) {
  const name = `${collector?.user?.first_name || ""} ${collector?.user?.last_name || ""}`.trim();
  if (name) return name;
  if (collector?.employee_code) return `Collector ${collector.employee_code}`;
  return "Collector";
}

function buildDebtorApprovalItem(row: DebtorApprovalRow) {
  return {
    kind: "debtor" as const,
    id: row.id,
    title: `${row.first_name || ""} ${row.last_name || ""}`.trim() || "Debtor request",
    subtitle: row.address || row.phone || "Collector-submitted debtor record awaiting approval",
    requestedAt: row.approval_requested_at || row.created_at,
    requesterName: getCollectorLabel(row.requested_collector),
    badge: row.route?.name ? `Route · ${row.route.name}` : row.route?.area ? `Area · ${row.route.area}` : "Debtor approval",
    metrics: [
      { label: "Phone", value: row.phone || "Not provided" },
      { label: "Route", value: row.route?.name || "Unassigned" },
      { label: "Collector", value: getCollectorLabel(row.requested_collector) },
    ],
    note: row.notes || null,
  };
}

function buildLoanApprovalItem(row: LoanApprovalRow) {
  const debtorName = `${row.debtor?.first_name || ""} ${row.debtor?.last_name || ""}`.trim() || "Debtor";
  const requester = row.requested_collector || row.collector;

  return {
    kind: "loan" as const,
    id: row.id,
    title: row.loan_number || debtorName,
    subtitle: `${debtorName} · ${row.tenure_days || 0} day proposal`,
    requestedAt: row.created_at,
    requesterName: getCollectorLabel(requester),
    badge: "Loan approval",
    metrics: [
      { label: "Principal", value: new Intl.NumberFormat("en-LK", { style: "currency", currency: "LKR", maximumFractionDigits: 0 }).format(toNumber(row.principal_amount)) },
      { label: "Total repayable", value: new Intl.NumberFormat("en-LK", { style: "currency", currency: "LKR", maximumFractionDigits: 0 }).format(toNumber(row.total_amount)) },
      { label: "Daily pay", value: new Intl.NumberFormat("en-LK", { style: "currency", currency: "LKR", maximumFractionDigits: 0 }).format(toNumber(row.daily_installment)) },
    ],
    note: row.notes || null,
  };
}

async function notifyCollector(params: {
  supabase: ReturnType<typeof createAdminClient>;
  collectorId: string | null | undefined;
  title: string;
  message: string;
  data: Record<string, unknown>;
}) {
  const { supabase, collectorId, title, message, data } = params;
  if (!collectorId) return;

  const { data: collector, error } = await supabase
    .from("collectors")
    .select("id, user_id")
    .eq("id", collectorId)
    .maybeSingle();

  if (error || !collector?.user_id) {
    return;
  }

  await supabase.from("notifications").insert({
    user_id: collector.user_id,
    title,
    message,
    type: "system",
    is_read: false,
    data,
  });
}

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const session = await getAppSessionContextByClerkId(userId);
    if (session.role !== "creditor") {
      return NextResponse.json({ error: "Creditor access is required" }, { status: 403 });
    }

    const supabase = createAdminClient();

    const [debtorResult, loanResult] = await Promise.all([
      supabase
        .from("debtors")
        .select(`
          id,
          first_name,
          last_name,
          phone,
          address,
          approval_status,
          approval_requested_at,
          created_at,
          notes,
          route:routes(id, name, area),
          requested_collector:collectors!requested_by_collector_id(
            id,
            employee_code,
            user:users!user_id(first_name, last_name)
          )
        `)
        .eq("creditor_id", session.creditorId)
        .eq("approval_status", "pending_approval")
        .order("approval_requested_at", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: true }),
      supabase
        .from("loans")
        .select(`
          id,
          loan_number,
          principal_amount,
          total_amount,
          daily_installment,
          tenure_days,
          interest_rate,
          status,
          created_at,
          notes,
          rejection_note,
          debtor:debtors!debtor_id(id, first_name, last_name, phone),
          collector:collectors!collector_id(
            id,
            employee_code,
            user:users!user_id(first_name, last_name)
          ),
          requested_collector:collectors!requested_by_collector_id(
            id,
            employee_code,
            user:users!user_id(first_name, last_name)
          )
        `)
        .eq("creditor_id", session.creditorId)
        .eq("status", "pending_approval")
        .order("created_at", { ascending: true }),
    ]);

    if (debtorResult.error) {
      return NextResponse.json({ error: debtorResult.error.message }, { status: 500 });
    }

    if (loanResult.error) {
      return NextResponse.json({ error: loanResult.error.message }, { status: 500 });
    }

    const debtors = ((debtorResult.data as DebtorApprovalRow[] | null) || []).map(buildDebtorApprovalItem);
    const loans = ((loanResult.data as LoanApprovalRow[] | null) || []).map(buildLoanApprovalItem);

    return NextResponse.json({
      counts: {
        debtors: debtors.length,
        loans: loans.length,
        total: debtors.length + loans.length,
      },
      debtors,
      loans,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load approvals";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const session = await getAppSessionContextByClerkId(userId);
    if (session.role !== "creditor") {
      return NextResponse.json({ error: "Creditor access is required" }, { status: 403 });
    }

    const payload = (await req.json()) as ApprovalActionPayload;
    if (!payload.kind || !payload.id || !payload.decision) {
      return NextResponse.json({ error: "kind, id, and decision are required" }, { status: 400 });
    }

    const note = payload.note?.trim() || null;
    const supabase = createAdminClient();
    const now = new Date().toISOString();

    if (payload.kind === "debtor") {
      const { data: debtor, error: debtorError } = await supabase
        .from("debtors")
        .select(`
          id,
          first_name,
          last_name,
          approval_status,
          requested_by_collector_id,
          collector_id
        `)
        .eq("id", payload.id)
        .eq("creditor_id", session.creditorId)
        .maybeSingle();

      if (debtorError || !debtor) {
        return NextResponse.json({ error: debtorError?.message || "Debtor request not found" }, { status: 404 });
      }

      if (debtor.approval_status !== "pending_approval") {
        return NextResponse.json({ error: "This debtor request has already been processed" }, { status: 400 });
      }

      const update = payload.decision === "approve"
        ? {
            approval_status: "approved",
            is_active: true,
            approved_by: session.appUser.id,
            approved_at: now,
            rejected_by: null,
            rejected_at: null,
            approval_note: note,
            updated_at: now,
          }
        : {
            approval_status: "rejected",
            is_active: false,
            approved_by: null,
            approved_at: null,
            rejected_by: session.appUser.id,
            rejected_at: now,
            approval_note: note,
            updated_at: now,
          };

      const { error: updateError } = await supabase
        .from("debtors")
        .update(update)
        .eq("id", payload.id)
        .eq("creditor_id", session.creditorId);

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }

      await notifyCollector({
        supabase,
        collectorId: debtor.requested_by_collector_id || debtor.collector_id,
        title: payload.decision === "approve" ? "Debtor approved" : "Debtor rejected",
        message:
          payload.decision === "approve"
            ? `${debtor.first_name || "Debtor"} ${debtor.last_name || ""}`.trim() + " is now approved for the organization."
            : `${debtor.first_name || "Debtor"} ${debtor.last_name || ""}`.trim() + (note ? ` was rejected: ${note}` : " was rejected."),
        data: {
          entity: "debtor",
          debtor_id: debtor.id,
          decision: payload.decision,
        },
      });

      return NextResponse.json({ ok: true, kind: "debtor", decision: payload.decision });
    }

    const { data: loan, error: loanError } = await supabase
      .from("loans")
      .select(`
        id,
        loan_number,
        status,
        collector_id,
        requested_by_collector_id,
        debtor:debtors!debtor_id(first_name, last_name)
      `)
      .eq("id", payload.id)
      .eq("creditor_id", session.creditorId)
      .maybeSingle();

    if (loanError || !loan) {
      return NextResponse.json({ error: loanError?.message || "Loan request not found" }, { status: 404 });
    }

    if (loan.status !== "pending_approval") {
      return NextResponse.json({ error: "This loan request has already been processed" }, { status: 400 });
    }

    const loanUpdate = payload.decision === "approve"
      ? {
          status: "approved",
          approved_by: session.appUser.id,
          approved_at: now,
          rejected_at: null,
          rejection_note: null,
          updated_at: now,
        }
      : {
          status: "rejected",
          approved_by: null,
          approved_at: null,
          rejected_at: now,
          rejection_note: note,
          updated_at: now,
        };

    const { error: updateLoanError } = await supabase
      .from("loans")
      .update(loanUpdate)
      .eq("id", payload.id)
      .eq("creditor_id", session.creditorId);

    if (updateLoanError) {
      return NextResponse.json({ error: updateLoanError.message }, { status: 500 });
    }

    const debtorName = `${(loan.debtor as { first_name?: string | null; last_name?: string | null } | null)?.first_name || ""} ${(loan.debtor as { first_name?: string | null; last_name?: string | null } | null)?.last_name || ""}`.trim() || loan.loan_number || "Loan";

    await notifyCollector({
      supabase,
      collectorId: (loan as { requested_by_collector_id?: string | null; collector_id?: string | null }).requested_by_collector_id || (loan as { collector_id?: string | null }).collector_id,
      title: payload.decision === "approve" ? "Loan approved" : "Loan rejected",
      message:
        payload.decision === "approve"
          ? `${debtorName} is approved and ready for the next disbursement step.`
          : `${debtorName} was rejected${note ? `: ${note}` : "."}`,
      data: {
        entity: "loan",
        loan_id: loan.id,
        decision: payload.decision,
      },
    });

    return NextResponse.json({ ok: true, kind: "loan", decision: payload.decision });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to process approval";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
