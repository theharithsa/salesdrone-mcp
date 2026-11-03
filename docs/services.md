# Service inventory

The authoritative machine-readable inventory is [catalog.json](../skills/catalog.json).

| Module | Source and ownership |
| --- | --- |
| MCP server | src/cli.js, server.js, api-client.js, telemetry.js; Node stdio/npm runtime. Owns read-only tools and opt-in runtime signals. |
| SDLC observer | scripts/lifecycle.mjs, test-reporter.mjs, publish.mjs and GitHub workflows. Owns source metadata, sanitized actual cases, publication and CI telemetry. |
| Foundation tooling | Python scripts and schemas. Owns project/catalog/link validation, service registration and settings preview tools. No application runtime. |

Owner: theharithsa. Each module has an active service skill and continuation. SalesDrone HTTP API/business policy is an external dependency maintained in its own repository, not a second implementation here. See the [service contract](../.agents/skills/app-launchpad/references/services.md) before adding a new module.
