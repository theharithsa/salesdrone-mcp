import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import protobuf from "protobufjs";
import {
  telemetryConfiguration,
  normalizedRoute,
  safeError,
} from "../src/telemetry.js";
const schema = protobuf.parse(
  await readFile(
    new URL("fixtures/otlp-subset.proto", import.meta.url),
    "utf8",
  ),
).root;
const types = {
  traces: "ExportTraceServiceRequest",
  logs: "ExportLogsServiceRequest",
  metrics: "ExportMetricsServiceRequest",
};
async function run(t, reject = false) {
  const received = [],
    headers = [];
  const server = createServer(async (req, res) => {
    if (req.url.startsWith("/api/")) {
      headers.push(req.headers.traceparent);
      if (req.url.includes("failure-id")) res.statusCode = 403;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ name: "PRIVATE_CUSTOMER_SENTINEL" }));
      return;
    }
    const signal = req.url.split("/").at(-1);
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const raw = Buffer.concat(chunks);
    assert.equal(req.headers["content-type"], "application/x-protobuf");
    received.push({
      signal,
      data: schema
        .lookupType("wire." + types[signal])
        .toObject(schema.lookupType("wire." + types[signal]).decode(raw), {
          bytes: String,
          longs: String,
        }),
    });
    res.statusCode = reject ? 503 : 200;
    res.end();
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(
    () =>
      new Promise((done) => {
        server.closeAllConnections();
        server.close(done);
      }),
  );
  const base = `http://127.0.0.1:${server.address().port}`;
  const child = spawn(process.execPath, ["test/fixtures/telemetry-runner.js"], {
    env: {
      ...process.env,
      SALESDRONE_OTEL_ENABLED: "true",
      OTEL_EXPORTER_OTLP_ENDPOINT: base,
      OTEL_EXPORTER_OTLP_HEADERS: "Authorization=Api-Token%20synthetic-secret",
      TEST_API_URL: base + "/api/v1",
    },
  });
  let output = "";
  child.stdout.on("data", (c) => (output += c));
  child.stderr.on("data", (c) => (output += c));
  const [code] = await once(child, "exit");
  assert.equal(code, 0, output);
  assert.equal(output, "");
  return { received, headers };
}
test("OTLP protobuf spans, correlated logs, metrics and HTTP propagation remain private under concurrent success/failure", async (t) => {
  const { received, headers } = await run(t);
  for (const signal of Object.keys(types))
    assert.ok(
      received.some((r) => r.signal === signal),
      signal,
    );
  const spans = received
    .filter((r) => r.signal === "traces")
    .flatMap((r) =>
      r.data.resourceSpans.flatMap((s) => s.scopeSpans.flatMap((s) => s.spans)),
    );
  assert.equal(spans.length, 6);
  const roots = spans.filter((s) => s.kind === 2),
    children = spans.filter((s) => s.kind === 3);
  assert.equal(roots.length, 3);
  assert.equal(children.length, 3);
  for (const c of children) {
    const root = roots.find((r) => r.traceId === c.traceId);
    assert.ok(root);
    assert.equal(c.parentSpanId, root.spanId);
  }
  assert.equal(new Set(roots.map((r) => r.traceId)).size, 3);
  assert.ok(headers.every((h) => /^00-[a-f0-9]{32}-[a-f0-9]{16}-01$/.test(h)));
  const logs = received
    .filter((r) => r.signal === "logs")
    .flatMap((r) =>
      r.data.resourceLogs.flatMap((s) =>
        s.scopeLogs.flatMap((s) => s.logRecords),
      ),
    );
  assert.equal(logs.length, 6);
  for (const l of logs)
    assert.ok(
      spans.some((s) => s.traceId === l.traceId && s.spanId === l.spanId),
    );
  const metrics = received
    .filter((r) => r.signal === "metrics")
    .flatMap((r) =>
      r.data.resourceMetrics.flatMap((s) =>
        s.scopeMetrics.flatMap((s) => s.metrics),
      ),
    );
  assert.ok(metrics.some((m) => m.name === "salesdrone.mcp.tool.calls"));
  assert.ok(metrics.some((m) => m.name === "salesdrone.mcp.http.duration"));
  assert.ok(
    metrics.some((m) => m.name === "salesdrone.mcp.process.memory.rss"),
  );
  const serialized = JSON.stringify(received);
  for (const secret of [
    "PRIVATE_CUSTOMER_SENTINEL",
    "private-customer",
    "private-id",
    "failure-id",
    "synthetic-secret",
    "sd_pat_",
  ])
    assert.ok(!serialized.includes(secret), secret);
});
test("export rejection does not fail reads or print exporter credentials", async (t) => {
  await run(t, true);
});
test("telemetry is opt-in; configuration, error labels and routes are bounded", () => {
  assert.equal(telemetryConfiguration({}), null);
  for (const endpoint of [
    "http://remote.invalid",
    "https://user:pass@host.invalid",
    "https://host.invalid?secret=x",
  ])
    assert.throws(() =>
      telemetryConfiguration({
        SALESDRONE_OTEL_ENABLED: "true",
        OTEL_EXPORTER_OTLP_ENDPOINT: endpoint,
      }),
    );
  assert.equal(
    normalizedRoute("/team/members/private/activities"),
    "/team/members/:uid/activities",
  );
  assert.equal(safeError(Error("secret")), "READ_FAILED");
});
