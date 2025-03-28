"use client";

import { usePathname } from 'next/navigation';
import CartButton from './CartButton';
import CartPopup from './menu/CartPopup';
import CheckoutModal from './menu/CheckoutModal';
import Header from './Header';

export default function ClientWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAdminRoute = pathname.startsWith('/admin');

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
