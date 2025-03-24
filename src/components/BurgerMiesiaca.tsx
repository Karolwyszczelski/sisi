'use client';

import Image from 'next/image';
import { useState } from 'react';
import useCartStore from '@/store/cartStore';

export default function BurgerMiesiaca() {
  const { addItem } = useCartStore();
  const [added, setAdded] = useState(false);

  const handleAddToCart = () => {
    addItem({
      name: 'Burger Miesiąca – Azjatycki Twist',
      price: 29,
      quantity: 1,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  return (
    <section
      className="relative w-full text-white py-20 px-0 overflow-hidden"
      style={{
        backgroundImage: "url('/graffitiburger2.png')",
        backgroundPosition: 'center top',
        backgroundRepeat: 'no-repeat',
        backgroundSize: 'cover',
        backgroundAttachment: 'fixed',
      }}
    >
      <div className="absolute inset-0 bg-black opacity-80 z-0" />

      <Image
        src="/ser.png"
        alt="serowe przejście"
        width={1600}
        height={200}
        className="absolute top-0 left-0 w-full h-auto pointer-events-none z-10"
      />

      <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-0 relative z-20 mt-[-110px]">
        <div className="w-full md:w-[30%] flex flex-col items-start text-left ml-auto">
          <h3 className="text-x1 text-[34px] font-bold -mb-2 font-montserrat opacity-0 animate-fade-down animate-delay-1">
            BURGER MIESIĄCA
          </h3>
          <h2 className="text-[80px] leading-none text-yellow-400 font-anton font-black mb-[-20px] opacity-0 animate-fade-down animate-delay-2">
            MARZEC
          </h2>
          <p className="italic text-[59px] font-covered mb-0 opacity-0 animate-fade-down animate-delay-3">
            Azjatycki Twist
          </p>
          <p className="text-sm text-[13px] text-yellow-300 leading-snug max-w-md font-montserrat opacity-0 animate-fade-down animate-delay-4">
            bułka, majonez, rukola, piklowane warzywa, wołowina <br />
            lub kurczak, sos Teriyaki, marynowany imbir, kolendra.
          </p>

          <div className="relative mt-6 group w-14 hover:w-56 transition-all duration-300 ease-in-out">
            <button
              onClick={handleAddToCart}
              className="flex items-center justify-center group-hover:justify-start w-full h-14 bg-white text-black px-4 overflow-hidden transition-all duration-300 ease-in-out rounded-full group-hover:rounded-2xl shadow-lg"
            >
              <div className="w-10 h-10 flex items-center justify-center text-2xl font-extrabold rounded-full bg-white text-black shadow-inner z-10">
                {added ? '✓' : '+'}
              </div>
              <span className={`ml-3 text-sm font-semibold transition-opacity duration-300 whitespace-nowrap z-10 ${added ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
              {added ? 'Dodano!' : 'Dodaj do koszyka'}
              </span>
            </button>
          </div>
        </div>

        <div className="w-full md:w-[55%] flex justify-end mt-10 md:mt-0 relative z-30">
          <div className="absolute right-10 md:right-20 top-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-yellow-400 opacity-30 blur-3xl rounded-full z-0" />

          <Image
            src="/burgermiesiaca.png"
            alt="Burger miesiąca"
            width={700}
            height={600}
            className="object-contain -mr-20 md:-mr-32 animate-slide-in-right z-10"
          />
        </div>
      </div>
    </section>
  );
}