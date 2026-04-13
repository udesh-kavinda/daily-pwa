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
  return new Intl.DateTimeFormat("en-LK", {
    month: "short",
    day: "numeric",
  }).format(new Date(date));
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-LK", {
    style: "currency",
    currency: "LKR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createAdminClient();
    const session = await getAppSessionContextByClerkId(userId);
    const today = new Date().toISOString().slice(0, 10);

    if (session.role === "collector") {
      if (!session.collector) {
        return NextResponse.json({
          role: "collector",
          overview: {
            hero: {
              eyebrow: "Collector workspace",
              title: "Link your collector profile",
              summary: "Your mobile workspace becomes live as soon as your collector account is linked.",
              primaryAction: "Open profile",
              secondaryAction: "Review setup",
            },
            metrics: [],
            focus: [],
            activity: [],
          },
        });
      }

      const [collectionsResult, debtorsResult, loansResult, notificationsResult] = await Promise.all([
        supabase
          .from("collections")
          .select("id, amount_due, amount_collected, status, collection_date, debtor_id, loan_id")
          .eq("collector_id", session.collector.id)
          .eq("collection_date", today),
        supabase
          .from("debtors")
          .select("id")
          .eq("collector_id", session.collector.id)
          .eq("creditor_id", session.creditorId),
        supabase
          .from("loans")
          .select("id, status, amount_remaining")
          .eq("collector_id", session.collector.id)
          .eq("creditor_id", session.creditorId),
        supabase
          .from("notifications")
          .select("title, message, created_at")
          .eq("user_id", session.appUser.id)
          .order("created_at", { ascending: false })
          .limit(3),
      ]);

      if (collectionsResult.error) return NextResponse.json({ error: collectionsResult.error.message }, { status: 500 });
      if (debtorsResult.error) return NextResponse.json({ error: debtorsResult.error.message }, { status: 500 });
      if (loansResult.error) return NextResponse.json({ error: loansResult.error.message }, { status: 500 });
      if (notificationsResult.error) return NextResponse.json({ error: notificationsResult.error.message }, { status: 500 });

      const collections = collectionsResult.data || [];
      const todayTarget = collections.reduce((sum, row) => sum + toNumber(row.amount_due), 0);
      const todayCollected = collections.reduce((sum, row) => sum + toNumber(row.amount_collected), 0);
      const pendingStops = collections.filter((row) => row.status !== "collected").length;
      const missedStops = collections.filter((row) => row.status === "missed").length;
      const loans = loansResult.data || [];
      const activeLoans = loans.filter((loan) => loan.status === "active" || loan.status === "overdue").length;
      const overdueLoans = loans.filter((loan) => loan.status === "overdue").length;

      return NextResponse.json({
        role: session.role,
        organization: session.organization,
        overview: {
          hero: {
            eyebrow: session.organization?.name || "Collector workspace",
            title: "Stay sharp on every collection stop.",
            summary: "See today’s runway, what still needs attention, and how much cash is heading into settlement.",
            primaryAction: "Open route",
            secondaryAction: "Capture payment",
          },
          metrics: [
            {
              label: "Today to collect",
              value: todayTarget,
              displayValue: new Intl.NumberFormat("en-LK", {
                style: "currency",
                currency: "LKR",
                maximumFractionDigits: 0,
              }).format(todayTarget),
              change: `${pendingStops} stops remaining`,
              tone: "ink",
            },
            {
              label: "Collected so far",
              value: todayCollected,
              displayValue: new Intl.NumberFormat("en-LK", {
                style: "currency",
                currency: "LKR",
                maximumFractionDigits: 0,
              }).format(todayCollected),
              change: todayTarget > 0 ? `${Math.round((todayCollected / todayTarget) * 100)}% of target` : "No target yet",
              tone: "emerald",
            },
            {
              label: "Active accounts",
              value: Number((debtorsResult.data || []).length),
              displayValue: String(Number((debtorsResult.data || []).length)),
              change: `${activeLoans} live loans`,
              tone: overdueLoans > 0 ? "amber" : "ink",
            },
          ],
          focus: [
            {
              title: "Route runway",
              subtitle: `${pendingStops} visits still need attention today across your assigned debtors.`,
              amount: todayTarget,
              displayValue: new Intl.NumberFormat("en-LK", {
                style: "currency",
                currency: "LKR",
                maximumFractionDigits: 0,
              }).format(todayTarget),
              status: pendingStops > 0 ? "In progress" : "Route clear",
              tone: pendingStops > 0 ? "emerald" : "ink",
            },
            {
              title: "Watchlist follow-ups",
              subtitle: overdueLoans > 0 ? `${overdueLoans} overdue loan accounts need a closer conversation.` : "No overdue accounts are assigned to you right now.",
              amount: loans.filter((loan) => loan.status === "overdue").reduce((sum, loan) => sum + toNumber(loan.amount_remaining), 0),
              displayValue: overdueLoans > 0
                ? new Intl.NumberFormat("en-LK", {
                    style: "currency",
                    currency: "LKR",
                    maximumFractionDigits: 0,
                  }).format(
                    loans.filter((loan) => loan.status === "overdue").reduce((sum, loan) => sum + toNumber(loan.amount_remaining), 0)
                  )
                : "Stable",
              status: overdueLoans > 0 ? "Priority" : "Stable",
              tone: overdueLoans > 0 ? "amber" : "emerald",
            },
            {
              title: "Settlement outlook",
              subtitle: "Use this to reconcile what you should hand over at the end of the round.",
              amount: todayCollected,
              displayValue: new Intl.NumberFormat("en-LK", {
                style: "currency",
                currency: "LKR",
                maximumFractionDigits: 0,
              }).format(todayCollected),
              status: missedStops > 0 ? `${missedStops} missed` : "On rhythm",
              tone: missedStops > 0 ? "ink" : "emerald",
            },
          ],
          activity: (notificationsResult.data || []).map((item) => ({
            title: item.title,
            detail: item.message,
            time: formatDate(item.created_at) || "Now",
          })),
        },
      });
    }

    if (session.role === "debtor") {
      const portal = await getDebtorPortalData(session);
      return NextResponse.json({
        role: session.role,
        organization: session.organization,
        organizations: session.organizations,
        overview: {
          hero: {
            eyebrow: portal.summary.activeCreditors > 1 ? "Multiple creditors" : session.organization?.name || "Debtor portal",
            title: "Know what is due next and what is left to repay.",
            summary: "See each lender, the collector assigned to you, your next expected visit, and the amount still left on every loan in one place.",
            primaryAction: "See next visit",
            secondaryAction: "View all loans",
          },
          metrics: [
            {
              label: "Next expected amount",
              value: portal.summary.nextCollectionAmount,
              displayValue: new Intl.NumberFormat("en-LK", {
                style: "currency",
                currency: "LKR",
                maximumFractionDigits: 0,
              }).format(portal.summary.nextCollectionAmount),
              change: portal.summary.nextCollectionDate ? `Expected ${formatDate(portal.summary.nextCollectionDate)}` : "No visit booked yet",
              tone: portal.summary.nextCollectionAmount > 0 ? "amber" : "ink",
            },
            {
              label: "Still left to repay",
              value: portal.summary.totalOutstanding,
              displayValue: new Intl.NumberFormat("en-LK", {
                style: "currency",
                currency: "LKR",
                maximumFractionDigits: 0,
              }).format(portal.summary.totalOutstanding),
              change: `${portal.summary.activeLoans} active loans`,
              tone: "ink",
            },
            {
              label: "Estimated next 30 days",
              value: portal.summary.estimated30DayCommitment,
              displayValue: new Intl.NumberFormat("en-LK", {
                style: "currency",
                currency: "LKR",
                maximumFractionDigits: 0,
              }).format(portal.summary.estimated30DayCommitment),
              change: `${portal.summary.activeCreditors} lender relationship${portal.summary.activeCreditors === 1 ? "" : "s"}`,
              tone: "emerald",
            },
          ],
          focus: portal.loans.slice(0, 3).map((loan) => ({
            title: loan.loanNumber,
            subtitle: `${loan.creditorName} · Collector ${loan.collectorName}`,
            amount: loan.nextCollection?.amountDue || loan.amountRemaining,
            displayValue: new Intl.NumberFormat("en-LK", {
              style: "currency",
              currency: "LKR",
              maximumFractionDigits: 0,
            }).format(loan.nextCollection?.amountDue || loan.amountRemaining),
            status: loan.nextCollection?.date ? `Next visit ${formatDate(loan.nextCollection.date)}` : `Status: ${formatBorrowerStatus(loan.status)}`,
            tone: loan.nextCollection ? "amber" : "ink",
          })),
          activity: portal.loans.slice(0, 3).map((loan) => ({
            title: `${loan.loanNumber} · ${loan.creditorName}`,
            detail: `${loan.collectorName} is handling this loan. ${formatCurrency(loan.amountRemaining)} is still left to repay.`,
            time: loan.nextCollection?.date ? `Visit ${formatDate(loan.nextCollection.date) || "soon"}` : formatBorrowerStatus(loan.status),
          })),
        },
      });
    }

    const [loansResult, collectionsResult, collectorsResult] = await Promise.all([
      supabase
        .from("loans")
        .select("id, status, total_amount")
        .eq("creditor_id", session.creditorId),
      supabase
        .from("collections")
        .select("amount_collected")
        .eq("creditor_id", session.creditorId)
        .eq("collection_date", today),
      supabase
        .from("collectors")
        .select("id, is_active")
        .eq("creditor_id", session.creditorId),
    ]);

    if (loansResult.error) return NextResponse.json({ error: loansResult.error.message }, { status: 500 });
    if (collectionsResult.error) return NextResponse.json({ error: collectionsResult.error.message }, { status: 500 });
    if (collectorsResult.error) return NextResponse.json({ error: collectorsResult.error.message }, { status: 500 });

    const loans = loansResult.data || [];
    const pendingLoans = loans.filter((loan) => loan.status === "pending_approval").length;
    const overdueLoans = loans.filter((loan) => loan.status === "overdue").length;
    const activeCollectors = (collectorsResult.data || []).filter((collector) => collector.is_active).length;
    const todayCollected = (collectionsResult.data || []).reduce((sum, row) => sum + toNumber(row.amount_collected), 0);

    return NextResponse.json({
      role: session.role,
      organization: session.organization,
      overview: {
        hero: {
          eyebrow: session.organization?.name || "Creditor workspace",
          title: "Approve quickly without losing control.",
          summary: "Mobile decision-making for approvals, collector readiness, and the current health of the field portfolio.",
          primaryAction: "Review approvals",
          secondaryAction: "Check operations",
        },
        metrics: [
          {
            label: "Pending approvals",
            value: pendingLoans,
            displayValue: String(pendingLoans),
            change: `${pendingLoans} loans waiting`,
            tone: pendingLoans > 0 ? "amber" : "emerald",
          },
          {
            label: "Today recovered",
            value: todayCollected,
            displayValue: new Intl.NumberFormat("en-LK", {
              style: "currency",
              currency: "LKR",
              maximumFractionDigits: 0,
            }).format(todayCollected),
            change: `${activeCollectors} active collectors`,
            tone: "emerald",
          },
          {
            label: "Portfolio pressure",
            value: overdueLoans,
            displayValue: String(overdueLoans),
            change: `${loans.filter((loan) => loan.status === "active").length} active live loans`,
            tone: overdueLoans > 0 ? "ink" : "emerald",
          },
        ],
        focus: [
          {
            title: "Loan approvals",
            subtitle: pendingLoans > 0 ? "Collectors are waiting for fast credit decisions from the field." : "No loan approvals are waiting right now.",
            amount: pendingLoans,
            displayValue: `${pendingLoans} waiting`,
            status: pendingLoans > 0 ? "Needs review" : "Clear",
            tone: pendingLoans > 0 ? "amber" : "emerald",
          },
          {
            title: "Field readiness",
            subtitle: `${activeCollectors} collectors are active inside the organization today.`,
            amount: activeCollectors,
            displayValue: `${activeCollectors} active`,
            status: "Live teams",
            tone: "ink",
          },
          {
            title: "Overdue exposure",
            subtitle: overdueLoans > 0 ? "A mobile watchlist of accounts that need attention." : "Overdue pressure is currently under control.",
            amount: overdueLoans,
            displayValue: `${overdueLoans} overdue`,
            status: overdueLoans > 0 ? "Watch closely" : "Healthy",
            tone: overdueLoans > 0 ? "amber" : "emerald",
          },
        ],
        activity: [
          {
            title: `${pendingLoans} approval items in queue`,
            detail: "Loan proposals are ready for mobile review.",
            time: "Today",
          },
          {
            title: `${activeCollectors} collectors active`,
            detail: "Current live field footprint across your org.",
            time: "Live",
          },
          {
            title: `Collected ${todayCollected}`,
            detail: "Today’s recovered amount across mobile and admin surfaces.",
            time: formatDate(today) || "Today",
          },
        ],
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load mobile overview";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
