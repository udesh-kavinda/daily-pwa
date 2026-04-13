import { getDebtorLoanDetail } from "@/lib/debtor-portal";
import type { AppSessionContext } from "@/lib/auth/get-app-session-context";

export type MobileLoanHistoryPayload = {
  loan: {
    id: string;
    loanNumber: string;
    creditorName: string;
    dailyInstallment: number;
    amountRemaining: number;
  } | null;
  organization?: { name?: string | null } | null;
  historySummary: {
    totalEntries: number;
    successfulEntries: number;
    missedEntries: number;
    deferredEntries: number;
    totalCaptured: number;
    averageCaptured: number;
    lastPaymentDate: string | null;
  };
  collections: Array<{
    id: string;
    status: string;
    amountDue: number;
    amountCollected: number;
    paymentMethod: string | null;
    collectionDate: string;
    collectedAt: string | null;
  }>;
};

export class MobileLoanHistoryError extends Error {
  status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.status = status;
  }
}

export async function loadMobileLoanHistory(
  session: AppSessionContext,
  id: string,
): Promise<MobileLoanHistoryPayload> {
  if (session.role !== "debtor" || session.debtors.length === 0) {
    throw new MobileLoanHistoryError("Debtor portal only", 403);
  }

  const detail = await getDebtorLoanDetail(session, id);
  if (!detail) {
    throw new MobileLoanHistoryError("Loan not found", 404);
  }

  return {
    loan: {
      id: detail.loan.id,
      loanNumber: detail.loan.loanNumber,
      creditorName: detail.loan.creditorName,
      dailyInstallment: detail.loan.dailyInstallment,
      amountRemaining: detail.loan.amountRemaining,
    },
    organization: detail.organization,
    historySummary: detail.historySummary,
    collections: detail.collections,
  };
}
