# Daily+ Mobile API Boundary Review

This review covers the mobile API surface in `/Users/uk/Developer/Projects/DailyPlus/daily-pwa/src/app/api/mobile` and its relationship to the admin app in `/Users/uk/Developer/Projects/DailyPlus/daily-plus/src/app/api`.

## Decision Summary

Use this rule going forward:

- Keep a route **mobile-specific** when it is a role-adaptive composition layer for the mobile UI.
- Consolidate or extract shared logic when the route performs the **same business mutation** as the admin app.
- Prefer **shared domain helpers** over forcing both apps to literally call the same Next route.

That means the long-term target is:

1. Mobile keeps its own thin presentation APIs for mobile-shaped screens.
2. Shared write logic moves into reusable domain helpers under `src/lib/**`.
3. Admin and mobile routes both call those shared helpers.

## Keep Mobile-Specific

These routes should stay in `/api/mobile/*` because they are mobile orchestration layers, not raw domain endpoints.

### `/api/mobile/overview`
Reason:
- role-adaptive home screen composer
- combines multiple data sources into a compact mobile command-center payload
- mobile hero/focus/activity cards do not match the admin dashboard shape

### `/api/mobile/portfolio`
Reason:
- returns role-specific portfolio cards
- collector, creditor, and debtor all get different item semantics
- this is a mobile surface contract, not a reusable admin data contract

### `/api/mobile/portfolio/[id]`
Reason:
- debtor-specific mobile loan detail presentation
- optimized for borrower clarity, not admin back-office workflows

### `/api/mobile/portfolio/[id]/history`
Reason:
- repayment-history timeline for the debtor mobile experience
- strongly presentation-oriented and mobile specific

### `/api/mobile/profile`
Reason:
- lightweight mobile profile aggregation
- intentionally smaller than admin settings/profile surfaces

### `/api/mobile/notifications`
Reason:
- mobile inbox contract with unread count and compact inbox actions
- header badge and inbox screen depend on this shape

### `/api/mobile/route-run`
Reason:
- collector route sequencing and stop grouping are mobile workflow concepts
- this is a route-run view model, not a reusable generic route entity API

### `/api/mobile/field-ops`
Reason:
- creditor exception desk is a mobile operations composition layer
- combines settlements, collector activity, and awaiting-handover signals into one small-screen view

## Share Domain Logic / Consolidate Internals

These routes can remain separate externally for now, but the underlying business logic should be shared with the admin app.

### `/api/mobile/approvals`
Decision:
- keep the mobile route
- extract shared approval actions

Why:
- mobile needs a compact approval inbox payload
- but the actual debtor/loan approval mutations are domain logic that should not drift from admin

Recommended extraction:
- `approveDebtorRequest(...)`
- `rejectDebtorRequest(...)`
- `approveLoanRequest(...)`
- `rejectLoanRequest(...)`

### `/api/mobile/debtors/request`
Decision:
- keep the mobile route
- extract shared debtor-request creation rules

Why:
- collector-submitted debtor creation has the same approval semantics across apps
- admin and mobile should not diverge on statuses, defaults, and assignment rules

Recommended extraction:
- `createCollectorDebtorRequest(...)`

### `/api/mobile/loans/request`
Decision:
- keep the mobile route
- extract shared collector loan-request rules

Why:
- the proposal math and approval-state rules are business logic, not mobile-only logic

Recommended extraction:
- `createCollectorLoanRequest(...)`

### `/api/mobile/debtors/[id]/kyc`
Decision:
- keep the mobile route
- extract shared debtor KYC upload/update logic

Why:
- storage paths, verification rules, and completion logic should be identical across admin and mobile

Recommended extraction:
- `updateDebtorKycAssets(...)`
- `recomputeDebtorVerification(...)`

### `/api/collections` in mobile app
Decision:
- keep the collector mobile route behavior
- extract shared collection-capture domain logic

Why:
- mobile capture uses a collector-first workflow and offline-safe shape
- but the actual collection write/update and loan-sync rules are shared business rules

Recommended extraction:
- `captureCollection(...)`
- `syncLoanAfterCollection(...)`

## Keep Separate For Now

These routes do not need immediate consolidation work.

### `/api/auth/ensure-user`
Reason:
- each app has its own session bootstrap surface
- both apps already share underlying auth/session helpers

### `/api/onboarding/collector`
### `/api/onboarding/debtor`
Reason:
- onboarding UX is app-specific
- the shared part is the session context and persistence model, which is already reused

## Risks Found

### 1. Drift risk is highest in write-heavy routes
Highest-priority extraction targets:
- approvals
- debtor request creation
- loan request creation
- KYC update
- collection capture

### 2. Mobile composition routes are healthy as a separate layer
Routes like:
- overview
- portfolio
- route-run
- field-ops

are not duplication problems by themselves. They are expected mobile view-model APIs.

### 3. Route sharing is less important than domain sharing
Trying to force admin and mobile to literally reuse the same Next route would make both apps clumsier.

Better pattern:
- separate route handlers
- shared service/domain functions
- role checks still performed at route entry

## Recommended Next Refactor Order

1. Extract shared approval mutations
2. Extract shared collection capture / loan sync
3. Extract shared debtor request creation
4. Extract shared loan request creation
5. Extract shared KYC update logic

## Current Conclusion

The mobile app should **keep** its `/api/mobile/*` facade for:
- overview
- portfolio
- notifications
- route-run
- field-ops

The mobile app should **share underlying domain logic** with admin for:
- approvals
- collections
- collector debtor requests
- collector loan requests
- KYC updates

This gives us:
- stable mobile UX contracts
- less business-rule drift
- cleaner long-term maintenance across both projects
