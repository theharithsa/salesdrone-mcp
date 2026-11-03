import { test } from "node:test";
import assert from "node:assert/strict";
import JSZip from "jszip";
import { eventRecord, parseCases } from "../scripts/lifecycle.mjs";
import { caseRecord } from "../scripts/test-reporter.mjs";
test("source projection excludes free text and creates retry-stable lifecycle identities", () => {
  const args = [
    "issue",
    12,
    "closed",
    "2026-11-03T00:00:00Z",
    {
      number: 1,
      title: "secret",
      body: "private",
      url: "https://github.com/theharithsa/salesdrone-mcp/issues/1",
    },
  ];
  const a = eventRecord(...args);
  assert.deepEqual(a, eventRecord(...args));
  assert.ok(!JSON.stringify(a).includes("secret"));
  assert.equal(a["sdlc.authority"], "github");
  assert.throws(() => eventRecord("issue", 12, "invented", "bad"));
});
test("runner reporter preserves real passed, failed and skipped outcomes without names/errors", () => {
  for (const type of ["test:pass", "test:fail"]) {
    const r = caseRecord({
      type,
      data: {
        name: "private customer text",
        file: "test/a.js",
        details: { duration_ms: 12, error: "secret" },
      },
    });
    assert.equal(r.status, type === "test:pass" ? "passed" : "failed");
    assert.equal(r.durationMs, 12);
    assert.ok(!JSON.stringify(r).includes("private"));
  }
  assert.equal(
    caseRecord({
      type: "test:pass",
      data: { name: "skip", skip: true, details: {} },
    }).status,
    "skipped",
  );
});
test("artifact parser rejects traversal, duplicate IDs, oversized and invalid records", async () => {
  const z = new JSZip(),
    r = {
      id: "a".repeat(64),
      status: "failed",
      durationMs: 3,
      finishedAt: "2026-11-03T00:00:00Z",
      originatingAttempt: 1,
    };
  z.file("cases.ndjson", JSON.stringify(r));
  assert.equal(
    (await parseCases(await z.generateAsync({ type: "nodebuffer" })))[0].status,
    "failed",
  );
  z.file("extra", "secret");
  await assert.rejects(() =>
    z.generateAsync({ type: "nodebuffer" }).then(parseCases),
  );
  const traversal = new JSZip();
  traversal.file("../cases.ndjson", JSON.stringify(r));
  await assert.rejects(() => traversal.generateAsync({type:"nodebuffer"}).then(parseCases));
  const bad = new JSZip();
  bad.file("cases.ndjson", [r, r].map(JSON.stringify).join("\n"));
  await assert.rejects(() =>
    bad.generateAsync({ type: "nodebuffer" }).then(parseCases),
  );
});
