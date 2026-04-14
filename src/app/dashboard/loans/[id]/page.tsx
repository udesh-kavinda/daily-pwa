import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { ArrowLeft, ArrowRight, CalendarClock, CreditCard, Phone, WalletCards } from "lucide-react";
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
  if (!value) return "Not scheduled";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("en-LK", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(parsed);
}

export default async function LoanDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { userId } = await auth();
  if (!userId) {
    redirect("/sign-in");
  }

  const { id } = await params;

  try {
    const payload = await loadMobileLoanDetailByClerkId(userId, id);
    const loan = payload.loan;
    const recentCollections = (payload.collections || []).slice(0, 5);

    if (!loan) {
      throw new MobileLoanDetailError("Loan not found", 404);
    }

    return (
      <div className="space-y-3 pb-4">
        <section className="mobile-panel px-4 py-4">
          <Link
            href="/dashboard/loans"
            className="mobile-text-secondary inline-flex items-center gap-2 text-sm font-semibold"
          >
            <ArrowLeft size={16} />
            Back to loans
          </Link>

          <div className="mt-4 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="mobile-section-label">{loan.creditorName}</p>
              <h2 className="mobile-text-primary mt-1 text-[1.3rem] font-semibold">{loan.loanNumber}</h2>
              <p className="mobile-text-secondary mt-1.5 text-sm">
                {payload.context?.debtorName || "Debtor"} · {loan.collectorName} · {formatBorrowerStatus(loan.status)}
              </p>
            </div>
            <span className="rounded-full bg-emerald-500/12 px-3 py-1 text-[11px] font-semibold text-emerald-900 dark:text-emerald-200">
              {loan.progressPercent}% paid
            </span>
          </div>
        </section>

        <section className="grid grid-cols-2 gap-3">
          <MetricCard
            label="Outstanding"
            value={formatCurrency(loan.amountRemaining)}
            icon={<WalletCards size={18} className="text-emerald-700 dark:text-emerald-300" />}
          />
          <MetricCard
            label="Paid so far"
            value={formatCurrency(loan.amountCollected)}
            icon={<CreditCard size={18} className="text-emerald-700 dark:text-emerald-300" />}
          />
          <MetricCard
            label="Daily pay"
            value={formatCurrency(loan.dailyInstallment)}
            icon={<WalletCards size={18} className="text-emerald-700 dark:text-emerald-300" />}
          />
          <MetricCard
            label="Ends"
            value={formatDate(loan.endDate)}
            icon={<CalendarClock size={18} className="text-emerald-700 dark:text-emerald-300" />}
          />
        </section>

        <section className="mobile-panel px-4 py-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="mobile-section-label">Next collection</p>
              <h3 className="mobile-text-primary mt-1 text-[1rem] font-semibold">
                {loan.nextCollection
                  ? `${formatDate(loan.nextCollection.date)} · ${formatCurrency(loan.nextCollection.amountDue)}`
                  : "No visit scheduled"}
              </h3>
              <p className="mobile-text-secondary mt-2 text-sm leading-relaxed">
                {loan.nextCollection
                  ? `${loan.collectorName} is expected to collect ${formatCurrency(
                      loan.nextCollection.amountDue
                    )} on the next visit.`
                  : "The next collection will appear here once the schedule is prepared."}
              </p>
            </div>
            <Link
              href={`/dashboard/loans/${loan.id}/history`}
              className="mobile-inline-action-secondary"
            >
              History
            </Link>
          </div>
        </section>

        <section className="mobile-panel px-4 py-4">
          <p className="mobile-section-label">Contacts</p>
          <div className="mobile-compact-list mt-3">
            <DetailRow label="Debtor" value={payload.context?.debtorName || "Debtor"} />
            <DetailRow label="Collector" value={loan.collectorName} />
            <DetailRow
              label="Collector phone"
              value={loan.collectorPhone || "Not available"}
              icon={<Phone size={14} className="mobile-text-tertiary" />}
            />
          </div>
        </section>

        <section className="mobile-panel px-4 py-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="mobile-section-label">Recent activity</p>
              <h3 className="mobile-text-primary mt-1 text-[1rem] font-semibold">Collection history</h3>
            </div>
            <Link
              href={`/dashboard/loans/${loan.id}/history`}
              className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-700 dark:text-emerald-300"
            >
              Full history
              <ArrowRight size={15} />
            </Link>
          </div>

          <div className="mobile-compact-list mt-3">
            {recentCollections.length === 0 ? (
              <div className="mobile-inline-surface px-4 py-4">
                <p className="mobile-text-secondary text-sm">
                  No collection activity has been recorded for this loan yet.
                </p>
              </div>
            ) : (
              recentCollections.map((entry) => (
                <div key={entry.id} className="mobile-inline-surface px-4 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="mobile-text-primary text-sm font-semibold">
                        {formatCurrency(entry.amountCollected || entry.amountDue)}
                      </p>
                      <p className="mobile-text-secondary mt-1 text-xs">
                        {formatDate(entry.collectionDate)} · {entry.paymentMethod || "cash"}
                      </p>
                    </div>
                    <span className="mobile-soft-badge capitalize">{formatBorrowerStatus(entry.status)}</span>
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
  } catch (error: unknown) {
    const message =
      error instanceof MobileLoanDetailError || error instanceof Error
        ? error.message
        : "This loan could not be loaded.";

    return (
      <div className="space-y-4 pb-4">
        <section className="mobile-panel px-5 py-6 text-center">
          <p className="mobile-text-primary text-base font-semibold">Loan detail is unavailable.</p>
          <p className="mobile-text-secondary mt-2 text-sm leading-relaxed">{message}</p>
          <Link href="/dashboard/loans" className="mobile-inline-action mt-4">
            <ArrowLeft size={16} />
            Back to loans
          </Link>
        </section>
      </div>
    );
  }
}

function MetricCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <section className="mobile-panel-strong px-4 py-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="mobile-text-tertiary text-[10px] uppercase tracking-[0.16em]">{label}</p>
          <p className="mobile-text-primary mt-2 text-sm font-semibold">{value}</p>
        </div>
        <div className="flex h-9 w-9 items-center justify-center rounded-[12px] bg-emerald-500/10 dark:bg-emerald-500/14">
          {icon}
        </div>
      </div>
    </section>
  );
}

function DetailRow({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="mobile-row">
      <div className="mobile-text-secondary inline-flex items-center gap-2 text-sm">
        {icon}
        <span>{label}</span>
      </div>
      <span className="mobile-text-primary text-right text-sm font-semibold">{value}</span>
    </div>
  );
}
