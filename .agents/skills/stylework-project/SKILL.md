---
name: stylework-project
description: Implement and maintain this Stylework lead intake application, including its Nest API and worker, React app, and reliability tests.
---
# Stylework project
Read [progress](references/progress.md) to resume work and [architecture](../../../docs/architecture.md) for decisions.

## Invariants
- app and server have independent dependencies, build contexts, and configuration.
- PostgreSQL owns receipts, leads, audit, counters, and outbox. Acknowledge intake only after commit.
- Redis/BullMQ delivery is at least once; processing is idempotent in PostgreSQL. Reconcile pending receipts after Redis loss.
- Lead, audit, counter changes, and notification outbox commit together.
- Statuses are stable IDs and archived, never destructively removed.
- Email-only sign-in and readable session tokens are explicit user requirements; document these limitations accurately.
- Keep raw tokens and PII out of operational logs.
- External webhook authentication uses X-Webhook-Key, verified against a PostgreSQL key hash. Manual lead creation uses the same route with access/refresh tokens and normal mutation quotas; no integration key reaches the browser. Persist the trusted actor and isolate manual/meta source IDs.
- REST only: leads, lead detail and activities. GraphQL/Apollo were removed at the user's request on September 24. Keep cursor pagination, strict schemas and query bounds.
- Single tenant: app_settings is a singleton for default status, timezone and catalog revision, not a workspace/tenant table. Migration 003 preserves the previous configuration. Models have separate files under server/src/database/models.
- API response compression negotiates gzip/Brotli; frontend Nginx compresses static responses. SSE and sign-in responses are excluded. Request JSON stays bounded and uncompressed.
- Update this file when invariants change; update the linked progress reference after every milestone.
- The initial 18 commits are complete. Make focused follow-up commits for requested revisions; feature tests belong with their features.
- Seeders must not reset existing data. Integration tests use an isolated database.
- Record measured checks honestly, including blocked infrastructure and unverified load targets.
- Latest user correction: seed only 12 users, 150 leads and 75 additional activities (plus creation audits). Do not generate large datasets or run large load tests. Millions of requests is an architectural goal, not authorization for a million-row benchmark.
