export default function DashboardLoading() {
  return (
    <div className="space-y-3 pb-4 animate-pulse">
      <section className="grid grid-cols-2 gap-2.5">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="mobile-stat-tile h-[88px] bg-white/70 dark:bg-slate-900/70" />
        ))}
      </section>

      {Array.from({ length: 2 }).map((_, sectionIndex) => (
        <section key={sectionIndex} className="mobile-panel px-4 py-4">
          <div className="h-3 w-24 rounded bg-slate-200 dark:bg-slate-700" />
          <div className="mt-4 space-y-2.5">
            {Array.from({ length: 3 }).map((__, rowIndex) => (
              <div key={rowIndex} className="mobile-row h-[68px] bg-slate-50 dark:bg-slate-800/80" />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
