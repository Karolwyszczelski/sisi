"use client";

import dynamic from "next/dynamic";

// render tylko w przeglądarce (bez SSR)
const PromoTicker = dynamic(() => import("./PromoTicker"), { ssr: false });

export default function PromoTickerMount() {
  return <PromoTicker />;
}
