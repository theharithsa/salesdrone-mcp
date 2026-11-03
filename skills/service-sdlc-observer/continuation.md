# SDLC observer continuation

PR2 delivered independent source/publication; PR4 fixed processing reconciliation/provider identity. Published npm1.1.0 remains at1c5641f9e3c98b480af1ba018dc5c95d0f0db0d3; operational main baseline23fca01ab5eec1daa072b88b370b335eb28b3def passed run41703700082. Receipt distinguishes reportingRevision from publicationRevision and confirms unchanged packaged source. npm submission had signed provenance; initial visibility poll failed while processing, then normal failed-job reconciliation succeeded. Never upload that version again.

Trusted publisher: repo theharithsa/salesdrone-mcp, publish.yml, npm environment restricted to main. Existing Dynatrace ingestion binding/tenant variable configured; no NPM_TOKEN. Future setup/auth changes may require human MFA. Private values never appear in evidence.

Canonical provider avinyatech.salesdrone.mcp.sdlc now uses conventional CloudEvent data. Initial historical records retain GitHub-repository-URL provider. Tenant queried current workflow1/job2/step22/test13 success records, reconciled with actual13-case artifact. Source reconciliation run41703988378 also verified original release metadata. No inferred development or fabricated review records. Stable IDs support consumer deduplication, not exactly-once ingestion.

See docs/releases/1.1.0.json and docs/delivery.md. Evidence is revision-bound; inspect current runs before making new claims. No unfinished implementation remains; next work must use its own linked issue/checked PR. Operational/docs-only changes need no new tarball when packaged paths are identical; CI rejects unchanged-version packaged changes. Preserve original failed/reconciled history.

Issue7 records repeated pre-ingestion source failures. Add bounded source retries and safe phase/error-code receipts rather than relying on manual reruns or printing raw failures. Package source remains unchanged. Current-head CI/observer results must be inspected before declaring this follow-up verified.
