"use client";

import { useEffect, useState } from "react";
import { SearchableMobileList } from "@/components/searchable-mobile-list";
import { StatusPill } from "@/components/status-pill";
import { fetchJson } from "@/lib/fetch-json";

type DebtorsResponse = {
  rows: Array<{
    id: string;
    name: string;
    phone: string;
    route: string;
    collector: string;
    status: string;
    updatedAt: string;
  }>;
};

function toneForStatus(status: string) {
  if (status === "approved" || status === "active") return "emerald" as const;
  if (status === "pending_approval") return "amber" as const;
  if (status === "rejected") return "rose" as const;
  return "slate" as const;
}

function formatStatus(status: string) {
  return status.replaceAll("_", " ");
}

export default function DebtorsPage() {
  const [rows, setRows] = useState<DebtorsResponse["rows"]>([]);

  useEffect(() => {
    let mounted = true;

    fetchJson<DebtorsResponse>("/api/mobile/debtors")
      .then((payload) => {
        if (mounted) setRows(payload.rows || []);
      })
      .catch(() => {
        if (mounted) setRows([]);
      });

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="space-y-3 pb-4">
      <SearchableMobileList
        searchPlaceholder="Search debtor, phone, route, or collector"
        items={rows.map((row) => ({
          id: row.id,
          href: `/dashboard/debtors/${row.id}`,
          title: row.name,
          subtitle: row.phone,
          meta: `${row.route} · ${row.collector}`,
          rightMeta: <StatusPill label={formatStatus(row.status)} tone={toneForStatus(row.status)} />,
          keywords: [row.route, row.collector, row.phone, formatStatus(row.status)],
        }))}
        emptyTitle="No debtors yet"
        emptyDescription="Once debtors are assigned or created, they will appear here as a searchable list."
      />
    </div>
  );
}
