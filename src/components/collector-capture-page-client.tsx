"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CalendarClock,
  CheckCheck,
  LoaderCircle,
  MapPin,
  NotebookPen,
  Radio,
  RefreshCw,
  TriangleAlert,
  WalletCards,
  Wifi,
  WifiOff,
} from "lucide-react";
import { EnsureUser } from "@/components/auth/ensure-user";
import { fetchJson } from "@/lib/fetch-json";
import {
  enqueueCollection,
  flushQueue,
  loadQueue,
  loadQueueSyncState,
  type QueueSyncState,
  type QueuedCollection,
} from "@/lib/offline-queue";
import { useUserStore } from "@/store/user-store";
import { getRoleLabel, type MobileRole } from "@/lib/mobile-demo-data";
import { normalizeMobileRole } from "@/lib/mobile-route-access";
import type { CaptureItem, CollectorCapturePayload } from "@/lib/mobile-collector-capture";

type SaveResponse = {
  ok: boolean;
  saved: number;
};

type BannerTone = "info" | "success" | "warning" | "danger";
type BannerState = { tone: BannerTone; text: string } | null;
type CaptureStatus = "collected" | "partial" | "missed" | "deferred";
type CaptureMethod = "cash" | "bank_transfer" | "mobile_money";

type OrganizationSummary = {
  id: string;
  name: string | null;
  ownerName: string | null;
  ownerEmail: string | null;
};

const statusOptions: Array<{ value: CaptureStatus; label: string; helper: string }> = [
  { value: "collected", label: "Collected", helper: "Capture the scheduled amount in full." },
  { value: "partial", label: "Partial", helper: "Record a lower amount and keep the stop active." },
  { value: "missed", label: "Missed", helper: "Mark the stop as not collected today." },
  { value: "deferred", label: "Deferred", helper: "Collector and debtor agreed to shift this stop." },
];

const methodOptions: Array<{ value: CaptureMethod; label: string }> = [
  { value: "cash", label: "Cash" },
  { value: "bank_transfer", label: "Transfer" },
  { value: "mobile_money", label: "Mobile money" },
];

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-LK", {
    style: "currency",
    currency: "LKR",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(amount) ? amount : 0);
}

function formatDateLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-LK", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(date);
}

function normalizeMethod(value: string | null | undefined): CaptureMethod {
  if (value === "mobile" || value === "mobile_money") return "mobile_money";
  if (value === "transfer" || value === "bank_transfer") return "bank_transfer";
  return "cash";
}

function buildAmountValue(amount: number) {
  if (!amount) return "0";
  return Number.isInteger(amount) ? String(amount) : amount.toFixed(2);
}

function getSuggestedAmount(item: CaptureItem, status: CaptureStatus) {
  if (status === "missed" || status === "deferred") return 0;
  if (status === "partial") {
    const fallback =
      item.amountCollected > 0 && item.amountCollected < item.amountDue
        ? item.amountCollected
        : Math.max(Math.round(item.amountDue * 0.5), 1);
    return Math.min(fallback, item.amountDue || item.amountRemaining || fallback);
  }
  if (item.amountCollected > 0) {
    return item.amountCollected;
  }
  return item.amountDue || Math.min(item.dailyInstallment || item.amountRemaining, item.amountRemaining || item.dailyInstallment);
}

function applyLocalCapture(items: CaptureItem[], payload: QueuedCollection) {
  return items.map((item) => {
    if (item.loanId !== payload.loanId) return item;
    const delta = payload.amount - item.amountCollected;
    return {
      ...item,
      collectionId: payload.collectionId,
      amountCollected: payload.amount,
      amountRemaining: Math.max(item.amountRemaining - delta, 0),
      status: payload.status,
      paymentMethod: payload.method,
      notes: payload.notes,
      collectedAt: payload.capturedAt,
      collectionDate: payload.collectionDate,
    };
  });
}

function buildRoleFallback(activeRole: MobileRole) {
  if (activeRole === "debtor") {
    return {
      title: "Payment center",
      summary: "Your collector capture flow lives separately. This space will become the debtor payment and schedule action center next.",
      primaryHref: "/dashboard/work",
      primaryLabel: "Open repayment schedule",
      secondaryHref: "/dashboard/portfolio",
      secondaryLabel: "View loans",
    };
  }

  return {
    title: "Operations hub",
    summary: "Mobile creditor actions are staying lightweight. Approval queues and field exceptions come here after the collector capture slice is complete.",
    primaryHref: "/dashboard/work",
    primaryLabel: "Open approvals",
    secondaryHref: "/dashboard/portfolio",
    secondaryLabel: "Review people",
  };
}

function formatSyncDate(value: string | null) {
  if (!value) return "Not synced yet";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not synced yet";
  return new Intl.DateTimeFormat("en-LK", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function isLikelyNetworkError(error: unknown) {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return message.includes("failed to fetch") || message.includes("network") || message.includes("load failed");
}

export function CollectorCapturePageClient({
  initialRole,
  initialOrganization,
  initialCaptureContext,
  initialPreferredLoanId,
}: {
  initialRole: MobileRole;
  initialOrganization: OrganizationSummary | null;
  initialCaptureContext: CollectorCapturePayload | null;
  initialPreferredLoanId: string | null;
}) {
  const { role, organization } = useUserStore();
  const activeRole: MobileRole = normalizeMobileRole(role || initialRole);
  const workspaceOrganization = organization || initialOrganization;
  const isCollector = activeRole === "collector";

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [syncingQueue, setSyncingQueue] = useState(false);
  const [items, setItems] = useState<CaptureItem[]>(initialCaptureContext?.items || []);
  const [collectionDate, setCollectionDate] = useState(initialCaptureContext?.collectionDate || "");
  const [selectedLoanId, setSelectedLoanId] = useState<string | null>(
    initialPreferredLoanId && (initialCaptureContext?.items || []).some((item) => item.loanId === initialPreferredLoanId)
      ? initialPreferredLoanId
      : initialCaptureContext?.items?.[0]?.loanId || null,
  );
  const [amount, setAmount] = useState("0");
  const [status, setStatus] = useState<CaptureStatus>("collected");
  const [method, setMethod] = useState<CaptureMethod>("cash");
  const [notes, setNotes] = useState("");
  const [banner, setBanner] = useState<BannerState>(null);
  const [queueCount, setQueueCount] = useState(0);
  const [online, setOnline] = useState(true);
  const [syncState, setSyncState] = useState<QueueSyncState>(() => loadQueueSyncState());

  const selectedItem = useMemo(
    () => items.find((item) => item.loanId === selectedLoanId) || items[0] || null,
    [items, selectedLoanId],
  );

  const totals = useMemo(() => {
    const expected = items.reduce((sum, item) => sum + item.amountDue, 0);
    const collected = items.reduce((sum, item) => sum + item.amountCollected, 0);
    const pending = items.filter((item) => item.status === "pending" || item.status === "partial").length;
    return { expected, collected, pending };
  }, [items]);

  const loadCaptureContext = useCallback(
    async (preferredLoanId?: string | null) => {
      if (!isCollector) return;

      setLoading(true);
      try {
        const payload = await fetchJson<CollectorCapturePayload>("/api/collections?date=today");
        setItems(payload.items || []);
        setCollectionDate(payload.collectionDate || "");
        setSelectedLoanId((current) => {
          const nextId = preferredLoanId || current;
          if (nextId && payload.items.some((item) => item.loanId === nextId)) return nextId;
          return payload.items[0]?.loanId || null;
        });
        setBanner((current) =>
          current?.tone === "danger" ? { tone: "info", text: "Live collection context is back online." } : current,
        );
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Failed to load collector schedule";
        setItems([]);
        setSelectedLoanId(null);
        setBanner({ tone: "danger", text: message });
      } finally {
        setLoading(false);
      }
    },
    [isCollector],
  );

  const syncPendingQueue = useCallback(async () => {
    if (!isCollector || !online || queueCount === 0) return;

    setSyncingQueue(true);
    try {
      const result = await flushQueue();
      setQueueCount(result.remaining);
      setSyncState(loadQueueSyncState());
      setBanner({
        tone: result.failed > 0 ? "warning" : "success",
        text:
          result.failed > 0
            ? `${result.flushed} queued capture${result.flushed === 1 ? "" : "s"} synced, ${result.remaining} still waiting.`
            : `${result.flushed} queued capture${result.flushed === 1 ? "" : "s"} synced successfully.`,
      });
      await loadCaptureContext(selectedLoanId);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to sync offline queue";
      setQueueCount(loadQueue().length);
      setSyncState(loadQueueSyncState());
      setBanner({ tone: "warning", text: message });
    } finally {
      setSyncingQueue(false);
    }
  }, [isCollector, loadCaptureContext, online, queueCount, selectedLoanId]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const refreshConnectionState = () => {
      setOnline(window.navigator.onLine);
      setQueueCount(loadQueue().length);
      setSyncState(loadQueueSyncState());
    };

    refreshConnectionState();
    window.addEventListener("online", refreshConnectionState);
    window.addEventListener("offline", refreshConnectionState);

    return () => {
      window.removeEventListener("online", refreshConnectionState);
      window.removeEventListener("offline", refreshConnectionState);
    };
  }, []);

  useEffect(() => {
    if (!isCollector || !online || queueCount === 0) return;
    void syncPendingQueue();
  }, [isCollector, online, queueCount, syncPendingQueue]);

  useEffect(() => {
    if (!selectedItem) return;

    const nextStatus = selectedItem.status === "pending" ? "collected" : selectedItem.status;
    setStatus(nextStatus);
    setAmount(buildAmountValue(getSuggestedAmount(selectedItem, nextStatus)));
    setMethod(normalizeMethod(selectedItem.paymentMethod));
    setNotes(selectedItem.notes || "");
  }, [selectedItem]);

  const handleStatusChange = (nextStatus: CaptureStatus) => {
    setStatus(nextStatus);
    if (!selectedItem) return;
    setAmount(buildAmountValue(getSuggestedAmount(selectedItem, nextStatus)));
  };

  const handleSubmit = async () => {
    if (!selectedItem) return;

    const parsedAmount = Number(amount || 0);
    if (!Number.isFinite(parsedAmount) || parsedAmount < 0) {
      setBanner({ tone: "warning", text: "Enter a valid amount before saving this stop." });
      return;
    }

    if (status === "partial" && (parsedAmount <= 0 || parsedAmount >= selectedItem.amountDue)) {
      setBanner({ tone: "warning", text: "Partial captures need an amount between zero and the scheduled due amount." });
      return;
    }

    const normalizedAmount =
      status === "missed" || status === "deferred"
        ? 0
        : Math.min(parsedAmount, Math.max(selectedItem.amountRemaining, selectedItem.amountDue, parsedAmount));

    const payload: QueuedCollection = {
      id: `${selectedItem.loanId}-${Date.now()}`,
      collectionId: selectedItem.collectionId,
      loanId: selectedItem.loanId,
      debtorId: selectedItem.debtorId,
      debtorName: selectedItem.debtorName,
      amountDue: selectedItem.amountDue,
      amount: normalizedAmount,
      method,
      status,
      notes: notes.trim() || null,
      collectionDate: selectedItem.collectionDate || collectionDate,
      capturedAt: new Date().toISOString(),
    };

    if (!online) {
      const nextQueue = enqueueCollection(payload);
      setQueueCount(nextQueue.length);
      setSyncState(loadQueueSyncState());
      setItems((current) => applyLocalCapture(current, payload));
      setBanner({ tone: "warning", text: "Saved offline. We’ll sync this capture as soon as the device reconnects." });
      return;
    }

    setSubmitting(true);
    try {
      await fetchJson<SaveResponse>("/api/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setBanner({ tone: "success", text: `Captured ${formatCurrency(normalizedAmount)} for ${selectedItem.debtorName}.` });
      await loadCaptureContext(selectedItem.loanId);
    } catch (error: unknown) {
      if (isLikelyNetworkError(error)) {
        const nextQueue = enqueueCollection(payload);
        setQueueCount(nextQueue.length);
        setSyncState(loadQueueSyncState());
        setItems((current) => applyLocalCapture(current, payload));
        setBanner({ tone: "warning", text: "Connection dropped while saving. The stop was queued locally and will replay automatically." });
      } else {
        const message = error instanceof Error ? error.message : "Failed to save collection";
        setBanner({ tone: "danger", text: message });
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (!isCollector) {
    const fallback = buildRoleFallback(activeRole);
    return (
      <main className="min-h-screen px-4 py-6 pb-28 text-stone-900 sm:px-6">
        <EnsureUser />
        <div className="mobile-shell space-y-4">
          <header className="mobile-panel-strong px-5 py-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm font-semibold text-stone-600 dark:text-white/68">
                  <ArrowLeft size={16} />
                  Back to workspace
                </Link>
                <p className="mt-4 text-[11px] uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-300">{getRoleLabel(activeRole)}</p>
                <h1 className="mobile-title mt-1 text-[2.2rem] leading-none text-[#14213d] dark:text-white">{fallback.title}</h1>
                <p className="mt-3 text-sm leading-relaxed text-stone-600 dark:text-white/68">{fallback.summary}</p>
              </div>
              <div className="rounded-full bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-800 dark:text-emerald-200">
                Mobile next
              </div>
            </div>
          </header>

          <section className="mobile-panel px-5 py-5">
            <p className="mobile-section-label">Current focus</p>
            <h2 className="mobile-text-primary mt-2 text-xl font-semibold">Collector capture is the first deep mobile workflow</h2>
            <p className="mobile-text-secondary mt-3 text-sm leading-relaxed">
              We’re keeping the operational center focused so the collector experience lands cleanly first. Your role-specific action surfaces come right after that.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link href={fallback.primaryHref} className="mobile-inline-action">
                {fallback.primaryLabel}
                <ArrowRight size={16} />
              </Link>
              <Link href={fallback.secondaryHref} className="mobile-inline-action-secondary">
                {fallback.secondaryLabel}
              </Link>
            </div>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-4 py-6 pb-28 text-stone-900 sm:px-6">
      <EnsureUser />
      <div className="mobile-shell space-y-4">
        <header className="mobile-panel px-5 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Link href="/dashboard/work" className="inline-flex items-center gap-2 text-sm font-semibold text-stone-600 dark:text-white/68">
                <ArrowLeft size={16} />
                Back to route workstream
              </Link>
              <p className="mt-4 text-[11px] uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-300">{workspaceOrganization?.name || "Collector workspace"}</p>
              <h1 className="mobile-title mt-1 text-[2.2rem] leading-none text-[#14213d] dark:text-white">Live route capture</h1>
              <p className="mt-3 text-sm leading-relaxed text-stone-600 dark:text-white/68">
                Capture today’s field stops with the same Daily+ business logic, even if the device drops offline for a while.
              </p>
            </div>
            <div className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold ${online ? "bg-emerald-500/10 text-emerald-800 dark:text-emerald-200" : "bg-amber-500/12 text-amber-900 dark:text-amber-200"}`}>
              {online ? <Wifi size={14} /> : <WifiOff size={14} />}
              {online ? "Live" : "Offline"}
            </div>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-3">
            <div className="mobile-panel-strong px-4 py-4">
              <p className="mobile-text-tertiary text-[10px] uppercase tracking-[0.18em]">Expected today</p>
              <p className="mobile-text-primary mt-2 text-lg font-semibold">{formatCurrency(totals.expected)}</p>
            </div>
            <div className="mobile-panel-strong px-4 py-4">
              <p className="mobile-text-tertiary text-[10px] uppercase tracking-[0.18em]">Captured</p>
              <p className="mobile-text-primary mt-2 text-lg font-semibold">{formatCurrency(totals.collected)}</p>
            </div>
            <div className="mobile-panel-strong px-4 py-4">
              <p className="mobile-text-tertiary text-[10px] uppercase tracking-[0.18em]">Stops open</p>
              <p className="mobile-text-primary mt-2 text-lg font-semibold">{totals.pending}</p>
            </div>
          </div>
        </header>

        {banner ? (
          <section className={`mobile-panel px-4 py-4 ${banner.tone === "success" ? "border-emerald-700/12 bg-emerald-500/8" : banner.tone === "warning" ? "border-amber-700/12 bg-amber-500/10" : banner.tone === "danger" ? "border-rose-700/14 bg-rose-500/10" : "mobile-surface-subtle"}`}>
            <div className="flex items-start gap-3">
              {banner.tone === "danger" || banner.tone === "warning" ? <TriangleAlert className="mt-0.5 shrink-0" size={18} /> : <CheckCheck className="mt-0.5 shrink-0" size={18} />}
              <p className="mobile-text-primary text-sm leading-relaxed">{banner.text}</p>
            </div>
          </section>
        ) : null}

        <section className="mobile-panel px-5 py-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="mobile-section-label">Collector queue</p>
              <h2 className="mobile-text-primary mt-1 text-lg font-semibold">{queueCount > 0 ? `${queueCount} capture${queueCount === 1 ? "" : "s"} waiting to sync` : "All captures synced"}</h2>
              <p className="mobile-text-secondary mt-1 text-sm">
                {queueCount > 0 ? "Queued captures will replay against the live Daily+ API." : "You’re operating against live schedule data right now."}
              </p>
              <p className="mobile-text-tertiary mt-1 text-xs">
                Last sync: {formatSyncDate(syncState.lastSyncedAt)}
                {syncState.lastError ? ` · Last issue: ${syncState.lastError}` : ""}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void syncPendingQueue()}
              disabled={!online || queueCount === 0 || syncingQueue}
              className="mobile-inline-action-secondary disabled:cursor-not-allowed disabled:opacity-45"
            >
              {syncingQueue ? <LoaderCircle size={16} className="animate-spin" /> : <RefreshCw size={16} />}
              Sync now
            </button>
          </div>
        </section>

        <section className="mobile-panel-strong px-5 py-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-300">Today’s route run</p>
              <h2 className="mobile-text-primary mt-1 text-xl font-semibold">{collectionDate ? formatDateLabel(collectionDate) : "Today"}</h2>
              <p className="mobile-text-secondary mt-1 text-sm">Choose a stop, confirm the visit outcome, and save it straight to the live account ledger.</p>
            </div>
            <button
              type="button"
              onClick={() => void loadCaptureContext(selectedLoanId)}
              disabled={loading}
              className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-[color:var(--line-soft)] bg-[color:var(--surface-elevated)] text-[color:var(--ink-secondary)] disabled:opacity-45"
              aria-label="Refresh route stops"
            >
              {loading ? <LoaderCircle size={18} className="animate-spin" /> : <RefreshCw size={18} />}
            </button>
          </div>

          <div className="mt-5 space-y-3">
            {loading ? (
              Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="mobile-panel px-4 py-4">
                  <div className="h-4 w-28 animate-pulse rounded-full bg-[color:var(--ink-soft)]" />
                  <div className="mt-3 h-8 w-44 animate-pulse rounded-full bg-[color:var(--ink-soft)]" />
                  <div className="mt-4 h-3 w-full animate-pulse rounded-full bg-[color:var(--ink-soft)]" />
                </div>
              ))
            ) : items.length === 0 ? (
              <div className="rounded-[28px] border border-dashed border-[color:var(--line-soft)] bg-[color:var(--surface-elevated)] px-5 py-6 text-center">
                <p className="mobile-text-primary text-base font-semibold">No stops are queued for today yet.</p>
                <p className="mobile-text-secondary mt-2 text-sm leading-relaxed">
                  This now falls back to active assigned loans, so if this is still empty it likely means no live loans are currently assigned to this collector.
                </p>
              </div>
            ) : (
              items.map((item) => {
                const active = selectedItem?.loanId === item.loanId;
                const statusTone =
                  item.status === "collected"
                    ? "bg-emerald-500/12 text-emerald-900 dark:text-emerald-200"
                    : item.status === "partial"
                      ? "bg-amber-500/14 text-amber-900 dark:text-amber-200"
                      : item.status === "missed" || item.status === "deferred"
                        ? "bg-rose-500/10 text-rose-900 dark:text-rose-200"
                        : "bg-stone-900/6 text-stone-700 dark:bg-white/8 dark:text-white/78";

                return (
                  <button
                    key={`${item.loanId}-${item.collectionDate}`}
                    type="button"
                    onClick={() => setSelectedLoanId(item.loanId)}
                    className={`w-full rounded-[28px] border px-4 py-4 text-left transition-all ${active ? "border-[color:var(--accent-strong)] bg-[color:var(--accent-strong)] text-white shadow-[0_24px_50px_rgba(20,33,61,0.22)]" : "mobile-panel text-[color:var(--ink-strong)]"}`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className={`text-[11px] uppercase tracking-[0.18em] ${active ? "text-white/72" : "mobile-text-tertiary"}`}>{item.loanNumber}</p>
                        <h3 className="mt-1 text-lg font-semibold">{item.debtorName}</h3>
                      </div>
                      <span className={`inline-flex rounded-full px-3 py-1 text-[11px] font-semibold capitalize ${active ? "bg-white/12 text-white" : statusTone}`}>
                        {item.status}
                      </span>
                    </div>

                    <div className={`mt-4 grid grid-cols-2 gap-3 text-sm ${active ? "text-white/82" : "mobile-text-secondary"}`}>
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.16em] opacity-70">Due now</p>
                        <p className="mt-1 font-semibold">{formatCurrency(item.amountDue)}</p>
                      </div>
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.16em] opacity-70">Loan remaining</p>
                        <p className="mt-1 font-semibold">{formatCurrency(item.amountRemaining)}</p>
                      </div>
                    </div>

                    <div className={`mt-4 flex flex-wrap gap-3 text-xs ${active ? "text-white/70" : "mobile-text-tertiary"}`}>
                      {item.address ? (
                        <span className="inline-flex items-center gap-1.5"><MapPin size={13} />{item.address}</span>
                      ) : null}
                      {item.phone ? (
                        <span className="inline-flex items-center gap-1.5"><Radio size={13} />{item.phone}</span>
                      ) : null}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </section>

        {selectedItem ? (
          <section className="mobile-panel px-5 py-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="mobile-section-label">Selected stop</p>
                <h2 className="mobile-text-primary mt-1 text-2xl font-semibold">{selectedItem.debtorName}</h2>
                <p className="mobile-text-secondary mt-2 text-sm">
                  {selectedItem.loanNumber} · scheduled due {formatCurrency(selectedItem.amountDue)}
                </p>
              </div>
              <div className="mobile-inline-surface px-4 py-3 text-right">
                <p className="mobile-text-tertiary text-[10px] uppercase tracking-[0.18em]">Remaining</p>
                <p className="mobile-text-primary mt-1 text-lg font-semibold">{formatCurrency(selectedItem.amountRemaining)}</p>
              </div>
            </div>

            <div className="mt-5 space-y-5">
              <div>
                <p className="mobile-text-primary text-sm font-semibold">Visit outcome</p>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  {statusOptions.map((option) => {
                    const active = status === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => handleStatusChange(option.value)}
                        className={`rounded-[24px] border px-4 py-4 text-left transition-all ${active ? "border-[color:var(--accent-strong)] bg-[color:var(--accent-strong)] text-white" : "border-[color:var(--line-soft)] bg-[color:var(--surface-elevated)] text-[color:var(--ink-strong)]"}`}
                      >
                        <p className="text-sm font-semibold">{option.label}</p>
                        <p className={`mt-2 text-xs leading-relaxed ${active ? "text-white/72" : "mobile-text-secondary"}`}>{option.helper}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-2">
                  <span className="mobile-text-primary text-sm font-semibold">Captured amount</span>
                  <input
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                    inputMode="decimal"
                    className="mobile-input"
                    placeholder="Enter amount"
                    disabled={status === "missed" || status === "deferred"}
                  />
                  <span className="mobile-text-tertiary text-xs">Daily due {formatCurrency(selectedItem.amountDue)} · installment {formatCurrency(selectedItem.dailyInstallment)}</span>
                </label>

                <div className="space-y-2">
                  <span className="mobile-text-primary text-sm font-semibold">Payment method</span>
                  <div className="grid grid-cols-3 gap-2">
                    {methodOptions.map((option) => {
                      const active = method === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setMethod(option.value)}
                          className={`rounded-[20px] border px-3 py-3 text-sm font-semibold transition-all ${active ? "border-[color:var(--accent-strong)] bg-[color:var(--accent-strong)] text-white" : "border-[color:var(--line-soft)] bg-[color:var(--surface-elevated)] text-[color:var(--ink-strong)]"}`}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <label className="block space-y-2">
                <span className="inline-flex items-center gap-2 text-sm font-semibold text-[color:var(--ink-strong)]">
                  <NotebookPen size={16} />
                  Field notes
                </span>
                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  rows={4}
                  className="mobile-input min-h-[120px] resize-none"
                  placeholder="Anything the creditor or reviewer should know about this stop?"
                />
              </label>

              <div className="mobile-inline-surface flex flex-wrap items-center justify-between gap-3 px-4 py-4 text-sm">
                <div className="space-y-1">
                  <p className="inline-flex items-center gap-2 font-semibold text-[color:var(--ink-strong)]"><CalendarClock size={16} />Next sync target</p>
                  <p className="mobile-text-secondary">{online ? "This save will write to the live database immediately." : "This save will queue locally and replay when the device reconnects."}</p>
                </div>
                <button
                  type="button"
                  onClick={() => void handleSubmit()}
                  disabled={submitting}
                  className="mobile-inline-action min-w-[11rem] justify-center disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {submitting ? <LoaderCircle size={16} className="animate-spin" /> : <WalletCards size={16} />}
                  {online ? "Save capture" : "Queue capture"}
                </button>
              </div>
            </div>
          </section>
        ) : null}

        <section className="mobile-panel px-5 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="mobile-section-label">What this flow already does</p>
              <h2 className="mobile-text-primary mt-1 text-lg font-semibold">Shared backend logic, now in mobile form</h2>
            </div>
            <Building2 size={18} className="mt-1 text-stone-400 dark:text-white/40" />
          </div>
          <div className="mt-4 grid gap-3 text-sm">
            <div className="mobile-inline-surface px-4 py-4">It reads the collector’s live organization context and assigned route stops from the same Daily+ backend.</div>
            <div className="mobile-inline-surface px-4 py-4">When the schedule row already exists, this updates that exact collection instead of duplicating it.</div>
            <div className="mobile-inline-surface px-4 py-4">Each successful save also synchronizes the related loan balance and loan state behind the scenes.</div>
          </div>
        </section>
      </div>
    </main>
  );
}
