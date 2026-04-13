"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, ChevronRight, CircleAlert, LoaderCircle, MapPin, MessageSquareQuote, RefreshCw, ShieldAlert, Wallet } from "lucide-react";
import { StatusPill } from "@/components/status-pill";
import { useUserStore } from "@/store/user-store";
import { fetchJson } from "@/lib/fetch-json";
import { workQueue } from "@/lib/mobile-demo-data";
import type { MobileRole } from "@/lib/mobile-demo-data";

type OverviewResponse = {
  overview: {
    focus: Array<{
      title: string;
      subtitle: string;
      amount: number;
      displayValue: string;
      status: string;
      tone: "emerald" | "amber" | "ink";
    }>;
  };
};

type ApprovalMetric = { label: string; value: string };

type ApprovalItem = {
  kind: "debtor" | "loan";
  id: string;
  title: string;
  subtitle: string;
  requestedAt: string;
  requesterName: string;
  badge: string;
  metrics: ApprovalMetric[];
  note: string | null;
};

type ApprovalResponse = {
  counts: {
    debtors: number;
    loans: number;
    total: number;
  };
  debtors: ApprovalItem[];
  loans: ApprovalItem[];
};

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

export default function WorkPage() {
  const { role, organization } = useUserStore();
  const activeRole: MobileRole = role === "creditor" || role === "debtor" ? role : "collector";
  const [focus, setFocus] = useState<OverviewResponse["overview"]["focus"]>([]);
  const [routeRun, setRouteRun] = useState<RouteRunResponse | null>(null);
  const [loadingRouteRun, setLoadingRouteRun] = useState(activeRole === "collector");

  const [loadingApprovals, setLoadingApprovals] = useState(activeRole === "creditor");
  const [acting, setActing] = useState(false);
  const [approvals, setApprovals] = useState<ApprovalResponse | null>(null);
  const [selectedFilter, setSelectedFilter] = useState<FilterKey>("all");
  const [selectedApprovalId, setSelectedApprovalId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [banner, setBanner] = useState<BannerState>(null);

  useEffect(() => {
    if (activeRole === "creditor" || activeRole === "collector") return;

    let mounted = true;
    fetchJson<OverviewResponse>("/api/mobile/overview")
      .then((payload) => {
        if (mounted) {
          setFocus(payload.overview.focus);
        }
      })
      .catch(() => {
        if (mounted) {
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
        }
      });

    return () => {
      mounted = false;
    };
  }, [activeRole]);

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
    if (activeRole !== "creditor") return;
    void loadApprovals();
  }, [activeRole, loadApprovals]);

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

  const handleDecision = async (decision: "approve" | "reject") => {
    if (!selectedApproval) return;
    if (decision === "reject" && !note.trim()) {
      setBanner({ tone: "warning", text: "Add a clear note before rejecting so the field team knows what to correct." });
      return;
    }

    setActing(true);
    try {
      await fetchJson<ApprovalActionResponse>("/api/mobile/approvals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: selectedApproval.kind,
          id: selectedApproval.id,
          decision,
          note: note.trim() || null,
        }),
      });

      setBanner({
        tone: "success",
        text: `${selectedApproval.title} ${decision === "approve" ? "approved" : "rejected"} successfully.`,
      });
      await loadApprovals(selectedApproval.id);
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
      <div className="space-y-4 pb-4">
        <section className="mobile-panel-strong px-5 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-emerald-700">
                {routeRun?.organization?.name || organization?.name || "Collector route run"}
              </p>
              <h2 className="mt-1 text-xl font-semibold text-[#14213d]">Today&apos;s route runway</h2>
              <p className="mt-2 text-sm leading-relaxed text-stone-600">
                Move stop by stop, see which routes need attention first, and jump straight into capture when you&apos;re standing with the debtor.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void loadRouteRun()}
              disabled={loadingRouteRun}
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-700 disabled:opacity-45"
            >
              {loadingRouteRun ? <LoaderCircle size={22} className="animate-spin" /> : <RefreshCw size={22} />}
            </button>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-[24px] border border-stone-900/8 bg-white/72 px-4 py-4">
              <p className="text-[10px] uppercase tracking-[0.18em] text-stone-500">Expected today</p>
              <p className="mt-2 text-lg font-semibold text-[#14213d]">{formatCurrency(summary?.expected || 0)}</p>
              <p className="mt-2 text-xs text-stone-500">{summary?.routeCount || 0} routes active</p>
            </div>
            <div className="rounded-[24px] border border-stone-900/8 bg-white/72 px-4 py-4">
              <p className="text-[10px] uppercase tracking-[0.18em] text-stone-500">Captured</p>
              <p className="mt-2 text-lg font-semibold text-[#14213d]">{formatCurrency(summary?.collected || 0)}</p>
              <p className="mt-2 text-xs text-stone-500">{summary?.completedStops || 0} stops closed</p>
            </div>
            <div className="rounded-[24px] border border-stone-900/8 bg-white/72 px-4 py-4">
              <p className="text-[10px] uppercase tracking-[0.18em] text-stone-500">Still open</p>
              <p className="mt-2 text-lg font-semibold text-[#14213d]">{summary?.pendingStops || 0}</p>
              <p className="mt-2 text-xs text-stone-500">Need a visit outcome</p>
            </div>
            <div className="rounded-[24px] border border-stone-900/8 bg-white/72 px-4 py-4">
              <p className="text-[10px] uppercase tracking-[0.18em] text-stone-500">Attention</p>
              <p className="mt-2 text-lg font-semibold text-[#14213d]">{summary?.attentionStops || 0}</p>
              <p className="mt-2 text-xs text-stone-500">Overdue or unresolved stops</p>
            </div>
          </div>
        </section>

        {banner ? (
          <section className={`mobile-panel px-4 py-4 ${banner.tone === "success" ? "border-emerald-700/12 bg-emerald-500/8" : banner.tone === "warning" ? "border-amber-700/12 bg-amber-500/10" : banner.tone === "danger" ? "border-rose-700/14 bg-rose-500/10" : "border-stone-900/8 bg-white/72"}`}>
            <p className="text-sm leading-relaxed text-stone-800">{banner.text}</p>
          </section>
        ) : null}

        <section className="mobile-panel-ink px-5 py-5 text-white">
          <p className="text-[11px] uppercase tracking-[0.18em] text-emerald-100/80">Next best stop</p>
          <h3 className="mt-2 text-2xl font-semibold">{routeRun?.nextStop?.debtorName || "No stop queued yet"}</h3>
          <p className="mt-2 text-sm text-white/72">
            {routeRun?.nextStop
              ? `${routeRun.nextStop.routeName} · ${formatCurrency(routeRun.nextStop.amountDue)} · ${routeRun.nextStop.status.replaceAll("_", " ")}`
              : "As soon as a live collection stop is available, the next best field action will appear here."}
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            {routeRun?.nextStop ? (
              <Link href={`/collector?loanId=${routeRun.nextStop.loanId}`} className="inline-flex items-center gap-2 rounded-full bg-[#fff7eb] px-4 py-3 text-sm font-semibold text-[#14213d]">
                Open capture
                <ArrowRight size={16} />
              </Link>
            ) : null}
            <Link href="/collector" className="inline-flex items-center gap-2 rounded-full border border-white/14 px-4 py-3 text-sm font-semibold text-white/86">
              Capture workspace
            </Link>
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-stone-500">Route groups</p>
              <h3 className="mt-1 text-lg font-semibold text-[#14213d]">Field sequence</h3>
            </div>
          </div>

          {loadingRouteRun ? (
            Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="mobile-panel px-5 py-5">
                <div className="h-4 w-24 animate-pulse rounded-full bg-stone-200" />
                <div className="mt-3 h-7 w-2/3 animate-pulse rounded-full bg-stone-200" />
                <div className="mt-4 h-3 w-full animate-pulse rounded-full bg-stone-100" />
              </div>
            ))
          ) : !routeRun || routeRun.routes.length === 0 ? (
            <section className="mobile-panel px-5 py-6 text-center">
              <p className="text-base font-semibold text-[#14213d]">No route stops are active right now.</p>
              <p className="mt-2 text-sm leading-relaxed text-stone-600">
                This route view falls back to live assigned loans, so an empty state here usually means this collector has no active schedule today.
              </p>
            </section>
          ) : (
            routeRun.routes.map((route) => (
              <section key={route.id} className="mobile-panel px-5 py-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.18em] text-stone-500">{route.area || "Coverage area"}</p>
                    <h3 className="mt-1 text-lg font-semibold text-[#14213d]">{route.name}</h3>
                    <p className="mt-2 text-sm text-stone-600">
                      {route.pending} open stop{route.pending === 1 ? "" : "s"} · {formatCurrency(route.expected)} expected
                    </p>
                  </div>
                  <StatusPill label={route.attention > 0 ? `${route.attention} attention` : "On track"} tone={route.attention > 0 ? "amber" : "emerald"} />
                </div>

                <div className="mt-4 space-y-3">
                  {route.stops.map((stop) => (
                    <Link
                      key={`${route.id}-${stop.loanId}-${stop.collectionDate}`}
                      href={`/collector?loanId=${stop.loanId}`}
                      className="block rounded-[24px] border border-stone-900/8 bg-white/72 px-4 py-4 transition-colors hover:bg-white"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-[#14213d]">{stop.debtorName}</p>
                          <p className="mt-1 text-xs text-stone-500">{stop.loanNumber}</p>
                        </div>
                        <span className={`rounded-full px-3 py-1 text-[11px] font-semibold capitalize ${
                          stop.overdue
                            ? "bg-rose-500/12 text-rose-900"
                            : stop.status === "partial"
                              ? "bg-amber-500/12 text-amber-900"
                              : stop.status === "collected"
                                ? "bg-emerald-500/12 text-emerald-900"
                                : "bg-stone-900/6 text-stone-700"
                        }`}>
                          {stop.overdue ? "overdue" : stop.status}
                        </span>
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-[10px] uppercase tracking-[0.16em] text-stone-500">Due now</p>
                          <p className="mt-1 font-semibold text-[#14213d]">{formatCurrency(stop.amountDue)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-[0.16em] text-stone-500">Remaining</p>
                          <p className="mt-1 font-semibold text-[#14213d]">{formatCurrency(stop.amountRemaining)}</p>
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-3 text-xs text-stone-500">
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
          <section className="mobile-panel px-5 py-5">
            <p className="text-[11px] uppercase tracking-[0.18em] text-stone-500">Attention stack</p>
            <div className="mt-4 space-y-3">
              {routeRun.attention.map((item) => (
                <Link
                  key={`attention-${item.loanId}`}
                  href={`/collector?loanId=${item.loanId}`}
                  className="block rounded-[22px] border border-stone-900/8 bg-white/72 px-4 py-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-[#14213d]">{item.debtorName}</p>
                      <p className="mt-1 text-xs text-stone-500">{item.routeName}</p>
                    </div>
                    <StatusPill label={item.overdue ? "Overdue" : item.status.replaceAll("_", " ")} tone={item.overdue ? "amber" : "ink"} />
                  </div>
                  <p className="mt-3 text-sm text-stone-600">
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
      <div className="space-y-4 pb-4">
        <section className="mobile-panel px-5 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-stone-500">Focused workflow</p>
              <h2 className="mt-1 text-xl font-semibold text-[#14213d]">
                {activeRole === "debtor" ? "Repayment schedule" : "Route runway"}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-stone-600">
                {activeRole === "debtor"
                  ? "See exactly what is coming next, who will visit, and where each payment stands."
                  : "A cleaner sequence for where to go next, who needs attention, and how much cash should be captured."}
              </p>
            </div>
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-700">
              {activeRole === "debtor" ? <CheckCircle2 size={22} /> : <Wallet size={22} />}
            </div>
          </div>
        </section>

        <section className="space-y-3">
          {focus.map((item, index) => (
            <div key={item.title} className="mobile-panel-strong px-5 py-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-stone-500">Step {index + 1}</p>
                  <h3 className="mt-1 text-lg font-semibold text-[#14213d]">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-stone-600">{item.subtitle}</p>
                </div>
                <StatusPill label={item.status} tone={item.tone} />
              </div>
              <div className="mt-4 flex items-center justify-between rounded-[22px] bg-stone-900/[0.04] px-4 py-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.16em] text-stone-500">Working amount</p>
                  <p className="mt-1 text-base font-semibold text-[#14213d]">{item.displayValue}</p>
                </div>
                <button className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#14213d] text-white">
                  <ChevronRight size={18} />
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
    <div className="space-y-4 pb-4">
      <section className="mobile-panel-strong px-5 py-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-emerald-700">Creditor mobile inbox</p>
            <h2 className="mt-1 text-xl font-semibold text-[#14213d]">Approval desk</h2>
            <p className="mt-2 text-sm leading-relaxed text-stone-600">
              Review collector-submitted debtor records and loan proposals without carrying the full admin dashboard on your phone.
            </p>
          </div>
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-700">
            <ShieldAlert size={22} />
          </div>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-3">
          {filters.map((filter) => (
            <button
              key={filter.key}
              type="button"
              onClick={() => setSelectedFilter(filter.key)}
              className={`rounded-[22px] border px-4 py-4 text-left transition-all ${selectedFilter === filter.key ? "border-[#14213d] bg-[#14213d] text-white" : "border-stone-900/8 bg-white/75 text-stone-900"}`}
            >
              <p className={`text-[10px] uppercase tracking-[0.18em] ${selectedFilter === filter.key ? "text-white/60" : "text-stone-500"}`}>{filter.label}</p>
              <p className="mt-2 text-xl font-semibold">{filter.count}</p>
            </button>
          ))}
        </div>
      </section>

      {banner ? (
        <section className={`mobile-panel px-4 py-4 ${banner.tone === "success" ? "border-emerald-700/12 bg-emerald-500/8" : banner.tone === "warning" ? "border-amber-700/12 bg-amber-500/10" : banner.tone === "danger" ? "border-rose-700/14 bg-rose-500/10" : "border-stone-900/8 bg-white/72"}`}>
          <p className="text-sm leading-relaxed text-stone-800">{banner.text}</p>
        </section>
      ) : null}

      <section className="space-y-3">
        {loadingApprovals ? (
          Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="mobile-panel px-5 py-5">
              <div className="h-4 w-24 animate-pulse rounded-full bg-stone-200" />
              <div className="mt-3 h-7 w-2/3 animate-pulse rounded-full bg-stone-200" />
              <div className="mt-3 h-3 w-full animate-pulse rounded-full bg-stone-100" />
            </div>
          ))
        ) : filteredItems.length === 0 ? (
          <section className="mobile-panel px-5 py-6 text-center">
            <p className="text-base font-semibold text-[#14213d]">No approvals are waiting right now.</p>
            <p className="mt-2 text-sm leading-relaxed text-stone-600">
              Once collectors submit new debtor records or loan proposals, they will appear here automatically.
            </p>
          </section>
        ) : (
          filteredItems.map((item) => {
            const active = selectedApproval?.id === item.id;
            return (
              <button
                key={`${item.kind}-${item.id}`}
                type="button"
                onClick={() => setSelectedApprovalId(item.id)}
                className={`w-full rounded-[28px] border px-5 py-5 text-left transition-all ${active ? "border-[#14213d] bg-[#14213d] text-white shadow-[0_24px_50px_rgba(20,33,61,0.22)]" : "mobile-panel-strong"}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className={`text-[11px] uppercase tracking-[0.18em] ${active ? "text-white/60" : "text-stone-500"}`}>{item.badge}</p>
                    <h3 className="mt-1 text-lg font-semibold">{item.title}</h3>
                    <p className={`mt-2 text-sm leading-relaxed ${active ? "text-white/72" : "text-stone-600"}`}>{item.subtitle}</p>
                  </div>
                  <StatusPill label="Pending" tone={active ? "slate" : item.kind === "loan" ? "amber" : "ink"} />
                </div>

                <div className={`mt-4 flex flex-wrap gap-3 text-xs ${active ? "text-white/70" : "text-stone-500"}`}>
                  <span>{getRequesterLabel(item)}</span>
                  <span>{formatDate(item.requestedAt)}</span>
                </div>
              </button>
            );
          })
        )}
      </section>

      {selectedApproval ? (
        <section className="mobile-panel-ink px-5 py-5 text-white">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-emerald-100/80">Decision panel</p>
              <h3 className="mt-1 text-2xl font-semibold">{selectedApproval.title}</h3>
              <p className="mt-2 text-sm text-white/72">{selectedApproval.subtitle}</p>
            </div>
            <StatusPill label={selectedApproval.kind === "loan" ? "Loan" : "Debtor"} tone="slate" />
          </div>

          <div className="mt-5 grid gap-3">
            {selectedApproval.metrics.map((metric) => (
              <div key={`${selectedApproval.id}-${metric.label}`} className="rounded-[22px] border border-white/10 bg-white/8 px-4 py-4">
                <p className="text-[10px] uppercase tracking-[0.16em] text-white/58">{metric.label}</p>
                <p className="mt-2 text-base font-semibold text-white">{metric.value}</p>
              </div>
            ))}
          </div>

          <div className="mt-5 rounded-[24px] border border-white/10 bg-white/8 px-4 py-4">
            <p className="inline-flex items-center gap-2 text-sm font-semibold text-white"><MessageSquareQuote size={16} />Approval note</p>
            <p className="mt-2 text-xs text-white/58">
              Use this for context, rejection reasons, or anything the collector should see when the request is reviewed.
            </p>
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={4}
              className="mt-3 w-full rounded-[20px] border border-white/10 bg-white/10 px-4 py-3 text-sm text-white outline-none placeholder:text-white/38"
              placeholder={selectedApproval.kind === "loan" ? "Add approval context or explain what needs to change." : "Explain any correction the collector should make before resubmitting."}
            />
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => void handleDecision("reject")}
              disabled={acting}
              className="rounded-[24px] border border-white/16 bg-white/6 px-4 py-4 text-sm font-semibold text-white disabled:opacity-45"
            >
              {acting ? <LoaderCircle size={18} className="mx-auto animate-spin" /> : "Reject"}
            </button>
            <button
              type="button"
              onClick={() => void handleDecision("approve")}
              disabled={acting}
              className="rounded-[24px] bg-[#fff7eb] px-4 py-4 text-sm font-semibold text-[#14213d] disabled:opacity-45"
            >
              {acting ? <LoaderCircle size={18} className="mx-auto animate-spin" /> : "Approve"}
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
