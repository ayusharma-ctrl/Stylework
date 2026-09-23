# Architecture decisions
## Scope
One shared workspace. All signed-in users can manage statuses. Signed, manually called webhook; no Meta API integration. Users edit status only. Delivery is local Docker plus Vercel/Render/Neon deployment configuration; the owner publishes live services.

## Runtime
Independent React/Vite app and NestJS/Express TypeScript server. One modular server codebase, separate API and worker entrypoints. PostgreSQL via Sequelize models, explicit migrations and seeders. Redis handles BullMQ, rate limits, and notifications. No shared package.

## Contracts
REST: POST /signin; GET/PATCH /me; POST /signout; POST /webhook/meta-lead; GET /webhook-events/:eventId; GET /leads; GET /leads/:id; PATCH /leads/:id/status; GET/POST/PATCH/DELETE /statuses; GET /dashboard/stream; health routes.
POST /graphql supplies cursor connections for leads and activities, and lead detail. REST and GraphQL share services.

## Durable intake
HMAC covers delivery timestamp + exact body. Receipt and processing outbox commit before 202. Unique source/event ID plus canonical hash detects duplicates and conflicts. Source/external ID uniquely identifies a lead. Full snapshots carry an increasing source version. Worker transaction writes lead, activity, 64-shard counters, outcome, and notification outbox. Pending receipts remain reconcilable after Redis loss. Redis locks never establish correctness.

## Identity and security
Explicitly requested email-only login, access and refresh JWTs in headers, readable token table. Access 15 minutes; refresh 7 days; refresh is stable until session expiry/revocation. Row locking coalesces renewal. This is an impersonation-friendly assignment flow, not verified identity. Tokens never enter localStorage or logs.
Use Zod, bounded request bodies, exact supplied-origin checks, explicit trusted proxies, distributed rate limiting, request tracing, GraphQL depth/alias/cost limits, health and graceful shutdown.

## Data and UI
Stable status IDs with soft archival; archival of default requires replacement. Historical status labels stay in audit. UTC timestamps; Asia/Kolkata reporting timezone. Transactional counters provide generic SSE dashboard snapshots.
React + Tailwind semantic variables + shadcn, light/dark, responsive UI, virtualized cursor lists, TanStack Query and Zustand preferences. Status only editing.

## Delivery and validation
18 milestones: project-plan, server-setup, app-setup, setup-docker, setup-database, setup-auth, harden-api, setup-webhook, process-webhook-events, setup-leads-api, setup-statuses, setup-dashboard-stream, build-app-shell, build-lead-views, build-activity-settings, add-reliability-tests, add-load-tests, document-deployment.
Tests cover real PostgreSQL/Redis, duplicates, ordering, rollback, renewal, recovery, status races, pagination, SSE, browser flows, and production builds.
Targets: 1M events/day; burst 500/sec for 60 seconds with 1M seeded leads. ACK p95 <250ms, reads p95 <500ms, healthy SSE freshness <2s. These are targets, not claims.
