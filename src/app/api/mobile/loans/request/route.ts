import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAppSessionContextByClerkId } from "@/lib/auth/get-app-session-context";

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

type CreateLoanRequestPayload = {
  debtorId?: string;
  principalAmount?: number | string;
  interestRate?: number | string;
  tenureDays?: number | string;
  startDate?: string;
  notes?: string | null;
  allowUnverifiedKyc?: boolean;
  specialPermissionNote?: string | null;
};

function collectorDebtorFilter(collectorId: string) {
  return `collector_id.eq.${collectorId},requested_by_collector_id.eq.${collectorId}`;
}

function toNumber(value: number | string | null | undefined) {
  return Number(value || 0);
}

function addDays(dateString: string, days: number) {
  const date = new Date(dateString);
  date.setDate(date.getDate() + days);
  return date.toISOString().split("T")[0];
}

function buildLoanNumber(startDate: string) {
  return `LN-${startDate.replaceAll("-", "")}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

function debtorName(row: LoanRequestContextRow) {
  return `${row.first_name || ""} ${row.last_name || ""}`.trim() || "Debtor";
}

function hasCompleteKyc(row: LoanRequestContextRow) {
  return Boolean(row.id_photo_front_url && row.debtor_photo_url && row.signature_url);
}

export async function GET(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const session = await getAppSessionContextByClerkId(userId);
    if (session.role !== "collector" || !session.collector) {
      return NextResponse.json({ error: "Collector access is required" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const debtorId = searchParams.get("debtorId");
    if (!debtorId) {
      return NextResponse.json({ error: "debtorId is required" }, { status: 400 });
    }

    const supabase = createAdminClient();

    const { data: settings, error: settingsError } = await supabase
      .from("creditor_settings")
      .select("business_name, default_interest_rate, default_loan_tenure, currency")
      .eq("user_id", session.creditorId)
      .maybeSingle();

    if (settingsError) {
      return NextResponse.json({ error: settingsError.message }, { status: 500 });
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
      return NextResponse.json({ error: debtorError?.message || "Debtor not found" }, { status: 404 });
    }

    const { data: loans, error: loansError } = await supabase
      .from("loans")
      .select("id, loan_number, status, total_amount, daily_installment, created_at")
      .eq("creditor_id", session.creditorId)
      .eq("debtor_id", debtorId)
      .order("created_at", { ascending: false })
      .limit(6);

    if (loansError) {
      return NextResponse.json({ error: loansError.message }, { status: 500 });
    }

    const approvalStatus = debtor.approval_status || "approved";
    const verified = Boolean(debtor.is_verified || hasCompleteKyc(debtor));
    const route = Array.isArray(debtor.route) ? debtor.route[0] || null : debtor.route || null;
    const pendingLoans = (loans || []).filter((loan) => String(loan.status || "") === "pending_approval").length;

    return NextResponse.json({
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
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load loan request context";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const session = await getAppSessionContextByClerkId(userId);
    if (session.role !== "collector" || !session.collector) {
      return NextResponse.json({ error: "Collector access is required" }, { status: 403 });
    }

    const payload = (await req.json()) as CreateLoanRequestPayload;
    const debtorId = payload.debtorId?.trim();
    const principalAmount = toNumber(payload.principalAmount);
    const interestRate = toNumber(payload.interestRate);
    const tenureDays = Math.floor(toNumber(payload.tenureDays));
    const startDate = payload.startDate?.trim();

    if (!debtorId || !startDate || principalAmount <= 0 || interestRate < 0 || tenureDays <= 0) {
      return NextResponse.json({ error: "Debtor, principal amount, interest rate, tenure, and start date are required" }, { status: 400 });
    }

    const supabase = createAdminClient();
    const debtorResult = await supabase
      .from("debtors")
      .select(`
        id,
        first_name,
        last_name,
        approval_status,
        is_verified,
        id_photo_front_url,
        debtor_photo_url,
        signature_url
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
        .select("id, first_name, last_name, is_verified, id_photo_front_url, debtor_photo_url, signature_url")
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
      return NextResponse.json({ error: debtorError?.message || "Debtor not found" }, { status: 404 });
    }

    if ((debtor.approval_status || "approved") !== "approved") {
      return NextResponse.json({ error: "This debtor must be approved before a loan request can be submitted" }, { status: 400 });
    }

    const kycReady = Boolean(debtor.is_verified || hasCompleteKyc(debtor));
    const allowUnverifiedKyc = Boolean(payload.allowUnverifiedKyc);
    const specialPermissionNote = payload.specialPermissionNote?.trim() || null;

    if (!kycReady && !allowUnverifiedKyc) {
      return NextResponse.json({ error: "KYC is incomplete. Request special permission if the creditor should review this proposal anyway." }, { status: 400 });
    }

    if (!kycReady && allowUnverifiedKyc && !specialPermissionNote) {
      return NextResponse.json({ error: "Add a short permission note so the creditor understands why this unverified proposal should be reviewed." }, { status: 400 });
    }

    const interestAmount = Number(((principalAmount * interestRate) / 100).toFixed(2));
    const totalAmount = Number((principalAmount + interestAmount).toFixed(2));
    const dailyInstallment = Number((totalAmount / tenureDays).toFixed(2));
    const now = new Date().toISOString();

    const notes = [
      payload.notes?.trim() || null,
      !kycReady && allowUnverifiedKyc
        ? `[Special Permission Requested] ${specialPermissionNote}`
        : null,
    ].filter(Boolean).join("\n");

    const loanNumber = buildLoanNumber(startDate);

    const { data: loan, error: insertError } = await supabase
      .from("loans")
      .insert({
        creditor_id: session.creditorId,
        debtor_id: debtorId,
        collector_id: session.collector.id,
        requested_by_collector_id: session.collector.id,
        loan_number: loanNumber,
        principal_amount: principalAmount,
        interest_rate: interestRate,
        interest_amount: interestAmount,
        total_amount: totalAmount,
        daily_installment: dailyInstallment,
        tenure_days: tenureDays,
        start_date: startDate,
        end_date: addDays(startDate, tenureDays),
        status: "pending_approval",
        amount_collected: 0,
        amount_remaining: totalAmount,
        approved_by: null,
        approved_at: null,
        rejected_at: null,
        rejection_note: null,
        notes: notes || null,
        created_at: now,
        updated_at: now,
      })
      .select("id, loan_number, status, total_amount, daily_installment")
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    const collectorName = `${session.appUser.first_name || ""} ${session.appUser.last_name || ""}`.trim() || "Collector";
    await supabase.from("notifications").insert({
      user_id: session.creditorId,
      title: "Loan approval requested",
      message: `${collectorName} submitted ${debtorName(debtor)} for loan approval.`,
      type: "system",
      is_read: false,
      data: {
        loan_id: loan.id,
        debtor_id: debtorId,
        collector_id: session.collector.id,
        approval_status: "pending_approval",
      },
    });

    return NextResponse.json({
      ok: true,
      loan: {
        id: loan.id,
        loanNumber: loan.loan_number,
        status: loan.status,
        totalAmount: toNumber(loan.total_amount),
        dailyInstallment: toNumber(loan.daily_installment),
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to submit loan request";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
