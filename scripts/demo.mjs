// A real local stdio round-trip over isolated synthetic API fixtures. No production token.
import { createServer } from "node:http";
import { once } from "node:events";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { resolve } from "node:path";
const fixture = {
  items: [
    {
      id: "demo_lead_1",
      name: "Asha Example",
      company: "Synthetic Solar Studio",
      stage: "Qualified",
      assignedToUid: "demo_member_1",
    },
    {
      id: "demo_lead_2",
      name: "Rohan Example",
      company: "Demo Learning Lab",
      stage: "New",
      assignedToUid: null,
    },
  ],
  nextCursor: null,
};
const api = createServer((req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(fixture));
});
api.listen(0, "127.0.0.1");
await once(api, "listening");
const transport = new StdioClientTransport({
  command: process.execPath,
  args: [resolve("src/cli.js")],
  env: {
    SALESDRONE_API_TOKEN: "sd_pat_" + "a".repeat(32) + "_" + "b".repeat(43),
    SALESDRONE_API_URL: `http://127.0.0.1:${api.address().port}/api/v1`,
  },
  stderr: "pipe",
});
const client = new Client({ name: "synthetic-docs-demo", version: "1.0.0" });
await client.connect(transport);
const tools = await client.listTools();
const result = await client.callTool({
  name: "salesdrone_list_leads",
  arguments: { limit: 2 },
});
await client.close();
api.closeAllConnections();
api.close();
await mkdir(".demo", { recursive: true });
await writeFile(
  ".demo/data.json",
  JSON.stringify(
    {
      tools: tools.tools.map((t) => ({
        name: t.name,
        description: t.description,
      })),
      result: result.structuredContent,
    },
    null,
    2,
  ),
);
const html = await readFile("docs/demo.html");
const server = createServer(async (req, res) => {
  if (req.url === "/data.json") {
    res.setHeader("Content-Type", "application/json");
    res.end(await readFile(".demo/data.json"));
  } else {
    res.setHeader("Content-Type", "text/html");
    res.end(html);
  }
});
server.listen(5181, "127.0.0.1");
console.log("Synthetic protocol demonstration: http://127.0.0.1:5181");
