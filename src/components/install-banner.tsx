"use client";

import { useEffect, useState } from "react";


type InstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function InstallBanner() {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handler = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallPrompt);
      setVisible(true);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (!visible || !prompt) return null;

  const handleInstall = async () => {
    await prompt.prompt();
    const choice = await prompt.userChoice;
    if (choice.outcome === "accepted") {
      setVisible(false);
    }
  };

  return (
    <div className="fixed bottom-24 left-1/2 z-50 w-[calc(100%-1.5rem)] max-w-md -translate-x-1/2 rounded-[28px] border border-stone-900/10 bg-[#fffaf3]/95 p-4 shadow-[0_24px_80px_rgba(27,20,11,0.18)] backdrop-blur-xl">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#14213d] text-sm font-bold text-white">
          D+
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-stone-900">Install Daily+ Mobile</p>
          <p className="text-xs leading-relaxed text-stone-600">
            Add the app to your home screen for fast entry, a cleaner full-screen view, and smoother field use.
          </p>
        </div>
        <button
          onClick={handleInstall}
          className="rounded-full bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-emerald-600/25"
        >
          Install
        </button>
      </div>
    </div>
  );
}
