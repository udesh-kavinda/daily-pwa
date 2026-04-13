import { createAdminClient } from "@/lib/supabase/admin";
import type { AppSessionContext } from "@/lib/auth/get-app-session-context";

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

export type ApprovalMetric = { label: string; value: string };

export type ApprovalItem = {
  kind: "debtor" | "loan";
  id: string;
  title: string;
  subtitle: string;
  requestedAt: string;
  requesterName: string;
  badge: string;
  metrics: ApprovalMetric[];
  note: string | null;
};

export type ApprovalResponse = {
  counts: {
    debtors: number;
    loans: number;
    total: number;
  };
  debtors: ApprovalItem[];
  loans: ApprovalItem[];
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

function buildDebtorApprovalItem(row: DebtorApprovalRow): ApprovalItem {
  return {
    kind: "debtor",
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

function buildLoanApprovalItem(row: LoanApprovalRow): ApprovalItem {
  const debtorName = `${row.debtor?.first_name || ""} ${row.debtor?.last_name || ""}`.trim() || "Debtor";
  const requester = row.requested_collector || row.collector;

  return {
    kind: "loan",
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

export async function loadMobileApprovals(session: AppSessionContext): Promise<ApprovalResponse> {
  if (session.role !== "creditor") {
    throw new Error("Creditor access is required");
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
    throw new Error(debtorResult.error.message);
  }

  if (loanResult.error) {
    throw new Error(loanResult.error.message);
  }

  const debtors = ((debtorResult.data as DebtorApprovalRow[] | null) || []).map(buildDebtorApprovalItem);
  const loans = ((loanResult.data as LoanApprovalRow[] | null) || []).map(buildLoanApprovalItem);

  return {
    counts: {
      debtors: debtors.length,
      loans: loans.length,
      total: debtors.length + loans.length,
    },
    debtors,
    loans,
  };
}
