# SDLC observer continuation

Candidate1.1.0 / issue1. Main-only OIDC publication workflow and separate source-owned lifecycle observer implemented; check current PR and Actions before relying on delivery state. Trusted publisher and CI Dynatrace secret/variable bindings are external setup gates. Existing SalesDrone tenant is indiacs.live.dynatrace.com. No NPM_TOKEN is required. npm MFA may need human completion.

Case artifacts contain hashed identities/status/duration/timestamps/attempts only. Source reconciliation captures creation/current/closure, not every historical intermediate edit. Receipts are acceptance, tenant search is separate. Never close a gap based only on HTTP success. See docs/delivery.md for commands/configuration and service skill for tests/invariants.
