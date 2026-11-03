---
name: service-sdlc-observer
description: Maintain source-confirmed GitHub lifecycle events and npm delivery observability for SalesDrone MCP.
---
# SDLC observer

Owner theharithsa. Active CI module: scripts/lifecycle.mjs, test-reporter.mjs, publish.mjs and .github/workflows/observe.yml / publish.yml. Read docs/delivery.md and observability.md. GitHub owns transitions/jobs/steps/links, actual Node runner owns cases, npm owns publication identity. Stable event IDs/source timestamps and originating attempt are invariants. No inferred development, free text, customer data or credentials in events/artifacts. Commit joins are not trace ancestry.

PR verification receives no secrets. Observer checks trusted main only; never execute PR heads/artifact code in privileged workflows. Bound archives/jobs/cases and reject invalid records. OIDC publication is main-only after checks, environment npm; immutable versions, exact npm gitHead/integrity, checked releases. Separate reporting failure from publication. DYNATRACE_API_TOKEN/tenant variable are CI bindings; never print values.

Run npm test, check/security/audit and foundation checks. test/lifecycle.test.js covers projection, retry identity, actual status normalization and untrusted archives. Reconcile missed issue/PR/run metadata via dispatch, then query tenant separately from acceptance receipts. Update continuation with remaining gates; preserve previous immutable release evidence.

Completed-run reconciliation also reads merged PR links/issues and matching GitHub releases, because GITHUB_TOKEN-created transitions may not dispatch sibling workflows. Zip data is decompressed through a bounded stream.

Issue3 strengthens publication processing/reconciliation: preserve submitted tarball identity, allow only unchanged packaged-source descendants, poll bounded registry visibility and archive pending receipts. PR release-policy check requires version bumps for src/README/LICENSE/package.json changes. Use conventional CloudEvent data plus canonical source/provider.

Source reads use scripts/source-http.mjs: three attempts for network/429/5xx, binary-artifact404 and typed transient GraphQL errors; persistent authorization/JSON failures stop. Responses are streamed with a2MiB cap. Failure receipts exist even before ingestion and contain only static error codes/phase, never raw errors, URLs or response bodies. Run test/source-http.test.js for injected retry/privacy cases.
