import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import {
  context,
  trace,
  propagation,
  SpanStatusCode,
  SpanKind,
  diag,
} from "@opentelemetry/api";
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-base";
import {
  MeterProvider,
  PeriodicExportingMetricReader,
  AggregationTemporality,
} from "@opentelemetry/sdk-metrics";
import {
  LoggerProvider,
  BatchLogRecordProcessor,
} from "@opentelemetry/sdk-logs";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-proto";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-proto";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-proto";
import { VERSION, BUILD_COMMIT } from "./version.js";
// The package's ESM export is absent in 0.0.2. Its supported CommonJS class works.
// Never import /register: it installs broad auto-instrumentation and stdout logs.
const { McpInstrumentation } = createRequire(import.meta.url)(
  "@theharithsa/opentelemetry-instrumentation-mcp",
);
const codes = new Set([
  "TOKEN_REQUIRED",
  "INVALID_API_URL",
  "READ_PATH_DENIED",
  "WRITE_PATH_DENIED",
  "INVALID_REQUEST",
  "REQUEST_LIMIT",
  "CONFLICT",
  "VALIDATION_FAILED",
  "BUSY",
  "UNAUTHENTICATED",
  "FORBIDDEN",
  "RATE_LIMITED",
  "NOT_FOUND",
  "API_ERROR",
  "INVALID_RESPONSE",
  "RESPONSE_LIMIT",
  "CANCELLED_OR_TIMEOUT",
]);
export const safeError = (error) =>
  codes.has(error?.code) ? error.code : "REQUEST_FAILED";
export function normalizedRoute(path) {
  if (
    path === "/leads/batch" ||
    path === "/leads/batch/preview" ||
    path === "/leads/export" ||
    path === "/imports/preview"
  )
    return path;
  return path
    .replace(
      /\/team\/members\/[^/]+\/activities$/,
      "/team/members/:uid/activities",
    )
    .replace(
      /\/(leads|tasks|imports|activities|notifications)\/[^/]+/,
      "/$1/:id",
    )
    .replace(/\/attachments\/[^/]+/, "/attachments/:attachmentId");
}
function endpoint(value) {
  const u = new URL(value);
  if (
    u.username ||
    u.password ||
    u.hash ||
    u.search ||
    !(
      u.protocol === "https:" ||
      (u.protocol === "http:" &&
        ["localhost", "127.0.0.1", "[::1]"].includes(u.hostname))
    )
  )
    throw Error("Invalid OTLP endpoint");
  return u.href;
}
export function telemetryConfiguration(env) {
  if (env.SALESDRONE_OTEL_ENABLED !== "true") return null;
  const base = env.OTEL_EXPORTER_OTLP_ENDPOINT?.replace(/\/$/, "");
  if (!base) throw Error("Missing OTLP base");
  const headers = {};
  for (const pair of (env.OTEL_EXPORTER_OTLP_HEADERS || "")
    .split(",")
    .filter(Boolean)) {
    const at = pair.indexOf("=");
    if (at < 1) throw Error("Invalid OTLP headers");
    const key = pair.slice(0, at).trim(),
      value = decodeURIComponent(pair.slice(at + 1).trim());
    if (!/^[A-Za-z0-9-]+$/.test(key) || /[\r\n]/.test(value) || !value)
      throw Error("Invalid OTLP header");
    headers[key] = value;
  }
  return {
    headers,
    traces: endpoint(
      env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT || base + "/v1/traces",
    ),
    logs: endpoint(env.OTEL_EXPORTER_OTLP_LOGS_ENDPOINT || base + "/v1/logs"),
    metrics: endpoint(
      env.OTEL_EXPORTER_OTLP_METRICS_ENDPOINT || base + "/v1/metrics",
    ),
  };
}
const noop = {
  enabled: false,
  tool: (_name, fn) => fn(),
  http: (_path, fn) => fn(),
  traceHeaders: () => ({}),
  flush: async () => {},
  shutdown: async () => {},
};
// Explicit SDK-v2 callback bridge. The inherited instrumentation tracer/provider
// are reused; legacy module patching stays disabled, avoiding double spans.
class McpV2Instrumentation extends McpInstrumentation {
  constructor(provider) {
    super();
    this.disable();
    this.setTracerProvider(provider);
  }
  toolTracer() {
    return this.tracer;
  }
}
const quietly = (fn) => {
  try {
    return fn();
  } catch {
    return undefined;
  }
};
export async function startTelemetry(env = process.env, options = {}) {
  try {
    return await initializeTelemetry(env, options);
  } catch {
    process.stderr.write(
      "SalesDrone telemetry disabled: initialization failed.\n",
    );
    return noop;
  }
}
async function initializeTelemetry(
  env,
  { serviceName = "salesdrone-mcp" } = {},
) {
  let config;
  try {
    config = telemetryConfiguration(env);
  } catch {
    process.stderr.write(
      "SalesDrone telemetry disabled: invalid OTLP configuration.\n",
    );
    return noop;
  }
  if (!config) return noop;
  // SDK diagnostics are not exported; neither credential values nor raw errors go to stdout.
  diag.disable();
  const resource = resourceFromAttributes({
    "service.name": serviceName,
    "service.namespace": "avinyatech",
    "service.version": VERSION,
    "service.instance.id": randomUUID(),
    "build.commit": BUILD_COMMIT,
    "deployment.environment.name": serviceName.endsWith("sdlc")
      ? "ci"
      : ["local", "test", "production"].includes(env.SALESDRONE_ENVIRONMENT)
        ? env.SALESDRONE_ENVIRONMENT
        : "local",
    "mcp.instrumentation.package.version": "0.0.2",
  });
  const provider = new NodeTracerProvider({
    resource,
    spanProcessors: [
      new BatchSpanProcessor(
        new OTLPTraceExporter({
          url: config.traces,
          headers: config.headers,
          timeoutMillis: 1000,
        }),
        {
          maxQueueSize: 512,
          maxExportBatchSize: 100,
          scheduledDelayMillis: 1000,
          exportTimeoutMillis: 1500,
        },
      ),
    ],
  });
  provider.register();
  const instrumentation = new McpV2Instrumentation(provider),
    toolTracer = instrumentation.toolTracer(),
    httpTracer = provider.getTracer("salesdrone-mcp-http");
  const meterProvider = new MeterProvider({
    resource,
    readers: [
      new PeriodicExportingMetricReader({
        exporter: new OTLPMetricExporter({
          url: config.metrics,
          headers: config.headers,
          timeoutMillis: 1000,
          temporalityPreference: AggregationTemporality.DELTA,
        }),
        exportIntervalMillis: 10000,
        exportTimeoutMillis: 1500,
      }),
    ],
  });
  const loggerProvider = new LoggerProvider({
    resource,
    processors: [
      new BatchLogRecordProcessor({
        exporter: new OTLPLogExporter({
          url: config.logs,
          headers: config.headers,
          timeoutMillis: 1000,
        }),
        maxQueueSize: 256,
        maxExportBatchSize: 100,
        scheduledDelayMillis: 1000,
        exportTimeoutMillis: 1500,
      }),
    ],
  });
  const meter = meterProvider.getMeter("salesdrone-mcp"),
    logger = loggerProvider.getLogger("salesdrone-mcp");
  const calls = meter.createCounter("salesdrone.mcp.tool.calls"),
    duration = meter.createHistogram("salesdrone.mcp.tool.duration", {
      unit: "s",
    }),
    active = meter.createUpDownCounter("salesdrone.mcp.tool.active");
  const requests = meter.createCounter("salesdrone.mcp.http.requests"),
    httpDuration = meter.createHistogram("salesdrone.mcp.http.duration", {
      unit: "s",
    });
  meter
    .createObservableGauge("salesdrone.mcp.process.memory.rss", { unit: "By" })
    .addCallback((result) => result.observe(process.memoryUsage().rss));
  async function observed(tracer, name, attributes, fn, kind) {
    let span;
    try {
      span = tracer.startSpan(name, { kind, attributes });
    } catch {
      return fn();
    }
    const started = performance.now();
    let code = "none",
      outcome = "success";
    if (kind === SpanKind.SERVER) quietly(() => active.add(1));
    try {
      return await context.with(trace.setSpan(context.active(), span), fn);
    } catch (error) {
      code = safeError(error);
      outcome = "failure";
      quietly(() => {
        span.setAttribute("error.type", code);
        span.setStatus({ code: SpanStatusCode.ERROR });
        span.recordException({ name: code, message: code });
      });
      throw error;
    } finally {
      const seconds = (performance.now() - started) / 1000;
      const labels = { ...attributes, outcome, "error.type": code };
      quietly(() => {
        if (kind === SpanKind.SERVER) {
          calls.add(1, labels);
          duration.record(seconds, labels);
          active.add(-1);
        } else {
          requests.add(1, labels);
          httpDuration.record(seconds, labels);
        }
      });
      quietly(() =>
        context.with(trace.setSpan(context.active(), span), () =>
          logger.emit({
            body:
              kind === SpanKind.SERVER
                ? "mcp.tool.completed"
                : "mcp.http.completed",
            severityNumber: outcome === "success" ? 9 : 17,
            attributes: { ...labels, "duration.ms": seconds * 1000 },
            context: trace.setSpan(context.active(), span),
          }),
        ),
      );
      quietly(() => span.end());
    }
  }
  let shutdown;
  const bounded = async (fn) => {
    let timer;
    try {
      await Promise.race([
        fn(),
        new Promise((resolve) => {
          timer = setTimeout(resolve, 3000);
        }),
      ]);
    } catch {
    } finally {
      clearTimeout(timer);
    }
  };
  return {
    enabled: true,
    tool: (name, fn) =>
      observed(
        toolTracer,
        "mcp.tool:" + name,
        { "mcp.tool.name": name },
        fn,
        SpanKind.SERVER,
      ),
    http: (path, fn, method = "GET") =>
      observed(
        httpTracer,
        "HTTP " + method + " " + normalizedRoute(path),
        { "http.request.method": method, "http.route": normalizedRoute(path) },
        fn,
        SpanKind.CLIENT,
      ),
    traceHeaders: () => {
      const headers = {};
      quietly(() => propagation.inject(context.active(), headers));
      return Object.fromEntries(
        Object.entries(headers).filter(
          ([key]) => key === "traceparent" || key === "tracestate",
        ),
      );
    },
    flush: () =>
      bounded(() =>
        Promise.all([
          provider.forceFlush(),
          meterProvider.forceFlush(),
          loggerProvider.forceFlush(),
        ]),
      ),
    shutdown: () =>
      (shutdown ||= bounded(async () => {
        await Promise.allSettled([
          provider.shutdown(),
          meterProvider.shutdown(),
          loggerProvider.shutdown(),
        ]);
        instrumentation.disable();
      })),
  };
}
