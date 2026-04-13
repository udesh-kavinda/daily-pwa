"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { Bell, LoaderCircle } from "lucide-react";
import { EnsureUser } from "@/components/auth/ensure-user";
import { InstallBanner } from "@/components/install-banner";
import { BottomNav } from "@/components/bottom-nav";
import { useUserStore } from "@/store/user-store";
import { fetchJson } from "@/lib/fetch-json";

const titleByPath: Record<string, { title: string; subtitle: string }> = {
  "/dashboard": { title: "Overview", subtitle: "Today’s essentials" },
  "/dashboard/work": { title: "Work", subtitle: "What needs action next" },
  "/dashboard/notifications": { title: "Notifications", subtitle: "Alerts and reminders" },
  "/dashboard/portfolio": { title: "Records", subtitle: "Open the section you need" },
  "/dashboard/debtors": { title: "Debtors", subtitle: "Borrower list" },
  "/dashboard/loans": { title: "Loans", subtitle: "Loan list" },
  "/dashboard/routes": { title: "Routes", subtitle: "Route list" },
  "/dashboard/collectors": { title: "Collectors", subtitle: "Field team list" },
  "/dashboard/profile": { title: "Profile", subtitle: "Account and workspace" },
  "/dashboard/onboarding/collector": { title: "Collector setup", subtitle: "Confirm your details" },
  "/dashboard/onboarding/debtor": { title: "Portal setup", subtitle: "Confirm your details" },
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { isLoading } = useUserStore();
  const [unreadCount, setUnreadCount] = useState(0);

  const title = useMemo(() => {
    if (pathname === "/dashboard/portfolio/new") {
      return {
        title: "New debtor request",
        subtitle: "Capture a clean field profile and submit it for creditor approval",
      };
    }
    if (pathname.startsWith("/dashboard/collectors/")) {
      return {
        title: "Collector detail",
        subtitle: "Field team profile, assignment summary, and route coverage",
      };
    }
    if (pathname.startsWith("/dashboard/routes/")) {
      return {
        title: "Route detail",
        subtitle: "Coverage, assigned collector, and debtors mapped to this route",
      };
    }
    if (pathname.startsWith("/dashboard/loans/")) {
      return {
        title: "Loan detail",
        subtitle: "Balance, repayment activity, and who is managing the loan",
      };
    }
    if (pathname.startsWith("/dashboard/debtors/")) {
      return {
        title: "Debtor detail",
        subtitle: "Borrower profile, KYC state, and loan exposure in one place",
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
  }, []);

  return (
    <div className="min-h-screen pb-28 text-stone-900">
      <EnsureUser />
      <header className="sticky top-0 z-30 px-3 pb-2 pt-[calc(env(safe-area-inset-top)+0.6rem)]">
        <div className="mobile-shell mobile-glass rounded-[16px] px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h1 className="mobile-text-primary text-[1rem] font-semibold leading-none">{title.title}</h1>
              <p className="mobile-text-secondary mt-1 text-[11px]">{title.subtitle}</p>
            </div>
            <Link href="/dashboard/notifications" className="mobile-surface-muted mobile-text-secondary relative flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] border border-slate-900/8 dark:border-white/10">
              {isLoading ? <LoaderCircle size={18} className="animate-spin" /> : <Bell size={18} />}
              {unreadCount > 0 ? (
                <span className="absolute -right-1 -top-1 inline-flex min-h-[1.15rem] min-w-[1.15rem] items-center justify-center rounded-full bg-emerald-600 px-1 text-[10px] font-semibold text-white">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              ) : null}
            </Link>
          </div>
        </div>
      </header>

      <main className="mobile-shell px-3 pb-2">{children}</main>
      <BottomNav />
      <InstallBanner />
    </div>
  );
}
