import Link from "next/link";
import { SignIn } from "@clerk/nextjs";
import { MobileAuthShell } from "@/components/mobile-auth-shell";
import { mobileClerkAppearance } from "@/lib/mobile-clerk-appearance";

export default function SignInPage() {
  return (
    <MobileAuthShell
      badge="Daily+ Mobile"
      title="Welcome back"
      subtitle="Sign in to continue to your mobile workspace."
      footer={
        <>
          New here?{" "}
          <Link href="/sign-up" className="font-semibold text-[color:var(--accent-strong)] hover:text-[color:var(--accent)]">
            Create an account
          </Link>
        </>
      }
    >
      <SignIn
        fallbackRedirectUrl="/dashboard"
        signUpUrl="/sign-up"
        appearance={mobileClerkAppearance}
      />
    </MobileAuthShell>
  );
}
