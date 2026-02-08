'use client';

import { ShoppingCart } from 'lucide-react';
import useCartStore from '../store/cartStore';

export default function CartButton() {
  const toggleCart = useCartStore((state) => state.toggleCart);
  const items = useCartStore((state) => state.items);

  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <button
      onClick={toggleCart}
      className="hidden md:flex fixed bottom-6 right-6 z-50 w-14 h-14 rounded-2xl bg-yellow-400 shadow-lg shadow-yellow-500/30 items-center justify-center hover:scale-105 hover:bg-yellow-300 transition-all duration-300"
      aria-label="Koszyk"
    >
      <ShoppingCart className="text-black w-6 h-6" />
      {itemCount > 0 && (
        <span className="absolute -top-1 -right-1 bg-black text-yellow-400 text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center border border-yellow-400">
          {itemCount}
        </span>
      )}
    </button>
  );
}
