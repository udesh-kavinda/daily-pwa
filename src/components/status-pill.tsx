type StatusPillProps = {
  label: string;
  tone?: "emerald" | "amber" | "ink" | "slate" | "rose";
};

const tones = {
  emerald: "border-emerald-700/10 bg-emerald-500/10 text-emerald-800",
  amber: "border-amber-700/10 bg-amber-400/14 text-amber-900",
  ink: "border-slate-900/10 bg-slate-900/7 text-slate-800",
  slate: "border-slate-900/8 bg-slate-50 text-slate-700",
  rose: "border-rose-700/10 bg-rose-500/10 text-rose-900",
};

export function StatusPill({ label, tone = "slate" }: StatusPillProps) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-[0.01em] ${tones[tone]}`}>
      {label}
    </span>
  );
}
