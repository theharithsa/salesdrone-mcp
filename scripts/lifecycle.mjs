import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import JSZip from "jszip";
import { startTelemetry } from "../src/telemetry.js";
import { readSource, safeFailureCode } from "./source-http.mjs";
let phase = "configuration";
const hash = (v) => createHash("sha256").update(String(v)).digest("hex");
const states = new Set([
  "open",
  "closed",
  "created",
  "edited",
  "reopened",
  "merged",
  "completed",
  "in_progress",
  "queued",
  "success",
  "failure",
  "cancelled",
  "skipped",
  "timed_out",
  "neutral",
  "action_required",
  "stale",
  "pending",
  "approved",
  "changes_requested",
  "commented",
  "dismissed",
  "passed",
  "failed",
  "todo",
]);
export function eventRecord(kind, id, status, time, metadata = {}) {
  if (
    !/^(issue|pr|review|workflow|job|step|test|release)$/.test(kind) ||
    !states.has(status) ||
    !Number.isFinite(Date.parse(time))
  )
    throw Error("Invalid source metadata");
  const safe = {};
  for (const k of [
    "number",
    "runId",
    "jobId",
    "attempt",
    "originatingAttempt",
    "durationMs",
    "revision",
    "headRevision",
    "mergeRevision",
    "baseRevision",
    "caseId",
    "identityHash",
    "linkedIssues",
    "url",
    "version",
    "truncated",
  ])
    if (metadata[k] !== undefined) safe[k] = metadata[k];
  return {
    specversion: "1.0",
    id: hash(
      `${process.env.GITHUB_REPOSITORY}:${kind}:${id}:${status}:${time}`,
    ),
    source: "avinyatech.salesdrone.mcp.sdlc",
    type: `sdlc.${kind}.${status}`,
    time,
    data: {
      "event.provider": "avinyatech.salesdrone.mcp.sdlc",
      "event.type": `sdlc.${kind}.${status}`,
      "event.id": hash(
        `${process.env.GITHUB_REPOSITORY}:${kind}:${id}:${status}:${time}`,
      ),
      timestamp: Date.parse(time),
      "sdlc.authority": kind === "test" ? "node:test" : "github",
      "sdlc.kind": kind,
      "sdlc.status": status,
      repository: process.env.GITHUB_REPOSITORY,
      ...safe,
    },
  };
}
export async function parseCases(zipBytes) {
  if (zipBytes.length > 2 * 1024 * 1024) throw Error("Oversized case archive");
  const zip = await JSZip.loadAsync(zipBytes);
  const files = Object.values(zip.files).filter((f) => !f.dir);
  if (
    files.length !== 1 ||
    files[0].name !== "cases.ndjson" ||
    files[0].unsafeOriginalName !== "cases.ndjson" ||
    files[0]._data?.uncompressedSize > 2 * 1024 * 1024
  )
    throw Error("Invalid case archive");
  const text = await new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    const stream = files[0].internalStream("nodebuffer");
    stream.on("data", (chunk) => {
      size += chunk.length;
      if (size > 2 * 1024 * 1024) {
        stream.pause();
        reject(Error("Oversized case data"));
      } else chunks.push(chunk);
    });
    stream.on("error", reject);
    stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    stream.resume();
  });
  if (text.length > 2 * 1024 * 1024) throw Error("Oversized case data");
  const lines = text.trim().split("\n");
  if (lines.length > 2000) throw Error("Too many cases");
  const seen = new Set();
  return lines.filter(Boolean).map((line) => {
    const r = JSON.parse(line);
    if (
      !/^[a-f0-9]{64}$/.test(r.id) ||
      !["passed", "failed", "skipped", "todo"].includes(r.status) ||
      !Number.isFinite(r.durationMs) ||
      r.durationMs < 0 ||
      !Number.isInteger(r.originatingAttempt) ||
      r.originatingAttempt < 1 ||
      !Number.isFinite(Date.parse(r.finishedAt)) ||
      seen.has(r.id)
    )
      throw Error("Invalid case record");
    seen.add(r.id);
    return {
      id: r.id,
      status: r.status,
      durationMs: r.durationMs,
      finishedAt: r.finishedAt,
      originatingAttempt: r.originatingAttempt,
    };
  });
}
async function main() {
  const env = process.env,
    repo = env.GITHUB_REPOSITORY;
  if (repo !== "theharithsa/salesdrone-mcp")
    throw Error("Unexpected repository");
  const tenant = new URL(env.DYNATRACE_TENANT_URL);
  if (
    tenant.protocol !== "https:" ||
    tenant.hostname !== "indiacs.live.dynatrace.com" ||
    tenant.username ||
    tenant.password ||
    tenant.search ||
    tenant.hash
  )
    throw Error("Unexpected tenant");
  phase = "source-metadata";
  const gh = (path, binary = false) =>
    readSource(
      "https://api.github.com/repos/" + repo + path,
      {
        headers: {
          Authorization: "Bearer " + env.GH_TOKEN,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
      },
      { binary, retry404: binary },
    );

  const payload = JSON.parse(await readFile(env.GITHUB_EVENT_PATH, "utf8")),
    events = [];
  const add = (...args) => events.push(eventRecord(...args));
  const issue = async (n) => {
    const i = await gh("/issues/" + n);
    for (const [s, t] of [
      ["created", i.created_at],
      [i.state, i.closed_at || i.updated_at],
    ])
      add("issue", i.id, s, t, { number: i.number, url: i.html_url });
  };
  const pr = async (n) => {
    const p = await gh("/pulls/" + n);
    const links = await readSource(
      "https://api.github.com/graphql",
      {
        method: "POST",
        headers: {
          Authorization: "Bearer " + env.GH_TOKEN,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query:
            'query { repository(owner:"theharithsa",name:"salesdrone-mcp") { pullRequest(number:' +
            Number(n) +
            ") { closingIssuesReferences(first:100) { nodes { number } } } } }",
        }),
        signal: AbortSignal.timeout(15000),
      },
      { graphql: true },
    );
    if (links.errors) throw Error("PR issue links unavailable");
    const metadata = {
      number: p.number,
      url: p.html_url,
      headRevision: p.head.sha,
      baseRevision: p.base.sha,
      mergeRevision: p.merged_at ? p.merge_commit_sha : undefined,
      linkedIssues:
        links.data.repository.pullRequest.closingIssuesReferences.nodes.map(
          (n) => n.number,
        ),
    };
    for (const number of metadata.linkedIssues) await issue(number);
    add("pr", p.id, "created", p.created_at, metadata);
    add(
      "pr",
      p.id,
      p.merged_at ? "merged" : p.state,
      p.merged_at || p.closed_at || p.updated_at,
      metadata,
    );
  };
  const run = async (id) => {
    const r = await gh("/actions/runs/" + id);
    const meta = {
      runId: r.id,
      attempt: r.run_attempt,
      revision: r.head_sha,
      url: r.html_url,
    };
    add(
      "workflow",
      r.id + ":" + r.run_attempt,
      r.conclusion || r.status,
      r.updated_at,
      meta,
    );
    const jobs = await gh(
      "/actions/runs/" +
        r.id +
        "/attempts/" +
        r.run_attempt +
        "/jobs?per_page=100",
    );
    if (jobs.total_count > 100) throw Error("Job reconciliation truncated");
    for (const j of jobs.jobs) {
      add(
        "job",
        j.id,
        j.conclusion || j.status,
        j.completed_at || j.started_at,
        {
          ...meta,
          jobId: j.id,
          identityHash: hash(j.name),
          durationMs: j.completed_at
            ? Math.max(0, Date.parse(j.completed_at) - Date.parse(j.started_at))
            : 0,
        },
      );
      for (const s of j.steps || [])
        if (s.completed_at)
          add(
            "step",
            j.id + ":" + s.number,
            s.conclusion || s.status,
            s.completed_at,
            {
              ...meta,
              jobId: j.id,
              identityHash: hash(s.name),
              durationMs: Math.max(
                0,
                Date.parse(s.completed_at) - Date.parse(s.started_at),
              ),
            },
          );
    }
    // GITHUB_TOKEN-created releases/merges do not necessarily trigger sibling
    // workflows. Reconcile their source records from the completed run instead.
    const associated = await gh(
      "/commits/" + r.head_sha + "/pulls?per_page=100",
    );
    if (associated.length === 100)
      throw Error("Associated PR listing truncated");
    for (const p of associated.filter((p) => p.merged_at)) await pr(p.number);
    const releases = await gh("/releases?per_page=100");
    for (const release of releases.filter(
      (x) => !x.draft && x.target_commitish === r.head_sha,
    ))
      add("release", release.id, "created", release.published_at, {
        version: release.tag_name,
        url: release.html_url,
        revision: r.head_sha,
      });
    const artifacts = await gh(
      "/actions/runs/" + r.id + "/artifacts?per_page=100",
    );
    if (artifacts.total_count > 100) throw Error("Artifact listing truncated");
    for (const a of artifacts.artifacts.filter(
      (a) => a.name === "sanitized-test-cases" && !a.expired,
    )) {
      if (a.size_in_bytes > 2 * 1024 * 1024)
        throw Error("Oversized case artifact");
      for (const c of await parseCases(
        await gh("/actions/artifacts/" + a.id + "/zip", true),
      ))
        add(
          "test",
          r.id + ":" + c.originatingAttempt + ":" + c.id,
          c.status,
          c.finishedAt,
          {
            ...meta,
            originatingAttempt: c.originatingAttempt,
            caseId: c.id,
            durationMs: c.durationMs,
          },
        );
    }
  };
  if (payload.issue) await issue(payload.issue.number);
  if (payload.pull_request) await pr(payload.pull_request.number);
  if (payload.review)
    add(
      "review",
      payload.review.id,
      payload.review.state,
      payload.review.submitted_at,
      { number: payload.pull_request.number, url: payload.review.html_url },
    );
  if (payload.workflow_run) await run(payload.workflow_run.id);
  if (payload.release && !payload.release.draft)
    add(
      "release",
      payload.release.id,
      "created",
      payload.release.published_at,
      {
        version: payload.release.tag_name,
        url: payload.release.html_url,
        revision: payload.release.target_commitish,
      },
    );
  if (env.GITHUB_EVENT_NAME === "workflow_dispatch") {
    for (const n of String(payload.inputs?.issues || "")
      .split(",")
      .filter(Boolean)) {
      if (!/^\d+$/.test(n)) throw Error("Invalid issue number");
      await issue(n);
    }
    for (const n of String(payload.inputs?.prs || "")
      .split(",")
      .filter(Boolean)) {
      if (!/^\d+$/.test(n)) throw Error("Invalid PR number");
      await pr(n);
    }
    if (payload.inputs?.run) {
      if (!/^\d+$/.test(payload.inputs.run)) throw Error("Invalid run");
      await run(payload.inputs.run);
    }
  }
  phase = "ingestion";
  const telemetry = await startTelemetry(
    {
      ...env,
      SALESDRONE_OTEL_ENABLED: "true",
      OTEL_EXPORTER_OTLP_ENDPOINT: tenant.origin + "/api/v2/otlp",
      OTEL_EXPORTER_OTLP_HEADERS:
        "Authorization=" +
        encodeURIComponent("Api-Token " + env.DYNATRACE_API_TOKEN),
    },
    { serviceName: "salesdrone-mcp-sdlc" },
  );
  let accepted = 0;
  try {
    await telemetry.tool("sdlc.observe", async () => {
      for (const event of events) {
        await telemetry.http("/sdlc/bizevents", async () => {
          for (let attempt = 0; attempt < 3; attempt++) {
            const r = await fetch(tenant.origin + "/api/v2/bizevents/ingest", {
              method: "POST",
              headers: {
                Authorization: "Api-Token " + env.DYNATRACE_API_TOKEN,
                "Content-Type": "application/cloudevent+json",
              },
              body: JSON.stringify(event),
              signal: AbortSignal.timeout(10000),
            });
            if (r.ok) {
              accepted++;
              return;
            }
            if (r.status !== 429 && r.status < 500)
              throw Error("Dynatrace event rejected: " + r.status);
            await new Promise((resolve) =>
              setTimeout(resolve, 500 * (attempt + 1)),
            );
          }
          throw Error("Dynatrace retry limit");
        });
      }
    });
  } finally {
    await telemetry.shutdown();
    await writeFile(
      "observation.json",
      JSON.stringify({
        source: repo,
        event: env.GITHUB_EVENT_NAME,
        events: events.length,
        accepted,
        tenantSearchVerified: false,
        reportingRun: env.GITHUB_RUN_ID,
      }),
    );
  }
  console.log(
    "Source-confirmed lifecycle events accepted: " +
      accepted +
      "; tenant search requires separate verification.",
  );
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  main().catch(async (error) => {
    const code = safeFailureCode(error);
    let receipt = {};
    try {
      const prior = JSON.parse(await readFile("observation.json", "utf8"));
      if (prior.reportingRun === process.env.GITHUB_RUN_ID) receipt = prior;
    } catch {}
    await writeFile(
      "observation.json",
      JSON.stringify({
        ...receipt,
        source: "theharithsa/salesdrone-mcp",
        event: [
          "workflow_run",
          "pull_request_target",
          "issues",
          "pull_request_review",
          "release",
          "workflow_dispatch",
        ].includes(process.env.GITHUB_EVENT_NAME)
          ? process.env.GITHUB_EVENT_NAME
          : "unknown",
        reportingRun: /^\d+$/.test(process.env.GITHUB_RUN_ID || "")
          ? process.env.GITHUB_RUN_ID
          : null,
        status: "failed",
        phase,
        errorCode: code,
        tenantSearchVerified: false,
      }),
    ).catch(() => {});
    console.error(
      "Lifecycle reporting failed: " +
        code +
        " (" +
        phase +
        "). Inspect the sanitized receipt.",
    );
    process.exitCode = 1;
  });
