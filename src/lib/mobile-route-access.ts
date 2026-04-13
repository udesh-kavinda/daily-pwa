import type { UserRole } from "@/types/database";
import type { MobileRole } from "@/lib/mobile-demo-data";

const sharedPrefixes = [
  "/dashboard",
  "/dashboard/work",
  "/dashboard/portfolio",
  "/dashboard/debtors",
  "/dashboard/loans",
  "/dashboard/routes",
  "/dashboard/collectors",
  "/dashboard/profile",
  "/dashboard/notifications",
] as const;

function startsWithAny(pathname: string, prefixes: readonly string[]) {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function isCollectorPortfolioPath(pathname: string) {
  return pathname === "/dashboard/portfolio/new" || pathname.startsWith("/dashboard/portfolio/debtors/");
}

function isDebtorPortfolioPath(pathname: string) {
  return /^\/dashboard\/portfolio\/[^/]+(?:\/history)?$/.test(pathname);
}

function isDebtorEntityPath(pathname: string) {
  return pathname.startsWith("/dashboard/debtors/");
}

function isLoanEntityPath(pathname: string) {
  return pathname.startsWith("/dashboard/loans/");
}

function isRouteEntityPath(pathname: string) {
  return pathname.startsWith("/dashboard/routes/");
}

function isCollectorEntityPath(pathname: string) {
  return pathname.startsWith("/dashboard/collectors/");
}

export function normalizeMobileRole(role: UserRole | null | undefined): MobileRole {
  if (role === "creditor" || role === "debtor") return role;
  return "collector";
}

export function getMobileHomePath(role: UserRole | null | undefined) {
  void role;
  return "/dashboard";
}

export function getMobilePrimaryActionPath(role: UserRole | null | undefined) {
  const activeRole = normalizeMobileRole(role);
  if (activeRole === "collector") return "/dashboard/work";
  if (activeRole === "debtor") return "/dashboard/work";
  return "/dashboard/work";
}

export function getMobileSecondaryActionPath(role: UserRole | null | undefined) {
  const activeRole = normalizeMobileRole(role);
  if (activeRole === "collector" || activeRole === "creditor") return "/collector";
  return "/dashboard/portfolio";
}

export function isAllowedForMobileRole(pathname: string, role: UserRole | null | undefined) {
  const activeRole = normalizeMobileRole(role);

  if (activeRole === "debtor") {
    if (pathname === "/dashboard/onboarding/debtor") return true;
    if (pathname === "/dashboard/portfolio") return true;
    if (pathname === "/dashboard/loans") return true;
    if (isDebtorPortfolioPath(pathname) || isLoanEntityPath(pathname)) return true;
    if (startsWithAny(pathname, ["/dashboard/work", "/dashboard/profile", "/dashboard/notifications"])) return true;
    return pathname === "/dashboard";
  }

  if (activeRole === "collector") {
    if (pathname === "/dashboard/onboarding/collector") return true;
    if (pathname === "/collector") return true;
    if (pathname === "/dashboard/portfolio") return true;
    if (pathname === "/dashboard/debtors" || pathname === "/dashboard/routes") return true;
    if (isCollectorPortfolioPath(pathname) || isDebtorEntityPath(pathname) || isRouteEntityPath(pathname) || isLoanEntityPath(pathname)) return true;
    if (startsWithAny(pathname, ["/dashboard/work", "/dashboard/profile", "/dashboard/notifications"])) return true;
    return pathname === "/dashboard";
  }

  if (activeRole === "creditor") {
    if (pathname === "/collector") return true;
    if (pathname === "/dashboard/debtors" || pathname === "/dashboard/loans" || pathname === "/dashboard/routes" || pathname === "/dashboard/collectors") return true;
    if (isDebtorEntityPath(pathname) || isLoanEntityPath(pathname) || isRouteEntityPath(pathname) || isCollectorEntityPath(pathname)) return true;
    if (startsWithAny(pathname, ["/dashboard/work", "/dashboard/profile", "/dashboard/notifications"])) return true;
    return pathname === "/dashboard" || pathname === "/dashboard/portfolio";
  }

  return startsWithAny(pathname, sharedPrefixes);
}

export function isNavItemActive(pathname: string, href: string) {
  if (pathname === href) return true;
  if (href === "/dashboard") return pathname === "/dashboard";
  if (href === "/dashboard/loans" && isDebtorPortfolioPath(pathname)) return true;
  if (href === "/dashboard/loans" && isLoanEntityPath(pathname)) return true;
  if (href === "/dashboard/debtors" && (isCollectorPortfolioPath(pathname) || isDebtorEntityPath(pathname))) return true;
  if (href === "/dashboard/routes" && isRouteEntityPath(pathname)) return true;
  if (href === "/dashboard/collectors" && isCollectorEntityPath(pathname)) return true;
  return pathname.startsWith(`${href}/`);
}
