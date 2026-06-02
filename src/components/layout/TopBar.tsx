import { useEffect, useState } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useRouter } from "next/router";
import { useAccount, useChainId, useSignMessage } from "wagmi";
import { useT } from "@/i18n";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
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

const breadcrumbMap: Record<string, string> = {
  "/": "breadcrumb.dashboard",
  "/platform": "breadcrumb.platform",
  "/platform/files": "breadcrumb.files",
  "/assets": "breadcrumb.assets",
  "/revenue": "breadcrumb.revenue",
  "/carbon": "breadcrumb.carbon",
  "/admin": "breadcrumb.admin",
};

function shortAddress(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

/** Inline SIWE login button + session dropdown for the top bar. */
function SiweControl() {
  const { t } = useT();
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [session, setSession] = useState<MeResponse | null>(null);

  useEffect(() => {
    const token = getStoredSessionToken();
    if (!token) return;
    getMe(token)
      .then(setSession)
      .catch(() => {
        clearSessionToken();
        setSession(null);
      });
  }, []);

  const isSameAddress =
    session?.address && address
      ? session.address.toLowerCase() === address.toLowerCase()
      : false;
  const isSignedIn = Boolean(session && isSameAddress);

  async function handleLogin() {
    if (!address) return;
    setError(null);
    setLoading(true);
    try {
      const nonce = await createNonce(address);
      const signature = await signMessageAsync({ message: nonce.message });
      const nextSession = await verifySignature(address, signature);
      storeSessionToken(nextSession.token);
      setSession({
        address: nextSession.address,
        expiresAt: nextSession.expiresAt,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : t("wallet.signatureLoginFailed"));
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    const token = getStoredSessionToken();
    clearSessionToken();
    setSession(null);
    setOpen(false);
    if (token) await logout(token).catch(() => undefined);
  }

  if (!isConnected || !address) return null;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`hidden items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-semibold transition sm:flex ${
          isSignedIn
            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
            : "border-amber-200 bg-amber-50 text-amber-700"
        }`}
      >
        <span
          className={`h-1.5 w-1.5 rounded-full ${isSignedIn ? "bg-emerald-500" : "bg-amber-500"}`}
        />
        {isSignedIn ? t("wallet.signedIn") : t("wallet.signatureRequired")}
      </button>

      {open ? (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 top-full z-20 mt-2 w-72 rounded-lg border border-zinc-200 bg-white p-4 shadow-lg">
            {isSignedIn ? (
              <div className="space-y-3">
                <div>
                  <p className="text-xs font-semibold uppercase text-zinc-500">
                    {t("wallet.sessionFor")}
                  </p>
                  <p className="mt-1 font-mono text-sm font-semibold text-zinc-950">
                    {shortAddress(session!.address)}
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    {t("wallet.expires")}{" "}
                    {new Date(session!.expiresAt).toLocaleString()}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50"
                >
                  {t("wallet.logout")}
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm leading-6 text-zinc-600">
                  {t("wallet.identityDescription")}
                </p>
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleLogin}
                  className="w-full rounded-md bg-emerald-700 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:bg-zinc-400"
                >
                  {loading ? t("wallet.signing") : t("wallet.signInWithWallet")}
                </button>
                {error ? (
                  <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                    {error}
                  </p>
                ) : null}
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}

export function TopBar() {
  const { t } = useT();
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const chainId = useChainId();

  const breadcrumbLabel = breadcrumbMap[router.pathname]
    ? t(breadcrumbMap[router.pathname])
    : router.pathname;

  return (
    <header className="flex h-14 items-center justify-between border-b border-zinc-200 bg-white px-4 lg:px-6">
      <div className="flex items-center gap-3">
        <span className="text-base font-bold tracking-tight text-zinc-950">
          Sunways
        </span>
        <span className="hidden h-5 w-px bg-zinc-200 sm:block" />
        <span className="hidden text-sm font-medium text-zinc-500 sm:block">
          {breadcrumbLabel}
        </span>
      </div>

      <div className="flex items-center gap-3">
        {isConnected && address ? (
          <div className="hidden items-center gap-2 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs sm:flex">
            <span className="font-mono font-medium text-zinc-700">
              {shortAddress(address)}
            </span>
            <span className="text-zinc-400">·</span>
            <span className="text-zinc-500">Chain {chainId}</span>
          </div>
        ) : null}
        <SiweControl />
        <ConnectButton />
        <LanguageSwitcher />
      </div>
    </header>
  );
}
