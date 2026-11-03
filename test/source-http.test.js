import { test } from "node:test";
import assert from "node:assert/strict";
import { readSource, safeFailureCode } from "../scripts/source-http.mjs";
const sleep = async () => {};
test("source reads retry transient HTTP/network failures with a strict three-attempt bound", async () => {
  let calls = 0;
  const data = await readSource(
    "https://api.github.com/example",
    {},
    {
      sleep,
      fetchImpl: async () => {
        calls++;
        if (calls === 1) throw new TypeError("private-url-with-secret");
        if (calls === 2) return new Response("", { status: 503 });
        return Response.json({ id: 3 });
      },
    },
  );
  assert.deepEqual(data, { id: 3 });
  assert.equal(calls, 3);
  calls = 0;
  await assert.rejects(
    () =>
      readSource(
        "https://api.github.com/example",
        {},
        {
          sleep,
          fetchImpl: async () => {
            calls++;
            return new Response("", { status: 429 });
          },
        },
      ),
    (e) => e.code === "SOURCE_HTTP_429",
  );
  assert.equal(calls, 3);
});
test("persistent authorization, malformed JSON and oversized source bodies fail safely without retry loops", async () => {
  let calls = 0;
  await assert.rejects(
    () =>
      readSource(
        "https://api.github.com/example",
        {},
        {
          sleep,
          fetchImpl: async () => {
            calls++;
            return new Response("private auth error", { status: 403 });
          },
        },
      ),
    (e) => e.code === "SOURCE_HTTP_403",
  );
  assert.equal(calls, 1);
  await assert.rejects(
    () =>
      readSource(
        "x",
        {},
        { sleep, fetchImpl: async () => new Response("private invalid json") },
      ),
    (e) => e.code === "SOURCE_JSON_INVALID",
  );
  await assert.rejects(
    () =>
      readSource(
        "x",
        {},
        {
          sleep,
          fetchImpl: async () => new Response("x".repeat(2 * 1024 * 1024 + 1)),
        },
      ),
    (e) => e.code === "SOURCE_BODY_LIMIT",
  );
  assert.equal(safeFailureCode(Error("token private-url")), "OBSERVER_FAILED");
});
test("GraphQL source errors and artifact availability retry only their bounded transient cases", async () => {
  let calls = 0;
  const data = await readSource(
    "x",
    {},
    {
      sleep,
      graphql: true,
      fetchImpl: async () => {
        calls++;
        return Response.json(
          calls === 1
            ? { errors: [{ type: "NOT_FOUND", message: "private" }] }
            : { data: { id: 1 } },
        );
      },
    },
  );
  assert.equal(data.data.id, 1);
  assert.equal(calls, 2);
  calls = 0;
  const bytes = await readSource(
    "x",
    {},
    {
      sleep,
      binary: true,
      retry404: true,
      fetchImpl: async () => {
        calls++;
        return calls === 1
          ? new Response("", { status: 404 })
          : new Response("safe");
      },
    },
  );
  assert.equal(bytes.toString(), "safe");
  assert.equal(calls, 2);
});

test("pre-ingestion failures create a bounded safe receipt without raw configuration values", async () => {
  const { mkdtemp, readFile, rm } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join, resolve } = await import("node:path");
  const { spawnSync } = await import("node:child_process");
  const dir = await mkdtemp(join(tmpdir(), "salesdrone-observer-safe-"));
  try {
    const sentinel = "secret-config-sentinel";
    const result = spawnSync(
      process.execPath,
      [resolve("scripts/lifecycle.mjs")],
      {
        cwd: dir,
        env: {
          ...process.env,
          GITHUB_REPOSITORY: sentinel,
          GITHUB_EVENT_NAME: sentinel,
          GITHUB_RUN_ID: sentinel,
        },
        encoding: "utf8",
      },
    );
    assert.equal(result.status, 1);
    const raw = await readFile(join(dir, "observation.json"), "utf8");
    assert.ok(!raw.includes(sentinel));
    assert.ok(!result.stderr.includes(sentinel));
    const receipt = JSON.parse(raw);
    assert.equal(receipt.errorCode, "CONFIG_REPOSITORY");
    assert.equal(receipt.phase, "configuration");
    assert.equal(receipt.status, "failed");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
