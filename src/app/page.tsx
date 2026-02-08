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
import MobilePageWrapper from "@/components/MobilePageWrapper";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

export default function Home() {
  return (
    <>
      {/* Desktop: standardowy layout */}
      <main className="hidden md:block">
        <PromoTickerMount />
        <Hero />
        <BurgerMiesiaca />
        <MenuSection />
        <OnasSection />
        <ContactSection />
      </main>

      {/* Mobile: app-like experience */}
      <MobilePageWrapper />

      {/* pływające guziki tylko na desktop */}
      <div className="hidden md:block">
        <PromoTickerMount />
        <FloatingAuthButtons />
        <ReservationFloatingButton />
      </div>
    </>
  );
}
