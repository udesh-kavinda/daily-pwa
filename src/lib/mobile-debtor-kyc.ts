import { createAdminClient } from "@/lib/supabase/admin";
import { getAppSessionContextByClerkId } from "@/lib/auth/get-app-session-context";

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

export type MobileDebtorKycPayload = {
  debtor: {
    id: string;
    name: string;
    approvalStatus: string;
    detailHref: string;
    kyc: {
      idFrontUrl: string | null;
      photoUrl: string | null;
      signatureUrl: string | null;
      idFront: boolean;
      photo: boolean;
      signature: boolean;
      isVerified: boolean;
    };
  };
};

export class MobileDebtorKycError extends Error {
  status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.status = status;
  }
}

function buildCollectorDebtorAccessFilter(collectorId: string) {
  return `collector_id.eq.${collectorId},requested_by_collector_id.eq.${collectorId}`;
}

function debtorName(debtor: DebtorKycRow) {
  return `${debtor.first_name || ""} ${debtor.last_name || ""}`.trim() || "Debtor";
}

function isMissingDebtorColumnError(message: string, column: string) {
  return (
    message.includes(`column debtors.${column} does not exist`) ||
    message.includes(`Could not find the '${column}' column of 'debtors'`)
  );
}

export async function loadMobileDebtorKycByClerkId(
  userId: string,
  debtorId: string,
): Promise<MobileDebtorKycPayload> {
  const session = await getAppSessionContextByClerkId(userId);
  if (session.role !== "collector" && session.role !== "creditor") {
    throw new MobileDebtorKycError("Creditor or collector access is required", 403);
  }

  const supabase = createAdminClient();
  const baseQuery = supabase
    .from("debtors")
    .select("id, first_name, last_name, approval_status, is_verified, id_photo_front_url, debtor_photo_url, signature_url")
    .eq("id", debtorId)
    .eq("creditor_id", session.creditorId);

  const primaryResult =
    session.role === "collector" && session.collector
      ? await baseQuery.or(buildCollectorDebtorAccessFilter(session.collector.id)).maybeSingle()
      : await baseQuery.maybeSingle();

  let debtor = primaryResult.data as DebtorKycRow | null;
  let debtorError = primaryResult.error as QueryError;

  if (
    session.role === "collector" &&
    session.collector &&
    debtorError &&
    (debtorError.message.includes("requested_by_collector_id") ||
      isMissingDebtorColumnError(debtorError.message, "approval_status"))
  ) {
    const legacyResult = await supabase
      .from("debtors")
      .select("id, first_name, last_name, is_verified, id_photo_front_url, debtor_photo_url, signature_url")
      .eq("id", debtorId)
      .eq("creditor_id", session.creditorId)
      .eq("collector_id", session.collector.id)
      .maybeSingle();

    debtor = legacyResult.data
      ? {
          ...(legacyResult.data as DebtorKycRow),
          approval_status: "approved",
        }
      : null;
    debtorError = legacyResult.error as QueryError;
  }

  if (debtorError || !debtor) {
    throw new MobileDebtorKycError(debtorError?.message || "Debtor not found", 404);
  }

  return {
    debtor: {
      id: debtor.id,
      name: debtorName(debtor),
      approvalStatus: debtor.approval_status || "approved",
      detailHref: `/dashboard/debtors/${debtor.id}`,
      kyc: {
        idFrontUrl: debtor.id_photo_front_url || null,
        photoUrl: debtor.debtor_photo_url || null,
        signatureUrl: debtor.signature_url || null,
        idFront: Boolean(debtor.id_photo_front_url),
        photo: Boolean(debtor.debtor_photo_url),
        signature: Boolean(debtor.signature_url),
        isVerified: Boolean(
          debtor.is_verified ||
            (debtor.id_photo_front_url && debtor.debtor_photo_url && debtor.signature_url),
        ),
      },
    },
  };
}
