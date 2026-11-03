# MCP server continuation

Candidate 1.1.0, issue 1/milestone 1. Extracted compatible runtime from immutable npm 1.0.0 / SalesDrone6289b1522b25aa8da0c95d15bc2e77d9725f295e. New repository owns source, package tests, OTel and publishing; website PR135 removes duplicate workspace and adds badge. Original SalesDrone dirty .agents work is untouched.

Local protocol/OTLP tests and audit run without customer credentials. New source includes opt-in safe telemetry and user's lean instrumentation core0.0.2 (same class as1.0.4, without broad vulnerable register dependencies). Source is not a production certificate: check issue/PR/Actions/npm and separate tenant evidence for current publication/verification. Remaining release gates must be resolved before claiming completion. Runtime PATs never go in GitHub secrets. See README for commands and configuration.
