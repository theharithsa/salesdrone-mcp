import { startTelemetry } from "../../src/telemetry.js";
import { createApiClient } from "../../src/api-client.js";
const telemetry = await startTelemetry();
if (!telemetry.enabled) process.exit(2);
const api = createApiClient({
  token: "sd_pat_" + "a".repeat(32) + "_" + "b".repeat(43),
  apiUrl: process.env.TEST_API_URL,
  telemetry,
});
await Promise.all([
  telemetry.tool("salesdrone_get_lead", () =>
    api.get("/leads/private-id", {
      search: "private-customer@example.invalid",
    }),
  ),
  telemetry.tool("salesdrone_get_team", () => api.get("/team")),
]);
await telemetry
  .tool("salesdrone_get_lead", () => api.get("/leads/failure-id"))
  .catch(() => {});
await telemetry.tool("salesdrone_update_lead", () =>
  api.request({
    method: "PATCH",
    path: "/leads/private-id",
    body: { expectedVersion: 1, comments: "PRIVATE_WRITE_SENTINEL" },
  }),
);
await telemetry.tool("salesdrone_upload_attachment", () =>
  api.request({
    method: "PUT",
    path: "/leads/private-id/attachments/private-file/content",
    binary: true,
    body: Buffer.from("PRIVATE_BINARY_SENTINEL"),
  }),
);
await telemetry.flush();
await telemetry.shutdown();
