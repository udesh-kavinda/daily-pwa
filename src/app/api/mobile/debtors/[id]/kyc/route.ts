import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAppSessionContextByClerkId } from "@/lib/auth/get-app-session-context";
import { loadMobileDebtorKycByClerkId, MobileDebtorKycError } from "@/lib/mobile-debtor-kyc";

const BUCKET = "kyc-documents";
const MAX_FILE_SIZE = 10 * 1024 * 1024;

type QueryError = { message: string } | null;

type DebtorKycRow = {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  approval_status?: string | null;
  is_verified?: boolean | null;
  id_photo_front_url?: string | null;
  debtor_photo_url?: string | null;
  signature_url?: string | null;
};

function buildCollectorDebtorAccessFilter(collectorId: string) {
  return `collector_id.eq.${collectorId},requested_by_collector_id.eq.${collectorId}`;
}

function extFromFile(file: File) {
  const byName = file.name.split(".").pop();
  if (byName) return byName.toLowerCase();
  const byType = file.type.split("/").pop();
  return (byType || "bin").toLowerCase();
}

async function ensureBucket() {
  const supabase = createAdminClient();
  const { data: buckets, error } = await supabase.storage.listBuckets();
  if (error) throw new Error(error.message);

  const exists = (buckets || []).some((bucket) => bucket.name === BUCKET);
  if (exists) return;

  const { error: createError } = await supabase.storage.createBucket(BUCKET, {
    public: true,
    fileSizeLimit: `${MAX_FILE_SIZE}`,
  });
  if (createError && !createError.message.toLowerCase().includes("already")) {
    throw new Error(createError.message);
  }
}

async function resolveCollectorDebtor(params: {
  supabase: ReturnType<typeof createAdminClient>;
  debtorId: string;
  creditorId: string;
  collectorId: string;
}) {
  const { supabase, debtorId, creditorId, collectorId } = params;

  const primaryResult = await supabase
    .from("debtors")
    .select("id, first_name, last_name, approval_status, is_verified, id_photo_front_url, debtor_photo_url, signature_url")
    .eq("id", debtorId)
    .eq("creditor_id", creditorId)
    .or(buildCollectorDebtorAccessFilter(collectorId))
    .maybeSingle();

  let debtor = primaryResult.data as DebtorKycRow | null;
  let debtorError = primaryResult.error as QueryError;

  if (debtorError && debtorError.message.includes("requested_by_collector_id")) {
    const legacyResult = await supabase
      .from("debtors")
      .select("id, first_name, last_name, is_verified, id_photo_front_url, debtor_photo_url, signature_url")
      .eq("id", debtorId)
      .eq("creditor_id", creditorId)
      .eq("collector_id", collectorId)
      .maybeSingle();

    debtor = legacyResult.data
      ? {
          ...(legacyResult.data as DebtorKycRow),
          approval_status: "approved",
        }
      : null;
    debtorError = legacyResult.error as QueryError;
  }

  return { debtor, debtorError };
}

function debtorName(debtor: DebtorKycRow) {
  return `${debtor.first_name || ""} ${debtor.last_name || ""}`.trim() || "Debtor";
}

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const payload = await loadMobileDebtorKycByClerkId(userId, id);
    return NextResponse.json(payload);
  } catch (error: unknown) {
    if (error instanceof MobileDebtorKycError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    const message = error instanceof Error ? error.message : "Failed to load debtor KYC";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const session = await getAppSessionContextByClerkId(userId);
    if (session.role !== "collector" || !session.collector) {
      return NextResponse.json({ error: "Collector access is required" }, { status: 403 });
    }

    const { id } = await params;
    const supabase = createAdminClient();
    const { debtor, debtorError } = await resolveCollectorDebtor({
      supabase,
      debtorId: id,
      creditorId: session.creditorId,
      collectorId: session.collector.id,
    });

    if (debtorError || !debtor) {
      return NextResponse.json({ error: debtorError?.message || "Debtor not found" }, { status: 404 });
    }

    const form = await request.formData();
    const idFront = form.get("idFront");
    const photo = form.get("photo");
    const signature = form.get("signature");

    const providedFiles = {
      idFront: idFront instanceof File ? idFront : null,
      photo: photo instanceof File ? photo : null,
      signature: signature instanceof File ? signature : null,
    };
    const files = Object.values(providedFiles).filter((file): file is File => Boolean(file));

    if (files.length === 0) {
      return NextResponse.json({ error: "Choose at least one KYC file to upload" }, { status: 400 });
    }

    const tooLarge = files.find((file) => file.size > MAX_FILE_SIZE);
    if (tooLarge) {
      return NextResponse.json({ error: `File too large: ${tooLarge.name}` }, { status: 400 });
    }

    await ensureBucket();

    const uploadOne = async (path: string, file: File) => {
      const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
        cacheControl: "3600",
        upsert: true,
        contentType: file.type || "application/octet-stream",
      });
      if (error) throw new Error(error.message);
      const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
      return data.publicUrl;
    };

    const stamp = Date.now();
    const updates: Record<string, string | boolean> = {};

    if (providedFiles.idFront) {
      updates.id_photo_front_url = await uploadOne(
        `${session.creditorId}/${debtor.id}/${stamp}-id-front.${extFromFile(providedFiles.idFront)}`,
        providedFiles.idFront,
      );
    }

    if (providedFiles.photo) {
      updates.debtor_photo_url = await uploadOne(
        `${session.creditorId}/${debtor.id}/${stamp}-photo.${extFromFile(providedFiles.photo)}`,
        providedFiles.photo,
      );
    }

    if (providedFiles.signature) {
      updates.signature_url = await uploadOne(
        `${session.creditorId}/${debtor.id}/${stamp}-signature.${extFromFile(providedFiles.signature)}`,
        providedFiles.signature,
      );
    }

    const hasAllKyc = Boolean(
      (updates.id_photo_front_url || debtor.id_photo_front_url) &&
      (updates.debtor_photo_url || debtor.debtor_photo_url) &&
      (updates.signature_url || debtor.signature_url),
    );
    updates.is_verified = hasAllKyc;

    const { error: updateError } = await supabase
      .from("debtors")
      .update(updates)
      .eq("id", debtor.id)
      .eq("creditor_id", session.creditorId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      debtor: {
        id: debtor.id,
        name: debtorName(debtor),
      },
      kyc: {
        idFrontUrl: String(updates.id_photo_front_url || debtor.id_photo_front_url || ""),
        photoUrl: String(updates.debtor_photo_url || debtor.debtor_photo_url || ""),
        signatureUrl: String(updates.signature_url || debtor.signature_url || ""),
        idFront: Boolean(updates.id_photo_front_url || debtor.id_photo_front_url),
        photo: Boolean(updates.debtor_photo_url || debtor.debtor_photo_url),
        signature: Boolean(updates.signature_url || debtor.signature_url),
        isVerified: hasAllKyc,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to upload debtor KYC";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
