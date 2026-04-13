import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAppSessionContextByClerkId } from "@/lib/auth/get-app-session-context";
import { getTodayDate, loadMobileCollectorCaptureByClerkId, MobileCollectorCaptureError } from "@/lib/mobile-collector-capture";

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

type CaptureItemInput = {
  id?: string;
  collectionId?: string | null;
  loanId?: string;
  debtorId?: string;
  amountDue?: number;
  amount?: number;
  method?: string;
  status?: string;
  notes?: string | null;
  collectionDate?: string;
  capturedAt?: string;
};

type LoanRow = {
  id: string;
  amount_collected: number | string | null;
  amount_remaining: number | string | null;
  total_amount: number | string | null;
  missed_payments: number | null;
  status: string | null;
};

function toNumber(value: number | string | null | undefined) {
  return Number(value || 0);
}

function normalizeStatus(status: string | undefined, amountCollected: number, amountDue: number) {
  if (status === "missed" || status === "deferred") return status;
  if (amountCollected <= 0) return "missed";
  if (amountCollected < amountDue) return "partial";
  return "collected";
}

async function syncLoanForCollectionChange(params: {
  supabase: ReturnType<typeof createAdminClient>;
  loanId: string;
  nextAmountCollected: number;
  previousAmountCollected: number;
  nextStatus: string;
  previousStatus: string;
}) {
  const { supabase, loanId, nextAmountCollected, previousAmountCollected, nextStatus, previousStatus } = params;
  const { data: loan, error: loanError } = await supabase
    .from("loans")
    .select("id, amount_collected, amount_remaining, total_amount, missed_payments, status")
    .eq("id", loanId)
    .maybeSingle();

  if (loanError || !loan) {
    throw new Error(loanError?.message || "Loan not found while syncing collection");
  }

  const currentLoan = loan as LoanRow;
  const delta = nextAmountCollected - previousAmountCollected;
  const currentCollected = toNumber(currentLoan.amount_collected);
  const currentRemaining = currentLoan.amount_remaining == null
    ? Math.max(toNumber(currentLoan.total_amount) - currentCollected, 0)
    : toNumber(currentLoan.amount_remaining);
  const nextCollected = Math.max(currentCollected + delta, 0);
  const nextRemaining = Math.max(currentRemaining - delta, 0);
  const missedDelta = (nextStatus === "missed" ? 1 : 0) - (previousStatus === "missed" ? 1 : 0);
  const nextMissedPayments = Math.max((currentLoan.missed_payments || 0) + missedDelta, 0);

  let nextLoanStatus = currentLoan.status || "active";
  if (nextRemaining <= 0) {
    nextLoanStatus = "completed";
  } else if (currentLoan.status === "approved") {
    nextLoanStatus = "active";
  }

  const { error: updateError } = await supabase
    .from("loans")
    .update({
      amount_collected: nextCollected,
      amount_remaining: nextRemaining,
      missed_payments: nextMissedPayments,
      status: nextLoanStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("id", loanId);

  if (updateError) {
    throw new Error(updateError.message);
  }
}

async function applyCollectionItem(params: {
  supabase: ReturnType<typeof createAdminClient>;
  creditorId: string;
  collectorId: string;
  item: CaptureItemInput;
}) {
  const { supabase, creditorId, collectorId, item } = params;
  const collectionDate = item.collectionDate || getTodayDate();
  const amountDue = Math.max(Number(item.amountDue || 0), 0);
  const amountCollected = Math.max(Number(item.amount || 0), 0);
  const nextStatus = normalizeStatus(item.status, amountCollected, amountDue);
  const paymentMethod = item.method === "mobile" ? "mobile_money" : item.method || "cash";

  if (!item.loanId || !item.debtorId) {
    throw new Error("loanId and debtorId are required");
  }

  let existing: DbCollectionRow | null = null;

  if (item.collectionId) {
    const { data, error } = await supabase
      .from("collections")
      .select("id, loan_id, debtor_id, collector_id, creditor_id, amount_due, amount_collected, collection_date, status, payment_method, notes, collected_at")
      .eq("id", item.collectionId)
      .eq("collector_id", collectorId)
      .eq("creditor_id", creditorId)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    existing = (data as DbCollectionRow | null) || null;
  }

  if (!existing) {
    const { data, error } = await supabase
      .from("collections")
      .select("id, loan_id, debtor_id, collector_id, creditor_id, amount_due, amount_collected, collection_date, status, payment_method, notes, collected_at")
      .eq("loan_id", item.loanId)
      .eq("debtor_id", item.debtorId)
      .eq("collector_id", collectorId)
      .eq("creditor_id", creditorId)
      .eq("collection_date", collectionDate)
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    existing = (data as DbCollectionRow | null) || null;
  }

  const previousAmountCollected = toNumber(existing?.amount_collected);
  const previousStatus = existing?.status || "pending";

  let persisted: DbCollectionRow | null = null;

  if (existing) {
    const { data, error } = await supabase
      .from("collections")
      .update({
        amount_due: amountDue,
        amount_collected: amountCollected,
        status: nextStatus,
        payment_method: paymentMethod,
        notes: item.notes || null,
        collected_at: item.capturedAt || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id)
      .select("id, loan_id, debtor_id, collector_id, creditor_id, amount_due, amount_collected, collection_date, status, payment_method, notes, collected_at")
      .single();

    if (error) {
      throw new Error(error.message);
    }

    persisted = data as DbCollectionRow;
  } else {
    const { data, error } = await supabase
      .from("collections")
      .insert({
        loan_id: item.loanId,
        debtor_id: item.debtorId,
        collector_id: collectorId,
        creditor_id: creditorId,
        amount_due: amountDue,
        amount_collected: amountCollected,
        collection_date: collectionDate,
        status: nextStatus,
        payment_method: paymentMethod,
        notes: item.notes || null,
        collected_at: item.capturedAt || new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select("id, loan_id, debtor_id, collector_id, creditor_id, amount_due, amount_collected, collection_date, status, payment_method, notes, collected_at")
      .single();

    if (error) {
      throw new Error(error.message);
    }

    persisted = data as DbCollectionRow;
  }

  await syncLoanForCollectionChange({
    supabase,
    loanId: item.loanId,
    nextAmountCollected: amountCollected,
    previousAmountCollected,
    nextStatus,
    previousStatus,
  });

  return persisted;
}

export async function GET(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date") || getTodayDate();
    const payload = await loadMobileCollectorCaptureByClerkId(userId, date);
    return NextResponse.json(payload);
  } catch (error: unknown) {
    if (error instanceof MobileCollectorCaptureError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    const message = error instanceof Error ? error.message : "Failed to load collector capture context";
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

    const supabase = createAdminClient();
    const payload = (await req.json()) as { items?: CaptureItemInput[] } & CaptureItemInput;
    const items = Array.isArray(payload.items) ? payload.items : [payload];

    if (items.length === 0) {
      return NextResponse.json({ error: "At least one collection item is required" }, { status: 400 });
    }

    const results: DbCollectionRow[] = [];

    for (const item of items) {
      const saved = await applyCollectionItem({
        supabase,
        creditorId: session.creditorId,
        collectorId: session.collector.id,
        item,
      });
      results.push(saved);
    }

    return NextResponse.json({
      ok: true,
      saved: results.length,
      collections: results,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to save collection";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
