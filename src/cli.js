#!/usr/bin/env node
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { createServer } from "./server.js";
import { createApiClient } from "./api-client.js";
import { startTelemetry } from "./telemetry.js";
import { VERSION } from "./version.js";
if (process.argv.includes("--help")) {
  console.log(
    "salesdrone-mcp: read-only stdio MCP server\nRequires SALESDRONE_API_TOKEN. Optional SALESDRONE_API_URL (HTTPS /api/v1 base).\nOptional telemetry: SALESDRONE_OTEL_ENABLED=true plus standard OTLP endpoint/headers. stdout is reserved for MCP messages.",
  );
} else if (process.argv.includes("--version")) console.log(VERSION);
else {
  try {
    const options = {
      token: process.env.SALESDRONE_API_TOKEN,
      apiUrl: process.env.SALESDRONE_API_URL,
    };
    createApiClient(options);
    const telemetry = await startTelemetry();
    const handle = serveStdio(() => createServer({ ...options, telemetry }), {
      onerror: () => process.stderr.write("SalesDrone MCP protocol error.\n"),
    });
    let closing = false;
    const close = async () => {
      if (closing) return;
      closing = true;
      await handle.close().catch(() => {});
      await telemetry.shutdown();
    };
    process.stdin.once("end", () => {
      void telemetry.shutdown();
    });
    for (const signal of ["SIGINT", "SIGTERM"])
      process.once(signal, () => {
        void close();
      });
  } catch {
    process.stderr.write(
      "SalesDrone MCP could not start. Check token and API configuration.\n",
    );
    process.exitCode = 1;
  }
}
