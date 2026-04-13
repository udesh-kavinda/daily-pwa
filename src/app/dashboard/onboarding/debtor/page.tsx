"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Phone, UserRound, WalletCards } from "lucide-react";
import { fetchJson } from "@/lib/fetch-json";
import { formatLkr } from "@/lib/mobile-demo-data";

type DebtorOnboardingResponse = {
  profile: {
    first_name: string;
    last_name: string;
    phone: string | null;
    email: string;
  } | null;
  organizations: Array<{ id: string; name: string | null }>;
  summary: {
    activeLoans?: number;
    totalOutstanding?: number;
    estimated30DayCommitment?: number;
  } | null;
};

export default function DebtorOnboardingPage() {
  const router = useRouter();
  const [form, setForm] = useState({ first_name: "", last_name: "", phone: "" });
  const [meta, setMeta] = useState<DebtorOnboardingResponse | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    fetchJson<DebtorOnboardingResponse>("/api/onboarding/debtor")
      .then((payload) => {
        if (!mounted) return;
        setMeta(payload);
        setForm({
          first_name: payload.profile?.first_name || "",
          last_name: payload.profile?.last_name || "",
          phone: payload.profile?.phone || "",
        });
      })
      .catch((err) => {
        if (mounted) setError(err instanceof Error ? err.message : "Failed to load onboarding");
      });

    return () => {
      mounted = false;
    };
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const payload = await fetchJson<{ redirectTo?: string }>("/api/onboarding/debtor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      router.replace(payload.redirectTo || "/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to finish portal setup");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4 pb-4">
      <section className="mobile-panel-ink px-5 py-5 text-white">
        <p className="text-[11px] uppercase tracking-[0.18em] text-emerald-100/80">Debtor portal</p>
        <h2 className="mobile-title mt-3 text-[2rem] leading-none">Bring every loan into one clear place</h2>
        <p className="mt-3 text-sm text-white/72">
          Confirm your details and open a simple view of who you owe, who visits, what is expected next, and what is still left to repay.
        </p>
      </section>

      <section className="mobile-panel px-5 py-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-[24px] bg-white/70 px-4 py-4">
            <p className="text-[11px] uppercase tracking-[0.16em] text-stone-500">Lenders linked</p>
            <p className="mt-2 text-lg font-semibold text-[#14213d]">{meta?.organizations.length || 0}</p>
            <p className="mt-1 text-sm text-stone-600">{meta?.organizations.map((organization) => organization.name || "Organization").join(" · ") || "Linked lenders will appear here"}</p>
          </div>
          <div className="rounded-[24px] bg-stone-900/[0.04] px-4 py-4">
            <p className="text-[11px] uppercase tracking-[0.16em] text-stone-500">What is on record today</p>
            <p className="mt-2 text-lg font-semibold text-[#14213d]">{formatLkr(Number(meta?.summary?.totalOutstanding || 0))}</p>
            <p className="mt-1 text-sm text-stone-600">{meta?.summary?.activeLoans || 0} active loans · about {formatLkr(Number(meta?.summary?.estimated30DayCommitment || 0))} over the next 30 days</p>
          </div>
        </div>
      </section>

      <section className="mobile-panel px-5 py-5">
        <p className="text-[11px] uppercase tracking-[0.18em] text-stone-500">What you will see</p>
        <div className="mt-4 grid gap-3">
          <PreviewRow label="Your lenders" value="See each loan grouped by lender" />
          <PreviewRow label="Assigned collector" value="Know who is visiting and how to contact them" />
          <PreviewRow label="Next expected visit" value="See the next planned date and amount" />
          <PreviewRow label="What is left to repay" value="Track paid amounts and remaining balance" />
        </div>
      </section>

      <section className="mobile-panel px-5 py-5">
        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="grid gap-2 text-sm font-medium text-stone-700">
            First name
            <div className="flex items-center gap-3 rounded-[22px] border border-stone-900/10 bg-white/80 px-4 py-3.5">
              <UserRound size={18} className="text-stone-400" />
              <input value={form.first_name} onChange={(event) => setForm((current) => ({ ...current, first_name: event.target.value }))} className="w-full bg-transparent outline-none" />
            </div>
          </label>

          <label className="grid gap-2 text-sm font-medium text-stone-700">
            Last name
            <div className="flex items-center gap-3 rounded-[22px] border border-stone-900/10 bg-white/80 px-4 py-3.5">
              <WalletCards size={18} className="text-stone-400" />
              <input value={form.last_name} onChange={(event) => setForm((current) => ({ ...current, last_name: event.target.value }))} className="w-full bg-transparent outline-none" />
            </div>
          </label>

          <label className="grid gap-2 text-sm font-medium text-stone-700">
            Phone
            <div className="flex items-center gap-3 rounded-[22px] border border-stone-900/10 bg-white/80 px-4 py-3.5">
              <Phone size={18} className="text-stone-400" />
              <input value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} className="w-full bg-transparent outline-none" />
            </div>
          </label>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <button type="submit" disabled={saving} className="flex w-full items-center justify-center gap-2 rounded-[24px] bg-[#14213d] px-5 py-4 text-sm font-semibold text-white disabled:opacity-60">
            {saving ? "Saving profile..." : "Open my loans"}
            <ArrowRight size={18} />
          </button>
        </form>
      </section>
    </div>
  );
}

function PreviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-[22px] bg-white/72 px-4 py-4">
      <span className="text-sm text-stone-500">{label}</span>
      <span className="text-sm font-semibold text-[#14213d] text-right">{value}</span>
    </div>
  );
}
