import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { LoanRequestPageClient } from "@/components/loan-request-page-client";
import { loadMobileLoanRequestByClerkId, MobileLoanRequestError } from "@/lib/mobile-loan-request";

export default async function CollectorLoanRequestPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { userId } = await auth();
  if (!userId) {
    redirect("/sign-in");
  }

  const { id } = await params;

  let payload: Awaited<ReturnType<typeof loadMobileLoanRequestByClerkId>> | null = null;
  let message: string | null = null;

  try {
    payload = await loadMobileLoanRequestByClerkId(userId, id);
  } catch (error: unknown) {
    message =
      error instanceof MobileLoanRequestError || error instanceof Error
        ? error.message
        : "This debtor could not be prepared for a mobile loan request.";
  }

  if (!payload?.debtor) {
    return (
      <div className="space-y-4 pb-4">
        <section className="mobile-panel px-5 py-6 text-center">
          <p className="mobile-text-primary text-base font-semibold">Loan request is unavailable.</p>
          <p className="mobile-text-secondary mt-2 text-sm leading-relaxed">{message}</p>
          <Link href="/dashboard/portfolio" className="mobile-inline-action mt-4">
            <ArrowLeft size={16} />
            Back to portfolio
          </Link>
        </section>
      </div>
    );
  }

  return <LoanRequestPageClient initialContext={payload} />;
}
