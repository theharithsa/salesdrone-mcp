import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
const p = JSON.parse(await readFile("package.json"));
assert.equal(
  p.repository.url,
  "git+https://github.com/theharithsa/salesdrone-mcp.git",
);
assert.match(p.version, /^\d+\.\d+\.\d+$/);
for (const directory of ["src", "scripts", "test"])
  for (const f of await readdir(directory)) {
    if (!/\.(js|mjs)$/.test(f)) continue;
    const r = spawnSync(process.execPath, ["--check", `${directory}/${f}`], {
      encoding: "utf8",
    });
    assert.equal(r.status, 0, r.stderr);
  }
console.log("Package metadata and JavaScript syntax verified.");
