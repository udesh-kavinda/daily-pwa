import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getOrCreateAppUserByClerkId } from "@/lib/auth/get-or-create-app-user";
import { loadMobileNotifications } from "@/lib/mobile-notifications";
import { NotificationsPageClient } from "@/components/notifications-page-client";

export default async function NotificationsPage() {
  const { userId } = await auth();
  if (!userId) {
    redirect("/sign-in");
  }

  const appUser = await getOrCreateAppUserByClerkId(userId);
  const initialPayload = await loadMobileNotifications(appUser.id, { limit: 80 });

  return <NotificationsPageClient initialPayload={initialPayload} />;
}
