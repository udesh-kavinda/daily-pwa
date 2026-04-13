"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  BadgeCheck,
  CalendarClock,
  CheckCircle2,
  CreditCard,
  LoaderCircle,
  NotebookPen,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import { fetchJson } from "@/lib/fetch-json";
import type { LoanRequestContext } from "@/lib/mobile-loan-request";

type LoanRequestSubmitResponse = {
  ok: boolean;
  loan: {
    id: string;
    loanNumber: string;
    status: string;
    totalAmount: number;
    dailyInstallment: number;
  };
};

type BannerState = { tone: "success" | "warning" | "danger" | "info"; text: string } | null;

function formatCurrency(amount: number, currency = "LKR") {
  return new Intl.NumberFormat("en-LK", {
    style: "currency",
    currency,
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

function statusLabel(status: string) {
  return status.replaceAll("_", " ");
}

export function LoanRequestPageClient({ initialContext }: { initialContext: LoanRequestContext }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [banner, setBanner] = useState<BannerState>(
    initialContext.flags?.blocker ? { tone: "warning", text: initialContext.flags.blocker } : null,
  );
  const [context] = useState<LoanRequestContext>(initialContext);
  const [formData, setFormData] = useState({
    principalAmount: initialContext.defaults?.principalAmount ? String(initialContext.defaults.principalAmount) : "",
    interestRate: String(initialContext.defaults?.interestRate ?? 10),
    tenureDays: String(initialContext.defaults?.tenureDays ?? 30),
    startDate: initialContext.defaults?.startDate || new Date().toISOString().split("T")[0],
    notes: "",
    allowUnverifiedKyc: false,
    specialPermissionNote: "",
  });

  const principal = Number(formData.principalAmount || 0);
  const interestRate = Number(formData.interestRate || 0);
  const tenureDays = Number(formData.tenureDays || 0);
  const currency = context.organization?.currency || "LKR";

  const summary = useMemo(() => {
    const interestAmount = Number.isFinite(principal) ? (principal * interestRate) / 100 : 0;
    const totalAmount = principal + interestAmount;
    const dailyInstallment = tenureDays > 0 ? totalAmount / tenureDays : 0;
    return {
      interestAmount,
      totalAmount,
      dailyInstallment,
    };
  }, [interestRate, principal, tenureDays]);

  const canSubmit = Boolean(context.flags?.canSubmit) && !submitting;
  const kycReady = Boolean(context.flags?.kycReady);
  const debtor = context.debtor;

  const handleChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target;
    setFormData((current) => ({ ...current, [name]: value }));
  };

  const handleToggle = (value: boolean) => {
    setFormData((current) => ({
      ...current,
      allowUnverifiedKyc: value,
      specialPermissionNote: value ? current.specialPermissionNote : "",
    }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!debtor?.id) return;
    setSubmitting(true);
    try {
      const response = await fetchJson<LoanRequestSubmitResponse>("/api/mobile/loans/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          debtorId: debtor.id,
          principalAmount: formData.principalAmount,
          interestRate: formData.interestRate,
          tenureDays: formData.tenureDays,
          startDate: formData.startDate,
          notes: formData.notes,
          allowUnverifiedKyc: formData.allowUnverifiedKyc,
          specialPermissionNote: formData.specialPermissionNote,
        }),
      });

      setBanner({
        tone: "success",
        text: `${response.loan.loanNumber} is now waiting in the creditor approval inbox.`,
      });

      setTimeout(() => {
        router.push(`/dashboard/portfolio/debtors/${debtor.id}`);
      }, 500);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to submit loan request";
      setBanner({ tone: "danger", text: message });
    } finally {
      setSubmitting(false);
    }
  };

  if (!debtor) return null;

  return (
    <div className="space-y-3 pb-4">
      <section className="mobile-panel px-4 py-4">
        <Link href={`/dashboard/portfolio/debtors/${debtor.id}`} className="mobile-text-secondary inline-flex items-center gap-2 text-sm font-semibold">
          <ArrowLeft size={16} />
          Back to debtor detail
        </Link>

        <div className="mt-4 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="mobile-section-label">Collector proposal</p>
            <h2 className="mobile-text-primary mt-1 text-[1.3rem] font-semibold">{debtor.name}</h2>
            <p className="mobile-text-secondary mt-1.5 text-sm">
              {context.organization?.name || "Daily+ Organization"}
              {debtor.route?.name ? ` · ${debtor.route.name}` : ""}
            </p>
          </div>
          <div className="mobile-inline-surface min-w-[92px] px-3 py-2 text-right">
            <p className="mobile-text-tertiary text-[10px] uppercase tracking-[0.16em]">Pending reviews</p>
            <p className="mobile-text-primary mt-1 text-xl font-semibold">{context.existing?.pendingLoans || 0}</p>
          </div>
        </div>

        <div className="mobile-inline-surface mt-4 px-4 py-4">
          <p className="mobile-text-secondary text-sm leading-relaxed">
            Build the repayment shape in the field, then send it straight into the creditor approval inbox with the right context attached.
          </p>
        </div>
      </section>

      {banner ? (
        <section className={`mobile-panel px-4 py-4 ${
          banner.tone === "success"
            ? "border-emerald-700/12 bg-emerald-500/8"
            : banner.tone === "warning"
              ? "border-amber-700/12 bg-amber-500/10"
              : banner.tone === "danger"
                ? "border-rose-700/14 bg-rose-500/10"
                : "mobile-surface-subtle"
        }`}>
          <p className="mobile-text-primary text-sm leading-relaxed">{banner.text}</p>
        </section>
      ) : null}

      <section className="grid grid-cols-2 gap-3">
        <MetricCard label="Total repayable" value={formatCurrency(summary.totalAmount, currency)} icon={<CreditCard size={18} className="text-emerald-700 dark:text-emerald-300" />} />
        <MetricCard label="Daily pay" value={formatCurrency(summary.dailyInstallment, currency)} icon={<CalendarClock size={18} className="text-emerald-700 dark:text-emerald-300" />} />
        <MetricCard label="Interest" value={formatCurrency(summary.interestAmount, currency)} icon={<Sparkles size={18} className="text-emerald-700 dark:text-emerald-300" />} />
        <MetricCard label="Existing loans" value={String(context.existing?.totalLoans || 0)} icon={<NotebookPen size={18} className="text-emerald-700 dark:text-emerald-300" />} />
      </section>

      <section className="mobile-panel px-4 py-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="mobile-section-label">Readiness</p>
            <h3 className="mobile-text-primary mt-1 text-[1rem] font-semibold">Debtor and KYC signal</h3>
          </div>
          {kycReady ? <BadgeCheck size={18} className="text-emerald-700 dark:text-emerald-300" /> : <ShieldAlert size={18} className="text-amber-700 dark:text-amber-300" />}
        </div>

        <div className="mt-4 grid gap-3">
          <StatusRow label="Debtor approval" value={statusLabel(debtor.approvalStatus)} tone={debtor.approvalStatus === "approved" ? "success" : "warning"} />
          <StatusRow label="ID front" value={debtor.kyc.idFront ? "Captured" : "Missing"} tone={debtor.kyc.idFront ? "success" : "warning"} />
          <StatusRow label="Photo" value={debtor.kyc.photo ? "Captured" : "Missing"} tone={debtor.kyc.photo ? "success" : "warning"} />
          <StatusRow label="Signature" value={debtor.kyc.signature ? "Captured" : "Missing"} tone={debtor.kyc.signature ? "success" : "warning"} />
        </div>

        <div className="mobile-inline-surface mt-4 px-4 py-4">
          <p className="mobile-text-secondary text-sm leading-relaxed">
            {kycReady
              ? "This debtor is verified enough for a standard loan proposal."
              : "KYC is incomplete. You can still ask the creditor to review the proposal, but add a short permission note so the reason is clear."}
          </p>
        </div>
      </section>

      <form onSubmit={handleSubmit} className="space-y-3">
        <section className="mobile-panel px-4 py-4">
          <p className="mobile-section-label">Proposal terms</p>
          <div className="mt-4 grid gap-4">
            <Field label="Principal amount">
              <input
                name="principalAmount"
                value={formData.principalAmount}
                onChange={handleChange}
                type="number"
                min="0"
                step="100"
                placeholder="50000"
                className="mobile-input"
                required
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Interest %">
                <input
                  name="interestRate"
                  value={formData.interestRate}
                  onChange={handleChange}
                  type="number"
                  min="0"
                  step="0.1"
                  className="mobile-input"
                  required
                />
              </Field>
              <Field label="Tenure days">
                <input
                  name="tenureDays"
                  value={formData.tenureDays}
                  onChange={handleChange}
                  type="number"
                  min="1"
                  step="1"
                  className="mobile-input"
                  required
                />
              </Field>
            </div>
            <Field label="Start date">
              <input
                name="startDate"
                value={formData.startDate}
                onChange={handleChange}
                type="date"
                className="mobile-input"
                required
              />
            </Field>
            <div className="mobile-inline-surface px-4 py-4 text-sm">
              <p className="mobile-text-secondary leading-relaxed">
                This plan will begin on <span className="font-semibold text-[color:var(--ink-strong)]">{formatDate(formData.startDate)}</span> and is currently shaping a
                <span className="font-semibold text-[color:var(--ink-strong)]"> {tenureDays || 0}-day </span>
                collection runway.
              </p>
            </div>
          </div>
        </section>

        {!kycReady ? (
          <section className="mobile-panel px-4 py-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="mobile-section-label">Special permission</p>
                <h3 className="mobile-text-primary mt-1 text-[1rem] font-semibold">Unverified KYC request</h3>
              </div>
              <ShieldAlert size={18} className="text-amber-700 dark:text-amber-300" />
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handleToggle(false)}
                className={`rounded-[20px] border px-4 py-4 text-left ${!formData.allowUnverifiedKyc ? "border-[color:var(--accent-strong)] bg-[color:var(--accent-strong)] text-white" : "mobile-surface-subtle mobile-text-primary border-[color:var(--line-soft)]"}`}
              >
                <p className={`text-[10px] uppercase tracking-[0.16em] ${!formData.allowUnverifiedKyc ? "text-white/60" : "mobile-text-tertiary"}`}>Hold request</p>
                <p className="mt-2 text-sm font-semibold">Wait for KYC update</p>
              </button>
              <button
                type="button"
                onClick={() => handleToggle(true)}
                className={`rounded-[20px] border px-4 py-4 text-left ${formData.allowUnverifiedKyc ? "border-[color:var(--accent-strong)] bg-[color:var(--accent-strong)] text-white" : "mobile-surface-subtle mobile-text-primary border-[color:var(--line-soft)]"}`}
              >
                <p className={`text-[10px] uppercase tracking-[0.16em] ${formData.allowUnverifiedKyc ? "text-white/60" : "mobile-text-tertiary"}`}>Send anyway</p>
                <p className="mt-2 text-sm font-semibold">Ask creditor permission</p>
              </button>
            </div>

            {formData.allowUnverifiedKyc ? (
              <Field label="Why should this proposal still be reviewed?" className="mt-4">
                <textarea
                  name="specialPermissionNote"
                  value={formData.specialPermissionNote}
                  onChange={handleChange}
                  rows={4}
                  placeholder="Example: Live verification is scheduled tomorrow, but the borrower needs a same-day approval decision."
                  className="mobile-input min-h-[120px] resize-none"
                  required
                />
              </Field>
            ) : null}
          </section>
        ) : null}

        <section className="mobile-panel px-4 py-4">
          <p className="mobile-section-label">Collector note</p>
          <Field label="Context for the creditor" className="mt-4">
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              rows={4}
              placeholder="Add field observations, income rhythm, or anything helpful before approval."
              className="mobile-input min-h-[120px] resize-none"
            />
          </Field>
        </section>

        <section className="mobile-panel px-4 py-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="mobile-section-label">Submit request</p>
              <h3 className="mobile-text-primary mt-1 text-[1rem] font-semibold">Send to creditor approval</h3>
              <p className="mobile-text-secondary mt-2 text-sm leading-relaxed">
                The collector identity, repayment structure, and any KYC exception note will travel with this proposal automatically.
              </p>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-[12px] bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/14 dark:text-emerald-300">
              <CheckCircle2 size={18} />
            </div>
          </div>

          <div className="mobile-inline-surface mt-5 px-4 py-4">
            <p className="mobile-text-tertiary text-[10px] uppercase tracking-[0.16em]">Proposal snapshot</p>
            <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="mobile-text-secondary">Total repayable</p>
                <p className="mobile-text-primary mt-1 font-semibold">{formatCurrency(summary.totalAmount, currency)}</p>
              </div>
              <div>
                <p className="mobile-text-secondary">Daily pay</p>
                <p className="mobile-text-primary mt-1 font-semibold">{formatCurrency(summary.dailyInstallment, currency)}</p>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={!canSubmit}
            className="mobile-inline-action mt-5 w-full justify-center disabled:opacity-45"
          >
            {submitting ? <LoaderCircle size={16} className="animate-spin" /> : <CreditCard size={16} />}
            Submit loan proposal
          </button>
        </section>
      </form>

      {(context.recentLoans || []).length > 0 ? (
        <section className="mobile-panel px-4 py-4">
          <p className="mobile-section-label">Recent loan history</p>
          <div className="mt-4 space-y-3">
            {(context.recentLoans || []).slice(0, 4).map((loan) => (
              <div key={loan.id} className="mobile-panel-strong px-4 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="mobile-text-primary text-sm font-semibold">{loan.loanNumber}</p>
                    <p className="mobile-text-secondary mt-1 text-xs">{formatDate(loan.createdAt)}</p>
                  </div>
                  <span className="mobile-soft-badge capitalize">{statusLabel(loan.status)}</span>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="mobile-text-tertiary text-[10px] uppercase tracking-[0.16em]">Total</p>
                    <p className="mobile-text-primary mt-1 font-semibold">{formatCurrency(loan.totalAmount, currency)}</p>
                  </div>
                  <div>
                    <p className="mobile-text-tertiary text-[10px] uppercase tracking-[0.16em]">Daily pay</p>
                    <p className="mobile-text-primary mt-1 font-semibold">{formatCurrency(loan.dailyInstallment, currency)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block space-y-2 ${className}`}>
      <span className="mobile-text-primary text-sm font-semibold">{label}</span>
      {children}
    </label>
  );
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
    <div className="mobile-panel-strong px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="mobile-text-tertiary text-[11px] uppercase tracking-[0.18em]">{label}</p>
          <p className="mobile-text-primary mt-2 text-base font-semibold">{value}</p>
        </div>
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/10 dark:bg-emerald-500/14">
          {icon}
        </div>
      </div>
    </div>
  );
}

function StatusRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "success" | "warning";
}) {
  return (
    <div className="mobile-row">
      <div>
        <p className="mobile-text-tertiary text-[10px] uppercase tracking-[0.16em]">{label}</p>
        <p className="mobile-text-primary mt-1 text-sm font-semibold">{value}</p>
      </div>
      <span className={`rounded-full px-3 py-1 text-[11px] font-semibold ${tone === "success" ? "bg-emerald-500/12 text-emerald-900 dark:text-emerald-200" : "bg-amber-500/12 text-amber-900 dark:text-amber-200"}`}>
        {tone === "success" ? "Ready" : "Attention"}
      </span>
    </div>
  );
}
