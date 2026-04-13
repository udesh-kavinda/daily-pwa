import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { SearchableMobileList } from "@/components/searchable-mobile-list";
import { StatusPill } from "@/components/status-pill";
import { getAppSessionContextByClerkId } from "@/lib/auth/get-app-session-context";
import { loadMobileLoans } from "@/lib/mobile-data";

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-LK", {
    style: "currency",
    currency: "LKR",
    maximumFractionDigits: 0,
  }).format(amount || 0);
}

function toneForStatus(status: string) {
  if (status === "active" || status === "approved" || status === "completed") return "emerald" as const;
  if (status === "pending_approval" || status === "overdue") return "amber" as const;
  if (status === "rejected" || status === "defaulted") return "rose" as const;
  return "slate" as const;
}

export default async function LoansPage() {
  const { userId } = await auth();
  if (!userId) {
    redirect("/sign-in");
  }

  let rows: Awaited<ReturnType<typeof loadMobileLoans>>["rows"] = [];

  try {
    const session = await getAppSessionContextByClerkId(userId);
    const payload = await loadMobileLoans(session);
    rows = payload.rows || [];
  } catch {
    rows = [];
  }

  return (
    <div className="space-y-3 pb-4">
      <SearchableMobileList
        searchPlaceholder="Search loan, debtor, or collector"
        items={rows.map((row) => ({
          id: row.id,
          href: `/dashboard/loans/${row.id}`,
          title: row.loanNumber,
          subtitle: row.debtor,
          meta: `${row.collector} · ${formatCurrency(row.dailyPay)} / day`,
          rightTitle: formatCurrency(row.outstanding),
          rightMeta: <StatusPill label={row.status.replaceAll("_", " ")} tone={toneForStatus(row.status)} />,
          keywords: [row.debtor, row.collector, row.loanNumber, row.status, row.endDate],
        }))}
        emptyTitle="No loans yet"
        emptyDescription="Loans will appear here once they are created or linked to your profile."
      />
    </div>
  );
}
