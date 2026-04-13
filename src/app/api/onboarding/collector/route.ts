import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAppSessionContextByClerkId } from "@/lib/auth/get-app-session-context";

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const supabase = createAdminClient();
    const session = await getAppSessionContextByClerkId(userId);

    const { data: profile, error: profileError } = await supabase
      .from("users")
      .select("id, email, first_name, last_name, phone, role")
      .eq("id", session.appUser.id)
      .maybeSingle();

    if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 });

    if (!session.collector) {
      return NextResponse.json({
        profile: profile || null,
        collector: null,
        organization: session.organization,
        onboardingRequired: false,
      });
    }

    return NextResponse.json({
      profile: profile || null,
      collector: session.collector,
      organization: session.organization,
      onboardingRequired: session.onboardingRequired,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load collector onboarding";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const supabase = createAdminClient();
    const session = await getAppSessionContextByClerkId(userId);

    if (session.role !== "collector" || !session.collector) {
      return NextResponse.json({ error: "Collector onboarding is only available for collectors" }, { status: 403 });
    }

    const payload = (await req.json()) as {
      first_name?: string;
      last_name?: string;
      phone?: string | null;
    };

    const firstName = String(payload.first_name || "").trim();
    const lastName = String(payload.last_name || "").trim();

    if (!firstName || !lastName) {
      return NextResponse.json({ error: "First name and last name are required" }, { status: 400 });
    }

    const phone = payload.phone ? String(payload.phone).trim() : null;

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

    const collectorUpdates: Record<string, string> = {};
    if ("accepted_at" in session.collector && !session.collector.accepted_at) {
      collectorUpdates.accepted_at = new Date().toISOString();
    }
    if ("onboarding_completed_at" in session.collector) {
      collectorUpdates.onboarding_completed_at = new Date().toISOString();
    }
    if ("invite_status" in session.collector) {
      collectorUpdates.invite_status = "active";
    }

    let collector = session.collector;
    if (Object.keys(collectorUpdates).length > 0) {
      const { data: updatedCollector, error: collectorError } = await supabase
        .from("collectors")
        .update(collectorUpdates)
        .eq("id", session.collector.id)
        .select("*")
        .maybeSingle();

      if (collectorError) {
        return NextResponse.json({ error: collectorError.message }, { status: 500 });
      }

      collector = (updatedCollector as typeof session.collector | null) || { ...session.collector, ...collectorUpdates };
    }

    return NextResponse.json({
      ok: true,
      profile,
      collector,
      redirectTo: "/dashboard",
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to complete collector onboarding";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
