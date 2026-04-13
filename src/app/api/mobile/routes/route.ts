import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAppSessionContextByClerkId } from "@/lib/auth/get-app-session-context";

function fullName(firstName: string | null, lastName: string | null) {
  return `${firstName || ""} ${lastName || ""}`.trim() || "Collector";
}

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createAdminClient();
    const session = await getAppSessionContextByClerkId(userId);

    if (session.role === "debtor") {
      return NextResponse.json({ rows: [] });
    }

    let query = supabase
      .from("routes")
      .select("id, name, area, is_active, collector_id")
      .eq("creditor_id", session.creditorId)
      .order("updated_at", { ascending: false });

    if (session.role === "collector" && session.collector) {
      query = query.eq("collector_id", session.collector.id);
    }

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const routes = (data as Array<{ id: string; name: string; area: string | null; is_active: boolean; collector_id: string | null }> | null) || [];
    const routeIds = routes.map((row) => row.id);
    const collectorIds = [...new Set(routes.map((row) => row.collector_id).filter(Boolean))] as string[];

    const [{ data: debtors }, { data: collectors }] = await Promise.all([
      routeIds.length > 0
        ? supabase.from("debtors").select("id, route_id").in("route_id", routeIds)
        : Promise.resolve({ data: [] as Array<{ id: string; route_id: string | null }>, error: null }),
      collectorIds.length > 0
        ? supabase.from("collectors").select("id, first_name, last_name, employee_code").in("id", collectorIds)
        : Promise.resolve({ data: [] as Array<{ id: string; first_name: string | null; last_name: string | null; employee_code: string | null }>, error: null }),
    ]);

    const debtorCountByRoute = new Map<string, number>();
    for (const row of (debtors as Array<{ id: string; route_id: string | null }> | null) || []) {
      if (!row.route_id) continue;
      debtorCountByRoute.set(row.route_id, (debtorCountByRoute.get(row.route_id) || 0) + 1);
    }

    const collectorMap = new Map(
      ((collectors as Array<{ id: string; first_name: string | null; last_name: string | null; employee_code: string | null }> | null) || []).map((row) => [
        row.id,
        fullName(row.first_name, row.last_name) === "Collector" ? row.employee_code || "Collector" : fullName(row.first_name, row.last_name),
      ])
    );

    return NextResponse.json({
      rows: routes.map((row) => ({
        id: row.id,
        name: row.name,
        area: row.area || "Coverage area",
        collector: row.collector_id ? collectorMap.get(row.collector_id) || "Collector" : "Unassigned",
        debtors: debtorCountByRoute.get(row.id) || 0,
        status: row.is_active ? "active" : "inactive",
      })),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load routes";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
