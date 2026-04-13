import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { ArrowLeft, WalletCards } from "lucide-react";
import { formatBorrowerStatus } from "@/lib/borrower-copy";
import { getAppSessionContextByClerkId } from "@/lib/auth/get-app-session-context";
import { loadMobileLoanHistory, MobileLoanHistoryError } from "@/lib/mobile-loan-history";

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

export default async function DebtorLoanHistoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { userId } = await auth();
  if (!userId) {
    redirect("/sign-in");
  }

  const session = await getAppSessionContextByClerkId(userId);
  const { id } = await params;

  let payload: Awaited<ReturnType<typeof loadMobileLoanHistory>> | null = null;
  let message: string | null = null;

  try {
    payload = await loadMobileLoanHistory(session, id);
  } catch (error: unknown) {
    message =
      error instanceof MobileLoanHistoryError || error instanceof Error
        ? error.message
        : "This loan could not be loaded.";
  }

  if (!payload?.loan) {
    return (
      <div className="space-y-4 pb-4">
        <section className="mobile-panel px-5 py-6 text-center">
          <p className="mobile-text-primary text-base font-semibold">Repayment history is unavailable.</p>
          <p className="mobile-text-secondary mt-2 text-sm leading-relaxed">{message}</p>
          <Link href="/dashboard/portfolio" className="mobile-inline-action mt-4">
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
        <Link href={`/dashboard/portfolio/${payload.loan.id}`} className="mobile-text-secondary inline-flex items-center gap-2 text-sm font-semibold">
          <ArrowLeft size={16} />
          Back to loan detail
        </Link>
        <p className="mobile-section-label mt-4">{payload.organization?.name || payload.loan.creditorName}</p>
        <h2 className="mobile-text-primary mt-1 text-xl font-semibold">{payload.loan.loanNumber}</h2>
        <p className="mobile-text-secondary mt-2 text-sm">A simple timeline of each visit, recorded amount, and outcome on this loan.</p>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <SummaryCard label="Total received" value={formatCurrency(payload.historySummary.totalCaptured)} />
          <SummaryCard label="Usual paid amount" value={formatCurrency(payload.historySummary.averageCaptured)} />
          <SummaryCard label="Payments recorded" value={String(payload.historySummary.successfulEntries)} />
          <SummaryCard label="Missed or rescheduled" value={String(payload.historySummary.missedEntries + payload.historySummary.deferredEntries)} />
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
          <HistoryRow label="Last payment received" value={formatDate(payload.historySummary.lastPaymentDate)} />
          <HistoryRow label="Activity recorded" value={String(payload.historySummary.totalEntries)} />
          <HistoryRow label="Expected daily amount" value={formatCurrency(payload.loan.dailyInstallment)} />
          <HistoryRow label="Still left to repay" value={formatCurrency(payload.loan.amountRemaining)} />
        </div>
      </section>

      <section className="space-y-3">
        {payload.collections.length === 0 ? (
          <section className="mobile-panel px-5 py-6 text-center">
            <p className="mobile-text-primary text-base font-semibold">No repayment records yet.</p>
            <p className="mobile-text-secondary mt-2 text-sm leading-relaxed">
              When a payment, missed visit, or rescheduled visit is recorded, it will appear here with the date and outcome.
            </p>
          </section>
        ) : (
          payload.collections.map((entry) => (
            <section key={entry.id} className="mobile-panel px-4 py-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="mobile-text-tertiary text-[11px] uppercase tracking-[0.18em]">{formatDate(entry.collectionDate)}</p>
                  <h3 className="mobile-text-primary mt-1 text-lg font-semibold">{formatCurrency(entry.amountCollected || entry.amountDue)}</h3>
                  <p className="mobile-text-secondary mt-2 text-sm">
                    Expected {formatCurrency(entry.amountDue)} · {entry.paymentMethod || "cash"}
                  </p>
                </div>
                <span className="mobile-soft-badge capitalize">
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
