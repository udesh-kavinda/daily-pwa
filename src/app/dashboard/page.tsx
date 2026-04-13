"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, CalendarClock, ShieldCheck, Wallet, Waves } from "lucide-react";
import { StatusPill } from "@/components/status-pill";
import { useUserStore } from "@/store/user-store";
import { activityFeed, getRoleLabel, heroCopy, homeMetrics, workQueue } from "@/lib/mobile-demo-data";
import { fetchJson } from "@/lib/fetch-json";
import type { MobileRole } from "@/lib/mobile-demo-data";
import { getMobilePrimaryActionPath, getMobileSecondaryActionPath, normalizeMobileRole } from "@/lib/mobile-route-access";

type OverviewResponse = {
  role: MobileRole;
  organization?: { name: string | null } | null;
  overview: {
    hero: {
      eyebrow: string;
      title: string;
      summary: string;
      primaryAction: string;
      secondaryAction: string;
    };
    metrics: Array<{
      label: string;
      value: number;
      displayValue: string;
      change: string;
      tone: "emerald" | "amber" | "ink";
    }>;
    focus: Array<{
      title: string;
      subtitle: string;
      amount: number;
      displayValue: string;
      status: string;
      tone: "emerald" | "amber" | "ink";
    }>;
    activity: Array<{
      title: string;
      detail: string;
      time: string;
    }>;
  };
};

export default function DashboardPage() {
  const { role } = useUserStore();
  const activeRole: MobileRole = normalizeMobileRole(role);
  const [liveData, setLiveData] = useState<OverviewResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        const payload = await fetchJson<OverviewResponse>("/api/mobile/overview");
        if (!mounted) return;
        setLiveData(payload);
        setUnavailable(false);
      } catch {
        if (!mounted) return;
        setUnavailable(true);
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    load();

    return () => {
      mounted = false;
    };
  }, []);

  const fallbackHero = heroCopy[activeRole];
  const fallbackMetrics = homeMetrics[activeRole].map((item) => ({
    label: item.label,
    value: Number(String(item.value).replace(/[^\d.-]/g, "")) || 0,
    displayValue: item.value,
    change: item.change,
    tone: item.tone,
  }));
  const fallbackFocus = workQueue[activeRole].map((item) => ({
    title: item.title,
    subtitle: item.subtitle,
    amount: Number(String(item.amount).replace(/[^\d.-]/g, "")) || 0,
    displayValue: item.amount,
    status: item.status,
    tone: item.tone,
  }));
  const fallbackActivity = activityFeed[activeRole];

  const hero = liveData?.overview.hero || fallbackHero;
  const metrics = liveData?.overview.metrics || fallbackMetrics;
  const focus = liveData?.overview.focus || fallbackFocus;
  const activity = liveData?.overview.activity || fallbackActivity;
  const primaryActionHref = getMobilePrimaryActionPath(role);
  const secondaryActionHref = getMobileSecondaryActionPath(role);

  const heroIcon = useMemo(() => {
    if (activeRole === "creditor") return <ShieldCheck size={22} />;
    if (activeRole === "debtor") return <CalendarClock size={22} />;
    return <Wallet size={22} />;
  }, [activeRole]);

  return (
    <div className="space-y-4 pb-4">
      {unavailable ? (
        <section className="mobile-panel border border-amber-400/40 bg-amber-50 px-4 py-4 text-sm text-amber-900">
          Live backend data is temporarily unavailable. The mobile shell is still here, but some values are falling back to preview content.
        </section>
      ) : null}

      <section className="mobile-panel-ink px-5 py-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <span className="mobile-kicker bg-white/10 text-emerald-100">{hero.eyebrow}</span>
            <h2 className="mobile-title mt-4 text-[2rem] leading-[0.94] text-white">{hero.title}</h2>
            <p className="mt-3 text-sm leading-relaxed text-white/72">{hero.summary}</p>
          </div>
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-white">
            {heroIcon}
          </div>
        </div>

        <div className="mt-5 flex gap-3 overflow-x-auto pb-1 soft-scroll">
          <Link href={primaryActionHref} className="shrink-0 rounded-full bg-[#fff7eb] px-4 py-3 text-sm font-semibold text-[#14213d]">
            {hero.primaryAction}
          </Link>
          <Link href={secondaryActionHref} className="shrink-0 rounded-full border border-white/12 px-4 py-3 text-sm font-semibold text-white/90">
            {hero.secondaryAction}
          </Link>
        </div>
      </section>

      <section className="grid gap-3">
        {isLoading && !liveData
          ? Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="mobile-panel h-[108px] animate-pulse bg-white/70" />
            ))
          : metrics.map((metric) => (
              <div key={metric.label} className={`mobile-panel px-4 py-4 ${metric.tone === "emerald" ? "metric-emerald" : metric.tone === "amber" ? "metric-amber" : "metric-ink"}`}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.18em] text-stone-500">{metric.label}</p>
                    <p className="mt-2 text-[1.7rem] font-semibold leading-none text-[#14213d]">{metric.displayValue}</p>
                  </div>
                  <StatusPill label={metric.change} tone={metric.tone === "ink" ? "ink" : metric.tone} />
                </div>
              </div>
            ))}
      </section>

      <section className="mobile-panel px-5 py-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-stone-500">Active focus</p>
            <h3 className="mt-1 text-lg font-semibold text-[#14213d]">{getRoleLabel(activeRole)} priorities</h3>
          </div>
          <StatusPill label="Live" tone="slate" />
        </div>

        <div className="mt-4 space-y-3">
          {focus.map((task) => (
            <div key={task.title} className="rounded-[24px] border border-stone-900/8 bg-white/70 px-4 py-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h4 className="text-sm font-semibold text-[#14213d]">{task.title}</h4>
                  <p className="mt-1 text-sm leading-relaxed text-stone-600">{task.subtitle}</p>
                </div>
                <StatusPill tone={task.tone} label={task.status} />
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-stone-900/6 pt-3">
                <span className="text-[11px] uppercase tracking-[0.16em] text-stone-500">Value</span>
                <span className="text-base font-semibold text-[#14213d]">{task.displayValue}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mobile-panel px-5 py-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-stone-500">Live feed</p>
            <h3 className="mt-1 text-lg font-semibold text-[#14213d]">Operational updates</h3>
          </div>
          <Waves size={18} className="text-emerald-700" />
        </div>

        <div className="mt-4 space-y-4">
          {activity.map((item) => (
            <div key={`${item.title}-${item.time}`} className="relative pl-5">
              <span className="absolute left-0 top-1.5 h-2.5 w-2.5 rounded-full bg-emerald-600" />
              <p className="text-sm font-semibold text-[#14213d]">{item.title}</p>
              <p className="mt-1 text-sm leading-relaxed text-stone-600">{item.detail}</p>
              <p className="mt-1 text-[11px] uppercase tracking-[0.16em] text-stone-500">{item.time}</p>
            </div>
          ))}
        </div>

        <Link href="/dashboard/portfolio" className="mt-5 flex items-center justify-between rounded-[22px] bg-stone-900 px-4 py-4 text-sm font-semibold text-white">
          Open detailed portfolio
          <ArrowRight size={18} />
        </Link>
      </section>
    </div>
  );
}
