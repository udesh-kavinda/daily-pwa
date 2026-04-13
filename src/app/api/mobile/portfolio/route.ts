import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAppSessionContextByClerkId } from "@/lib/auth/get-app-session-context";
import { getDebtorPortalData } from "@/lib/debtor-portal";
import { formatBorrowerStatus } from "@/lib/borrower-copy";

function toNumber(value: number | string | null | undefined) {
  return Number(value || 0);
}

function formatDate(date: string | null) {
  if (!date) return null;
  return new Intl.DateTimeFormat("en-LK", { month: "short", day: "numeric" }).format(new Date(date));
}

type CollectorPortfolioRow = {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  approval_status?: string | null;
  requested_by_collector_id?: string | null;
  route?: { name?: string | null } | Array<{ name?: string | null }> | null;
};

type QueryError = { message: string } | null;

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createAdminClient();
    const session = await getAppSessionContextByClerkId(userId);

    if (session.role === "debtor") {
      const portal = await getDebtorPortalData(session);
      return NextResponse.json({
        role: session.role,
        items: portal.loans.map((loan) => ({
          id: loan.id,
          title: loan.loanNumber,
          subtitle: `${loan.creditorName} · Collector ${loan.collectorName}`,
          meta: loan.nextCollection?.date ? `Next visit ${formatDate(loan.nextCollection.date)}` : formatBorrowerStatus(loan.status),
          value: loan.amountRemaining,
          displayValue: new Intl.NumberFormat("en-LK", {
            style: "currency",
            currency: "LKR",
            maximumFractionDigits: 0,
          }).format(loan.amountRemaining),
          tone: loan.nextCollection ? "emerald" : "ink",
        })),
      });
    }

    if (session.role === "collector") {
      if (!session.collector) {
        return NextResponse.json({ role: session.role, items: [] });
      }

      const collectorFilter = `collector_id.eq.${session.collector.id},requested_by_collector_id.eq.${session.collector.id}`;

      let { data: debtors, error: debtorsError }: { data: CollectorPortfolioRow[] | null; error: QueryError } = await supabase
        .from("debtors")
        .select("id, first_name, last_name, approval_status, route:routes(name), requested_by_collector_id")
        .eq("creditor_id", session.creditorId)
        .or(collectorFilter)
        .order("updated_at", { ascending: false });

      if (debtorsError && debtorsError.message.includes("requested_by_collector_id")) {
        const legacyResult = await supabase
          .from("debtors")
          .select("id, first_name, last_name, route:routes(name)")
          .eq("creditor_id", session.creditorId)
          .eq("collector_id", session.collector.id)
          .order("updated_at", { ascending: false });

        debtors = (legacyResult.data || []).map((debtor) => ({
          ...debtor,
          approval_status: "approved",
          requested_by_collector_id: null,
        }));
        debtorsError = legacyResult.error;
      }

      if (debtorsError) {
        return NextResponse.json({ error: debtorsError.message }, { status: 500 });
      }

      const debtorIds = (debtors || []).map((debtor) => debtor.id);
      const [{ data: loans, error: loansError }, { data: collections, error: collectionsError }] = debtorIds.length > 0
        ? await Promise.all([
            supabase
              .from("loans")
              .select("id, debtor_id, status")
              .eq("creditor_id", session.creditorId)
              .eq("collector_id", session.collector.id)
              .in("debtor_id", debtorIds),
            supabase
              .from("collections")
              .select("debtor_id, amount_due, collection_date, status")
              .eq("collector_id", session.collector.id)
              .in("debtor_id", debtorIds)
              .in("status", ["pending", "partial", "deferred"])
              .order("collection_date", { ascending: true }),
          ])
        : [{ data: [], error: null }, { data: [], error: null }];

      if (loansError) return NextResponse.json({ error: loansError.message }, { status: 500 });
      if (collectionsError) return NextResponse.json({ error: collectionsError.message }, { status: 500 });

      const loansByDebtor = new Map<string, number>();
      for (const loan of loans || []) {
        if (!["active", "overdue", "pending_approval", "approved"].includes(String(loan.status || ""))) continue;
        loansByDebtor.set(loan.debtor_id, (loansByDebtor.get(loan.debtor_id) || 0) + 1);
      }

      const nextCollectionByDebtor = new Map<string, { amount_due: number | string | null; collection_date: string; status: string | null }>();
      for (const row of collections || []) {
        if (!nextCollectionByDebtor.has(row.debtor_id)) {
          nextCollectionByDebtor.set(row.debtor_id, row);
        }
      }

      return NextResponse.json({
        role: session.role,
        items: (debtors || []).map((debtor) => {
          const next = nextCollectionByDebtor.get(debtor.id);
          const route = Array.isArray(debtor.route) ? debtor.route[0] : debtor.route;
          const approvalStatus = String(debtor.approval_status || "approved");
          const submittedByCollector = Boolean(debtor.requested_by_collector_id);
          const pendingApproval = approvalStatus === "pending_approval";
          const rejected = approvalStatus === "rejected";
          return {
            id: debtor.id,
            title: `${debtor.first_name || ""} ${debtor.last_name || ""}`.trim() || "Debtor",
            subtitle: route?.name || "Route not assigned",
            meta: pendingApproval
              ? "Pending approval"
              : rejected
                ? "Needs revision"
                : next
                  ? `Next ${formatDate(next.collection_date)}`
                  : submittedByCollector
                    ? "Approved debtor"
                    : "No collection scheduled",
            value: next ? toNumber(next.amount_due) : loansByDebtor.get(debtor.id) || 0,
            displayValue: next
              ? new Intl.NumberFormat("en-LK", {
                  style: "currency",
                  currency: "LKR",
                  maximumFractionDigits: 0,
                }).format(toNumber(next.amount_due))
              : `${loansByDebtor.get(debtor.id) || 0} live loans`,
            tone: pendingApproval || rejected ? "amber" : next ? "emerald" : "ink",
          };
        }),
      });
    }

    const [pendingLoansResult, collectorsResult, routesResult] = await Promise.all([
      supabase
        .from("loans")
        .select("id, loan_number, total_amount, debtor:debtors(first_name,last_name)")
        .eq("creditor_id", session.creditorId)
        .eq("status", "pending_approval")
        .order("created_at", { ascending: false })
        .limit(6),
      supabase
        .from("collectors")
        .select("id, employee_code, first_name, last_name, user:users!user_id(first_name,last_name)")
        .eq("creditor_id", session.creditorId)
        .order("created_at", { ascending: false })
        .limit(6),
      supabase
        .from("routes")
        .select("id, name, area")
        .eq("creditor_id", session.creditorId)
        .order("updated_at", { ascending: false })
        .limit(6),
    ]);

    if (pendingLoansResult.error) return NextResponse.json({ error: pendingLoansResult.error.message }, { status: 500 });
    if (collectorsResult.error) return NextResponse.json({ error: collectorsResult.error.message }, { status: 500 });
    if (routesResult.error) return NextResponse.json({ error: routesResult.error.message }, { status: 500 });

    const items = [
      ...(pendingLoansResult.data || []).map((loan) => {
        const debtor = Array.isArray(loan.debtor) ? loan.debtor[0] : loan.debtor;
        return {
          id: `loan-${loan.id}`,
          title: loan.loan_number,
          subtitle: `${debtor?.first_name || ""} ${debtor?.last_name || ""}`.trim() || "Debtor request",
          meta: "Approval pending",
          value: toNumber(loan.total_amount),
          displayValue: new Intl.NumberFormat("en-LK", {
            style: "currency",
            currency: "LKR",
            maximumFractionDigits: 0,
          }).format(toNumber(loan.total_amount)),
          tone: "amber",
        };
      }),
      ...(collectorsResult.data || []).map((collector) => {
        const user = Array.isArray(collector.user) ? collector.user[0] : collector.user;
        const name = `${collector.first_name || user?.first_name || ""} ${collector.last_name || user?.last_name || ""}`.trim() || collector.employee_code || "Collector";
        return {
          id: `collector-${collector.id}`,
          title: name,
          subtitle: collector.employee_code || "Collector profile",
          meta: "Field team",
          value: 0,
          displayValue: "Collector",
          tone: "ink",
        };
      }),
      ...(routesResult.data || []).map((route) => ({
        id: `route-${route.id}`,
        title: route.name,
        subtitle: route.area || "Coverage area",
        meta: "Route",
        value: 0,
        displayValue: route.area || "Coverage area",
        tone: "emerald",
      })),
    ];

    return NextResponse.json({ role: session.role, items });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load mobile portfolio";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
