import type { ReactNode } from "react";

export function MobileAuthShell({
  badge,
  title,
  subtitle,
  children,
  footer,
}: {
  badge: string;
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <main className="min-h-screen bg-background px-5 py-8 text-foreground sm:px-6">
      <div className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col justify-center py-4">
        <div className="mb-6 text-center">
          <div className="mx-auto flex h-13 w-13 items-center justify-center rounded-[18px] bg-accent text-sm font-bold text-white shadow-[0_16px_40px_rgba(15,159,120,0.22)]">
            D+
          </div>
          <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.26em] text-[color:var(--text-tertiary)]">
            {badge}
          </p>
          <h1 className="mt-2 text-[1.9rem] font-semibold tracking-[-0.04em] text-[color:var(--text-primary)]">
            {title}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-[color:var(--text-secondary)]">{subtitle}</p>
        </div>

        <div className="w-full">{children}</div>

        {footer ? <div className="mt-5 text-center text-sm text-[color:var(--text-secondary)]">{footer}</div> : null}
      </div>
    </main>
  );
}
