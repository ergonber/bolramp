"use client";

import * as React from "react";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { config } from "@/lib/wagmi";
import { MockWalletProvider } from "@/contexts/MockWalletContext";

export function Providers({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = React.useState(false);
  const [queryClient] = React.useState(() => new QueryClient());

  React.useEffect(() => {
    setMounted(true);
  }, []);

  // Mount wallet providers on the client only to avoid SSR issues.
  if (!mounted) {
    return null;
  }

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <MockWalletProvider>{children}</MockWalletProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
