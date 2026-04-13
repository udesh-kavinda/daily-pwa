import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { SearchableMobileList } from "@/components/searchable-mobile-list";
import { StatusPill } from "@/components/status-pill";
import { getAppSessionContextByClerkId } from "@/lib/auth/get-app-session-context";
import { loadMobileRoutes } from "@/lib/mobile-data";

export default async function RoutesPage() {
  const { userId } = await auth();
  if (!userId) {
    redirect("/sign-in");
  }

  let rows: Awaited<ReturnType<typeof loadMobileRoutes>>["rows"] = [];

  try {
    const session = await getAppSessionContextByClerkId(userId);
    const payload = await loadMobileRoutes(session);
    rows = payload.rows || [];
  } catch {
    rows = [];
  }

  return (
    <div className="space-y-3 pb-4">
      <SearchableMobileList
        searchPlaceholder="Search route, area, or collector"
        items={rows.map((row) => ({
          id: row.id,
          href: `/dashboard/routes/${row.id}`,
          title: row.name,
          subtitle: row.area,
          meta: row.collector,
          rightTitle: `${row.debtors} debtors`,
          rightMeta: <StatusPill label={row.status} tone={row.status === "active" ? "emerald" : "slate"} />,
          keywords: [row.name, row.area, row.collector, row.status],
        }))}
        emptyTitle="No routes yet"
        emptyDescription="Routes will appear here once they are created and assigned."
      />
    </div>
  );
}
