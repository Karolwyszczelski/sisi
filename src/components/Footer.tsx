// src/components/Footer.tsx
"use client";

import Link from "next/link";
import { ShoppingCart, Phone, Facebook, Instagram, Mail } from "lucide-react";

export default function Footer() {
  return (
    <footer className="bg-black text-white py-12">
      <div className="max-w-6xl mx-auto px-4 grid grid-cols-1 md:grid-cols-3 gap-8 text-center md:text-left">
        {/* 1. Nawigacja */}
        <nav className="flex flex-col items-center md:items-start">
          <h4 className="font-bold text-lg mb-4">Nawigacja</h4>
          <ul className="space-y-2">
            <li><Link href="/" className="hover:text-primary">Strona główna</Link></li>
            <li><Link href="#menu" className="hover:text-primary">Menu</Link></li>
            <li><Link href="#burger-miesiaca" className="hover:text-primary">Burger Miesiąca</Link></li>
            <li><Link href="#kontakt" className="hover:text-primary">Kontakt</Link></li>
          </ul>
        </nav>

        {/* 2. Kontakt */}
        <div className="flex flex-col items-center md:items-start">
          <h4 className="font-bold text-lg mb-4">Kontakt</h4>
          <ul className="space-y-2">
            <li className="flex items-center justify-center md:justify-start">
              <Mail className="w-5 h-5 mr-2" />
              <a href="mailto:kontakt@sisiciechanow.pl" className="hover:text-primary">kontakt@sisiciechanow.pl</a>
            </li>
            <li className="flex items-center justify-center md:justify-start">
              <Phone className="w-5 h-5 mr-2" />
              <a href="tel:+48515433488" className="hover:text-primary">+48 515 433 488</a>
            </li>
            <li className="flex items-center justify-center md:justify-start">
              <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M3 10h18M3 6h18M3 14h18M3 18h18" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              ul. Spółdzielcza 7, 06-400 Ciechanów
            </li>
          </ul>
        </div>

        {/* 3. Social & Akcje */}
        <div className="flex flex-col items-center md:items-start">
          <h4 className="font-bold text-lg mb-4">Zamów online</h4>
          <div className="flex items-center justify-center md:justify-start space-x-4 mb-6">
            <Link href="/order" className="group relative inline-flex items-center justify-center w-10 h-10 bg-primary rounded-full hover:bg-primary-light transition">
              <ShoppingCart className="w-5 h-5 text-black group-hover:scale-110 transition-transform" />
            </Link>
            <a href="tel:+48515433488" className="group relative inline-flex items-center justify-center w-10 h-10 bg-primary rounded-full hover:bg-primary-light transition">
              <Phone className="w-5 h-5 text-black group-hover:scale-110 transition-transform" />
            </a>
          </div>

          <h4 className="font-bold text-lg mb-4">Znajdź nas</h4>
          <div className="flex items-center justify-center md:justify-start space-x-4">
            <a href="https://facebook.com/sisiciechanow" target="_blank" rel="noopener noreferrer" className="group w-8 h-8 flex items-center justify-center bg-white rounded-full hover:bg-gray-600 transition">
              <Facebook className="w-4 h-4 text-black group-hover:scale-110 transition-transform" />
            </a>
            <a href="https://instagram.com/sisiciechanow" target="_blank" rel="noopener noreferrer" className="group w-8 h-8 flex items-center justify-center bg-white rounded-full hover:bg-gray-600 transition">
              <Instagram className="w-4 h-4 text-black group-hover:scale-110 transition-transform" />
            </a>
          </div>
        </div>
      </div>

      <div className="mt-12 border-t border-gray-700 pt-6 text-center text-sm text-gray-400">
        © {new Date().getFullYear()} SiSi Ordering. Wszelkie prawa zastrzeżone. Stronę i system wykonał Karol Wyszczelski.
      </div>
    </footer>
  );
}
