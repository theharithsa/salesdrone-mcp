import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
const files = execFileSync(
  "git",
  ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
  { encoding: "utf8" },
)
  .split("\0")
  .filter(Boolean);
let failed = false;
for (const f of files) {
  let b;
  try {
    b = await readFile(f);
  } catch {
    continue;
  }
  if (b.includes(0)) continue;
  const s = b.toString();
  if (
    /(?:sd_pat_[a-f0-9]{32}_[A-Za-z0-9_-]{43}|npm_[A-Za-z0-9]{30,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----)/.test(
      s,
    )
  ) {
    console.error("Secret-shaped content: " + f);
    failed = true;
  }
}
if (failed) process.exit(1);
console.log("Tracked/candidate text scanned; no credential patterns found.");
