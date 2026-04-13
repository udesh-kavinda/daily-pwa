import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { ArrowLeft, Phone, Route, Users } from "lucide-react";
import { loadMobileCollectorDetailByClerkId, MobileCollectorDetailError } from "@/lib/mobile-collector-detail";

export default async function CollectorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { userId } = await auth();
  if (!userId) {
    redirect("/sign-in");
  }

  const { id } = await params;
  let payload: Awaited<ReturnType<typeof loadMobileCollectorDetailByClerkId>> | null = null;
  let message: string | null = null;

  try {
    payload = await loadMobileCollectorDetailByClerkId(userId, id);
  } catch (error: unknown) {
    message =
      error instanceof MobileCollectorDetailError || error instanceof Error
        ? error.message
        : "This collector could not be loaded.";
  }

  if (!payload) {
    return (
      <div className="space-y-4 pb-4">
        <section className="mobile-panel px-5 py-6 text-center">
          <p className="mobile-text-primary text-base font-semibold">Collector detail is unavailable.</p>
          <p className="mobile-text-secondary mt-2 text-sm leading-relaxed">{message}</p>
          <Link href="/dashboard/collectors" className="mobile-inline-action mt-4">
            <ArrowLeft size={16} />
            Back to collectors
          </Link>
        </section>
      </div>
    );
  }

  const { collector, summary, routes } = payload;

  return (
    <div className="space-y-3 pb-4">
      <section className="mobile-panel px-4 py-4">
        <Link
          href="/dashboard/collectors"
          className="mobile-text-secondary inline-flex items-center gap-2 text-sm font-semibold"
        >
          <ArrowLeft size={16} />
          Back to collectors
        </Link>
        <div className="mt-4">
          <p className="mobile-section-label">Collector</p>
          <h2 className="mobile-text-primary mt-1 text-[1.2rem] font-semibold">{collector.name}</h2>
          <p className="mobile-text-secondary mt-1.5 text-sm">
            {collector.employeeCode} · {collector.status.replaceAll("_", " ")}
          </p>
        </div>
      </section>

      <section className="grid grid-cols-3 gap-3">
        <MetricCard
          label="Debtors"
          value={String(summary.debtors)}
          icon={<Users size={16} className="text-emerald-700 dark:text-emerald-300" />}
        />
        <MetricCard
          label="Loans"
          value={String(summary.activeLoans)}
          icon={<Users size={16} className="text-emerald-700 dark:text-emerald-300" />}
        />
        <MetricCard
          label="Routes"
          value={String(summary.routes)}
          icon={<Route size={16} className="text-emerald-700 dark:text-emerald-300" />}
        />
      </section>

      <section className="mobile-panel px-4 py-4">
        <p className="mobile-section-label">Contact</p>
        <div className="mobile-compact-list mt-3">
          <DetailRow label="Phone" value={collector.phone} icon={<Phone size={14} className="mobile-text-tertiary" />} />
          <DetailRow label="Alternate phone" value={collector.alternatePhone} />
          <DetailRow label="Invite email" value={collector.inviteEmail} />
          <DetailRow label="Address" value={collector.address} />
        </div>
      </section>

      <section className="mobile-panel px-4 py-4">
        <p className="mobile-section-label">Assigned routes</p>
        <div className="mobile-compact-list mt-3">
          {routes.length === 0 ? (
            <div className="mobile-inline-surface px-4 py-4">
              <p className="mobile-text-secondary text-sm">
                No routes are assigned to this collector yet.
              </p>
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

function MetricCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <section className="mobile-panel-strong px-4 py-4">
      <div className="flex flex-col gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-[12px] bg-emerald-500/10 dark:bg-emerald-500/14">
          {icon}
        </div>
        <p className="mobile-text-tertiary text-[10px] uppercase tracking-[0.16em]">{label}</p>
        <p className="mobile-text-primary text-sm font-semibold">{value}</p>
      </div>
    </section>
  );
}

function DetailRow({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="mobile-row">
      <div className="mobile-text-secondary inline-flex items-center gap-2 text-sm">
        {icon}
        <span>{label}</span>
      </div>
      <span className="mobile-text-primary text-right text-sm font-semibold">{value}</span>
    </div>
  );
}
