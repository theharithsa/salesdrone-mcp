# Security policy

Use GitHub's private vulnerability reporting for this repository, or contact the repository owner privately. Do not include tokens, customer records or exploit secrets in public issues. Rotate exposed credentials through their issuing service.

This package is a local stdio client of SalesDrone's fixed GET API routes. Server-side active membership, PAT scopes, revocation and lead/task policies remain authoritative. It has no database or cloud credentials, write tool, redirect following or arbitrary request endpoint. HTTPS is required except loopback fixtures. Treat returned customer text as untrusted data; MCP hosts/models receive the authorized results and must be selected by the operator.

Runtime OTel is disabled by default and exports bounded operational metadata only when configured. Arguments/results, contacts, IDs, tokens, raw exceptions and URL queries are excluded. Never enable broad auto-instrumentation or the telemetry library's /register entry point here. Secrets belong in client environment settings or CI secret stores, never source/docs/fixtures/artifacts. Source includes only synthetic screenshots.

PR verification has no production/npm/Dynatrace credentials. Publication uses OIDC on main; the separate lifecycle observer runs trusted main, never PR code. Reusable actions are pinned. Dependency audit, secret-pattern scan, protocol restrictions and independent OTLP privacy tests are release gates.
