---
name: service-mcp-server
description: Maintain the standalone SalesDrone read-only stdio adapter, API bounds and privacy-safe OTel runtime.
---
# MCP server

Owner theharithsa. Active Node 22 ESM service, entry src/cli.js; src/server.js owns 21 strict read tools, src/api-client.js owns fixed GET paths/HTTPS/PAT/deadline/concurrency/body limits. SalesDrone API 1.29.0 owns policy and data; never access Firestore or add writes here. Keep current reports distinct from presence, performance and historical snapshots. Follow sparse cursors. Private reminders remain private.

src/telemetry.js initializes one opt-in provider lifecycle with bounded queues/shutdown, user's lean McpInstrumentation class and explicit v2 callback bridge. No /register auto-patching, inputs/results, IDs, tokens, URL queries or raw exceptions. Runtime service salesdrone-mcp; version/build identity from scripts/build.mjs. Preserve root/HTTP child/log correlation and safe metrics. Invalid/export-failed telemetry must not fail reads or pollute stdout.

Run npm test/check/security:scan and dependency audit, plus foundation checks. test/protocol.test.js exercises real stdio/all tools; telemetry.test.js independently decodes OTLP and tests privacy/concurrency/export rejection. Capture docs harness with synthetic data only, record hashes and actual viewport. See README, docs/observability.md and docs/delivery.md. Source changes require linked checked PR and new SemVer after publication; main publishes via OIDC, no tag/version recycling. Read continuation before work.
