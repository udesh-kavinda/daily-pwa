import type { UserRole } from "@/types/database";

export type MobileRole = Extract<UserRole, "creditor" | "collector" | "debtor">;

export type MetricCard = {
  label: string;
  value: string;
  change: string;
  tone: "emerald" | "amber" | "ink";
};

export type TaskCard = {
  title: string;
  subtitle: string;
  amount: string;
  status: string;
  tone: "emerald" | "amber" | "ink";
};

export type PortfolioCard = {
  title: string;
  subtitle: string;
  meta: string;
  value: string;
  tone: "emerald" | "amber" | "ink";
};

export type ActivityItem = {
  title: string;
  detail: string;
  time: string;
};

export type ProfileGroup = {
  title: string;
  items: Array<{ label: string; value: string }>;
};

export function getRoleLabel(role: MobileRole) {
  if (role === "creditor") return "Creditor";
  if (role === "debtor") return "Debtor";
  return "Collector";
}

export function formatLkr(value: number) {
  return new Intl.NumberFormat("en-LK", {
    style: "currency",
    currency: "LKR",
    maximumFractionDigits: 0,
  }).format(value);
}

export const heroCopy: Record<MobileRole, { eyebrow: string; title: string; summary: string; primaryAction: string; secondaryAction: string }> = {
  collector: {
    eyebrow: "Field command",
    title: "Stay ahead of every doorstep visit.",
    summary:
      "A collector-first command center for route work, cash capture, and debtor relationships. Built for fast one-hand use in the field.",
    primaryAction: "Open my round",
    secondaryAction: "Capture payment",
  },
  creditor: {
    eyebrow: "Executive control",
    title: "Approve fast without losing operational clarity.",
    summary:
      "A mobile approval and portfolio command layer for creditors who need visibility, urgency, and clean decision-making on the move.",
    primaryAction: "Review approvals",
    secondaryAction: "Check settlements",
  },
  debtor: {
    eyebrow: "Borrower clarity",
    title: "Understand every loan without the confusion.",
    summary:
      "A calm self-service space where debtors see upcoming dues, assigned collectors, payment rhythm, and the full repayment picture.",
    primaryAction: "View next payment",
    secondaryAction: "Open all loans",
  },
};

export const homeMetrics: Record<MobileRole, MetricCard[]> = {
  collector: [
    { label: "Today to collect", value: formatLkr(268450), change: "18 visits left", tone: "ink" },
    { label: "Collected so far", value: formatLkr(214920), change: "79.9% of target", tone: "emerald" },
    { label: "Cash to settle", value: formatLkr(194500), change: "1 handover tonight", tone: "amber" },
  ],
  creditor: [
    { label: "Pending approvals", value: "12", change: "5 loans · 7 debtors", tone: "amber" },
    { label: "Today recovered", value: formatLkr(864200), change: "+8.1% vs yesterday", tone: "emerald" },
    { label: "Collectors in field", value: "14 / 16", change: "2 off-route exceptions", tone: "ink" },
  ],
  debtor: [
    { label: "Next payment", value: formatLkr(6800), change: "Due tomorrow", tone: "amber" },
    { label: "Outstanding total", value: formatLkr(186500), change: "Across 3 active loans", tone: "ink" },
    { label: "Paid to date", value: formatLkr(93400), change: "On schedule this month", tone: "emerald" },
  ],
};

export const workQueue: Record<MobileRole, TaskCard[]> = {
  collector: [
    {
      title: "Colombo 07 - Morning Round",
      subtitle: "12 debtors · 3 partials · 1 missed yesterday",
      amount: formatLkr(68200),
      status: "Start in 12 min",
      tone: "emerald",
    },
    {
      title: "Borella Follow-ups",
      subtitle: "6 revisits · 2 overdue cases",
      amount: formatLkr(41300),
      status: "Priority block",
      tone: "amber",
    },
    {
      title: "Evening Settlement Prep",
      subtitle: "Cash handover and receipt audit",
      amount: formatLkr(194500),
      status: "Before 7:30 PM",
      tone: "ink",
    },
  ],
  creditor: [
    {
      title: "Loan proposals waiting",
      subtitle: "3 from City South team · 2 from Galle route",
      amount: "5 pending",
      status: "Needs review",
      tone: "amber",
    },
    {
      title: "New debtor requests",
      subtitle: "Collectors submitted KYC-lite entries",
      amount: "7 requests",
      status: "Approve or return",
      tone: "ink",
    },
    {
      title: "Settlement anomalies",
      subtitle: "2 collectors reported differences over threshold",
      amount: formatLkr(14500),
      status: "Urgent",
      tone: "emerald",
    },
  ],
  debtor: [
    {
      title: "Tomorrow's collection window",
      subtitle: "Collector arrives between 9:00 AM and 11:00 AM",
      amount: formatLkr(6800),
      status: "Be ready",
      tone: "amber",
    },
    {
      title: "This month summary",
      subtitle: "5 of 6 scheduled payments already covered",
      amount: formatLkr(27200),
      status: "On track",
      tone: "emerald",
    },
    {
      title: "Support note",
      subtitle: "Need a repayment explanation or receipt copy?",
      amount: "Help available",
      status: "Open help",
      tone: "ink",
    },
  ],
};

export const portfolioCards: Record<MobileRole, PortfolioCard[]> = {
  collector: [
    {
      title: "Nadeesha Perera",
      subtitle: "Route A · 2 active loans",
      meta: "Next due tomorrow",
      value: formatLkr(4300),
      tone: "emerald",
    },
    {
      title: "Asanka Fernando",
      subtitle: "Watchlist · partial yesterday",
      meta: "Field note added",
      value: formatLkr(6200),
      tone: "amber",
    },
    {
      title: "Malithi Silva",
      subtitle: "Needs signature refresh",
      meta: "KYC follow-up",
      value: formatLkr(3100),
      tone: "ink",
    },
  ],
  creditor: [
    {
      title: "South Cluster",
      subtitle: "4 collectors · 128 live debtors",
      meta: "Best recovery rate today",
      value: formatLkr(312000),
      tone: "emerald",
    },
    {
      title: "Pending debtor approvals",
      subtitle: "Review field-submitted profiles",
      meta: "7 waiting",
      value: "Review now",
      tone: "amber",
    },
    {
      title: "Collector health",
      subtitle: "2 agents flagged for late settlement",
      meta: "Ops attention",
      value: "14 active",
      tone: "ink",
    },
  ],
  debtor: [
    {
      title: "Bright Path Finance",
      subtitle: "Collector: R. Nadeesha",
      meta: "Daily loan · 11 days remaining",
      value: formatLkr(74800),
      tone: "emerald",
    },
    {
      title: "Unity Capital",
      subtitle: "Collector: S. Fernando",
      meta: "Weekly top-up product",
      value: formatLkr(56800),
      tone: "ink",
    },
    {
      title: "Home rebuild balance",
      subtitle: "Shared summary across lenders",
      meta: "Total still to repay",
      value: formatLkr(186500),
      tone: "amber",
    },
  ],
};

export const activityFeed: Record<MobileRole, ActivityItem[]> = {
  collector: [
    {
      title: "Receipt synced for LN-24019",
      detail: "Cash collection from Prabath was uploaded after regaining signal.",
      time: "2 min ago",
    },
    {
      title: "Route reordered",
      detail: "Borella follow-up moved ahead because of a missed payment risk.",
      time: "16 min ago",
    },
    {
      title: "Settlement reminder",
      detail: "Remember to complete cash handover before 7:30 PM.",
      time: "42 min ago",
    },
  ],
  creditor: [
    {
      title: "Collector joined organization",
      detail: "Kasun accepted the invite and completed profile setup.",
      time: "5 min ago",
    },
    {
      title: "New loan request submitted",
      detail: "Route South team sent a 30-day proposal for review.",
      time: "18 min ago",
    },
    {
      title: "Debtor invite accepted",
      detail: "A returning debtor portal account linked to another creditor profile.",
      time: "1 hr ago",
    },
  ],
  debtor: [
    {
      title: "Payment confirmed",
      detail: "Your last collection has been posted to Bright Path Finance.",
      time: "8 min ago",
    },
    {
      title: "Next visit scheduled",
      detail: "Collector window is tomorrow morning.",
      time: "1 hr ago",
    },
    {
      title: "Portal linked",
      detail: "Your account now shows loans from multiple creditors in one place.",
      time: "Today",
    },
  ],
};

export const profileByRole: Record<MobileRole, ProfileGroup[]> = {
  collector: [
    {
      title: "Field profile",
      items: [
        { label: "Name", value: "Ruwan Nadeesha" },
        { label: "Employee code", value: "CL-1084" },
        { label: "Primary route", value: "Colombo 07 Cluster" },
      ],
    },
    {
      title: "Device readiness",
      items: [
        { label: "Offline queue", value: "7 items pending" },
        { label: "Push alerts", value: "Enabled" },
        { label: "Last sync", value: "2 minutes ago" },
      ],
    },
  ],
  creditor: [
    {
      title: "Organization",
      items: [
        { label: "Business", value: "Daily+ Capital South" },
        { label: "Default product", value: "30-day daily collection" },
        { label: "Currency", value: "LKR" },
      ],
    },
    {
      title: "Decision center",
      items: [
        { label: "Approvals pending", value: "12" },
        { label: "Unread alerts", value: "9" },
        { label: "Collectors active", value: "14" },
      ],
    },
  ],
  debtor: [
    {
      title: "Borrower identity",
      items: [
        { label: "Name", value: "Malithi Silva" },
        { label: "Portal access", value: "Verified" },
        { label: "Primary contact", value: "+94 77 123 4567" },
      ],
    },
    {
      title: "Repayment support",
      items: [
        { label: "Preferred collector", value: "Ruwan Nadeesha" },
        { label: "Receipts", value: "Digital copies available" },
        { label: "Help channel", value: "In-app message and phone" },
      ],
    },
  ],
};

export const capturePresets = [
  { label: "Full daily", value: 6800 },
  { label: "Partial", value: 3200 },
  { label: "Weekly catch-up", value: 14500 },
];
