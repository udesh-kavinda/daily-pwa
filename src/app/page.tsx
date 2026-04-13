import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { AppEntry } from "@/components/app-entry";

export default async function HomePage() {
  const clerkConfigured = Boolean(
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY &&
      process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY !== "pk_test_your_key_here"
  );

  if (!clerkConfigured) {
    redirect("/setup");
  }

  const { userId } = await auth();

  return <AppEntry authenticated={Boolean(userId)} />;
}
