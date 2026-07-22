"use client";

import dynamic from "next/dynamic";

const ComprarContent = dynamic(() => import("./ComprarContent"), { ssr: false });

export default function ComprarPage() {
  return <ComprarContent />;
}
