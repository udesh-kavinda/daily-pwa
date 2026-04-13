"use client";

import { useMemo, useState } from "react";
import { BellRing, CheckCheck, ChevronDown, LoaderCircle, Trash2 } from "lucide-react";
import { fetchJson } from "@/lib/fetch-json";
import type { MobileNotificationItem, MobileNotificationsResponse } from "@/lib/mobile-notifications";

type FilterKey = "all" | "unread" | "read";
type BannerTone = "success" | "warning" | "danger" | "info";
type BannerState = { tone: BannerTone; text: string } | null;

function formatDate(date: string) {
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return date;
  return new Intl.DateTimeFormat("en-LK", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(parsed);
}

function typeLabel(type: string) {
  return type.replaceAll("_", " ");
}

function toneByType(type: string) {
  if (type.includes("approved")) return "bg-emerald-500/12 text-emerald-900 dark:text-emerald-200";
  if (type.includes("missed") || type.includes("overdue")) return "bg-amber-500/12 text-amber-900 dark:text-amber-200";
  return "bg-stone-900/6 text-stone-700 dark:bg-white/8 dark:text-slate-200";
}

export function NotificationsPageClient({ initialPayload }: { initialPayload: MobileNotificationsResponse }) {
  const [acting, setActing] = useState(false);
  const [payload, setPayload] = useState<MobileNotificationsResponse>(initialPayload);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [banner, setBanner] = useState<BannerState>(null);
  const [expandedId, setExpandedId] = useState<string | null>(initialPayload.notifications[0]?.id || null);

  const refresh = async () => {
    const nextPayload = await fetchJson<MobileNotificationsResponse>("/api/mobile/notifications?limit=80");
    setPayload(nextPayload);
    setExpandedId((current) => current && nextPayload.notifications.some((item) => item.id === current) ? current : nextPayload.notifications[0]?.id || null);
    return nextPayload;
  };

  const filtered = useMemo(() => {
    if (filter === "unread") return payload.notifications.filter((item) => !item.isRead);
    if (filter === "read") return payload.notifications.filter((item) => item.isRead);
    return payload.notifications;
  }, [filter, payload.notifications]);

  const counts = useMemo(() => ({
    all: payload.notifications.length,
    unread: payload.notifications.filter((item) => !item.isRead).length,
    read: payload.notifications.filter((item) => item.isRead).length,
  }), [payload.notifications]);

  const markAllRead = async () => {
    setActing(true);
    try {
      await fetchJson("/api/mobile/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mark_all_read" }),
      });
      await refresh();
      setBanner({ tone: "success", text: "All notifications are marked as read." });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to update notifications";
      setBanner({ tone: "danger", text: message });
    } finally {
      setActing(false);
    }
  };

  const toggleRead = async (item: MobileNotificationItem) => {
    setActing(true);
    try {
      await fetchJson("/api/mobile/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: item.isRead ? "mark_unread" : "mark_read",
          ids: [item.id],
        }),
      });
      await refresh();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to update notification";
      setBanner({ tone: "danger", text: message });
    } finally {
      setActing(false);
    }
  };

  const clearRead = async () => {
    setActing(true);
    try {
      await fetchJson("/api/mobile/notifications", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete_read" }),
      });
      await refresh();
      setBanner({ tone: "success", text: "Read notifications were cleared." });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to clear notifications";
      setBanner({ tone: "danger", text: message });
    } finally {
      setActing(false);
    }
  };

  const filters: Array<{ key: FilterKey; label: string; count: number }> = [
    { key: "all", label: "All", count: counts.all },
    { key: "unread", label: "Unread", count: counts.unread },
    { key: "read", label: "Read", count: counts.read },
  ];

  return (
    <div className="space-y-3 pb-4">
      <section className="mobile-panel px-4 py-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="mobile-section-label text-emerald-700 dark:text-emerald-300">Notification center</p>
            <h2 className="mobile-text-primary mt-1 text-[1.05rem] font-semibold">Alerts and activity</h2>
            <p className="mobile-text-secondary mt-1.5 text-[13px] leading-relaxed">
              Tap a notification to expand it and manage it inline.
            </p>
          </div>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/14 dark:text-emerald-300">
            <BellRing size={18} />
          </div>
        </div>

        <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
          {filters.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setFilter(item.key)}
              className={`shrink-0 rounded-full border px-3 py-2 text-sm font-semibold transition-all ${filter === item.key ? "border-emerald-600 bg-emerald-600 text-white dark:border-emerald-400 dark:bg-emerald-500 dark:text-slate-950" : "border-slate-900/8 bg-white text-slate-700 dark:border-white/10 dark:bg-slate-900 dark:text-slate-200"}`}
            >
              {item.label} <span className="ml-1 opacity-70">{item.count}</span>
            </button>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap gap-2.5">
          <button
            type="button"
            onClick={() => void markAllRead()}
            disabled={acting || counts.unread === 0}
            className="inline-flex items-center gap-2 rounded-[12px] bg-emerald-600 px-3.5 py-2.5 text-sm font-semibold text-white disabled:opacity-45 dark:bg-emerald-500 dark:text-slate-950"
          >
            {acting ? <LoaderCircle size={15} className="animate-spin" /> : <CheckCheck size={15} />}
            Mark all read
          </button>
          <button
            type="button"
            onClick={() => void clearRead()}
            disabled={acting || counts.read === 0}
            className="inline-flex items-center gap-2 rounded-[12px] border border-slate-900/8 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-700 disabled:opacity-45 dark:border-white/10 dark:bg-slate-900 dark:text-slate-200"
          >
            <Trash2 size={15} />
            Clear read
          </button>
        </div>
      </section>

      {banner ? (
        <section className={`mobile-panel px-4 py-3.5 ${banner.tone === "success" ? "border-emerald-700/12 bg-emerald-500/8 dark:bg-emerald-500/14" : banner.tone === "warning" ? "border-amber-700/12 bg-amber-500/10 dark:bg-amber-500/14" : banner.tone === "danger" ? "border-rose-700/14 bg-rose-500/10 dark:bg-rose-500/14" : ""}`}>
          <p className="mobile-text-primary text-sm leading-relaxed">{banner.text}</p>
        </section>
      ) : null}

      <section className="space-y-2.5">
        {filtered.length === 0 ? (
          <section className="mobile-panel px-4 py-5 text-center">
            <p className="mobile-text-primary text-base font-semibold">No notifications in this view.</p>
            <p className="mobile-text-secondary mt-2 text-sm leading-relaxed">
              New approval events, route alerts, and account updates will appear here automatically.
            </p>
          </section>
        ) : (
          filtered.map((item) => {
            const expanded = expandedId === item.id;
            return (
              <section key={item.id} className={`mobile-panel overflow-hidden border ${expanded ? "border-emerald-500/30 dark:border-emerald-400/30" : item.isRead ? "" : "border-[#14213d]/18 dark:border-emerald-400/20"}`}>
                <button
                  type="button"
                  onClick={() => setExpandedId(expanded ? null : item.id)}
                  className="flex w-full items-start justify-between gap-4 px-4 py-4 text-left"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      {!item.isRead ? <span className="h-2.5 w-2.5 rounded-full bg-emerald-600 dark:bg-emerald-400" /> : null}
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${toneByType(item.type)}`}>
                        {typeLabel(item.type)}
                      </span>
                    </div>
                    <h3 className="mobile-text-primary mt-3 text-base font-semibold">{item.title}</h3>
                    <p className="mobile-text-secondary mt-1.5 text-[13px] leading-relaxed">{item.message}</p>
                    <p className="mobile-text-tertiary mt-3 text-xs">{formatDate(item.createdAt)}</p>
                  </div>
                  <ChevronDown size={18} className={`mobile-text-tertiary mt-1 shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`} />
                </button>

                {expanded ? (
                  <div className="border-t border-slate-900/6 px-4 py-4 dark:border-white/8">
                    <div className="flex gap-2.5">
                      <button
                        type="button"
                        onClick={() => void toggleRead(item)}
                        disabled={acting}
                        className="inline-flex flex-1 items-center justify-center gap-2 rounded-[12px] border border-slate-900/8 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-700 disabled:opacity-45 dark:border-white/10 dark:bg-slate-900 dark:text-slate-200"
                      >
                        {acting ? <LoaderCircle size={15} className="animate-spin" /> : <CheckCheck size={15} />}
                        {item.isRead ? "Mark unread" : "Mark read"}
                      </button>
                    </div>
                  </div>
                ) : null}
              </section>
            );
          })
        )}
      </section>
    </div>
  );
}
