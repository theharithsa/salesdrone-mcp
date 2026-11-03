import { createHash } from "node:crypto";
export function caseRecord(event) {
  if (
    !["test:pass", "test:fail"].includes(event.type) ||
    event.data.details?.type === "suite"
  )
    return null;
  const d = event.data;
  return {
    schemaVersion: 1,
    id: createHash("sha256")
      .update(
        String(d.file || "") + "\0" + d.name + "\0" + d.line + "\0" + d.column,
      )
      .digest("hex"),
    status: d.skip
      ? "skipped"
      : d.todo
        ? "todo"
        : event.type === "test:pass"
          ? "passed"
          : "failed",
    durationMs: Math.max(0, Number(d.details?.duration_ms) || 0),
    finishedAt: new Date().toISOString(),
    originatingAttempt: Number(process.env.GITHUB_RUN_ATTEMPT || 1),
  };
}
export default async function* reporter(source) {
  for await (const event of source) {
    const record = caseRecord(event);
    if (record) yield JSON.stringify(record) + "\n";
  }
}
