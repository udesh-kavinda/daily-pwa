import Link from "next/link";
import { SignUp } from "@clerk/nextjs";
import { MobileAuthShell } from "@/components/mobile-auth-shell";
import { mobileClerkAppearance } from "@/lib/mobile-clerk-appearance";

export default function SignUpPage() {
  return (
    <MobileAuthShell
      badge="Daily+ Mobile"
      title="Create your account"
      subtitle="Join Daily+ Mobile and continue into your role-based workspace."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/sign-in" className="font-semibold text-[color:var(--accent-strong)] hover:text-[color:var(--accent)]">
            Sign in
          </Link>
        </>
      }
    >
      <SignUp
        fallbackRedirectUrl="/dashboard"
        signInUrl="/sign-in"
        appearance={mobileClerkAppearance}
      />
    </MobileAuthShell>
  );
}
