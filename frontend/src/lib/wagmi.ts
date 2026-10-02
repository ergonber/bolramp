import { getDefaultConfig } from "@rainbow-me/rainbowkit";
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

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "";
const hasValidProjectId = /^[0-9a-fA-F]{32}$/.test(projectId);

// If there is no valid WalletConnect project ID, fall back to injected wallets
// only. This keeps the app (and its production build) working without one.
export const config = hasValidProjectId
  ? getDefaultConfig({
      appName: "Bolramp",
      projectId,
      chains: [chain],
      transports: customTransports,
    })
  : createConfig({
      chains: [chain],
      connectors: [injected()],
      transports: customTransports,
    });

declare module "wagmi" {
  interface Register {
    config: typeof config;
  }
}
