import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAppSessionContextByClerkId } from "@/lib/auth/get-app-session-context";

type DbCollectionRow = {
  id: string;
  loan_id: string;
  debtor_id: string;
  amount_due: number | string | null;
  amount_collected: number | string | null;
  collection_date: string;
  status: string | null;
  collected_at: string | null;
  loan?: {
    id?: string | null;
    loan_number?: string | null;
    daily_installment?: number | string | null;
    amount_remaining?: number | string | null;
    status?: string | null;
  } | null;
  debtor?: {
    id?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    phone?: string | null;
    address?: string | null;
    route?: {
      id?: string | null;
      name?: string | null;
      area?: string | null;
    } | Array<{
      id?: string | null;
      name?: string | null;
      area?: string | null;
    }> | null;
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
    route?: {
      id?: string | null;
      name?: string | null;
      area?: string | null;
    } | Array<{
      id?: string | null;
      name?: string | null;
      area?: string | null;
    }> | null;
  } | null;
};

type RouteRunStop = {
  collectionId: string | null;
  loanId: string;
  debtorId: string;
  debtorName: string;
  phone: string | null;
  address: string | null;
  routeId: string | null;
  routeName: string;
  routeArea: string | null;
  loanNumber: string;
  amountDue: number;
  amountCollected: number;
  amountRemaining: number;
  dailyInstallment: number;
  status: string;
  collectionDate: string;
  collectedAt: string | null;
  overdue: boolean;
};

function toNumber(value: number | string | null | undefined) {
  return Number(value || 0);
}

function getTodayDate() {
  return new Date().toISOString().slice(0, 10);
}

function routeValue<T>(route: T | T[] | null | undefined) {
  return Array.isArray(route) ? route[0] || null : route || null;
}

function stopPriority(status: string, overdue: boolean) {
  if (status === "pending" && overdue) return 0;
  if (status === "partial") return 1;
  if (status === "missed") return 2;
  if (status === "deferred") return 3;
  if (status === "pending") return 4;
  return 5;
}

function routeSortScore(route: { pending: number; attention: number; expected: number }) {
  return route.pending * 1000 + route.attention * 100 + route.expected;
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

    const supabase = createAdminClient();
    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date") || getTodayDate();

    const [collectionsResult, loanResult] = await Promise.all([
      supabase
        .from("collections")
        .select(`
          id,
          loan_id,
          debtor_id,
          amount_due,
          amount_collected,
          collection_date,
          status,
          collected_at,
          loan:loans!loan_id(id, loan_number, daily_installment, amount_remaining, status),
          debtor:debtors!debtor_id(
            id,
            first_name,
            last_name,
            phone,
            address,
            route:routes(id, name, area)
          )
        `)
        .eq("creditor_id", session.creditorId)
        .eq("collector_id", session.collector.id)
        .eq("collection_date", date)
        .order("created_at", { ascending: true }),
      supabase
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
          debtor:debtors!debtor_id(
            id,
            first_name,
            last_name,
            phone,
            address,
            route:routes(id, name, area)
          )
        `)
        .eq("creditor_id", session.creditorId)
        .eq("collector_id", session.collector.id)
        .in("status", ["approved", "active", "overdue"])
        .lte("start_date", date)
        .gte("end_date", date)
        .order("start_date", { ascending: true }),
    ]);

    if (collectionsResult.error) {
      return NextResponse.json({ error: collectionsResult.error.message }, { status: 500 });
    }

    if (loanResult.error) {
      return NextResponse.json({ error: loanResult.error.message }, { status: 500 });
    }

    const collectionRows = (collectionsResult.data as DbCollectionRow[] | null) || [];
    const collectionByLoanId = new Map(collectionRows.map((row) => [row.loan_id, row]));
    const loanRows = (loanResult.data as LoanScheduleRow[] | null) || [];

    const mergedStops = loanRows.map((loan) => {
      const existing = collectionByLoanId.get(loan.id);
      const debtor = existing?.debtor || loan.debtor;
      const route = routeValue(debtor?.route);
      const amountRemaining = toNumber(existing?.loan?.amount_remaining ?? loan.amount_remaining);
      const dailyInstallment = toNumber(existing?.loan?.daily_installment ?? loan.daily_installment);
      const amountDue = existing
        ? toNumber(existing.amount_due)
        : Math.min(dailyInstallment || amountRemaining, amountRemaining || dailyInstallment);
      const status = existing?.status || "pending";
      const overdue = String(existing?.loan?.status || loan.status || "") === "overdue";

      return {
        collectionId: existing?.id || null,
        loanId: loan.id,
        debtorId: loan.debtor_id,
        debtorName: `${debtor?.first_name || ""} ${debtor?.last_name || ""}`.trim() || "Debtor",
        phone: debtor?.phone || null,
        address: debtor?.address || null,
        routeId: route?.id || null,
        routeName: route?.name || "Unassigned route",
        routeArea: route?.area || null,
        loanNumber: existing?.loan?.loan_number || loan.loan_number || "Loan",
        amountDue,
        amountCollected: toNumber(existing?.amount_collected),
        amountRemaining,
        dailyInstallment,
        status,
        collectionDate: existing?.collection_date || date,
        collectedAt: existing?.collected_at || null,
        overdue,
      };
    });

    const orphanStops = collectionRows
      .filter((row) => !loanRows.some((loan) => loan.id === row.loan_id))
      .map((row) => {
        const route = routeValue(row.debtor?.route);
        return {
          collectionId: row.id,
          loanId: row.loan_id,
          debtorId: row.debtor_id,
          debtorName: `${row.debtor?.first_name || ""} ${row.debtor?.last_name || ""}`.trim() || "Debtor",
          phone: row.debtor?.phone || null,
          address: row.debtor?.address || null,
          routeId: route?.id || null,
          routeName: route?.name || "Unassigned route",
          routeArea: route?.area || null,
          loanNumber: row.loan?.loan_number || "Loan",
          amountDue: toNumber(row.amount_due),
          amountCollected: toNumber(row.amount_collected),
          amountRemaining: toNumber(row.loan?.amount_remaining),
          dailyInstallment: toNumber(row.loan?.daily_installment),
          status: row.status || "pending",
          collectionDate: row.collection_date,
          collectedAt: row.collected_at || null,
          overdue: String(row.loan?.status || "") === "overdue",
        };
      });

    const stops = [...mergedStops, ...orphanStops].sort((left, right) => {
      const leftPriority = stopPriority(left.status, left.overdue);
      const rightPriority = stopPriority(right.status, right.overdue);
      if (leftPriority !== rightPriority) return leftPriority - rightPriority;
      return left.debtorName.localeCompare(right.debtorName);
    });

    const routeMap = new Map<string, {
      id: string;
      name: string;
      area: string | null;
      expected: number;
      collected: number;
      pending: number;
      attention: number;
      stops: RouteRunStop[];
    }>();

    for (const stop of stops) {
      const key = stop.routeId || `unassigned:${stop.routeName}`;
      if (!routeMap.has(key)) {
        routeMap.set(key, {
          id: stop.routeId || "unassigned",
          name: stop.routeName,
          area: stop.routeArea,
          expected: 0,
          collected: 0,
          pending: 0,
          attention: 0,
          stops: [],
        });
      }
      const route = routeMap.get(key)!;
      route.expected += stop.amountDue;
      route.collected += stop.amountCollected;
      if (["pending", "partial", "missed", "deferred"].includes(stop.status)) {
        route.pending += 1;
      }
      if (stop.overdue || ["partial", "missed", "deferred"].includes(stop.status)) {
        route.attention += 1;
      }
      route.stops.push(stop);
    }

    const routes = Array.from(routeMap.values()).sort((left, right) => {
      const scoreDiff = routeSortScore(right) - routeSortScore(left);
      if (scoreDiff !== 0) return scoreDiff;
      return left.name.localeCompare(right.name);
    });

    const expected = stops.reduce((sum, stop) => sum + stop.amountDue, 0);
    const collected = stops.reduce((sum, stop) => sum + stop.amountCollected, 0);
    const pendingStops = stops.filter((stop) => ["pending", "partial", "missed", "deferred"].includes(stop.status)).length;
    const attentionStops = stops.filter((stop) => stop.overdue || ["partial", "missed", "deferred"].includes(stop.status)).length;
    const completedStops = stops.filter((stop) => stop.status === "collected").length;
    const nextStop = stops.find((stop) => stop.status === "pending" || stop.status === "partial") || stops[0] || null;

    return NextResponse.json({
      collectionDate: date,
      organization: session.organization,
      summary: {
        expected,
        collected,
        pendingStops,
        completedStops,
        attentionStops,
        routeCount: routes.length,
      },
      nextStop: nextStop
        ? {
            loanId: nextStop.loanId,
            debtorName: nextStop.debtorName,
            routeName: nextStop.routeName,
            amountDue: nextStop.amountDue,
            status: nextStop.status,
          }
        : null,
      attention: stops
        .filter((stop) => stop.overdue || ["partial", "missed", "deferred"].includes(stop.status))
        .slice(0, 5)
        .map((stop) => ({
          loanId: stop.loanId,
          debtorName: stop.debtorName,
          routeName: stop.routeName,
          amountDue: stop.amountDue,
          status: stop.status,
          overdue: stop.overdue,
        })),
      routes,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load route run";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
