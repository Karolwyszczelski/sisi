'use client';

import Image from 'next/image';
import { Facebook, Instagram } from 'lucide-react';

export default function Hero() {
  return (
    <section className="relative w-full pt-8 pb-12 px-4 overflow-hidden">
    
      {/* 🍅 Rozmazany pomidor */}
      <Image
        src="/tomato.png"
        alt="Pomidor"
        width={200}
        height={200}
        className="absolute -left-20 top-0 blur-1xl opacity-40 pointer-events-none select-none z-10"
      />

      {/* Zawartość sekcji */}
      <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 md:gap-6 z-20 relative">
        {/* Obrazek */}
        <div className="w-full md:w-1/2 flex justify-center">
          <Image
            src="/burger.png"
            alt="Burger"
            width={550}
            height={550}
            priority
            className="rounded-none shadow-none"
          />
        </div>

        {/* Tekst */}
        <div className="w-full md:w-1/2 flex flex-col items-center text-center">
          <h1 className="text-[250px] leading-[0.8] font-covered tracking-black uppercase mb-1">
            sisi
          </h1>

          <h2 className="text-2xl md:text-3xl font-black mb-2">BURGER & PANCAKE</h2>

          <p className="text-base md:text-lg max-w-md leading-snug mb-2">
            Najlepsza Restauracja z Burgerami oraz Pancake'ami w Ciechanowie i okolicy!
          </p>

          <a
            href="#menu"
            className="px-6 py-2 border border-black rounded-md font-semibold hover:bg-black hover:text-white transition text-sm"
          >
            ZAMÓW TERAZ!
          </a>
        </div>
      </div>

      {/* Ikony społecznościowe */}
      <div className="hidden md:flex flex-col gap-6 absolute right-6 top-1/2 transform -translate-y-1/2 z-20">
        <a href="https://facebook.com" target="_blank" rel="noopener noreferrer">
          <Facebook className="w-5 h-5 hover:scale-110 transition" />
        </a>
        <a href="https://instagram.com" target="_blank" rel="noopener noreferrer">
          <Instagram className="w-5 h-5 hover:scale-110 transition" />
        </a>
      </div>
    </section>
  );
}
