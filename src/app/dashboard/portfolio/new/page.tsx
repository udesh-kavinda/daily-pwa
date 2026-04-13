"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCheck, LoaderCircle, Route, Send, UserRoundPlus } from "lucide-react";
import { fetchJson } from "@/lib/fetch-json";

type RequestContextResponse = {
  collector?: {
    id: string;
    employeeCode: string | null;
    assignedRoutes: number;
  } | null;
  routes: Array<{ id: string; name: string; area?: string | null }>;
};

type SubmitResponse = {
  ok: boolean;
  debtor: {
    id: string;
    first_name: string;
    last_name: string;
    approval_status: string;
  };
};

type BannerState = { tone: "success" | "warning" | "danger" | "info"; text: string } | null;

export default function NewDebtorRequestPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [context, setContext] = useState<RequestContextResponse | null>(null);
  const [banner, setBanner] = useState<BannerState>(null);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    portalEmail: "",
    address: "",
    idNumber: "",
    routeId: "",
    notes: "",
  });

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      try {
        const payload = await fetchJson<RequestContextResponse>("/api/mobile/debtors/request");
        if (!mounted) return;
        setContext(payload);
        setFormData((current) => (current.routeId || !payload.routes[0]?.id ? current : { ...current, routeId: payload.routes[0].id }));
      } catch (error: unknown) {
        if (!mounted) return;
        const message = error instanceof Error ? error.message : "Failed to load debtor request form";
        setBanner({ tone: "danger", text: message });
        setContext({ routes: [] });
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void load();
    return () => {
      mounted = false;
    };
  }, []);

  const selectedRoute = useMemo(
    () => context?.routes.find((route) => route.id === formData.routeId) || null,
    [context?.routes, formData.routeId],
  );

  const handleChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = event.target;
    setFormData((current) => ({ ...current, [name]: value }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      const response = await fetchJson<SubmitResponse>("/api/mobile/debtors/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      setBanner({
        tone: "success",
        text: `${response.debtor.first_name} ${response.debtor.last_name} was submitted for creditor approval.`,
      });

      setTimeout(() => {
        router.push(`/dashboard/portfolio/debtors/${response.debtor.id}`);
      }, 400);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to submit debtor request";
      setBanner({ tone: "danger", text: message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4 pb-4">
      <section className="mobile-panel-strong px-5 py-5">
        <Link href="/dashboard/portfolio" className="inline-flex items-center gap-2 text-sm font-semibold text-stone-600">
          <ArrowLeft size={16} />
          Back to debtors
        </Link>
        <p className="mt-4 text-[11px] uppercase tracking-[0.18em] text-emerald-700">Collector field request</p>
        <h2 className="mt-1 text-xl font-semibold text-[#14213d]">Request a new debtor record</h2>
        <p className="mt-2 text-sm leading-relaxed text-stone-600">
          Capture the borrower profile in the field, assign the best route, and submit it for creditor approval without leaving mobile.
        </p>
      </section>

      {banner ? (
        <section className={`mobile-panel px-4 py-4 ${banner.tone === "success" ? "border-emerald-700/12 bg-emerald-500/8" : banner.tone === "warning" ? "border-amber-700/12 bg-amber-500/10" : banner.tone === "danger" ? "border-rose-700/14 bg-rose-500/10" : "border-stone-900/8 bg-white/72"}`}>
          <p className="text-sm leading-relaxed text-stone-800">{banner.text}</p>
        </section>
      ) : null}

      {loading ? (
        <section className="mobile-panel px-5 py-6 text-center">
          <LoaderCircle size={22} className="mx-auto animate-spin text-emerald-700" />
          <p className="mt-3 text-sm text-stone-600">Loading request form...</p>
        </section>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <section className="mobile-panel px-5 py-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-stone-500">Submission summary</p>
                <h3 className="mt-1 text-lg font-semibold text-[#14213d]">What happens next</h3>
              </div>
              <UserRoundPlus size={18} className="text-stone-400" />
            </div>
            <div className="mt-4 grid gap-3">
              <div className="rounded-[22px] bg-white/72 px-4 py-4 text-sm text-stone-700">
                This request is automatically tied to your collector account and goes to the creditor as a pending approval.
              </div>
              <div className="rounded-[22px] bg-white/72 px-4 py-4 text-sm text-stone-700">
                The debtor remains inactive until the creditor approves the profile.
              </div>
            </div>
          </section>

          <section className="mobile-panel px-5 py-5">
            <p className="text-[11px] uppercase tracking-[0.18em] text-stone-500">Borrower profile</p>
            <div className="mt-4 grid gap-4">
              <Field label="First name">
                <input name="firstName" value={formData.firstName} onChange={handleChange} className="w-full rounded-[22px] border border-stone-900/10 bg-white/72 px-4 py-3 text-sm text-stone-900 outline-none" required />
              </Field>
              <Field label="Last name">
                <input name="lastName" value={formData.lastName} onChange={handleChange} className="w-full rounded-[22px] border border-stone-900/10 bg-white/72 px-4 py-3 text-sm text-stone-900 outline-none" required />
              </Field>
              <Field label="Phone">
                <input name="phone" value={formData.phone} onChange={handleChange} className="w-full rounded-[22px] border border-stone-900/10 bg-white/72 px-4 py-3 text-sm text-stone-900 outline-none" required />
              </Field>
              <Field label="Portal email (optional)">
                <input name="portalEmail" value={formData.portalEmail} onChange={handleChange} type="email" className="w-full rounded-[22px] border border-stone-900/10 bg-white/72 px-4 py-3 text-sm text-stone-900 outline-none" />
              </Field>
              <Field label="National ID (optional)">
                <input name="idNumber" value={formData.idNumber} onChange={handleChange} className="w-full rounded-[22px] border border-stone-900/10 bg-white/72 px-4 py-3 text-sm text-stone-900 outline-none" />
              </Field>
              <Field label="Address">
                <textarea name="address" value={formData.address} onChange={handleChange} rows={4} className="w-full rounded-[22px] border border-stone-900/10 bg-white/72 px-4 py-3 text-sm text-stone-900 outline-none" required />
              </Field>
            </div>
          </section>

          <section className="mobile-panel px-5 py-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-stone-500">Field assignment</p>
                <h3 className="mt-1 text-lg font-semibold text-[#14213d]">Route alignment</h3>
              </div>
              <Route size={18} className="text-stone-400" />
            </div>

            <div className="mt-4 grid gap-4">
              <Field label="Route">
                <select name="routeId" value={formData.routeId} onChange={handleChange} className="w-full rounded-[22px] border border-stone-900/10 bg-white/72 px-4 py-3 text-sm text-stone-900 outline-none">
                  <option value="">No route selected</option>
                  {(context?.routes || []).map((route) => (
                    <option key={route.id} value={route.id}>
                      {route.name}{route.area ? ` · ${route.area}` : ""}
                    </option>
                  ))}
                </select>
              </Field>
              <div className="rounded-[22px] bg-white/72 px-4 py-4 text-sm text-stone-700">
                {selectedRoute
                  ? `This request will be submitted into ${selectedRoute.name}${selectedRoute.area ? ` (${selectedRoute.area})` : ""}.`
                  : "You can leave route unassigned if the route should be decided during approval."}
              </div>
              <Field label="Field note (optional)">
                <textarea name="notes" value={formData.notes} onChange={handleChange} rows={4} className="w-full rounded-[22px] border border-stone-900/10 bg-white/72 px-4 py-3 text-sm text-stone-900 outline-none" placeholder="Anything the creditor should know before approval?" />
              </Field>
            </div>
          </section>

          <section className="mobile-panel-ink px-5 py-5 text-white">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-emerald-100/80">Submit request</p>
                <h3 className="mt-1 text-lg font-semibold">Ready for creditor review</h3>
                <p className="mt-2 text-sm text-white/72">
                  Your collector identity and timestamp will be attached automatically when this debtor request is sent.
                </p>
              </div>
              <CheckCheck size={18} className="text-white/70" />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#fff7eb] px-5 py-3 text-sm font-semibold text-[#14213d] disabled:opacity-45"
            >
              {submitting ? <LoaderCircle size={16} className="animate-spin" /> : <Send size={16} />}
              Submit debtor request
            </button>
          </section>
        </form>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-semibold text-[#14213d]">{label}</span>
      {children}
    </label>
  );
}
