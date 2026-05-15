const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080";

/**
 * Browser-local bearer token key for the development signature-login session.
 */
const SESSION_TOKEN_KEY = "sunways.sessionToken";

/**
 * Backend nonce payload that the wallet must sign exactly as provided.
 */
export type NonceResponse = {
  address: string;
  expiresAt: string;
  message: string;
  nonce: string;
};

/**
 * Session payload returned after the backend validates the wallet signature.
 */
export type SessionResponse = {
  address: string;
  expiresAt: string;
  token: string;
};

/**
 * Authenticated profile shape used to restore the current browser session.
 */
export type MeResponse = {
  address: string;
  expiresAt: string;
};

/**
 * Small JSON fetch wrapper that normalizes backend error payloads into thrown Error objects.
 */
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

/**
 * Requests a one-time login nonce for an Ethereum address.
 */
export async function createNonce(address: string) {
  return request<NonceResponse>("/auth/nonce", {
    method: "POST",
    body: JSON.stringify({ address }),
  });
}

/**
 * Submits the wallet signature and receives a bearer session token.
 */
export async function verifySignature(address: string, signature: string) {
  return request<SessionResponse>("/auth/verify", {
    method: "POST",
    body: JSON.stringify({ address, signature }),
  });
}

/**
 * Loads the active session profile with a bearer token.
 */
export async function getMe(token: string) {
  return request<MeResponse>("/auth/me", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

/**
 * Invalidates the current session token on the backend.
 */
export async function logout(token: string) {
  return request<{ status: string }>("/auth/logout", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

/**
 * Reads the persisted session token only in the browser runtime.
 */
export function getStoredSessionToken() {
  if (typeof window === "undefined") {
    return null;
  }
  return window.localStorage.getItem(SESSION_TOKEN_KEY);
}

/**
 * Persists the backend bearer token between page refreshes.
 */
export function storeSessionToken(token: string) {
  window.localStorage.setItem(SESSION_TOKEN_KEY, token);
}

/**
 * Clears any locally stored bearer token.
 */
export function clearSessionToken() {
  window.localStorage.removeItem(SESSION_TOKEN_KEY);
}
