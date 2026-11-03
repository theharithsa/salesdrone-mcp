import { readFile, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
const { version } = JSON.parse(await readFile("package.json", "utf8"));
const commit = execFileSync("git", ["rev-parse", "HEAD"], {
  encoding: "utf8",
}).trim();
if (!/^[a-f0-9]{40}$/.test(commit)) throw Error("Invalid build revision");
await writeFile(
  "src/version.js",
  `export const VERSION = ${JSON.stringify(version)};\nexport const BUILD_COMMIT = ${JSON.stringify(commit)};\n`,
);
console.log("Built package identity " + version + " @ " + commit.slice(0, 7));
