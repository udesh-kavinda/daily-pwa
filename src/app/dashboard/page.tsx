import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { ArrowRight, CalendarClock, FolderKanban, Route, ShieldCheck, Users, Wallet, Waves } from "lucide-react";
import { StatusPill } from "@/components/status-pill";
import { activityFeed, getRoleLabel, heroCopy, homeMetrics, workQueue } from "@/lib/mobile-demo-data";
import type { MobileRole } from "@/lib/mobile-demo-data";
import { normalizeMobileRole } from "@/lib/mobile-route-access";
import { getAppSessionContextByClerkId } from "@/lib/auth/get-app-session-context";
import { loadMobileOverview } from "@/lib/mobile-data";

export default async function DashboardPage() {
  const { userId } = await auth();
  if (!userId) {
    redirect("/sign-in");
  }

  let activeRole: MobileRole = "collector";
  let liveData: Awaited<ReturnType<typeof loadMobileOverview>> | null = null;
  let unavailable = false;

  try {
    const session = await getAppSessionContextByClerkId(userId);
    activeRole = normalizeMobileRole(session.role);
    liveData = await loadMobileOverview(session);
  } catch {
    unavailable = true;
  }

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

  const heroIcon = activeRole === "creditor"
    ? <ShieldCheck size={22} />
    : activeRole === "debtor"
      ? <CalendarClock size={22} />
      : <Wallet size={22} />;

  const sections = activeRole === "creditor"
    ? [
        { href: "/dashboard/work", title: "Approvals", detail: "Review debtor and loan requests", icon: ShieldCheck },
        { href: "/dashboard/debtors", title: "Debtors", detail: "Open borrower list", icon: FolderKanban },
        { href: "/dashboard/loans", title: "Loans", detail: "Open loan table", icon: Wallet },
        { href: "/dashboard/routes", title: "Routes", detail: "Review coverage and assignments", icon: Route },
        { href: "/dashboard/collectors", title: "Collectors", detail: "Open field team list", icon: Users },
      ]
    : activeRole === "collector"
      ? [
          { href: "/dashboard/work", title: "Routes", detail: "Open today’s route sequence", icon: Route },
          { href: "/dashboard/debtors", title: "Debtors", detail: "Open assigned debtor list", icon: FolderKanban },
          { href: "/collector", title: "Capture", detail: "Record a field collection", icon: Wallet },
        ]
      : [
          { href: "/dashboard/work", title: "Schedule", detail: "See upcoming repayment activity", icon: CalendarClock },
          { href: "/dashboard/loans", title: "Loans", detail: "Open your loan table", icon: Wallet },
          { href: "/dashboard/notifications", title: "Alerts", detail: "See reminders and notices", icon: ShieldCheck },
        ];

  return (
    <div className="space-y-3 pb-4">
      {unavailable ? (
        <section className="mobile-panel border border-amber-300/60 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Live data is temporarily unavailable, so some values are showing fallback content.
        </section>
      ) : null}

      <section className="grid grid-cols-2 gap-2.5">
        {metrics.map((metric) => (
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
