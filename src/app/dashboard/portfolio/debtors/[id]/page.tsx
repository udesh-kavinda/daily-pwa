"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, CalendarClock, CreditCard, LoaderCircle, MapPin, NotebookPen, Phone, Route, ShieldAlert, WalletCards } from "lucide-react";
import { fetchJson } from "@/lib/fetch-json";

type CollectorDebtorPayload = {
  debtor?: {
    id: string;
    name: string;
    phone: string | null;
    address: string | null;
    idNumber: string | null;
    approvalStatus: string;
    approvalRequestedAt: string | null;
    approvalNote: string | null;
    route?: { id?: string | null; name?: string | null; area?: string | null } | null;
    collectorName: string;
    collectorCode: string | null;
    notes: string | null;
    portalAccess: {
      status: "configured" | "not_configured";
      label: string;
      guidance: string;
    };
    permissions: {
      canManageKyc: boolean;
      canRequestLoan: boolean;
      canSeeLoanSummary: boolean;
      canEditBorrowerProfile: boolean;
      canManagePortalAccess: boolean;
      canApproveDebtor: boolean;
      guidance: string;
    };
    kyc?: {
      idFrontUrl: string | null;
      photoUrl: string | null;
      signatureUrl: string | null;
      idFront: boolean;
      photo: boolean;
      signature: boolean;
      isVerified: boolean;
    };
  } | null;
  summary?: {
    activeLoans: number;
    totalBorrowed: number;
    totalOutstanding: number;
    recentCollections: number;
    nextCollection?: { date: string; amountDue: number; status: string } | null;
  } | null;
  loans?: Array<{
    id: string;
    loanNumber: string;
    status: string;
    principalAmount: number;
    totalAmount: number;
    amountCollected: number;
    amountRemaining: number;
    dailyInstallment: number;
    tenureDays: number;
  }>;
  collections?: Array<{
    id: string;
    status: string;
    amountDue: number;
    amountCollected: number;
    paymentMethod: string | null;
    collectionDate: string;
    collectedAt: string | null;
    loanNumber: string;
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

function statusLabel(status: string) {
  return status.replaceAll("_", " ");
}

function approvalTone(status: string) {
  if (status === "pending_approval") return "bg-amber-500/14 text-amber-900";
  if (status === "rejected") return "bg-rose-500/12 text-rose-900";
  return "bg-emerald-500/12 text-emerald-900";
}

function approvalMessage(status: string) {
  if (status === "pending_approval") {
    return "Creditor approval is still pending. You can collect KYC and prepare the account, but a loan request should wait until approval clears.";
  }

  if (status === "rejected") {
    return "This borrower needs creditor review before any new loan request. Check the review note below and coordinate the next correction with the creditor.";
  }

  return null;
}

export default function CollectorDebtorDetailPage() {
  const params = useParams<{ id: string }>();
  const debtorId = params?.id;
  const [loading, setLoading] = useState(true);
  const [payload, setPayload] = useState<CollectorDebtorPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function load() {
      if (!debtorId) return;
      setLoading(true);
      try {
        const nextPayload = await fetchJson<CollectorDebtorPayload>(`/api/mobile/debtors/${debtorId}`);
        if (!mounted) return;
        setPayload(nextPayload);
        setError(null);
      } catch (fetchError: unknown) {
        if (!mounted) return;
        const message = fetchError instanceof Error ? fetchError.message : "Failed to load debtor detail";
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
  }, [debtorId]);

  const debtor = payload?.debtor;
  const summary = payload?.summary;
  const recentCollections = useMemo(() => (payload?.collections || []).slice(0, 5), [payload?.collections]);
  const topApprovalMessage = debtor ? approvalMessage(debtor.approvalStatus) : null;

  if (loading) {
    return (
      <div className="space-y-4 pb-4">
        <section className="mobile-panel px-5 py-6 text-center">
          <LoaderCircle size={22} className="mx-auto animate-spin text-emerald-700" />
          <p className="mt-3 text-sm text-stone-600">Loading debtor detail...</p>
        </section>
      </div>
    );
  }

  if (!debtor || error) {
    return (
      <div className="space-y-4 pb-4">
        <section className="mobile-panel px-5 py-6 text-center">
          <p className="text-base font-semibold text-[#14213d]">Debtor detail is unavailable.</p>
          <p className="mt-2 text-sm leading-relaxed text-stone-600">{error || "This debtor could not be loaded for the collector."}</p>
          <Link href="/dashboard/portfolio" className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#14213d] px-4 py-3 text-sm font-semibold text-white">
            <ArrowLeft size={16} />
            Back to debtors
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
          Back to debtors
        </Link>

        <div className="mt-4 flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-emerald-100/80">{debtor.route?.name || "Assigned debtor"}</p>
            <h2 className="mt-1 text-[2rem] font-semibold">{debtor.name}</h2>
            <p className="mt-2 text-sm text-white/72">{debtor.collectorName} · {debtor.collectorCode || "Field collector"}</p>
          </div>
          <span className={`rounded-full px-3 py-1 text-[11px] font-semibold capitalize ${approvalTone(debtor.approvalStatus)}`}>
            {statusLabel(debtor.approvalStatus)}
          </span>
        </div>

        {topApprovalMessage ? (
          <div className="mt-5 rounded-[22px] bg-white/10 px-4 py-4 text-sm text-white/78">
            {topApprovalMessage}
          </div>
        ) : null}
      </section>

      <section className="grid grid-cols-2 gap-3">
        <MetricCard label="Active loans" value={String(summary?.activeLoans || 0)} icon={<CreditCard size={18} className="text-emerald-700" />} />
        <MetricCard label="Outstanding" value={formatCurrency(summary?.totalOutstanding || 0)} icon={<WalletCards size={18} className="text-emerald-700" />} />
        <MetricCard label="Total borrowed" value={formatCurrency(summary?.totalBorrowed || 0)} icon={<WalletCards size={18} className="text-emerald-700" />} />
        <MetricCard label="Recorded visits" value={String(summary?.recentCollections || 0)} icon={<CalendarClock size={18} className="text-emerald-700" />} />
      </section>

      <section className="mobile-panel px-5 py-5">
        <p className="text-[11px] uppercase tracking-[0.18em] text-stone-500">Borrower contact</p>
        <div className="mt-4 grid gap-3">
          <DetailRow label="Phone" value={debtor.phone || "Not available"} icon={<Phone size={14} className="text-stone-400" />} />
          <DetailRow label="Address" value={debtor.address || "Not added"} icon={<MapPin size={14} className="text-stone-400" />} />
          <DetailRow label="Route" value={debtor.route?.name || debtor.route?.area || "Unassigned"} icon={<Route size={14} className="text-stone-400" />} />
          <DetailRow label="Portal access" value={debtor.portalAccess.label} icon={<ShieldAlert size={14} className="text-stone-400" />} />
        </div>
      </section>

      <section className="mobile-panel px-5 py-5">
        <p className="text-[11px] uppercase tracking-[0.18em] text-stone-500">Collector permissions</p>
        <h3 className="mt-1 text-lg font-semibold text-[#14213d]">What you can handle from the field</h3>
        <p className="mt-2 text-sm leading-relaxed text-stone-600">{debtor.permissions.guidance}</p>

        <div className="mt-4 grid gap-3">
          <PermissionRow label="KYC and field proof" value={debtor.permissions.canManageKyc ? "You can update" : "Locked"} tone={debtor.permissions.canManageKyc ? "success" : "muted"} />
          <PermissionRow label="Loan request" value={debtor.permissions.canRequestLoan ? "You can submit" : "Wait for creditor" } tone={debtor.permissions.canRequestLoan ? "success" : "warning"} />
          <PermissionRow label="Borrower profile edits" value={debtor.permissions.canEditBorrowerProfile ? "Allowed" : "Handled by creditor"} tone={debtor.permissions.canEditBorrowerProfile ? "success" : "muted"} />
          <PermissionRow label="Portal access" value={debtor.permissions.canManagePortalAccess ? "Allowed" : "Handled by creditor"} tone={debtor.permissions.canManagePortalAccess ? "success" : "muted"} />
        </div>

        <div className="mt-4 rounded-[22px] bg-stone-900/[0.045] px-4 py-4 text-sm text-stone-600">
          {debtor.portalAccess.guidance}
        </div>
      </section>

      <section className="mobile-panel px-5 py-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-stone-500">KYC and field proof</p>
            <h3 className="mt-1 text-lg font-semibold text-[#14213d]">Verification pack</h3>
          </div>
          <span className={`rounded-full px-3 py-1 text-[11px] font-semibold ${debtor.kyc?.isVerified ? "bg-emerald-500/12 text-emerald-900" : "bg-amber-500/12 text-amber-900"}`}>
            {debtor.kyc?.isVerified ? "Verified" : "Needs update"}
          </span>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-3">
          <KycTile label="ID Front" ready={Boolean(debtor.kyc?.idFront)} />
          <KycTile label="Photo" ready={Boolean(debtor.kyc?.photo)} />
          <KycTile label="Signature" ready={Boolean(debtor.kyc?.signature)} />
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            href={`/dashboard/portfolio/debtors/${debtor.id}/kyc`}
            className="inline-flex items-center gap-2 rounded-full bg-[#14213d] px-4 py-3 text-sm font-semibold text-white"
          >
            <ShieldAlert size={16} />
            Manage KYC
          </Link>
          <div className="inline-flex items-center rounded-full bg-white/72 px-4 py-3 text-sm text-stone-600">
            {Number(Boolean(debtor.kyc?.idFront)) + Number(Boolean(debtor.kyc?.photo)) + Number(Boolean(debtor.kyc?.signature))}/3 items ready
          </div>
        </div>
      </section>

      <section className="mobile-panel-strong px-5 py-5">
        <p className="text-[11px] uppercase tracking-[0.18em] text-stone-500">Next field visit</p>
        <h3 className="mt-1 text-lg font-semibold text-[#14213d]">
          {summary?.nextCollection
            ? `${formatDate(summary.nextCollection.date)} · ${formatCurrency(summary.nextCollection.amountDue)}`
            : "No visit scheduled yet"}
        </h3>
        <p className="mt-2 text-sm text-stone-600">
          {summary?.nextCollection
            ? `Current visit status: ${statusLabel(summary.nextCollection.status)}`
            : "Once a live loan is approved and scheduled, the next planned visit will appear here automatically."}
        </p>

        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            href={`/dashboard/portfolio/debtors/${debtor.id}/loan-request`}
            className={`inline-flex items-center gap-2 rounded-full px-4 py-3 text-sm font-semibold ${
              debtor.permissions.canRequestLoan
                ? "bg-[#14213d] text-white"
                : "pointer-events-none bg-stone-900/8 text-stone-500"
            }`}
            aria-disabled={!debtor.permissions.canRequestLoan}
          >
            <CreditCard size={16} />
            {debtor.permissions.canRequestLoan
              ? "Send loan request"
              : debtor.approvalStatus === "rejected"
                ? "Review with creditor first"
                : "Waiting for creditor approval"}
          </Link>
          <div className="inline-flex items-center rounded-full bg-white/72 px-4 py-3 text-sm text-stone-600">
            {summary?.activeLoans || 0} live loans on record
          </div>
        </div>
      </section>

      <section className="mobile-panel px-5 py-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-stone-500">Loan summary</p>
            <h3 className="mt-1 text-lg font-semibold text-[#14213d]">Borrowing on record</h3>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          {(payload?.loans || []).length === 0 ? (
            <div className="rounded-[22px] border border-dashed border-stone-900/12 bg-white/70 px-4 py-5 text-sm text-stone-600">
              No loans are assigned to this debtor yet.
            </div>
          ) : (
            (payload?.loans || []).map((loan) => (
              <div key={loan.id} className="rounded-[22px] border border-stone-900/8 bg-white/72 px-4 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-[#14213d]">{loan.loanNumber}</p>
                    <p className="mt-1 text-xs text-stone-500">{loan.tenureDays} days · {formatCurrency(loan.dailyInstallment)} daily</p>
                  </div>
                  <span className="rounded-full bg-stone-900/6 px-3 py-1 text-[11px] font-semibold capitalize text-stone-700">
                    {statusLabel(loan.status)}
                  </span>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.16em] text-stone-500">Borrowed</p>
                    <p className="mt-1 font-semibold text-[#14213d]">{formatCurrency(loan.totalAmount)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.16em] text-stone-500">Collected</p>
                    <p className="mt-1 font-semibold text-[#14213d]">{formatCurrency(loan.amountCollected)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.16em] text-stone-500">Remaining</p>
                    <p className="mt-1 font-semibold text-[#14213d]">{formatCurrency(loan.amountRemaining)}</p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="mobile-panel px-5 py-5">
        <p className="text-[11px] uppercase tracking-[0.18em] text-stone-500">Recent collection activity</p>
        <div className="mt-4 space-y-3">
          {recentCollections.length === 0 ? (
            <div className="rounded-[22px] border border-dashed border-stone-900/12 bg-white/70 px-4 py-5 text-sm text-stone-600">
              No collection activity has been recorded for this debtor yet.
            </div>
          ) : (
            recentCollections.map((entry) => (
              <div key={entry.id} className="rounded-[22px] border border-stone-900/8 bg-white/72 px-4 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-[#14213d]">{entry.loanNumber}</p>
                    <p className="mt-1 text-xs text-stone-500">{formatDate(entry.collectionDate)} · {entry.paymentMethod || "cash"}</p>
                  </div>
                  <span className="rounded-full bg-stone-900/6 px-3 py-1 text-[11px] font-semibold capitalize text-stone-700">
                    {statusLabel(entry.status)}
                  </span>
                </div>
                <p className="mt-3 text-sm text-stone-700">
                  Recorded {formatCurrency(entry.amountCollected || entry.amountDue)} against an expected amount of {formatCurrency(entry.amountDue)}.
                </p>
              </div>
            ))
          )}
        </div>
      </section>

      {debtor.notes || debtor.approvalNote ? (
        <section className="grid gap-3">
          {debtor.notes ? (
            <div className="mobile-panel px-5 py-5">
              <p className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-stone-500">
                <NotebookPen size={14} className="text-stone-400" />
                Field notes
              </p>
              <p className="mt-3 text-sm leading-relaxed text-stone-700">{debtor.notes}</p>
            </div>
          ) : null}
          {debtor.approvalNote ? (
            <div className="mobile-panel px-5 py-5 border-amber-700/12 bg-amber-500/10">
              <p className="text-[11px] uppercase tracking-[0.18em] text-amber-900">Creditor review note</p>
              <p className="mt-3 text-sm leading-relaxed text-amber-950/85">{debtor.approvalNote}</p>
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
        <p className="text-[10px] uppercase tracking-[0.16em] text-stone-500">{label}</p>
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

function KycTile({ label, ready }: { label: string; ready: boolean }) {
  return (
    <div className={`rounded-[20px] px-3 py-4 text-center ${ready ? "bg-emerald-500/10 text-emerald-900" : "bg-stone-900/6 text-stone-600"}`}>
      <p className="text-[10px] uppercase tracking-[0.16em]">{label}</p>
      <p className="mt-2 text-sm font-semibold">{ready ? "Uploaded" : "Missing"}</p>
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
  const toneClass =
    tone === "success"
      ? "bg-emerald-500/10 text-emerald-900"
      : tone === "warning"
        ? "bg-amber-500/12 text-amber-900"
        : "bg-stone-900/6 text-stone-700";

  return (
    <div className="flex items-center justify-between gap-4 rounded-[22px] bg-white/72 px-4 py-4">
      <span className="text-sm text-stone-600">{label}</span>
      <span className={`rounded-full px-3 py-1 text-[11px] font-semibold ${toneClass}`}>{value}</span>
    </div>
  );
}
