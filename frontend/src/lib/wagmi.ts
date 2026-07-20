import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { polygon, polygonAmoy, anvil } from "wagmi/chains";

const chainId = process.env.NEXT_PUBLIC_CHAIN_ID;

let chain;
if (chainId === "31337") {
  chain = anvil;
} else if (chainId === "80002") {
  chain = polygonAmoy;
} else {
  chain = polygon;
}

export const config = getDefaultConfig({
  appName: "Onramp BOB→USDC",
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "",
  chains: [chain],
});

declare module "wagmi" {
  interface Register {
    config: typeof config;
  }
}
