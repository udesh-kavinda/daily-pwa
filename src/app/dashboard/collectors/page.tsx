"use client";

import { useEffect, useState } from "react";
import { SearchableMobileList } from "@/components/searchable-mobile-list";
import { StatusPill } from "@/components/status-pill";
import { fetchJson } from "@/lib/fetch-json";

type CollectorsResponse = {
  rows: Array<{
    id: string;
    name: string;
    employeeCode: string;
    phone: string;
    routes: number;
    status: string;
  }>;
};

function toneForStatus(status: string) {
  if (status === "active" || status === "accepted") return "emerald" as const;
  if (status === "pending" || status === "invited") return "amber" as const;
  return "slate" as const;
}

export default function CollectorsPage() {
  const [rows, setRows] = useState<CollectorsResponse["rows"]>([]);

  useEffect(() => {
    let mounted = true;

    fetchJson<CollectorsResponse>("/api/mobile/collectors")
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
        searchPlaceholder="Search collector, code, or phone"
        items={rows.map((row) => ({
          id: row.id,
          href: `/dashboard/collectors/${row.id}`,
          title: row.name,
          subtitle: row.employeeCode,
          meta: row.phone,
          rightTitle: `${row.routes} routes`,
          rightMeta: <StatusPill label={row.status.replaceAll("_", " ")} tone={toneForStatus(row.status)} />,
          keywords: [row.name, row.employeeCode, row.phone, row.status],
        }))}
        emptyTitle="No collectors yet"
        emptyDescription="Collectors will appear here once they are created inside the organization."
      />
    </div>
  );
}
