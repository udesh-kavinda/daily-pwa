import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { ArrowLeft, WalletCards } from "lucide-react";
import { formatBorrowerStatus } from "@/lib/borrower-copy";
import { loadMobileLoanDetailByClerkId, MobileLoanDetailError } from "@/lib/mobile-loan-detail";

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

export default async function LoanHistoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { userId } = await auth();
  if (!userId) {
    redirect("/sign-in");
  }

  const { id } = await params;

  let payload: Awaited<ReturnType<typeof loadMobileLoanDetailByClerkId>> | null = null;
  let message: string | null = null;

  try {
    payload = await loadMobileLoanDetailByClerkId(userId, id);
  } catch (error: unknown) {
    message =
      error instanceof MobileLoanDetailError || error instanceof Error
        ? error.message
        : "This loan could not be loaded.";
  }

  if (!payload?.loan) {
    return (
      <div className="space-y-4 pb-4">
        <section className="mobile-panel px-5 py-6 text-center">
          <p className="mobile-text-primary text-base font-semibold">Loan history is unavailable.</p>
          <p className="mobile-text-secondary mt-2 text-sm leading-relaxed">{message}</p>
          <Link href="/dashboard/loans" className="mobile-inline-action mt-4">
            <ArrowLeft size={16} />
            Back to loans
          </Link>
        </section>
      </div>
    );
  }

  const { loan, historySummary, collections, organization } = payload;

  return (
    <div className="space-y-3 pb-4">
      <section className="mobile-panel px-4 py-4">
        <Link href={`/dashboard/loans/${loan.id}`} className="mobile-text-secondary inline-flex items-center gap-2 text-sm font-semibold">
          <ArrowLeft size={16} />
          Back to loan detail
        </Link>
        <p className="mobile-section-label mt-4">{organization?.name || loan.creditorName}</p>
        <h2 className="mobile-text-primary mt-1 text-xl font-semibold">{loan.loanNumber}</h2>
        <p className="mobile-text-secondary mt-2 text-sm">A clear timeline of each collection, missed visit, and repayment update on this loan.</p>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <SummaryCard label="Total received" value={formatCurrency(historySummary.totalCaptured)} />
          <SummaryCard label="Usual paid amount" value={formatCurrency(historySummary.averageCaptured)} />
          <SummaryCard label="Payments recorded" value={String(historySummary.successfulEntries)} />
          <SummaryCard label="Missed or rescheduled" value={String(historySummary.missedEntries + historySummary.deferredEntries)} />
        </div>
      </section>

      <section className="mobile-panel px-4 py-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="mobile-section-label">At a glance</p>
            <h3 className="mobile-text-primary mt-1 text-lg font-semibold">Repayment summary</h3>
          </div>
          <WalletCards size={18} className="text-stone-400 dark:text-white/40" />
        </div>
        <div className="mobile-compact-list mt-4">
          <HistoryRow label="Last payment received" value={formatDate(historySummary.lastPaymentDate)} />
          <HistoryRow label="Activity recorded" value={String(historySummary.totalEntries)} />
          <HistoryRow label="Expected daily amount" value={formatCurrency(loan.dailyInstallment)} />
          <HistoryRow label="Still left to repay" value={formatCurrency(loan.amountRemaining)} />
        </div>
      </section>

      <section className="space-y-3">
        {collections.length === 0 ? (
          <section className="mobile-panel px-5 py-6 text-center">
            <p className="mobile-text-primary text-base font-semibold">No repayment records yet.</p>
            <p className="mobile-text-secondary mt-2 text-sm leading-relaxed">
              When a payment, missed visit, or rescheduled visit is recorded, it will appear here with the date and outcome.
            </p>
          </section>
        ) : (
          collections.map((entry) => (
            <section key={entry.id} className="mobile-panel px-4 py-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="mobile-text-tertiary text-[11px] uppercase tracking-[0.18em]">{formatDate(entry.collectionDate)}</p>
                  <h3 className="mobile-text-primary mt-1 text-lg font-semibold">{formatCurrency(entry.amountCollected || entry.amountDue)}</h3>
                  <p className="mobile-text-secondary mt-2 text-sm">
                    Expected {formatCurrency(entry.amountDue)} · {entry.paymentMethod || "cash"}
                  </p>
                </div>
                <span className="mobile-soft-badge capitalize">{formatBorrowerStatus(entry.status)}</span>
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
    <div className="mobile-panel-strong px-4 py-4">
      <p className="mobile-text-tertiary text-[10px] uppercase tracking-[0.16em]">{label}</p>
      <p className="mobile-text-primary mt-2 text-base font-semibold">{value}</p>
    </div>
  );
}

function HistoryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="mobile-row">
      <span className="mobile-text-secondary text-sm">{label}</span>
      <span className="mobile-text-primary text-right text-sm font-semibold">{value}</span>
    </div>
  );
}
