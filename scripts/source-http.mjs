// Metadata-only source reads. Never expose response bodies, URLs, or raw errors.
export class SourceReadError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}
export async function readSource(
  url,
  options = {},
  {
    binary = false,
    graphql = false,
    retry404 = false,
    fetchImpl = fetch,
    sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
  } = {},
) {
  for (let attempt = 0; attempt < 3; attempt++) {
    let retry = false;
    try {
      const response = await fetchImpl(url, {
        ...options,
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) {
        await response.body?.cancel();
        if (
          response.status === 429 ||
          response.status >= 500 ||
          (retry404 && response.status === 404)
        ) {
          retry = true;
          if (attempt === 2)
            throw new SourceReadError("SOURCE_HTTP_" + response.status);
        } else throw new SourceReadError("SOURCE_HTTP_" + response.status);
      } else {
        const reader = response.body?.getReader();
        if (!reader) throw new SourceReadError("SOURCE_RESPONSE_INVALID");
        let size = 0;
        const chunks = [];
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.length;
          if (size > 2 * 1024 * 1024) {
            await reader.cancel();
            throw new SourceReadError("SOURCE_BODY_LIMIT");
          }
          chunks.push(value);
        }
        const bytes = Buffer.concat(chunks);
        if (binary) return bytes;
        let data;
        try {
          data = JSON.parse(bytes.toString("utf8"));
        } catch {
          throw new SourceReadError("SOURCE_JSON_INVALID");
        }
        if (graphql && data.errors) {
          const transient = data.errors.every((e) =>
            [
              "INTERNAL",
              "SERVICE_UNAVAILABLE",
              "RATE_LIMITED",
              "NOT_FOUND",
            ].includes(e.type || e.extensions?.code),
          );
          if (!transient || attempt === 2)
            throw new SourceReadError("SOURCE_GRAPHQL");
          retry = true;
        } else return data;
      }
    } catch (error) {
      if (error instanceof SourceReadError) throw error;
      if (["TypeError", "AbortError", "TimeoutError"].includes(error?.name)) {
        retry = true;
        if (attempt === 2) throw new SourceReadError("SOURCE_NETWORK");
      } else throw new SourceReadError("SOURCE_RESPONSE_INVALID");
    }
    if (retry) await sleep(500 * (attempt + 1));
  }
  throw new SourceReadError("SOURCE_RETRY_LIMIT");
}
export function safeFailureCode(error) {
  if (
    /^SOURCE_(HTTP_[1-5][0-9]{2}|RESPONSE_INVALID|JSON_INVALID|BODY_LIMIT|GRAPHQL|NETWORK|RETRY_LIMIT)$/.test(
      error?.code || "",
    )
  )
    return error.code;
  const map = {
    "Invalid source metadata": "SOURCE_METADATA_INVALID",
    "Invalid case record": "CASE_RECORD_INVALID",
    "Invalid case archive": "CASE_ARCHIVE_INVALID",
    "Oversized case archive": "CASE_ARCHIVE_LIMIT",
    "Oversized case data": "CASE_DATA_LIMIT",
    "Too many cases": "CASE_COUNT_LIMIT",
    "Unexpected repository": "CONFIG_REPOSITORY",
    "Unexpected tenant": "CONFIG_TENANT",
  };
  return map[error?.message] || "OBSERVER_FAILED";
}
