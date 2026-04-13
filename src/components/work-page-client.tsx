"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, ChevronDown, CircleAlert, LoaderCircle, MapPin, MessageSquareQuote, RefreshCw, Wallet } from "lucide-react";
import { StatusPill } from "@/components/status-pill";
import { fetchJson } from "@/lib/fetch-json";
import { workQueue } from "@/lib/mobile-demo-data";
import type { MobileRole } from "@/lib/mobile-demo-data";
import type { ApprovalItem, ApprovalResponse } from "@/lib/mobile-approvals";

type OverviewFocus = Array<{
  title: string;
  subtitle: string;
  amount: number;
  displayValue: string;
  status: string;
  tone: "emerald" | "amber" | "ink";
}>;

type ApprovalActionResponse = {
  ok: boolean;
  kind: "debtor" | "loan";
  decision: "approve" | "reject";
};

type FilterKey = "all" | "debtors" | "loans";
type BannerTone = "success" | "warning" | "danger" | "info";
type BannerState = { tone: BannerTone; text: string } | null;

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

type RouteRunGroup = {
  id: string;
  name: string;
  area: string | null;
  expected: number;
  collected: number;
  pending: number;
  attention: number;
  stops: RouteRunStop[];
};

type RouteRunResponse = {
  collectionDate: string;
  organization?: { name?: string | null } | null;
  summary: {
    expected: number;
    collected: number;
    pendingStops: number;
    completedStops: number;
    attentionStops: number;
    routeCount: number;
  };
  nextStop?: {
    loanId: string;
    debtorName: string;
    routeName: string;
    amountDue: number;
    status: string;
  } | null;
  attention: Array<{
    loanId: string;
    debtorName: string;
    routeName: string;
    amountDue: number;
    status: string;
    overdue: boolean;
  }>;
  routes: RouteRunGroup[];
};

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-LK", {
    style: "currency",
    currency: "LKR",
    maximumFractionDigits: 0,
  }).format(amount || 0);
}

function formatDate(date: string) {
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return date;
  return new Intl.DateTimeFormat("en-LK", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(parsed);
}

function getRequesterLabel(item: ApprovalItem) {
  if (item.requesterName && item.requesterName !== "Collector") return item.requesterName;
  return item.kind === "debtor" ? "Collector submission" : "Field proposal";
}

export function WorkPageClient({
  role,
  organizationName,
  initialApprovals,
  initialFocus,
  initialError,
}: {
  role: MobileRole;
  organizationName?: string | null;
  initialApprovals?: ApprovalResponse | null;
  initialFocus?: OverviewFocus;
  initialError?: string | null;
}) {
  const activeRole = role;
  const [focus, setFocus] = useState<OverviewFocus>(initialFocus || []);
  const [routeRun, setRouteRun] = useState<RouteRunResponse | null>(null);
  const [loadingRouteRun, setLoadingRouteRun] = useState(activeRole === "collector");

  const [loadingApprovals, setLoadingApprovals] = useState(activeRole === "creditor" && !initialApprovals);
  const [acting, setActing] = useState(false);
  const [approvals, setApprovals] = useState<ApprovalResponse | null>(initialApprovals || null);
  const [selectedFilter, setSelectedFilter] = useState<FilterKey>("all");
  const [selectedApprovalId, setSelectedApprovalId] = useState<string | null>(() => {
    const combined = initialApprovals ? [...initialApprovals.debtors, ...initialApprovals.loans] : [];
    return combined[0]?.id || null;
  });
  const [note, setNote] = useState("");
  const [banner, setBanner] = useState<BannerState>(initialError ? { tone: "danger", text: initialError } : null);

  useEffect(() => {
    if (activeRole === "creditor" || activeRole === "collector" || initialFocus?.length) return;

    setFocus(
      workQueue[activeRole].map((item) => ({
        title: item.title,
        subtitle: item.subtitle,
        amount: Number(String(item.amount).replace(/[^\d.-]/g, "")) || 0,
        displayValue: item.amount,
        status: item.status,
        tone: item.tone,
      }))
    );
  }, [activeRole, initialFocus]);

  const loadRouteRun = useCallback(async () => {
    if (activeRole !== "collector") return;

    setLoadingRouteRun(true);
    try {
      const payload = await fetchJson<RouteRunResponse>("/api/mobile/route-run");
      setRouteRun(payload);
      setBanner((current) => current?.tone === "danger" ? { tone: "info", text: "Route run refreshed from the live backend." } : current);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to load route run";
      setRouteRun(null);
      setBanner({ tone: "danger", text: message });
    } finally {
      setLoadingRouteRun(false);
    }
  }, [activeRole]);

  const loadApprovals = useCallback(async (preferredId?: string | null) => {
    if (activeRole !== "creditor") return;

    setLoadingApprovals(true);
    try {
      const payload = await fetchJson<ApprovalResponse>("/api/mobile/approvals");
      setApprovals(payload);
      const combined = [...payload.debtors, ...payload.loans];
      setSelectedApprovalId((current) => {
        const next = preferredId || current;
        if (next && combined.some((item) => item.id === next)) return next;
        return combined[0]?.id || null;
      });
      setBanner((current) => current?.tone === "danger" ? { tone: "info", text: "Approval inbox refreshed from the live backend." } : current);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to load approval inbox";
      setApprovals({ counts: { debtors: 0, loans: 0, total: 0 }, debtors: [], loans: [] });
      setSelectedApprovalId(null);
      setBanner({ tone: "danger", text: message });
    } finally {
      setLoadingApprovals(false);
    }
  }, [activeRole]);

  useEffect(() => {
    if (activeRole !== "collector") return;
    void loadRouteRun();
  }, [activeRole, loadRouteRun]);

  const filteredItems = useMemo(() => {
    if (!approvals) return [];
    if (selectedFilter === "debtors") return approvals.debtors;
    if (selectedFilter === "loans") return approvals.loans;
    return [...approvals.debtors, ...approvals.loans].sort((a, b) => a.requestedAt.localeCompare(b.requestedAt));
  }, [approvals, selectedFilter]);

  const selectedApproval = useMemo(
    () => filteredItems.find((item) => item.id === selectedApprovalId) || filteredItems[0] || null,
    [filteredItems, selectedApprovalId]
  );

  useEffect(() => {
    if (!selectedApproval) return;
    setNote(selectedApproval.note || "");
  }, [selectedApproval]);

  const handleDecision = async (item: ApprovalItem, decision: "approve" | "reject") => {
    const currentNote = selectedApprovalId === item.id ? note : item.note || "";

    if (decision === "reject" && !currentNote.trim()) {
      setSelectedApprovalId(item.id);
      setNote(currentNote);
      setBanner({ tone: "warning", text: "Add a clear note before rejecting so the field team knows what to correct." });
      return;
    }

    setActing(true);
    try {
      await fetchJson<ApprovalActionResponse>("/api/mobile/approvals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: item.kind,
          id: item.id,
          decision,
          note: currentNote.trim() || null,
        }),
      });

      setBanner({
        tone: "success",
        text: `${item.title} ${decision === "approve" ? "approved" : "rejected"} successfully.`,
      });
      await loadApprovals(item.id);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to process approval";
      setBanner({ tone: "danger", text: message });
    } finally {
      setActing(false);
    }
  };

  if (activeRole === "collector") {
    const summary = routeRun?.summary;

    return (
      <div className="space-y-3 pb-4">
        <section className="mobile-panel-strong px-4 py-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="mobile-section-label text-emerald-700 dark:text-emerald-300">
                {routeRun?.organization?.name || organizationName || "Collector route run"}
              </p>
              <h2 className="mobile-text-primary mt-1 text-[1.05rem] font-semibold">Today&apos;s route</h2>
              <p className="mobile-text-secondary mt-1.5 text-[13px] leading-relaxed">
                Review stops, see what needs attention, and jump straight into capture.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void loadRouteRun()}
              disabled={loadingRouteRun}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-emerald-500/10 text-emerald-700 disabled:opacity-45 dark:bg-emerald-500/14 dark:text-emerald-300"
            >
              {loadingRouteRun ? <LoaderCircle size={22} className="animate-spin" /> : <RefreshCw size={22} />}
            </button>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2.5">
            <div className="mobile-stat-tile">
              <p className="mobile-text-tertiary text-[10px] uppercase tracking-[0.18em]">Expected today</p>
              <p className="mobile-text-primary mt-1.5 text-base font-semibold">{formatCurrency(summary?.expected || 0)}</p>
              <p className="mobile-text-secondary mt-1.5 text-[11px]">{summary?.routeCount || 0} routes active</p>
            </div>
            <div className="mobile-stat-tile">
              <p className="mobile-text-tertiary text-[10px] uppercase tracking-[0.18em]">Captured</p>
              <p className="mobile-text-primary mt-1.5 text-base font-semibold">{formatCurrency(summary?.collected || 0)}</p>
              <p className="mobile-text-secondary mt-1.5 text-[11px]">{summary?.completedStops || 0} stops closed</p>
            </div>
            <div className="mobile-stat-tile">
              <p className="mobile-text-tertiary text-[10px] uppercase tracking-[0.18em]">Still open</p>
              <p className="mobile-text-primary mt-1.5 text-base font-semibold">{summary?.pendingStops || 0}</p>
              <p className="mobile-text-secondary mt-1.5 text-[11px]">Need a visit outcome</p>
            </div>
            <div className="mobile-stat-tile">
              <p className="mobile-text-tertiary text-[10px] uppercase tracking-[0.18em]">Attention</p>
              <p className="mobile-text-primary mt-1.5 text-base font-semibold">{summary?.attentionStops || 0}</p>
              <p className="mobile-text-secondary mt-1.5 text-[11px]">Overdue or unresolved stops</p>
            </div>
          </div>
        </section>

        {banner ? (
          <section className={`mobile-panel px-4 py-3.5 ${banner.tone === "success" ? "border-emerald-700/12 bg-emerald-500/8 dark:bg-emerald-500/14" : banner.tone === "warning" ? "border-amber-700/12 bg-amber-500/10 dark:bg-amber-500/14" : banner.tone === "danger" ? "border-rose-700/14 bg-rose-500/10 dark:bg-rose-500/14" : ""}`}>
            <p className="mobile-text-primary text-sm leading-relaxed">{banner.text}</p>
          </section>
        ) : null}

        <section className="mobile-panel-ink px-4 py-4 text-white">
          <p className="text-[10px] uppercase tracking-[0.16em] text-emerald-100/80">Next best stop</p>
          <h3 className="mt-2 text-lg font-semibold">{routeRun?.nextStop?.debtorName || "No stop queued yet"}</h3>
          <p className="mt-1.5 text-[13px] text-white/72">
            {routeRun?.nextStop
              ? `${routeRun.nextStop.routeName} · ${formatCurrency(routeRun.nextStop.amountDue)} · ${routeRun.nextStop.status.replaceAll("_", " ")}`
              : "As soon as a live collection stop is available, the next best field action will appear here."}
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2.5">
            {routeRun?.nextStop ? (
              <Link href={`/collector?loanId=${routeRun.nextStop.loanId}`} className="mobile-inline-action">
                Open capture
                <ArrowRight size={16} />
              </Link>
            ) : null}
            <Link href="/collector" className="mobile-inline-action-secondary">
              Capture workspace
            </Link>
          </div>
        </section>

        <section className="space-y-2.5">
          <div className="flex items-center justify-between px-1">
            <div>
              <p className="mobile-text-tertiary text-[10px] uppercase tracking-[0.16em]">Route groups</p>
              <h3 className="mobile-text-primary mt-1 text-base font-semibold">Field sequence</h3>
            </div>
          </div>

          {loadingRouteRun ? (
            Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="mobile-panel px-4 py-4">
                <div className="h-4 w-24 animate-pulse rounded-full bg-stone-200 dark:bg-slate-700" />
                <div className="mt-3 h-7 w-2/3 animate-pulse rounded-full bg-stone-200 dark:bg-slate-700" />
                <div className="mt-4 h-3 w-full animate-pulse rounded-full bg-stone-100 dark:bg-slate-800" />
              </div>
            ))
          ) : !routeRun || routeRun.routes.length === 0 ? (
            <section className="mobile-panel px-4 py-5 text-center">
              <p className="mobile-text-primary text-base font-semibold">No route stops are active right now.</p>
              <p className="mobile-text-secondary mt-2 text-sm leading-relaxed">
                This route view falls back to live assigned loans, so an empty state here usually means this collector has no active schedule today.
              </p>
            </section>
          ) : (
            routeRun.routes.map((route) => (
              <section key={route.id} className="mobile-panel px-4 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="mobile-text-tertiary text-[10px] uppercase tracking-[0.16em]">{route.area || "Coverage area"}</p>
                    <h3 className="mobile-text-primary mt-1 text-base font-semibold">{route.name}</h3>
                    <p className="mobile-text-secondary mt-1.5 text-[13px]">
                      {route.pending} open stop{route.pending === 1 ? "" : "s"} · {formatCurrency(route.expected)} expected
                    </p>
                  </div>
                  <StatusPill label={route.attention > 0 ? `${route.attention} attention` : "On track"} tone={route.attention > 0 ? "amber" : "emerald"} />
                </div>

                <div className="mobile-compact-list mt-3">
                  {route.stops.map((stop) => (
                    <Link
                      key={`${route.id}-${stop.loanId}-${stop.collectionDate}`}
                      href={`/collector?loanId=${stop.loanId}`}
                      className="mobile-inline-surface block px-4 py-3.5 transition-colors hover:bg-[color:var(--card-strong)]"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <p className="mobile-text-primary text-sm font-semibold">{stop.debtorName}</p>
                          <p className="mobile-text-tertiary mt-1 text-xs">{stop.loanNumber}</p>
                        </div>
                        <span className={`rounded-full px-3 py-1 text-[11px] font-semibold capitalize ${
                          stop.overdue
                            ? "bg-rose-500/12 text-rose-900 dark:text-rose-200"
                            : stop.status === "partial"
                              ? "bg-amber-500/12 text-amber-900 dark:text-amber-200"
                              : stop.status === "collected"
                                ? "bg-emerald-500/12 text-emerald-900 dark:text-emerald-200"
                                : "bg-stone-900/6 text-stone-700 dark:bg-white/8 dark:text-slate-200"
                        }`}>
                          {stop.overdue ? "overdue" : stop.status}
                        </span>
                      </div>

                      <div className="mt-2.5 grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="mobile-text-tertiary text-[10px] uppercase tracking-[0.16em]">Due now</p>
                          <p className="mobile-text-primary mt-1 text-sm font-semibold">{formatCurrency(stop.amountDue)}</p>
                        </div>
                        <div>
                          <p className="mobile-text-tertiary text-[10px] uppercase tracking-[0.16em]">Remaining</p>
                          <p className="mobile-text-primary mt-1 text-sm font-semibold">{formatCurrency(stop.amountRemaining)}</p>
                        </div>
                      </div>

                      <div className="mobile-text-secondary mt-2.5 flex flex-wrap gap-3 text-xs">
                        {stop.address ? (
                          <span className="inline-flex items-center gap-1.5"><MapPin size={13} />{stop.address}</span>
                        ) : null}
                        {stop.overdue ? (
                          <span className="inline-flex items-center gap-1.5"><CircleAlert size={13} />Needs closer follow-up</span>
                        ) : null}
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            ))
          )}
        </section>

        {routeRun && routeRun.attention.length > 0 ? (
          <section className="mobile-panel px-4 py-4">
            <p className="mobile-section-label">Attention stack</p>
            <div className="mobile-compact-list mt-3">
              {routeRun.attention.map((item) => (
                <Link
                  key={`attention-${item.loanId}`}
                  href={`/collector?loanId=${item.loanId}`}
                  className="mobile-inline-surface block px-4 py-3.5"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="mobile-text-primary text-sm font-semibold">{item.debtorName}</p>
                      <p className="mobile-text-tertiary mt-1 text-xs">{item.routeName}</p>
                    </div>
                    <StatusPill label={item.overdue ? "Overdue" : item.status.replaceAll("_", " ")} tone={item.overdue ? "amber" : "ink"} />
                  </div>
                  <p className="mobile-text-secondary mt-2.5 text-[13px]">
                    {item.overdue
                      ? `Outstanding attention on ${formatCurrency(item.amountDue)}. Open capture to resolve this stop.`
                      : `This stop is marked ${item.status.replaceAll("_", " ")} and may need another field decision.`}
                  </p>
                </Link>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    );
  }

  if (activeRole !== "creditor") {
    return (
      <div className="space-y-3.5 pb-4">
        <section className="mobile-panel px-4 py-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="mobile-section-label">Focused workflow</p>
              <h2 className="mobile-text-primary mt-1 text-lg font-semibold">
                {activeRole === "debtor" ? "Repayment schedule" : "Route runway"}
              </h2>
              <p className="mobile-text-secondary mt-1.5 text-[13px] leading-relaxed">
                {activeRole === "debtor"
                  ? "See exactly what is coming next, who will visit, and where each payment stands."
                  : "A cleaner sequence for where to go next, who needs attention, and how much cash should be captured."}
              </p>
            </div>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[18px] bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/14 dark:text-emerald-300">
              {activeRole === "debtor" ? <CheckCircle2 size={18} /> : <Wallet size={18} />}
            </div>
          </div>
        </section>

        <section className="space-y-2.5">
          {focus.map((item, index) => (
            <div key={item.title} className="mobile-panel-strong px-4 py-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="mobile-text-tertiary text-[10px] uppercase tracking-[0.16em]">Step {index + 1}</p>
                  <h3 className="mobile-text-primary mt-1 text-base font-semibold">{item.title}</h3>
                  <p className="mobile-text-secondary mt-1.5 text-[13px] leading-relaxed">{item.subtitle}</p>
                </div>
                <StatusPill label={item.status} tone={item.tone} />
              </div>
              <div className="mt-3 flex items-center justify-between rounded-[18px] bg-stone-900/[0.04] px-4 py-2.5 dark:bg-white/6">
                <div>
                  <p className="mobile-text-tertiary text-[10px] uppercase tracking-[0.16em]">Working amount</p>
                  <p className="mobile-text-primary mt-1 text-base font-semibold">{item.displayValue}</p>
                </div>
                <button className="flex h-10 w-10 items-center justify-center rounded-[18px] bg-[#14213d] text-white dark:bg-slate-100 dark:text-slate-900">
                  <ChevronDown size={18} />
                </button>
              </div>
            </div>
          ))}
        </section>
      </div>
    );
  }

  const filters: Array<{ key: FilterKey; label: string; count: number }> = [
    { key: "all", label: "All", count: approvals?.counts.total || 0 },
    { key: "debtors", label: "Debtors", count: approvals?.counts.debtors || 0 },
    { key: "loans", label: "Loans", count: approvals?.counts.loans || 0 },
  ];

  return (
    <div className="space-y-3 pb-4">
      <section className="mobile-panel px-4 py-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="mobile-section-label text-emerald-700 dark:text-emerald-300">Creditor mobile inbox</p>
            <h2 className="mobile-text-primary mt-1 text-[1.05rem] font-semibold">Approval desk</h2>
            <p className="mobile-text-secondary mt-1.5 text-[13px] leading-relaxed">
              Tap a request to expand it, review the details, and make the decision inline.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadApprovals()}
            disabled={loadingApprovals}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-emerald-500/10 text-emerald-700 disabled:opacity-45 dark:bg-emerald-500/14 dark:text-emerald-300"
          >
            {loadingApprovals ? <LoaderCircle size={18} className="animate-spin" /> : <RefreshCw size={18} />}
          </button>
        </div>

        <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
          {filters.map((filter) => (
            <button
              key={filter.key}
              type="button"
              onClick={() => setSelectedFilter(filter.key)}
              className={`mobile-filter-pill shrink-0 ${selectedFilter === filter.key ? "mobile-filter-pill-active" : ""}`}
            >
              {filter.label} <span className="ml-1 opacity-70">{filter.count}</span>
            </button>
          ))}
        </div>
      </section>

      {banner ? (
        <section className={`mobile-panel px-4 py-3.5 ${banner.tone === "success" ? "border-emerald-700/12 bg-emerald-500/8 dark:bg-emerald-500/14" : banner.tone === "warning" ? "border-amber-700/12 bg-amber-500/10 dark:bg-amber-500/14" : banner.tone === "danger" ? "border-rose-700/14 bg-rose-500/10 dark:bg-rose-500/14" : ""}`}>
          <p className="mobile-text-primary text-sm leading-relaxed">{banner.text}</p>
        </section>
      ) : null}

      <section className="space-y-2.5">
        {loadingApprovals ? (
          Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="mobile-panel px-4 py-4">
              <div className="h-4 w-24 animate-pulse rounded-full bg-stone-200 dark:bg-slate-700" />
              <div className="mt-3 h-7 w-2/3 animate-pulse rounded-full bg-stone-200 dark:bg-slate-700" />
              <div className="mt-3 h-3 w-full animate-pulse rounded-full bg-stone-100 dark:bg-slate-800" />
            </div>
          ))
        ) : filteredItems.length === 0 ? (
          <section className="mobile-panel px-4 py-5 text-center">
            <p className="mobile-text-primary text-base font-semibold">No approvals are waiting right now.</p>
            <p className="mobile-text-secondary mt-2 text-sm leading-relaxed">
              Once collectors submit new debtor records or loan proposals, they will appear here automatically.
            </p>
          </section>
        ) : (
          filteredItems.map((item) => {
            const active = selectedApprovalId === item.id;
            const isCurrent = selectedApproval?.id === item.id;
            const currentNote = isCurrent ? note : item.note || "";

            return (
              <section key={`${item.kind}-${item.id}`} className={`mobile-panel overflow-hidden border ${active ? "border-emerald-500/30 dark:border-emerald-400/30" : ""}`}>
                <button
                  type="button"
                  onClick={() => setSelectedApprovalId(active ? null : item.id)}
                  className="flex w-full items-start justify-between gap-4 px-4 py-4 text-left"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="mobile-chip text-[11px]">{item.badge}</span>
                      <StatusPill label="Pending" tone={item.kind === "loan" ? "amber" : "ink"} />
                    </div>
                    <h3 className="mobile-text-primary mt-3 text-base font-semibold">{item.title}</h3>
                    <p className="mobile-text-secondary mt-1.5 text-[13px] leading-relaxed">{item.subtitle}</p>
                    <div className="mobile-text-tertiary mt-3 flex flex-wrap gap-3 text-xs">
                      <span>{getRequesterLabel(item)}</span>
                      <span>{formatDate(item.requestedAt)}</span>
                    </div>
                  </div>
                  <ChevronDown size={18} className={`mobile-text-tertiary mt-1 shrink-0 transition-transform ${active ? "rotate-180" : ""}`} />
                </button>

                {active ? (
                  <div className="border-t border-slate-900/6 px-4 py-4 dark:border-white/8">
                    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                      {item.metrics.map((metric) => (
                        <div key={`${item.id}-${metric.label}`} className="mobile-inline-surface px-3.5 py-3">
                          <p className="mobile-text-tertiary text-[10px] uppercase tracking-[0.16em]">{metric.label}</p>
                          <p className="mobile-text-primary mt-1.5 text-sm font-semibold">{metric.value}</p>
                        </div>
                      ))}
                    </div>

                    <div className="mobile-inline-surface mt-3 px-3.5 py-3">
                      <p className="mobile-text-primary inline-flex items-center gap-2 text-sm font-semibold"><MessageSquareQuote size={16} />Review note</p>
                      <p className="mobile-text-secondary mt-1.5 text-xs leading-relaxed">
                        Add context for approval, or explain clearly what must change before resubmission.
                      </p>
                      <textarea
                        value={currentNote}
                        onChange={(event) => {
                          setSelectedApprovalId(item.id);
                          setNote(event.target.value);
                        }}
                        rows={4}
                        className="mobile-text-primary mt-3 w-full rounded-[12px] border border-[color:var(--border)] bg-[color:var(--card-strong)] px-3 py-2.5 text-sm outline-none placeholder:text-[color:var(--text-tertiary)]"
                        placeholder={item.kind === "loan" ? "Add approval context or explain what needs to change." : "Explain any correction the collector should make before resubmitting."}
                      />
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2.5">
                      <button
                        type="button"
                        onClick={() => void handleDecision(item, "reject")}
                        disabled={acting}
                        className="rounded-[14px] border border-rose-500/20 bg-rose-500/8 px-4 py-3 text-sm font-semibold text-rose-700 disabled:opacity-45 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-200"
                      >
                        {acting && isCurrent ? <LoaderCircle size={16} className="mx-auto animate-spin" /> : "Reject"}
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDecision(item, "approve")}
                        disabled={acting}
                        className="mobile-inline-action disabled:opacity-45"
                      >
                        {acting && isCurrent ? <LoaderCircle size={16} className="mx-auto animate-spin" /> : "Approve"}
                      </button>
                    </div>
                  </div>
                ) : null}
              </section>
            );
          })
        )}
      </section>
    </div>
  );
}
