"use client";

import Hero from '@/components/Hero';
import BurgerMiesiaca from '@/components/BurgerMiesiaca';
import MenuSection from '@/components/menu/MenuSection';
import OnasSection from '@/components/OnasSection';
import ContactSection from "@/components/ContactSection";
import FloatingAuthButtons from "@/components/FloatingLoginButton";
import ReservationFloatingButton from "@/components/ReservationFloatingButton";

export default function Home() {
  return (
    <>
      <main>
        <Hero />
        <BurgerMiesiaca />
        <MenuSection />
        <OnasSection />
        <ContactSection />
      </main>
      {/* pływające guziki tylko na stronie głównej */}
      <FloatingAuthButtons />
      <ReservationFloatingButton />
    </>
  );
}
