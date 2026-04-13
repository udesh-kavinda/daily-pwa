import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOrCreateAppUserByClerkId } from "@/lib/auth/get-or-create-app-user";
import { loadMobileNotifications } from "@/lib/mobile-notifications";

async function resolveAppUserId() {
  const { userId } = await auth();
  if (!userId) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const appUser = await getOrCreateAppUserByClerkId(userId);
  return { appUserId: appUser.id };
}

export async function GET(req: NextRequest) {
  try {
    const resolved = await resolveAppUserId();
    if (resolved.error) return resolved.error;

    const searchParams = new URL(req.url).searchParams;
    const limit = Number(searchParams.get("limit") || "40");
    const unreadOnly = searchParams.get("unreadOnly") === "true";
    const payload = await loadMobileNotifications(resolved.appUserId, { limit, unreadOnly });
    return NextResponse.json(payload);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load notifications";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const resolved = await resolveAppUserId();
    if (resolved.error) return resolved.error;

    const body = await req.json();
    const action = String(body?.action || "");
    const ids = Array.isArray(body?.ids) ? (body.ids as string[]).filter(Boolean) : [];
    const supabase = createAdminClient();

    if (action === "mark_all_read") {
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("user_id", resolved.appUserId)
        .eq("is_read", false);

      if (error) throw new Error(error.message);
      return NextResponse.json({ ok: true });
    }

    if (!ids.length) {
      return NextResponse.json({ error: "No notifications selected" }, { status: 400 });
    }

    if (action !== "mark_read" && action !== "mark_unread") {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    const { error } = await supabase
      .from("notifications")
      .update({ is_read: action === "mark_read" })
      .eq("user_id", resolved.appUserId)
      .in("id", ids);

    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to update notifications";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const resolved = await resolveAppUserId();
    if (resolved.error) return resolved.error;

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "delete_selected");
    const ids = Array.isArray(body?.ids) ? (body.ids as string[]).filter(Boolean) : [];
    const supabase = createAdminClient();

    if (action === "delete_read") {
      const { error } = await supabase
        .from("notifications")
        .delete()
        .eq("user_id", resolved.appUserId)
        .eq("is_read", true);

      if (error) throw new Error(error.message);
      return NextResponse.json({ ok: true });
    }

    if (!ids.length) {
      return NextResponse.json({ error: "No notifications selected" }, { status: 400 });
    }

    const { error } = await supabase
      .from("notifications")
      .delete()
      .eq("user_id", resolved.appUserId)
      .in("id", ids);

    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to delete notifications";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
