"use client";

import { useState } from "react";
import { Menu, X } from "lucide-react";
import Image from "next/image";
import { Phone } from 'lucide-react';

export default function Header() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <header className="absolute top-0 w-full z-50 bg-transparent">
      {/* Górny pasek (logo, itp.) */}
      <div className="max-w-7xl mx-auto px-6 pt-4 pb-3 flex justify-between items-center">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <Image src="/logo.png" alt="SISI Logo" width={70} height={70} />
        </div>

        {/* Desktop Nav */}
        <nav className="hidden md:flex gap-4 items-center text-sm text-black px-6 py-1">
          <a href="#menu" className="hover:text-yellow-400 transition">
            Menu
          </a>
          <a href="#polityka" className="hover:text-yellow-400 transition">
            Polityka Prywatności
          </a>
          <a href="#regulamin" className="hover:text-yellow-400 transition">
            Regulamin
          </a>

          {/* Numer telefonu (czarne tło, żółty tekst) */}
<a
  href="tel:+48515433488"
  className="flex items-center px-2 py-2 bg-black text-yellow-400 font-bold rounded hover:scale-100 transition"
>
  <Phone className="w-5 h-5 mr-2" />
  515 433 488
</a>
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
        <div className="absolute top-full left-0 w-full bg-black px-4 py-4 flex flex-col gap-3 font-medium text-white shadow-md md:hidden">
          <a
            href="#menu"
            className="hover:text-yellow-400 transition"
            onClick={() => setIsOpen(false)}
          >
            Menu
          </a>
          <a
            href="#polityka"
            className="hover:text-yellow-400 transition"
            onClick={() => setIsOpen(false)}
          >
            Polityka Prywatności
          </a>
          <a
            href="#regulamin"
            className="hover:text-yellow-400 transition"
            onClick={() => setIsOpen(false)}
          >
            Regulamin
          </a>

          {/* Numer telefonu (białe tło, żółty tekst) w mobile */}
          <a
            href="tel:+48515433488"
            className="w-fit px-2 py-1 bg-white text-yellow-400 font-bold rounded hover:scale-105 transition"
            onClick={() => setIsOpen(false)}
          >
            515 433 488
          </a>
        </div>
      )}
    </header>
  );
}
