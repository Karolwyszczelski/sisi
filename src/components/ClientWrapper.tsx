'use client';

import CartButton from './CartButton';
import CartPopup from './menu/CartPopup';
import CheckoutModal from './menu/CheckoutModal';
import Header from './Header';

export default function ClientWrapper({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      {children}
      <CartButton />
      <CartPopup />
      <CheckoutModal />
    </>
  );
}
