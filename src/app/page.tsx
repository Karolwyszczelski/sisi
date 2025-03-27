'use client';

import Hero from '@/components/Hero';
import BurgerMiesiaca from '@/components/BurgerMiesiaca';
import MenuSection from '@/components/menu/MenuSection';
import OnasSection from '@/components/OnasSection';

export default function Home() {
  return (
    <main>
      <Hero />
      <BurgerMiesiaca />
      <MenuSection />
      <OnasSection />
    </main>
  );
}