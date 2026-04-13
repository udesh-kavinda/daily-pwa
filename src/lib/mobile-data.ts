import { createAdminClient } from "@/lib/supabase/admin";
import { getDebtorPortalData } from "@/lib/debtor-portal";
import { formatBorrowerStatus } from "@/lib/borrower-copy";
import type { AppSessionContext } from "@/lib/auth/get-app-session-context";
import type { MobileRole } from "@/lib/mobile-demo-data";

type MetricTone = "emerald" | "amber" | "ink";

export type MobileOverviewResponse = {
  role: MobileRole;
  organization?: { name: string | null } | null;
  organizations?: Array<{
    id: string;
    name: string | null;
    ownerName: string | null;
    ownerEmail: string | null;
  }>;
  overview: {
    hero: {
      eyebrow: string;
      title: string;
      summary: string;
      primaryAction: string;
      secondaryAction: string;
    };
    metrics: Array<{
      label: string;
      value: number;
      displayValue: string;
      change: string;
      tone: MetricTone;
    }>;
    focus: Array<{
      title: string;
      subtitle: string;
      amount: number;
      displayValue: string;
      status: string;
      tone: MetricTone;
    }>;
    activity: Array<{
      title: string;
      detail: string;
      time: string;
    }>;
  };
};

export type MobileDebtorsResponse = {
  rows: Array<{
    id: string;
    name: string;
    phone: string;
    route: string;
    collector: string;
    status: string;
    updatedAt: string;
  }>;
};

export type MobileLoansResponse = {
  rows: Array<{
    id: string;
    loanNumber: string;
    debtor: string;
    collector: string;
    dailyPay: number;
    outstanding: number;
    totalAmount: number;
    endDate: string;
    status: string;
  }>;
};

export type MobileRoutesResponse = {
  rows: Array<{
    id: string;
    name: string;
    area: string;
    collector: string;
    debtors: number;
    status: string;
  }>;
};

export type MobileCollectorsResponse = {
  rows: Array<{
    id: string;
    name: string;
    employeeCode: string;
    phone: string;
    routes: number;
    status: string;
  }>;
};

export type MobileProfileResponse = {
  profile: {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
    phone: string | null;
    role: MobileRole | "recovery_agent";
    created_at: string;
    updated_at: string;
  } | null;
  role: MobileRole | "recovery_agent";
  organization: {
    id: string;
    name: string | null;
    ownerName: string | null;
    ownerEmail: string | null;
  } | null;
  organizations: Array<{
    id: string;
    name: string | null;
    ownerName: string | null;
    ownerEmail: string | null;
  }>;
  summary: {
    employeeCode?: string | null;
    assignedRoutes?: string[] | null;
    inviteStatus?: string | null;
    activeLoans?: number;
    totalOutstanding?: number;
    estimated30DayCommitment?: number;
  } | null;
};

type LoanRow = {
  id: string;
  loan_number: string;
  status: string;
  total_amount: number;
  amount_remaining: number;
  daily_installment: number;
  debtor_id: string;
  collector_id: string | null;
  end_date: string | null;
};

type DebtorRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  approval_status: string | null;
  is_active: boolean;
  route_id: string | null;
  collector_id: string | null;
  updated_at: string;
};

function toNumber(value: number | string | null | undefined) {
  return Number(value || 0);
}

function fullName(firstName: string | null, lastName: string | null, fallback: string) {
  return `${firstName || ""} ${lastName || ""}`.trim() || fallback;
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
  }).format(amount || 0);
}

export async function loadMobileOverview(session: AppSessionContext): Promise<MobileOverviewResponse> {
  const supabase = createAdminClient();
  const today = new Date().toISOString().slice(0, 10);

  if (session.role === "collector") {
    if (!session.collector) {
      return {
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
      };
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

    if (collectionsResult.error) throw new Error(collectionsResult.error.message);
    if (debtorsResult.error) throw new Error(debtorsResult.error.message);
    if (loansResult.error) throw new Error(loansResult.error.message);
    if (notificationsResult.error) throw new Error(notificationsResult.error.message);

    const collections = collectionsResult.data || [];
    const loans = loansResult.data || [];
    const todayTarget = collections.reduce((sum, row) => sum + toNumber(row.amount_due), 0);
    const todayCollected = collections.reduce((sum, row) => sum + toNumber(row.amount_collected), 0);
    const pendingStops = collections.filter((row) => row.status !== "collected").length;
    const missedStops = collections.filter((row) => row.status === "missed").length;
    const activeLoans = loans.filter((loan) => loan.status === "active" || loan.status === "overdue").length;
    const overdueLoans = loans.filter((loan) => loan.status === "overdue").length;

    return {
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
            displayValue: formatCurrency(todayTarget),
            change: `${pendingStops} stops remaining`,
            tone: "ink",
          },
          {
            label: "Collected so far",
            value: todayCollected,
            displayValue: formatCurrency(todayCollected),
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
            displayValue: formatCurrency(todayTarget),
            status: pendingStops > 0 ? "In progress" : "Route clear",
            tone: pendingStops > 0 ? "emerald" : "ink",
          },
          {
            title: "Watchlist follow-ups",
            subtitle: overdueLoans > 0 ? `${overdueLoans} overdue loan accounts need a closer conversation.` : "No overdue accounts are assigned to you right now.",
            amount: loans.filter((loan) => loan.status === "overdue").reduce((sum, loan) => sum + toNumber(loan.amount_remaining), 0),
            displayValue: overdueLoans > 0
              ? formatCurrency(loans.filter((loan) => loan.status === "overdue").reduce((sum, loan) => sum + toNumber(loan.amount_remaining), 0))
              : "Stable",
            status: overdueLoans > 0 ? "Priority" : "Stable",
            tone: overdueLoans > 0 ? "amber" : "emerald",
          },
          {
            title: "Settlement outlook",
            subtitle: "Use this to reconcile what you should hand over at the end of the round.",
            amount: todayCollected,
            displayValue: formatCurrency(todayCollected),
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
    };
  }

  if (session.role === "debtor") {
    const portal = await getDebtorPortalData(session);
    return {
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
            displayValue: formatCurrency(portal.summary.nextCollectionAmount),
            change: portal.summary.nextCollectionDate ? `Expected ${formatDate(portal.summary.nextCollectionDate)}` : "No visit booked yet",
            tone: portal.summary.nextCollectionAmount > 0 ? "amber" : "ink",
          },
          {
            label: "Still left to repay",
            value: portal.summary.totalOutstanding,
            displayValue: formatCurrency(portal.summary.totalOutstanding),
            change: `${portal.summary.activeLoans} active loans`,
            tone: "ink",
          },
          {
            label: "Estimated next 30 days",
            value: portal.summary.estimated30DayCommitment,
            displayValue: formatCurrency(portal.summary.estimated30DayCommitment),
            change: `${portal.summary.activeCreditors} lender relationship${portal.summary.activeCreditors === 1 ? "" : "s"}`,
            tone: "emerald",
          },
        ],
        focus: portal.loans.slice(0, 3).map((loan) => ({
          title: loan.loanNumber,
          subtitle: `${loan.creditorName} · Collector ${loan.collectorName}`,
          amount: loan.nextCollection?.amountDue || loan.amountRemaining,
          displayValue: formatCurrency(loan.nextCollection?.amountDue || loan.amountRemaining),
          status: loan.nextCollection?.date ? `Next visit ${formatDate(loan.nextCollection.date)}` : `Status: ${formatBorrowerStatus(loan.status)}`,
          tone: loan.nextCollection ? "amber" : "ink",
        })),
        activity: portal.loans.slice(0, 3).map((loan) => ({
          title: `${loan.loanNumber} · ${loan.creditorName}`,
          detail: `${loan.collectorName} is handling this loan. ${formatCurrency(loan.amountRemaining)} is still left to repay.`,
          time: loan.nextCollection?.date ? `Visit ${formatDate(loan.nextCollection.date) || "soon"}` : formatBorrowerStatus(loan.status),
        })),
      },
    };
  }

  const [loansResult, collectionsResult, collectorsResult] = await Promise.all([
    supabase.from("loans").select("id, status, total_amount").eq("creditor_id", session.creditorId),
    supabase.from("collections").select("amount_collected").eq("creditor_id", session.creditorId).eq("collection_date", today),
    supabase.from("collectors").select("id, is_active").eq("creditor_id", session.creditorId),
  ]);

  if (loansResult.error) throw new Error(loansResult.error.message);
  if (collectionsResult.error) throw new Error(collectionsResult.error.message);
  if (collectorsResult.error) throw new Error(collectorsResult.error.message);

  const loans = loansResult.data || [];
  const pendingLoans = loans.filter((loan) => loan.status === "pending_approval").length;
  const overdueLoans = loans.filter((loan) => loan.status === "overdue").length;
  const activeCollectors = (collectorsResult.data || []).filter((collector) => collector.is_active).length;
  const todayCollected = (collectionsResult.data || []).reduce((sum, row) => sum + toNumber(row.amount_collected), 0);

  return {
    role: session.role as MobileRole,
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
          displayValue: formatCurrency(todayCollected),
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
          title: session.organization?.ownerName || "Creditor desk",
          subtitle: pendingLoans > 0
            ? "Collectors are waiting for fast credit decisions from the field."
            : "No queued debtor or loan requests are waiting right now.",
          amount: pendingLoans,
          displayValue: pendingLoans > 0 ? `${pendingLoans} approvals` : "Queue clear",
          status: pendingLoans > 0 ? "Needs review" : "Clear",
          tone: pendingLoans > 0 ? "amber" : "emerald",
        },
        {
          title: "Field momentum",
          subtitle: `${activeCollectors} collectors are active today with ${formatCurrency(todayCollected)} recovered so far.`,
          amount: todayCollected,
          displayValue: formatCurrency(todayCollected),
          status: activeCollectors > 0 ? "Live" : "Waiting",
          tone: activeCollectors > 0 ? "emerald" : "ink",
        },
        {
          title: "Pressure watch",
          subtitle: overdueLoans > 0
            ? `${overdueLoans} overdue loans need attention before they spill further.`
            : "Overdue pressure is under control right now.",
          amount: overdueLoans,
          displayValue: overdueLoans > 0 ? `${overdueLoans} flagged` : "Stable",
          status: overdueLoans > 0 ? "Attention" : "Healthy",
          tone: overdueLoans > 0 ? "ink" : "emerald",
        },
      ],
      activity: [
        {
          title: "Approval desk",
          detail: pendingLoans > 0 ? `${pendingLoans} loan approvals are waiting for review.` : "No loan approvals are waiting right now.",
          time: "Today",
        },
        {
          title: "Collections",
          detail: `${formatCurrency(todayCollected)} has been recovered across the field today.`,
          time: "Today",
        },
        {
          title: "Collectors live",
          detail: `${activeCollectors} collectors are currently active in the field.`,
          time: "Today",
        },
      ],
    },
  };
}

export async function loadMobileDebtors(session: AppSessionContext): Promise<MobileDebtorsResponse> {
  const supabase = createAdminClient();

  if (session.role === "debtor") {
    return { rows: [] };
  }

  let query = supabase
    .from("debtors")
    .select("id, first_name, last_name, phone, approval_status, is_active, route_id, collector_id, updated_at")
    .eq("creditor_id", session.creditorId)
    .order("updated_at", { ascending: false });

  if (session.role === "collector" && session.collector) {
    query = query.or(`collector_id.eq.${session.collector.id},requested_by_collector_id.eq.${session.collector.id}`);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const debtors = (data as DebtorRow[] | null) || [];
  const routeIds = [...new Set(debtors.map((row) => row.route_id).filter(Boolean))] as string[];
  const collectorIds = [...new Set(debtors.map((row) => row.collector_id).filter(Boolean))] as string[];

  const [{ data: routes }, { data: collectors }] = await Promise.all([
    routeIds.length > 0
      ? supabase.from("routes").select("id, name").in("id", routeIds)
      : Promise.resolve({ data: [] as Array<{ id: string; name: string | null }>, error: null }),
    collectorIds.length > 0
      ? supabase.from("collectors").select("id, first_name, last_name, employee_code").in("id", collectorIds)
      : Promise.resolve({ data: [] as Array<{ id: string; first_name: string | null; last_name: string | null; employee_code: string | null }>, error: null }),
  ]);

  const routeMap = new Map(((routes as Array<{ id: string; name: string | null }> | null) || []).map((row) => [row.id, row.name || "Route"]));
  const collectorMap = new Map(
    ((collectors as Array<{ id: string; first_name: string | null; last_name: string | null; employee_code: string | null }> | null) || []).map((row) => [
      row.id,
      fullName(row.first_name, row.last_name, row.employee_code || "Collector"),
    ])
  );

  return {
    rows: debtors.map((row) => ({
      id: row.id,
      name: fullName(row.first_name, row.last_name, "Debtor"),
      phone: row.phone || "No phone",
      route: row.route_id ? routeMap.get(row.route_id) || "Route" : "Unassigned",
      collector: row.collector_id ? collectorMap.get(row.collector_id) || "Collector" : "Unassigned",
      status: row.approval_status || (row.is_active ? "approved" : "inactive"),
      updatedAt: row.updated_at,
    })),
  };
}

export async function loadMobileLoans(session: AppSessionContext): Promise<MobileLoansResponse> {
  const supabase = createAdminClient();

  let query = supabase
    .from("loans")
    .select("id, loan_number, status, total_amount, amount_remaining, daily_installment, debtor_id, collector_id, end_date")
    .order("updated_at", { ascending: false });

  if (session.role === "debtor" && session.debtors.length > 0) {
    query = query.in("debtor_id", session.debtors.map((entry) => entry.id));
  } else {
    query = query.eq("creditor_id", session.creditorId);
    if (session.role === "collector" && session.collector) {
      query = query.eq("collector_id", session.collector.id);
    }
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const loans = (data as LoanRow[] | null) || [];
  const debtorIds = [...new Set(loans.map((row) => row.debtor_id).filter(Boolean))];
  const collectorIds = [...new Set(loans.map((row) => row.collector_id).filter(Boolean))] as string[];

  const [{ data: debtors }, { data: collectors }] = await Promise.all([
    debtorIds.length > 0
      ? supabase.from("debtors").select("id, first_name, last_name").in("id", debtorIds)
      : Promise.resolve({ data: [] as Array<{ id: string; first_name: string | null; last_name: string | null }>, error: null }),
    collectorIds.length > 0
      ? supabase.from("collectors").select("id, first_name, last_name, employee_code").in("id", collectorIds)
      : Promise.resolve({ data: [] as Array<{ id: string; first_name: string | null; last_name: string | null; employee_code: string | null }>, error: null }),
  ]);

  const debtorMap = new Map(
    ((debtors as Array<{ id: string; first_name: string | null; last_name: string | null }> | null) || []).map((row) => [row.id, fullName(row.first_name, row.last_name, "Debtor")])
  );
  const collectorMap = new Map(
    ((collectors as Array<{ id: string; first_name: string | null; last_name: string | null; employee_code: string | null }> | null) || []).map((row) => [
      row.id,
      fullName(row.first_name, row.last_name, row.employee_code || "Collector"),
    ])
  );

  return {
    rows: loans.map((row) => ({
      id: row.id,
      loanNumber: row.loan_number,
      debtor: debtorMap.get(row.debtor_id) || "Debtor",
      collector: row.collector_id ? collectorMap.get(row.collector_id) || "Collector" : "Unassigned",
      dailyPay: row.daily_installment,
      outstanding: row.amount_remaining,
      totalAmount: row.total_amount,
      endDate: formatDate(row.end_date) || "No end date",
      status: row.status,
    })),
  };
}

export async function loadMobileRoutes(session: AppSessionContext): Promise<MobileRoutesResponse> {
  const supabase = createAdminClient();

  if (session.role === "debtor") {
    return { rows: [] };
  }

  let query = supabase
    .from("routes")
    .select("id, name, area, is_active, collector_id")
    .eq("creditor_id", session.creditorId)
    .order("updated_at", { ascending: false });

  if (session.role === "collector" && session.collector) {
    query = query.eq("collector_id", session.collector.id);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const routes = (data as Array<{ id: string; name: string; area: string | null; is_active: boolean; collector_id: string | null }> | null) || [];
  const routeIds = routes.map((row) => row.id);
  const collectorIds = [...new Set(routes.map((row) => row.collector_id).filter(Boolean))] as string[];

  const [{ data: debtors }, { data: collectors }] = await Promise.all([
    routeIds.length > 0
      ? supabase.from("debtors").select("id, route_id").in("route_id", routeIds)
      : Promise.resolve({ data: [] as Array<{ id: string; route_id: string | null }>, error: null }),
    collectorIds.length > 0
      ? supabase.from("collectors").select("id, first_name, last_name, employee_code").in("id", collectorIds)
      : Promise.resolve({ data: [] as Array<{ id: string; first_name: string | null; last_name: string | null; employee_code: string | null }>, error: null }),
  ]);

  const debtorCountByRoute = new Map<string, number>();
  for (const row of (debtors as Array<{ id: string; route_id: string | null }> | null) || []) {
    if (!row.route_id) continue;
    debtorCountByRoute.set(row.route_id, (debtorCountByRoute.get(row.route_id) || 0) + 1);
  }

  const collectorMap = new Map(
    ((collectors as Array<{ id: string; first_name: string | null; last_name: string | null; employee_code: string | null }> | null) || []).map((row) => [
      row.id,
      fullName(row.first_name, row.last_name, row.employee_code || "Collector"),
    ])
  );

  return {
    rows: routes.map((row) => ({
      id: row.id,
      name: row.name,
      area: row.area || "Coverage area",
      collector: row.collector_id ? collectorMap.get(row.collector_id) || "Collector" : "Unassigned",
      debtors: debtorCountByRoute.get(row.id) || 0,
      status: row.is_active ? "active" : "inactive",
    })),
  };
}

export async function loadMobileCollectors(session: AppSessionContext): Promise<MobileCollectorsResponse> {
  if (session.role !== "creditor") {
    return { rows: [] };
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("collectors")
    .select("id, first_name, last_name, employee_code, phone, invite_status, is_active, assigned_routes")
    .eq("creditor_id", session.creditorId)
    .order("updated_at", { ascending: false });

  if (error) throw new Error(error.message);

  const collectors = (data as Array<{
    id: string;
    first_name: string | null;
    last_name: string | null;
    employee_code: string | null;
    phone: string | null;
    invite_status: string | null;
    is_active: boolean;
    assigned_routes: string[] | null;
  }> | null) || [];

  return {
    rows: collectors.map((row) => ({
      id: row.id,
      name: fullName(row.first_name, row.last_name, "Collector"),
      employeeCode: row.employee_code || "Pending code",
      phone: row.phone || "No phone",
      routes: Array.isArray(row.assigned_routes) ? row.assigned_routes.length : 0,
      status: row.invite_status || (row.is_active ? "active" : "inactive"),
    })),
  };
}

export async function loadMobileProfile(session: AppSessionContext): Promise<MobileProfileResponse> {
  const supabase = createAdminClient();
  const { data: profile, error: profileError } = await supabase
    .from("users")
    .select("id, clerk_id, email, first_name, last_name, phone, role, avatar_url, is_active, created_at, updated_at")
    .eq("id", session.appUser.id)
    .maybeSingle();

  if (profileError) throw new Error(profileError.message);

  let summary: Record<string, unknown> | null = null;

  if (session.role === "debtor") {
    const portal = await getDebtorPortalData(session);
    summary = portal.summary;
  }

  if (session.role === "collector" && session.collector) {
    summary = {
      employeeCode: session.collector.employee_code || null,
      assignedRoutes: session.collector.assigned_routes || [],
      inviteStatus: session.collector.invite_status || null,
    };
  }

  return {
    profile: profile || null,
    role: session.role,
    organization: session.organization,
    organizations: session.organizations,
    summary,
  };
}
