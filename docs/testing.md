# Testing

Run npm test, npm run check, npm run security:scan, npm audit --audit-level=moderate, sh scripts/check.sh and python3 scripts/check_foundation.py --ready. Node 22.18+ required. No real credential is required. npm run build embeds package version and GITHUB_SHA or current HEAD. CI reporter is scripts/test-reporter.mjs; cases.ndjson contains only hashed identity, status, duration, actual timestamp and originating attempt. It preserves failures/skips; no free-text failure output is exported.

npm run demo uses isolated synthetic API fixtures and the real stdio client/server on loopback; public captures are manually reviewed with the approved browser. Screenshot manifest records actual measured viewport and image dimensions. Do not claim physical devices or Safari from that render. Website API authorization/emulator tests remain in the SalesDrone repository.
