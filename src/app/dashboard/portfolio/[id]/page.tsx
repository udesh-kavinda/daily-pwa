"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, ArrowRight, CalendarClock, CreditCard, Phone, WalletCards } from "lucide-react";
import { fetchJson } from "@/lib/fetch-json";
import { formatBorrowerStatus } from "@/lib/borrower-copy";

type LoanDetailResponse = {
  loan: {
    id: string;
    loanNumber: string;
    status: string;
    principalAmount: number;
    totalAmount: number;
    amountCollected: number;
    amountRemaining: number;
    dailyInstallment: number;
    tenureDays: number;
    startDate: string | null;
    endDate: string | null;
    creditorName: string;
    collectorName: string;
    collectorPhone: string | null;
    rejectionNote: string | null;
    notes: string | null;
    progressPercent: number;
    estimated30DayCommitment: number;
    nextCollection?: { date: string; amountDue: number; status: string } | null;
  } | null;
  organization?: { name?: string | null; ownerName?: string | null; ownerEmail?: string | null } | null;
  collections: Array<{
    id: string;
    status: string;
    amountDue: number;
    amountCollected: number;
    paymentMethod: string | null;
    collectionDate: string;
    collectedAt: string | null;
  }>;
  historySummary: {
    totalEntries: number;
    successfulEntries: number;
    missedEntries: number;
    deferredEntries: number;
    totalCaptured: number;
    averageCaptured: number;
    lastPaymentDate: string | null;
  };
};

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-LK", {
    style: "currency",
    currency: "LKR",
    maximumFractionDigits: 0,
  }).format(amount || 0);
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Not scheduled";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("en-LK", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(parsed);
}

export default function DebtorLoanDetailPage() {
  const params = useParams<{ id: string }>();
  const loanId = params?.id;
  const [loading, setLoading] = useState(true);
  const [payload, setPayload] = useState<LoanDetailResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function load() {
      if (!loanId) return;
      setLoading(true);
      try {
        const nextPayload = await fetchJson<LoanDetailResponse>(`/api/mobile/portfolio/${loanId}`);
        if (!mounted) return;
        setPayload(nextPayload);
        setError(null);
      } catch (fetchError: unknown) {
        if (!mounted) return;
        const message = fetchError instanceof Error ? fetchError.message : "Failed to load loan details";
        setPayload(null);
        setError(message);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void load();
    return () => {
      mounted = false;
    };
  }, [loanId]);

  const loan = payload?.loan;
  const recentCollections = useMemo(() => (payload?.collections || []).slice(0, 4), [payload?.collections]);

  if (loading) {
    return (
      <div className="space-y-4 pb-4">
        <section className="mobile-panel-strong px-5 py-5">
          <div className="h-4 w-28 animate-pulse rounded-full bg-stone-200" />
          <div className="mt-3 h-9 w-2/3 animate-pulse rounded-full bg-stone-200" />
          <div className="mt-4 h-3 w-full animate-pulse rounded-full bg-stone-100" />
        </section>
      </div>
    );
  }

  if (!loan || error) {
    return (
      <div className="space-y-4 pb-4">
        <section className="mobile-panel px-5 py-6 text-center">
          <p className="text-base font-semibold text-[#14213d]">Loan details are unavailable.</p>
          <p className="mt-2 text-sm leading-relaxed text-stone-600">{error || "This loan could not be found in the portal."}</p>
          <Link href="/dashboard/portfolio" className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#14213d] px-4 py-3 text-sm font-semibold text-white">
            <ArrowLeft size={16} />
            Back to loans
          </Link>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-4">
      <section className="mobile-panel-ink px-5 py-5 text-white">
        <Link href="/dashboard/portfolio" className="inline-flex items-center gap-2 text-sm font-semibold text-white/72">
          <ArrowLeft size={16} />
          Back to loans
        </Link>

        <div className="mt-4 flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-emerald-100/80">{payload?.organization?.name || loan.creditorName}</p>
            <h2 className="mt-1 text-[2rem] font-semibold">{loan.loanNumber}</h2>
            <p className="mt-2 text-sm text-white/72">Handled by {loan.collectorName} · {formatBorrowerStatus(loan.status)}</p>
          </div>
          <div className="rounded-[24px] bg-white/10 px-4 py-3 text-right">
            <p className="text-[10px] uppercase tracking-[0.18em] text-white/58">Progress</p>
            <p className="mt-1 text-lg font-semibold">{loan.progressPercent}%</p>
          </div>
        </div>

        <div className="mt-5 space-y-3">
          <div className="h-2 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-[#fff7eb]" style={{ width: `${Math.min(Math.max(loan.progressPercent, 0), 100)}%` }} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-[20px] bg-white/10 px-4 py-4">
              <p className="text-[10px] uppercase tracking-[0.18em] text-white/58">Remaining</p>
              <p className="mt-2 text-base font-semibold">{formatCurrency(loan.amountRemaining)}</p>
            </div>
            <div className="rounded-[20px] bg-white/10 px-4 py-4">
              <p className="text-[10px] uppercase tracking-[0.18em] text-white/58">Paid so far</p>
              <p className="mt-2 text-base font-semibold">{formatCurrency(loan.amountCollected)}</p>
            </div>
            <div className="rounded-[20px] bg-white/10 px-4 py-4">
              <p className="text-[10px] uppercase tracking-[0.18em] text-white/58">Estimated next 30 days</p>
              <p className="mt-2 text-base font-semibold">{formatCurrency(loan.estimated30DayCommitment)}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3">
        <MetricCard label="Expected daily amount" value={formatCurrency(loan.dailyInstallment)} icon={<WalletCards size={18} className="text-emerald-700" />} />
        <MetricCard label="Total repayable" value={formatCurrency(loan.totalAmount)} icon={<CreditCard size={18} className="text-emerald-700" />} />
        <MetricCard label="Start date" value={formatDate(loan.startDate)} icon={<CalendarClock size={18} className="text-emerald-700" />} />
        <MetricCard label="End date" value={formatDate(loan.endDate)} icon={<CalendarClock size={18} className="text-emerald-700" />} />
      </section>

      <section className="mobile-panel-strong px-5 py-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-stone-500">Next expected visit</p>
            <h3 className="mt-1 text-lg font-semibold text-[#14213d]">
              {loan.nextCollection ? `${formatDate(loan.nextCollection.date)} · ${formatCurrency(loan.nextCollection.amountDue)}` : "Next visit not scheduled yet"}
            </h3>
            <p className="mt-2 text-sm text-stone-600">
              {loan.nextCollection
                ? `Your collector is expected to collect ${formatCurrency(loan.nextCollection.amountDue)} on this visit.`
                : "Your collector will add the next visit once the schedule is prepared."}
            </p>
          </div>
          <Link href={`/dashboard/portfolio/${loan.id}/history`} className="inline-flex h-11 items-center justify-center rounded-2xl border border-stone-900/10 bg-white/70 px-4 text-sm font-semibold text-[#14213d]">
            History
          </Link>
        </div>
      </section>

      <section className="mobile-panel px-5 py-5">
        <p className="text-[11px] uppercase tracking-[0.18em] text-stone-500">Who manages this loan</p>
        <div className="mt-4 grid gap-3">
          <DetailRow label="Lender" value={loan.creditorName} />
          <DetailRow label="Assigned collector" value={loan.collectorName} />
          <DetailRow label="Collector phone" value={loan.collectorPhone || "Not available"} icon={<Phone size={14} className="text-stone-400" />} />
          <DetailRow label="Planned term" value={`${loan.tenureDays} days`} />
        </div>
      </section>

      <section className="mobile-panel px-5 py-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-stone-500">Recent repayments</p>
            <h3 className="mt-1 text-lg font-semibold text-[#14213d]">Latest recorded activity</h3>
          </div>
          <Link href={`/dashboard/portfolio/${loan.id}/history`} className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-700">
            Full history
            <ArrowRight size={15} />
          </Link>
        </div>

        <div className="mt-4 space-y-3">
          {recentCollections.length === 0 ? (
            <div className="rounded-[22px] border border-dashed border-stone-900/12 bg-white/70 px-4 py-5 text-sm text-stone-600">
              No repayments have been recorded for this loan yet.
            </div>
          ) : (
            recentCollections.map((entry) => (
              <div key={entry.id} className="rounded-[22px] border border-stone-900/8 bg-white/70 px-4 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-[#14213d]">{formatCurrency(entry.amountCollected || entry.amountDue)}</p>
                    <p className="mt-1 text-xs text-stone-500">{formatDate(entry.collectionDate)} · {entry.paymentMethod || "cash"}</p>
                  </div>
                  <span className="rounded-full bg-stone-900/6 px-3 py-1 text-[11px] font-semibold capitalize text-stone-700">
                    {formatBorrowerStatus(entry.status)}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {loan.notes || loan.rejectionNote ? (
        <section className="grid gap-3">
          {loan.notes ? (
            <div className="mobile-panel px-5 py-5">
              <p className="text-[11px] uppercase tracking-[0.18em] text-stone-500">Note from lender</p>
              <p className="mt-3 text-sm leading-relaxed text-stone-700">{loan.notes}</p>
            </div>
          ) : null}
          {loan.rejectionNote ? (
            <div className="mobile-panel px-5 py-5 border-rose-700/14 bg-rose-500/10">
              <p className="text-[11px] uppercase tracking-[0.18em] text-rose-900">Review note from lender</p>
              <p className="mt-3 text-sm leading-relaxed text-rose-950/80">{loan.rejectionNote}</p>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

function MetricCard({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <section className="mobile-panel px-4 py-4">
      <div className="flex items-center gap-2">
        {icon}
        <p className="text-[11px] uppercase tracking-[0.16em] text-stone-500">{label}</p>
      </div>
      <p className="mt-3 text-base font-semibold text-[#14213d]">{value}</p>
    </section>
  );
}

function DetailRow({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-[22px] bg-white/72 px-4 py-4">
      <div className="inline-flex items-center gap-2 text-sm text-stone-500">
        {icon}
        <span>{label}</span>
      </div>
      <span className="text-sm font-semibold text-[#14213d] text-right">{value}</span>
    </div>
  );
}
