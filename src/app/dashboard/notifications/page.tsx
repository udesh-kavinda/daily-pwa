"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BellRing, CheckCheck, LoaderCircle, ShieldAlert, Trash2 } from "lucide-react";
import { fetchJson } from "@/lib/fetch-json";

type NotificationItem = {
  id: string;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  createdAt: string;
  data?: Record<string, unknown> | null;
};

type NotificationsResponse = {
  notifications: NotificationItem[];
  unreadCount: number;
};

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
  if (type.includes("approved")) return "bg-emerald-500/12 text-emerald-900";
  if (type.includes("missed") || type.includes("overdue")) return "bg-amber-500/12 text-amber-900";
  return "bg-stone-900/6 text-stone-700";
}

export default function NotificationsPage() {
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [payload, setPayload] = useState<NotificationsResponse>({ notifications: [], unreadCount: 0 });
  const [filter, setFilter] = useState<FilterKey>("all");
  const [banner, setBanner] = useState<BannerState>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const nextPayload = await fetchJson<NotificationsResponse>("/api/mobile/notifications?limit=80");
      setPayload(nextPayload);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to load notifications";
      setBanner({ tone: "danger", text: message });
      setPayload({ notifications: [], unreadCount: 0 });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

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
      setBanner({ tone: "success", text: "All notifications are marked as read." });
      await load();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to update notifications";
      setBanner({ tone: "danger", text: message });
    } finally {
      setActing(false);
    }
  };

  const toggleRead = async (item: NotificationItem) => {
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
      await load();
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
      setBanner({ tone: "success", text: "Read notifications were cleared." });
      await load();
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
    <div className="space-y-4 pb-4">
      <section className="mobile-panel-strong px-5 py-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-emerald-700">Notification center</p>
            <h2 className="mt-1 text-xl font-semibold text-[#14213d]">Alerts and activity</h2>
            <p className="mt-2 text-sm leading-relaxed text-stone-600">
              Keep every approval, field update, reminder, and follow-up in one mobile inbox.
            </p>
          </div>
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-700">
            <BellRing size={22} />
          </div>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-3">
          {filters.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setFilter(item.key)}
              className={`rounded-[22px] border px-4 py-4 text-left transition-all ${filter === item.key ? "border-[#14213d] bg-[#14213d] text-white" : "border-stone-900/8 bg-white/75 text-stone-900"}`}
            >
              <p className={`text-[10px] uppercase tracking-[0.18em] ${filter === item.key ? "text-white/60" : "text-stone-500"}`}>{item.label}</p>
              <p className="mt-2 text-xl font-semibold">{item.count}</p>
            </button>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => void markAllRead()}
            disabled={acting || counts.unread === 0}
            className="inline-flex items-center gap-2 rounded-full bg-[#14213d] px-4 py-3 text-sm font-semibold text-white disabled:opacity-45"
          >
            {acting ? <LoaderCircle size={16} className="animate-spin" /> : <CheckCheck size={16} />}
            Mark all read
          </button>
          <button
            type="button"
            onClick={() => void clearRead()}
            disabled={acting || counts.read === 0}
            className="inline-flex items-center gap-2 rounded-full border border-stone-900/10 bg-white px-4 py-3 text-sm font-semibold text-[#14213d] disabled:opacity-45"
          >
            <Trash2 size={16} />
            Clear read
          </button>
        </div>
      </section>

      {banner ? (
        <section className={`mobile-panel px-4 py-4 ${banner.tone === "success" ? "border-emerald-700/12 bg-emerald-500/8" : banner.tone === "warning" ? "border-amber-700/12 bg-amber-500/10" : banner.tone === "danger" ? "border-rose-700/14 bg-rose-500/10" : "border-stone-900/8 bg-white/72"}`}>
          <p className="text-sm leading-relaxed text-stone-800">{banner.text}</p>
        </section>
      ) : null}

      <section className="space-y-3">
        {loading ? (
          Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="mobile-panel px-5 py-5">
              <div className="h-4 w-28 animate-pulse rounded-full bg-stone-200" />
              <div className="mt-3 h-7 w-2/3 animate-pulse rounded-full bg-stone-200" />
              <div className="mt-4 h-3 w-full animate-pulse rounded-full bg-stone-100" />
            </div>
          ))
        ) : filtered.length === 0 ? (
          <section className="mobile-panel px-5 py-6 text-center">
            <p className="text-base font-semibold text-[#14213d]">No notifications in this view.</p>
            <p className="mt-2 text-sm leading-relaxed text-stone-600">
              New approval events, route alerts, and account updates will appear here automatically.
            </p>
          </section>
        ) : (
          filtered.map((item) => (
            <section key={item.id} className={`rounded-[28px] border px-5 py-5 ${item.isRead ? "border-stone-900/8 bg-white/72" : "border-[#14213d]/18 bg-[#14213d]/[0.04]"}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    {!item.isRead ? <span className="h-2.5 w-2.5 rounded-full bg-emerald-600" /> : null}
                    <p className="text-[11px] uppercase tracking-[0.18em] text-stone-500">{typeLabel(item.type)}</p>
                  </div>
                  <h3 className="mt-2 text-lg font-semibold text-[#14213d]">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-stone-600">{item.message}</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-[11px] font-semibold ${toneByType(item.type)}`}>
                  {item.isRead ? "Read" : "New"}
                </span>
              </div>

              <div className="mt-4 flex items-center justify-between gap-3">
                <p className="text-xs text-stone-500">{formatDate(item.createdAt)}</p>
                <button
                  type="button"
                  onClick={() => void toggleRead(item)}
                  disabled={acting}
                  className="inline-flex items-center gap-2 rounded-full border border-stone-900/10 bg-white px-4 py-2 text-xs font-semibold text-[#14213d] disabled:opacity-45"
                >
                  {item.isRead ? <ShieldAlert size={14} /> : <CheckCheck size={14} />}
                  {item.isRead ? "Mark unread" : "Mark read"}
                </button>
              </div>
            </section>
          ))
        )}
      </section>
    </div>
  );
}
