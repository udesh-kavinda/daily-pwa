import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAppSessionContextByClerkId } from "@/lib/auth/get-app-session-context";

function fullName(firstName: string | null, lastName: string | null) {
  return `${firstName || ""} ${lastName || ""}`.trim() || "Collector";
}

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const session = await getAppSessionContextByClerkId(userId);
    if (session.role !== "creditor") {
      return NextResponse.json({ error: "Creditor access required" }, { status: 403 });
    }

    const { id } = await params;
    const supabase = createAdminClient();

    const { data: collector, error: collectorError } = await supabase
      .from("collectors")
      .select("id, first_name, last_name, employee_code, phone, alternate_phone, address, notes, invite_status, is_active, assigned_routes, invite_email")
      .eq("creditor_id", session.creditorId)
      .eq("id", id)
      .maybeSingle();

    if (collectorError || !collector) {
      return NextResponse.json({ error: collectorError?.message || "Collector not found" }, { status: 404 });
    }

    const assignedRoutes = Array.isArray(collector.assigned_routes) ? collector.assigned_routes : [];
    const [{ data: routes }, { count: debtorCount }, { count: activeLoanCount }] = await Promise.all([
      assignedRoutes.length > 0
        ? supabase.from("routes").select("id, name, area").in("id", assignedRoutes)
        : Promise.resolve({ data: [] as Array<{ id: string; name: string | null; area: string | null }>, error: null }),
      supabase.from("debtors").select("id", { count: "exact", head: true }).eq("collector_id", collector.id).eq("creditor_id", session.creditorId),
      supabase.from("loans").select("id", { count: "exact", head: true }).eq("collector_id", collector.id).eq("creditor_id", session.creditorId).in("status", ["active", "overdue", "approved", "pending_approval"]),
    ]);

    return NextResponse.json({
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
      routes: ((routes as Array<{ id: string; name: string | null; area: string | null }> | null) || []).map((route) => ({
        id: route.id,
        name: route.name || "Route",
        area: route.area || "Coverage area",
      })),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load collector detail";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
