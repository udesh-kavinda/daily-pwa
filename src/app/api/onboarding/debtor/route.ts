import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAppSessionContextByClerkId } from "@/lib/auth/get-app-session-context";
import { getDebtorPortalData } from "@/lib/debtor-portal";

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const session = await getAppSessionContextByClerkId(userId);

    const { data: profile, error: profileError } = await createAdminClient()
      .from("users")
      .select("id, email, first_name, last_name, phone, role")
      .eq("id", session.appUser.id)
      .maybeSingle();

    if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 });

    if (session.debtors.length === 0) {
      return NextResponse.json({
        profile: profile || null,
        debtor: null,
        debtors: [],
        organization: session.organization,
        organizations: session.organizations,
        onboardingRequired: false,
        summary: null,
      });
    }

    const { summary } = await getDebtorPortalData(session);

    return NextResponse.json({
      profile: profile || null,
      debtor: session.debtor,
      debtors: session.debtors,
      organization: session.organization,
      organizations: session.organizations,
      onboardingRequired: session.onboardingRequired,
      summary,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load debtor onboarding";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const supabase = createAdminClient();
    const session = await getAppSessionContextByClerkId(userId);

    if (session.role !== "debtor" || session.debtors.length === 0) {
      return NextResponse.json({ error: "Debtor onboarding is only available for debtors" }, { status: 403 });
    }

    const payload = (await req.json()) as {
      first_name?: string;
      last_name?: string;
      phone?: string | null;
    };

    const firstName = String(payload.first_name || "").trim();
    const lastName = String(payload.last_name || "").trim();
    const phone = payload.phone ? String(payload.phone).trim() : null;

    if (!firstName || !lastName) {
      return NextResponse.json({ error: "First name and last name are required" }, { status: 400 });
    }

    const { data: profile, error: profileError } = await supabase
      .from("users")
      .update({
        first_name: firstName,
        last_name: lastName,
        phone,
        updated_at: new Date().toISOString(),
      })
      .eq("id", session.appUser.id)
      .select("id, email, first_name, last_name, phone, role")
      .single();

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 500 });
    }

    const debtorIds = session.debtors.map((debtor) => debtor.id);
    const acceptedAt = session.debtors.find((debtor) => debtor.accepted_at)?.accepted_at || new Date().toISOString();

    const { data: debtors, error: debtorError } = await supabase
      .from("debtors")
      .update({
        accepted_at: acceptedAt,
        onboarding_completed_at: new Date().toISOString(),
        invite_status: "active",
        updated_at: new Date().toISOString(),
      })
      .in("id", debtorIds)
      .select("*");

    if (debtorError) {
      return NextResponse.json({ error: debtorError.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      profile,
      debtor: debtors?.[0] || null,
      debtors: debtors || [],
      redirectTo: "/dashboard",
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to complete debtor onboarding";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
