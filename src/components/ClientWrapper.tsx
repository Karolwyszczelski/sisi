"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import CartButton from "./CartButton";
import FloatingLoginButton from "@/components/FloatingLoginButton";
import CartPopup from "./menu/CartPopup";
import CheckoutModal from "./menu/CheckoutModal";
import Header from "./Header";

export default function ClientWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAdminRoute = pathname.startsWith("/admin");

  // Rejestracja Service Workera globalnie (PWA + Push działa w całym scope "/").
  // NIE prosimy tu o zgodę na powiadomienia i NIE robimy subskrypcji.
  // Permission + subscribe robimy wyłącznie po kliknięciu przycisku w panelu.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    (async () => {
      try {
        await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      } catch {
        // ignore
      }
    })();
  }, []);

  return (
    <>
      {!isAdminRoute && <Header />}
      {children}
      {!isAdminRoute && <FloatingLoginButton />}
      {!isAdminRoute && <CartButton />}
      {!isAdminRoute && <CartPopup />}
      {!isAdminRoute && <CheckoutModal />}
    </>
  );
}
