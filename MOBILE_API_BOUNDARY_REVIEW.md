# Daily+ Mobile API Boundary Review

This review compares the mobile API layer in `/Users/uk/Developer/Projects/DailyPlus/daily-pwa/src/app/api` with the admin API layer in `/Users/uk/Developer/Projects/DailyPlus/daily-plus/src/app/api`.

The goal is not to remove every mobile endpoint. The goal is to decide which routes are:
- deliberately mobile-specific projections
- temporary duplicates that should converge on shared business logic
- admin APIs that should stay admin-only

## Decision Summary

### Keep mobile-specific

These routes are intentionally shaped around mobile workflows, role-specific summaries, or field UX:

- `/api/mobile/overview`
  - Builds role-specific command-center cards for creditor, collector, and debtor.
  - The admin app has dashboard stats routes, but they are widget-oriented and not a direct mobile contract.

- `/api/mobile/portfolio`
  - Returns different payloads for debtor loan cards, collector debtor cards, and creditor portfolio snapshots.
  - The admin app has richer raw data APIs, but this route is a mobile projection layer.

- `/api/mobile/portfolio/[id]`
- `/api/mobile/portfolio/[id]/history`
  - These are debtor-facing mobile detail contracts.
  - The admin app has debtor routes, but mobile needs a borrower-safe, simplified repayment model.

- `/api/mobile/route-run`
  - This is a field-sequencing API for collectors, not a generic admin route listing.
  - It combines schedule logic, attention logic, and stop ordering for one-hand mobile use.

- `/api/collections`
  - Even though it is not under `/api/mobile`, this is effectively the mobile collector capture contract.
  - It includes update-or-insert behavior, offline replay compatibility, and loan-sync semantics that differ from admin `/api/data/collections`.

- `/api/mobile/field-ops`
  - This is a creditor mobile operations surface for settlement exceptions and collector health.
  - The admin app currently has UI placeholders and query helpers, not a clean mobile-ready API contract.

### Keep mobile-specific for now, but extract shared business logic later

These routes do real business writes that overlap with admin behavior. The route shape can stay mobile-specific, but the mutation logic should move into shared services/helpers.

- `/api/mobile/approvals`
  - Mobile combines debtor and loan approvals into one inbox and one decision surface.
  - Admin does not yet expose the same unified API.
  - The write logic for approve/reject should eventually be shared with admin, but the mobile route itself can remain a mobile facade.

- `/api/mobile/debtors/request`
  - Overlaps with admin `/api/data/debtors` `POST` for collector-created pending debtors.
  - Mobile also exposes collector route context via `GET`, which is mobile-specific.
  - Recommendation: keep route, extract debtor-request creation into shared server logic.

- `/api/mobile/loans/request`
  - Overlaps with admin `/api/data/loans` collector request behavior.
  - Mobile request payload and preview UX are mobile-specific.
  - Recommendation: keep route, extract loan-request creation and validation into shared logic.

- `/api/mobile/debtors/[id]/kyc`
  - Admin has `/api/uploads/kyc`, but the mobile route is collector-safe and tied to mobile debtor detail.
  - Recommendation: do not consolidate yet.
  - First harden the admin upload route to use the same collector-aware access model, then consider extracting common upload/update helpers.

### Strong candidates to consolidate with admin

These are mostly the same operation in two places and should converge sooner.

- `/api/mobile/notifications`
  - Very close to admin `/api/data/notifications`.
  - Same auth model.
  - Same CRUD semantics.
  - Same table.
  - Main difference is response naming and admin’s graceful `unavailable` response.
  - Recommendation: consolidate behind one shared notification data layer or reuse the admin route contract.

- `/api/mobile/profile`
  - Overlaps with admin `/api/data/profile`.
  - Mobile adds session/organization/debtor/collector summary context, which is useful.
  - Recommendation: share the base profile loader/update logic, keep mobile-specific session summary enrichment in the mobile route if needed.

- `/api/onboarding/collector`
- `/api/onboarding/debtor`
  - These exist in both projects.
  - The workflow rules should not diverge between admin and mobile.
  - Recommendation: extract onboarding completion and read-model logic into shared server helpers.

- `/api/auth/ensure-user`
  - Both apps carry their own copy.
  - The returned client session shape is intentionally app-specific, but the core ensure-user logic should stay aligned.
  - Recommendation: share the session bootstrap/domain logic, keep per-app response shaping thin.

## Admin APIs That Should Stay Admin-Oriented

These are not good direct mobile contracts because they are broader, denser, or tied to back-office workflows:

- `/api/data/routes`
- `/api/data/routes/[id]`
- `/api/data/collectors`
- `/api/data/debtors/[id]`
- `/api/data/loans/[id]`
- `/api/dashboard/stats`
- `/api/dashboard/recent-loans`
- `/api/dashboard/collector-performance`

They are still valuable as sources of business logic, but they should not be treated as the mobile contract directly.

## Practical Direction

### Short term

Keep these mobile APIs as explicit mobile facades:
- `overview`
- `portfolio`
- `portfolio/[id]`
- `portfolio/[id]/history`
- `route-run`
- `field-ops`
- `collections`

### Next extraction targets

Extract shared server/domain logic for:
- ensure-user session bootstrap
- onboarding completion
- debtor request creation
- loan request creation
- approval decision mutations
- KYC upload/update authorization

### First consolidation candidates

Consolidate or share implementation first for:
- notifications
- profile
- onboarding

## Bottom Line

The mobile API layer is justified. It is not just a duplicate of admin.

But it should not keep duplicating write-side business logic forever.

The clean path is:
- keep mobile-specific read/projection routes
- extract shared mutation and authorization logic
- consolidate notifications/profile/onboarding earliest
