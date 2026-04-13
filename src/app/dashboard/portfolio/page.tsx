"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronRight, Search, Sparkle, Users } from "lucide-react";
import { StatusPill } from "@/components/status-pill";
import { useUserStore } from "@/store/user-store";
import { fetchJson } from "@/lib/fetch-json";
import { portfolioCards } from "@/lib/mobile-demo-data";
import type { MobileRole } from "@/lib/mobile-demo-data";

type PortfolioResponse = {
  role: MobileRole;
  items: Array<{
    id: string;
    title: string;
    subtitle: string;
    meta: string;
    value: number;
    displayValue: string;
    tone: "emerald" | "amber" | "ink";
  }>;
};

export default function PortfolioPage() {
  const { role } = useUserStore();
  const activeRole: MobileRole = role === "creditor" || role === "debtor" ? role : "collector";
  const [items, setItems] = useState<PortfolioResponse["items"]>([]);

  useEffect(() => {
    let mounted = true;

    fetchJson<PortfolioResponse>("/api/mobile/portfolio")
      .then((payload) => {
        if (mounted) {
          setItems(payload.items);
        }
      })
      .catch(() => {
        if (mounted) {
          setItems(
            portfolioCards[activeRole].map((card, index) => ({
              id: `${activeRole}-${index}`,
              title: card.title,
              subtitle: card.subtitle,
              meta: card.meta,
              value: Number(String(card.value).replace(/[^\d.-]/g, "")) || 0,
              displayValue: card.value,
              tone: card.tone,
            }))
          );
        }
      });

    return () => {
      mounted = false;
    };
  }, [activeRole]);

  return (
    <div className="space-y-4 pb-4">
      <section className="mobile-panel px-5 py-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-stone-500">Portfolio view</p>
            <h2 className="mt-1 text-xl font-semibold text-[#14213d]">
              {activeRole === "creditor" ? "People and performance" : activeRole === "debtor" ? "Your loans" : "Assigned debtors"}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-stone-600">
              {activeRole === "creditor"
                ? "Scan approvals, routes, and field teams from a smaller but decision-focused mobile view."
                : activeRole === "debtor"
                  ? "See each loan, who manages it, what is left to repay, and when the next visit is expected."
                  : "See who needs attention next, who is recovering well, and which debtor records need follow-up."}
            </p>
            {activeRole === "debtor" ? (
              <p className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
                Tap a loan to open the full repayment breakdown and history
              </p>
            ) : activeRole === "collector" ? (
              <div className="mt-4">
                <Link href="/dashboard/portfolio/new" className="inline-flex items-center gap-2 rounded-full bg-[#14213d] px-4 py-3 text-sm font-semibold text-white">
                  Request new debtor
                  <ChevronRight size={16} />
                </Link>
              </div>
            ) : null}
          </div>
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#14213d] text-white">
            <Users size={22} />
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3 rounded-[24px] border border-stone-900/8 bg-white/70 px-4 py-3">
          <Search size={18} className="text-stone-400" />
          <span className="text-sm text-stone-400">
            {activeRole === "debtor" ? "Search lender, collector, or loan" : "Search debtor, route, or collector"}
          </span>
        </div>
      </section>

      <section className="space-y-3">
        {items.map((card) => {
          const content = (
            <div className="mobile-panel-strong px-5 py-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-[#14213d]">{card.title}</h3>
                <p className="mt-1 text-sm text-stone-600">{card.subtitle}</p>
              </div>
              <div className="flex items-center gap-2">
                <StatusPill label={card.meta} tone={card.tone} />
                {activeRole === "debtor" ? <ChevronRight size={16} className="text-stone-400" /> : null}
              </div>
            </div>
            <div className="mt-4 rounded-[24px] bg-stone-900/[0.045] px-4 py-4">
              <p className="text-[11px] uppercase tracking-[0.16em] text-stone-500">
                {activeRole === "debtor" ? "Still left to repay" : "Snapshot"}
              </p>
              <div className="mt-2 flex items-end justify-between gap-3">
                <p className="text-xl font-semibold text-[#14213d]">{card.displayValue}</p>
                <div className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                  <Sparkle size={14} />
                  Live context
                </div>
              </div>
            </div>
          </div>
          );

          const href = activeRole === "debtor"
            ? `/dashboard/portfolio/${card.id}`
            : activeRole === "collector"
              ? `/dashboard/portfolio/debtors/${card.id}`
              : null;

          return href ? (
            <Link key={card.id} href={href} className="block">
              {content}
            </Link>
          ) : (
            <div key={card.id}>{content}</div>
          );
        })}
      </section>
    </div>
  );
}
