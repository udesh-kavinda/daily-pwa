export default function WorkLoading() {
  return (
    <div className="space-y-3 pb-4 animate-pulse">
      <section className="mobile-panel px-4 py-4">
        <div className="h-3 w-28 rounded bg-slate-200 dark:bg-slate-700" />
        <div className="mt-3 h-7 w-40 rounded bg-slate-200 dark:bg-slate-700" />
        <div className="mt-3 h-3 w-full rounded bg-slate-100 dark:bg-slate-800" />
        <div className="mt-4 flex gap-2">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-9 w-24 rounded-full bg-slate-100 dark:bg-slate-800" />
          ))}
        </div>
      </section>

      {Array.from({ length: 3 }).map((_, index) => (
        <section key={index} className="mobile-panel px-4 py-4">
          <div className="h-4 w-32 rounded bg-slate-200 dark:bg-slate-700" />
          <div className="mt-3 h-3 w-2/3 rounded bg-slate-100 dark:bg-slate-800" />
          <div className="mt-4 h-20 rounded-[14px] bg-slate-50 dark:bg-slate-900/80" />
        </section>
      ))}
    </div>
  );
}
