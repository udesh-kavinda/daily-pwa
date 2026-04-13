"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { Bell, Building2, LoaderCircle } from "lucide-react";
import { EnsureUser } from "@/components/auth/ensure-user";
import { InstallBanner } from "@/components/install-banner";
import { BottomNav } from "@/components/bottom-nav";
import { useUserStore } from "@/store/user-store";
import { fetchJson } from "@/lib/fetch-json";
import { getRoleLabel } from "@/lib/mobile-demo-data";

const titleByPath: Record<string, { title: string; subtitle: string }> = {
  "/dashboard": { title: "Command center", subtitle: "A polished mobile layer on top of the Daily+ backend" },
  "/dashboard/work": { title: "Workstream", subtitle: "What needs attention next, with role-aware mobile clarity" },
  "/dashboard/notifications": { title: "Notifications", subtitle: "Alerts, approvals, reminders, and operational updates in one mobile inbox" },
  "/dashboard/portfolio": { title: "Portfolio", subtitle: "People, balances, and borrower relationships in motion" },
  "/dashboard/profile": { title: "Profile", subtitle: "Identity, organization context, and operational readiness" },
  "/dashboard/onboarding/collector": { title: "Collector setup", subtitle: "Confirm your details and join the organization" },
  "/dashboard/onboarding/debtor": { title: "Portal setup", subtitle: "Confirm your details and unlock your loan space" },
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { role, user, organization, isLoading } = useUserStore();
  const [unreadCount, setUnreadCount] = useState(0);

  const title = useMemo(() => {
    if (pathname === "/dashboard/portfolio/new") {
      return {
        title: "New debtor request",
        subtitle: "Capture a clean field profile and submit it for creditor approval",
      };
    }
    if (pathname.includes("/dashboard/portfolio/debtors/") && pathname.endsWith("/kyc")) {
      return {
        title: "KYC capture",
        subtitle: "Update debtor identity proof and field verification without leaving the mobile workflow",
      };
    }
    if (pathname.includes("/dashboard/portfolio/debtors/") && pathname.endsWith("/loan-request")) {
      return {
        title: "Loan proposal",
        subtitle: "Shape the repayment plan clearly before it reaches the creditor approval desk",
      };
    }
    if (pathname.startsWith("/dashboard/portfolio/debtors/")) {
      return {
        title: "Debtor detail",
        subtitle: "Assigned borrower context, loan exposure, and follow-up signals for the field team",
      };
    }
    if (pathname.startsWith("/dashboard/portfolio/") && pathname.endsWith("/history")) {
      return {
        title: "Repayment history",
        subtitle: "A clear mobile timeline of every scheduled and collected loan event",
      };
    }
    if (pathname.startsWith("/dashboard/portfolio/")) {
      return {
        title: "Loan detail",
        subtitle: "Collector, creditor, next due, and repayment progress in one mobile view",
      };
    }
    return titleByPath[pathname] || { title: "Daily+ Mobile", subtitle: "Field-ready finance experience" };
  }, [pathname]);

  const roleLabel = role ? getRoleLabel(role === "recovery_agent" ? "collector" : role) : "Workspace";
  const userName = `${user?.first_name || ""} ${user?.last_name || ""}`.trim() || "Daily+ member";

  useEffect(() => {
    let mounted = true;

    async function loadUnreadCount() {
      try {
        const payload = await fetchJson<{ unreadCount: number }>("/api/mobile/notifications?limit=20");
        if (mounted) {
          setUnreadCount(payload.unreadCount || 0);
        }
      } catch {
        if (mounted) {
          setUnreadCount(0);
        }
      }
    }

    void loadUnreadCount();
    const timer = window.setInterval(() => {
      void loadUnreadCount();
    }, 30000);

    return () => {
      mounted = false;
      window.clearInterval(timer);
    };
  }, [pathname]);

  return (
    <div className="min-h-screen pb-28 text-stone-900">
      <EnsureUser />
      <header className="sticky top-0 z-30 px-3 pb-4 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
        <div className="mobile-shell mobile-glass rounded-[30px] px-4 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-700">Daily+ Mobile</p>
              <h1 className="mobile-title mt-1 text-[1.75rem] leading-none text-[#14213d]">{title.title}</h1>
              <p className="mt-2 text-sm text-stone-600">{title.subtitle}</p>
            </div>
            <Link href="/dashboard/notifications" className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-stone-900/10 bg-white/70 text-stone-700">
              {isLoading ? <LoaderCircle size={18} className="animate-spin" /> : <Bell size={18} />}
              {unreadCount > 0 ? (
                <span className="absolute -right-1 -top-1 inline-flex min-h-[1.15rem] min-w-[1.15rem] items-center justify-center rounded-full bg-emerald-600 px-1 text-[10px] font-semibold text-white">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              ) : null}
            </Link>
          </div>

          <div className="mt-4 flex items-center justify-between rounded-2xl border border-stone-900/8 bg-white/60 px-3 py-3">
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-[0.18em] text-stone-500">Signed in as</p>
              <p className="truncate text-sm font-semibold text-stone-900">{userName}</p>
              <p className="truncate text-xs text-stone-500">{roleLabel}</p>
            </div>
            <div className="rounded-[20px] border border-stone-900/8 bg-[#fffdf8] px-3 py-2 text-right">
              <div className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-stone-500">
                <Building2 size={12} />
                Workspace
              </div>
              <p className="mt-1 max-w-[11rem] truncate text-sm font-semibold text-stone-900">
                {organization?.name || "Loading organization"}
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="mobile-shell px-3">{children}</main>
      <BottomNav />
      <InstallBanner />
    </div>
  );
}
