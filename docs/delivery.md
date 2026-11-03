# Independent release delivery

Repository: theharithsa/salesdrone-mcp, public, main. Package: @theharithsa/salesdrone-mcp. Source changes require an issue, target milestone and checked PR. Candidate 1.1.0 belongs to milestone 1 / issue 1; do not bump repeatedly during review. App/API versions are independent.

`publish.yml`: pull requests verify without secrets; pushes/merges to main verify then publish using environment `npm`. Node 22, npm 11.19.0, pinned actions. Trusted publisher configuration must match owner/repo, `publish.yml`, environment `npm`, allow-publish. Configure with `npm trust github @theharithsa/salesdrone-mcp --file=publish.yml --repo=theharithsa/salesdrone-mcp --env=npm --allow-publish --yes`; npm requires user MFA. No long-lived NPM_TOKEN is needed. Restrict the environment to main and configure required branch checks per repository policy. Never bypass failed checks.

`observe.yml`: repository variable DYNATRACE_TENANT_URL = https://indiacs.live.dynatrace.com, secret DYNATRACE_API_TOKEN with BizEvents/logs/metrics/traces ingest permissions. No personal/customer/runtime PAT is a CI secret. Workflow events run trusted main only and inspect GitHub metadata; archives contain sanitized data, never executable code. Issue/PR/review events are metadata-only. Source checkout does not follow PR-head inputs. Observe failures do not undo a successful npm publication.

Dispatch reconciliation with issue numbers, PR numbers or a workflow run ID. This records source-confirmed creation/current/closure transitions, not every missing intermediate edit. Workflow reruns retrieve the current attempt; case records preserve their originating attempt. Follow reporting receipts with independent tenant queries. Stable IDs permit consumer deduplication; no exactly-once ingest claim.

Publication verifies package name/version/gitHead/integrity, then creates immutable tag/release. A repeat of the exact revision is safe; a new commit at a published version fails. Build embeds GITHUB_SHA. Rollback is a new checked patch release from known-good source/config; never overwrite tarballs or recycle tags. Keep the previous working npm version pinned if needed.
