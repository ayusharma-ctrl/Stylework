# Implementation progress
## Completed
- Inspected empty workspace and confirmed Node 24/npm 11/Git availability.
- Recorded agreed architecture and 18-commit sequence.
## Current
Milestone 16: add-reliability-tests.
## Remaining
16 add-reliability-tests; 17 add-load-tests; 18 document-deployment.
## Verification
- Docker daemon initially unavailable; restore local engine before integration tests.
- No application existed before this implementation.

## server-setup
Backend dependencies installed; TypeScript build and 3 configuration tests passed.

## app-setup
Independent Vite production build and component smoke test passed.

## setup-docker
Compose configuration valid; dedicated PostgreSQL and Redis containers started. Full images will be tested once worker and migration entrypoints exist.

## setup-database
Sequelize build, initial migration, and 12,000-lead relational seeder passed against local PostgreSQL. Immutable audit trigger and indexed schema installed.

## setup-auth
Nest 11 compatibility line selected after an ESM/Jest failure on Nest 12. Build, token validation tests, and live sign-in/profile/sign-out/revocation smoke passed.

## harden-api
Build, 11 unit checks, and authenticated HTTP smoke passed with Redis-backed limiting, tracing, origin checks, response envelopes, and health checks active.

## setup-webhook
Build and 15 unit checks passed. Live smoke verified invalid HMAC rejection, ten concurrent identical deliveries producing one acceptance, and changed-payload conflict rejection.

## process-webhook-events
User superseded HMAC with database-backed X-Webhook-Key credentials. Migration, revocable hashed keys and management CLI implemented. Build and live intake/worker smoke passed: concurrent acceptance, payload conflict, invalid/revoked keys, and worker redelivery without duplicate creation activity. Counter SQL error found by smoke was corrected; failed transaction left no partial business writes. Durable receipts, processing/notification outbox, bounded retries, replay and Redis reconciliation implemented.

## setup-leads-api
REST and selectable GraphQL lead/detail/activity reads share application services. Signed, filter-bound keyset cursors preserve PostgreSQL timestamp precision in both directions. Build, unit checks and real query smoke passed for REST parity, forward/backward paging, search and abusive query rejection. GraphQL limits return HTTP 400 with trace metadata.

## setup-statuses
Status creation/editing, transactional reorder, default replacement and archival implemented. Lead status changes use optimistic versions and commit audit/counters/outbox together. Real HTTP smoke passed: simultaneous edits yield one success/one 409; default archival requires replacement; archived lead relationship preserved; reorder succeeds. Active catalog bounded at 100 statuses.

## setup-dashboard-stream
Dashboard snapshots aggregate sharded counters and a dynamic status catalog in a consistent read transaction. Shared per-process computation, coalesced Redis notifications, reconciliation, heartbeats, session checks, distributed connection limits and slow-consumer closure implemented. Build and real SSE smoke passed for immediate snapshot and committed status count update. Zero comparison baseline is explicitly unavailable.

## build-app-shell
React shell, responsive navigation, semantic light/dark tokens, shadcn-style Radix primitives, email sign-in, sessionStorage credentials, persisted Zustand preferences and cached GraphQL prefetch implemented. Dashboard renders generic SSE metrics and status breakdowns. Component sign-in smoke passed. Independent production build passed after resolving strict TypeScript generic inference. Browser plugin reports its in-app backend unavailable; checking available automation for later visual verification.

## build-lead-views
Lazy lead list/detail routes, URL search/status/date/sort filters, cursor paging, TanStack virtualization with a 20-page retention limit and scroll anchors implemented. Detail has optimistic status changes with rollback/conflict reload and independent searchable activity timeline. Production build and component smoke passed. In-app browser discovery returned no browsers; Playwright verification follows with the complete UI.

## build-activity-settings
Global activity and status settings support reorder, rename, color, default selection and safe archival. Frontend formatted. Production build, component smoke and Chromium journey passed: sign-in, live dashboard, virtual paging, search, status update, activity dialog, status create/archive, persisted dark theme, mobile navigation and sign-out. Desktop light/dark and 390px mobile screenshots inspected. No browser errors or horizontal overflow. Approval review usage limit interrupted the milestone commit; resumed after user instruction.
