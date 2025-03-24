'use client';

import { X, Minus } from 'lucide-react';
import useIsClient from '@/lib/useIsClient';
import useCartStore from '@/store/cartStore';

export default function CartPopup() {
  const isClient = useIsClient();
  const { isOpen, toggleCart, items, openCheckoutModal, removeItem } = useCartStore(); // dodaj removeItem

  if (!isClient || !isOpen) return null;

  return (
    <div className="fixed bottom-24 right-6 bg-white text-black rounded-xl shadow-xl z-50 p-4 w-[300px]">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-bold text-lg">Twój koszyk</h3>
        <button onClick={toggleCart}>
          <X />
        </button>
      </div>

      {items.length === 0 ? (
        <p className="text-sm">Koszyk jest pusty</p>
      ) : (
        <ul className="space-y-2">
          {items.map((item, i) => (
            <li key={i} className="flex justify-between items-center text-sm">
              <div>
                {item.name} x {item.quantity}
              </div>
              <div className="flex items-center gap-2">
                <span>{item.price} zł</span>
                <button
                  onClick={() => removeItem(item.name)}
                  className="p-1 rounded hover:bg-gray-200 transition"
                  title="Usuń 1 sztukę"
                >
                  <Minus size={16} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {items.length > 0 && (
        <button
          onClick={openCheckoutModal}
          className="mt-4 w-full bg-yellow-400 text-black py-2 rounded-full font-semibold"
        >
          Przejdź do kasy
        </button>
      )}

      {/* Strzałka wskazująca na koszyk */}
      <div className="absolute bottom-[-10px] right-6 w-4 h-4 bg-white rotate-45 shadow-md z-[-1]"></div>
    </div>
  );
}
