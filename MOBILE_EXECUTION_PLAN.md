# Daily+ Mobile Execution Plan

This file is the working backlog for the separate mobile-first PWA in `/Users/uk/Developer/Projects/DailyPlus/daily-pwa`.

It intentionally separates work into:
- Strong-model work: architecture, cross-system business logic, complex UX, auth, workflows
- Deferred low-model work: bounded UI polish, repetitive cleanup, helpers, small visual improvements

## Current Status

Completed foundation:
- Premium mobile shell and visual language
- Shared Clerk + Supabase auth/session model reused from Daily+ admin
- Real role resolution for creditor, collector, debtor
- Mobile onboarding for collector and debtor
- Live overview/profile/portfolio APIs and screens
- Collector live capture workflow with loan-sync behavior
- Creditor mobile approval inbox for debtor and loan reviews
- Debtor loan detail and repayment history screens
- Collector debtor detail and debtor request flow
- Collector loan request flow with creditor approval handoff
- Collector-side KYC capture/update flow wired to shared Supabase storage
- Shared mobile route-authorization policy across dashboard and `/collector`
- Role-correct hero actions and bottom navigation for creditor, collector, and debtor
- Creditor field-ops / settlement-exception mobile surface
- API-boundary review for `/api/mobile/*` versus admin APIs
- Clean lint/build in `daily-pwa`

Current strong-model focus:
- Debtor clarity and real-device review

---

## Strong-Model Work

### 1. Collector capture workflow
Status: `completed`
Priority: `P0`

Tasks:
- Replace fake `/api/collections` handler with real collector-aware collection logic
- Add `GET /api/collections` mobile capture context for today's assigned stops
- Update existing scheduled collection rows instead of only inserting raw new rows when possible
- Sync loan balances when collection amount changes
- Handle status transitions cleanly:
  - `collected`
  - `partial`
  - `missed`
  - `deferred`
- Respect collector organization/session boundaries
- Support offline queue replay with idempotent-ish updates where possible
- Build a real collector capture UI:
  - stop selection
  - debtor info
  - due amount
  - payment amount
  - payment method
  - notes
  - capture status selection
- Add collector-only behavior while keeping debtor/creditor action hub safe

### 2. Collector route-run workflow
Status: `completed`
Priority: `P0`
Dependencies:
- collector capture workflow

Tasks:
- Create a real "today's route" mobile flow
- Group or sequence stops meaningfully
- Show debtor context at stop level
- Expose revisit / watchlist / overdue attention states
- Design end-of-route progression and completion sense
- Decide how route order is determined in mobile

### 3. Creditor mobile approval inbox
Status: `completed`
Priority: `P0`

Tasks:
- Design unified mobile approval inbox for:
  - debtor requests
  - loan requests
- Add approval/rejection mobile actions
- Support rejection notes and clear audit-safe decision UX
- Keep mobile scope lightweight compared with admin app
- Decide whether settlement anomalies belong here or in a separate ops view

### 4. Debtor loan detail experience
Status: `completed`
Priority: `P0`

Tasks:
- Create debtor loan detail page(s)
- Show clearly:
  - creditor
  - collector
  - next due
  - repayment progress
  - total paid
  - remaining balance
  - 30-day expectation
  - payment history
- Ensure multi-creditor debtor context remains clear and humane
- Decide support actions debtor can perform from mobile

### 5. Offline write strategy
Status: `completed`
Priority: `P0`
Dependencies:
- collector capture workflow

Tasks:
- Define safe offline write contract for collections
- Define queue replay and retry behavior
- Define duplicate protection/idempotency strategy
- Define behavior when a scheduled collection changed before replay
- Define stale-context handling

### 6. Notification strategy and mobile inbox model
Status: `completed`
Priority: `P1`

Tasks:
- Define role-specific notification taxonomy
- Define push vs inbox priorities
- Define high-signal vs low-signal events
- Design mobile notification inbox UX model

### 7. Role boundaries and mobile authorization review
Status: `completed`
Priority: `P1`

Tasks:
- Audit every mobile route for correct role access
- Ensure debtor cannot access creditor operational views
- Ensure collectors only see allowed borrower/loan information
- Ensure creditor mobile actions stay limited to intended scope
- Add a shared mobile route policy for collector / creditor / debtor path access
- Enforce the route policy in the mobile session bootstrap guard
- Align bottom navigation and hero CTAs with the same route policy
- Prevent debtor access to `/collector` while keeping collector capture and creditor ops surfaces available

### 8. Collector debtor detail permissions model
Status: `completed`
Priority: `P1`

Tasks:
- Decide what a collector can see/edit for a debtor in mobile
- Define KYC summary visibility on mobile
- Decide whether collector can request edits / submit additional info / request loans from detail page
- Lock the collector debtor-detail screen to field-safe actions:
  - KYC management
  - loan request handoff
  - loan and visit context
- Move portal access and core profile changes behind creditor-owned messaging instead of exposing admin-style controls

### 8.5. Collector KYC capture/update flow
Status: `completed`
Priority: `P1`

Tasks:
- Add collector-safe mobile KYC API using collector org context
- Load debtor KYC state in collector detail
- Build mobile KYC capture/update screen
- Support add/replace for:
  - ID front
  - Photo
  - Signature
- Auto-refresh debtor verification state once all required assets exist

### 9. Collector new debtor request mobile flow
Status: `completed`
Priority: `P1`

Tasks:
- Design collector-created debtor request workflow in mobile
- Align with creditor approval states
- Define edit-after-rejection behavior
- Create request submission and review status UX

### 10. Collector loan request mobile flow
Status: `completed`
Priority: `P1`

Tasks:
- Design collector-initiated loan request flow in mobile
- Show debtor eligibility / KYC readiness / approval state clearly
- Keep strong separation between request and approval roles

### 11. Creditor field-ops mobile view
Status: `completed`
Priority: `P1`

Tasks:
- Decide what field-ops / settlement summary makes sense on mobile
- Design exception-first view for creditors
- Keep deep ops complexity in admin while exposing critical signals in mobile
- Add a real creditor-only field-ops API for settlement exceptions and awaiting handovers
- Add verify/dispute settlement actions from the mobile surface
- Surface collectors with recovered cash but no settlement submission yet

### 12. API boundary review for mobile
Status: `completed`
Priority: `P1`

Tasks:
- Audit whether mobile should keep its own `/api/mobile/*` facade or reuse admin APIs directly where possible
- Normalize response shapes for mobile
- Ensure schema-drift tolerance where needed
- Ensure no unintended data leakage across roles
- Record route-by-route decisions in `API_BOUNDARY_REVIEW.md`
- Prefer shared domain logic for writes while keeping mobile composition APIs where they add value

### 13. Deep UX review of debtor clarity
Status: `completed`
Priority: `P1`

Tasks:
- Review wording and structure for debtor trust and comprehension
- Reduce financial ambiguity in language
- Ensure borrower can understand obligations without admin terminology
- Update borrower-facing copy across:
  - home overview
  - portfolio list
  - loan detail
  - repayment history
  - onboarding

### 14. Navigation and information architecture review
Status: `in_progress`
Priority: `P1`

Tasks:
- Finalize bottom-nav roles and center action behavior
- Decide whether some roles need different primary action surfaces
- Design global account/notification access model

### 15. Real-device behavior review
Status: `pending`
Priority: `P1`

Tasks:
- Review install/auth/navigation behavior on mobile devices
- Review safe-area, keyboard, and PWA auth interactions
- Review role flows in installed mode

---

## Deferred Low-Model Work

These are intentionally deferred for now unless they block a strong-model workflow.

### UI polish and component cleanup
Status: `deferred`
- standardize cards, buttons, chips, list rows
- normalize spacing and typography across screens
- create reusable mobile section header component
- create reusable mobile empty state component
- create reusable mobile error state component
- create reusable mobile loading skeletons

### Minor auth/account polish
Status: `deferred`
- top-right avatar menu in header
- duplicate logout access points
- account switch copy / session helper text
- prettier auth placeholders

### Loading / empty / error refinement
Status: `deferred`
- collector empty route state
- debtor no-loans-yet state
- creditor no-approvals state
- refresh affordance patterns
- optimistic micro-feedback

### Search and filter polish
Status: `deferred`
- search bars
- chip filters
- sorting toggles
- clear-filter actions
- recent search affordances

### Notification UI polish
Status: `deferred`
- notification badge styling
- notification grouping visuals
- read/unread animations

### Profile polish
Status: `deferred`
- richer identity card
- better workspace chips
- device readiness mini-cards
- nicer session controls

### PWA polish
Status: `deferred`
- install education UI
- reconnect banners
- last-sync labels
- offline fallback messaging polish
- splash/icon refinement

### Accessibility cleanup
Status: `deferred`
- aria labels
- focus management
- contrast pass
- keyboard form improvements
- tap target verification

### Testing and docs
Status: `deferred`
- smoke tests for auth and dashboard loads
- onboarding route tests
- mobile interaction tests
- project README for `daily-pwa`
- env example file
- deployment checklist

### Repo hygiene / deployment polish
Status: `deferred`
- stage `daily-pwa` into git cleanly
- project-specific Vercel notes
- icon asset cleanup
- docs for separate root-directory deploy

---

## Recommended Order

1. Collector capture workflow
2. Collector route-run workflow
3. Creditor approval inbox
4. Debtor loan detail flow
5. Offline write strategy
6. Notification model
7. Collector debtor/loan request flows
8. Collector KYC capture/update flow
9. Field ops view
10. Device and navigation review
11. Deferred low-model polish

---

## Immediate Working Slice

Active slice right now:
- Decide the collector debtor-detail permissions model
- Review debtor clarity and device behavior on real mobile flows
