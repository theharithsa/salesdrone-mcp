# Release impact: 1.2.0

Milestone 2, issue 9. Compatible feature release: 20 Swagger-listed PAT operations join 21 existing GET tools. All operations derive from API 1.29.0; reviewed full contract and reproducible projection ship in this repository. API/database/schema/indexes and SalesDrone deployment remain unchanged. No new settings, credentials or dependency versions. Existing PATs gain no scopes automatically. MCP clients pinned to 1.1.0 remain read-only.

Runtime changes: strict method/path allowlists, generated write body schemas, caller UUID keys, version guards, bounded base64 uploads, 10 MiB JSON ceiling, safe conflicts/validation errors and no mutation retry. Opt-in telemetry now records actual HTTP method and strips nested attachment/activity/notification IDs. Committed business events remain owned by the SalesDrone API; the MCP reports request execution without claiming an independent business commit.

Prepublication gates: all-tool stdio reads/writes over synthetic API, Swagger schema/coverage parity, invalid/denied/conflict/timeout/binary bounds, decoded OTLP privacy/correlation/export failure tests, metadata/package manifest/security/audit, foundation checks and linked checked PR. Historical 1.1.0 screenshots retain original hashes/version and are labeled historical; no UI changes or new screenshots claimed. No production customer writes for testing.

Postpublication gates: npm version/gitHead/integrity/provenance and GitHub release, clean installed-package stdio tests, lifecycle observation and separate tenant queries. Record actual outcomes in docs/releases/1.2.0.json. Rollback: pin 1.1.0 or ship a forward checked patch. Never recycle versions or automatically reverse customer writes.
