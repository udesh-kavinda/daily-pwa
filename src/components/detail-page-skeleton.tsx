import { LoaderCircle } from "lucide-react";

export function DetailPageSkeleton({
  title = "Loading details",
  subtitle = "Preparing the latest record from Daily+.",
  metrics = 3,
  rows = 3,
}: {
  title?: string;
  subtitle?: string;
  metrics?: number;
  rows?: number;
}) {
  const metricGridClass = metrics >= 4 ? "grid-cols-2" : metrics === 1 ? "grid-cols-1" : metrics === 2 ? "grid-cols-2" : "grid-cols-3";

  return (
    <div className="space-y-4 pb-4">
      <section className="mobile-panel px-5 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[color:var(--accent-soft)] text-[color:var(--accent-strong)]">
            <LoaderCircle size={18} className="animate-spin" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="h-4 w-28 animate-pulse rounded-full bg-[color:var(--ink-soft)]" />
            <div className="mt-2 h-7 w-3/5 animate-pulse rounded-full bg-[color:var(--ink-soft)]" />
          </div>
        </div>
        <p className="mobile-text-secondary mt-4 text-sm">{title}</p>
        <p className="mobile-text-tertiary mt-1 text-xs">{subtitle}</p>
      </section>

      <section className={`grid gap-3 ${metricGridClass}`}>
        {Array.from({ length: metrics }).map((_, index) => (
          <div key={index} className="mobile-panel-strong px-4 py-4">
            <div className="h-3 w-16 animate-pulse rounded-full bg-[color:var(--ink-soft)]" />
            <div className="mt-3 h-6 w-20 animate-pulse rounded-full bg-[color:var(--ink-soft)]" />
          </div>
        ))}
      </section>

      <section className="mobile-panel px-5 py-5">
        <div className="h-3 w-24 animate-pulse rounded-full bg-[color:var(--ink-soft)]" />
        <div className="mt-4 space-y-3">
          {Array.from({ length: rows }).map((_, index) => (
            <div key={index} className="mobile-row">
              <div className="min-w-0 flex-1">
                <div className="h-4 w-32 animate-pulse rounded-full bg-[color:var(--ink-soft)]" />
                <div className="mt-2 h-3 w-20 animate-pulse rounded-full bg-[color:var(--ink-soft)]" />
              </div>
              <div className="h-6 w-16 animate-pulse rounded-full bg-[color:var(--ink-soft)]" />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
