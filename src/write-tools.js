import * as z from "zod/v4";
import contract from "./write-contract.json" with { type: "json" };
const pathId = z
  .string()
  .regex(/^[A-Za-z0-9_.:-]{1,150}$/)
  .refine((value) => value !== "." && value !== "..");
const MAX_FILE_BYTES = 8 * 1024 * 1024;
export const WRITE_OPERATIONS = contract.operations;
export const WRITE_TOOL_DEFINITIONS = WRITE_OPERATIONS.map((operation) => {
  const shape = {};
  for (const parameter of operation.parameters) {
    if (parameter.in === "path") shape[parameter.name] = pathId;
    else if (parameter.name === "Idempotency-Key")
      shape.idempotencyKey = z
        .uuid()
        .describe(
          "Caller-provided UUID. Reuse the same key and identical body after an uncertain outcome; never generate a fresh key for a retry.",
        );
    else throw Error("Unsupported contract parameter");
  }
  const binary = Boolean(operation.body["application/octet-stream"]);
  if (binary)
    shape.contentBase64 = z
      .string()
      .min(4)
      .max(Math.ceil(MAX_FILE_BYTES / 3) * 4)
      .regex(/^[A-Za-z0-9+/]*={0,2}$/)
      .refine((value) => {
        const bytes = Buffer.from(value, "base64");
        return (
          bytes.length <= MAX_FILE_BYTES && bytes.toString("base64") === value
        );
      })
      .describe(
        "Canonical base64 file bytes, at most 8 MiB decoded. No local file path or remote URL is accepted.",
      );
  else shape.body = z.fromJSONSchema(operation.body["application/json"].schema);
  const readOnly = ["preview_lead_batch", "export_leads"].includes(
    operation.name,
  );
  return {
    ...operation,
    inputSchema: z.strictObject(shape),
    annotations: {
      readOnlyHint: readOnly,
      destructiveHint: !readOnly,
      idempotentHint: readOnly || Boolean(shape.idempotencyKey) || binary,
      openWorldHint: true,
    },
    request(args) {
      const path = operation.path.replace(/\{(\w+)\}/g, (_, key) => args[key]);
      return {
        method: operation.method,
        path,
        body: binary ? Buffer.from(args.contentBase64, "base64") : args.body,
        idempotencyKey: args.idempotencyKey,
        binary,
      };
    },
  };
});
