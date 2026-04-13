import { createAdminClient } from "@/lib/supabase/admin";
import { getAppSessionContextByClerkId } from "@/lib/auth/get-app-session-context";

function fullName(firstName: string | null, lastName: string | null) {
  return `${firstName || ""} ${lastName || ""}`.trim() || "Collector";
}

export type RouteDetailResponse = {
  route: {
    id: string;
    name: string;
    area: string;
    description: string;
    status: string;
    collector: { id: string; name: string; employeeCode: string } | null;
  };
  summary: {
    debtors: number;
    activeLoans: number;
  };
  debtors: Array<{
    id: string;
    name: string;
    phone: string;
    status: string;
  }>;
};

export class MobileRouteDetailError extends Error {
  status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.status = status;
  }
}

export async function loadMobileRouteDetailByClerkId(
  userId: string,
  id: string
): Promise<RouteDetailResponse> {
  const session = await getAppSessionContextByClerkId(userId);
  if (session.role === "debtor") {
    throw new MobileRouteDetailError("Access denied", 403);
  }

  const supabase = createAdminClient();

  let routeQuery = supabase
    .from("routes")
    .select("id, name, area, description, is_active, collector_id")
    .eq("creditor_id", session.creditorId)
    .eq("id", id);

  if (session.role === "collector" && session.collector) {
    routeQuery = routeQuery.eq("collector_id", session.collector.id);
  }

  const { data: route, error: routeError } = await routeQuery.maybeSingle();
  if (routeError || !route) {
    throw new MobileRouteDetailError(routeError?.message || "Route not found", 404);
  }

  const [{ data: collector }, { data: debtors }] = await Promise.all([
    route.collector_id
      ? supabase
          .from("collectors")
          .select("id, first_name, last_name, employee_code")
          .eq("id", route.collector_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabase
      .from("debtors")
      .select("id, first_name, last_name, phone, approval_status")
      .eq("route_id", route.id)
      .eq("creditor_id", session.creditorId)
      .order("updated_at", { ascending: false })
      .limit(20),
  ]);

  const debtorIds = (((debtors as Array<{ id: string }> | null) || []).map((row) => row.id));
  const { count: activeLoans } =
    debtorIds.length > 0
      ? await supabase
          .from("loans")
          .select("id", { count: "exact", head: true })
          .eq("creditor_id", session.creditorId)
          .in("debtor_id", debtorIds)
      : { count: 0 };

  return {
    route: {
      id: route.id,
      name: route.name,
      area: route.area || "Coverage area",
      description: route.description || "No route description",
      status: route.is_active ? "active" : "inactive",
      collector: collector
        ? {
            id: collector.id,
            name: fullName(collector.first_name, collector.last_name),
            employeeCode: collector.employee_code || "Collector",
          }
        : null,
    },
    summary: {
      debtors: (debtors || []).length,
      activeLoans: activeLoans || 0,
    },
    debtors:
      (((debtors as Array<{
        id: string;
        first_name: string | null;
        last_name: string | null;
        phone: string | null;
        approval_status: string | null;
      }> | null) || []).map((debtor) => ({
        id: debtor.id,
        name: `${debtor.first_name || ""} ${debtor.last_name || ""}`.trim() || "Debtor",
        phone: debtor.phone || "No phone",
        status: debtor.approval_status || "approved",
      }))),
  };
}
