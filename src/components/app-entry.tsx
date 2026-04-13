"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { SignIn } from "@clerk/nextjs";

export function AppEntry({ authenticated }: { authenticated: boolean }) {
  const router = useRouter();
  const [showLogin, setShowLogin] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (authenticated) {
        router.replace("/dashboard");
        return;
      }
      setShowLogin(true);
    }, 1200);

    return () => {
      window.clearTimeout(timer);
    };
  }, [authenticated, router]);

  if (!showLogin) {
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
              {authenticated ? "Opening your workspace." : "Preparing secure sign in."}
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

  return (
    <main className="min-h-screen bg-[#081120] px-6 py-12 text-white">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center">
        <div className="mb-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-[20px] bg-emerald-500 text-base font-bold text-slate-950">
            D+
          </div>
          <h1 className="mt-5 text-[1.9rem] font-semibold leading-tight text-white">Welcome to Daily+ Mobile</h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-300">
            Sign in to continue to your mobile workspace.
          </p>
        </div>

        <div className="rounded-[28px] border border-white/10 bg-white/6 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.28)] backdrop-blur">
          <SignIn
            routing="path"
            path="/"
            signUpUrl="/sign-up"
            fallbackRedirectUrl="/dashboard"
            appearance={{
              elements: {
                card: "shadow-none bg-transparent border-none",
                rootBox: "w-full",
                formButtonPrimary: "bg-emerald-400 text-slate-900 hover:bg-emerald-300",
                footerActionLink: "text-emerald-300 hover:text-emerald-200",
                formFieldLabel: "text-slate-200",
                formFieldInput: "bg-white/8 border-white/10 text-white",
                socialButtonsBlockButton: "bg-white/8 border-white/10 text-white hover:bg-white/12",
                dividerText: "text-slate-400",
                dividerLine: "bg-white/10",
              },
            }}
          />
        </div>

        <div className="mt-5 text-center text-sm text-slate-300">
          New here? {" "}
          <Link href="/sign-up" className="font-semibold text-emerald-300 hover:text-emerald-200">
            Create an account
          </Link>
        </div>
      </div>
    </main>
  );
}
