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

    if (session.role !== "creditor") {
      return NextResponse.json({ rows: [] });
    }

    const { data, error } = await supabase
      .from("collectors")
      .select("id, first_name, last_name, employee_code, phone, invite_status, is_active, assigned_routes")
      .eq("creditor_id", session.creditorId)
      .order("updated_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const collectors = (data as Array<{
      id: string;
      first_name: string | null;
      last_name: string | null;
      employee_code: string | null;
      phone: string | null;
      invite_status: string | null;
      is_active: boolean;
      assigned_routes: string[] | null;
    }> | null) || [];

    return NextResponse.json({
      rows: collectors.map((row) => ({
        id: row.id,
        name: fullName(row.first_name, row.last_name),
        employeeCode: row.employee_code || "Pending code",
        phone: row.phone || "No phone",
        routes: Array.isArray(row.assigned_routes) ? row.assigned_routes.length : 0,
        status: row.invite_status || (row.is_active ? "active" : "inactive"),
      })),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load collectors";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
