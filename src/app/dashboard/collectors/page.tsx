import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { SearchableMobileList } from "@/components/searchable-mobile-list";
import { StatusPill } from "@/components/status-pill";
import { getAppSessionContextByClerkId } from "@/lib/auth/get-app-session-context";
import { loadMobileCollectors } from "@/lib/mobile-data";

function toneForStatus(status: string) {
  if (status === "active" || status === "accepted") return "emerald" as const;
  if (status === "pending" || status === "invited") return "amber" as const;
  return "slate" as const;
}

export default async function CollectorsPage() {
  const { userId } = await auth();
  if (!userId) {
    redirect("/sign-in");
  }

  let rows: Awaited<ReturnType<typeof loadMobileCollectors>>["rows"] = [];

  try {
    const session = await getAppSessionContextByClerkId(userId);
    const payload = await loadMobileCollectors(session);
    rows = payload.rows || [];
  } catch {
    rows = [];
  }

  return (
    <div className="space-y-3 pb-4">
      <SearchableMobileList
        searchPlaceholder="Search collector, code, or phone"
        items={rows.map((row) => ({
          id: row.id,
          href: `/dashboard/collectors/${row.id}`,
          title: row.name,
          subtitle: row.employeeCode,
          meta: row.phone,
          rightTitle: `${row.routes} routes`,
          rightMeta: <StatusPill label={row.status.replaceAll("_", " ")} tone={toneForStatus(row.status)} />,
          keywords: [row.name, row.employeeCode, row.phone, row.status],
        }))}
        emptyTitle="No collectors yet"
        emptyDescription="Collectors will appear here once they are created inside the organization."
      />
    </div>
  );
}
