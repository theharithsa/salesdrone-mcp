import { readFile, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";
const packagedPaths = ["src", "README.md", "LICENSE", "package.json"];
export function validatePublication(
  data,
  { name, version, revision },
  git = (args) =>
    execFileSync("git", args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim(),
) {
  if (
    data.name !== name ||
    data.version !== version ||
    !/^[a-f0-9]{40}$/.test(data.gitHead) ||
    !data.dist?.integrity
  )
    throw Error("Invalid registry identity");
  if (data.gitHead === revision) return;
  git(["merge-base", "--is-ancestor", data.gitHead, revision]);
  if (
    git(["diff", "--name-only", data.gitHead, revision, "--", ...packagedPaths])
  )
    throw Error(
      "Packaged source changed at an immutable version; bump version in a checked PR.",
    );
}
async function main() {
  const p = JSON.parse(await readFile("package.json"));
  const revision = process.env.GITHUB_SHA;
  const url =
    "https://registry.npmjs.org/" +
    encodeURIComponent(p.name) +
    "/" +
    p.version;
  const receipt = {
    name: p.name,
    version: p.version,
    reportingRevision: revision,
    runId: process.env.GITHUB_RUN_ID,
    status: "checking",
  };
  const save = () =>
    writeFile("publication.json", JSON.stringify(receipt, null, 2));
  const request = () => fetch(url, { signal: AbortSignal.timeout(10000) });
  let data;
  const first = await request();
  if (first.ok) data = await first.json();
  else if (first.status !== 404)
    throw Error("Registry unavailable; publication not attempted.");
  if (!data) {
    let previousVersion;
    const event = JSON.parse(await readFile(process.env.GITHUB_EVENT_PATH));
    if (event.before && /^[a-f0-9]{40}$/.test(event.before))
      try {
        previousVersion = JSON.parse(
          execFileSync("git", ["show", event.before + ":package.json"], {
            encoding: "utf8",
            stdio: ["ignore", "pipe", "ignore"],
          }),
        ).version;
      } catch {}
    // Same-version operational commits and manual reruns reconcile only; a 404
    // during npm processing must never cause another upload of that candidate.
    const upload =
      process.env.GITHUB_EVENT_NAME === "push" &&
      Number(process.env.GITHUB_RUN_ATTEMPT || 1) === 1 &&
      previousVersion !== p.version;
    if (upload) {
      execFileSync("npm", ["publish", "--access", "public", "--provenance"], {
        stdio: "inherit",
      });
      receipt.status = "submitted-awaiting-registry";
      receipt.submittedRevision = revision;
    } else receipt.status = "reconciling-submitted-version";
    await save();
    for (let i = 0; i < 54; i++) {
      const response = await request();
      if (response.ok) {
        data = await response.json();
        break;
      }
      if (response.status !== 404)
        throw Error("Registry verification unavailable.");
      await new Promise((r) => setTimeout(r, 5000));
    }
    if (!data) {
      receipt.status = "pending-registry-visibility";
      await save();
      throw Error(
        "npm processing is still pending; reconcile later without republishing.",
      );
    }
  }
  validatePublication(data, { name: p.name, version: p.version, revision });
  Object.assign(receipt, {
    status: "verified",
    publicationRevision: data.gitHead,
    integrity: data.dist.integrity,
    tarball: data.dist.tarball,
    attestations: data.dist.attestations?.url,
  });
  await save();
  const tag = "v" + p.version;
  try {
    const release = JSON.parse(
      execFileSync(
        "gh",
        ["api", `repos/${process.env.GITHUB_REPOSITORY}/releases/tags/${tag}`],
        { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
      ),
    );
    if (release.target_commitish !== data.gitHead)
      throw Error("Release exists for another revision.");
  } catch (error) {
    if (error.status !== 1) throw error;
    execFileSync(
      "gh",
      [
        "release",
        "create",
        tag,
        "--target",
        data.gitHead,
        "--title",
        tag,
        "--notes-file",
        "docs/release-notes.md",
        "publication.json",
      ],
      { stdio: "inherit" },
    );
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  await main();
