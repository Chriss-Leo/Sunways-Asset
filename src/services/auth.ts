const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080";

const SESSION_TOKEN_KEY = "sunways.sessionToken";

export type NonceResponse = {
  address: string;
  expiresAt: string;
  message: string;
  nonce: string;
};

export type SessionResponse = {
  address: string;
  expiresAt: string;
  token: string;
};

export type MeResponse = {
  address: string;
  expiresAt: string;
};

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      data && typeof data.error === "string"
        ? data.error
        : `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  return data as T;
}

export async function createNonce(address: string) {
  return request<NonceResponse>("/auth/nonce", {
    method: "POST",
    body: JSON.stringify({ address }),
  });
}

export async function verifySignature(address: string, signature: string) {
  return request<SessionResponse>("/auth/verify", {
    method: "POST",
    body: JSON.stringify({ address, signature }),
  });
}

export async function getMe(token: string) {
  return request<MeResponse>("/auth/me", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export async function logout(token: string) {
  return request<{ status: string }>("/auth/logout", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export function getStoredSessionToken() {
  if (typeof window === "undefined") {
    return null;
  }
  return window.localStorage.getItem(SESSION_TOKEN_KEY);
}

export function storeSessionToken(token: string) {
  window.localStorage.setItem(SESSION_TOKEN_KEY, token);
}

export function clearSessionToken() {
  window.localStorage.removeItem(SESSION_TOKEN_KEY);
}
