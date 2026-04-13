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
import { enqueueCollection, flushQueue, loadQueue, loadQueueSyncState, type QueueSyncState, type QueuedCollection } from "@/lib/offline-queue";
import { useUserStore } from "@/store/user-store";
import { getRoleLabel, type MobileRole } from "@/lib/mobile-demo-data";
import { normalizeMobileRole } from "@/lib/mobile-route-access";

type CaptureItem = {
  collectionId: string | null;
  loanId: string;
  debtorId: string;
  debtorName: string;
  phone: string | null;
  address: string | null;
  loanNumber: string;
  amountDue: number;
  amountCollected: number;
  amountRemaining: number;
  dailyInstallment: number;
  status: "pending" | "collected" | "partial" | "missed" | "deferred";
  paymentMethod: string | null;
  notes: string | null;
  collectionDate: string;
  collectedAt: string | null;
};

type CaptureResponse = {
  collectionDate: string;
  items: CaptureItem[];
  organization?: { name?: string | null } | null;
};

type SaveResponse = {
  ok: boolean;
  saved: number;
};

type BannerTone = "info" | "success" | "warning" | "danger";
type BannerState = { tone: BannerTone; text: string } | null;
type CaptureStatus = "collected" | "partial" | "missed" | "deferred";
type CaptureMethod = "cash" | "bank_transfer" | "mobile_money";

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
    const fallback = item.amountCollected > 0 && item.amountCollected < item.amountDue
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

export default function CollectorCapturePage() {
  const { role, organization, isLoading: isSessionLoading } = useUserStore();
  const activeRole: MobileRole | null = role ? normalizeMobileRole(role) : null;
  const isCollector = activeRole === "collector";
  const [preferredLoanId, setPreferredLoanId] = useState<string | null>(null);

  const [loading, setLoading] = useState(isCollector);
  const [submitting, setSubmitting] = useState(false);
  const [syncingQueue, setSyncingQueue] = useState(false);
  const [items, setItems] = useState<CaptureItem[]>([]);
  const [collectionDate, setCollectionDate] = useState("");
  const [selectedLoanId, setSelectedLoanId] = useState<string | null>(null);
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
    [items, selectedLoanId]
  );

  const totals = useMemo(() => {
    const expected = items.reduce((sum, item) => sum + item.amountDue, 0);
    const collected = items.reduce((sum, item) => sum + item.amountCollected, 0);
    const pending = items.filter((item) => item.status === "pending" || item.status === "partial").length;
    return { expected, collected, pending };
  }, [items]);

  const loadCaptureContext = useCallback(async (preferredLoanId?: string | null) => {
    if (!isCollector) return;

    setLoading(true);
    try {
      const payload = await fetchJson<CaptureResponse>("/api/collections?date=today");
      setItems(payload.items || []);
      setCollectionDate(payload.collectionDate || "");
      setSelectedLoanId((current) => {
        const nextId = preferredLoanId || current;
        if (nextId && payload.items.some((item) => item.loanId === nextId)) return nextId;
        return payload.items[0]?.loanId || null;
      });
      setBanner((current) => current?.tone === "danger" ? { tone: "info", text: "Live collection context is back online." } : current);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to load collector schedule";
      setItems([]);
      setSelectedLoanId(null);
      setBanner({ tone: "danger", text: message });
    } finally {
      setLoading(false);
    }
  }, [isCollector]);

  const syncPendingQueue = useCallback(async () => {
    if (!isCollector || !online || queueCount === 0) return;

    setSyncingQueue(true);
    try {
      const result = await flushQueue();
      setQueueCount(result.remaining);
      setSyncState(loadQueueSyncState());
      setBanner({
        tone: result.failed > 0 ? "warning" : "success",
        text: result.failed > 0
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
    const params = new URLSearchParams(window.location.search);
    setPreferredLoanId(params.get("loanId"));
  }, []);

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
    if (!isCollector) return;
    void loadCaptureContext(preferredLoanId);
  }, [isCollector, loadCaptureContext, preferredLoanId]);

  useEffect(() => {
    if (!preferredLoanId) return;
    setSelectedLoanId(preferredLoanId);
  }, [preferredLoanId]);

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

    const normalizedAmount = status === "missed" || status === "deferred"
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

  if (!activeRole && isSessionLoading) {
    return (
      <main className="min-h-screen px-4 py-6 pb-28 text-stone-900 sm:px-6">
        <EnsureUser />
        <div className="mobile-shell space-y-4">
          <section className="mobile-panel-strong flex min-h-[16rem] items-center justify-center px-5 py-6 text-sm text-stone-600">
            <div className="inline-flex items-center gap-3">
              <LoaderCircle size={18} className="animate-spin" />
              Preparing mobile workspace...
            </div>
          </section>
        </div>
      </main>
    );
  }

  if (!activeRole) {
    return (
      <main className="min-h-screen px-4 py-6 pb-28 text-stone-900 sm:px-6">
        <EnsureUser />
        <div className="mobile-shell space-y-4">
          <section className="mobile-panel-strong flex min-h-[16rem] items-center justify-center px-5 py-6 text-sm text-stone-600">
            <div className="inline-flex items-center gap-3">
              <LoaderCircle size={18} className="animate-spin" />
              Resolving mobile workspace...
            </div>
          </section>
        </div>
      </main>
    );
  }

  if (!isCollector && activeRole) {
    const fallback = buildRoleFallback(activeRole);
    return (
      <main className="min-h-screen px-4 py-6 pb-28 text-stone-900 sm:px-6">
        <EnsureUser />
        <div className="mobile-shell space-y-4">
          <header className="mobile-panel-strong px-5 py-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm font-semibold text-stone-600">
                  <ArrowLeft size={16} />
                  Back to workspace
                </Link>
                <p className="mt-4 text-[11px] uppercase tracking-[0.18em] text-emerald-700">{getRoleLabel(activeRole)}</p>
                <h1 className="mobile-title mt-1 text-[2.2rem] leading-none text-[#14213d]">{fallback.title}</h1>
                <p className="mt-3 text-sm leading-relaxed text-stone-600">{fallback.summary}</p>
              </div>
              <div className="rounded-full bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-800">
                Mobile next
              </div>
            </div>
          </header>

          <section className="mobile-panel-ink px-5 py-5 text-white">
            <p className="text-[11px] uppercase tracking-[0.18em] text-emerald-100/80">Current focus</p>
            <h2 className="mt-2 text-xl font-semibold">Collector capture is the first deep mobile workflow</h2>
            <p className="mt-3 text-sm text-white/72">
              We’re keeping the operational center focused so the collector experience lands cleanly first. Your role-specific action surfaces come right after that.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link href={fallback.primaryHref} className="inline-flex items-center gap-2 rounded-full bg-[#fff7eb] px-4 py-3 text-sm font-semibold text-[#14213d]">
                {fallback.primaryLabel}
                <ArrowRight size={16} />
              </Link>
              <Link href={fallback.secondaryHref} className="inline-flex items-center gap-2 rounded-full border border-white/16 px-4 py-3 text-sm font-semibold text-white/86">
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
        <header className="mobile-panel-strong px-5 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Link href="/dashboard/work" className="inline-flex items-center gap-2 text-sm font-semibold text-stone-600">
                <ArrowLeft size={16} />
                Back to route workstream
              </Link>
              <p className="mt-4 text-[11px] uppercase tracking-[0.18em] text-emerald-700">{organization?.name || "Collector workspace"}</p>
              <h1 className="mobile-title mt-1 text-[2.2rem] leading-none text-[#14213d]">Live route capture</h1>
              <p className="mt-3 text-sm leading-relaxed text-stone-600">
                Capture today’s field stops with the same Daily+ business logic, even if the device drops offline for a while.
              </p>
            </div>
            <div className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold ${online ? "bg-emerald-500/10 text-emerald-800" : "bg-amber-500/12 text-amber-900"}`}>
              {online ? <Wifi size={14} /> : <WifiOff size={14} />}
              {online ? "Live" : "Offline"}
            </div>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-3">
            <div className="rounded-[24px] border border-stone-900/8 bg-white/72 px-4 py-4">
              <p className="text-[10px] uppercase tracking-[0.18em] text-stone-500">Expected today</p>
              <p className="mt-2 text-lg font-semibold text-[#14213d]">{formatCurrency(totals.expected)}</p>
            </div>
            <div className="rounded-[24px] border border-stone-900/8 bg-white/72 px-4 py-4">
              <p className="text-[10px] uppercase tracking-[0.18em] text-stone-500">Captured</p>
              <p className="mt-2 text-lg font-semibold text-[#14213d]">{formatCurrency(totals.collected)}</p>
            </div>
            <div className="rounded-[24px] border border-stone-900/8 bg-white/72 px-4 py-4">
              <p className="text-[10px] uppercase tracking-[0.18em] text-stone-500">Stops open</p>
              <p className="mt-2 text-lg font-semibold text-[#14213d]">{totals.pending}</p>
            </div>
          </div>
        </header>

        {banner ? (
          <section className={`mobile-panel px-4 py-4 ${banner.tone === "success" ? "border-emerald-700/12 bg-emerald-500/8" : banner.tone === "warning" ? "border-amber-700/12 bg-amber-500/10" : banner.tone === "danger" ? "border-rose-700/14 bg-rose-500/10" : "border-stone-900/8 bg-white/72"}`}>
            <div className="flex items-start gap-3">
              {banner.tone === "danger" || banner.tone === "warning" ? <TriangleAlert className="mt-0.5 shrink-0" size={18} /> : <CheckCheck className="mt-0.5 shrink-0" size={18} />}
              <p className="text-sm leading-relaxed text-stone-800">{banner.text}</p>
            </div>
          </section>
        ) : null}

        <section className="mobile-panel px-5 py-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-stone-500">Collector queue</p>
              <h2 className="mt-1 text-lg font-semibold text-[#14213d]">{queueCount > 0 ? `${queueCount} capture${queueCount === 1 ? "" : "s"} waiting to sync` : "All captures synced"}</h2>
              <p className="mt-1 text-sm text-stone-600">
                {queueCount > 0 ? "Queued captures will replay against the live Daily+ API." : "You’re operating against live schedule data right now."}
              </p>
              <p className="mt-1 text-xs text-stone-500">
                Last sync: {formatSyncDate(syncState.lastSyncedAt)}
                {syncState.lastError ? ` · Last issue: ${syncState.lastError}` : ""}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void syncPendingQueue()}
              disabled={!online || queueCount === 0 || syncingQueue}
              className="inline-flex items-center gap-2 rounded-full border border-stone-900/10 bg-white px-4 py-3 text-sm font-semibold text-[#14213d] disabled:cursor-not-allowed disabled:opacity-45"
            >
              {syncingQueue ? <LoaderCircle size={16} className="animate-spin" /> : <RefreshCw size={16} />}
              Sync now
            </button>
          </div>
        </section>

        <section className="mobile-panel-strong px-5 py-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-emerald-700">Today’s route run</p>
              <h2 className="mt-1 text-xl font-semibold text-[#14213d]">{collectionDate ? formatDateLabel(collectionDate) : "Today"}</h2>
              <p className="mt-1 text-sm text-stone-600">Choose a stop, confirm the visit outcome, and save it straight to the live account ledger.</p>
            </div>
            <button
              type="button"
              onClick={() => void loadCaptureContext(selectedLoanId)}
              disabled={loading}
              className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-stone-900/10 bg-white/72 text-stone-700 disabled:opacity-45"
              aria-label="Refresh route stops"
            >
              {loading ? <LoaderCircle size={18} className="animate-spin" /> : <RefreshCw size={18} />}
            </button>
          </div>

          <div className="mt-5 space-y-3">
            {loading ? (
              Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="rounded-[24px] border border-stone-900/8 bg-white/72 px-4 py-4">
                  <div className="h-4 w-28 animate-pulse rounded-full bg-stone-200" />
                  <div className="mt-3 h-8 w-44 animate-pulse rounded-full bg-stone-200" />
                  <div className="mt-4 h-3 w-full animate-pulse rounded-full bg-stone-100" />
                </div>
              ))
            ) : items.length === 0 ? (
              <div className="rounded-[28px] border border-dashed border-stone-900/12 bg-white/72 px-5 py-6 text-center">
                <p className="text-base font-semibold text-[#14213d]">No stops are queued for today yet.</p>
                <p className="mt-2 text-sm leading-relaxed text-stone-600">
                  This now falls back to active assigned loans, so if this is still empty it likely means no live loans are currently assigned to this collector.
                </p>
              </div>
            ) : (
              items.map((item) => {
                const active = selectedItem?.loanId === item.loanId;
                const statusTone = item.status === "collected"
                  ? "bg-emerald-500/12 text-emerald-900"
                  : item.status === "partial"
                    ? "bg-amber-500/14 text-amber-900"
                    : item.status === "missed" || item.status === "deferred"
                      ? "bg-rose-500/10 text-rose-900"
                      : "bg-stone-900/6 text-stone-700";

                return (
                  <button
                    key={`${item.loanId}-${item.collectionDate}`}
                    type="button"
                    onClick={() => setSelectedLoanId(item.loanId)}
                    className={`w-full rounded-[28px] border px-4 py-4 text-left transition-all ${active ? "border-[#14213d] bg-[#14213d] text-white shadow-[0_24px_50px_rgba(20,33,61,0.22)]" : "border-stone-900/8 bg-white/78 text-stone-900"}`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className={`text-[11px] uppercase tracking-[0.18em] ${active ? "text-white/72" : "text-stone-500"}`}>{item.loanNumber}</p>
                        <h3 className="mt-1 text-lg font-semibold">{item.debtorName}</h3>
                      </div>
                      <span className={`inline-flex rounded-full px-3 py-1 text-[11px] font-semibold capitalize ${active ? "bg-white/12 text-white" : statusTone}`}>
                        {item.status}
                      </span>
                    </div>

                    <div className={`mt-4 grid grid-cols-2 gap-3 text-sm ${active ? "text-white/82" : "text-stone-600"}`}>
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.16em] opacity-70">Due now</p>
                        <p className="mt-1 font-semibold">{formatCurrency(item.amountDue)}</p>
                      </div>
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.16em] opacity-70">Loan remaining</p>
                        <p className="mt-1 font-semibold">{formatCurrency(item.amountRemaining)}</p>
                      </div>
                    </div>

                    <div className={`mt-4 flex flex-wrap gap-3 text-xs ${active ? "text-white/70" : "text-stone-500"}`}>
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
          <section className="mobile-panel-ink px-5 py-5 text-white">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-emerald-100/80">Selected stop</p>
                <h2 className="mt-1 text-2xl font-semibold">{selectedItem.debtorName}</h2>
                <p className="mt-2 text-sm text-white/72">
                  {selectedItem.loanNumber} · scheduled due {formatCurrency(selectedItem.amountDue)}
                </p>
              </div>
              <div className="rounded-[22px] bg-white/10 px-4 py-3 text-right">
                <p className="text-[10px] uppercase tracking-[0.18em] text-white/58">Remaining</p>
                <p className="mt-1 text-lg font-semibold">{formatCurrency(selectedItem.amountRemaining)}</p>
              </div>
            </div>

            <div className="mt-5 space-y-5">
              <div>
                <p className="text-sm font-semibold text-white">Visit outcome</p>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  {statusOptions.map((option) => {
                    const active = status === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => handleStatusChange(option.value)}
                        className={`rounded-[24px] border px-4 py-4 text-left transition-all ${active ? "border-white bg-white text-[#14213d]" : "border-white/14 bg-white/6 text-white/86"}`}
                      >
                        <p className="text-sm font-semibold">{option.label}</p>
                        <p className={`mt-2 text-xs leading-relaxed ${active ? "text-[#14213d]/72" : "text-white/60"}`}>{option.helper}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm font-semibold text-white">Captured amount</span>
                  <input
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                    inputMode="decimal"
                    className="w-full rounded-[22px] border border-white/12 bg-white/10 px-4 py-3 text-base text-white outline-none placeholder:text-white/38"
                    placeholder="Enter amount"
                    disabled={status === "missed" || status === "deferred"}
                  />
                  <span className="text-xs text-white/58">Daily due {formatCurrency(selectedItem.amountDue)} · installment {formatCurrency(selectedItem.dailyInstallment)}</span>
                </label>

                <div className="space-y-2">
                  <span className="text-sm font-semibold text-white">Payment method</span>
                  <div className="grid grid-cols-3 gap-2">
                    {methodOptions.map((option) => {
                      const active = method === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setMethod(option.value)}
                          className={`rounded-[20px] border px-3 py-3 text-sm font-semibold transition-all ${active ? "border-white bg-white text-[#14213d]" : "border-white/14 bg-white/6 text-white/82"}`}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <label className="block space-y-2">
                <span className="inline-flex items-center gap-2 text-sm font-semibold text-white">
                  <NotebookPen size={16} />
                  Field notes
                </span>
                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  rows={4}
                  className="w-full rounded-[24px] border border-white/12 bg-white/10 px-4 py-3 text-sm text-white outline-none placeholder:text-white/38"
                  placeholder="Anything the creditor or reviewer should know about this stop?"
                />
              </label>

              <div className="flex flex-wrap items-center justify-between gap-3 rounded-[26px] border border-white/10 bg-white/6 px-4 py-4 text-sm text-white/72">
                <div className="space-y-1">
                  <p className="inline-flex items-center gap-2 font-semibold text-white"><CalendarClock size={16} />Next sync target</p>
                  <p>{online ? "This save will write to the live database immediately." : "This save will queue locally and replay when the device reconnects."}</p>
                </div>
                <button
                  type="button"
                  onClick={() => void handleSubmit()}
                  disabled={submitting}
                  className="inline-flex min-w-[11rem] items-center justify-center gap-2 rounded-full bg-[#fff7eb] px-5 py-3 text-sm font-semibold text-[#14213d] disabled:cursor-not-allowed disabled:opacity-45"
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
              <p className="text-[11px] uppercase tracking-[0.18em] text-stone-500">What this flow already does</p>
              <h2 className="mt-1 text-lg font-semibold text-[#14213d]">Shared backend logic, now in mobile form</h2>
            </div>
            <Building2 size={18} className="mt-1 text-stone-400" />
          </div>
          <div className="mt-4 grid gap-3 text-sm text-stone-600">
            <div className="rounded-[22px] border border-stone-900/8 bg-white/72 px-4 py-4">
              It reads the collector’s live organization context and assigned route stops from the same Daily+ backend.
            </div>
            <div className="rounded-[22px] border border-stone-900/8 bg-white/72 px-4 py-4">
              When the schedule row already exists, this updates that exact collection instead of duplicating it.
            </div>
            <div className="rounded-[22px] border border-stone-900/8 bg-white/72 px-4 py-4">
              Each successful save also synchronizes the related loan balance and loan state behind the scenes.
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
