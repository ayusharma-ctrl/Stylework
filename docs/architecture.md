# Architecture decisions
## Scope
One single-tenant application. All signed-in users can manage statuses. Database-key-authenticated, manually called webhook; no Meta API integration. Users edit status and create new leads through session-authenticated intake. Delivery is local Docker plus Vercel/Render/Neon deployment configuration; the owner publishes live services.

## Runtime
Independent React/Vite app and NestJS/Express TypeScript server. One modular server codebase, API and background processor together by default; optional standalone worker entrypoint. PostgreSQL via Sequelize models, explicit migrations and seeders. Redis handles BullMQ, rate limits, and notifications. No shared package.

## Contracts
REST: POST /signin; GET/PATCH /me; POST /signout; POST /webhook/meta-lead; GET /webhook-events/:eventId; GET /leads; GET /leads/:id; PATCH /leads/:id/status; GET/POST/PATCH/DELETE /statuses; GET /dashboard/stream; health routes.
REST only: GET /leads and GET /activities supply bounded cursor connections; GET /leads/:id supplies detail. GraphQL and Apollo are removed.

## Durable intake
Webhook callers supply X-Webhook-Key. PostgreSQL stores the key hash, label, expiry, and revocation state; there is no server environment webhook secret. A CLI creates, imports, lists, and revokes keys. This replaces the original HMAC plan per the user's subsequent instruction. Receipt and processing outbox commit before 202. Unique source/event ID plus canonical hash detects duplicates and conflicts. Source/external ID uniquely identifies a lead. Full snapshots carry an increasing source version. Worker transaction writes lead, activity, 64-shard counters, outcome, and notification outbox. Pending receipts remain reconcilable after Redis loss. Redis locks never establish correctness.

## Identity and security
Explicitly requested email-only login, access and refresh JWTs in headers, readable token table. Access 15 minutes; refresh 7 days; refresh is stable until session expiry/revocation. Row locking coalesces renewal. This is an impersonation-friendly assignment flow, not verified identity. Tokens never enter localStorage or logs.
Use Zod, bounded request bodies, exact supplied-origin checks, explicit trusted proxies, distributed rate limiting, request tracing, strict REST filters and pagination bounds, health and graceful shutdown.

## Data and UI
Stable status IDs with soft archival; archival of default requires replacement. Historical status labels stay in audit. UTC timestamps; Asia/Kolkata reporting timezone. Transactional counters provide generic SSE dashboard snapshots.
React + Tailwind semantic variables + shadcn, light/dark, responsive UI, virtualized cursor lists, TanStack Query and Zustand preferences. Status only editing.

## Delivery and validation
18 milestones: project-plan, server-setup, app-setup, setup-docker, setup-database, setup-auth, harden-api, setup-webhook, process-webhook-events, setup-leads-api, setup-statuses, setup-dashboard-stream, build-app-shell, build-lead-views, build-activity-settings, add-reliability-tests, limit-demo-seeds, document-deployment.
Tests cover real PostgreSQL/Redis, duplicates, ordering, rollback, renewal, recovery, status races, pagination, SSE, browser flows, and production builds.
Revised data scope: 12 synthetic users, 150 leads and 75 additional activities, plus each lead's creation audit. User explicitly removed large-data generation and load testing from execution scope. Millions of requests remains an architectural capacity goal, not a measured guarantee. No further large benchmarks should run without explicit authorization.

## September 24 revision
Models live one per file under server/src/database/models. The former workspace_settings singleton is renamed app_settings by migration 003; configuration and concurrency locks are preserved without any tenant model. Manual intake uses the existing webhook route with both session tokens and the webhook IP quota, while external callers still use database-backed keys. Receipts persist trusted actor details and isolate manual/meta source IDs. Both date bounds use safe Sequelize replacement spacing and compare instants, not offset strings. API responses negotiate gzip/Brotli; frontend Nginx serves gzip assets; SSE and sign-in remain uncompressed.

## September 25 small-deployment revision
Frontend uses port 5173 in Vite and Docker host mappings. Two Redis-backed IP token buckets replace per-user/read/write/sign-in limits: API_RATE_LIMIT=120/minute for REST and WEBHOOK_RATE_LIMIT=60/minute for all webhook submissions. Health/preflight are exempt; SSE retains a fixed concurrent-connection cap. Default API embeds JobsModule with RUN_WORKER=true, shares pool 4 and processes one job at a time. Database/Redis close after jobs drain. Dispatch polling is one second and reconciliation 30 seconds. server/render.yaml defines one free web service only, external database/Redis URLs, and migrations before startup. Free-tier sleep pauses processing; restart reconciliation preserves accepted receipts.
