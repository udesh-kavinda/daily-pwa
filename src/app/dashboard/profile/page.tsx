"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { BellRing, Building2, ShieldCheck, Smartphone } from "lucide-react";
import { useUserStore } from "@/store/user-store";
import { fetchJson } from "@/lib/fetch-json";
import { formatLkr, getRoleLabel, profileByRole } from "@/lib/mobile-demo-data";
import type { MobileRole } from "@/lib/mobile-demo-data";

const ClerkLogoutButton = dynamic(
  () => import("@/components/auth/clerk-logout-button").then((module) => module.ClerkLogoutButton),
  { ssr: false }
);

type ProfileResponse = {
  profile: {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
    phone: string | null;
    role: MobileRole | "recovery_agent";
    created_at: string;
    updated_at: string;
  } | null;
  role: MobileRole | "recovery_agent";
  organization: {
    id: string;
    name: string | null;
    ownerName: string | null;
    ownerEmail: string | null;
  } | null;
  organizations: Array<{
    id: string;
    name: string | null;
    ownerName: string | null;
    ownerEmail: string | null;
  }>;
  summary: {
    employeeCode?: string | null;
    assignedRoutes?: string[] | null;
    inviteStatus?: string | null;
    activeLoans?: number;
    totalOutstanding?: number;
    estimated30DayCommitment?: number;
  } | null;
};

function formatDate(date: string) {
  return new Intl.DateTimeFormat("en-LK", { month: "short", day: "numeric", year: "numeric" }).format(new Date(date));
}

export default function ProfilePage() {
  const { role: storedRole, user } = useUserStore();
  const activeRole: MobileRole = storedRole === "creditor" || storedRole === "debtor" ? storedRole : "collector";
  const [data, setData] = useState<ProfileResponse | null>(null);

  useEffect(() => {
    let mounted = true;

    fetchJson<ProfileResponse>("/api/mobile/profile")
      .then((payload) => {
        if (mounted) {
          setData(payload);
        }
      })
      .catch(() => {
        if (mounted) {
          setData(null);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  const groups = useMemo(() => {
    if (!data?.profile) {
      return profileByRole[activeRole];
    }

    const profile = data.profile;
    const base = [
      {
        title: "Account",
        items: [
          { label: "Name", value: `${profile.first_name} ${profile.last_name}`.trim() },
          { label: "Email", value: profile.email },
          { label: "Phone", value: profile.phone || "Not added yet" },
        ],
      },
      {
        title: data.organizations.length > 1 ? "Organizations" : "Workspace",
        items: data.organizations.length > 1
          ? data.organizations.map((organization) => ({
              label: organization.name || "Organization",
              value: organization.ownerName || organization.ownerEmail || "Active relationship",
            }))
          : [
              {
                label: data.organization?.name || "Organization",
                value: data.organization?.ownerName || data.organization?.ownerEmail || "Live workspace",
              },
            ],
      },
    ];

    if (activeRole === "collector") {
      return [
        ...base,
        {
          title: "Collector readiness",
          items: [
            { label: "Employee code", value: String(data.summary?.employeeCode || "Pending") },
            { label: "Assigned routes", value: `${Array.isArray(data.summary?.assignedRoutes) ? data.summary?.assignedRoutes.length : 0}` },
            { label: "Invite status", value: String(data.summary?.inviteStatus || "Active") },
          ],
        },
      ];
    }

    if (activeRole === "debtor") {
      return [
        ...base,
        {
          title: "Repayment outlook",
          items: [
            { label: "Active loans", value: String(data.summary?.activeLoans || 0) },
            { label: "Outstanding", value: formatLkr(Number(data.summary?.totalOutstanding || 0)) },
            { label: "30-day commitment", value: formatLkr(Number(data.summary?.estimated30DayCommitment || 0)) },
          ],
        },
      ];
    }

    return [
      ...base,
      {
        title: "Management view",
        items: [
          { label: "Role", value: getRoleLabel(activeRole) },
          { label: "Joined", value: formatDate(profile.created_at) },
          { label: "Updated", value: formatDate(profile.updated_at) },
        ],
      },
    ];
  }, [activeRole, data]);

  const initials = `${(data?.profile?.first_name || user?.first_name || "D")[0] || "D"}${(data?.profile?.last_name || user?.last_name || "+")[0] || "+"}`.toUpperCase();
  const headline = data?.profile ? `${data.profile.first_name} ${data.profile.last_name}`.trim() : `${getRoleLabel(activeRole)} mode`;

  return (
    <div className="space-y-4 pb-4">
      <section className="mobile-panel-ink px-5 py-5">
        <p className="text-[11px] uppercase tracking-[0.18em] text-emerald-100/80">Identity</p>
        <div className="mt-3 flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-[24px] bg-white/12 text-lg font-semibold text-white">
            {initials}
          </div>
          <div>
            <h2 className="mobile-title text-[2rem] leading-none text-white">{headline}</h2>
            <p className="mt-2 text-sm text-white/72">
              {data?.organization?.name || "Daily+ Mobile workspace"}
            </p>
          </div>
        </div>
      </section>

      {groups.map((group) => (
        <section key={group.title} className="mobile-panel px-5 py-5">
          <h3 className="text-lg font-semibold text-[#14213d]">{group.title}</h3>
          <div className="mt-4 space-y-3">
            {group.items.map((item) => (
              <div key={`${group.title}-${item.label}`} className="flex items-center justify-between gap-4 rounded-[22px] bg-white/70 px-4 py-4">
                <span className="text-sm text-stone-500">{item.label}</span>
                <span className="text-sm font-semibold text-[#14213d] text-right">{item.value}</span>
              </div>
            ))}
          </div>
        </section>
      ))}

      <section className="grid gap-3">
        {[
          { title: "Notifications", detail: "Receipts, reminders, and route alerts", icon: BellRing },
          { title: "Security", detail: "Clerk identity backed by the same Daily+ organization rules", icon: ShieldCheck },
          { title: "Workspace", detail: (data?.organizations?.length || 0) > 1 ? "You are linked to multiple creditor relationships" : "Single-organization mobile workspace", icon: Building2 },
          { title: "Device mode", detail: "Install, offline behavior, and future mobile permissions", icon: Smartphone },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.title} className="mobile-panel-strong flex items-start gap-4 px-5 py-5">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-700">
                <Icon size={22} />
              </div>
              <div>
                <h4 className="text-base font-semibold text-[#14213d]">{item.title}</h4>
                <p className="mt-1 text-sm text-stone-600">{item.detail}</p>
              </div>
            </div>
          );
        })}
      </section>

      <section className="mobile-panel px-5 py-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-stone-500">Session</p>
            <h3 className="mt-1 text-lg font-semibold text-[#14213d]">Log out of Daily+ Mobile</h3>
            <p className="mt-2 text-sm text-stone-600">
              End this session on the current device and return to the sign-in screen.
            </p>
          </div>
          <ClerkLogoutButton compact />
        </div>

        <ClerkLogoutButton />
      </section>
    </div>
  );
}
