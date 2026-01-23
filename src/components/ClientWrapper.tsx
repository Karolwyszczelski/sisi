"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import CartButton from "./CartButton";
import CartPopup from "./menu/CartPopup";
import CheckoutModal from "./menu/CheckoutModal";
import Header from "./Header";

export default function ClientWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAdminRoute = pathname.startsWith("/admin");

  // START marker: useEffect(() => {
  // END marker: }, []);
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    (async () => {
      try {
        // Rejestruj SW zawsze -> Chrome widzi stronę jako PWA-installable
        await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
          updateViaCache: "none",
        });

        // czekamy aż SW będzie gotowy (kontroluje scope)
        await navigator.serviceWorker.ready;
      } catch (e) {
        console.warn("[sw] register failed", e);
      }
    })();
  }, []);
  // START marker: useEffect(() => {
  // END marker: }, []);

  return (
    <>
      {!isAdminRoute && <Header />}
      {children}
      {!isAdminRoute && <CartButton />}
      {!isAdminRoute && <CartPopup />}
      {!isAdminRoute && <CheckoutModal />}
    </>
  );
}
