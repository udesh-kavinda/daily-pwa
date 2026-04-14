import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import {
  ArrowLeft,
  CalendarClock,
  CreditCard,
  MapPin,
  Phone,
  Route,
  ShieldAlert,
  WalletCards,
} from "lucide-react";
import { loadMobileDebtorDetailByClerkId, MobileDebtorDetailError } from "@/lib/mobile-debtor-detail";

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

function statusLabel(status: string) {
  return status.replaceAll("_", " ");
}

function approvalTone(status: string) {
  if (status === "pending_approval") return "bg-amber-500/12 text-amber-900 dark:text-amber-200";
  if (status === "rejected") return "bg-rose-500/12 text-rose-900 dark:text-rose-200";
  return "bg-emerald-500/12 text-emerald-900 dark:text-emerald-200";
}

function approvalMessage(status: string) {
  if (status === "pending_approval") {
    return "Creditor approval is still pending. You can collect KYC and prepare the borrower, but a loan request should wait until approval clears.";
  }

  if (status === "rejected") {
    return "This borrower needs creditor review before any new loan request. Check the review note below and coordinate the next correction with the creditor.";
  }

  return null;
}

export default async function CollectorDebtorDetailPage({
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
    const payload = await loadMobileDebtorDetailByClerkId(userId, id);
    const debtor = payload.debtor;
    const summary = payload.summary;
    const recentCollections = (payload.collections || []).slice(0, 5);
    const topApprovalMessage = debtor ? approvalMessage(debtor.approvalStatus) : null;

    if (!debtor) {
      throw new MobileDebtorDetailError("Debtor not found", 404);
    }

    return (
      <div className="space-y-3 pb-4">
        <section className="mobile-panel px-4 py-4">
          <Link
            href="/dashboard/debtors"
            className="mobile-text-secondary inline-flex items-center gap-2 text-sm font-semibold"
          >
            <ArrowLeft size={16} />
            Back to debtors
          </Link>

          <div className="mt-4 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="mobile-section-label">{debtor.route?.name || "Assigned debtor"}</p>
              <h2 className="mobile-text-primary mt-1 text-[1.3rem] font-semibold">{debtor.name}</h2>
              <p className="mobile-text-secondary mt-1.5 text-sm">
                {debtor.collectorName} · {debtor.collectorCode || "Field collector"}
              </p>
            </div>
            <span className={`rounded-full px-3 py-1 text-[11px] font-semibold capitalize ${approvalTone(debtor.approvalStatus)}`}>
              {statusLabel(debtor.approvalStatus)}
            </span>
          </div>

          {topApprovalMessage ? (
            <div className="mobile-inline-surface mt-4 px-4 py-3">
              <p className="mobile-text-secondary text-sm leading-relaxed">{topApprovalMessage}</p>
            </div>
          ) : null}
        </section>

        <section className="grid grid-cols-2 gap-3">
          <MetricCard
            label="Active loans"
            value={String(summary?.activeLoans || 0)}
            icon={<CreditCard size={18} className="text-emerald-700 dark:text-emerald-300" />}
          />
          <MetricCard
            label="Outstanding"
            value={formatCurrency(summary?.totalOutstanding || 0)}
            icon={<WalletCards size={18} className="text-emerald-700 dark:text-emerald-300" />}
          />
          <MetricCard
            label="Total borrowed"
            value={formatCurrency(summary?.totalBorrowed || 0)}
            icon={<WalletCards size={18} className="text-emerald-700 dark:text-emerald-300" />}
          />
          <MetricCard
            label="Recorded visits"
            value={String(summary?.recentCollections || 0)}
            icon={<CalendarClock size={18} className="text-emerald-700 dark:text-emerald-300" />}
          />
        </section>

        <section className="mobile-panel px-4 py-4">
          <p className="mobile-section-label">Borrower contact</p>
          <div className="mobile-compact-list mt-3">
            <DetailRow label="Phone" value={debtor.phone || "Not available"} icon={<Phone size={14} className="mobile-text-tertiary" />} />
            <DetailRow label="Address" value={debtor.address || "Not added"} icon={<MapPin size={14} className="mobile-text-tertiary" />} />
            <DetailRow label="Route" value={debtor.route?.name || debtor.route?.area || "Unassigned"} icon={<Route size={14} className="mobile-text-tertiary" />} />
            <DetailRow label="Portal access" value={debtor.portalAccess.label} icon={<ShieldAlert size={14} className="mobile-text-tertiary" />} />
          </div>
        </section>

        <section className="mobile-panel px-4 py-4">
          <p className="mobile-section-label">Collector permissions</p>
          <h3 className="mobile-text-primary mt-1 text-[1rem] font-semibold">What you can handle from the field</h3>
          <p className="mobile-text-secondary mt-2 text-sm leading-relaxed">{debtor.permissions.guidance}</p>

          <div className="mobile-compact-list mt-4">
            <PermissionRow
              label="KYC and field proof"
              value={debtor.permissions.canManageKyc ? "You can update" : "Locked"}
              tone={debtor.permissions.canManageKyc ? "success" : "muted"}
            />
            <PermissionRow
              label="Loan request"
              value={debtor.permissions.canRequestLoan ? "You can submit" : "Wait for creditor"}
              tone={debtor.permissions.canRequestLoan ? "success" : "warning"}
            />
            <PermissionRow
              label="Borrower profile edits"
              value={debtor.permissions.canEditBorrowerProfile ? "Allowed" : "Handled by creditor"}
              tone={debtor.permissions.canEditBorrowerProfile ? "success" : "muted"}
            />
            <PermissionRow
              label="Portal access"
              value={debtor.permissions.canManagePortalAccess ? "Allowed" : "Handled by creditor"}
              tone={debtor.permissions.canManagePortalAccess ? "success" : "muted"}
            />
          </div>

          <div className="mobile-inline-surface mt-4 px-4 py-4">
            <p className="mobile-text-secondary text-sm leading-relaxed">{debtor.portalAccess.guidance}</p>
          </div>
        </section>

        <section className="mobile-panel px-4 py-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="mobile-section-label">KYC and field proof</p>
              <h3 className="mobile-text-primary mt-1 text-[1rem] font-semibold">Verification pack</h3>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-[11px] font-semibold ${
                debtor.kyc?.isVerified
                  ? "bg-emerald-500/12 text-emerald-900 dark:text-emerald-200"
                  : "bg-amber-500/12 text-amber-900 dark:text-amber-200"
              }`}
            >
              {debtor.kyc?.isVerified ? "Verified" : "Needs update"}
            </span>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-3">
            <KycTile label="ID Front" ready={Boolean(debtor.kyc?.idFront)} />
            <KycTile label="Photo" ready={Boolean(debtor.kyc?.photo)} />
            <KycTile label="Signature" ready={Boolean(debtor.kyc?.signature)} />
          </div>

          <div className="mt-4 flex flex-wrap gap-2.5">
            <Link
              href={`/dashboard/debtors/${debtor.id}/kyc`}
              className="mobile-inline-action"
            >
              <ShieldAlert size={16} />
              Manage KYC
            </Link>
            <div className="mobile-inline-action-secondary">
              {Number(Boolean(debtor.kyc?.idFront)) +
                Number(Boolean(debtor.kyc?.photo)) +
                Number(Boolean(debtor.kyc?.signature))}
              /3 items ready
            </div>
          </div>
        </section>

        <section className="mobile-panel-strong px-4 py-4">
          <p className="mobile-section-label">Next field visit</p>
          <h3 className="mobile-text-primary mt-1 text-[1rem] font-semibold">
            {summary?.nextCollection
              ? `${formatDate(summary.nextCollection.date)} · ${formatCurrency(summary.nextCollection.amountDue)}`
              : "No visit scheduled yet"}
          </h3>
          <p className="mobile-text-secondary mt-2 text-sm leading-relaxed">
            {summary?.nextCollection
              ? `Current visit status: ${statusLabel(summary.nextCollection.status)}`
              : "Once a live loan is approved and scheduled, the next planned visit will appear here automatically."}
          </p>

          <div className="mt-4 flex flex-wrap gap-2.5">
            <Link
              href={`/dashboard/portfolio/debtors/${debtor.id}/loan-request`}
              className={debtor.permissions.canRequestLoan ? "mobile-inline-action" : "mobile-inline-action-secondary pointer-events-none opacity-70"}
              aria-disabled={!debtor.permissions.canRequestLoan}
            >
              <CreditCard size={16} />
              {debtor.permissions.canRequestLoan
                ? "Send loan request"
                : debtor.approvalStatus === "rejected"
                  ? "Review with creditor first"
                  : "Waiting for creditor approval"}
            </Link>
            <div className="mobile-inline-action-secondary">
              {summary?.activeLoans || 0} live loans on record
            </div>
          </div>
        </section>

        <section className="mobile-panel px-4 py-4">
          <p className="mobile-section-label">Loan summary</p>
          <div className="mobile-compact-list mt-3">
            {(payload.loans || []).length === 0 ? (
              <div className="mobile-inline-surface px-4 py-4">
                <p className="mobile-text-secondary text-sm">No loans are assigned to this debtor yet.</p>
              </div>
            ) : (
              (payload.loans || []).map((loan) => (
                <div key={loan.id} className="mobile-inline-surface px-4 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="mobile-text-primary text-sm font-semibold">{loan.loanNumber}</p>
                      <p className="mobile-text-secondary mt-1 text-xs">
                        {loan.tenureDays} days · {formatCurrency(loan.dailyInstallment)} daily
                      </p>
                    </div>
                    <span className="mobile-soft-badge capitalize">{statusLabel(loan.status)}</span>
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
                    <div>
                      <p className="mobile-text-tertiary text-[10px] uppercase tracking-[0.16em]">Borrowed</p>
                      <p className="mobile-text-primary mt-1 font-semibold">{formatCurrency(loan.totalAmount)}</p>
                    </div>
                    <div>
                      <p className="mobile-text-tertiary text-[10px] uppercase tracking-[0.16em]">Collected</p>
                      <p className="mobile-text-primary mt-1 font-semibold">{formatCurrency(loan.amountCollected)}</p>
                    </div>
                    <div>
                      <p className="mobile-text-tertiary text-[10px] uppercase tracking-[0.16em]">Remaining</p>
                      <p className="mobile-text-primary mt-1 font-semibold">{formatCurrency(loan.amountRemaining)}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="mobile-panel px-4 py-4">
          <p className="mobile-section-label">Recent collection activity</p>
          <div className="mobile-compact-list mt-3">
            {recentCollections.length === 0 ? (
              <div className="mobile-inline-surface px-4 py-4">
                <p className="mobile-text-secondary text-sm">
                  No collection activity has been recorded for this debtor yet.
                </p>
              </div>
            ) : (
              recentCollections.map((entry) => (
                <div key={entry.id} className="mobile-inline-surface px-4 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="mobile-text-primary text-sm font-semibold">
                        {formatCurrency(entry.amountCollected || entry.amountDue)}
                      </p>
                      <p className="mobile-text-secondary mt-1 text-xs">
                        {entry.loanNumber} · {formatDate(entry.collectionDate)}
                      </p>
                    </div>
                    <span className="mobile-soft-badge capitalize">{statusLabel(entry.status)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {debtor.approvalNote || debtor.notes ? (
          <section className="grid gap-3">
            {debtor.approvalNote ? (
              <section className="mobile-panel px-4 py-4">
                <p className="mobile-section-label">Creditor review note</p>
                <p className="mobile-text-secondary mt-3 text-sm leading-relaxed">{debtor.approvalNote}</p>
              </section>
            ) : null}
            {debtor.notes ? (
              <section className="mobile-panel px-4 py-4">
                <p className="mobile-section-label">Internal note</p>
                <p className="mobile-text-secondary mt-3 text-sm leading-relaxed">{debtor.notes}</p>
              </section>
            ) : null}
          </section>
        ) : null}
      </div>
    );
  } catch (error: unknown) {
    const message =
      error instanceof MobileDebtorDetailError || error instanceof Error
        ? error.message
        : "This debtor could not be loaded for the collector.";

    return (
      <div className="space-y-4 pb-4">
        <section className="mobile-panel px-5 py-6 text-center">
          <p className="mobile-text-primary text-base font-semibold">Debtor detail is unavailable.</p>
          <p className="mobile-text-secondary mt-2 text-sm leading-relaxed">{message}</p>
          <Link
            href="/dashboard/debtors"
            className="mobile-inline-action mt-4"
          >
            <ArrowLeft size={16} />
            Back to debtors
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
      <div className="flex items-start justify-between gap-3">
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

function PermissionRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "success" | "warning" | "muted";
}) {
  return (
    <div className="mobile-row">
      <span className="mobile-text-secondary text-sm">{label}</span>
      <span
        className={`rounded-full px-3 py-1 text-[11px] font-semibold ${
          tone === "success"
            ? "bg-emerald-500/12 text-emerald-900 dark:text-emerald-200"
            : tone === "warning"
              ? "bg-amber-500/12 text-amber-900 dark:text-amber-200"
              : "bg-[color:var(--ink-soft)] text-[color:var(--text-secondary)]"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function KycTile({ label, ready }: { label: string; ready: boolean }) {
  return (
    <div className="mobile-inline-surface px-3 py-3 text-center">
      <p className="mobile-text-tertiary text-[10px] uppercase tracking-[0.16em]">{label}</p>
      <p className={`mt-2 text-sm font-semibold ${ready ? "text-emerald-700 dark:text-emerald-300" : "mobile-text-secondary"}`}>
        {ready ? "Ready" : "Missing"}
      </p>
    </div>
  );
}
