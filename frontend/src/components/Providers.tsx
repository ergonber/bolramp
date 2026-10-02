"use client";

import * as React from "react";
import { RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { config } from "@/lib/wagmi";
import { MockWalletProvider } from "@/contexts/MockWalletContext";

import "@rainbow-me/rainbowkit/styles.css";

export function Providers({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = React.useState(false);
  const [queryClient] = React.useState(() => new QueryClient());

  React.useEffect(() => {
    setMounted(true);
  }, []);

  // wagmi/RainbowKit are not SSR-safe in this stack, so only mount them on the
  // client. The server renders an empty shell and hydration renders the app.
  if (!mounted) {
    return null;
  }

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>
          <MockWalletProvider>{children}</MockWalletProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
