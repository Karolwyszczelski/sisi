// src/app/page.tsx
import type { Metadata } from "next";

import Hero from "@/components/Hero";
import BurgerMiesiaca from "@/components/BurgerMiesiaca";
import MenuSection from "@/components/menu/MenuSection";
import OnasSection from "@/components/OnasSection";
import ContactSection from "@/components/ContactSection";
import FloatingAuthButtons from "@/components/FloatingLoginButton";
import ReservationFloatingButton from "@/components/ReservationFloatingButton";
import PromoTickerMount from "@/components/PromoTickerMount";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

export default function Home() {
  return (
    <>
      <main>
        <PromoTickerMount />
        <Hero />
        <BurgerMiesiaca />
        <MenuSection />
        <OnasSection />
        <ContactSection />
      </main>

      {/* pływające guziki tylko na stronie głównej */}
      <PromoTickerMount />
      <FloatingAuthButtons />
      <ReservationFloatingButton />
    </>
  );
}
