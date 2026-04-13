import { NextResponse } from "next/server";
import { adminMessaging } from "@/lib/firebase/admin";

export async function POST(request: Request) {
  const { token, title, body, data } = await request.json();

  if (!token) {
    return NextResponse.json({ ok: false, error: "Missing token" }, { status: 400 });
  }

  try {
    const messaging = adminMessaging();

    const message = {
      token,
      notification: {
        title: title || "Daily PWA",
        body: body || "You have a new notification.",
      },
      data: data || {},
    };

    const response = await messaging.send(message);

    return NextResponse.json({ ok: true, response });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: "Push send failed", details: String(error) },
      { status: 500 }
    );
  }
}
