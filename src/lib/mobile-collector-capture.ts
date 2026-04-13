import { createAdminClient } from "@/lib/supabase/admin";
import { getAppSessionContextByClerkId } from "@/lib/auth/get-app-session-context";

export type CaptureItem = {
  collectionId: string | null;
  loanId: string;
  debtorId: string;
  debtorName: string;
  phone: string | null;
  address: string | null;
  loanNumber: string;
  amountDue: number;
  amountCollected: number;
  amountRemaining: number;
  dailyInstallment: number;
  status: "pending" | "collected" | "partial" | "missed" | "deferred";
  paymentMethod: string | null;
  notes: string | null;
  collectionDate: string;
  collectedAt: string | null;
};

export type CollectorCapturePayload = {
  role: "creditor" | "collector" | "recovery_agent" | "debtor";
  organization: { id: string; name: string | null; ownerName: string | null; ownerEmail: string | null } | null;
  collectionDate: string;
  items: CaptureItem[];
};

export class MobileCollectorCaptureError extends Error {
  status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.status = status;
  }
}

type DbCollectionRow = {
  id: string;
  loan_id: string;
  debtor_id: string;
  collector_id: string;
  creditor_id: string;
  amount_due: number | string | null;
  amount_collected: number | string | null;
  collection_date: string;
  status: string | null;
  payment_method: string | null;
  notes: string | null;
  collected_at: string | null;
  loan?: {
    id?: string | null;
    loan_number?: string | null;
    daily_installment?: number | string | null;
    amount_remaining?: number | string | null;
  } | null;
  debtor?: {
    id?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    phone?: string | null;
    address?: string | null;
  } | null;
};

type LoanScheduleRow = {
  id: string;
  debtor_id: string;
  loan_number: string | null;
  daily_installment: number | string | null;
  amount_remaining: number | string | null;
  status: string | null;
  start_date: string | null;
  end_date: string | null;
  debtor?: {
    id?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    phone?: string | null;
    address?: string | null;
  } | null;
};

function toNumber(value: number | string | null | undefined) {
  return Number(value || 0);
}

export function getTodayDate() {
  return new Date().toISOString().slice(0, 10);
}

export async function loadMobileCollectorCaptureByClerkId(
  userId: string,
  date = getTodayDate(),
): Promise<CollectorCapturePayload> {
  const session = await getAppSessionContextByClerkId(userId);
  if (session.role !== "collector" || !session.collector) {
    throw new MobileCollectorCaptureError("Collector access is required", 403);
  }

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("collections")
    .select(`
      id,
      loan_id,
      debtor_id,
      collector_id,
      creditor_id,
      amount_due,
      amount_collected,
      collection_date,
      status,
      payment_method,
      notes,
      collected_at,
      loan:loans!loan_id(id, loan_number, daily_installment, amount_remaining),
      debtor:debtors!debtor_id(id, first_name, last_name, phone, address)
    `)
    .eq("creditor_id", session.creditorId)
    .eq("collector_id", session.collector.id)
    .eq("collection_date", date)
    .order("status", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    throw new MobileCollectorCaptureError(error.message, 500);
  }

  const collectionRows = (data as DbCollectionRow[] | null) || [];
  const collectionByLoanId = new Map(collectionRows.map((row) => [row.loan_id, row]));

  const { data: loanData, error: loanError } = await supabase
    .from("loans")
    .select(`
      id,
      debtor_id,
      loan_number,
      daily_installment,
      amount_remaining,
      status,
      start_date,
      end_date,
      debtor:debtors!debtor_id(id, first_name, last_name, phone, address)
    `)
    .eq("creditor_id", session.creditorId)
    .eq("collector_id", session.collector.id)
    .in("status", ["approved", "active", "overdue"])
    .lte("start_date", date)
    .gte("end_date", date)
    .order("start_date", { ascending: true });

  if (loanError) {
    throw new MobileCollectorCaptureError(loanError.message, 500);
  }

  const loanRows = (loanData as LoanScheduleRow[] | null) || [];
  const mergedItems = loanRows.map((loan) => {
    const existing = collectionByLoanId.get(loan.id);
    const remaining = toNumber(existing?.loan?.amount_remaining ?? loan.amount_remaining);
    const dailyInstallment = toNumber(existing?.loan?.daily_installment ?? loan.daily_installment);
    const amountDue = existing ? toNumber(existing.amount_due) : Math.min(dailyInstallment || remaining, remaining || dailyInstallment);
    const debtor = existing?.debtor || loan.debtor;

    return {
      collectionId: existing?.id || null,
      loanId: loan.id,
      debtorId: loan.debtor_id,
      debtorName: `${debtor?.first_name || ""} ${debtor?.last_name || ""}`.trim() || "Debtor",
      phone: debtor?.phone || null,
      address: debtor?.address || null,
      loanNumber: existing?.loan?.loan_number || loan.loan_number || "Loan",
      amountDue,
      amountCollected: toNumber(existing?.amount_collected),
      amountRemaining: remaining,
      dailyInstallment,
      status: (existing?.status || "pending") as CaptureItem["status"],
      paymentMethod: existing?.payment_method || null,
      notes: existing?.notes || null,
      collectionDate: existing?.collection_date || date,
      collectedAt: existing?.collected_at || null,
    };
  });

  const orphanCollectionItems = collectionRows
    .filter((row) => !loanRows.some((loan) => loan.id === row.loan_id))
    .map((row) => ({
      collectionId: row.id,
      loanId: row.loan_id,
      debtorId: row.debtor_id,
      debtorName: `${row.debtor?.first_name || ""} ${row.debtor?.last_name || ""}`.trim() || "Debtor",
      phone: row.debtor?.phone || null,
      address: row.debtor?.address || null,
      loanNumber: row.loan?.loan_number || "Loan",
      amountDue: toNumber(row.amount_due),
      amountCollected: toNumber(row.amount_collected),
      amountRemaining: toNumber(row.loan?.amount_remaining),
      dailyInstallment: toNumber(row.loan?.daily_installment),
      status: (row.status || "pending") as CaptureItem["status"],
      paymentMethod: row.payment_method || null,
      notes: row.notes || null,
      collectionDate: row.collection_date,
      collectedAt: row.collected_at || null,
    }));

  const items = [...mergedItems, ...orphanCollectionItems].sort((a, b) => {
    const statusOrder = ["pending", "partial", "missed", "deferred", "collected"];
    const left = statusOrder.indexOf(a.status);
    const right = statusOrder.indexOf(b.status);
    if (left != right) return left - right;
    return a.debtorName.localeCompare(b.debtorName);
  });

  return {
    role: session.role,
    organization: session.organization,
    collectionDate: date,
    items,
  };
}
