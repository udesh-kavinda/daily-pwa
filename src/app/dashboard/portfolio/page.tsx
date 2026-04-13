"use client";

import Link from "next/link";
import type { ComponentType } from "react";
import { ChevronRight, FolderKanban, Route, Users, Wallet } from "lucide-react";
import { useUserStore } from "@/store/user-store";
import type { MobileRole } from "@/lib/mobile-demo-data";

type DirectoryItem = {
  href: string;
  title: string;
  detail: string;
  icon: ComponentType<{ size?: number; className?: string }>;
};

export default function PortfolioPage() {
  const { role } = useUserStore();
  const activeRole: MobileRole = role === "creditor" || role === "debtor" ? role : "collector";

  const items: DirectoryItem[] = activeRole === "creditor"
    ? [
        { href: "/dashboard/debtors", title: "Debtors", detail: "Open borrower records", icon: FolderKanban },
        { href: "/dashboard/loans", title: "Loans", detail: "Open the loan table", icon: Wallet },
        { href: "/dashboard/routes", title: "Routes", detail: "Open route list", icon: Route },
        { href: "/dashboard/collectors", title: "Collectors", detail: "Open field team list", icon: Users },
      ]
    : activeRole === "collector"
      ? [
          { href: "/dashboard/debtors", title: "Debtors", detail: "Open assigned debtor list", icon: FolderKanban },
          { href: "/dashboard/routes", title: "Routes", detail: "Open route list", icon: Route },
          { href: "/collector", title: "Capture", detail: "Record a collection", icon: Wallet },
        ]
      : [
          { href: "/dashboard/loans", title: "Loans", detail: "Open your loan list", icon: Wallet },
          { href: "/dashboard/notifications", title: "Alerts", detail: "Open reminders and notices", icon: Users },
        ];

  return (
    <div className="space-y-3 pb-4">
      <section className="mobile-panel px-4 py-4">
        <div className="mobile-compact-list">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href} className="mobile-row">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-slate-100 text-slate-700">
                    <Icon size={18} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[#0f172a]">{item.title}</p>
                    <p className="mt-1 text-[13px] text-slate-600">{item.detail}</p>
                  </div>
                </div>
                <ChevronRight size={16} className="shrink-0 text-slate-400" />
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
