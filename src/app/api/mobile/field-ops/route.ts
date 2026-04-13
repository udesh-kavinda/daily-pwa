import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAppSessionContextByClerkId } from "@/lib/auth/get-app-session-context";

type CollectorRow = {
  id: string;
  user_id: string | null;
  employee_code: string | null;
  assigned_routes: string[] | null;
  is_active: boolean;
  phone: string | null;
  user?: {
    id?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    phone?: string | null;
  } | null;
};

type CollectionRow = {
  collector_id: string | null;
  amount_due: number | string | null;
  amount_collected: number | string | null;
  status: string | null;
};

type SettlementRow = {
  id: string;
  collector_id: string;
  settlement_date: string;
  expected_amount: number | string | null;
  actual_amount: number | string | null;
  difference_amount: number | string | null;
  status: "pending" | "verified" | "disputed";
  notes: string | null;
  created_at: string;
  updated_at: string;
  verified_at: string | null;
  collector?: {
    id?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    phone?: string | null;
  } | null;
};

type ActionPayload = {
  settlementId?: string;
  decision?: "verify" | "dispute";
  note?: string | null;
};

function toNumber(value: number | string | null | undefined) {
  return Number(value || 0);
}

function getTodayDate() {
  return new Date().toISOString().slice(0, 10);
}

function getRecentWindowStart() {
  const date = new Date();
  date.setDate(date.getDate() - 6);
  return date.toISOString().slice(0, 10);
}

function getCollectorName(row: CollectorRow | null | undefined) {
  const name = `${row?.user?.first_name || ""} ${row?.user?.last_name || ""}`.trim();
  if (name) return name;
  if (row?.employee_code) return `Collector ${row.employee_code}`;
  return "Collector";
}

function getSettlementCollectorName(row: SettlementRow | null | undefined) {
  const name = `${row?.collector?.first_name || ""} ${row?.collector?.last_name || ""}`.trim();
  return name || "Collector";
}

async function notifyCollector(params: {
  supabase: ReturnType<typeof createAdminClient>;
  userId: string;
  title: string;
  message: string;
  data: Record<string, unknown>;
}) {
  const { supabase, userId, title, message, data } = params;
  await supabase.from("notifications").insert({
    user_id: userId,
    title,
    message,
    type: "system",
    is_read: false,
    data,
  });
}

export async function GET(request: Request) {
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
    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date") || getTodayDate();
    const recentWindowStart = getRecentWindowStart();

    const [collectorsResult, collectionsResult, settlementsResult] = await Promise.all([
      supabase
        .from("collectors")
        .select(`
          id,
          user_id,
          employee_code,
          assigned_routes,
          is_active,
          phone,
          user:users!user_id(id, first_name, last_name, phone)
        `)
        .eq("creditor_id", session.creditorId)
        .order("created_at", { ascending: true }),
      supabase
        .from("collections")
        .select("collector_id, amount_due, amount_collected, status")
        .eq("creditor_id", session.creditorId)
        .eq("collection_date", date),
      supabase
        .from("settlements")
        .select(`
          id,
          collector_id,
          settlement_date,
          expected_amount,
          actual_amount,
          difference_amount,
          status,
          notes,
          created_at,
          updated_at,
          verified_at,
          collector:users!collector_id(id, first_name, last_name, phone)
        `)
        .eq("creditor_id", session.creditorId)
        .gte("settlement_date", recentWindowStart)
        .order("settlement_date", { ascending: false })
        .order("created_at", { ascending: false }),
    ]);

    if (collectorsResult.error) {
      throw new Error(collectorsResult.error.message);
    }
    if (collectionsResult.error) {
      throw new Error(collectionsResult.error.message);
    }
    if (settlementsResult.error) {
      throw new Error(settlementsResult.error.message);
    }

    const collectors = (collectorsResult.data as CollectorRow[] | null) || [];
    const todayCollections = (collectionsResult.data as CollectionRow[] | null) || [];
    const settlements = (settlementsResult.data as SettlementRow[] | null) || [];

    const collectionStats = new Map<string, {
      expected: number;
      collected: number;
      openStops: number;
      completedStops: number;
    }>();

    for (const row of todayCollections) {
      if (!row.collector_id) continue;
      const current = collectionStats.get(row.collector_id) || {
        expected: 0,
        collected: 0,
        openStops: 0,
        completedStops: 0,
      };

      current.expected += toNumber(row.amount_due);
      current.collected += toNumber(row.amount_collected);

      const status = String(row.status || "pending");
      if (status === "pending" || status === "partial" || status === "deferred") {
        current.openStops += 1;
      } else {
        current.completedStops += 1;
      }

      collectionStats.set(row.collector_id, current);
    }

    const collectorByUserId = new Map<string, CollectorRow>();
    for (const collector of collectors) {
      if (collector.user_id) {
        collectorByUserId.set(collector.user_id, collector);
      }
    }

    const todaysSettlements = settlements.filter((row) => row.settlement_date === date);
    const settlementReviews = settlements
      .filter((row) => row.status !== "verified" || Math.abs(toNumber(row.difference_amount)) > 0)
      .map((row) => ({
        id: row.id,
        collectorId: collectorByUserId.get(row.collector_id)?.id || null,
        collectorUserId: row.collector_id,
        collectorName: getSettlementCollectorName(row),
        employeeCode: collectorByUserId.get(row.collector_id)?.employee_code || null,
        collectorPhone: row.collector?.phone || null,
        routeCount: collectorByUserId.get(row.collector_id)?.assigned_routes?.length || 0,
        expectedAmount: toNumber(row.expected_amount),
        actualAmount: toNumber(row.actual_amount),
        differenceAmount: toNumber(row.difference_amount),
        status: row.status,
        notes: row.notes || null,
        submittedAt: row.created_at,
        reviewedAt: row.verified_at || null,
        collectedToday: collectorByUserId.get(row.collector_id)?.id
          ? collectionStats.get(collectorByUserId.get(row.collector_id)!.id)?.collected || 0
          : 0,
        openStops: collectorByUserId.get(row.collector_id)?.id
          ? collectionStats.get(collectorByUserId.get(row.collector_id)!.id)?.openStops || 0
          : 0,
      }));

    const awaitingCollectors = collectors
      .map((collector) => {
        const stats = collectionStats.get(collector.id) || {
          expected: 0,
          collected: 0,
          openStops: 0,
          completedStops: 0,
        };
        const todaysSettlement = collector.user_id
          ? todaysSettlements.find((row) => row.collector_id === collector.user_id) || null
          : null;

        if (stats.collected <= 0 || todaysSettlement) {
          return null;
        }

        return {
          collectorId: collector.id,
          collectorUserId: collector.user_id,
          collectorName: getCollectorName(collector),
          employeeCode: collector.employee_code || null,
          phone: collector.phone || collector.user?.phone || null,
          routeCount: collector.assigned_routes?.length || 0,
          collectedToday: stats.collected,
          expectedToday: stats.expected,
          completedStops: stats.completedStops,
          openStops: stats.openStops,
        };
      })
      .filter(Boolean);

    const submittedCollectors = new Set(todaysSettlements.map((row) => row.collector_id)).size;
    const varianceAtRisk = settlementReviews.reduce((sum, row) => sum + Math.abs(row.differenceAmount), 0);

    return NextResponse.json({
      date,
      organization: session.organization,
      summary: {
        recoveredToday: todayCollections.reduce((sum, row) => sum + toNumber(row.amount_collected), 0),
        submittedCollectors,
        activeCollectors: collectors.filter((collector) => collector.is_active).length,
        pendingReview: settlementReviews.filter((item) => item.status === "pending").length,
        disputed: settlementReviews.filter((item) => item.status === "disputed").length,
        awaitingHandover: awaitingCollectors.length,
        varianceAtRisk,
      },
      settlements: settlementReviews,
      awaitingCollectors,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load field operations";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const session = await getAppSessionContextByClerkId(userId);
    if (session.role !== "creditor") {
      return NextResponse.json({ error: "Creditor access is required" }, { status: 403 });
    }

    const payload = (await request.json().catch(() => null)) as ActionPayload | null;
    if (!payload?.settlementId || !payload?.decision) {
      return NextResponse.json({ error: "settlementId and decision are required" }, { status: 400 });
    }

    if (payload.decision === "dispute" && !payload.note?.trim()) {
      return NextResponse.json({ error: "Add a note before disputing a settlement" }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { data: settlement, error: settlementError } = await supabase
      .from("settlements")
      .select("id, collector_id, status, notes")
      .eq("id", payload.settlementId)
      .eq("creditor_id", session.creditorId)
      .maybeSingle();

    if (settlementError || !settlement) {
      return NextResponse.json({ error: settlementError?.message || "Settlement not found" }, { status: 404 });
    }

    const now = new Date().toISOString();
    const nextNotes = payload.note?.trim() || settlement.notes || null;
    const updates =
      payload.decision === "verify"
        ? {
            status: "verified",
            notes: nextNotes,
            verified_by: session.appUser.id,
            verified_at: now,
            updated_at: now,
          }
        : {
            status: "disputed",
            notes: nextNotes,
            verified_by: null,
            verified_at: null,
            updated_at: now,
          };

    const { error: updateError } = await supabase
      .from("settlements")
      .update(updates)
      .eq("id", settlement.id);

    if (updateError) {
      throw new Error(updateError.message);
    }

    await notifyCollector({
      supabase,
      userId: settlement.collector_id,
      title: payload.decision === "verify" ? "Settlement verified" : "Settlement disputed",
      message: payload.decision === "verify"
        ? "Your cash handover was verified by the creditor."
        : `Your cash handover needs review: ${nextNotes || "Please contact the creditor."}`,
      data: {
        settlementId: settlement.id,
        decision: payload.decision,
      },
    });

    return NextResponse.json({
      ok: true,
      settlementId: settlement.id,
      status: updates.status,
      decision: payload.decision,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to update settlement";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
