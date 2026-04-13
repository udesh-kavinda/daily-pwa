import { createAdminClient } from "@/lib/supabase/admin";
import { getAppSessionContextByClerkId } from "@/lib/auth/get-app-session-context";

export type LoanRequestContext = {
  collector?: {
    id: string;
    employeeCode: string | null;
  } | null;
  organization?: {
    name: string;
    currency: string;
  } | null;
  debtor?: {
    id: string;
    name: string;
    phone: string | null;
    route?: { id?: string | null; name?: string | null; area?: string | null } | null;
    approvalStatus: string;
    isVerified: boolean;
    kyc: {
      idFront: boolean;
      photo: boolean;
      signature: boolean;
    };
  } | null;
  defaults?: {
    principalAmount: number;
    interestRate: number;
    tenureDays: number;
    startDate: string;
  };
  existing?: {
    totalLoans: number;
    pendingLoans: number;
  };
  flags?: {
    canSubmit: boolean;
    blocker: string | null;
    kycReady: boolean;
  };
  recentLoans?: Array<{
    id: string;
    loanNumber: string;
    status: string;
    totalAmount: number;
    dailyInstallment: number;
    createdAt: string;
  }>;
};

type LoanRequestContextRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  approval_status?: string | null;
  is_verified?: boolean | null;
  id_photo_front_url?: string | null;
  debtor_photo_url?: string | null;
  signature_url?: string | null;
  route?: { id?: string | null; name?: string | null; area?: string | null } | Array<{ id?: string | null; name?: string | null; area?: string | null }> | null;
};

export class MobileLoanRequestError extends Error {
  status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.status = status;
  }
}

function collectorDebtorFilter(collectorId: string) {
  return `collector_id.eq.${collectorId},requested_by_collector_id.eq.${collectorId}`;
}

function toNumber(value: number | string | null | undefined) {
  return Number(value || 0);
}

function debtorName(row: LoanRequestContextRow) {
  return `${row.first_name || ""} ${row.last_name || ""}`.trim() || "Debtor";
}

function hasCompleteKyc(row: LoanRequestContextRow) {
  return Boolean(row.id_photo_front_url && row.debtor_photo_url && row.signature_url);
}

export async function loadMobileLoanRequestByClerkId(
  userId: string,
  debtorId: string,
): Promise<LoanRequestContext> {
  const session = await getAppSessionContextByClerkId(userId);
  if (session.role !== "collector" || !session.collector) {
    throw new MobileLoanRequestError("Collector access is required", 403);
  }

  const supabase = createAdminClient();

  const { data: settings, error: settingsError } = await supabase
    .from("creditor_settings")
    .select("business_name, default_interest_rate, default_loan_tenure, currency")
    .eq("user_id", session.creditorId)
    .maybeSingle();

  if (settingsError) {
    throw new MobileLoanRequestError(settingsError.message, 500);
  }

  const debtorResult = await supabase
    .from("debtors")
    .select(`
      id,
      first_name,
      last_name,
      phone,
      approval_status,
      is_verified,
      id_photo_front_url,
      debtor_photo_url,
      signature_url,
      route:routes(id, name, area)
    `)
    .eq("id", debtorId)
    .eq("creditor_id", session.creditorId)
    .or(collectorDebtorFilter(session.collector.id))
    .maybeSingle();

  let debtor = debtorResult.data as LoanRequestContextRow | null;
  let debtorError = debtorResult.error;

  if (debtorError && debtorError.message.includes("requested_by_collector_id")) {
    const legacyResult = await supabase
      .from("debtors")
      .select(`
        id,
        first_name,
        last_name,
        phone,
        is_verified,
        id_photo_front_url,
        debtor_photo_url,
        signature_url,
        route:routes(id, name, area)
      `)
      .eq("id", debtorId)
      .eq("creditor_id", session.creditorId)
      .eq("collector_id", session.collector.id)
      .maybeSingle();

    debtor = legacyResult.data
      ? {
          ...(legacyResult.data as LoanRequestContextRow),
          approval_status: "approved",
        }
      : null;
    debtorError = legacyResult.error;
  }

  if (debtorError || !debtor) {
    throw new MobileLoanRequestError(debtorError?.message || "Debtor not found", 404);
  }

  const { data: loans, error: loansError } = await supabase
    .from("loans")
    .select("id, loan_number, status, total_amount, daily_installment, created_at")
    .eq("creditor_id", session.creditorId)
    .eq("debtor_id", debtorId)
    .order("created_at", { ascending: false })
    .limit(6);

  if (loansError) {
    throw new MobileLoanRequestError(loansError.message, 500);
  }

  const approvalStatus = debtor.approval_status || "approved";
  const verified = Boolean(debtor.is_verified || hasCompleteKyc(debtor));
  const route = Array.isArray(debtor.route) ? debtor.route[0] || null : debtor.route || null;
  const pendingLoans = (loans || []).filter((loan) => String(loan.status || "") === "pending_approval").length;

  return {
    collector: {
      id: session.collector.id,
      employeeCode: session.collector.employee_code || null,
    },
    organization: {
      name: settings?.business_name || session.organization?.name || "Daily+ Organization",
      currency: settings?.currency || "LKR",
    },
    debtor: {
      id: debtor.id,
      name: debtorName(debtor),
      phone: debtor.phone || null,
      route,
      approvalStatus,
      isVerified: verified,
      kyc: {
        idFront: Boolean(debtor.id_photo_front_url),
        photo: Boolean(debtor.debtor_photo_url),
        signature: Boolean(debtor.signature_url),
      },
    },
    defaults: {
      principalAmount: 0,
      interestRate: Number(settings?.default_interest_rate || 10),
      tenureDays: Number(settings?.default_loan_tenure || 30),
      startDate: new Date().toISOString().split("T")[0],
    },
    existing: {
      totalLoans: (loans || []).length,
      pendingLoans,
    },
    flags: {
      canSubmit: approvalStatus === "approved",
      blocker:
        approvalStatus === "pending_approval"
          ? "This debtor is still waiting for creditor approval. A loan request can be submitted after that review clears."
          : approvalStatus === "rejected"
            ? "This debtor request was rejected. Update the debtor profile with the creditor first before requesting a loan."
            : null,
      kycReady: verified,
    },
    recentLoans: (loans || []).map((loan) => ({
      id: loan.id,
      loanNumber: loan.loan_number || "Loan",
      status: String(loan.status || "pending_approval"),
      totalAmount: toNumber(loan.total_amount),
      dailyInstallment: toNumber(loan.daily_installment),
      createdAt: loan.created_at,
    })),
  };
}
