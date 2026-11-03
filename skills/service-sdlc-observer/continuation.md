# SDLC observer continuation

Candidate1.1.0 / issue1. Main-only OIDC publication workflow and separate source-owned lifecycle observer implemented; check current PR and Actions before relying on delivery state. Trusted publisher and CI Dynatrace secret/variable bindings are external setup gates. Existing SalesDrone tenant is indiacs.live.dynatrace.com. No NPM_TOKEN is required. npm MFA may need human completion.

Case artifacts contain hashed identities/status/duration/timestamps/attempts only. Source reconciliation captures creation/current/closure, not every historical intermediate edit. Receipts are acceptance, tenant search is separate. Never close a gap based only on HTTP success. See docs/delivery.md for commands/configuration and service skill for tests/invariants.

Follow-up issue3: npm accepted1.1.0 with signed provenance from1c5641f9e3c98b480af1ba018dc5c95d0f0db0d3 in run41702632848, then its12-second registry visibility check failed during processing. This is not a failed npm upload and must not authorize republishing/replacing that version. Reconcile after visibility; CI-only fixes retain package source/version. Dynatrace confirmed source metadata under the initial GitHub-URL provider; follow-up canonicalizes future envelopes.
