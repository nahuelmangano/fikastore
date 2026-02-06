type AndreaniToken = {
  token: string;
  expiresAt: number;
};

const QA_BASE = "https://apisqa.andreani.com";
const PROD_BASE = "https://apis.andreani.com";

let cache: AndreaniToken | null = null;
let pendingLogin: Promise<string> | null = null;

function baseUrl() {
  const override = process.env.ANDREANI_BASE_URL;
  if (override) return override.replace(/\/$/, "");
  const env = (process.env.ANDREANI_ENV || "qa").toLowerCase();
  return env === "prod" ? PROD_BASE : QA_BASE;
}

function nowMs() {
  return Date.now();
}

function tokenValid(t: AndreaniToken | null) {
  return t && t.token && t.expiresAt > nowMs() + 60 * 1000;
}

async function login(): Promise<string> {
  if (tokenValid(cache)) return cache!.token;
  if (pendingLogin) return pendingLogin;

  const user = (process.env.ANDREANI_USER || "").trim();
  const pass = (process.env.ANDREANI_PASS || "").trim();
  if (!user || !pass) throw new Error("ANDREANI_USER/ANDREANI_PASS missing");

  const auth = Buffer.from(`${user}:${pass}`).toString("base64");
  const url = `${baseUrl()}/login`;

  pendingLogin = fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ userName: user, password: pass }),
  })
    .then(async (res) => {
      const data = await res.json().catch(() => ({}));
      const token = data?.token || data?.access_token || data?.tokenDeAcceso;
      if (!res.ok || !token) {
        throw new Error(`Andreani login failed: ${res.status} ${JSON.stringify(data)}`);
      }
      cache = { token: String(token), expiresAt: nowMs() + 24 * 60 * 60 * 1000 };
      return cache.token;
    })
    .finally(() => {
      pendingLogin = null;
    });

  return pendingLogin;
}

export async function andreaniRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await login();
  const url = path.startsWith("http") ? path : `${baseUrl()}${path}`;

  const doFetch = async (tk: string) => {
    const res = await fetch(url, {
      ...init,
      headers: {
        Accept: "application/json",
        ...(init?.headers || {}),
        "x-authorization-token": tk,
      },
    });
    const data = await res.json().catch(() => ({}));
    return { res, data } as const;
  };

  let { res, data } = await doFetch(token);
  if (res.status === 401 || res.status === 403) {
    cache = null;
    const newToken = await login();
    const retry = await doFetch(newToken);
    res = retry.res;
    data = retry.data;
  }

  if (!res.ok) {
    throw new Error(`Andreani request failed: ${res.status} ${JSON.stringify(data)}`);
  }

  return data as T;
}

export function buildAndreaniQuery(input: {
  cpDestino: string;
  contrato: string;
  cliente: string;
  volumen?: string;
  kilos?: string;
  valorDeclarado?: string;
  altoCm?: string;
  anchoCm?: string;
  largoCm?: string;
  sucursalOrigen?: string;
}) {
  const params = new URLSearchParams();
  params.set("cpDestino", input.cpDestino);
  params.set("contrato", input.contrato);
  params.set("cliente", input.cliente);

  if (input.sucursalOrigen) params.set("sucursalOrigen", input.sucursalOrigen);

  const volumen = input.volumen ||
    (input.altoCm && input.anchoCm && input.largoCm
      ? String(Number(input.altoCm) * Number(input.anchoCm) * Number(input.largoCm))
      : "");

  if (!volumen) {
    throw new Error("volumen requerido");
  }

  params.set("bultos[0][volumen]", String(volumen));

  if (input.valorDeclarado) params.set("bultos[0][valorDeclarado]", input.valorDeclarado);
  if (input.kilos) params.set("bultos[0][kilos]", input.kilos);
  if (input.altoCm) params.set("bultos[0][altoCm]", input.altoCm);
  if (input.anchoCm) params.set("bultos[0][anchoCm]", input.anchoCm);
  if (input.largoCm) params.set("bultos[0][largoCm]", input.largoCm);

  return params;
}
