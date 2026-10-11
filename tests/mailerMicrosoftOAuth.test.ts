import assert from "node:assert/strict";
import test from "node:test";
import { getMicrosoftSmtpAccessToken } from "@/lib/mailer";

const config = {
  authType: "microsoft_oauth2" as const,
  host: "smtp.office365.com",
  port: 587,
  user: "buyer@example.test",
  from: "store@example.test",
  clientId: "client-id-test",
  clientSecret: "client-secret-test",
  refreshToken: "refresh-token-old-test",
  tenantId: "tenant-test",
  source: "admin" as const,
};

test("Microsoft refresh uses the stored refresh token and persists a rotated token", async () => {
  let persisted: [string, string] | null = null;
  const token = await getMicrosoftSmtpAccessToken(config, {
    request: async (_url, init) => {
      const body = String(init?.body);
      assert.match(body, /refresh_token=refresh-token-old-test/);
      assert.match(body, /SMTP.Send/);
      return Response.json({ access_token: "access-token-test", refresh_token: "refresh-token-new-test" });
    },
    persistRefreshToken: async (oldToken, newToken) => {
      persisted = [oldToken, newToken];
      return true;
    },
  });

  assert.equal(token, "access-token-test");
  assert.deepEqual(persisted, ["refresh-token-old-test", "refresh-token-new-test"]);
});

test("revoked Microsoft refresh token fails without exposing the response body", async () => {
  await assert.rejects(
    getMicrosoftSmtpAccessToken(config, {
      request: async () => Response.json(
        { error: "invalid_grant", error_description: "refresh-token-old-test was revoked" },
        { status: 400 },
      ),
      persistRefreshToken: async () => true,
    }),
    (error: Error) => {
      assert.match(error.message, /status=400 code=invalid_grant/);
      assert.doesNotMatch(error.message, /refresh-token-old-test|revoked/);
      return true;
    },
  );
});

test("concurrent sends in one process share a Microsoft token refresh", async () => {
  const concurrentConfig = { ...config, refreshToken: "refresh-token-concurrent-test" };
  let requests = 0;
  let persists = 0;
  const dependencies = {
    request: async () => {
      requests += 1;
      await new Promise((resolve) => setTimeout(resolve, 10));
      return Response.json({ access_token: "access-token-concurrent-test", refresh_token: "refresh-token-rotated-test" });
    },
    persistRefreshToken: async () => {
      persists += 1;
      return true;
    },
  };

  const tokens = await Promise.all([
    getMicrosoftSmtpAccessToken(concurrentConfig, dependencies),
    getMicrosoftSmtpAccessToken(concurrentConfig, dependencies),
  ]);

  assert.deepEqual(tokens, ["access-token-concurrent-test", "access-token-concurrent-test"]);
  assert.equal(requests, 1);
  assert.equal(persists, 1);
});
