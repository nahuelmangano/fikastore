import assert from "node:assert/strict";
import test from "node:test";
import {
  buildMercadoPagoErrorDiagnostic,
  sanitizeMercadoPagoDiagnostic,
  stringifyMercadoPagoErrorDiagnostic,
} from "../src/lib/mercadoPagoErrorDiagnostics";

test("sanitizes sensitive values recursively while preserving diagnostic details", () => {
  const sanitized = sanitizeMercadoPagoDiagnostic({
    code: "property_value",
    message: "Invalid value for property",
    errors: [
      {
        code: "property_value",
        message: "Invalid value for property",
        details: [
          {
            field: "payer.email",
            property: "payer.email",
            value: "buyer@example.com",
            expected: ["valid email domain"],
            token: "CARD_TOKEN_SHOULD_NOT_BE_LOGGED_123456789",
            nested: { ignored: "not allowlisted" },
          },
          {
            field: "payer.identification.number",
            value: "12345678",
          },
        ],
      },
    ],
    authorization: "Bearer APP_USR-secret",
  }) as {
    errors: Array<{
      details: Array<{
        field: string;
        value: string;
        token?: string;
        nested?: unknown;
      }>;
    }>;
    authorization: string;
  };

  assert.equal(sanitized.errors[0].details[0].field, "payer.email");
  assert.deepEqual((sanitized.errors[0].details[0] as { expected?: string[] }).expected, ["valid email domain"]);
  assert.equal(sanitized.errors[0].details[0].value, "[redacted]");
  assert.equal(sanitized.errors[0].details[0].token, "[redacted]");
  assert.equal(sanitized.errors[0].details[0].nested, undefined);
  assert.equal(sanitized.errors[0].details[1].value, "[redacted]");
  assert.equal(sanitized.authorization, "[redacted]");
});

test("builds a safe HTTP 400 property_value diagnostic with full errors details", () => {
  const diagnostic = buildMercadoPagoErrorDiagnostic({
    status: 400,
    requestId: "ef5b6fb5-c96d-4b68-8834-82e7a3aa2e61",
    body: {
      code: "property_value",
      message: "Invalid value for property",
      errors: [
        {
          code: "property_value",
          message: "Invalid value for property",
          details: [
            {
              field: "transactions.payments[0].payment_method.installments",
              path: "$.transactions.payments[0].payment_method.installments",
              value: 99,
              allowed_values: [1, 3, 6],
            },
          ],
        },
      ],
    },
  }) as {
    status: number;
    requestId: string;
    code: string;
    message: string;
    errors: Array<{
      details: Array<{
        field: string;
        path: string;
        value: number;
        allowed_values: number[];
      }>;
    }>;
  };

  assert.equal(diagnostic.status, 400);
  assert.equal(diagnostic.requestId, "ef5b6fb5-c96d-4b68-8834-82e7a3aa2e61");
  assert.equal(diagnostic.code, "property_value");
  assert.equal(diagnostic.errors[0].details[0].field, "transactions.payments[0].payment_method.installments");
  assert.equal(diagnostic.errors[0].details[0].path, "$.transactions.payments[0].payment_method.installments");
  assert.deepEqual(diagnostic.errors[0].details[0].allowed_values, [1, 3, 6]);

  const serialized = stringifyMercadoPagoErrorDiagnostic(diagnostic);
  assert.match(serialized, /transactions\.payments\[0\]\.payment_method\.installments/);
  assert.doesNotMatch(serialized, /\[Object\]|\[Array\]/);
});
