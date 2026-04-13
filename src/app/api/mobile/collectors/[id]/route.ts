import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { loadMobileCollectorDetailByClerkId, MobileCollectorDetailError } from "@/lib/mobile-collector-detail";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const payload = await loadMobileCollectorDetailByClerkId(userId, id);
    return NextResponse.json(payload);
  } catch (error: unknown) {
    if (error instanceof MobileCollectorDetailError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load collector detail" },
      { status: 500 }
    );
  }
}
