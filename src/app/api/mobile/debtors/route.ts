import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAppSessionContextByClerkId } from "@/lib/auth/get-app-session-context";

type DebtorRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  approval_status: string | null;
  is_active: boolean;
  route_id: string | null;
  collector_id: string | null;
  updated_at: string;
};

function fullName(firstName: string | null, lastName: string | null) {
  return `${firstName || ""} ${lastName || ""}`.trim() || "Debtor";
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
      .from("debtors")
      .select("id, first_name, last_name, phone, approval_status, is_active, route_id, collector_id, updated_at")
      .eq("creditor_id", session.creditorId)
      .order("updated_at", { ascending: false });

    if (session.role === "collector" && session.collector) {
      query = query.or(`collector_id.eq.${session.collector.id},requested_by_collector_id.eq.${session.collector.id}`);
    }

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const debtors = (data as DebtorRow[] | null) || [];
    const routeIds = [...new Set(debtors.map((row) => row.route_id).filter(Boolean))] as string[];
    const collectorIds = [...new Set(debtors.map((row) => row.collector_id).filter(Boolean))] as string[];

    const [{ data: routes }, { data: collectors }] = await Promise.all([
      routeIds.length > 0
        ? supabase.from("routes").select("id, name").in("id", routeIds)
        : Promise.resolve({ data: [] as Array<{ id: string; name: string | null }>, error: null }),
      collectorIds.length > 0
        ? supabase.from("collectors").select("id, first_name, last_name, employee_code").in("id", collectorIds)
        : Promise.resolve({ data: [] as Array<{ id: string; first_name: string | null; last_name: string | null; employee_code: string | null }>, error: null }),
    ]);

    const routeMap = new Map(((routes as Array<{ id: string; name: string | null }> | null) || []).map((row) => [row.id, row.name || "Route"]));
    const collectorMap = new Map(
      ((collectors as Array<{ id: string; first_name: string | null; last_name: string | null; employee_code: string | null }> | null) || []).map((row) => [
        row.id,
        fullName(row.first_name, row.last_name) === "Debtor" ? row.employee_code || "Collector" : fullName(row.first_name, row.last_name),
      ])
    );

    return NextResponse.json({
      rows: debtors.map((row) => ({
        id: row.id,
        name: fullName(row.first_name, row.last_name),
        phone: row.phone || "No phone",
        route: row.route_id ? routeMap.get(row.route_id) || "Route" : "Unassigned",
        collector: row.collector_id ? collectorMap.get(row.collector_id) || "Collector" : "Unassigned",
        status: row.approval_status || (row.is_active ? "approved" : "inactive"),
        updatedAt: row.updated_at,
      })),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load debtors";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
