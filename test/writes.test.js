import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { once } from "node:events";
import { resolve } from "node:path";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import {
  WRITE_TOOL_DEFINITIONS,
  WRITE_OPERATIONS,
} from "../src/write-tools.js";
import { createApiClient } from "../src/api-client.js";
import { TOOL_DEFINITIONS } from "../src/server.js";
import { normalizedRoute } from "../src/telemetry.js";
const token = "sd_pat_" + "a".repeat(32) + "_" + "b".repeat(43);
const key = "550e8400-e29b-41d4-a716-446655440000";
const bodies = {
  export_leads: { columns: ["name"] },
  create_lead: { name: "Synthetic Example" },
  reserve_attachment: {
    name: "synthetic.txt",
    contentType: "text/plain",
    size: 3,
  },
  delete_attachment: { expectedVersion: 1 },
  preview_lead_batch: {
    items: [{ id: "lead_1", expectedVersion: 1 }],
    changes: { stage: "New" },
  },
  apply_lead_batch: {
    items: [{ id: "lead_1", expectedVersion: 1 }],
    changes: { stage: "New" },
  },
  update_lead: { expectedVersion: 1, stage: "New" },
  archive_lead: { expectedVersion: 1 },
  restore_lead: { expectedVersion: 1 },
  assign_lead: { expectedVersion: 1, assignedToUid: null },
  create_activity: {
    expectedVersion: 1,
    type: "note",
    notes: "Synthetic note",
    disposition: "None",
  },
  correct_activity: {
    type: "note",
    notes: "Synthetic correction",
    disposition: "None",
    expectedRevision: 1,
  },
  update_automatic_reminder: { action: "dismiss", expectedRevision: 1 },
  create_task: { title: "Synthetic task", dueAt: "2026-12-01T10:00:00Z" },
  update_task: { expectedVersion: 1, state: "Completed" },
  delete_task: { expectedVersion: 1 },
  preview_import: {
    filename: "synthetic.csv",
    sheet: "Sheet1",
    rows: [{ name: "Synthetic" }],
  },
  commit_import: { expectedVersion: 1 },
  update_notification: { read: true },
};
function argumentsFor(operation) {
  const args = {};
  for (const p of operation.parameters) {
    if (p.in === "path") args[p.name] = "synthetic_1";
    else if (p.name === "Idempotency-Key") args.idempotencyKey = key;
  }
  if (operation.name === "upload_attachment") args.contentBase64 = "YWJj";
  else args.body = bodies[operation.name];
  return args;
}
test("every exposed tool maps to Swagger and every PAT write is covered with the same schema", async () => {
  const swagger = JSON.parse(
    await readFile(new URL("../docs/openapi.json", import.meta.url)),
  );
  const resolveSchema = (value) => {
    if (Array.isArray(value)) return value.map(resolveSchema);
    if (!value || typeof value !== "object") return value;
    if (value.$ref)
      return resolveSchema(
        swagger.components.schemas[value.$ref.split("/").at(-1)],
      );
    return Object.fromEntries(
      Object.entries(value)
        .filter(([k]) => k !== "$schema")
        .map(([k, v]) => [k, resolveSchema(v)]),
    );
  };
  const expected = [];
  for (const [path, item] of Object.entries(swagger.paths))
    for (const [method, op] of Object.entries(item))
      if (
        ["post", "put", "patch", "delete"].includes(method) &&
        op["x-personal-access-token-scope"]
      )
        expected.push(method.toUpperCase() + " " + path.replace("/api/v1", ""));
  assert.deepEqual(
    WRITE_OPERATIONS.map((o) => o.method + " " + o.path).sort(),
    expected.sort(),
  );
  for (const operation of WRITE_OPERATIONS) {
    const source =
      swagger.paths["/api/v1" + operation.path][operation.method.toLowerCase()];
    assert.ok(source.security.some((s) => "personalAccessToken" in s));
    assert.deepEqual(operation.body, resolveSchema(source.requestBody.content));
    assert.deepEqual(operation.parameters, source.parameters);
  }
  for (const [, , schema, route] of TOOL_DEFINITIONS) {
    const args = {
      id: "synthetic_1",
      memberId: "synthetic_1",
      ids: ["synthetic_1"],
    };
    const [path] = route(
      Object.fromEntries(
        Object.keys(schema.shape)
          .filter((k) => k in args)
          .map((k) => [k, args[k]]),
      ),
    );
    assert.ok(
      Object.entries(swagger.paths).some(
        ([p, o]) =>
          o.get?.["x-personal-access-token-scope"] &&
          new RegExp(
            "^" + p.replace("/api/v1", "").replace(/\{\w+\}/g, "[^/]+") + "$",
          ).test(path),
      ),
      path,
    );
  }
});
test("real stdio writes send exact documented methods, body bytes and original idempotency keys", async (t) => {
  const requests = [];
  const api = createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    requests.push({
      method: req.method,
      path: req.url.replace("/api/v1", ""),
      key: req.headers["idempotency-key"],
      contentType: req.headers["content-type"],
      body: Buffer.concat(chunks),
    });
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ ok: true, version: 2 }));
  });
  api.listen(0, "127.0.0.1");
  await once(api, "listening");
  t.after(() => {
    api.closeAllConnections();
    api.close();
  });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [resolve(process.env.MCP_TEST_ENTRY || "src/cli.js")],
    env: {
      SALESDRONE_API_TOKEN: token,
      SALESDRONE_API_URL: `http://127.0.0.1:${api.address().port}/api/v1`,
    },
    stderr: "pipe",
  });
  const c = new Client({ name: "synthetic-writes", version: "1.0.0" });
  t.after(() => c.close());
  await c.connect(transport);
  const tools = (await c.listTools()).tools;
  assert.equal(tools.length, 41);
  for (const operation of WRITE_TOOL_DEFINITIONS) {
    const args = argumentsFor(operation);
    const parsed = operation.inputSchema.parse(args);
    const result = await c.callTool({
      name: "salesdrone_" + operation.name,
      arguments: args,
    });
    assert.ok(!result.isError, JSON.stringify(result));
    const sent = requests.at(-1),
      expected = operation.request(parsed);
    assert.equal(sent.method, expected.method);
    assert.equal(sent.path, expected.path);
    assert.equal(sent.key, expected.idempotencyKey);
    assert.equal(
      sent.contentType,
      expected.binary ? "application/octet-stream" : "application/json",
    );
    assert.deepEqual(
      sent.body,
      expected.binary
        ? expected.body
        : Buffer.from(JSON.stringify(expected.body)),
    );
    assert.deepEqual(
      tools.find((t) => t.name === "salesdrone_" + operation.name).annotations,
      operation.annotations,
    );
  }
  const before = requests.length;
  for (const args of [
    { id: "../private", body: { expectedVersion: 1 } },
    { id: "lead_1", body: { stage: "Won" } },
    { id: "lead_1", body: { expectedVersion: 1, unexpected: true } },
  ])
    assert.equal(
      (await c.callTool({ name: "salesdrone_update_lead", arguments: args }))
        .isError,
      true,
    );
  assert.equal(
    (
      await c.callTool({
        name: "salesdrone_create_lead",
        arguments: { body: { name: "Synthetic" } },
      })
    ).isError,
    true,
  );
  assert.equal(requests.length, before);
});
test("write schemas reject traversal, invalid concurrency, oversized and noncanonical binary payloads", () => {
  const byName = Object.fromEntries(
    WRITE_TOOL_DEFINITIONS.map((o) => [o.name, o]),
  );
  for (const body of [
    { expectedVersion: 0 },
    { expectedVersion: 1.5 },
    { expectedVersion: 1, unknown: true },
  ])
    assert.equal(
      byName.update_lead.inputSchema.safeParse({ id: "lead_1", body }).success,
      false,
    );
  assert.equal(
    byName.update_lead.inputSchema.safeParse({
      id: "lead_1",
      body: { expectedVersion: 1, customFields: { invalid: "value" } },
    }).success,
    false,
  );
  assert.equal(
    byName.update_lead.inputSchema.safeParse({
      id: "lead_1",
      body: { expectedVersion: 1, email: "invalid" },
    }).success,
    false,
  );
  for (const value of ["@@@=", "YQ=", "YR==", "Y".repeat(11184816)])
    assert.equal(
      byName.upload_attachment.inputSchema.safeParse({
        id: "lead_1",
        attachmentId: "file_1",
        contentBase64: value,
      }).success,
      false,
    );
  assert.equal(
    byName.assign_lead.inputSchema.safeParse({
      id: "lead_1",
      body: { expectedVersion: 1 },
    }).success,
    false,
  );
});
test("write HTTP errors are sanitized, never retried and undocumented method/path pairs are denied", async () => {
  for (const [status, code] of [
    [400, "VALIDATION_FAILED"],
    [401, "UNAUTHENTICATED"],
    [403, "FORBIDDEN"],
    [409, "CONFLICT"],
    [429, "RATE_LIMITED"],
    [500, "API_ERROR"],
  ]) {
    let calls = 0;
    const api = createApiClient({
      token,
      fetchImpl: async () => {
        calls++;
        return new Response("private customer " + token, { status });
      },
    });
    await assert.rejects(
      () =>
        api.request({
          method: "PATCH",
          path: "/leads/lead_1",
          body: { expectedVersion: 1 },
        }),
      (e) => e.code === code && !e.message.includes(token),
    );
    assert.equal(calls, 1);
  }
  let calls = 0;
  const api = createApiClient({
    token,
    fetchImpl: async () => {
      calls++;
      return new Response(null, { status: 204 });
    },
  });
  for (const [method, path] of [
    ["DELETE", "/leads/lead_1"],
    ["PATCH", "/members/member_1"],
    ["POST", "/lead-data-reset"],
    ["GET", "/notifications/unknown"],
    ["POST", "/leads/../tasks"],
  ])
    await assert.rejects(
      () => api.request({ method, path, body: {} }),
      /PATH_DENIED/,
    );
  await assert.rejects(
    () => api.request({ method: "POST", path: "/leads", body: {} }),
    /INVALID_REQUEST/,
  );
  assert.equal(calls, 0);
  assert.deepEqual(
    await api.request({
      method: "DELETE",
      path: "/tasks/task_1",
      body: { expectedVersion: 1 },
    }),
    { ok: true },
  );
});
test("mutation timeout stays uncertain with one attempt; write telemetry strips all resource IDs", async () => {
  let calls = 0;
  const api = createApiClient({
    token,
    timeoutMs: 5,
    fetchImpl: async (_, o) => {
      calls++;
      return new Promise((_, reject) =>
        o.signal.addEventListener("abort", () => reject(Error("private"))),
      );
    },
  });
  await assert.rejects(
    () =>
      api.request({
        method: "PATCH",
        path: "/leads/lead_1",
        body: { expectedVersion: 1 },
      }),
    /CANCELLED_OR_TIMEOUT/,
  );
  assert.equal(calls, 1);
  assert.equal(
    normalizedRoute("/leads/private/attachments/private-file/content"),
    "/leads/:id/attachments/:attachmentId/content",
  );
  assert.equal(
    normalizedRoute("/activities/private/corrections"),
    "/activities/:id/corrections",
  );
  assert.equal(normalizedRoute("/notifications/private"), "/notifications/:id");
  assert.equal(normalizedRoute("/leads/batch/preview"), "/leads/batch/preview");
});
