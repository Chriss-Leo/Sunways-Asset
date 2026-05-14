import { useMemo } from "react";
import { useAccount, useChainId, useSwitchChain } from "wagmi";
import { requiredChain } from "@/config/chains";

export function useRequiredChain() {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain, isPending, error } = useSwitchChain();

  const isRequiredChain = chainId === requiredChain.id;

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
