import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
const git = (args) =>
  execFileSync("git", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }).trim();
if (process.env.GITHUB_EVENT_NAME === "pull_request") {
  const base = "origin/" + process.env.GITHUB_BASE_REF;
  const previous = (() => {
    try {
      return JSON.parse(git(["show", base + ":package.json"]));
    } catch {
      return null;
    }
  })();
  const current = JSON.parse(await readFile("package.json"));
  if (
    previous?.version === current.version &&
    git([
      "diff",
      "--name-only",
      base,
      "HEAD",
      "--",
      "src",
      "README.md",
      "LICENSE",
      "package.json",
    ])
  )
    throw Error(
      "Packaged changes require a version bump. Operational/docs-only changes can retain the existing npm version.",
    );
}
console.log("Release policy checked.");
