"use client";

import dynamic from "next/dynamic";

const KycContent = dynamic(() => import("./KycContent"), { ssr: false });

export default function KycPage() {
  return <KycContent />;
}
