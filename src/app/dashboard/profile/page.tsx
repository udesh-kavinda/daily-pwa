"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { BellRing, Building2, ShieldCheck, Smartphone } from "lucide-react";
import { useUserStore } from "@/store/user-store";
import { fetchJson } from "@/lib/fetch-json";
import { formatLkr, getRoleLabel, profileByRole } from "@/lib/mobile-demo-data";
import type { MobileRole } from "@/lib/mobile-demo-data";
import { ThemeToggle } from "@/components/theme-toggle";

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
    <div className="space-y-3 pb-4">
      <section className="mobile-panel px-4 py-4">
        <p className="mobile-section-label">Identity</p>
        <div className="mt-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="mobile-solid-surface flex h-14 w-14 items-center justify-center rounded-[16px] text-lg font-semibold">
              {initials}
            </div>
            <div>
              <h2 className="mobile-text-primary text-[1.15rem] font-semibold leading-none">{headline}</h2>
              <p className="mobile-text-secondary mt-1 text-[13px]">{data?.organization?.name || "Daily+ Mobile workspace"}</p>
              <div className="mt-2 inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-500/14 dark:text-emerald-300">
                {getRoleLabel(activeRole)}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <ClerkLogoutButton compact />
          </div>
        </div>
      </section>

      {groups.map((group) => (
        <section key={group.title} className="mobile-panel px-4 py-4">
          <h3 className="mobile-text-primary text-base font-semibold">{group.title}</h3>
          <div className="mobile-compact-list mt-3">
            {group.items.map((item) => (
              <div key={`${group.title}-${item.label}`} className="mobile-row">
                <span className="mobile-text-secondary text-sm">{item.label}</span>
                <span className="mobile-text-primary text-sm font-semibold text-right">{item.value}</span>
              </div>
            ))}
          </div>
        </section>
      ))}

      <section className="grid gap-2.5">
        {[
          { title: "Notifications", detail: "Receipts, reminders, and route alerts", icon: BellRing },
          { title: "Security", detail: "Clerk identity backed by the same Daily+ organization rules", icon: ShieldCheck },
          { title: "Workspace", detail: (data?.organizations?.length || 0) > 1 ? "You are linked to multiple creditor relationships" : "Single-organization mobile workspace", icon: Building2 },
          { title: "Device mode", detail: "Install, offline behavior, and future mobile permissions", icon: Smartphone },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.title} className="mobile-panel-strong flex items-start gap-3 px-4 py-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/14 dark:text-emerald-300">
                <Icon size={18} />
              </div>
              <div>
                <h4 className="mobile-text-primary text-sm font-semibold">{item.title}</h4>
                <p className="mobile-text-secondary mt-1 text-[13px]">{item.detail}</p>
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}
