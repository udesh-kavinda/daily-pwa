"use client";

import Link from "next/link";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Bell, Grid2x2, WalletCards, Radar, FolderKanban, UserRound, Route, HandCoins, Users } from "lucide-react";
import { useUserStore } from "@/store/user-store";
import type { MobileRole } from "@/lib/mobile-demo-data";
import { isNavItemActive, normalizeMobileRole } from "@/lib/mobile-route-access";

const navByRole: Record<MobileRole, Array<{ href: string; label: string; icon: React.ComponentType<{ size?: number; className?: string }> }>> = {
  collector: [
    { href: "/dashboard", label: "Home", icon: Grid2x2 },
    { href: "/dashboard/work", label: "Route", icon: Route },
    { href: "/dashboard/debtors", label: "Debtors", icon: FolderKanban },
    { href: "/collector", label: "Capture", icon: Radar },
    { href: "/dashboard/profile", label: "Profile", icon: UserRound },
  ],
  creditor: [
    { href: "/dashboard", label: "Home", icon: Grid2x2 },
    { href: "/dashboard/work", label: "Approvals", icon: HandCoins },
    { href: "/dashboard/loans", label: "Loans", icon: WalletCards },
    { href: "/dashboard/collectors", label: "Team", icon: Users },
    { href: "/dashboard/profile", label: "Profile", icon: UserRound },
  ],
  debtor: [
    { href: "/dashboard", label: "Home", icon: Grid2x2 },
    { href: "/dashboard/work", label: "Schedule", icon: WalletCards },
    { href: "/dashboard/loans", label: "Loans", icon: FolderKanban },
    { href: "/dashboard/notifications", label: "Alerts", icon: Bell },
    { href: "/dashboard/profile", label: "Profile", icon: UserRound },
  ],
};

export function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { role } = useUserStore();
  const activeRole: MobileRole = normalizeMobileRole(role);
  const items = navByRole[activeRole];

  useEffect(() => {
    items.forEach((item) => {
      if (item.href !== pathname) {
        router.prefetch(item.href);
      }
    });
  }, [items, pathname, router]);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[calc(env(safe-area-inset-bottom)+0.45rem)] pt-2">
      <div className="mobile-shell mobile-tabbar px-1 py-1">
        <div className="grid grid-cols-5 gap-1">
          {items.map((item) => {
            const Icon = item.icon;
            const active = isNavItemActive(pathname, item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch
                className={`mobile-tabbar-item text-[10px] font-semibold ${active ? "mobile-tabbar-item-active" : ""}`}
              >
                <Icon size={17} className={active ? "text-emerald-700 dark:text-emerald-300" : ""} />
                <span className="leading-none">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
