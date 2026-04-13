"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, LoaderCircle, WalletCards } from "lucide-react";
import { fetchJson } from "@/lib/fetch-json";
import { formatBorrowerStatus } from "@/lib/borrower-copy";

type HistoryPayload = {
  loan?: {
    id: string;
    loanNumber: string;
    creditorName: string;
    dailyInstallment: number;
    amountRemaining: number;
  } | null;
  organization?: { name?: string | null } | null;
  historySummary: {
    totalEntries: number;
    successfulEntries: number;
    missedEntries: number;
    deferredEntries: number;
    totalCaptured: number;
    averageCaptured: number;
    lastPaymentDate: string | null;
  };
  collections: Array<{
    id: string;
    status: string;
    amountDue: number;
    amountCollected: number;
    paymentMethod: string | null;
    collectionDate: string;
    collectedAt: string | null;
  }>;
};

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-LK", {
    style: "currency",
    currency: "LKR",
    maximumFractionDigits: 0,
  }).format(amount || 0);
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Not available";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("en-LK", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(parsed);
}

export default function DebtorLoanHistoryPage() {
  const params = useParams<{ id: string }>();
  const loanId = params?.id;
  const [loading, setLoading] = useState(true);
  const [payload, setPayload] = useState<HistoryPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function load() {
      if (!loanId) return;
      setLoading(true);
      try {
        const nextPayload = await fetchJson<HistoryPayload>(`/api/mobile/portfolio/${loanId}/history`);
        if (!mounted) return;
        setPayload(nextPayload);
        setError(null);
      } catch (fetchError: unknown) {
        if (!mounted) return;
        const message = fetchError instanceof Error ? fetchError.message : "Failed to load repayment history";
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

  if (loading) {
    return (
      <div className="space-y-4 pb-4">
        <section className="mobile-panel px-5 py-6 text-center">
          <LoaderCircle size={22} className="mx-auto animate-spin text-emerald-700" />
          <p className="mt-3 text-sm text-stone-600">Loading repayment history...</p>
        </section>
      </div>
    );
  }

  if (!payload?.loan || error) {
    return (
      <div className="space-y-4 pb-4">
        <section className="mobile-panel px-5 py-6 text-center">
          <p className="text-base font-semibold text-[#14213d]">Repayment history is unavailable.</p>
          <p className="mt-2 text-sm leading-relaxed text-stone-600">{error || "This loan could not be loaded."}</p>
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
      <section className="mobile-panel-strong px-5 py-5">
        <Link href={`/dashboard/portfolio/${payload.loan.id}`} className="inline-flex items-center gap-2 text-sm font-semibold text-stone-600">
          <ArrowLeft size={16} />
          Back to loan detail
        </Link>
        <p className="mt-4 text-[11px] uppercase tracking-[0.18em] text-emerald-700">{payload.organization?.name || payload.loan.creditorName}</p>
        <h2 className="mt-1 text-xl font-semibold text-[#14213d]">{payload.loan.loanNumber}</h2>
        <p className="mt-2 text-sm text-stone-600">A simple timeline of each visit, recorded amount, and outcome on this loan.</p>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <SummaryCard label="Total received" value={formatCurrency(payload.historySummary.totalCaptured)} />
          <SummaryCard label="Usual paid amount" value={formatCurrency(payload.historySummary.averageCaptured)} />
          <SummaryCard label="Payments recorded" value={String(payload.historySummary.successfulEntries)} />
          <SummaryCard label="Missed or rescheduled" value={String(payload.historySummary.missedEntries + payload.historySummary.deferredEntries)} />
        </div>
      </section>

      <section className="mobile-panel px-5 py-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-stone-500">At a glance</p>
            <h3 className="mt-1 text-lg font-semibold text-[#14213d]">Repayment summary</h3>
          </div>
          <WalletCards size={18} className="text-stone-400" />
        </div>
        <div className="mt-4 grid gap-3">
          <HistoryRow label="Last payment received" value={formatDate(payload.historySummary.lastPaymentDate)} />
          <HistoryRow label="Activity recorded" value={String(payload.historySummary.totalEntries)} />
          <HistoryRow label="Expected daily amount" value={formatCurrency(payload.loan.dailyInstallment)} />
          <HistoryRow label="Still left to repay" value={formatCurrency(payload.loan.amountRemaining)} />
        </div>
      </section>

      <section className="space-y-3">
        {payload.collections.length === 0 ? (
          <section className="mobile-panel px-5 py-6 text-center">
            <p className="text-base font-semibold text-[#14213d]">No repayment records yet.</p>
            <p className="mt-2 text-sm leading-relaxed text-stone-600">
              When a payment, missed visit, or rescheduled visit is recorded, it will appear here with the date and outcome.
            </p>
          </section>
        ) : (
          payload.collections.map((entry) => (
            <section key={entry.id} className="mobile-panel px-5 py-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-stone-500">{formatDate(entry.collectionDate)}</p>
                  <h3 className="mt-1 text-lg font-semibold text-[#14213d]">{formatCurrency(entry.amountCollected || entry.amountDue)}</h3>
                  <p className="mt-2 text-sm text-stone-600">
                    Expected {formatCurrency(entry.amountDue)} · {entry.paymentMethod || "cash"}
                  </p>
                </div>
                <span className="rounded-full bg-stone-900/6 px-3 py-1 text-[11px] font-semibold capitalize text-stone-700">
                  {formatBorrowerStatus(entry.status)}
                </span>
              </div>
            </section>
          ))
        )}
      </section>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[22px] border border-stone-900/8 bg-white/75 px-4 py-4">
      <p className="text-[10px] uppercase tracking-[0.16em] text-stone-500">{label}</p>
      <p className="mt-2 text-base font-semibold text-[#14213d]">{value}</p>
    </div>
  );
}

function HistoryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-[22px] bg-white/72 px-4 py-4">
      <span className="text-sm text-stone-500">{label}</span>
      <span className="text-sm font-semibold text-[#14213d] text-right">{value}</span>
    </div>
  );
}
