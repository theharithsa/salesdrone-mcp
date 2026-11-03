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
await telemetry.flush();
await telemetry.shutdown();
