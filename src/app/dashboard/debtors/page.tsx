import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { SearchableMobileList } from "@/components/searchable-mobile-list";
import { StatusPill } from "@/components/status-pill";
import { getAppSessionContextByClerkId } from "@/lib/auth/get-app-session-context";
import { loadMobileDebtors } from "@/lib/mobile-data";

function toneForStatus(status: string) {
  if (status === "approved" || status === "active") return "emerald" as const;
  if (status === "pending_approval") return "amber" as const;
  if (status === "rejected") return "rose" as const;
  return "slate" as const;
}

function formatStatus(status: string) {
  return status.replaceAll("_", " ");
}

export default async function DebtorsPage() {
  const { userId } = await auth();
  if (!userId) {
    redirect("/sign-in");
  }

  let rows: Awaited<ReturnType<typeof loadMobileDebtors>>["rows"] = [];

  try {
    const session = await getAppSessionContextByClerkId(userId);
    const payload = await loadMobileDebtors(session);
    rows = payload.rows || [];
  } catch {
    rows = [];
  }

  return (
    <div className="space-y-3 pb-4">
      <SearchableMobileList
        searchPlaceholder="Search debtor, phone, route, or collector"
        items={rows.map((row) => ({
          id: row.id,
          href: `/dashboard/debtors/${row.id}`,
          title: row.name,
          subtitle: row.phone,
          meta: `${row.route} · ${row.collector}`,
          rightMeta: <StatusPill label={formatStatus(row.status)} tone={toneForStatus(row.status)} />,
          keywords: [row.route, row.collector, row.phone, formatStatus(row.status)],
        }))}
        emptyTitle="No debtors yet"
        emptyDescription="Once debtors are assigned or created, they will appear here as a searchable list."
      />
    </div>
  );
}
