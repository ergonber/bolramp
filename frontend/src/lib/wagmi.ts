import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { polygon, polygonAmoy, anvil } from "wagmi/chains";
import { http } from "wagmi";

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

export const config = getDefaultConfig({
  appName: "Onramp BOB→USDC",
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "",
  chains: [chain],
  transports: customTransports,
});

declare module "wagmi" {
  interface Register {
    config: typeof config;
  }
}
