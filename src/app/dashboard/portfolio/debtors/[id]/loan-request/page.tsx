"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
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
import { DetailPageSkeleton } from "@/components/detail-page-skeleton";

type LoanRequestContext = {
  collector?: {
    id: string;
    employeeCode: string | null;
  } | null;
  organization?: {
    name: string;
    currency: string;
  } | null;
  debtor?: {
    id: string;
    name: string;
    phone: string | null;
    route?: { id?: string | null; name?: string | null; area?: string | null } | null;
    approvalStatus: string;
    isVerified: boolean;
    kyc: {
      idFront: boolean;
      photo: boolean;
      signature: boolean;
    };
  } | null;
  defaults?: {
    principalAmount: number;
    interestRate: number;
    tenureDays: number;
    startDate: string;
  };
  existing?: {
    totalLoans: number;
    pendingLoans: number;
  };
  flags?: {
    canSubmit: boolean;
    blocker: string | null;
    kycReady: boolean;
  };
  recentLoans?: Array<{
    id: string;
    loanNumber: string;
    status: string;
    totalAmount: number;
    dailyInstallment: number;
    createdAt: string;
  }>;
};

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

export default function CollectorLoanRequestPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const debtorId = params?.id;

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [context, setContext] = useState<LoanRequestContext | null>(null);
  const [banner, setBanner] = useState<BannerState>(null);
  const [formData, setFormData] = useState({
    principalAmount: "",
    interestRate: "",
    tenureDays: "",
    startDate: "",
    notes: "",
    allowUnverifiedKyc: false,
    specialPermissionNote: "",
  });

  useEffect(() => {
    let mounted = true;

    async function load() {
      if (!debtorId) return;
      setLoading(true);
      try {
        const payload = await fetchJson<LoanRequestContext>(`/api/mobile/loans/request?debtorId=${debtorId}`);
        if (!mounted) return;
        setContext(payload);
        setFormData({
          principalAmount: payload.defaults?.principalAmount ? String(payload.defaults.principalAmount) : "",
          interestRate: String(payload.defaults?.interestRate ?? 10),
          tenureDays: String(payload.defaults?.tenureDays ?? 30),
          startDate: payload.defaults?.startDate || new Date().toISOString().split("T")[0],
          notes: "",
          allowUnverifiedKyc: false,
          specialPermissionNote: "",
        });
        setBanner(payload.flags?.blocker ? { tone: "warning", text: payload.flags.blocker } : null);
      } catch (error: unknown) {
        if (!mounted) return;
        const message = error instanceof Error ? error.message : "Failed to load loan request form";
        setBanner({ tone: "danger", text: message });
        setContext(null);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void load();
    return () => {
      mounted = false;
    };
  }, [debtorId]);

  const principal = Number(formData.principalAmount || 0);
  const interestRate = Number(formData.interestRate || 0);
  const tenureDays = Number(formData.tenureDays || 0);
  const currency = context?.organization?.currency || "LKR";

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

  const canSubmit = Boolean(context?.flags?.canSubmit) && !submitting;
  const kycReady = Boolean(context?.flags?.kycReady);

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
    if (!debtorId) return;
    setSubmitting(true);
    try {
      const response = await fetchJson<LoanRequestSubmitResponse>("/api/mobile/loans/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          debtorId,
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
        router.push(`/dashboard/portfolio/debtors/${debtorId}`);
      }, 500);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to submit loan request";
      setBanner({ tone: "danger", text: message });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <DetailPageSkeleton title="Loading loan request flow" subtitle="Preparing debtor eligibility, KYC readiness, and proposal defaults." metrics={4} rows={4} />;
  }

  if (!context?.debtor) {
    return (
      <div className="space-y-4 pb-4">
        <section className="mobile-panel px-5 py-6 text-center">
          <p className="text-base font-semibold text-[#14213d]">Loan request is unavailable.</p>
          <p className="mt-2 text-sm leading-relaxed text-stone-600">{banner?.text || "This debtor could not be prepared for a mobile loan request."}</p>
          <Link href="/dashboard/portfolio" className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#14213d] px-4 py-3 text-sm font-semibold text-white">
            <ArrowLeft size={16} />
            Back to portfolio
          </Link>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-4">
      <section className="mobile-panel-ink px-5 py-5 text-white">
        <Link href={`/dashboard/portfolio/debtors/${debtorId}`} className="inline-flex items-center gap-2 text-sm font-semibold text-white/72">
          <ArrowLeft size={16} />
          Back to debtor detail
        </Link>

        <div className="mt-4 flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-emerald-100/80">Collector proposal</p>
            <h2 className="mt-1 text-[1.9rem] font-semibold">{context.debtor.name}</h2>
            <p className="mt-2 text-sm text-white/72">
              {context.organization?.name || "Daily+ Organization"}{context.debtor.route?.name ? ` · ${context.debtor.route.name}` : ""}
            </p>
          </div>
          <div className="rounded-[22px] border border-white/10 bg-white/8 px-3 py-2 text-right">
            <p className="text-[10px] uppercase tracking-[0.16em] text-white/58">Pending loan reviews</p>
            <p className="mt-1 text-xl font-semibold">{context.existing?.pendingLoans || 0}</p>
          </div>
        </div>

        <div className="mt-5 rounded-[22px] bg-white/10 px-4 py-4 text-sm text-white/78">
          Build the repayment shape in the field, then send it straight into the creditor approval inbox with the right context attached.
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
                : "border-stone-900/8 bg-white/72"
        }`}>
          <p className="text-sm leading-relaxed text-stone-800">{banner.text}</p>
        </section>
      ) : null}

      <section className="grid grid-cols-2 gap-3">
        <MetricCard label="Total repayable" value={formatCurrency(summary.totalAmount, currency)} icon={<CreditCard size={18} className="text-emerald-700" />} />
        <MetricCard label="Daily pay" value={formatCurrency(summary.dailyInstallment, currency)} icon={<CalendarClock size={18} className="text-emerald-700" />} />
        <MetricCard label="Interest" value={formatCurrency(summary.interestAmount, currency)} icon={<Sparkles size={18} className="text-emerald-700" />} />
        <MetricCard label="Existing loans" value={String(context.existing?.totalLoans || 0)} icon={<NotebookPen size={18} className="text-emerald-700" />} />
      </section>

      <section className="mobile-panel px-5 py-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-stone-500">Readiness</p>
            <h3 className="mt-1 text-lg font-semibold text-[#14213d]">Debtor and KYC signal</h3>
          </div>
          {kycReady ? <BadgeCheck size={18} className="text-emerald-700" /> : <ShieldAlert size={18} className="text-amber-700" />}
        </div>

        <div className="mt-4 grid gap-3">
          <StatusRow label="Debtor approval" value={statusLabel(context.debtor.approvalStatus)} tone={context.debtor.approvalStatus === "approved" ? "success" : "warning"} />
          <StatusRow label="ID front" value={context.debtor.kyc.idFront ? "Captured" : "Missing"} tone={context.debtor.kyc.idFront ? "success" : "warning"} />
          <StatusRow label="Photo" value={context.debtor.kyc.photo ? "Captured" : "Missing"} tone={context.debtor.kyc.photo ? "success" : "warning"} />
          <StatusRow label="Signature" value={context.debtor.kyc.signature ? "Captured" : "Missing"} tone={context.debtor.kyc.signature ? "success" : "warning"} />
        </div>

        <div className="mt-4 rounded-[22px] bg-white/72 px-4 py-4 text-sm text-stone-700">
          {kycReady
            ? "This debtor is verified enough for a standard loan proposal."
            : "KYC is incomplete. You can still ask the creditor to review the proposal, but add a short permission note so the reason is clear."}
        </div>
      </section>

      <form onSubmit={handleSubmit} className="space-y-4">
        <section className="mobile-panel px-5 py-5">
          <p className="text-[11px] uppercase tracking-[0.18em] text-stone-500">Proposal terms</p>
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
                className="w-full rounded-[22px] border border-stone-900/10 bg-white/72 px-4 py-3 text-sm text-stone-900 outline-none"
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
                  className="w-full rounded-[22px] border border-stone-900/10 bg-white/72 px-4 py-3 text-sm text-stone-900 outline-none"
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
                  className="w-full rounded-[22px] border border-stone-900/10 bg-white/72 px-4 py-3 text-sm text-stone-900 outline-none"
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
                className="w-full rounded-[22px] border border-stone-900/10 bg-white/72 px-4 py-3 text-sm text-stone-900 outline-none"
                required
              />
            </Field>
            <div className="rounded-[22px] bg-white/72 px-4 py-4 text-sm text-stone-700">
              This plan will begin on <span className="font-semibold text-[#14213d]">{formatDate(formData.startDate)}</span> and is currently shaping a
              <span className="font-semibold text-[#14213d]"> {tenureDays || 0}-day </span>
              collection runway.
            </div>
          </div>
        </section>

        {!kycReady ? (
          <section className="mobile-panel px-5 py-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-stone-500">Special permission</p>
                <h3 className="mt-1 text-lg font-semibold text-[#14213d]">Unverified KYC request</h3>
              </div>
              <ShieldAlert size={18} className="text-amber-700" />
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handleToggle(false)}
                className={`rounded-[22px] border px-4 py-4 text-left ${!formData.allowUnverifiedKyc ? "border-[#14213d] bg-[#14213d] text-white" : "border-stone-900/10 bg-white/72 text-stone-900"}`}
              >
                <p className={`text-[10px] uppercase tracking-[0.16em] ${!formData.allowUnverifiedKyc ? "text-white/60" : "text-stone-500"}`}>Hold request</p>
                <p className="mt-2 text-sm font-semibold">Wait for KYC update</p>
              </button>
              <button
                type="button"
                onClick={() => handleToggle(true)}
                className={`rounded-[22px] border px-4 py-4 text-left ${formData.allowUnverifiedKyc ? "border-[#14213d] bg-[#14213d] text-white" : "border-stone-900/10 bg-white/72 text-stone-900"}`}
              >
                <p className={`text-[10px] uppercase tracking-[0.16em] ${formData.allowUnverifiedKyc ? "text-white/60" : "text-stone-500"}`}>Send anyway</p>
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
                  className="w-full rounded-[22px] border border-stone-900/10 bg-white/72 px-4 py-3 text-sm text-stone-900 outline-none"
                  required
                />
              </Field>
            ) : null}
          </section>
        ) : null}

        <section className="mobile-panel px-5 py-5">
          <p className="text-[11px] uppercase tracking-[0.18em] text-stone-500">Collector note</p>
          <Field label="Context for the creditor" className="mt-4">
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              rows={4}
              placeholder="Add field observations, income rhythm, or anything helpful before approval."
              className="w-full rounded-[22px] border border-stone-900/10 bg-white/72 px-4 py-3 text-sm text-stone-900 outline-none"
            />
          </Field>
        </section>

        <section className="mobile-panel-ink px-5 py-5 text-white">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-emerald-100/80">Submit request</p>
              <h3 className="mt-1 text-lg font-semibold">Send to creditor approval</h3>
              <p className="mt-2 text-sm text-white/72">
                The collector identity, repayment structure, and any KYC exception note will travel with this proposal automatically.
              </p>
            </div>
            <CheckCircle2 size={18} className="text-white/70" />
          </div>

          <div className="mt-5 rounded-[22px] border border-white/10 bg-white/8 px-4 py-4">
            <p className="text-[10px] uppercase tracking-[0.16em] text-white/58">Proposal snapshot</p>
            <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-white/58">Total repayable</p>
                <p className="mt-1 font-semibold text-white">{formatCurrency(summary.totalAmount, currency)}</p>
              </div>
              <div>
                <p className="text-white/58">Daily pay</p>
                <p className="mt-1 font-semibold text-white">{formatCurrency(summary.dailyInstallment, currency)}</p>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={!canSubmit}
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#fff7eb] px-5 py-3 text-sm font-semibold text-[#14213d] disabled:opacity-45"
          >
            {submitting ? <LoaderCircle size={16} className="animate-spin" /> : <CreditCard size={16} />}
            Submit loan proposal
          </button>
        </section>
      </form>

      {(context.recentLoans || []).length > 0 ? (
        <section className="mobile-panel px-5 py-5">
          <p className="text-[11px] uppercase tracking-[0.18em] text-stone-500">Recent loan history</p>
          <div className="mt-4 space-y-3">
            {(context.recentLoans || []).slice(0, 4).map((loan) => (
              <div key={loan.id} className="rounded-[22px] border border-stone-900/8 bg-white/72 px-4 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-[#14213d]">{loan.loanNumber}</p>
                    <p className="mt-1 text-xs text-stone-500">{formatDate(loan.createdAt)}</p>
                  </div>
                  <span className="rounded-full bg-stone-900/6 px-3 py-1 text-[11px] font-semibold capitalize text-stone-700">
                    {statusLabel(loan.status)}
                  </span>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.16em] text-stone-500">Total</p>
                    <p className="mt-1 font-semibold text-[#14213d]">{formatCurrency(loan.totalAmount, currency)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.16em] text-stone-500">Daily pay</p>
                    <p className="mt-1 font-semibold text-[#14213d]">{formatCurrency(loan.dailyInstallment, currency)}</p>
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
      <span className="text-sm font-semibold text-[#14213d]">{label}</span>
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
    <div className="mobile-panel px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-stone-500">{label}</p>
          <p className="mt-2 text-base font-semibold text-[#14213d]">{value}</p>
        </div>
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/10">
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
    <div className="flex items-center justify-between rounded-[22px] bg-white/72 px-4 py-4 text-sm">
      <div>
        <p className="text-[10px] uppercase tracking-[0.16em] text-stone-500">{label}</p>
        <p className="mt-1 font-semibold text-[#14213d]">{value}</p>
      </div>
      <span className={`rounded-full px-3 py-1 text-[11px] font-semibold ${tone === "success" ? "bg-emerald-500/12 text-emerald-900" : "bg-amber-500/12 text-amber-900"}`}>
        {tone === "success" ? "Ready" : "Attention"}
      </span>
    </div>
  );
}
