"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, Phone, Route, Users } from "lucide-react";
import type { ReactNode } from "react";
import { fetchJson } from "@/lib/fetch-json";
import { DetailPageSkeleton } from "@/components/detail-page-skeleton";

type CollectorDetailResponse = {
  collector: {
    id: string;
    name: string;
    employeeCode: string;
    phone: string;
    alternatePhone: string;
    address: string;
    notes: string | null;
    status: string;
    inviteEmail: string;
  };
  summary: {
    debtors: number;
    activeLoans: number;
    routes: number;
  };
  routes: Array<{
    id: string;
    name: string;
    area: string;
  }>;
};

export default function CollectorDetailPage() {
  const params = useParams<{ id: string }>();
  const collectorId = params?.id;
  const [payload, setPayload] = useState<CollectorDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      if (!collectorId) return;
      setLoading(true);
      try {
        const nextPayload = await fetchJson<CollectorDetailResponse>(`/api/mobile/collectors/${collectorId}`);
        if (!mounted) return;
        setPayload(nextPayload);
        setError(null);
      } catch (fetchError: unknown) {
        if (!mounted) return;
        setPayload(null);
        setError(fetchError instanceof Error ? fetchError.message : "Failed to load collector");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    void load();
    return () => {
      mounted = false;
    };
  }, [collectorId]);

  if (loading) {
    return <DetailPageSkeleton title="Loading collector detail" subtitle="Preparing contact details, route coverage, and portfolio totals." metrics={3} rows={4} />;
  }

  if (!payload?.collector || error) {
    return (
      <div className="space-y-3 pb-4">
        <section className="mobile-panel px-4 py-5 text-center">
          <p className="mobile-text-primary text-base font-semibold">Collector detail is unavailable.</p>
          <p className="mobile-text-secondary mt-2 text-sm">{error || "This collector could not be loaded."}</p>
        </section>
      </div>
    );
  }

  const { collector, summary, routes } = payload;

  return (
    <div className="space-y-3 pb-4">
      <section className="mobile-panel px-4 py-4">
        <Link href="/dashboard/collectors" className="mobile-text-secondary inline-flex items-center gap-2 text-sm font-semibold">
          <ArrowLeft size={16} />
          Back to collectors
        </Link>
        <div className="mt-4">
          <p className="mobile-section-label">Collector</p>
          <h2 className="mobile-text-primary mt-1 text-[1.2rem] font-semibold">{collector.name}</h2>
          <p className="mobile-text-secondary mt-1 text-sm">{collector.employeeCode} · {collector.status.replaceAll("_", " ")}</p>
        </div>
      </section>

      <section className="grid grid-cols-3 gap-2.5">
        <MetricCard label="Debtors" value={String(summary.debtors)} icon={<Users size={16} className="text-emerald-700 dark:text-emerald-300" />} />
        <MetricCard label="Loans" value={String(summary.activeLoans)} icon={<Users size={16} className="text-emerald-700 dark:text-emerald-300" />} />
        <MetricCard label="Routes" value={String(summary.routes)} icon={<Route size={16} className="text-emerald-700 dark:text-emerald-300" />} />
      </section>

      <section className="mobile-panel px-4 py-4">
        <p className="mobile-section-label">Contact</p>
        <div className="mobile-compact-list mt-3">
          <div className="mobile-row">
            <span className="mobile-text-secondary inline-flex items-center gap-2 text-sm"><Phone size={14} />Phone</span>
            <span className="mobile-text-primary text-sm font-semibold">{collector.phone}</span>
          </div>
          <div className="mobile-row">
            <span className="mobile-text-secondary text-sm">Alternate phone</span>
            <span className="mobile-text-primary text-sm font-semibold">{collector.alternatePhone}</span>
          </div>
          <div className="mobile-row">
            <span className="mobile-text-secondary text-sm">Invite email</span>
            <span className="mobile-text-primary text-sm font-semibold">{collector.inviteEmail}</span>
          </div>
          <div className="mobile-row">
            <span className="mobile-text-secondary text-sm">Address</span>
            <span className="mobile-text-primary text-sm font-semibold text-right">{collector.address}</span>
          </div>
        </div>
      </section>

      <section className="mobile-panel px-4 py-4">
        <p className="mobile-section-label">Assigned routes</p>
        <div className="mobile-compact-list mt-3">
          {routes.length === 0 ? (
            <div className="mobile-row block">
              <p className="mobile-text-secondary text-sm">No routes are assigned to this collector yet.</p>
            </div>
          ) : (
            routes.map((route) => (
              <Link key={route.id} href={`/dashboard/routes/${route.id}`} className="block">
                <div className="mobile-row">
                  <div>
                    <p className="mobile-text-primary text-sm font-semibold">{route.name}</p>
                    <p className="mobile-text-secondary mt-1 text-xs">{route.area}</p>
                  </div>
                  <Route size={16} className="mobile-text-tertiary" />
                </div>
              </Link>
            ))
          )}
        </div>
      </section>

      {collector.notes ? (
        <section className="mobile-panel px-4 py-4">
          <p className="mobile-section-label">Internal note</p>
          <p className="mobile-text-secondary mt-3 text-sm leading-relaxed">{collector.notes}</p>
        </section>
      ) : null}
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
