// Update only after reviewing the live Swagger diff. No network access at runtime.
import { readFile, writeFile } from "node:fs/promises";
const source = JSON.parse(await readFile("docs/openapi.json", "utf8"));
const previous = JSON.parse(await readFile("src/write-contract.json", "utf8"));
const names = new Map(previous.operations.map((o) => [o.operationId, o.name]));
function resolve(value) {
  if (Array.isArray(value)) return value.map(resolve);
  if (!value || typeof value !== "object") return value;
  if (value.$ref) {
    if (!value.$ref.startsWith("#/components/schemas/"))
      throw Error("Unsupported reference");
    return resolve(source.components.schemas[value.$ref.split("/").at(-1)]);
  }
  return Object.fromEntries(
    Object.entries(value)
      .filter(([k]) => k !== "$schema")
      .map(([k, v]) => [k, resolve(v)]),
  );
}
const operations = [],
  readPaths = [];
for (const [path, item] of Object.entries(source.paths))
  for (const [method, op] of Object.entries(item)) {
    if (!op["x-personal-access-token-scope"]) continue;
    if (!op.security?.some((s) => "personalAccessToken" in s))
      throw Error("Missing PAT authentication");
    if (method === "get") readPaths.push(path.replace("/api/v1", ""));
    else if (["post", "patch", "put", "delete"].includes(method)) {
      if (!names.has(op.operationId))
        throw Error(
          "New operation requires reviewed tool name: " + op.operationId,
        );
      operations.push({
        name: names.get(op.operationId),
        method: method.toUpperCase(),
        path: path.replace("/api/v1", ""),
        scope: op["x-personal-access-token-scope"],
        description: op.description,
        parameters: op.parameters || [],
        body: resolve(op.requestBody.content),
        operationId: op.operationId,
      });
    }
  }
const result =
  JSON.stringify(
    { apiVersion: source.info.version, operations, readPaths },
    null,
    2,
  ) + "\n";
if (process.argv.includes("--check")) {
  if (result !== (await readFile("src/write-contract.json", "utf8")))
    throw Error("Contract projection is stale");
} else await writeFile("src/write-contract.json", result);
console.log(
  "Swagger projection verified: " + operations.length + " PAT operations",
);
