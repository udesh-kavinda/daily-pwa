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
        className="mobile-solid-surface flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] disabled:opacity-45"
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
      className="mobile-solid-surface mt-4 flex w-full items-center justify-center gap-2 rounded-[14px] px-4 py-3.5 text-sm font-semibold disabled:opacity-45"
    >
      {loaded ? <LogOut size={18} /> : <LoaderCircle size={18} className="animate-spin" />}
      Log out
    </button>
  );
}
