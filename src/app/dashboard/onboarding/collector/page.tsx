"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, IdCard, Phone, UserRound } from "lucide-react";
import { fetchJson } from "@/lib/fetch-json";

type CollectorOnboardingResponse = {
  profile: {
    first_name: string;
    last_name: string;
    phone: string | null;
    email: string;
  } | null;
  collector: {
    employee_code?: string | null;
    assigned_routes?: string[] | null;
  } | null;
  organization: {
    name: string | null;
    ownerName: string | null;
    ownerEmail: string | null;
  } | null;
};

export default function CollectorOnboardingPage() {
  const router = useRouter();
  const [form, setForm] = useState({ first_name: "", last_name: "", phone: "" });
  const [meta, setMeta] = useState<CollectorOnboardingResponse | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    fetchJson<CollectorOnboardingResponse>("/api/onboarding/collector")
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
      const payload = await fetchJson<{ redirectTo?: string }>("/api/onboarding/collector", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      router.replace(payload.redirectTo || "/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to finish collector setup");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4 pb-4">
      <section className="mobile-panel-ink px-5 py-5 text-white">
        <p className="text-[11px] uppercase tracking-[0.18em] text-emerald-100/80">Collector onboarding</p>
        <h2 className="mobile-title mt-3 text-[2rem] leading-none">Join your Daily+ organization</h2>
        <p className="mt-3 text-sm text-white/72">
          Review the details shared by your creditor and finish your field profile before entering the mobile workspace.
        </p>
      </section>

      <section className="mobile-panel px-5 py-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-[24px] bg-white/70 px-4 py-4">
            <p className="text-[11px] uppercase tracking-[0.16em] text-stone-500">Organization</p>
            <p className="mt-2 text-lg font-semibold text-[#14213d]">{meta?.organization?.name || "Loading workspace"}</p>
            <p className="mt-1 text-sm text-stone-600">{meta?.organization?.ownerName || meta?.organization?.ownerEmail || "Daily+ creditor"}</p>
          </div>
          <div className="rounded-[24px] bg-stone-900/[0.04] px-4 py-4">
            <p className="text-[11px] uppercase tracking-[0.16em] text-stone-500">Field profile</p>
            <p className="mt-2 text-lg font-semibold text-[#14213d]">{meta?.collector?.employee_code || "Pending code"}</p>
            <p className="mt-1 text-sm text-stone-600">{Array.isArray(meta?.collector?.assigned_routes) ? `${meta?.collector?.assigned_routes.length} assigned routes` : "Route plan will appear in mobile"}</p>
          </div>
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
              <IdCard size={18} className="text-stone-400" />
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
            {saving ? "Saving profile..." : "Enter mobile workspace"}
            <ArrowRight size={18} />
          </button>
        </form>
      </section>
    </div>
  );
}
