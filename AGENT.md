# AI collaboration record
## Tools and model
OpenAI Codex assisted this implementation. The session identifies the assistant as GPT-6 based; a more specific model identifier is not independently verified. No GPT-5.5 claim is made.

## Prompts
- The user requested a production-oriented Stylework lead intake service with NestJS, Sequelize/PostgreSQL, React, Docker, rate limiting, audit, workers, and tests.
- Architecture discussion resolved shared data, signed assignment payloads without third-party integration, email-only login, readable tokens, REST plus GraphQL, status-only editing, and local delivery.
- The user explicitly approved the recorded implementation plan and requested its implementation.
- During implementation, the user changed webhook authentication to database-backed secrets/auth keys supplied in request headers. The implementation uses X-Webhook-Key and hashed PostgreSQL credential records.
- The user subsequently limited sample data to 10–12 users, 100–200 leads and 50–100 additional activities. Final defaults are 12/150/75, plus one creation audit per lead. Large-data benchmarking was stopped and its temporary database/tooling removed.

## Human decisions
The user specified the technology stack, independent app/server structure, shared workspace, authentication/token storage behavior, deployment targets, scope, and requested commit/testing cadence.

## AI-assisted sections
Codex authors implementation code, initial scaffolding, migrations, tests, Docker/deployment configuration, and documentation under the agreed decisions. Human review and actual manual changes should be recorded when they occur; none are invented here.

## Manually written sections
The human supplied the requirements, implementation-plan approval and subsequent scope/authentication corrections. This session does not establish manually authored application code or documentation sections. Future manual contributions can be recorded with their commits.

## Architecture decisions
See [architecture](docs/architecture.md). Key decisions: durable PostgreSQL inbox/outbox, idempotent workers, atomic audit and counters, configurable archived statuses, bounded GraphQL queries, fetch-based SSE, and independently deployable packages.

## Validation
On 23 September 2026, local verification passed 23 backend unit tests, 22 real PostgreSQL/Redis integration scenarios, 6 frontend tests and one Chromium journey, both production builds, full Compose startup and the webhook-to-dashboard smoke. Test code was AI-assisted. Fault injection and redelivery cover important transaction boundaries; exhaustive process-kill/soak testing remains unimplemented. Render/Vercel/CI configuration parses locally, but hosted publication and remote CI have not run. Results and remaining limits are maintained in the project progress reference and README. Unexecuted tests and performance targets are not reported as passed.
