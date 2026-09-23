# AI collaboration record
## Tools and model
OpenAI Codex assisted this implementation. The session identifies the assistant as GPT-6 based; a more specific model identifier is not independently verified. No GPT-5.5 claim is made.

## Prompts
- The user requested a production-oriented Stylework lead intake service with NestJS, Sequelize/PostgreSQL, React, Docker, rate limiting, audit, workers, and tests.
- Architecture discussion resolved shared data, signed assignment payloads without third-party integration, email-only login, readable tokens, REST plus GraphQL, status-only editing, and local delivery.
- The user explicitly approved the recorded implementation plan and requested its implementation.

## Human decisions
The user specified the technology stack, independent app/server structure, shared workspace, authentication/token storage behavior, deployment targets, scope, and requested commit/testing cadence.

## AI-assisted sections
Codex authors implementation code, initial scaffolding, migrations, tests, Docker/deployment configuration, and documentation under the agreed decisions. Human review and actual manual changes should be recorded when they occur; none are invented here.

## Architecture decisions
See [architecture](docs/architecture.md). Key decisions: durable PostgreSQL inbox/outbox, idempotent workers, atomic audit and counters, configurable archived statuses, bounded GraphQL queries, fetch-based SSE, and independently deployable packages.

## Validation
Results are maintained in the project progress reference and final README. Unexecuted tests and performance targets are not reported as passed.
