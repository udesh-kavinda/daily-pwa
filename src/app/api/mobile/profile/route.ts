import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAppSessionContextByClerkId } from "@/lib/auth/get-app-session-context";
import { getDebtorPortalData } from "@/lib/debtor-portal";

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createAdminClient();
    const session = await getAppSessionContextByClerkId(userId);

    const { data: profile, error: profileError } = await supabase
      .from("users")
      .select("id, clerk_id, email, first_name, last_name, phone, role, avatar_url, is_active, created_at, updated_at")
      .eq("id", session.appUser.id)
      .maybeSingle();

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 500 });
    }

    let summary: Record<string, unknown> | null = null;

    if (session.role === "debtor") {
      const portal = await getDebtorPortalData(session);
      summary = portal.summary;
    }

    if (session.role === "collector" && session.collector) {
      summary = {
        employeeCode: session.collector.employee_code || null,
        assignedRoutes: session.collector.assigned_routes || [],
        inviteStatus: session.collector.invite_status || null,
      };
    }

    return NextResponse.json({
      profile: profile || null,
      role: session.role,
      organization: session.organization,
      organizations: session.organizations,
      collector: session.collector,
      debtor: session.debtor,
      debtors: session.debtors,
      summary,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load mobile profile";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
