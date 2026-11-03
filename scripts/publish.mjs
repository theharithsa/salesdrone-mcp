import { readFile, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
const p = JSON.parse(await readFile("package.json"));
const url =
  "https://registry.npmjs.org/" + encodeURIComponent(p.name) + "/" + p.version;
const existing = await fetch(url, { signal: AbortSignal.timeout(10000) });
if (existing.ok) {
  const data = await existing.json();
  if (data.gitHead !== process.env.GITHUB_SHA)
    throw Error(
      "Version already published from another revision; bump version in a checked PR.",
    );
  console.log("Exact revision already published.");
} else {
  if (existing.status !== 404)
    throw Error("Registry unavailable; publication not attempted.");
  execFileSync("npm", ["publish", "--access", "public", "--provenance"], {
    stdio: "inherit",
  });
}
let data;
for (let i = 0; i < 6; i++) {
  const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (response.ok) {
    data = await response.json();
    break;
  }
  await new Promise((r) => setTimeout(r, 2000));
}
if (!data || data.gitHead !== process.env.GITHUB_SHA)
  throw Error("Published revision verification failed.");
await writeFile(
  "publication.json",
  JSON.stringify(
    {
      name: p.name,
      version: p.version,
      commit: data.gitHead,
      integrity: data.dist.integrity,
      tarball: data.dist.tarball,
      runId: process.env.GITHUB_RUN_ID,
    },
    null,
    2,
  ),
);
const tag = "v" + p.version;
try {
  const release = JSON.parse(
    execFileSync(
      "gh",
      ["api", `repos/${process.env.GITHUB_REPOSITORY}/releases/tags/${tag}`],
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
    ),
  );
  if (release.target_commitish !== process.env.GITHUB_SHA)
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
      process.env.GITHUB_SHA,
      "--title",
      tag,
      "--notes-file",
      "docs/release-notes.md",
      "publication.json",
    ],
    { stdio: "inherit" },
  );
}
