---
name: service-sdlc-observer
description: Maintain source-confirmed GitHub lifecycle events and npm delivery observability for SalesDrone MCP.
---
# SDLC observer

Owner theharithsa. Active CI module: scripts/lifecycle.mjs, test-reporter.mjs, publish.mjs and .github/workflows/observe.yml / publish.yml. Read docs/delivery.md and observability.md. GitHub owns transitions/jobs/steps/links, actual Node runner owns cases, npm owns publication identity. Stable event IDs/source timestamps and originating attempt are invariants. No inferred development, free text, customer data or credentials in events/artifacts. Commit joins are not trace ancestry.

PR verification receives no secrets. Observer checks trusted main only; never execute PR heads/artifact code in privileged workflows. Bound archives/jobs/cases and reject invalid records. OIDC publication is main-only after checks, environment npm; immutable versions, exact npm gitHead/integrity, checked releases. Separate reporting failure from publication. DYNATRACE_API_TOKEN/tenant variable are CI bindings; never print values.

Run npm test, check/security/audit and foundation checks. test/lifecycle.test.js covers projection, retry identity, actual status normalization and untrusted archives. Reconcile missed issue/PR/run metadata via dispatch, then query tenant separately from acceptance receipts. Update continuation with remaining gates; preserve previous immutable release evidence.
