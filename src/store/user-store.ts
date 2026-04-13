import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { User, UserRole } from "@/types/database";

type OrganizationSummary = {
  id: string;
  name: string | null;
  ownerName: string | null;
  ownerEmail: string | null;
};

interface UserState {
  user: User | null;
  role: UserRole | null;
  isLoading: boolean;
  creditorId: string | null;
  collectorId: string | null;
  onboardingRequired: boolean;
  organization: OrganizationSummary | null;
  organizations: OrganizationSummary[];
  setUser: (user: User | null) => void;
  setRole: (role: UserRole | null) => void;
  setLoading: (loading: boolean) => void;
  setCreditorId: (id: string | null) => void;
  setCollectorId: (id: string | null) => void;
  setSession: (session: {
    user: User | null;
    role: UserRole | null;
    creditorId: string | null;
    collectorId: string | null;
    onboardingRequired: boolean;
    organization: OrganizationSummary | null;
    organizations: OrganizationSummary[];
  }) => void;
  clear: () => void;
}

export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      user: null,
      role: null,
      isLoading: true,
      creditorId: null,
      collectorId: null,
      onboardingRequired: false,
      organization: null,
      organizations: [],
      setUser: (user) => set({ user, role: user?.role || null }),
      setRole: (role) => set({ role }),
      setLoading: (isLoading) => set({ isLoading }),
      setCreditorId: (creditorId) => set({ creditorId }),
      setCollectorId: (collectorId) => set({ collectorId }),
      setSession: (session) => set({ ...session, isLoading: false }),
      clear: () => set({
        user: null,
        role: null,
        isLoading: false,
        creditorId: null,
        collectorId: null,
        onboardingRequired: false,
        organization: null,
        organizations: [],
      }),
    }),
    {
      name: "daily-pwa-user",
    }
  )
);
