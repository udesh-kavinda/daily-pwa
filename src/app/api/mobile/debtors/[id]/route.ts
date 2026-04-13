import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAppSessionContextByClerkId } from "@/lib/auth/get-app-session-context";

function buildCollectorDebtorAccessFilter(collectorId: string) {
  return `collector_id.eq.${collectorId},requested_by_collector_id.eq.${collectorId}`;
}

function formatCollectorName(
  collector:
    | {
        first_name?: string | null;
        last_name?: string | null;
        employee_code?: string | null;
        user?:
          | { first_name?: string | null; last_name?: string | null }
          | Array<{ first_name?: string | null; last_name?: string | null }>
          | null;
      }
    | null
    | undefined,
) {
  const user = Array.isArray(collector?.user) ? collector?.user[0] : collector?.user;
  const name = `${user?.first_name || collector?.first_name || ""} ${user?.last_name || collector?.last_name || ""}`.trim();
  return name || collector?.employee_code || "Collector";
}

function toNumber(value: string | number | null | undefined) {
  return Number(value || 0);
}

type DebtorDetailRow = {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
  portal_email?: string | null;
  address?: string | null;
  id_number?: string | null;
  notes?: string | null;
  approval_status?: string | null;
  approval_requested_at?: string | null;
  approval_note?: string | null;
  id_photo_front_url?: string | null;
  debtor_photo_url?: string | null;
  signature_url?: string | null;
  is_verified?: boolean | null;
  route?: { id?: string | null; name?: string | null; area?: string | null } | Array<{ id?: string | null; name?: string | null; area?: string | null }> | null;
  collector?:
    | {
        id?: string | null;
        employee_code?: string | null;
        first_name?: string | null;
        last_name?: string | null;
        user?:
          | { first_name?: string | null; last_name?: string | null }
          | Array<{ first_name?: string | null; last_name?: string | null }>
          | null;
      }
    | Array<{
        id?: string | null;
        employee_code?: string | null;
        first_name?: string | null;
        last_name?: string | null;
        user?:
          | { first_name?: string | null; last_name?: string | null }
          | Array<{ first_name?: string | null; last_name?: string | null }>
          | null;
      }>
    | null;
};

type QueryError = { message: string } | null;

function buildCollectorGuidance(approvalStatus: string, isVerified: boolean) {
  if (approvalStatus === "pending_approval") {
    return "You can finish KYC and review field context here, but the creditor must approve this borrower before a loan request can move forward.";
  }

  if (approvalStatus === "rejected") {
    return "This borrower needs creditor review before any new loan request. Check the review note, then coordinate profile changes with the creditor.";
  }

  if (!isVerified) {
    return "Borrower approval is clear. Finish the missing KYC items so the loan request is ready for creditor review.";
  }

  return "This borrower is ready for field follow-up. You can keep KYC current and submit a loan request when the borrower is ready.";
}

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const session = await getAppSessionContextByClerkId(userId);
    if (session.role !== "collector" || !session.collector) {
      return NextResponse.json({ error: "Collector access is required" }, { status: 403 });
    }

    const { id } = await params;
    const supabase = createAdminClient();

    const debtorQuery = supabase
      .from("debtors")
      .select(`
        id,
        first_name,
        last_name,
        phone,
        portal_email,
        address,
        id_number,
        notes,
        id_photo_front_url,
        debtor_photo_url,
        signature_url,
        is_verified,
        approval_status,
        approval_requested_at,
        approval_note,
        route:routes(id, name, area),
        collector:collectors!collector_id(
          id,
          employee_code,
          first_name,
          last_name,
          user:users!user_id(first_name, last_name)
        )
      `)
      .eq("id", id)
      .eq("creditor_id", session.creditorId)
      .or(buildCollectorDebtorAccessFilter(session.collector.id));

    let { data: debtor, error: debtorError }: { data: DebtorDetailRow | null; error: QueryError } = await debtorQuery.maybeSingle();

    if (debtorError && debtorError.message.includes("requested_by_collector_id")) {
      const legacyDebtor = await supabase
        .from("debtors")
        .select(`
          id,
          first_name,
          last_name,
          phone,
          address,
          id_number,
          notes,
          id_photo_front_url,
          debtor_photo_url,
          signature_url,
          is_verified,
          route:routes(id, name, area),
          collector:collectors!collector_id(
            id,
            employee_code,
            first_name,
            last_name,
            user:users!user_id(first_name, last_name)
          )
        `)
        .eq("id", id)
        .eq("creditor_id", session.creditorId)
        .eq("collector_id", session.collector.id)
        .maybeSingle();

      debtor = legacyDebtor.data ? {
        ...legacyDebtor.data,
        portal_email: null,
        approval_status: "approved",
        approval_requested_at: null,
        approval_note: null,
      } : null;
      debtorError = legacyDebtor.error;
    }

    if (debtorError || !debtor) {
      return NextResponse.json({ error: debtorError?.message || "Debtor not found" }, { status: 404 });
    }

    const [loanResult, collectionResult] = await Promise.all([
      supabase
        .from("loans")
        .select("id, loan_number, status, principal_amount, total_amount, amount_collected, amount_remaining, daily_installment, tenure_days, created_at")
        .eq("creditor_id", session.creditorId)
        .eq("debtor_id", id)
        .order("created_at", { ascending: false }),
      supabase
        .from("collections")
        .select("id, status, amount_due, amount_collected, payment_method, collection_date, collected_at, loan:loans!loan_id(loan_number)")
        .eq("creditor_id", session.creditorId)
        .eq("debtor_id", id)
        .order("collection_date", { ascending: false })
        .limit(8),
    ]);

    if (loanResult.error) {
      return NextResponse.json({ error: loanResult.error.message }, { status: 500 });
    }

    if (collectionResult.error) {
      return NextResponse.json({ error: collectionResult.error.message }, { status: 500 });
    }

    const loans = (loanResult.data || []) as Array<{
      id: string;
      loan_number?: string | null;
      status?: string | null;
      principal_amount?: string | number | null;
      total_amount?: string | number | null;
      amount_collected?: string | number | null;
      amount_remaining?: string | number | null;
      daily_installment?: string | number | null;
      tenure_days?: number | null;
    }>;
    const collections = (collectionResult.data || []) as Array<{
      id: string;
      status?: string | null;
      amount_due?: string | number | null;
      amount_collected?: string | number | null;
      payment_method?: string | null;
      collection_date: string;
      collected_at?: string | null;
      loan?: { loan_number?: string | null } | Array<{ loan_number?: string | null }> | null;
    }>;
    const activeLoanCount = loans.filter((loan) => ["active", "approved", "pending_approval", "overdue"].includes(String(loan.status || ""))).length;
    const totalBorrowed = loans.reduce((sum, loan) => sum + toNumber(loan.total_amount), 0);
    const totalOutstanding = loans.reduce((sum, loan) => sum + toNumber(loan.amount_remaining), 0);
    const nextCollection = collections
      .filter((entry) => ["pending", "partial", "deferred"].includes(String(entry.status || "")))
      .sort((left, right) => String(left.collection_date).localeCompare(String(right.collection_date)))[0] || null;
    const approvalStatus = "approval_status" in debtor ? debtor.approval_status || "approved" : "approved";
    const kycVerified = Boolean(debtor.is_verified || (debtor.id_photo_front_url && debtor.debtor_photo_url && debtor.signature_url));
    const canRequestLoan = approvalStatus === "approved";
    const portalAccessConfigured = Boolean("portal_email" in debtor ? debtor.portal_email : null);

    return NextResponse.json({
      debtor: {
        id: debtor.id,
        name: `${debtor.first_name || ""} ${debtor.last_name || ""}`.trim() || "Debtor",
        phone: debtor.phone || null,
        address: debtor.address || null,
        idNumber: debtor.id_number || null,
        kyc: {
          idFrontUrl: debtor.id_photo_front_url || null,
          photoUrl: debtor.debtor_photo_url || null,
          signatureUrl: debtor.signature_url || null,
          idFront: Boolean(debtor.id_photo_front_url),
          photo: Boolean(debtor.debtor_photo_url),
          signature: Boolean(debtor.signature_url),
          isVerified: kycVerified,
        },
        approvalStatus,
        approvalRequestedAt: "approval_requested_at" in debtor ? debtor.approval_requested_at || null : null,
        approvalNote: "approval_note" in debtor ? debtor.approval_note || null : null,
        route: Array.isArray(debtor.route) ? debtor.route[0] || null : debtor.route || null,
        collectorName: formatCollectorName(Array.isArray(debtor.collector) ? debtor.collector[0] : debtor.collector),
        collectorCode: (Array.isArray(debtor.collector) ? debtor.collector[0] : debtor.collector)?.employee_code || null,
        notes: debtor.notes || null,
        portalAccess: {
          status: portalAccessConfigured ? "configured" : "not_configured",
          label: portalAccessConfigured ? "Prepared by creditor" : "Not prepared yet",
          guidance: portalAccessConfigured
            ? "Borrower portal access has already been prepared by the creditor."
            : "Borrower portal access is managed by the creditor and can be added later.",
        },
        permissions: {
          canManageKyc: true,
          canRequestLoan,
          canSeeLoanSummary: true,
          canEditBorrowerProfile: false,
          canManagePortalAccess: false,
          canApproveDebtor: false,
          guidance: buildCollectorGuidance(approvalStatus, kycVerified),
        },
      },
      summary: {
        activeLoans: activeLoanCount,
        totalBorrowed,
        totalOutstanding,
        recentCollections: collections.length,
        nextCollection: nextCollection
          ? {
              date: nextCollection.collection_date,
              amountDue: toNumber(nextCollection.amount_due),
              status: String(nextCollection.status || "pending"),
            }
          : null,
      },
      loans: loans.map((loan) => ({
        id: loan.id,
        loanNumber: loan.loan_number || "Loan",
        status: String(loan.status || "pending_approval"),
        principalAmount: toNumber(loan.principal_amount),
        totalAmount: toNumber(loan.total_amount),
        amountCollected: toNumber(loan.amount_collected),
        amountRemaining: toNumber(loan.amount_remaining),
        dailyInstallment: toNumber(loan.daily_installment),
        tenureDays: Number(loan.tenure_days || 0),
      })),
      collections: collections.map((entry) => ({
        id: entry.id,
        status: String(entry.status || "pending"),
        amountDue: toNumber(entry.amount_due),
        amountCollected: toNumber(entry.amount_collected),
        paymentMethod: entry.payment_method || null,
        collectionDate: entry.collection_date,
        collectedAt: entry.collected_at || null,
        loanNumber: Array.isArray(entry.loan) ? entry.loan[0]?.loan_number || "Loan" : entry.loan?.loan_number || "Loan",
      })),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load collector debtor detail";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
