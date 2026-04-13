"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function SplashScreen({ nextPath }: { nextPath: string }) {
  const router = useRouter();

  useEffect(() => {
    const timer = window.setTimeout(() => {
      router.replace(nextPath);
    }, 1200);

    return () => {
      window.clearTimeout(timer);
    };
  }, [nextPath, router]);

  return (
    <main className="min-h-screen bg-[#081120] text-white">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center px-6 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-[28px] bg-emerald-500 text-[1.45rem] font-bold text-slate-950 shadow-[0_24px_80px_rgba(16,185,129,0.25)]">
          D+
        </div>

        <div className="mt-8 space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-emerald-300/85">
            Daily+ Mobile
          </p>
          <h1 className="text-[2rem] font-semibold leading-tight text-white">
            Field finance, made simple.
          </h1>
          <p className="text-sm leading-relaxed text-slate-300">
            Loading your secure workspace.
          </p>
        </div>

        <div className="mt-10 flex items-center gap-2.5">
          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-emerald-400" />
          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-emerald-400 [animation-delay:160ms]" />
          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-emerald-400 [animation-delay:320ms]" />
        </div>
      </div>
    </main>
  );
}
