import { useMemo } from "react";
import { useAccount, useChainId, useSwitchChain } from "wagmi";
import { requiredChain } from "@/config/chains";

/**
 * Centralizes the network gate used before wallet-signature and contract flows run.
 */
export function useRequiredChain() {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain, isPending, error } = useSwitchChain();

  const isRequiredChain = chainId === requiredChain.id;

  // Memoize the command object so wallet status panels do not re-render on unrelated state.
  return useMemo(
    () => ({
      chainId,
      error,
      isConnected,
      isRequiredChain,
      isSwitching: isPending,
      requiredChain,
      switchToRequiredChain: () => switchChain({ chainId: requiredChain.id }),
    }),
    [chainId, error, isConnected, isPending, isRequiredChain, switchChain],
  );
}
