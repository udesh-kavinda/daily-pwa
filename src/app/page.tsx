import Link from "next/link";
import { ArrowRight, BellRing, MapPinned, ShieldCheck, Sparkles, WalletCards } from "lucide-react";

const pillars = [
  {
    title: "Collector-first journeys",
    description: "Route work, capture, settlement, and debtor context designed for one-hand use in the field.",
    icon: MapPinned,
  },
  {
    title: "Creditor approvals without clutter",
    description: "Fast decision-making on debtor requests, loan proposals, and settlement anomalies from a mobile command layer.",
    icon: ShieldCheck,
  },
  {
    title: "Debtor clarity and trust",
    description: "A calmer repayment experience that shows collector identity, dues, next visit timing, and total remaining.",
    icon: WalletCards,
  },
];

export default function HomePage() {
  return (
    <main className="min-h-screen px-4 py-6 text-stone-900 sm:px-6">
      <div className="mobile-shell space-y-6">
        <header className="mobile-panel-strong px-5 py-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#14213d] text-sm font-bold text-white">
                D+
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-700">Daily+ Mobile</p>
                <p className="text-sm text-stone-600">Premium field finance experience</p>
              </div>
            </div>
            <div className="rounded-full border border-stone-900/10 bg-white/70 px-3 py-2 text-[11px] font-semibold text-stone-700">
              PWA Ready
            </div>
          </div>
        </header>

        <section className="mobile-panel-ink overflow-hidden px-5 py-6">
          <div className="space-y-5">
            <span className="mobile-kicker bg-white/10 text-emerald-100">New mobile product</span>
            <div>
              <h1 className="mobile-title text-[2.65rem] leading-[0.92] text-white">
                A mobile lending experience that feels human, not administrative.
              </h1>
              <p className="mt-4 max-w-sm text-sm leading-relaxed text-white/75">
                Separate from the admin portal, powered by the same backend. Built for collectors, debtors, and fast-moving creditor approvals.
              </p>
            </div>

            <div className="grid gap-3">
              <Link
                href="/dashboard"
                className="flex items-center justify-between rounded-[24px] bg-[#fff8ef] px-4 py-4 text-sm font-semibold text-[#14213d]"
              >
                Open mobile workspace
                <ArrowRight size={18} />
              </Link>
              <div className="grid grid-cols-2 gap-3">
                <Link
                  href="/sign-in"
                  className="flex items-center justify-center rounded-[24px] border border-white/12 px-4 py-4 text-sm font-semibold text-white/90"
                >
                  Sign in
                </Link>
                <Link
                  href="/sign-up"
                  className="flex items-center justify-center rounded-[24px] bg-emerald-400/16 px-4 py-4 text-sm font-semibold text-emerald-100"
                >
                  Create account
                </Link>
              </div>
              <Link
                href="/collector"
                className="flex items-center justify-between rounded-[24px] border border-white/12 px-4 py-4 text-sm font-semibold text-white/90"
              >
                Try capture flow
                <ArrowRight size={18} />
              </Link>
            </div>
          </div>

          <div className="mt-8 rounded-[28px] bg-white/10 p-4">
            <div className="flex items-center justify-between text-xs text-white/70">
              <span>Today’s field pulse</span>
              <span className="rounded-full bg-emerald-400/18 px-2.5 py-1 text-emerald-100">Live sync</span>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-3">
              {[
                { label: "Routes", value: "06" },
                { label: "Captured", value: "94" },
                { label: "Queue", value: "07" },
              ].map((item) => (
                <div key={item.label} className="rounded-[22px] bg-white/10 px-3 py-3 text-center">
                  <p className="text-xl font-semibold text-white">{item.value}</p>
                  <p className="mt-1 text-[11px] uppercase tracking-[0.16em] text-white/55">{item.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-4">
          {pillars.map((pillar) => {
            const Icon = pillar.icon;
            return (
              <div key={pillar.title} className="mobile-panel px-5 py-5">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-700">
                    <Icon size={22} />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-[#14213d]">{pillar.title}</h2>
                    <p className="mt-2 text-sm leading-relaxed text-stone-600">{pillar.description}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </section>

        <section className="mobile-panel-strong px-5 py-5">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-400/16 text-amber-700">
              <BellRing size={20} />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-stone-500">Shared backend</p>
              <h3 className="mt-1 text-lg font-semibold text-[#14213d]">Same business logic. Different mobile UX.</h3>
              <p className="mt-2 text-sm leading-relaxed text-stone-600">
                This mobile product is intended to run against the same Clerk and Supabase systems as the main Daily+ admin app, while delivering an experience designed specifically for phones.
              </p>
            </div>
          </div>
        </section>

        <section className="mobile-panel px-5 py-5">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#14213d] text-white">
              <Sparkles size={20} />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-[#14213d]">Design direction</h3>
              <p className="mt-2 text-sm leading-relaxed text-stone-600">
                Warm editorial surfaces, bold hierarchy, oversized touch targets, and reduced interface noise. This app should feel calm, premium, and operationally sharp.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
