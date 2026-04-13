"use client";

import { useEffect, useState } from "react";
import { SearchableMobileList } from "@/components/searchable-mobile-list";
import { StatusPill } from "@/components/status-pill";
import { fetchJson } from "@/lib/fetch-json";

type RoutesResponse = {
  rows: Array<{
    id: string;
    name: string;
    area: string;
    collector: string;
    debtors: number;
    status: string;
  }>;
};

export default function RoutesPage() {
  const [rows, setRows] = useState<RoutesResponse["rows"]>([]);

  useEffect(() => {
    let mounted = true;

    fetchJson<RoutesResponse>("/api/mobile/routes")
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
        searchPlaceholder="Search route, area, or collector"
        items={rows.map((row) => ({
          id: row.id,
          href: `/dashboard/routes/${row.id}`,
          title: row.name,
          subtitle: row.area,
          meta: row.collector,
          rightTitle: `${row.debtors} debtors`,
          rightMeta: <StatusPill label={row.status} tone={row.status === "active" ? "emerald" : "slate"} />,
          keywords: [row.name, row.area, row.collector, row.status],
        }))}
        emptyTitle="No routes yet"
        emptyDescription="Routes will appear here once they are created and assigned."
      />
    </div>
  );
}
