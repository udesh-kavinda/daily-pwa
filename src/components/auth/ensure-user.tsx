"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useUserStore } from "@/store";
import type { UserRole } from "@/types/database";
import { getMobileHomePath, isAllowedForMobileRole } from "@/lib/mobile-route-access";

type EnsureUserPayload = {
  ok?: boolean;
  user?: {
    id: string;
    clerk_id?: string | null;
    email: string;
    first_name: string;
    last_name: string;
    phone?: string | null;
    role: UserRole;
    avatar_url?: string | null;
    is_active?: boolean;
    created_at?: string;
    updated_at?: string;
  };
  role?: UserRole;
  creditorId?: string | null;
  collectorId?: string | null;
  onboardingRequired?: boolean;
  onboardingPath?: string | null;
  organization?: {
    id: string;
    name: string | null;
    ownerName: string | null;
    ownerEmail: string | null;
  } | null;
  organizations?: Array<{
    id: string;
    name: string | null;
    ownerName: string | null;
    ownerEmail: string | null;
  }>;
};

export function EnsureUser() {
  const pathname = usePathname();
  const router = useRouter();
  const { setLoading, setSession, clear } = useUserStore();

  useEffect(() => {
    let active = true;

    async function run() {
      setLoading(true);
      try {
        const response = await fetch("/api/auth/ensure-user", {
          method: "POST",
          cache: "no-store",
        });
        const payload = (await response.json().catch(() => null)) as EnsureUserPayload | null;

        if (!active) return;

        if (!response.ok || !payload?.user || !payload?.role) {
          clear();
          return;
        }

        setSession({
          user: {
            id: payload.user.id,
            clerk_id: payload.user.clerk_id || "",
            email: payload.user.email,
            first_name: payload.user.first_name,
            last_name: payload.user.last_name,
            phone: payload.user.phone || null,
            role: payload.role,
            avatar_url: payload.user.avatar_url || null,
            is_active: payload.user.is_active ?? true,
            created_by: null,
            created_at: payload.user.created_at || new Date().toISOString(),
            updated_at: payload.user.updated_at || new Date().toISOString(),
          },
          role: payload.role,
          creditorId: payload.creditorId || null,
          collectorId: payload.collectorId || null,
          onboardingRequired: Boolean(payload.onboardingRequired),
          organization: payload.organization || null,
          organizations: payload.organizations || [],
        });

        if (!isAllowedForMobileRole(pathname, payload.role)) {
          router.replace(getMobileHomePath(payload.role));
          return;
        }

        if (payload.onboardingRequired && payload.onboardingPath && pathname !== payload.onboardingPath) {
          router.replace(payload.onboardingPath);
          return;
        }

        if (
          !payload.onboardingRequired &&
          (pathname === "/dashboard/onboarding/collector" || pathname === "/dashboard/onboarding/debtor")
        ) {
          router.replace(getMobileHomePath(payload.role));
        }
      } catch {
        if (active) {
          clear();
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    run();

    return () => {
      active = false;
    };
  }, [pathname, router, setLoading, setSession, clear]);

  return null;
}
