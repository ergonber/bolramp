"use client";

import dynamic from "next/dynamic";

const LPContent = dynamic(() => import("./LPContent"), { ssr: false });

export default function LPPage() {
  return <LPContent />;
}
