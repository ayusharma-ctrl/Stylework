# Stylework lead management

A single-tenant lead intake application built with React and a modular NestJS monolith. PostgreSQL owns durable intake, business state and audit history; Redis handles shared limits, BullMQ delivery and change notifications. By default, API and background processing run in one NestJS process and share a database pool.

**Local app:** http://localhost:5173 · **Local API:** http://localhost:3000

**Live deployment:** pending owner publication. No hosted URL is claimed. Deployment configuration for Vercel, Render and Neon is included below.

## Architecture

```mermaid
flowchart LR
  Caller[Caller with X-Webhook-Key] --> API[NestJS API]
  UI[React application :5173] -->|REST| API
  API -->|Receipt + outbox transaction| PG[(PostgreSQL)]
  PG --> Dispatcher[Outbox dispatcher]
  Dispatcher --> Queue[(Redis / BullMQ)]
  Queue --> Worker[Background processor inside API]
  Worker -->|Lead + audit + counters + outbox transaction| PG
  Dispatcher -->|Committed notification| PubSub[Redis Pub/Sub]
  PubSub --> API
  API -->|SSE snapshots| UI
```

`app/` and `server/` each own their dependencies, lockfile, TypeScript configuration and Dockerfile. There is no shared runtime package. Nest modules own authentication, users, leads, activities, statuses, webhooks, jobs, dashboard and health. Controllers call services; repositories contain read queries and persistence access. Each model has its own file in `server/src/database/models/`; migrations and seeders live under `server/src/database/`.

### Correctness boundaries

- Intake returns **202 only after receipt and processing outbox commit**. PostgreSQL unique constraints protect `(source,eventId)` and `(source,externalId)`. A repeated canonical event returns its receipt with 200; a changed payload using that event ID returns 409.
- Worker delivery is at least once. Receipt/lead locks, source versions and transactions make business effects idempotent. Older versions and equal identical snapshots are ignored; equal conflicting versions become visible failures. Higher versions update contact data while preserving the user's status. Only actual contact changes create `LEAD_UPDATED` activities.
- Lead, activity, sharded counter and notification-outbox changes commit together. Audit rows reject update/delete at the database boundary. Source/configuration snapshots retain historical labels.
- The dispatcher claims rows with `FOR UPDATE SKIP LOCKED`; deterministic BullMQ job IDs avoid duplicate queue entries. Pending PostgreSQL receipts are periodically reconciled even if their outbox was previously published. Redis loss can delay processing but cannot erase an acknowledged receipt.
- Status changes use `expectedVersion`; a concurrent stale edit gets 409. Status IDs remain stable, with soft archival and atomic default replacement. Existing leads, counts, filters and history remain intact.
- Counters spread across 64 lead-ID shards. SSE computes consistent snapshots, sends dynamic cards/statuses, coalesces updates to once/second, and reconciles every 30 seconds. Reporting uses `Asia/Kolkata`; stored timestamps are UTC. A zero yesterday denominator produces `null`.

The singleton `app_settings` row stores the default status, timezone and catalog revision. It has a database `CHECK(id=1)` and no tenant ownership or workspace relationships. Migration 003 renames the earlier settings table without losing configuration.

See [architecture decisions](docs/architecture.md). Local AI guidance and progress files are intentionally excluded from Git.

## Setup instructions

Requires Docker with Compose v2.24+; native development also needs Node 24 and npm. Run from the repository root:

```sh
docker compose up --build --wait
docker compose exec api node dist/database/cli.js seed
docker compose exec api node scripts/smoke.mjs
```

Open http://localhost:5173 and enter a demo email. The migration service runs once before backend startup. Seeding is explicit and additive: **12 synthetic users, 150 leads, 150 creation audits and 75 additional activities**, spread across the prior 12 months with five reference statuses. `SEED_COUNT` is capped at 200. Repeating the seed does not reset data. Smoke tests add a small number of separate synthetic records. PostgreSQL and Redis use persistent volumes. `docker compose down` stops the stack while preserving them.

Local ports: app 5173, API 3000, PostgreSQL 5438, Redis 6388. Database and Redis ports bind only to loopback. Compose uses development credentials and settings; it is a local environment, not an internet deployment template.

### Native development

```sh
docker compose up -d postgres redis
cd server
npm ci
cp .env.example .env
npm run db:migrate
npm run db:seed
npm run dev
```

The backend also starts its background processor; no second server terminal is needed. In `app/`, run `npm ci`, copy `.env.example` to `.env`, then `npm run dev`. On PowerShell, use `Copy-Item .env.example .env` instead of `cp` if preferred. Stop the Compose API before binding the native API to port 3000, and stop the Compose app before running Vite on 5173. Vite uses strictPort so it does not silently move to another port.

### Adding a lead manually

Use **Add lead** on the leads page. The dialog sends a full snapshot to `POST /webhook/meta-lead` using the current access/refresh headers. It never exposes an integration key. Manual requests receive the webhook IP quota, use source `manual` (isolated from `meta`), and capture the signed-in actor in the receipt and audit. Both manual and keyed submissions share the webhook IP quota. They require version 1 and a UUID external lead ID. The UI preserves the submitted event ID/body for retries, polls the durable receipt for up to 30 seconds, then offers an explicit progress check. After processing it opens the lead. Validation failures allow editing; uncertain network failures retry the same submission.

Receipt lookup accepts `?source=manual` (default `meta`). Replay accepts `EVENT_ID [meta|manual]`. Closing the dialog retains its draft while the leads page remains mounted; a page reload does not retain that draft.

### Webhook credentials in PostgreSQL

There is **no server environment webhook secret and no HMAC requirement**. This follows the revised requirement. Callers send `X-Webhook-Key`. PostgreSQL stores a SHA-256 hash of each high-entropy key, a safe prefix, label, optional expiry and revocation time. Raw keys are returned only on creation/import. Store them in the sender's secret manager and use HTTPS.

```sh
docker compose exec api node dist/scripts/webhook-key.js create "Meta sender"
docker compose exec api node dist/scripts/webhook-key.js list
docker compose exec api node dist/scripts/webhook-key.js revoke CREDENTIAL_UUID
```

To import a key you provide, use `npm run webhook:key -- import "Meta sender"` from `server/` with client-only `WEBHOOK_KEY` set to a random value of at least 32 characters. The same variable is accepted by the sender CLI, **not used by API authentication configuration**. Rotate by creating/importing a replacement, updating the sender, then revoking the old credential.

```sh
# From server/, after setting WEBHOOK_KEY in this terminal:
npm run webhook:send -- --name "Avery Shah"
```

The full-snapshot contract is:

```json
{
  "eventId": "delivery-001",
  "externalLeadId": "meta-lead-001",
  "version": 1,
  "occurredAt": "2026-09-23T10:00:00Z",
  "data": {
    "fullName": "Avery Shah",
    "email": "avery@example.test",
    "phone": "+919876543210",
    "company": "Orbit Labs",
    "campaign": "Workspace enquiries",
    "metadata": { "interest": "Private office" }
  }
}
```

Send JSON with `Content-Type: application/json` and `X-Webhook-Key`. At least one valid contact method is required. Each delivery has a stable event ID; update the source version monotonically for changed lead snapshots. Preserve the event ID/payload when retrying an uncertain response. The endpoint models manual assignment intake; it is not a complete Meta subscription/Graph API integration.

## API reference

| Method and route | Purpose |
|---|---|
| `POST /signin` | `{email}` → user, catalog, settings, access/refresh tokens |
| `GET /me`, `PATCH /me` | Profile/catalog; allowlisted theme preference |
| `POST /signout` | Revoke the current session |
| `POST /webhook/meta-lead` | Durable asynchronous snapshot intake |
| `GET /webhook-events/:eventId` | Pending/processed/ignored/failed outcome and safe diagnostics |
| `GET /activities` | Searchable, filtered, cursor-paginated activity history |
| `GET /leads`, `GET /leads/:id` | Paginated lead list and lead detail |
| `PATCH /leads/:id/status` | `{statusId,expectedVersion}` |
| `GET /statuses`, `POST /statuses` | Catalog; create `{name,color}` |
| `PATCH /statuses/:id` | `{expectedVersion,name?,color?,position?,isDefault?:true}` |
| `PATCH /statuses/order` | `{items:[{id,expectedVersion}]}` for the complete active catalog |
| `DELETE /statuses/:id` | Archive `{expectedVersion,replacementStatusId?}` |
| `GET /dashboard/stream` | Authenticated SSE snapshots |
| `GET /health/live`, `/health/ready` | Process/dependency health |
| `GET /metrics` | Prometheus; separate `Authorization: Bearer METRICS_TOKEN` |

Protected application requests require both `Authorization: Bearer ACCESS_TOKEN` and `X-Refresh-Token: REFRESH_TOKEN`. REST returns `{data,meta:{requestId}}`; errors return `{error:{code,message},meta}`. SSE sends unwrapped JSON in default `data:` events.

```http
GET /leads?first=50&sort=CREATED_AT&direction=DESC&createdFrom=2026-09-01T00%3A00%3A00%2B05%3A30&createdTo=2026-10-01T00%3A00%3A00%2B05%3A30
GET /leads/LEAD_UUID
GET /activities?leadId=LEAD_UUID&types=LEAD_CREATED,STATUS_CHANGED&first=25
```

Lead inputs: `first/after` or `last/before`, `search`, `statusIds`, `source`, `createdFrom`, exclusive `createdTo`, `sort` (`CREATED_AT`, `UPDATED_AT`, `NAME`) and `direction`. Activity inputs additionally allow `leadId`, `actorId`, and `types`. Default page 50, maximum 100. Cursors are signed and bound to filters. Array filters use comma-separated values (`statusIds`, `types`). Date bounds are timestamps: start inclusive, end exclusive. The UI converts inclusive calendar dates in Asia/Kolkata into these bounds, including same-day ranges. Creation-time cutoffs exclude new arrivals; mutable sort keys can still move between pages, so refresh after concurrent edits.

## Authentication and abuse controls

**Intentional assignment exception:** email-only login lets anyone impersonate any email. Readable access/refresh tokens in `sessions` expose active accounts to database readers. This matches the requested flow, but is not verified production identity. Replace it with an identity provider and hashed session credentials before handling real customer data.

Access JWTs live 15 minutes, refresh JWTs seven days, with separate secrets/types and issuer/audience checks. Expired access requests lock the session and reuse or mint a single renewed token. Responses expose `X-Access-Token` and `X-Access-Token-Expires-At`. Sign-out revokes the database session. Frontend credentials use sessionStorage; persistent localStorage contains UI preferences only.

| Traffic | IP quota setting | Default |
|---|---|---|
| All REST routes, including sign-in, reads, writes and SSE connection requests | API_RATE_LIMIT | 120/minute/IP |
| Webhook endpoint, with a key or session tokens | WEBHOOK_RATE_LIMIT | 60/minute/IP |

These are shared token buckets, not separate quotas per route/user. Each bucket can initially admit its configured capacity and refills continuously over one minute. Health probes and CORS preflight are exempt. The separate fixed cap of three active SSE connections per user prevents long-lived resource accumulation; it is not another request-rate setting.

Redis token buckets are atomic, return `429`/`Retry-After`, and fail closed with 503. IP checks precede authentication and expensive work. JSON is limited to 64 KiB, metadata to 16 KiB. Supplied origins must exactly match `CLIENT_ORIGINS`; missing Origin is allowed for authenticated CLI callers. Forwarded IPs are trusted only through configured proxy ranges. REST rejects unknown filters, unsupported sorts and pages above 100. SQL values are parameterized and sort columns allowlisted.

Database pools, queue concurrency, admission backlog and request duration are bounded. Each API instance admits at most `MAX_INFLIGHT_REQUESTS` (default 16) ordinary requests at once and returns retryable 503 rather than building an unbounded database wait queue. New intake also returns 503 when the observed pending backlog reaches `MAX_PENDING_EVENTS` (default 5,000); the cached check is an overload signal, not an exact hard quota. Hosting-edge limits/WAF are still needed for volumetric attacks. SSE has separate admission, heartbeats, session checks, five-minute reconnects and slow-consumer closure; revocation can take up to the 15-second heartbeat interval.

## Response compression

The API uses [Express compression](https://expressjs.com/en/resources/middleware/compression/) with gzip/Brotli negotiation and a 1 KiB threshold. Gzip level 4 and Brotli quality 4 bound CPU cost. SSE remains uncompressed to preserve prompt streaming; sign-in responses containing tokens are excluded. Requests remain ordinary bounded JSON; compressed request bodies are rejected. Browsers decompress responses automatically, with no frontend codec dependency.

The Docker frontend uses [Nginx gzip](https://nginx.org/en/docs/http/ngx_http_gzip_module.html) for HTML, JavaScript, CSS, JSON and SVG, with `Vary: Accept-Encoding`. Vercel handles compression at its hosting edge. Static assets keep immutable caching.

## Testing and capacity scope

September 25 deployment revision: backend build, 25 unit tests, 25 PostgreSQL/Redis integration scenarios, both Docker builds, two Chromium journeys at port 5173 and the combined-process webhook-to-dashboard smoke passed. Runtime checks confirmed no standalone worker container, a shared pool of four and concurrency one. Hosted Render deployment remains unverified.

```sh
# server/
npm run build
npm test
npm run test:integration
npm run smoke
# app/
npm run build
npm test
npx playwright install chromium
npm run test:e2e
```

Integration creates a unique disposable `stylework_test_*` database and reserves Redis DB 15. Defaults use local Compose dependencies; override `TEST_DATABASE_URL` (a PostgreSQL admin connection) and `TEST_REDIS_URL` as needed. Never point these tests at customer infrastructure. The full smoke requires the backend with RUN_WORKER=true; it creates and revokes a temporary database webhook key unless `WEBHOOK_KEY` is provided. It adds a synthetic lead and retains its audit trail.

Local verification on 24 September 2026 passed: **22 backend unit tests, 25 real PostgreSQL/Redis integration scenarios, 7 frontend tests and 2 Playwright journeys**, plus independent production builds, complete Compose startup and the REST webhook-to-dashboard smoke journey. Superseded GraphQL tests were replaced by REST coverage. New regressions verify date boundaries, manual intake/authentication/quotas/audit, source isolation and compression negotiation. Chromium verifies manual creation and both same-day date filters with no GraphQL traffic. Frontend gzip responses decompress to the original asset. Desktop light/dark and mobile screenshots were inspected. Integration also verifies injected database rollback, duplicate acceptance/redelivery, ordering, session races, query limits, audit immutability, SSE revocation and recovery after Redis data loss. Crash boundaries are exercised through transaction fault injection and committed-job redelivery; exhaustive process-kill timing and multi-region chaos are future work. Hosted deployment has not been verified. Automated GitHub Actions configuration was removed at the owner's request; run the commands above locally.

The architecture aims to support millions of requests through bounded admission, durable asynchronous work, indexed reads and independent API/worker scaling. **This is an architectural target, not a certified throughput guarantee.** Per the revised user scope, demo data stays small and large datasets/load tests are excluded. An earlier local experiment did not meet the latency targets; it prompted quota and admission fixes, and its temporary database and large benchmark tooling were removed. No million-request capacity claim is made. Deployment-specific load validation requires separate authorization.

## Deployment steps

1. Push this repository to your Git host. Provision Neon PostgreSQL in the same region as the services. Set the pooled connection as `DATABASE_URL` and the direct connection as `DATABASE_DIRECT_URL`, with TLS enabled. Migrations use the direct connection because their advisory lock is session-scoped. See [Neon pooling](https://neon.com/docs/connect/connection-pooling).
2. Create a Render Blueprint using **Blueprint Path `server/render.yaml`**. It defines only one **free web service**. Supply external PostgreSQL/Redis URLs, the exact frontend origin and deployment-specific trusted proxy ranges. The database/Redis are not created by this Blueprint; Redis must support BullMQ connections/Lua and use noeviction. JWT/metrics secrets are generated on the service. API and processor run together with pool 4, concurrency 1 and a 256 MiB V8 heap cap (not a cap on total RSS). Migrations run before startup under the existing advisory lock because free web services have no paid pre-deploy hook. A failed migration prevents startup. Docker paths remain relative to the repository root even though the YAML moved. See [Blueprint fields](https://render.com/docs/blueprint-spec) and [deployment commands](https://render.com/docs/deploys).

3. Import the repo into Vercel with **Root Directory `app`**, Node 24 and `VITE_API_URL=https://YOUR-API.onrender.com`. [app/vercel.json](app/vercel.json) supplies SPA rewrites and response headers. Set the resulting exact Vercel/custom origin in the API and redeploy. Avoid wildcard preview origins for a shared database. See [Vercel configuration](https://vercel.com/docs/project-configuration).
4. Run the credential creation CLI locally with the production database connection; Render Free does not provide a service shell. Supply the resulting key only to the sender. Do not seed demo leads automatically in production. Explicit demonstration seeding requires `ALLOW_DEMO_SEED=true`.
5. Verify readiness, run a signed-in browser journey and send one keyed webhook through the backend processor. Record the public app/API URLs here after owner publication.

**Upgrade note:** migration `20260924000000-single-tenant-intake` (formerly 003) renames the configuration table. Stop the old API/worker, migrate once, then start both with the new image. Do not run old and new versions together during this rename. Fresh Compose startup handles migrations automatically.

The default runtime has one shared pool of **4 PostgreSQL connections** for API and jobs. Startup migrations use a separate pool of at most 4, closed before the API starts. Keep administrative headroom and budget for temporary old/new service overlap during deploys. Job concurrency is 1, outbox batches are 25, dispatch checks occur once/second and receipt reconciliation every 30 seconds. These small defaults reduce contention and idle polling on limited resources. Redis still needs several queue/PubSub connections, TLS, noeviction and provider-compatible connection quotas.

### Why keep background processing?

The webhook transaction saves a durable receipt quickly. The processor then creates/updates the lead and commits audit/counters together, retries failures and recovers unfinished receipts after restarts. It is asynchronous work, not a mandatory separate deployment. RUN_WORKER=true (default) loads it into the API with the same database pool. The standalone worker entrypoint remains optional for a future paid deployment: set RUN_WORKER=false on the API and run npm run start:worker separately. Separate processes trade extra memory/cost for failure isolation and independent scaling.

On [Render Free](https://render.com/docs/free), a web service can sleep after 15 idle minutes and restart at any time; background jobs pause while it sleeps. The next incoming request wakes it, after which PostgreSQL receipts are reconciled. Expect cold starts and delayed processing, not always-on production guarantees. The free tier also has bandwidth/hour limits; external database/Redis providers have their own limits. No artificial keep-alive traffic is configured.

## Operations and recovery

- **Pending backlog:** inspect `/metrics`, oldest receipt age and worker health. Restore database/Redis connectivity, then allow reconciliation to republish pending receipts. Never delete pending PostgreSQL receipts to clear a queue.
- **Failed events:** inspect `/webhook-events/:eventId`, fix the cause, then run `node dist/scripts/replay.js EVENT_ID`. Replaying a source-version conflict will still fail until a new correctly versioned event arrives. Replays preserve the original payload and request trace.
- **Redis loss:** restart Redis and workers. Durable pending receipts older than the enqueue grace period are reconciled every 30 seconds in batches of 25. Rate limits start with fresh buckets; edge controls remain important during recovery.
- **Counters:** during maintenance, run `node dist/database/cli.js rebuild-counters`. It blocks lead/activity writes while rebuilding an exact snapshot. Reconnection/periodic SSE snapshots recover missed notifications and calendar rollover.
- **Shutdown:** stop admission, close SSE subscribers, drain worker jobs within the shutdown deadline, then close Redis/PostgreSQL connections. Unacknowledged jobs are safe to redeliver. Give containers at least 35 seconds.
- **Monitoring:** protected Prometheus output includes HTTP latency/status, durable receipt outcomes/retries, oldest pending age, local pool usage/waiters, process metrics and SSE connections. Operational logs contain trace IDs, route/status/duration and safe error categories, without payloads or credentials. Audit contains business data and needs stricter access/retention controls than logs.
- **Retention and backups:** enable PostgreSQL point-in-time recovery and test restores. Retain receipts/outbox long enough for sender replay and investigations; no automatic destructive retention policy is enabled. Plan partitioning/archival before these tables grow without bound. Redis is recoverable delivery state, not a replacement for PostgreSQL backups.

## Trade-offs

The modular monolith keeps transactions and deployment understandable. Running API and jobs together minimizes deployment cost but shares CPU, memory and failure lifetime. PostgreSQL row/advisory locks and constraints establish correctness; Redis leases only coordinate stream admission. Database-first intake adds a write before acknowledgement but provides a durable acceptance boundary. Sharded counters avoid a singleton hot row at the cost of reconciliation tooling. Configurable statuses are data rather than enums, so renames and archival need no lead backfill.

This is a single-tenant application with broad signed-in permissions and an explicitly weak identity flow. There is no tenant isolation/RBAC, external Meta handshake, contact editing UI or hard deletion. Lists retain at most 20 pages and use virtualization; old pages can be fetched backward. SSE carries complete snapshots and uses fetch for both token headers. The UI shows a refresh notice instead of silently reordering lists on incoming changes.

## Scaling considerations

For a future paid deployment, separate and scale API/worker replicas using measured latency, pool wait and backlog age. Keep the same JWT secrets, PostgreSQL and Redis across replicas. Cap total connections, load-test indexes with realistic selectivity, and watch hot statuses. Apply CDN/edge filtering before the API. Separate BullMQ Redis from ephemeral limiter/cache traffic when contention or memory pressure justifies it. Add table partitioning, receipt/outbox retention, targeted read replicas and database capacity before assuming horizontal application scaling is sufficient. Distributed locking alone cannot make an unbounded workload safe.

## Future improvements

Verified identity and hashed refresh sessions; verified roles; actual Meta subscription/Graph API enrichment; OpenTelemetry tracing and alert dashboards; process-kill chaos at every queue acknowledgement boundary; cross-instance/long-duration SSE and browser coverage; accessible table keyboard navigation across unloaded pages; production load/soak tests and recovery drills; retention/partition automation; managed backups and disaster-recovery SLOs.

## Sequelize and migration conventions

Use Sequelize models for ordinary reads, associations, filters, aggregates and counter increments. Managed Sequelize transactions keep lead, activity and counter changes atomic. Migration files follow the standard timestamped `YYYYMMDDHHmmss-description.ts` format with `up(queryInterface)` and `down(queryInterface)`; table/column/index operations use QueryInterface. The existing Umzug runner discovers them automatically in source and compiled builds. This follows [Sequelize migration conventions](https://sequelize.org/docs/v6/other-topics/migrations/).

The migration runner translates the three former numeric history entries to timestamped names under its existing PostgreSQL advisory lock. It changes bookkeeping only: existing tables/data are not recreated. Fresh installations and partially migrated installations use the same runner. A rollback is destructive and is not invoked automatically; the down functions are tested only in disposable databases. The shared pg_trgm extension is deliberately retained on rollback.

Raw SQL remains only where the ORM lacks an equivalent operation with the same correctness/query shape:

- PostgreSQL advisory locks, generated search columns, immutable-audit triggers, and the expression index with its trigram operator class.
- Tuple cursor comparisons, using allowlisted columns and Sequelize-escaped values, preserve one composite-index range scan and microsecond timestamps. Other pagination filters/projections use the ORM.
- The capped webhook backlog count stops scanning at the admission threshold; an ordinary Model.count would scan every pending row.
- The activity counter uses one atomic additive upsert; ordinary upsert replaces the value. Status/day/total counters use Sequelize bulkCreate plus increment inside the existing transaction.
- A filtered metrics aggregate and the dashboard's two scalar index-top reads retain their PostgreSQL expressions.
- The demo lead/audit CTE creates audits only for rows actually inserted, including concurrent reruns. The maintenance counter rebuild keeps INSERT...SELECT/UNION and table locks inside PostgreSQL instead of loading all records into Node. User/reference seed inserts use QueryInterface.

All current server configuration fields and frontend environment variables have runtime callers. CLI-only variables (WEBHOOK_KEY, API_URL, SEED_COUNT, ALLOW_DEMO_SEED and test connection overrides) are intentional. No active settings were removed. The unused Radix dropdown package, old worker heartbeat-file writer and empty scripts placeholder were removed. Git ignores .agents/, .github/, .local/, AGENT.md and AGENTS.md; previously tracked local guidance is removed from the index, not from disk. Existing Git history is not rewritten.

September 25 ORM cleanup verification: both production builds, 25 backend unit tests, 30 PostgreSQL/Redis integration tests, 7 frontend tests, backend Docker build and the full webhook-to-dashboard smoke passed. Migration tests cover fresh/repeat/reverse execution and full/partial legacy history. Pagination regression covers microsecond timestamps, ties, forward/backward navigation, every lead sort and literal search wildcard characters. The existing local migration upgrade preserved record counts and settings; no persisted database was reset.
