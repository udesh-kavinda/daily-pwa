import { NextResponse } from "next/server";
import { saveToken } from "@/lib/token-store";

export async function POST(request: Request) {
  const { token } = await request.json();

  if (!token) {
    return NextResponse.json({ ok: false, error: "Missing token" }, { status: 400 });
  }

  const entry = await saveToken(token);

  return NextResponse.json({ ok: true, entry });
}
