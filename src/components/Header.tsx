'use client';

import { useState } from 'react';
import { Phone, ShoppingCart, Menu, X } from 'lucide-react';
import Image from 'next/image';

export default function Header() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <header className="relative bg-transparent w-full z-50">
      <div className="max-w-7xl mx-auto px-6 pt-4 pb-3 flex justify-between items-center relative z-50">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <Image src="/logo.png" alt="SISI Logo" width={70} height={70} />
        </div>

        {/* Desktop Nav */}
        <nav className="hidden md:flex gap-4 items-center font-small text-black text-sm bg-white px-4 py-1 rounded-lg shadow">
          <a href="#menu" className="hover:text-red-300 transition">Menu</a>
          <a href="#polityka" className="hover:text-red-300 transition">Polityka Prywatności</a>
          <a href="#regulamin" className="hover:text-red-300 transition">Regulamin</a>
          <a href="tel:+48515433488" className="p-2 bg-black text-white rounded-full hover:scale-105 transition">
            <Phone className="w-4 h-4" />
          </a>
          <button className="p-2 bg-black text-white rounded-full hover:scale-105 transition">
            <ShoppingCart className="w-4 h-4" />
          </button>
        </nav>

        {/* Mobile Menu Icon */}
        <div className="md:hidden flex items-center gap-2">
          <button onClick={() => setIsOpen(!isOpen)} className="text-white">
            {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {isOpen && (
        <div className="absolute top-full left-0 w-full bg-white px-4 py-4 flex flex-col gap-3 font-medium text-black shadow-md md:hidden z-40">
          <a href="#menu" className="hover:text-red-500 transition">Menu</a>
          <a href="#polityka" className="hover:text-red-500 transition">Polityka Prywatności</a>
          <a href="#regulamin" className="hover:text-red-500 transition">Regulamin</a>
          <a href="tel:+48515433488" className="flex items-center gap-2 text-black hover:text-red-500 transition">
            <Phone className="w-5 h-5" /> Zadzwoń
          </a>
          <button className="flex items-center gap-2 text-black hover:text-red-500 transition">
            <ShoppingCart className="w-5 h-5" /> Koszyk
          </button>
        </div>
      )}
    </header>
  );
}


