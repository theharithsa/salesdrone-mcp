import { VERSION } from "./version.js";
export const DEFAULT_API_URL =
  "https://sales-drone-avinya.firebaseapp.com/api/v1";
export const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
import contract from "./write-contract.json" with { type: "json" };
const routePattern = (path) =>
  new RegExp("^" + path.replace(/\{\w+\}/g, "[A-Za-z0-9_.:-]{1,150}") + "$");
const allowedPaths = contract.readPaths.map(routePattern);
const writePaths = contract.operations.map((operation) => ({
  ...operation,
  pattern: routePattern(operation.path),
}));
export const MAX_REQUEST_BYTES = 10 * 1024 * 1024;
export class SalesDroneReadError extends Error {
  constructor(code, status) {
    super(code);
    this.code = code;
    this.status = status;
  }
}
export function createApiClient({
  token,
  apiUrl = DEFAULT_API_URL,
  fetchImpl = fetch,
  timeoutMs = 15000,
  telemetry,
} = {}) {
  if (
    typeof token !== "string" ||
    !/^sd_pat_[a-f0-9]{32}_[A-Za-z0-9_-]{43}$/.test(token)
  )
    throw new SalesDroneReadError("TOKEN_REQUIRED");
  const base = new URL(apiUrl);
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(base.hostname);
  if (
    base.username ||
    base.password ||
    base.search ||
    base.hash ||
    base.pathname.replace(/\/$/, "") !== "/api/v1" ||
    !(base.protocol === "https:" || (base.protocol === "http:" && local))
  )
    throw new SalesDroneReadError("INVALID_API_URL");
  let active = 0;
  const request = async (
    { path, query = {}, method = "GET", body, idempotencyKey, binary = false },
    signal,
  ) => {
    const operation =
      method === "GET"
        ? null
        : writePaths.find((o) => o.method === method && o.pattern.test(path));
    if (
      !(method === "GET"
        ? allowedPaths.some((pattern) => pattern.test(path))
        : operation) ||
      path.split("/").some((p) => p === "." || p === "..")
    )
      throw new SalesDroneReadError(
        method === "GET" ? "READ_PATH_DENIED" : "WRITE_PATH_DENIED",
      );
    let payload;
    if (method !== "GET") {
      const requiresKey = operation.parameters.some(
        (p) => p.name === "Idempotency-Key",
      );
      if (
        (requiresKey &&
          !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
            idempotencyKey || "",
          )) ||
        (!requiresKey && idempotencyKey !== undefined)
      )
        throw new SalesDroneReadError("INVALID_REQUEST");
      if (binary !== Boolean(operation.body["application/octet-stream"]))
        throw new SalesDroneReadError("INVALID_REQUEST");
      payload = binary ? body : JSON.stringify(body);
      if (
        (!binary && typeof payload !== "string") ||
        (binary && (!Buffer.isBuffer(payload) || payload.length > 8388608))
      )
        throw new SalesDroneReadError("INVALID_REQUEST");
      if (Buffer.byteLength(payload) > MAX_REQUEST_BYTES)
        throw new SalesDroneReadError("REQUEST_LIMIT");
    }
    if (active >= 4) throw new SalesDroneReadError("BUSY");
    active++;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const url = new URL(
        base.origin + base.pathname.replace(/\/$/, "") + path,
      );
      for (const [key, value] of Object.entries(query))
        if (value !== undefined)
          url.searchParams.set(
            key,
            typeof value === "object" ? JSON.stringify(value) : String(value),
          );
      const response = await fetchImpl(url, {
        method,
        ...(payload !== undefined ? { body: payload } : {}),
        redirect: "error",
        cache: "no-store",
        headers: {
          Authorization: "Bearer " + token,
          Accept: "application/json",
          ...(payload !== undefined
            ? {
                "Content-Type": binary
                  ? "application/octet-stream"
                  : "application/json",
              }
            : {}),
          ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
          "User-Agent": "salesdrone-mcp/" + VERSION,
          ...(telemetry ? telemetry.traceHeaders() : {}),
        },
        signal: signal
          ? AbortSignal.any([signal, controller.signal])
          : controller.signal,
      });
      if (!response.ok) {
        await response.body?.cancel();
        throw new SalesDroneReadError(
          response.status === 401
            ? "UNAUTHENTICATED"
            : response.status === 403
              ? "FORBIDDEN"
              : response.status === 429
                ? "RATE_LIMITED"
                : response.status === 404
                  ? "NOT_FOUND"
                  : response.status === 409
                    ? "CONFLICT"
                    : [400, 422].includes(response.status)
                      ? "VALIDATION_FAILED"
                      : "API_ERROR",
          response.status,
        );
      }
      if (response.status === 204) return { ok: true };
      if (
        !/^application\/json(?:;|$)/i.test(
          response.headers.get("content-type") || "",
        )
      ) {
        await response.body?.cancel();
        throw new SalesDroneReadError("INVALID_RESPONSE");
      }
      const reader = response.body?.getReader();
      if (!reader) throw new SalesDroneReadError("INVALID_RESPONSE");
      const chunks = [];
      let bytes = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > MAX_RESPONSE_BYTES) {
          await reader.cancel();
          throw new SalesDroneReadError("RESPONSE_LIMIT");
        }
        chunks.push(value);
      }
      return JSON.parse(Buffer.concat(chunks).toString("utf8"));
    } catch (error) {
      if (error instanceof SalesDroneReadError) throw error;
      throw new SalesDroneReadError(
        controller.signal.aborted || signal?.aborted
          ? "CANCELLED_OR_TIMEOUT"
          : "INVALID_RESPONSE",
      );
    } finally {
      clearTimeout(timeout);
      active--;
    }
  };
  const observedRequest = (options, signal) =>
    telemetry
      ? telemetry.http(
          options.path,
          () => request(options, signal),
          options.method || "GET",
        )
      : request(options, signal);
  return {
    get: (path, query, signal) => observedRequest({ path, query }, signal),
    request: observedRequest,
  };
}
