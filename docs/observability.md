# Observability contract

Runtime owner: `src/telemetry.js`; service `salesdrone-mcp`. SDLC owner: `scripts/lifecycle.mjs`; service `salesdrone-mcp-sdlc`. Both use bounded SDK queues, HTTP/protobuf exporters and one provider lifecycle per process. The runtime bridge uses the user's lean instrumentation class, with manual v2 callback boundaries; no automatic fetch/HTTP/console instrumentation is installed. No RUM/session replay exists.

All runtime attributes are allowlisted in source: tool name, GET, normalized route, outcome, safe error code, duration and process RSS. Resource fields contain version/commit/environment/instance. IDs are normalized before spans or metrics. W3C trace headers connect real client/API requests if the receiving API accepts them; commit joins with CI are metadata, never fabricated trace ancestry. Unknown exceptions become READ_FAILED. No customer content is recorded.

HTTP timeout 15 seconds, four active requests, 2 MiB response; span queue 512, log queue 256, batch 100, export timeout 1 second, flush/shutdown wait capped at 3 seconds. SDK retry behavior is bounded by exporter timeouts; no durable spool/delivery guarantee. Abrupt process termination may lose telemetry. Read success does not imply export success. SDK diagnostic errors are disabled to avoid credential-bearing exporter errors; invalid configuration produces a fixed stderr diagnostic. No telemetry is sent unless explicitly enabled.

SDLC events use GitHub API source timestamps and stable IDs. Reporter captures actual Node test outcomes, SHA-256 case identity, duration, timestamp and originating attempt; names/errors are excluded. Observer inspects at most 100 jobs/artifacts, 2 MiB compressed/uncompressed cases, 2000 cases; overflows fail visibly. Zip entries are data only. Lifecycle BizEvent ingestion retries 429/5xx up to three attempts; other errors stop. Receipts retained 30 days distinguish accepted events from tenant-search verification. Reconciliation can repeat stable IDs; consumers should deduplicate by event.id (ingest is not claimed exactly-once).

## Verification

`test/telemetry.test.js` decodes independent OTLP protobuf schemas. Assertions cover concurrent roots/children, HTTP propagation, correlated log IDs, metrics, safe errors, no sentinel/token/customer identifiers, and export rejection without failed reads/stdout leaks. Protocol tests independently launch the real stdio server and call all tools against synthetic fixtures. Lifecycle projection/reporter/archive tests preserve pass/fail/skip and reject malformed inputs.

After release, query Dynatrace separately for spans/logs/metrics on service.name + service.version/build.commit, and BizEvents by event.provider + repository/run ID. Record actual counts and timestamps in sanitized release evidence. HTTP 2xx is acceptance only; absent tenant results remain an open verification gap. The local synthetic test is not a production customer-data test or physical-device certification.

Example DQL (adapt field names if tenant mappings differ):

```text
fetch spans, from:now()-1h
| filter service.name == "salesdrone-mcp"
| summarize count(), by:{span.name}

fetch logs, from:now()-1h
| filter service.name == "salesdrone-mcp"
| fields timestamp, content, trace_id, span_id

fetch bizevents, from:now()-1d
| filter event.provider == "avinyatech.salesdrone.mcp.sdlc"
| summarize count(), by:{event.type}
```

CloudEvents use source=avinyatech.salesdrone.mcp.sdlc and allowlisted fields inside data. Dynatrace derives provider from source; initial1.1.0 events used https://github.com/theharithsa/salesdrone-mcp. Both sets retain actual source timestamps and stable IDs. Do not silently relabel historical events.

Source metadata/GraphQL/artifact reads retry at most three times for selected transient failures, with a2MiB streaming response cap. Persistent authorization/invalid JSON stops. Pre-ingestion failures now archive a static errorCode/phase receipt, without raw errors, response bodies or credential-bearing URLs. Original failed attempts remain visible; successful retries do not rewrite history.
