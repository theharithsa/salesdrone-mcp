# MCP server continuation

Published @theharithsa/salesdrone-mcp1.2.0 is immutable at ceef9a50393941620153d1df06200374e52f4943, released through checked PR10 / issue9 / milestone2. Main run42208989044 passed verification and npm OIDC publication; see docs/releases/1.2.0.json for integrity, provenance, exact CI and tenant evidence. Documentation-only follow-ups reconcile the original publication without uploading another tarball.

41 tools:21 GET reads plus20 Swagger API1.29.0 PAT operations. Source snapshot/projection and operation mapping are docs/openapi.json, src/write-contract.json and docs/api-tools.md. Scripts/sync-api-contract.mjs --check rejects drift. No unlisted or Google/App Check-only tools, database access or permanent lead deletion. Callers supply required replay UUIDs; read versions before updates. No automatic mutation retries; timeouts may have committed. Existing tokens gain no scopes automatically.

Main Node22 CI22 cases and foundation21 passed. The clean registry install passed11 protocol/write suite cases, with actual installed stdio discovery and all41 operations,56 package signatures and39 attestations verified, audit0. Runtime synthetic fixtures emitted4 tool roots,4 actual HTTP children,8 matching correlated logs and metric4. All3 OTLP responses200/zero rejection; signals separately queried in Dynatrace. Main CI artifact22 exact case IDs match tenant records; issue9/PR10/release events are searchable. No production customer writes or physical-device/Safari claims.

The website/API is unchanged by this release. Original SalesDrone dirty .agents work remains untouched. Working checkout: /Users/theharithsa/.codex/workspaces/salesdrone-mcp. Historical1.1.0 publication/screenshots retain their original source/hash evidence in docs/releases/1.1.0.json and docs/screenshots/manifest.json.

No implementation is carried over. Next packaged changes require a new candidate version, linked issue and checked PR. Never overwrite/recycle npm versions or tags, put runtime PATs in CI, or log request/result/contact/attachment bytes. Read AGENTS.md and current Git/PR/npm state before relying on this handoff.
