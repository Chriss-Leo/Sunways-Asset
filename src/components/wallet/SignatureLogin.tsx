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

  return (
    <section className="mt-5 rounded-lg border border-zinc-200 bg-white p-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-medium text-zinc-500">Signature Login</p>
          <p className="mt-2 text-sm leading-6 text-zinc-600">
            Sign a backend nonce to prove control of the connected wallet.
          </p>
          {session ? (
            <p className="mt-2 break-all font-mono text-xs text-emerald-700">
              Logged in as {session.address}
            </p>
          ) : null}
          {session && !isSameAddress ? (
            <p className="mt-2 text-sm text-amber-700">
              Connected wallet differs from the active session.
            </p>
          ) : null}
        </div>

        {session ? (
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
        <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}
    </section>
  );
}
