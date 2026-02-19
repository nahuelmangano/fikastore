type CorreoArgentinoToken = {
  token: string;
  expiresAt: number;
};

const QA_BASE = "https://apitest.correoargentino.com.ar/micorreo/v1";
const PROD_BASE = "https://api.correoargentino.com.ar/micorreo/v1";

let cache: CorreoArgentinoToken | null = null;
let pendingLogin: Promise<string> | null = null;

function baseUrl() {
  const override = process.env.CORREO_ARG_BASE_URL;
  if (override) return override.replace(/\/$/, "");
  const env = (process.env.CORREO_ARG_ENV || "qa").toLowerCase();
  return env === "prod" ? PROD_BASE : QA_BASE;
}

function nowMs() {
  return Date.now();
}

function tokenValid(t: CorreoArgentinoToken | null) {
  return t && t.token && t.expiresAt > nowMs() + 60 * 1000;
}

function parseExpires(input: unknown): number {
  if (typeof input === "string") {
    const ms = Date.parse(input);
    if (Number.isFinite(ms)) return ms;
  }
  if (typeof input === "number" && Number.isFinite(input) && input > 0) {
    return input > 1e12 ? input : input * 1000;
  }
  return nowMs() + 60 * 60 * 1000;
}

async function login(): Promise<string> {
  if (tokenValid(cache)) return cache!.token;
  if (pendingLogin) return pendingLogin;

  const user = (process.env.CORREO_ARG_USER || "").trim();
  const pass = (process.env.CORREO_ARG_PASS || "").trim();
  if (!user || !pass) throw new Error("CORREO_ARG_USER/CORREO_ARG_PASS missing");

  const auth = Buffer.from(`${user}:${pass}`).toString("base64");
  const url = `${baseUrl()}/token`;

  pendingLogin = fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      Accept: "application/json",
    },
  })
    .then(async (res) => {
      const data = await res.json().catch(() => ({}));
      const token = data?.token;
      if (!res.ok || !token) {
        throw new Error(`CorreoArgentino login failed: ${res.status} ${JSON.stringify(data)}`);
      }
      cache = { token: String(token), expiresAt: parseExpires(data?.expires) };
      return cache.token;
    })
    .catch((err: any) => {
      const cause = err?.cause ? ` cause=${String(err.cause)}` : "";
      throw new Error(`CorreoArgentino login failed: ${err?.message || err}${cause}`);
    })
    .finally(() => {
      pendingLogin = null;
    });

  return pendingLogin;
}

export async function correoArgentinoRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await login();
  const url = path.startsWith("http") ? path : `${baseUrl()}${path}`;

  const doFetch = async (tk: string) => {
    try {
      const res = await fetch(url, {
        ...init,
        headers: {
          Accept: "application/json",
          ...(init?.headers || {}),
          Authorization: `Bearer ${tk}`,
        },
      });
      const text = await res.text().catch(() => "");
      let data: any = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = {};
      }
      return { res, data, text } as const;
    } catch (err: any) {
      const cause = err?.cause ? ` cause=${String(err.cause)}` : "";
      throw new Error(`CorreoArgentino request failed: ${err?.message || err}${cause}`);
    }
  };

  let { res, data, text } = await doFetch(token);
  if (res.status === 401 || res.status === 403) {
    cache = null;
    const newToken = await login();
    const retry = await doFetch(newToken);
    res = retry.res;
    data = retry.data;
    text = retry.text;
  }

  if (!res.ok) {
    const err = new Error(`CorreoArgentino request failed: ${res.status} ${JSON.stringify(data)}`);
    (err as any).status = res.status;
    (err as any).data = data;
    (err as any).text = text;
    throw err;
  }

  return data as T;
}
