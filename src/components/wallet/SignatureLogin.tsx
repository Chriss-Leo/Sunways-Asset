import { useEffect, useState } from "react";
import { useAccount, useSignMessage } from "wagmi";
import {
  clearSessionToken,
  createNonce,
  getMe,
  getStoredSessionToken,
  logout,
  storeSessionToken,
  verifySignature,
  type MeResponse,
} from "@/services/auth";

type SignatureLoginProps = {
  /** Whether wallet and network prerequisites are satisfied. */
  canLogin: boolean;
};

function shortAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatExpiry(value: string) {
  return new Date(value).toLocaleString();
}

/**
 * Performs nonce-based wallet login against the backend auth endpoints.
 */
export function SignatureLogin({ canLogin }: SignatureLoginProps) {
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [session, setSession] = useState<MeResponse | null>(null);

  useEffect(() => {
    // Restore a previous bearer session after refresh and drop it if the backend rejects it.
    const token = getStoredSessionToken();
    if (!token) {
      return;
    }

    getMe(token)
      .then(setSession)
      .catch(() => {
        clearSessionToken();
        setSession(null);
    });
  }, []);

  /**
   * Requests a backend nonce, asks the connected wallet to sign it, and stores the session token.
   */
  async function handleLogin() {
    if (!address) {
      return;
    }

    setError(null);
    setIsLoading(true);
    try {
      const nonce = await createNonce(address);
      const signature = await signMessageAsync({ message: nonce.message });
      const nextSession = await verifySignature(address, signature);
      storeSessionToken(nextSession.token);
      setSession({
        address: nextSession.address,
        expiresAt: nextSession.expiresAt,
      });
    } catch (nextError) {
      setError(
        nextError instanceof Error ? nextError.message : "Signature login failed",
      );
    } finally {
      setIsLoading(false);
    }
  }

  /**
   * Clears local state immediately, then best-effort invalidates the backend session.
   */
  async function handleLogout() {
    const token = getStoredSessionToken();
    clearSessionToken();
    setSession(null);

    if (token) {
      await logout(token).catch(() => undefined);
    }
  }

  const isSameAddress =
    session?.address && address
      ? session.address.toLowerCase() === address.toLowerCase()
      : false;
  const isSignedIn = Boolean(session && isSameAddress);
  const activeSession = isSignedIn ? session : null;

  return (
    <section className="mt-5 rounded-lg border border-zinc-200 bg-white">
      <div className="flex flex-col gap-4 p-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-zinc-950">
              Wallet Identity
            </p>
            <span
              className={`inline-flex min-h-7 items-center rounded-full border px-2.5 text-xs font-semibold ${
                isSignedIn
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : isConnected
                    ? "border-amber-200 bg-amber-50 text-amber-800"
                    : "border-zinc-200 bg-zinc-50 text-zinc-600"
              }`}
            >
              {isSignedIn
                ? "Signed in"
                : isConnected
                  ? "Signature required"
                  : "Wallet required"}
            </span>
          </div>
          <p className="mt-2 text-sm leading-6 text-zinc-600">
            Sign a backend nonce with the connected wallet to unlock
            authenticated API access. This does not send a transaction or spend
            gas.
          </p>
          {activeSession ? (
            <p className="mt-2 break-all text-xs text-zinc-500">
              Session for{" "}
              <span className="font-mono font-semibold text-zinc-950">
                {shortAddress(activeSession.address)}
              </span>{" "}
              expires {formatExpiry(activeSession.expiresAt)}
            </p>
          ) : null}
          {session && !isSameAddress ? (
            <p className="mt-2 text-sm text-amber-700">
              Connected wallet differs from the active session.
            </p>
          ) : null}
        </div>

        {isSignedIn ? (
          <button
            className="inline-flex min-h-10 items-center justify-center rounded-md border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-950 transition hover:bg-zinc-50"
            type="button"
            onClick={handleLogout}
          >
            Logout
          </button>
        ) : (
          <button
            className="inline-flex min-h-10 items-center justify-center rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
            disabled={!isConnected || !canLogin || isLoading}
            type="button"
            onClick={handleLogin}
          >
            {isLoading ? "Signing..." : "Sign in with wallet"}
          </button>
        )}
      </div>

      {error ? (
        <p className="mx-4 mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}
    </section>
  );
}
