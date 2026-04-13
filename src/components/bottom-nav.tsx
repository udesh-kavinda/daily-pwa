"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Grid2x2, WalletCards, Radar, FolderKanban, UserRound } from "lucide-react";
import { useUserStore } from "@/store/user-store";
import type { MobileRole } from "@/lib/mobile-demo-data";
import { isNavItemActive, normalizeMobileRole } from "@/lib/mobile-route-access";

const navByRole: Record<MobileRole, Array<{ href: string; label: string; icon: React.ComponentType<{ size?: number; className?: string }> }>> = {
  collector: [
    { href: "/dashboard", label: "Home", icon: Grid2x2 },
    { href: "/dashboard/work", label: "Route", icon: WalletCards },
    { href: "/collector", label: "Capture", icon: Radar },
    { href: "/dashboard/portfolio", label: "Debtors", icon: FolderKanban },
    { href: "/dashboard/profile", label: "Profile", icon: UserRound },
  ],
  creditor: [
    { href: "/dashboard", label: "Home", icon: Grid2x2 },
    { href: "/dashboard/work", label: "Approvals", icon: WalletCards },
    { href: "/collector", label: "Ops", icon: Radar },
    { href: "/dashboard/portfolio", label: "People", icon: FolderKanban },
    { href: "/dashboard/profile", label: "Profile", icon: UserRound },
  ],
  debtor: [
    { href: "/dashboard", label: "Home", icon: Grid2x2 },
    { href: "/dashboard/work", label: "Schedule", icon: WalletCards },
    { href: "/dashboard/notifications", label: "Alerts", icon: Bell },
    { href: "/dashboard/portfolio", label: "Loans", icon: FolderKanban },
    { href: "/dashboard/profile", label: "Profile", icon: UserRound },
  ],
};

export function BottomNav() {
  const pathname = usePathname();
  const { role } = useUserStore();
  const activeRole: MobileRole = normalizeMobileRole(role);
  const items = navByRole[activeRole];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3">
      <div className="mobile-shell rounded-[30px] border border-stone-900/10 bg-[#fffaf3]/88 px-2 py-2 shadow-[0_24px_80px_rgba(27,20,11,0.18)] backdrop-blur-xl">
        <div className="grid grid-cols-5 items-end gap-1">
          {items.map((item, index) => {
            const Icon = item.icon;
            const active = isNavItemActive(pathname, item.href);
            const center = index === 2;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 text-[10px] font-semibold transition-all ${
                  center
                    ? "-mt-5 rounded-[22px] bg-[#14213d] py-3 text-[#fff7eb] shadow-[0_18px_40px_rgba(20,33,61,0.3)]"
                    : active
                      ? "bg-emerald-500/10 text-emerald-800"
                      : "text-stone-500"
                }`}
              >
                <Icon size={center ? 22 : 20} className={active && !center ? "text-emerald-700" : ""} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
