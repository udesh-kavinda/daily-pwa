import { createAdminClient } from "@/lib/supabase/admin";

export type MobileNotificationItem = {
  id: string;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  createdAt: string;
  data?: Record<string, unknown> | null;
};

export type MobileNotificationsResponse = {
  notifications: MobileNotificationItem[];
  unreadCount: number;
};

type NotificationRow = {
  id: string;
  title: string | null;
  message: string | null;
  type: string | null;
  is_read: boolean;
  created_at: string;
  data?: Record<string, unknown> | null;
};

export async function loadMobileNotifications(appUserId: string, options?: { limit?: number; unreadOnly?: boolean }): Promise<MobileNotificationsResponse> {
  const supabase = createAdminClient();
  const limit = Math.max(1, Math.min(100, options?.limit ?? 40));
  const unreadOnly = options?.unreadOnly === true;

  let query = supabase
    .from("notifications")
    .select("id, title, message, type, is_read, created_at, data")
    .eq("user_id", appUserId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (unreadOnly) {
    query = query.eq("is_read", false);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(error.message);
  }

  const notifications = ((data as NotificationRow[] | null) || []).map((entry) => ({
    id: entry.id,
    title: entry.title || "Notification",
    message: entry.message || "",
    type: entry.type || "system",
    isRead: entry.is_read,
    createdAt: entry.created_at,
    data: entry.data || null,
  }));

  return {
    notifications,
    unreadCount: notifications.filter((entry) => !entry.isRead).length,
  };
}
