import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { DebtorKycPageClient } from "@/components/debtor-kyc-page-client";
import { loadMobileDebtorKycByClerkId, MobileDebtorKycError } from "@/lib/mobile-debtor-kyc";

export default async function DebtorKycPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { userId } = await auth();
  if (!userId) {
    redirect("/sign-in");
  }

  const { id } = await params;

  let payload: Awaited<ReturnType<typeof loadMobileDebtorKycByClerkId>> | null = null;
  let message: string | null = null;

  try {
    payload = await loadMobileDebtorKycByClerkId(userId, id);
  } catch (error: unknown) {
    message =
      error instanceof MobileDebtorKycError || error instanceof Error
        ? error.message
        : "This debtor could not be prepared for KYC capture.";
  }

  if (!payload) {
    return (
      <div className="space-y-4 pb-4">
        <section className="mobile-panel px-5 py-6 text-center">
          <p className="mobile-text-primary text-base font-semibold">KYC workspace is unavailable.</p>
          <p className="mobile-text-secondary mt-2 text-sm leading-relaxed">{message}</p>
          <Link href="/dashboard/portfolio" className="mobile-inline-action mt-4">
            <ArrowLeft size={16} />
            Back to portfolio
          </Link>
        </section>
      </div>
    );
  }

  return <DebtorKycPageClient initialPayload={payload} />;
}
