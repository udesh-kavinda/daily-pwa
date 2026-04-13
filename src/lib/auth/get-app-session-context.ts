import { createAdminClient } from "@/lib/supabase/admin";
import { getOrCreateAppUserByClerkId } from "@/lib/auth/get-or-create-app-user";

type SupportedRole = "creditor" | "collector" | "recovery_agent" | "debtor";

type AppUserRow = {
  id: string;
  clerk_id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  role: SupportedRole;
  avatar_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type CollectorRow = {
  id: string;
  user_id: string | null;
  creditor_id: string;
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
  employee_code?: string | null;
  invite_email?: string | null;
  assigned_routes?: string[] | null;
  invite_status?: string | null;
  invited_at?: string | null;
  accepted_at?: string | null;
  onboarding_completed_at?: string | null;
  photo_url?: string | null;
  is_active?: boolean;
};

type DebtorRow = {
  id: string;
  user_id: string | null;
  creditor_id: string;
  collector_id?: string | null;
  portal_email?: string | null;
  invite_status?: string | null;
  invited_at?: string | null;
  accepted_at?: string | null;
  onboarding_completed_at?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
};

type OrganizationSummary = {
  id: string;
  name: string | null;
  ownerName: string | null;
  ownerEmail: string | null;
};

export type AppSessionContext = {
  appUser: AppUserRow;
  role: SupportedRole;
  creditorId: string;
  collector: CollectorRow | null;
  debtor: DebtorRow | null;
  debtors: DebtorRow[];
  organization: OrganizationSummary | null;
  organizations: OrganizationSummary[];
  onboardingRequired: boolean;
  onboardingPath: string | null;
};

async function markCollectorAcceptedIfNeeded(collector: CollectorRow): Promise<CollectorRow> {
  const nextUpdates: Record<string, string> = {};

  if ("accepted_at" in collector && !collector.accepted_at) {
    nextUpdates.accepted_at = new Date().toISOString();
  }

  if (
    "invite_status" in collector &&
    (collector.invite_status === "pending" || collector.invite_status === "invited" || !collector.invite_status)
  ) {
    nextUpdates.invite_status = "accepted";
  }

  if (Object.keys(nextUpdates).length === 0) {
    return collector;
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("collectors")
    .update(nextUpdates)
    .eq("id", collector.id)
    .select("*")
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as CollectorRow | null) || { ...collector, ...nextUpdates };
}

async function markDebtorAcceptedIfNeeded(debtor: DebtorRow): Promise<DebtorRow> {
  const nextUpdates: Record<string, string> = {};

  if ("accepted_at" in debtor && !debtor.accepted_at) {
    nextUpdates.accepted_at = new Date().toISOString();
  }

  if (
    "invite_status" in debtor &&
    (debtor.invite_status === "pending" || debtor.invite_status === "invited" || !debtor.invite_status)
  ) {
    nextUpdates.invite_status = "accepted";
  }

  if (Object.keys(nextUpdates).length === 0) {
    return debtor;
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("debtors")
    .update(nextUpdates)
    .eq("id", debtor.id)
    .select("*")
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as DebtorRow | null) || { ...debtor, ...nextUpdates };
}

async function markDebtorsAcceptedIfNeeded(debtors: DebtorRow[]): Promise<DebtorRow[]> {
  return Promise.all(debtors.map((debtor) => markDebtorAcceptedIfNeeded(debtor)));
}

function selectPrimaryDebtor(debtors: DebtorRow[]) {
  return debtors.find((debtor) => !debtor.onboarding_completed_at) || debtors[0] || null;
}

export async function getAppSessionContextByClerkId(clerkId: string): Promise<AppSessionContext> {
  const supabase = createAdminClient();
  const ensuredUser = await getOrCreateAppUserByClerkId(clerkId);

  const { data: user, error: userError } = await supabase
    .from("users")
    .select("id, clerk_id, email, first_name, last_name, phone, role, avatar_url, is_active, created_at, updated_at")
    .eq("id", ensuredUser.id)
    .maybeSingle();

  if (userError || !user) {
    throw new Error(userError?.message || "App user not found");
  }

  let collector: CollectorRow | null = null;
  let debtor: DebtorRow | null = null;
  let debtors: DebtorRow[] = [];
  let creditorId = user.id;

  if (user.role === "collector") {
    const { data: collectorRow, error: collectorError } = await supabase
      .from("collectors")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (collectorError) {
      throw new Error(collectorError.message);
    }

    collector = (collectorRow as CollectorRow | null) || null;

    if (collector?.creditor_id) {
      creditorId = collector.creditor_id;
      collector = await markCollectorAcceptedIfNeeded(collector);
    }
  }

  if (user.role === "debtor") {
    const { data: debtorRows, error: debtorError } = await supabase
      .from("debtors")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });

    if (debtorError) {
      throw new Error(debtorError.message);
    }

    debtors = (debtorRows as DebtorRow[] | null) || [];

    if (debtors.length > 0) {
      debtors = await markDebtorsAcceptedIfNeeded(debtors);
      debtor = selectPrimaryDebtor(debtors);
      creditorId = debtor?.creditor_id || creditorId;
    }
  }

  const creditorIds = user.role === "debtor"
    ? [...new Set(debtors.map((entry) => entry.creditor_id).filter(Boolean))]
    : [creditorId];

  const [{ data: creditorSettingsRows, error: creditorSettingsError }, { data: creditorUsers, error: creditorUserError }] = creditorIds.length > 0
    ? await Promise.all([
        supabase
          .from("creditor_settings")
          .select("user_id, business_name")
          .in("user_id", creditorIds),
        supabase
          .from("users")
          .select("id, first_name, last_name, email")
          .in("id", creditorIds),
      ])
    : [{ data: [], error: null }, { data: [], error: null }];

  if (creditorSettingsError) {
    throw new Error(creditorSettingsError.message);
  }

  if (creditorUserError) {
    throw new Error(creditorUserError.message);
  }

  const creditorSettingsById = new Map(
    ((creditorSettingsRows as Array<{ user_id: string; business_name: string | null }> | null) || [])
      .map((entry) => [entry.user_id, entry.business_name])
  );
  const creditorUsersById = new Map(
    ((creditorUsers as Array<{ id: string; first_name: string | null; last_name: string | null; email: string | null }> | null) || [])
      .map((entry) => [entry.id, entry])
  );

  const organizations = creditorIds.map((id) => {
    const creditorUser = creditorUsersById.get(id);
    const ownerName = creditorUser
      ? `${creditorUser.first_name || ""} ${creditorUser.last_name || ""}`.trim() || null
      : null;

    return {
      id,
      name: creditorSettingsById.get(id) || ownerName || "Daily+ Organization",
      ownerName,
      ownerEmail: creditorUser?.email || null,
    };
  });

  const organization = organizations.length > 1
    ? {
        id: "multi",
        name: "Multiple Creditors",
        ownerName: null,
        ownerEmail: null,
      }
    : organizations[0] || null;

  const onboardingTracked = Boolean(collector) && "onboarding_completed_at" in (collector as CollectorRow);
  const debtorOnboardingTracked = debtors.some((entry) => "onboarding_completed_at" in entry);
  const onboardingRequired = (
    user.role === "collector" &&
    onboardingTracked &&
    !collector?.onboarding_completed_at
  ) || (
    user.role === "debtor" &&
    debtors.length > 0 &&
    debtorOnboardingTracked &&
    debtors.some((entry) => !entry.onboarding_completed_at)
  );

  return {
    appUser: user as AppUserRow,
    role: user.role,
    creditorId,
    collector,
    debtor,
    debtors,
    organization,
    organizations,
    onboardingRequired,
    onboardingPath: onboardingRequired
      ? user.role === "debtor"
        ? "/dashboard/onboarding/debtor"
        : "/dashboard/onboarding/collector"
      : null,
  };
}
