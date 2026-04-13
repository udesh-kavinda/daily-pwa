import type { Metadata, Viewport } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

export const metadata: Metadata = {
  title: "Daily+ Mobile | Field Finance PWA",
  description:
    "A premium mobile-first workspace for collectors, creditors, and debtors operating on the Daily+ backend.",
  applicationName: "Daily+ Mobile",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Daily+ Mobile",
  },
  icons: [
    { rel: "icon", url: "/icons/icon.svg" },
    { rel: "apple-touch-icon", url: "/icons/icon.svg" },
  ],
  keywords: [
    "microloan",
    "collector mobile app",
    "debtor portal",
    "creditor approvals",
    "pwa",
    "field collections",
  ],
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#f4efe6",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const clerkConfigured = Boolean(
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY &&
      process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY !== "pk_test_your_key_here"
  );

  return (
    <html lang="en">
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Daily+ Mobile" />
      </head>
      <body className="mobile-noise antialiased">
        {clerkConfigured ? <ClerkProvider>{children}</ClerkProvider> : children}
        <script
          dangerouslySetInnerHTML={{
            __html: `if ('serviceWorker' in navigator) { window.addEventListener('load', () => { navigator.serviceWorker.register('/sw.js'); }); }`,
          }}
        />
      </body>
    </html>
  );
}
