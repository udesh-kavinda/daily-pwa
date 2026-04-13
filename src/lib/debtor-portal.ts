import { createAdminClient } from "@/lib/supabase/admin";
import type { AppSessionContext } from "@/lib/auth/get-app-session-context";

type LoanRow = {
  id: string;
  creditor_id: string;
  debtor_id: string;
  loan_number: string;
  status: string | null;
  principal_amount: number | string | null;
  total_amount: number | string | null;
  amount_collected: number | string | null;
  amount_remaining: number | string | null;
  daily_installment: number | string | null;
  tenure_days: number | null;
  start_date: string | null;
  end_date: string | null;
  notes?: string | null;
  rejection_note?: string | null;
  collector?: {
    id?: string | null;
    employee_code?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    phone?: string | null;
    user?: {
      first_name?: string | null;
      last_name?: string | null;
      phone?: string | null;
    } | null;
  } | null;
};

type CollectionRow = {
  loan_id: string;
  amount_due: number | string | null;
  amount_collected: number | string | null;
  collection_date: string;
  status: string | null;
};

export type DebtorPortalLoan = {
  id: string;
  creditorId: string;
  debtorAccountId: string;
  loanNumber: string;
  status: string;
  principalAmount: number;
  totalAmount: number;
  amountCollected: number;
  amountRemaining: number;
  dailyInstallment: number;
  tenureDays: number;
  startDate: string | null;
  endDate: string | null;
  creditorName: string;
  collectorName: string;
  collectorPhone: string | null;
  notes: string | null;
  rejectionNote: string | null;
  progressPercent: number;
  estimated30DayCommitment: number;
  nextCollection: {
    date: string;
    amountDue: number;
    status: string;
  } | null;
};

export type DebtorPortalSummary = {
  activeLoans: number;
  activeCreditors: number;
  totalBorrowed: number;
  totalCollected: number;
  totalOutstanding: number;
  estimated30DayCommitment: number;
  nextCollectionDate: string | null;
  nextCollectionAmount: number;
  nextCollectorName: string | null;
};

export type DebtorPortalCollectionEntry = {
  id: string;
  status: string;
  amountDue: number;
  amountCollected: number;
  paymentMethod: string | null;
  collectionDate: string;
  collectedAt: string | null;
};

export type DebtorPortalLoanDetail = {
  loan: DebtorPortalLoan;
  organization: {
    id: string;
    name: string | null;
    ownerName: string | null;
    ownerEmail: string | null;
  } | null;
  collections: DebtorPortalCollectionEntry[];
  historySummary: {
    totalEntries: number;
    successfulEntries: number;
    missedEntries: number;
    deferredEntries: number;
    totalCaptured: number;
    averageCaptured: number;
    lastPaymentDate: string | null;
  };
};

function toNumber(value: number | string | null | undefined) {
  return Number(value || 0);
}

function toCollectorName(loan: LoanRow) {
  const first = loan.collector?.user?.first_name || loan.collector?.first_name || "";
  const last = loan.collector?.user?.last_name || loan.collector?.last_name || "";
  return `${first} ${last}`.trim() || loan.collector?.employee_code || "Unassigned";
}

function isOpenLoan(status: string | null | undefined) {
  return ["pending_approval", "approved", "active", "overdue"].includes(String(status || ""));
}

export async function getDebtorPortalData(session: AppSessionContext): Promise<{
  summary: DebtorPortalSummary;
  loans: DebtorPortalLoan[];
}> {
  if (session.role !== "debtor" || session.debtors.length === 0) {
    return {
      summary: {
        activeLoans: 0,
        activeCreditors: 0,
        totalBorrowed: 0,
        totalCollected: 0,
        totalOutstanding: 0,
        estimated30DayCommitment: 0,
        nextCollectionDate: null,
        nextCollectionAmount: 0,
        nextCollectorName: null,
      },
      loans: [],
    };
  }

  const supabase = createAdminClient();
  const today = new Date().toISOString().slice(0, 10);
  const debtorIds = session.debtors.map((debtor) => debtor.id);

  const { data: loanRows, error: loansError } = await supabase
    .from("loans")
    .select(`
      id,
      creditor_id,
      debtor_id,
      loan_number,
      status,
      principal_amount,
      total_amount,
      amount_collected,
      amount_remaining,
      daily_installment,
      tenure_days,
      start_date,
      end_date,
      notes,
      rejection_note,
      collector:collectors!collector_id(
        id,
        employee_code,
        first_name,
        last_name,
        phone,
        user:users!user_id(first_name,last_name,phone)
      )
    `)
    .in("debtor_id", debtorIds)
    .order("created_at", { ascending: false });

  if (loansError) throw new Error(loansError.message);

  const loans = (loanRows || []) as LoanRow[];
  const loanIds = loans.map((loan) => loan.id);
  const organizationById = new Map(session.organizations.map((organization) => [organization.id, organization]));

  const nextCollectionsByLoan = new Map<string, CollectionRow>();

  if (loanIds.length > 0) {
    const { data: collectionRows, error: collectionsError } = await supabase
      .from("collections")
      .select("loan_id, amount_due, amount_collected, collection_date, status, debtor_id")
      .in("loan_id", loanIds)
      .in("debtor_id", debtorIds)
      .in("status", ["pending", "partial", "deferred"])
      .gte("collection_date", today)
      .order("collection_date", { ascending: true });

    if (collectionsError) throw new Error(collectionsError.message);

    for (const row of (collectionRows || []) as CollectionRow[]) {
      if (!nextCollectionsByLoan.has(row.loan_id)) {
        nextCollectionsByLoan.set(row.loan_id, row);
      }
    }
  }

  const mappedLoans: DebtorPortalLoan[] = loans.map((loan) => {
    const nextCollection = nextCollectionsByLoan.get(loan.id) || null;
    const totalAmount = toNumber(loan.total_amount);
    const amountCollected = toNumber(loan.amount_collected);
    const dailyInstallment = toNumber(loan.daily_installment);
    const creditor = organizationById.get(loan.creditor_id);

    return {
      id: loan.id,
      creditorId: loan.creditor_id,
      debtorAccountId: loan.debtor_id,
      loanNumber: loan.loan_number,
      status: String(loan.status || "pending_approval"),
      principalAmount: toNumber(loan.principal_amount),
      totalAmount,
      amountCollected,
      amountRemaining: toNumber(loan.amount_remaining),
      dailyInstallment,
      tenureDays: Number(loan.tenure_days || 0),
      startDate: loan.start_date,
      endDate: loan.end_date,
      creditorName: creditor?.name || "Daily+ Organization",
      collectorName: toCollectorName(loan),
      collectorPhone: loan.collector?.user?.phone || loan.collector?.phone || null,
      notes: loan.notes || null,
      rejectionNote: loan.rejection_note || null,
      progressPercent: totalAmount > 0 ? Math.round((amountCollected / totalAmount) * 100) : 0,
      estimated30DayCommitment: dailyInstallment * 30,
      nextCollection: nextCollection
        ? {
            date: nextCollection.collection_date,
            amountDue: toNumber(nextCollection.amount_due),
            status: String(nextCollection.status || "pending"),
          }
        : null,
    };
  });

  const openLoans = mappedLoans.filter((loan) => isOpenLoan(loan.status));
  const activeCreditorIds = new Set(openLoans.map((loan) => loan.creditorId));
  const nextCollectionOverall = openLoans
    .filter((loan) => loan.nextCollection)
    .sort((a, b) => String(a.nextCollection?.date).localeCompare(String(b.nextCollection?.date)))[0] || null;

  return {
    summary: {
      activeLoans: openLoans.length,
      activeCreditors: activeCreditorIds.size,
      totalBorrowed: mappedLoans.reduce((sum, loan) => sum + loan.totalAmount, 0),
      totalCollected: mappedLoans.reduce((sum, loan) => sum + loan.amountCollected, 0),
      totalOutstanding: mappedLoans.reduce((sum, loan) => sum + loan.amountRemaining, 0),
      estimated30DayCommitment: openLoans.reduce((sum, loan) => sum + loan.estimated30DayCommitment, 0),
      nextCollectionDate: nextCollectionOverall?.nextCollection?.date || null,
      nextCollectionAmount: nextCollectionOverall?.nextCollection?.amountDue || 0,
      nextCollectorName: nextCollectionOverall?.collectorName || null,
    },
    loans: mappedLoans,
  };
}

export async function getDebtorLoanDetail(
  session: AppSessionContext,
  loanId: string,
): Promise<DebtorPortalLoanDetail | null> {
  if (session.role !== "debtor" || session.debtors.length === 0) {
    return null;
  }

  const portal = await getDebtorPortalData(session);
  const loan = portal.loans.find((entry) => entry.id === loanId);

  if (!loan) {
    return null;
  }

  const supabase = createAdminClient();
  const { data: collectionRows, error: collectionsError } = await supabase
    .from("collections")
    .select("id, status, amount_due, amount_collected, payment_method, collection_date, collected_at")
    .eq("creditor_id", loan.creditorId)
    .eq("debtor_id", loan.debtorAccountId)
    .eq("loan_id", loanId)
    .order("collection_date", { ascending: false });

  if (collectionsError) {
    throw new Error(collectionsError.message);
  }

  const collections = ((collectionRows as Array<{
    id: string;
    status?: string | null;
    amount_due?: number | string | null;
    amount_collected?: number | string | null;
    payment_method?: string | null;
    collection_date: string;
    collected_at?: string | null;
  }> | null) || []).map((entry) => ({
    id: entry.id,
    status: String(entry.status || "pending"),
    amountDue: toNumber(entry.amount_due),
    amountCollected: toNumber(entry.amount_collected),
    paymentMethod: entry.payment_method || null,
    collectionDate: entry.collection_date,
    collectedAt: entry.collected_at || null,
  }));

  const successfulEntries = collections.filter((entry) => entry.amountCollected > 0);
  const totalCaptured = successfulEntries.reduce((sum, entry) => sum + entry.amountCollected, 0);
  const lastPayment = successfulEntries
    .map((entry) => entry.collectedAt || entry.collectionDate)
    .sort((left, right) => right.localeCompare(left))[0] || null;

  return {
    loan,
    organization: session.organizations.find((organization) => organization.id === loan.creditorId) || session.organization,
    collections,
    historySummary: {
      totalEntries: collections.length,
      successfulEntries: successfulEntries.length,
      missedEntries: collections.filter((entry) => entry.status === "missed").length,
      deferredEntries: collections.filter((entry) => entry.status === "deferred").length,
      totalCaptured,
      averageCaptured: successfulEntries.length > 0 ? totalCaptured / successfulEntries.length : 0,
      lastPaymentDate: lastPayment,
    },
  };
}
