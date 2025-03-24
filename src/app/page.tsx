'use client';

import Hero from '@/components/Hero';
import BurgerMiesiaca from '@/components/BurgerMiesiaca';
import MenuSection from '@/components/menu/MenuSection';
import CheckoutModal from '@/components/menu/CheckoutModal';
import useCartStore from '@/store/cartStore';

export default function Home() {
  const isCheckoutOpen = useCartStore((state) => state.isCheckoutOpen);

  return (
    <main>
      {isCheckoutOpen && <CheckoutModal />}
      <Hero />
      <BurgerMiesiaca />
      <MenuSection />
    </main>
  );
}


