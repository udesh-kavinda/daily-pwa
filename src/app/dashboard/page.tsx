"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, CalendarClock, FolderKanban, Route, ShieldCheck, Users, Wallet, Waves } from "lucide-react";
import { StatusPill } from "@/components/status-pill";
import { useUserStore } from "@/store/user-store";
import { activityFeed, getRoleLabel, heroCopy, homeMetrics, workQueue } from "@/lib/mobile-demo-data";
import { fetchJson } from "@/lib/fetch-json";
import type { MobileRole } from "@/lib/mobile-demo-data";
import { normalizeMobileRole } from "@/lib/mobile-route-access";

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

  const heroIcon = useMemo(() => {
    if (activeRole === "creditor") return <ShieldCheck size={22} />;
    if (activeRole === "debtor") return <CalendarClock size={22} />;
    return <Wallet size={22} />;
  }, [activeRole]);

  const sections = useMemo(() => {
    if (activeRole === "creditor") {
      return [
        { href: "/dashboard/work", title: "Approvals", detail: "Review debtor and loan requests", icon: ShieldCheck },
        { href: "/dashboard/debtors", title: "Debtors", detail: "Open borrower list", icon: FolderKanban },
        { href: "/dashboard/loans", title: "Loans", detail: "Open loan table", icon: Wallet },
        { href: "/dashboard/routes", title: "Routes", detail: "Review coverage and assignments", icon: Route },
        { href: "/dashboard/collectors", title: "Collectors", detail: "Open field team list", icon: Users },
      ];
    }

    if (activeRole === "collector") {
      return [
        { href: "/dashboard/work", title: "Routes", detail: "Open today’s route sequence", icon: Route },
        { href: "/dashboard/debtors", title: "Debtors", detail: "Open assigned debtor list", icon: FolderKanban },
        { href: "/collector", title: "Capture", detail: "Record a field collection", icon: Wallet },
      ];
    }

    return [
      { href: "/dashboard/work", title: "Schedule", detail: "See upcoming repayment activity", icon: CalendarClock },
      { href: "/dashboard/loans", title: "Loans", detail: "Open your loan table", icon: Wallet },
      { href: "/dashboard/notifications", title: "Alerts", detail: "See reminders and notices", icon: ShieldCheck },
    ];
  }, [activeRole]);

  return (
    <div className="space-y-3 pb-4">
      {unavailable ? (
        <section className="mobile-panel border border-amber-300/60 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Live data is temporarily unavailable, so some values are showing fallback content.
        </section>
      ) : null}

      <section className="grid grid-cols-2 gap-2.5">
        {isLoading && !liveData
          ? Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="mobile-panel h-[88px] animate-pulse bg-white/70" />
            ))
          : metrics.map((metric) => (
              <div key={metric.label} className={`mobile-stat-tile ${metric.tone === "emerald" ? "metric-emerald" : metric.tone === "amber" ? "metric-amber" : "metric-ink"}`}>
                <p className="mobile-text-tertiary text-[10px] uppercase tracking-[0.16em]">{metric.label}</p>
                <p className="mobile-text-primary mt-1.5 text-[1.1rem] font-semibold leading-tight">{metric.displayValue}</p>
                <p className="mobile-text-secondary mt-1.5 text-[11px] leading-snug">{metric.change}</p>
              </div>
            ))}
      </section>

      <section className="mobile-panel px-4 py-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="mobile-section-label">Quick access</p>
            <h3 className="mobile-text-primary mt-1 text-[1rem] font-semibold">{getRoleLabel(activeRole)} sections</h3>
          </div>
          <div className="flex h-9 w-9 items-center justify-center rounded-[14px] bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/14 dark:text-emerald-300">
            {heroIcon}
          </div>
        </div>

        <div className="mobile-compact-list mt-3">
          {sections.map((section) => {
            const Icon = section.icon;
            return (
              <Link key={section.href} href={section.href} className="mobile-row">
                <div className="flex items-center gap-3">
                  <div className="mobile-icon-surface flex h-10 w-10 items-center justify-center rounded-[12px]">
                    <Icon size={18} />
                  </div>
                  <div>
                    <p className="mobile-text-primary text-sm font-semibold">{section.title}</p>
                    <p className="mobile-text-secondary mt-1 text-[13px]">{section.detail}</p>
                  </div>
                </div>
                <ArrowRight size={16} className="mobile-text-tertiary shrink-0" />
              </Link>
            );
          })}
        </div>
      </section>

      <section className="mobile-panel px-4 py-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="mobile-section-label">Active focus</p>
            <h3 className="mobile-text-primary mt-1 text-[1rem] font-semibold">{hero.eyebrow}</h3>
          </div>
          <StatusPill label="Live" tone="slate" />
        </div>

        <div className="mobile-compact-list mt-3">
          {focus.map((task) => (
            <div key={task.title} className="mobile-row block">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h4 className="mobile-text-primary text-sm font-semibold">{task.title}</h4>
                  <p className="mobile-text-secondary mt-1 text-[13px] leading-relaxed">{task.subtitle}</p>
                </div>
                <StatusPill tone={task.tone} label={task.status} />
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-slate-900/6 pt-3">
                <span className="mobile-text-tertiary text-[11px] uppercase tracking-[0.16em]">Current value</span>
                <span className="mobile-text-primary text-sm font-semibold">{task.displayValue}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mobile-panel px-4 py-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="mobile-section-label">Live feed</p>
            <h3 className="mobile-text-primary mt-1 text-[1rem] font-semibold">Operational updates</h3>
          </div>
          <Waves size={18} className="text-emerald-700" />
        </div>

        <div className="mobile-compact-list mt-3">
          {activity.map((item) => (
            <div key={`${item.title}-${item.time}`} className="mobile-row block">
              <div className="flex items-start justify-between gap-3">
                <p className="mobile-text-primary text-sm font-semibold">{item.title}</p>
                <span className="mobile-text-tertiary text-[11px] uppercase tracking-[0.16em]">{item.time}</span>
              </div>
              <p className="mobile-text-secondary mt-1 text-[13px] leading-relaxed">{item.detail}</p>
            </div>
          ))}
        </div>

        <Link href="/dashboard/portfolio" className="mobile-solid-surface mt-4 flex items-center justify-between rounded-[14px] px-4 py-3 text-sm font-semibold">
          Open detailed portfolio
          <ArrowRight size={18} />
        </Link>
      </section>
    </div>
  );
}
