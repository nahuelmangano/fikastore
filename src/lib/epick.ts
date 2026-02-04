type EpickToken = {
  token: string;
  expiresAt: number;
};

const EPICK_BASE = process.env.EPICK_BASE_URL || "https://dev-ar.e-pick.com.ar";

let cache: EpickToken | null = null;
let pendingLogin: Promise<string> | null = null;

function nowMs() {
  return Date.now();
}

function tokenValid(t: EpickToken | null) {
  return t && t.token && t.expiresAt > nowMs() + 60 * 1000;
}

async function login(): Promise<string> {
  if (tokenValid(cache)) return cache!.token;
  if (pendingLogin) return pendingLogin;

  const phone = process.env.EPICK_PHONE;
  const password = process.env.EPICK_PASSWORD;
  if (!phone || !password) {
    throw new Error("EPICK_PHONE/EPICK_PASSWORD missing");
  }

  pendingLogin = fetch(`${EPICK_BASE}/api/users/login`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ phone, password, source: "BACKEND" }),
  })
    .then(async (res) => {
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.token) {
        throw new Error(`EPick login failed: ${JSON.stringify(data)}`);
      }
      const token = String(data.token);
      cache = { token, expiresAt: nowMs() + 24 * 60 * 60 * 1000 };
      return token;
    })
    .finally(() => {
      pendingLogin = null;
    });

  return pendingLogin;
}

export async function epickRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await login();
  const url = path.startsWith("http") ? path : `${EPICK_BASE}${path}`;

  const doFetch = async (tk: string) => {
    const res = await fetch(url, {
      ...init,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(init?.headers || {}),
        "x-access-token": tk,
      },
    });
    if (res.status === 401) return { res, data: null } as const;
    const data = await res.json().catch(() => ({}));
    return { res, data } as const;
  };

  let { res, data } = await doFetch(token);
  if (res.status === 401) {
    cache = null;
    const newToken = await login();
    const retry = await doFetch(newToken);
    res = retry.res;
    data = retry.data;
  }

  if (!res.ok) {
    throw new Error(`EPick request failed: ${res.status} ${JSON.stringify(data)}`);
  }

  return data as T;
}

export async function epickGetToken(): Promise<string> {
  return login();
}

export function mapEpickStatus(input: string | undefined): string {
  const s = String(input || "").trim().toUpperCase();
  if (!s) return "PENDING";
  const known = [
    "PENDING",
    "PAYED",
    "CONFIRMED",
    "COLLECTED",
    "DELIVERED-TO-SERVICE",
    "DELIVERED",
    "CANCELED",
  ];
  if (known.includes(s)) return s;
  if (s === "CANCELLED") return "CANCELED";
  return "PENDING";
}

export function canTransition(from: string, to: string): boolean {
  const f = mapEpickStatus(from);
  const t = mapEpickStatus(to);
  if (f === t) return true;
  if (t === "CONFIRMED") return f === "PAYED";
  if (t === "PAYED") return f === "PENDING";
  if (t === "COLLECTED") return f === "CONFIRMED" || f === "PAYED";
  if (t === "DELIVERED-TO-SERVICE") return f === "COLLECTED";
  if (t === "DELIVERED") return f === "DELIVERED-TO-SERVICE" || f === "COLLECTED";
  if (t === "CANCELED") return f !== "DELIVERED";
  return false;
}
