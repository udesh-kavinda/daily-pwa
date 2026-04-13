import { createAdminClient } from "@/lib/supabase/admin";
import { getAppSessionContextByClerkId } from "@/lib/auth/get-app-session-context";

function fullName(firstName: string | null, lastName: string | null) {
  return `${firstName || ""} ${lastName || ""}`.trim() || "Collector";
}

export type CollectorDetailResponse = {
  collector: {
    id: string;
    name: string;
    employeeCode: string;
    phone: string;
    alternatePhone: string;
    address: string;
    notes: string | null;
    status: string;
    inviteEmail: string;
  };
  summary: {
    debtors: number;
    activeLoans: number;
    routes: number;
  };
  routes: Array<{
    id: string;
    name: string;
    area: string;
  }>;
};

export class MobileCollectorDetailError extends Error {
  status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.status = status;
  }
}

export async function loadMobileCollectorDetailByClerkId(
  userId: string,
  id: string
): Promise<CollectorDetailResponse> {
  const session = await getAppSessionContextByClerkId(userId);
  if (session.role !== "creditor") {
    throw new MobileCollectorDetailError("Creditor access required", 403);
  }

  const supabase = createAdminClient();

  const { data: collector, error: collectorError } = await supabase
    .from("collectors")
    .select(
      "id, first_name, last_name, employee_code, phone, alternate_phone, address, notes, invite_status, is_active, assigned_routes, invite_email"
    )
    .eq("creditor_id", session.creditorId)
    .eq("id", id)
    .maybeSingle();

  if (collectorError || !collector) {
    throw new MobileCollectorDetailError(collectorError?.message || "Collector not found", 404);
  }

  const assignedRoutes = Array.isArray(collector.assigned_routes) ? collector.assigned_routes : [];
  const [{ data: routes }, { count: debtorCount }, { count: activeLoanCount }] = await Promise.all([
    assignedRoutes.length > 0
      ? supabase.from("routes").select("id, name, area").in("id", assignedRoutes)
      : Promise.resolve({
          data: [] as Array<{ id: string; name: string | null; area: string | null }>,
          error: null,
        }),
    supabase
      .from("debtors")
      .select("id", { count: "exact", head: true })
      .eq("collector_id", collector.id)
      .eq("creditor_id", session.creditorId),
    supabase
      .from("loans")
      .select("id", { count: "exact", head: true })
      .eq("collector_id", collector.id)
      .eq("creditor_id", session.creditorId)
      .in("status", ["active", "overdue", "approved", "pending_approval"]),
  ]);

  return {
    collector: {
      id: collector.id,
      name: fullName(collector.first_name, collector.last_name),
      employeeCode: collector.employee_code || "Pending code",
      phone: collector.phone || "No phone",
      alternatePhone: collector.alternate_phone || "No alternate phone",
      address: collector.address || "No address",
      notes: collector.notes || null,
      status: collector.invite_status || (collector.is_active ? "active" : "inactive"),
      inviteEmail: collector.invite_email || "No invite email",
    },
    summary: {
      debtors: debtorCount || 0,
      activeLoans: activeLoanCount || 0,
      routes: assignedRoutes.length,
    },
    routes: (((routes as Array<{ id: string; name: string | null; area: string | null }> | null) || []).map(
      (route) => ({
        id: route.id,
        name: route.name || "Route",
        area: route.area || "Coverage area",
      })
    )),
  };
}
