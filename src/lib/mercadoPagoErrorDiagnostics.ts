const SENSITIVE_KEY_PATTERN = /authorization|access[_-]?token|refresh[_-]?token|public[_-]?key|secret|password|token|card|cvv|security|email|identification|document|dni|payer/i;
const EMAIL_PATTERN = /[^\s@]+@[^\s@]+\.[^\s@]+/;
const LONG_TOKEN_PATTERN = /\b[A-Za-z0-9_-]{24,}\b/;
const CARD_LIKE_PATTERN = /\b(?:\d[ -]*?){12,19}\b/;
const DOCUMENT_LIKE_PATTERN = /^\d{7,11}$/;

const ALLOWED_DIAGNOSTIC_KEYS = new Set([
  "code",
  "message",
  "error",
  "errors",
  "cause",
  "details",
  "detail",
  "description",
  "reason",
  "type",
  "status",
  "status_code",
  "field",
  "fields",
  "path",
  "paths",
  "property",
  "properties",
  "location",
  "locations",
  "expected",
  "expected_value",
  "expected_values",
  "allowed",
  "allowed_values",
  "received",
  "received_value",
  "value",
  "values",
  "name",
  "index",
]);

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function sanitizePrimitive(value: unknown) {
  if (typeof value !== "string") return value;
  if (EMAIL_PATTERN.test(value)) return "[redacted]";
  if (CARD_LIKE_PATTERN.test(value)) return "[redacted]";
  if (DOCUMENT_LIKE_PATTERN.test(value)) return "[redacted]";
  if (LONG_TOKEN_PATTERN.test(value)) return "[redacted]";
  return value;
}

export function sanitizeMercadoPagoDiagnostic(value: unknown, parentKey = "", depth = 0): unknown {
  if (depth > 8) return "[truncated]";
  if (value === null || value === undefined) return value;
  if (typeof value !== "object") {
    return SENSITIVE_KEY_PATTERN.test(parentKey) ? "[redacted]" : sanitizePrimitive(value);
  }
  if (Array.isArray(value)) {
    return value.slice(0, 20).map((item) => sanitizeMercadoPagoDiagnostic(item, parentKey, depth + 1));
  }
  if (!isPlainRecord(value)) return "[unsupported]";

  const sanitized: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    if (SENSITIVE_KEY_PATTERN.test(key)) {
      sanitized[key] = "[redacted]";
      continue;
    }
    if (!ALLOWED_DIAGNOSTIC_KEYS.has(key)) continue;
    sanitized[key] = sanitizeMercadoPagoDiagnostic(item, key, depth + 1);
  }
  return sanitized;
}

export function buildMercadoPagoErrorDiagnostic(input: {
  status: number;
  requestId?: string | null;
  body: Record<string, unknown>;
}) {
  const errors = Array.isArray(input.body.errors)
    ? sanitizeMercadoPagoDiagnostic(input.body.errors, "errors")
    : undefined;
  const cause = Array.isArray(input.body.cause)
    ? sanitizeMercadoPagoDiagnostic(input.body.cause, "cause")
    : undefined;

  return {
    status: input.status,
    requestId: input.requestId || undefined,
    code: typeof input.body.code === "string" ? input.body.code : undefined,
    message: typeof input.body.message === "string" ? sanitizePrimitive(input.body.message) : undefined,
    error: typeof input.body.error === "string" ? sanitizePrimitive(input.body.error) : undefined,
    errors,
    cause,
  };
}

export function stringifyMercadoPagoErrorDiagnostic(diagnostic: unknown) {
  return JSON.stringify(diagnostic);
}
