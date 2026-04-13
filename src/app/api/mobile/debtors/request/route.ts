import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAppSessionContextByClerkId } from "@/lib/auth/get-app-session-context";

type CreateDebtorRequestPayload = {
  firstName?: string;
  lastName?: string;
  phone?: string;
  portalEmail?: string | null;
  address?: string | null;
  idNumber?: string | null;
  routeId?: string | null;
  notes?: string | null;
};

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const session = await getAppSessionContextByClerkId(userId);
    if (session.role !== "collector" || !session.collector) {
      return NextResponse.json({ error: "Collector access is required" }, { status: 403 });
    }

    const supabase = createAdminClient();
    const assignedRouteIds = session.collector.assigned_routes || [];

    let routeQuery = supabase
      .from("routes")
      .select("id, name, area")
      .eq("creditor_id", session.creditorId)
      .eq("is_active", true)
      .order("name", { ascending: true });

    if (assignedRouteIds.length > 0) {
      routeQuery = routeQuery.in("id", assignedRouteIds);
    }

    const { data: routes, error } = await routeQuery;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      collector: {
        id: session.collector.id,
        employeeCode: session.collector.employee_code || null,
        assignedRoutes: assignedRouteIds.length,
      },
      routes: routes || [],
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load debtor request context";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const session = await getAppSessionContextByClerkId(userId);
    if (session.role !== "collector" || !session.collector) {
      return NextResponse.json({ error: "Collector access is required" }, { status: 403 });
    }

    const payload = (await req.json()) as CreateDebtorRequestPayload;
    const firstName = payload.firstName?.trim();
    const lastName = payload.lastName?.trim();
    const phone = payload.phone?.trim();
    const address = payload.address?.trim();

    if (!firstName || !lastName || !phone || !address) {
      return NextResponse.json({ error: "First name, last name, phone, and address are required" }, { status: 400 });
    }

    const supabase = createAdminClient();
    const now = new Date().toISOString();
    const newDebtor = {
      creditor_id: session.creditorId,
      collector_id: session.collector.id,
      requested_by_collector_id: session.collector.id,
      first_name: firstName,
      last_name: lastName,
      phone,
      portal_email: payload.portalEmail?.trim().toLowerCase() || null,
      address,
      id_number: payload.idNumber?.trim() || null,
      route_id: payload.routeId?.trim() || null,
      notes: payload.notes?.trim() || null,
      approval_status: "pending_approval",
      approval_requested_at: now,
      approved_by: null,
      approved_at: null,
      rejected_by: null,
      rejected_at: null,
      approval_note: null,
      invite_status: payload.portalEmail?.trim() ? "draft" : null,
      invited_at: null,
      accepted_at: null,
      onboarding_completed_at: null,
      is_verified: false,
      is_active: false,
      created_at: now,
      updated_at: now,
    };

    const { data: debtor, error } = await supabase
      .from("debtors")
      .insert(newDebtor)
      .select("id, first_name, last_name, approval_status, route_id, created_at")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const collectorName = `${session.appUser.first_name || ""} ${session.appUser.last_name || ""}`.trim() || "Collector";
    await supabase.from("notifications").insert({
      user_id: session.creditorId,
      title: "Debtor approval requested",
      message: `${collectorName} submitted ${firstName} ${lastName} for approval.`,
      type: "system",
      is_read: false,
      data: {
        debtor_id: debtor.id,
        collector_id: session.collector.id,
        approval_status: "pending_approval",
      },
    });

    return NextResponse.json({ ok: true, debtor });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to submit debtor request";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
