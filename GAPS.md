# Daily+ Mobile (`daily-pwa`) — Gap analysis

This document records **known gaps** between the current implementation and a production-ready field finance PWA. It is based on the codebase as of the analysis date.

---

## Table of contents

1. [Executive summary](#executive-summary)
2. [What is in reasonable shape](#what-is-in-reasonable-shape)
3. [Critical gaps](#critical-gaps)
4. [Security & backend architecture](#security--backend-architecture)
5. [Offline & collections](#offline--collections)
6. [Push notifications](#push-notifications)
7. [UX & product completeness](#ux--product-completeness)
8. [Data fidelity & fallbacks](#data-fidelity--fallbacks)
9. [Configuration & developer experience](#configuration--developer-experience)
10. [PWA & assets](#pwa--assets)
11. [Quality & maintainability](#quality--maintainability)
12. [Packaging & naming](#packaging--naming)
13. [Suggested priority order](#suggested-priority-order)

---

## Executive summary

`daily-pwa` delivers a **polished mobile shell** with **Clerk authentication**, **role-aware navigation**, and **several Supabase-backed read APIs** (`/api/mobile/overview`, `/api/mobile/portfolio`, `/api/mobile/profile`). The largest gaps are **non-functional offline sync**, **push flow not connected end-to-end**, **unauthenticated FCM send endpoint**, **reliance on the Supabase service role** for data access, and **UI elements that look interactive but do not perform real actions** (search, workstream buttons, notifications entry). Closing these moves the app from **demo / read-mostly** to **field-safe and write-complete**.

---

## What is in reasonable shape

| Area | Notes |
|------|--------|
| Auth bootstrap | `EnsureUser` + `/api/auth/ensure-user` ties Clerk to app session and Zustand store. |
| Debtor route gating | `EnsureUser` restricts debtor paths to an allowlist. |
| Mobile read APIs | Overview, portfolio, and profile routes query loans, debtors, collectors, collections, and debtor portal helpers. |
| Resilience | Dashboard shows a banner when live data is unavailable; several screens fall back to `mobile-demo-data`. |
| PWA basics | `manifest.json`, install banner (`beforeinstallprompt`), service worker registration in root layout. |
| Setup documentation | `/setup` page lists required env vars including Supabase (even if `.env.example` does not). |

---

## Critical gaps

### 1. Collection sync API is a stub

**Location:** `src/app/api/collections/route.ts`

The `POST` handler acknowledges a payload but **does not** validate the user, **does not** write to Supabase, and **does not** perform idempotency or conflict handling.

**Impact:** Any “sync” from the client cannot persist real collection events. Data integrity and auditability are missing.

**Direction:** Implement authenticated writes (Clerk session → app user → creditor/collector context), map queued items to `collections` / related tables, handle validation and errors, return per-item results.

---

### 2. Offline queue is not integrated

**Location:** `src/lib/offline-queue.ts`

The module implements `loadQueue`, `saveQueue`, `enqueueCollection`, and `flushQueue` (POST to `/api/collections`), but **no other file imports it**.

**Impact:** The README’s “offline queue and sync demo” is **not surfaced in the UI**; there is no visible collector flow that enqueues or flushes.

**Direction:** Add screens or integrate into existing collector/work routes; handle network status; do not clear local storage until the server confirms persistence.

---

### 3. Push: client never registers; server token storage is dev-oriented

**Locations:**

- `src/lib/firebase/client.ts` — `requestFcmToken`, `listenForMessages`, `initFirebase` exist but are **unused** elsewhere.
- `src/app/api/push/register/route.ts` — saves tokens via `src/lib/token-store.ts`.
- `src/lib/token-store.ts` — persists to `data/push-tokens.json` on the local filesystem.

**Impact:**

- No automatic (or manual) path from the app to **obtain an FCM token** and **register** it with the backend.
- File-based token storage is **unsuitable** for serverless hosting and multi-instance deployments.

**Direction:** On login or dedicated settings, call `requestFcmToken`, POST to `/api/push/register`; store tokens in Postgres (or a managed store) keyed by `user_id` / device id; refresh invalidated tokens.

---

### 4. Unauthenticated push send API

**Location:** `src/app/api/notifications/send/route.ts`

Accepts `token`, `title`, `body`, and sends via Firebase Admin **without** verifying Clerk or an internal secret.

**Impact:** If deployed publicly, arbitrary actors could **spam FCM** to known or guessed tokens.

**Direction:** Require Clerk (admin-only or service role), signed internal jobs, or shared secret / HMAC for trusted backends only.

---

## Security & backend architecture

### 5. Supabase service role for mobile APIs

**Location:** `src/lib/supabase/admin.ts`, used by `/api/mobile/*` and related routes.

All queried data is filtered in application code using session context (`getAppSessionContextByClerkId`). **Row Level Security is bypassed** by the service role key.

**Impact:** Any defect in session resolution, `creditor_id` / `collector_id` filtering, or future refactors could **leak cross-tenant data**. Operational risk is higher than with user-scoped JWT access.

**Direction:** Prefer Supabase SSR client with user JWT where possible, or narrow admin usage to strict server-only modules with tests and audits; document invariants (e.g. every query must filter by `creditor_id`).

---

## Offline & collections

### 6. No true offline-first strategy

Aside from the unused queue:

- There is no **background sync** registration, **conflict resolution**, or **optimistic UI** tied to server confirmation.
- Service worker precache (Workbox) precaches static chunks but does **not** replace a domain-specific offline strategy for writes.

**Direction:** Define minimal offline scope (e.g. “record cash amount + debtor id + photo ref”), sync policy, and user-visible sync state.

---

## Push notifications

### 7. Firebase messaging vs. service worker

**Location:** `src/lib/firebase/client.ts` uses `navigator.serviceWorker.ready` with the app’s registered SW.

**Risk:** FCM often expects a **Firebase messaging service worker** (or compatible integration). The project registers `/sw.js` from `next-pwa` in `src/app/layout.tsx`. **Compatibility and foreground/background behavior need explicit verification** on Android Chrome and iOS Safari/Web Push support matrix.

**Direction:** Validate FCM + Workbox SW setup per Firebase Web docs; add iOS-specific limitations to docs if applicable.

---

## UX & product completeness

| Item | Location / behavior | Gap |
|------|---------------------|-----|
| Portfolio search | `src/app/dashboard/portfolio/page.tsx` | Decorative UI only; no input handling or filtering. |
| Workstream actions | `src/app/dashboard/work/page.tsx` | Chevron control is a `<button>` with **no** `onClick` / navigation. |
| Notifications affordance | `src/app/dashboard/layout.tsx` | Header bell does not open a list or deep link; only reflects loading spinner. |
| Recovery role | `src/app/dashboard/layout.tsx` | `recovery_agent` label is mapped to collector wording via `getRoleLabel` workaround — **may be wrong** for recovery agents. |
| Collector linking | Overview API returns “link your collector profile” when `session.collector` is missing — **good**, but ensure all entry points guide users consistently. |

---

## Data fidelity & fallbacks

### 8. Mixed live and synthetic “activity”

**Location:** `src/app/api/mobile/overview/route.ts`

- **Collector** branch uses `notifications` for activity where available.
- **Creditor** branch includes **hand-built activity strings** (e.g. pending approvals, active collectors, today collected) rather than a unified notification or event feed.

**Impact:** Creditor “operational updates” may **not reflect real chronological events**; screenshots can look live while content is partially narrative.

**Direction:** Drive activity from `notifications`, audit log table, or materialized events with consistent schema.

### 9. Demo fallback data

**Location:** `src/lib/mobile-demo-data.ts`

Used when API calls fail or before load completes on several screens.

**Impact:** Risk of **mistaking demo numbers** for production during demos or QA if errors are silent besides the dashboard banner.

**Direction:** Stronger error states, Sentry/logging, and explicit “preview mode” labeling on all fallback surfaces.

---

## Configuration & developer experience

### 10. `.env.example` incomplete vs. runtime needs

**Observed:**

- `.env.example` lists Clerk and Firebase variables.
- `src/app/setup/page.tsx` and `src/lib/supabase/admin.ts` require **`NEXT_PUBLIC_SUPABASE_URL`**, **`SUPABASE_SERVICE_ROLE_KEY`**, and related keys for a working backend.

**Impact:** New developers can boot the UI but **fail at API time** with missing env mistakes.

**Direction:** Align `.env.example` with `setup/page.tsx` (Supabase + `NEXT_PUBLIC_APP_URL`).

---

## PWA & assets

### 11. Icons and install polish

**README** notes placeholder SVG icons under `public/icons`; iOS install prompts and store-style polish typically need **PNG** assets and richer manifest screenshots.

**Impact:** Weaker install conversion and branding on homescreen.

---

## Quality & maintainability

### 12. No automated tests in package metadata

`package.json` for `daily-pwa` does not define a `test` script (contrast with a fuller app that might use Playwright).

**Impact:** Regressions in auth, API contracts, and offline/sync behavior are **uncaught automatically**.

**Direction:** Add API + E2E tests for `/api/auth/ensure-user`, `/api/mobile/overview`, and future collection writes.

---

## Packaging & naming

### 13. Folder vs package name mismatch

**Observed:** Directory is `daily-pwa` but `package.json` **`name`** is `daily-plus-mobile`.

**Impact:** Confusion in monorepo tooling, documentation, and CI path filters.

**Direction:** Rename for consistency or document the intentional split in README.

---

## Suggested priority order

1. **Secure** `/api/notifications/send` and plan token storage (DB).
2. **Implement real** `POST /api/collections` with auth and Supabase writes + tests.
3. **Wire** `offline-queue` (or replace) into collector UX + reliable sync semantics.
4. **Connect** FCM: `requestFcmToken` → `/api/push/register` → persistent store.
5. **Revisit** service role vs user-scoped Supabase for mobile APIs.
6. **Fix** interactive UI gaps (search, workstream navigation, notifications).
7. **Align** `.env.example` and README with actual env requirements.
8. **Add** tests and production PWA assets.

---

## Document maintenance

When fixing a gap, update this file: either remove the item, add a “Resolved” subsection with PR reference, or downgrade severity so the doc stays trustworthy.
