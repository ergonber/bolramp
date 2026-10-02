import { polygon, polygonAmoy, anvil } from "wagmi/chains";
import { http, createConfig } from "wagmi";
import { injected } from "wagmi/connectors";

const chainId = process.env.NEXT_PUBLIC_CHAIN_ID;

let chain;
if (chainId === "31337") {
  chain = anvil;
} else if (chainId === "80002") {
  chain = polygonAmoy;
} else {
  chain = polygon;
}

const customTransports: Record<number, ReturnType<typeof http>> = {};
if (chainId === "80002") {
  customTransports[polygonAmoy.id] = http(
    "https://polygon-amoy-bor-rpc.publicnode.com"
  );
}

// NOTE: RainbowKit's `getDefaultConfig`/`connectorsForWallets` are not
// SSR-safe here (crash with "Cannot read properties of undefined (reading
// 'uid')", and WalletConnect blows up the build). We build the wagmi config
// explicitly with injected wallets; RainbowKitProvider still renders the
// connect modal for MetaMask/Rabby/injected wallets. Providers mount
// client-only (components/Providers.tsx).
export const config = createConfig({
  chains: [chain],
  connectors: [injected()],
  transports: customTransports,
  ssr: true,
});

declare module "wagmi" {
  interface Register {
    config: typeof config;
  }
}
