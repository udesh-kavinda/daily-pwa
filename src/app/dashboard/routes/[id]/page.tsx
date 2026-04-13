"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, FolderKanban, Route, Users } from "lucide-react";
import type { ReactNode } from "react";
import { fetchJson } from "@/lib/fetch-json";
import { StatusPill } from "@/components/status-pill";

type RouteDetailResponse = {
  route: {
    id: string;
    name: string;
    area: string;
    description: string;
    status: string;
    collector: { id: string; name: string; employeeCode: string } | null;
  };
  summary: {
    debtors: number;
    activeLoans: number;
  };
  debtors: Array<{
    id: string;
    name: string;
    phone: string;
    status: string;
  }>;
};

function toneForStatus(status: string) {
  if (status === "approved" || status === "active") return "emerald" as const;
  if (status === "pending_approval") return "amber" as const;
  if (status === "rejected") return "rose" as const;
  return "slate" as const;
}

export default function RouteDetailPage() {
  const params = useParams<{ id: string }>();
  const routeId = params?.id;
  const [payload, setPayload] = useState<RouteDetailResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      if (!routeId) return;
      try {
        const nextPayload = await fetchJson<RouteDetailResponse>(`/api/mobile/routes/${routeId}`);
        if (!mounted) return;
        setPayload(nextPayload);
        setError(null);
      } catch (fetchError: unknown) {
        if (!mounted) return;
        setPayload(null);
        setError(fetchError instanceof Error ? fetchError.message : "Failed to load route");
      }
    }
    void load();
    return () => {
      mounted = false;
    };
  }, [routeId]);

  if (!payload?.route || error) {
    return (
      <div className="space-y-3 pb-4">
        <section className="mobile-panel px-4 py-5 text-center">
          <p className="mobile-text-primary text-base font-semibold">Route detail is unavailable.</p>
          <p className="mobile-text-secondary mt-2 text-sm">{error || "This route could not be loaded."}</p>
        </section>
      </div>
    );
  }

  const { route, summary, debtors } = payload;

  return (
    <div className="space-y-3 pb-4">
      <section className="mobile-panel px-4 py-4">
        <Link href="/dashboard/routes" className="mobile-text-secondary inline-flex items-center gap-2 text-sm font-semibold">
          <ArrowLeft size={16} />
          Back to routes
        </Link>
        <div className="mt-4">
          <p className="mobile-section-label">{route.area}</p>
          <h2 className="mobile-text-primary mt-1 text-[1.2rem] font-semibold">{route.name}</h2>
          <p className="mobile-text-secondary mt-1 text-sm">{route.description}</p>
        </div>
      </section>

      <section className="grid grid-cols-3 gap-2.5">
        <MetricCard label="Debtors" value={String(summary.debtors)} icon={<FolderKanban size={16} className="text-emerald-700 dark:text-emerald-300" />} />
        <MetricCard label="Loans" value={String(summary.activeLoans)} icon={<Users size={16} className="text-emerald-700 dark:text-emerald-300" />} />
        <MetricCard label="Status" value={route.status} icon={<Route size={16} className="text-emerald-700 dark:text-emerald-300" />} />
      </section>

      <section className="mobile-panel px-4 py-4">
        <p className="mobile-section-label">Assigned collector</p>
        <div className="mobile-compact-list mt-3">
          {route.collector ? (
            <Link href={`/dashboard/collectors/${route.collector.id}`} className="block">
              <div className="mobile-row">
                <div>
                  <p className="mobile-text-primary text-sm font-semibold">{route.collector.name}</p>
                  <p className="mobile-text-secondary mt-1 text-xs">{route.collector.employeeCode}</p>
                </div>
                <Users size={16} className="mobile-text-tertiary" />
              </div>
            </Link>
          ) : (
            <div className="mobile-row block">
              <p className="mobile-text-secondary text-sm">No collector is assigned to this route yet.</p>
            </div>
          )}
        </div>
      </section>

      <section className="mobile-panel px-4 py-4">
        <p className="mobile-section-label">Debtor list</p>
        <div className="mobile-compact-list mt-3">
          {debtors.length === 0 ? (
            <div className="mobile-row block">
              <p className="mobile-text-secondary text-sm">No debtors are mapped to this route yet.</p>
            </div>
          ) : (
            debtors.map((debtor) => (
              <Link key={debtor.id} href={`/dashboard/debtors/${debtor.id}`} className="block">
                <div className="mobile-row">
                  <div>
                    <p className="mobile-text-primary text-sm font-semibold">{debtor.name}</p>
                    <p className="mobile-text-secondary mt-1 text-xs">{debtor.phone}</p>
                  </div>
                  <StatusPill label={debtor.status.replaceAll("_", " ")} tone={toneForStatus(debtor.status)} />
                </div>
              </Link>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function MetricCard({ label, value, icon }: { label: string; value: string; icon: ReactNode }) {
  return (
    <section className="mobile-panel-strong px-4 py-4">
      <div className="flex flex-col gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-[12px] bg-emerald-500/10 dark:bg-emerald-500/14">{icon}</div>
        <p className="mobile-text-tertiary text-[10px] uppercase tracking-[0.16em]">{label}</p>
        <p className="mobile-text-primary text-sm font-semibold">{value}</p>
      </div>
    </section>
  );
}
