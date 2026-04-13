type StatusPillProps = {
  label: string;
  tone?: "emerald" | "amber" | "ink" | "slate" | "rose";
};

const tones = {
  emerald: "border-emerald-700/10 bg-emerald-500/10 text-emerald-800",
  amber: "border-amber-700/10 bg-amber-400/15 text-amber-900",
  ink: "border-slate-900/10 bg-slate-900/8 text-slate-800",
  slate: "border-stone-900/10 bg-white/70 text-stone-700",
  rose: "border-rose-700/10 bg-rose-500/10 text-rose-900",
};

export function StatusPill({ label, tone = "slate" }: StatusPillProps) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${tones[tone]}`}>
      {label}
    </span>
  );
}
