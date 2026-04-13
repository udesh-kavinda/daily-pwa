"use client";

import { useClerk } from "@clerk/nextjs";
import { LoaderCircle, LogOut } from "lucide-react";

type ClerkLogoutButtonProps = {
  compact?: boolean;
};

export function ClerkLogoutButton({ compact = false }: ClerkLogoutButtonProps) {
  const { signOut, loaded } = useClerk();

  const handleSignOut = async () => {
    await signOut({ redirectUrl: "/sign-in" });
  };

  if (compact) {
    return (
      <button
        type="button"
        onClick={() => void handleSignOut()}
        disabled={!loaded}
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#14213d] text-white disabled:opacity-45"
        aria-label="Log out"
      >
        {loaded ? <LogOut size={20} /> : <LoaderCircle size={20} className="animate-spin" />}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => void handleSignOut()}
      disabled={!loaded}
      className="mt-4 flex w-full items-center justify-center gap-2 rounded-[24px] border border-stone-900/10 bg-white/80 px-4 py-4 text-sm font-semibold text-[#14213d] disabled:opacity-45"
    >
      {loaded ? <LogOut size={18} /> : <LoaderCircle size={18} className="animate-spin" />}
      Log out
    </button>
  );
}
