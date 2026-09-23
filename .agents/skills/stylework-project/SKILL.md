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
- Webhook authentication uses X-Webhook-Key, verified against a PostgreSQL key hash. No server environment webhook secret or HMAC requirement; this supersedes the original plan per user clarification.
- Update this file when invariants change; update the linked progress reference after every milestone.
- Maintain the agreed 18 meaningful commits; feature tests belong with their features.
- Seeders must not reset existing data. Integration tests use an isolated database.
- Record measured checks honestly, including blocked infrastructure and unverified load targets.
