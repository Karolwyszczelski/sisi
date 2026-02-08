'use client';

import { X, Minus } from 'lucide-react';
import useIsClient from '@/lib/useIsClient';
import useCartStore from '@/store/cartStore';

export default function CartPopup() {
  const isClient = useIsClient();
  const {
    isOpen,
    toggleCart,
    items,
    removeItem,
    openCheckoutModal,
    isCheckoutOpen,
    goToStep,
  } = useCartStore();

  if (!isClient || !isOpen) return null;

  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  return (
    <div className="fixed bottom-24 right-6 bg-zinc-900 border border-white/10 text-white rounded-2xl shadow-2xl shadow-black/50 z-50 p-5 w-[320px] backdrop-blur-sm">
      <div className="flex justify-between items-center mb-4 pb-3 border-b border-white/10">
        <h3 className="font-bold text-lg">Twój koszyk</h3>
        <button 
          onClick={toggleCart}
          className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {items.length === 0 ? (
        <div className="py-8 text-center">
          <p className="text-white/50 text-sm">Koszyk jest pusty</p>
          <p className="text-white/30 text-xs mt-1">Dodaj coś pysznego!</p>
        </div>
      ) : (
        <>
          <ul className="space-y-3 max-h-[250px] overflow-y-auto">
            {items.map((item, i) => (
              <li key={i} className="flex justify-between items-center text-sm bg-white/5 rounded-xl p-3">
                <div className="flex-1">
                  <p className="font-medium text-white">{item.name}</p>
                  <p className="text-white/50 text-xs">x {item.quantity}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-yellow-400 font-semibold">{(item.price * item.quantity).toFixed(2)} zł</span>
                  <button
                    onClick={() => removeItem(item.name)}
                    className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center hover:bg-red-500/20 hover:text-red-400 transition-colors"
                    title="Usuń 1 sztukę"
                  >
                    <Minus size={14} />
                  </button>
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-4 pt-3 border-t border-white/10 flex justify-between items-center">
            <span className="text-white/60 text-sm">Suma:</span>
            <span className="text-xl font-bold text-yellow-400">{total.toFixed(2)} zł</span>
          </div>
        </>
      )}

      {items.length > 0 && (
        <button
          onClick={() => {
            if (!isCheckoutOpen) {
              goToStep(1);
              openCheckoutModal();
            }
          }}
          className="mt-4 w-full bg-gradient-to-r from-yellow-400 via-yellow-500 to-amber-500 text-black py-3 rounded-xl font-bold hover:from-yellow-300 hover:via-yellow-400 hover:to-amber-400 transition-all shadow-lg shadow-yellow-500/20"
        >
          Przejdź do kasy →
        </button>
      )}

      {/* Strzałka wskazująca na koszyk */}
      <div className="absolute bottom-[-8px] right-8 w-4 h-4 bg-zinc-900 border-r border-b border-white/10 rotate-45"></div>
    </div>
  );
}
