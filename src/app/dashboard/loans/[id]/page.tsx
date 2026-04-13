"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, ArrowRight, CalendarClock, CreditCard, Phone, WalletCards } from "lucide-react";
import type { ReactNode } from "react";
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
  collections: Array<{
    id: string;
    status: string;
    amountDue: number;
    amountCollected: number;
    paymentMethod: string | null;
    collectionDate: string;
    collectedAt: string | null;
  }>;
  historySummary?: {
    totalEntries: number;
    successfulEntries: number;
    missedEntries: number;
    deferredEntries: number;
    totalCaptured: number;
    averageCaptured: number;
    lastPaymentDate: string | null;
  };
  context?: {
    debtorName?: string | null;
    debtorPhone?: string | null;
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
  return new Intl.DateTimeFormat("en-LK", { month: "short", day: "numeric", year: "numeric" }).format(parsed);
}

export default function LoanDetailPage() {
  const params = useParams<{ id: string }>();
  const loanId = params?.id;
  const [payload, setPayload] = useState<LoanDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function load() {
      if (!loanId) return;
      setLoading(true);
      try {
        const nextPayload = await fetchJson<LoanDetailResponse>(`/api/mobile/loans/${loanId}`);
        if (!mounted) return;
        setPayload(nextPayload);
        setError(null);
      } catch (fetchError: unknown) {
        if (!mounted) return;
        const message = fetchError instanceof Error ? fetchError.message : "Failed to load loan detail";
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
  const recentCollections = useMemo(() => (payload?.collections || []).slice(0, 5), [payload?.collections]);

  if (loading) {
    return (
      <div className="space-y-3 pb-4">
        <section className="mobile-panel px-5 py-6 text-center">
          <p className="mobile-text-secondary text-sm">Loading loan detail...</p>
        </section>
      </div>
    );
  }

  if (!loan || error) {
    return (
      <div className="space-y-3 pb-4">
        <section className="mobile-panel px-5 py-6 text-center">
          <p className="mobile-text-primary text-base font-semibold">Loan detail is unavailable.</p>
          <p className="mobile-text-secondary mt-2 text-sm leading-relaxed">{error || "This loan could not be loaded."}</p>
          <Link href="/dashboard/loans" className="mobile-solid-surface mt-4 inline-flex items-center gap-2 rounded-[14px] px-4 py-3 text-sm font-semibold">
            <ArrowLeft size={16} />
            Back to loans
          </Link>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-3 pb-4">
      <section className="mobile-panel px-4 py-4">
        <Link href="/dashboard/loans" className="mobile-text-secondary inline-flex items-center gap-2 text-sm font-semibold">
          <ArrowLeft size={16} />
          Back to loans
        </Link>
        <div className="mt-4">
          <p className="mobile-section-label">{loan.creditorName}</p>
          <h2 className="mobile-text-primary mt-1 text-[1.2rem] font-semibold">{loan.loanNumber}</h2>
          <p className="mobile-text-secondary mt-1 text-sm">
            {payload?.context?.debtorName || "Debtor"} · {loan.collectorName} · {formatBorrowerStatus(loan.status)}
          </p>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-2.5">
        <MetricCard label="Outstanding" value={formatCurrency(loan.amountRemaining)} icon={<WalletCards size={18} className="text-emerald-700 dark:text-emerald-300" />} />
        <MetricCard label="Paid so far" value={formatCurrency(loan.amountCollected)} icon={<CreditCard size={18} className="text-emerald-700 dark:text-emerald-300" />} />
        <MetricCard label="Daily pay" value={formatCurrency(loan.dailyInstallment)} icon={<WalletCards size={18} className="text-emerald-700 dark:text-emerald-300" />} />
        <MetricCard label="Ends" value={formatDate(loan.endDate)} icon={<CalendarClock size={18} className="text-emerald-700 dark:text-emerald-300" />} />
      </section>

      <section className="mobile-panel px-4 py-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="mobile-section-label">Next collection</p>
            <h3 className="mobile-text-primary mt-1 text-[1rem] font-semibold">
              {loan.nextCollection ? `${formatDate(loan.nextCollection.date)} · ${formatCurrency(loan.nextCollection.amountDue)}` : "No visit scheduled"}
            </h3>
            <p className="mobile-text-secondary mt-1 text-sm">
              {loan.nextCollection
                ? `${loan.collectorName} is expected to collect ${formatCurrency(loan.nextCollection.amountDue)} on the next visit.`
                : "The next collection will appear here once the schedule is prepared."}
            </p>
          </div>
          <div className="rounded-full bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-500/14 dark:text-emerald-300">
            {loan.progressPercent}% paid
          </div>
        </div>
      </section>

      <section className="mobile-panel px-4 py-4">
        <p className="mobile-section-label">Contacts</p>
        <div className="mobile-compact-list mt-3">
          <div className="mobile-row">
            <span className="mobile-text-secondary text-sm">Debtor</span>
            <span className="mobile-text-primary text-sm font-semibold">{payload?.context?.debtorName || "Debtor"}</span>
          </div>
          <div className="mobile-row">
            <span className="mobile-text-secondary text-sm">Collector</span>
            <span className="mobile-text-primary text-sm font-semibold">{loan.collectorName}</span>
          </div>
          <div className="mobile-row">
            <span className="mobile-text-secondary text-sm inline-flex items-center gap-2"><Phone size={14} />Collector phone</span>
            <span className="mobile-text-primary text-sm font-semibold">{loan.collectorPhone || "Not available"}</span>
          </div>
        </div>
      </section>

      <section className="mobile-panel px-4 py-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="mobile-section-label">Recent activity</p>
            <h3 className="mobile-text-primary mt-1 text-[1rem] font-semibold">Collection history</h3>
          </div>
          <Link href={`/dashboard/portfolio/${loan.id}/history`} className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
            Full history
            <ArrowRight size={15} />
          </Link>
        </div>
        <div className="mobile-compact-list mt-3">
          {recentCollections.length === 0 ? (
            <div className="mobile-row block">
              <p className="mobile-text-secondary text-sm">No collection activity has been recorded for this loan yet.</p>
            </div>
          ) : (
            recentCollections.map((entry) => (
              <div key={entry.id} className="mobile-row block">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="mobile-text-primary text-sm font-semibold">{formatCurrency(entry.amountCollected || entry.amountDue)}</p>
                    <p className="mobile-text-secondary mt-1 text-xs">{formatDate(entry.collectionDate)} · {entry.paymentMethod || "cash"}</p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold capitalize text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                    {formatBorrowerStatus(entry.status)}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {loan.notes ? (
        <section className="mobile-panel px-4 py-4">
          <p className="mobile-section-label">Loan note</p>
          <p className="mobile-text-secondary mt-3 text-sm leading-relaxed">{loan.notes}</p>
        </section>
      ) : null}
    </div>
  );
}

function MetricCard({ label, value, icon }: { label: string; value: string; icon: ReactNode }) {
  return (
    <section className="mobile-panel-strong px-4 py-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="mobile-text-tertiary text-[10px] uppercase tracking-[0.16em]">{label}</p>
          <p className="mobile-text-primary mt-2 text-sm font-semibold">{value}</p>
        </div>
        <div className="flex h-9 w-9 items-center justify-center rounded-[12px] bg-emerald-500/10 dark:bg-emerald-500/14">{icon}</div>
      </div>
    </section>
  );
}
