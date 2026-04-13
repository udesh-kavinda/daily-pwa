import { clerkClient } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/admin";

type AppUser = {
  id: string;
  role: string;
};

type SupportedRole = "creditor" | "collector" | "recovery_agent" | "debtor";

type ClerkLikeUser = {
  firstName?: string | null;
  lastName?: string | null;
  imageUrl?: string | null;
  publicMetadata?: Record<string, unknown>;
  unsafeMetadata?: Record<string, unknown>;
  primaryEmailAddressId?: string | null;
  emailAddresses?: Array<{ id?: string | null; emailAddress?: string | null }>;
};

type CollectorMembership = {
  id: string;
  creditor_id: string;
  user_id: string | null;
  invite_email: string | null;
};

type DebtorMembership = {
  id: string;
  creditor_id: string;
  user_id: string | null;
  portal_email: string | null;
  accepted_at?: string | null;
  onboarding_completed_at?: string | null;
};

function isMissingDebtorPortalColumnError(message: string) {
  return message.includes("column debtors.portal_email does not exist") ||
    message.includes("column debtors.accepted_at does not exist") ||
    message.includes("column debtors.onboarding_completed_at does not exist") ||
    message.includes("Could not find the 'portal_email' column of 'debtors'") ||
    message.includes("Could not find the 'accepted_at' column of 'debtors'") ||
    message.includes("Could not find the 'onboarding_completed_at' column of 'debtors'");
}

function isSupportedRole(value: unknown): value is SupportedRole {
  return value === "creditor" || value === "collector" || value === "recovery_agent" || value === "debtor";
}

function getPrimaryEmail(clerkUser: ClerkLikeUser): string | null {
  const primary = clerkUser.emailAddresses?.find((entry) => entry.id === clerkUser.primaryEmailAddressId);
  const fallback = clerkUser.emailAddresses?.[0];
  return primary?.emailAddress || fallback?.emailAddress || null;
}

function normalizeEmail(value: string | null | undefined): string | null {
  const trimmed = String(value || "").trim().toLowerCase();
  return trimmed || null;
}

function getMetadataValue(metadata: Record<string, unknown> | undefined, key: string): string | null {
  const value = metadata?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

async function getClerkUser(clerkId: string): Promise<ClerkLikeUser | null> {
  try {
    const client = await clerkClient();
    const user = await client.users.getUser(clerkId);
    return user as ClerkLikeUser;
  } catch {
    return null;
  }
}

async function ensureCreditorSettings(userId: string, firstName: string, lastName: string) {
  const supabase = createAdminClient();
  const { data: existing, error: existingError } = await supabase
    .from("creditor_settings")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  if (existingError) throw new Error(existingError.message);
  if (existing) return;

  const businessName = `${firstName} ${lastName}`.trim() || "Daily+ Creditor";
  const { error } = await supabase.from("creditor_settings").insert({
    user_id: userId,
    business_name: businessName,
    default_interest_rate: 10,
    default_loan_tenure: 30,
    currency: "LKR",
    timezone: "Asia/Colombo",
  });

  if (error) throw new Error(error.message);
}

async function findCollectorMembership(clerkUser: ClerkLikeUser): Promise<CollectorMembership | null> {
  const supabase = createAdminClient();
  const publicMetadata = clerkUser.publicMetadata;
  const unsafeMetadata = clerkUser.unsafeMetadata;
  const collectorId =
    getMetadataValue(publicMetadata, "collectorId") ||
    getMetadataValue(unsafeMetadata, "collectorId");
  const inviteEmail = getPrimaryEmail(clerkUser);

  if (collectorId) {
    const { data, error } = await supabase
      .from("collectors")
      .select("id, creditor_id, user_id, invite_email")
      .eq("id", collectorId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (data) return data;
  }

  if (!inviteEmail) return null;

  const { data, error } = await supabase
    .from("collectors")
    .select("id, creditor_id, user_id, invite_email")
    .ilike("invite_email", inviteEmail)
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data || null;
}

async function findCollectorMembershipByUserId(appUserId: string): Promise<CollectorMembership | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("collectors")
    .select("id, creditor_id, user_id, invite_email")
    .eq("user_id", appUserId)
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data || null;
}

function dedupeDebtorMemberships(rows: DebtorMembership[]) {
  return Array.from(new Map(rows.map((row) => [row.id, row])).values());
}

async function findDebtorMemberships(clerkUser: ClerkLikeUser): Promise<DebtorMembership[]> {
  const supabase = createAdminClient();
  const publicMetadata = clerkUser.publicMetadata;
  const unsafeMetadata = clerkUser.unsafeMetadata;
  const debtorId =
    getMetadataValue(publicMetadata, "debtorId") ||
    getMetadataValue(unsafeMetadata, "debtorId");
  const portalEmail = normalizeEmail(getPrimaryEmail(clerkUser));
  const matches: DebtorMembership[] = [];

  if (debtorId) {
    const { data, error } = await supabase
      .from("debtors")
      .select("id, creditor_id, user_id, portal_email, accepted_at, onboarding_completed_at")
      .eq("id", debtorId)
      .maybeSingle();

    if (error) {
      if (isMissingDebtorPortalColumnError(error.message)) return [];
      throw new Error(error.message);
    }
    if (data) matches.push(data);
  }

  if (!portalEmail) return dedupeDebtorMemberships(matches);

  const { data, error } = await supabase
    .from("debtors")
    .select("id, creditor_id, user_id, portal_email, accepted_at, onboarding_completed_at")
    .eq("portal_email", portalEmail)
    .order("created_at", { ascending: false });

  if (error) {
    if (isMissingDebtorPortalColumnError(error.message)) return dedupeDebtorMemberships(matches);
    throw new Error(error.message);
  }
  return dedupeDebtorMemberships([...(data || []), ...matches] as DebtorMembership[]);
}

async function findDebtorMembershipsByUserId(appUserId: string): Promise<DebtorMembership[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("debtors")
    .select("id, creditor_id, user_id, portal_email, accepted_at, onboarding_completed_at")
    .eq("user_id", appUserId)
    .order("created_at", { ascending: false });

  if (error) {
    if (isMissingDebtorPortalColumnError(error.message)) return [];
    throw new Error(error.message);
  }
  return (data as DebtorMembership[] | null) || [];
}

async function linkCollectorMembership(
  appUserId: string,
  clerkUser: ClerkLikeUser,
  matchedCollector: CollectorMembership | null = null
) {
  const supabase = createAdminClient();
  const inviteEmail = getPrimaryEmail(clerkUser);
  const collector = matchedCollector || await findCollectorMembership(clerkUser);

  if (collector) {
    const { error } = await supabase
      .from("collectors")
      .update({ user_id: appUserId, invite_email: inviteEmail || collector.invite_email || null })
      .eq("id", collector.id);

    if (error) throw new Error(error.message);
    return;
  }

  if (!inviteEmail) return;

  const { error } = await supabase
    .from("collectors")
    .update({ user_id: appUserId })
    .is("user_id", null)
    .ilike("invite_email", inviteEmail);

  if (error) throw new Error(error.message);
}

async function linkDebtorMembership(
  appUserId: string,
  clerkUser: ClerkLikeUser,
  matchedDebtors: DebtorMembership[] = []
) {
  const supabase = createAdminClient();
  const portalEmail = normalizeEmail(getPrimaryEmail(clerkUser));
  const debtors = matchedDebtors.length > 0 ? matchedDebtors : await findDebtorMemberships(clerkUser);
  const debtorIds = debtors.map((debtor) => debtor.id);

  if (debtorIds.length > 0) {
    const { error } = await supabase
      .from("debtors")
      .update({ user_id: appUserId, portal_email: portalEmail || normalizeEmail(debtors[0]?.portal_email) || null })
      .in("id", debtorIds);

    if (error) {
      if (!isMissingDebtorPortalColumnError(error.message)) throw new Error(error.message);
      const legacyLink = await supabase
        .from("debtors")
        .update({ user_id: appUserId })
        .in("id", debtorIds);
      if (legacyLink.error) throw new Error(legacyLink.error.message);
    }
  }

  if (!portalEmail) return;

  const { error } = await supabase
    .from("debtors")
    .update({ user_id: appUserId, portal_email: portalEmail })
    .is("user_id", null)
    .eq("portal_email", portalEmail);

  if (error && !isMissingDebtorPortalColumnError(error.message)) throw new Error(error.message);
}

async function hasPendingCollectorInvite(email: string): Promise<boolean> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("collectors")
    .select("id")
    .is("user_id", null)
    .ilike("invite_email", email)
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return Boolean(data);
}

async function hasPendingDebtorInvite(email: string): Promise<boolean> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("debtors")
    .select("id")
    .is("user_id", null)
    .eq("portal_email", normalizeEmail(email) || "")
    .limit(1);

  if (error) {
    if (isMissingDebtorPortalColumnError(error.message)) return false;
    throw new Error(error.message);
  }
  return Boolean(data && data.length > 0);
}

export async function getOrCreateAppUserByClerkId(clerkId: string): Promise<AppUser> {
  const supabase = createAdminClient();
  const clerkUser = await getClerkUser(clerkId);
  const publicRole = clerkUser?.publicMetadata?.role;
  const unsafeRole = clerkUser?.unsafeMetadata?.role;
  const invitedFirstName =
    getMetadataValue(clerkUser?.publicMetadata, "invitedFirstName") ||
    getMetadataValue(clerkUser?.unsafeMetadata, "invitedFirstName");
  const invitedLastName =
    getMetadataValue(clerkUser?.publicMetadata, "invitedLastName") ||
    getMetadataValue(clerkUser?.unsafeMetadata, "invitedLastName");
  const invitedPhone =
    getMetadataValue(clerkUser?.publicMetadata, "invitedPhone") ||
    getMetadataValue(clerkUser?.unsafeMetadata, "invitedPhone");
  const email = normalizeEmail(getPrimaryEmail(clerkUser || {})) || `${clerkId}@local.invalid`;
  const { data: existing, error: existingError } = await supabase
    .from("users")
    .select("id, role")
    .eq("clerk_id", clerkId)
    .maybeSingle();

  if (existingError) {
    throw new Error(existingError.message);
  }

  const invitedCollectorMembership = clerkUser ? await findCollectorMembership(clerkUser) : null;
  const existingCollectorMembership = existing ? await findCollectorMembershipByUserId(existing.id) : null;
  const collectorMembership = existingCollectorMembership || invitedCollectorMembership;
  const invitedDebtorMemberships = clerkUser ? await findDebtorMemberships(clerkUser) : [];
  const existingDebtorMemberships = existing ? await findDebtorMembershipsByUserId(existing.id) : [];
  const debtorMemberships = dedupeDebtorMemberships([...existingDebtorMemberships, ...invitedDebtorMemberships]);
  const pendingCollectorInvite = !collectorMembership && email ? await hasPendingCollectorInvite(email) : false;
  const pendingDebtorInvite = debtorMemberships.length === 0 && email ? await hasPendingDebtorInvite(email) : false;
  const resolvedRole: SupportedRole = collectorMembership
    ? "collector"
    : debtorMemberships.length > 0
      ? "debtor"
      : isSupportedRole(publicRole)
        ? publicRole
        : isSupportedRole(unsafeRole)
          ? unsafeRole
          : pendingCollectorInvite
            ? "collector"
            : pendingDebtorInvite
              ? "debtor"
              : "creditor";
  const firstName = clerkUser?.firstName?.trim() || invitedFirstName || "User";
  const lastName = clerkUser?.lastName?.trim() || invitedLastName || (resolvedRole === "collector" ? "Collector" : "Account");
  const phone = invitedPhone || null;
  const avatarUrl = clerkUser?.imageUrl || null;

  if (existing) {
    const nextRole: SupportedRole = collectorMembership
      ? "collector"
      : debtorMemberships.length > 0
        ? "debtor"
        : resolvedRole || (existing.role as SupportedRole);
    const { error: updateError } = await supabase
      .from("users")
      .update({
        email,
        first_name: firstName,
        last_name: lastName,
        phone,
        avatar_url: avatarUrl,
        role: nextRole,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);

    if (updateError) {
      throw new Error(updateError.message);
    }

    if (nextRole === "creditor") {
      await ensureCreditorSettings(existing.id, firstName, lastName);
    }

    if (nextRole === "collector" && clerkUser) {
      await linkCollectorMembership(existing.id, clerkUser, collectorMembership);
    }

    if (nextRole === "debtor" && clerkUser) {
      await linkDebtorMembership(existing.id, clerkUser, debtorMemberships);
    }

    return { id: existing.id, role: nextRole };
  }

  const { data: inserted, error: insertError } = await supabase
    .from("users")
    .insert({
      clerk_id: clerkId,
      email,
      first_name: firstName,
      last_name: lastName,
      phone,
      avatar_url: avatarUrl,
      role: resolvedRole,
      is_active: true,
      created_by: null,
    })
    .select("id, role")
    .single();

  if (insertError || !inserted) {
    const { data: afterConflict, error: afterConflictError } = await supabase
      .from("users")
      .select("id, role")
      .eq("clerk_id", clerkId)
      .maybeSingle();

    if (afterConflictError || !afterConflict) {
      throw new Error(insertError?.message || afterConflictError?.message || "Failed to create app user");
    }

    const nextRole: SupportedRole = collectorMembership
      ? "collector"
      : debtorMemberships.length > 0
        ? "debtor"
        : (afterConflict.role as SupportedRole);
    const { error: conflictUpdateError } = await supabase
      .from("users")
      .update({
        email,
        first_name: firstName,
        last_name: lastName,
        phone,
        avatar_url: avatarUrl,
        role: nextRole,
        updated_at: new Date().toISOString(),
      })
      .eq("id", afterConflict.id);

    if (conflictUpdateError) {
      throw new Error(conflictUpdateError.message);
    }

    if (nextRole === "creditor") {
      await ensureCreditorSettings(afterConflict.id, firstName, lastName);
    }

    if (nextRole === "collector" && clerkUser) {
      await linkCollectorMembership(afterConflict.id, clerkUser, collectorMembership);
    }

    if (nextRole === "debtor" && clerkUser) {
      await linkDebtorMembership(afterConflict.id, clerkUser, debtorMemberships);
    }

    return { id: afterConflict.id, role: nextRole };
  }

  if (resolvedRole === "creditor") {
    await ensureCreditorSettings(inserted.id, firstName, lastName);
  }

  if (resolvedRole === "collector" && clerkUser) {
    await linkCollectorMembership(inserted.id, clerkUser, collectorMembership);
  }

  if (resolvedRole === "debtor" && clerkUser) {
    await linkDebtorMembership(inserted.id, clerkUser, debtorMemberships);
  }

  return inserted as AppUser;
}
