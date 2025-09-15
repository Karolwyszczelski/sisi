// src/components/Footer.tsx
"use client";

import Link from "next/link";
import { ShoppingCart, Phone, Facebook, Instagram, Mail, ShieldCheck, FileText } from "lucide-react";

const TERMS_VERSION = process.env.NEXT_PUBLIC_TERMS_VERSION || "2025-09-15";

export default function Footer() {
  const openCookieSettings = () => {
    try { localStorage.removeItem("cookie_consent_v1"); } catch {}
    if (typeof window !== "undefined") window.location.reload();
  };

  return (
    <footer className="bg-black text-white py-12">
      <div className="max-w-6xl mx-auto px-4 grid grid-cols-1 md:grid-cols-4 gap-8 text-center md:text-left">
        {/* 1. Nawigacja */}
        <nav className="flex flex-col items-center md:items-start">
          <h4 className="font-bold text-lg mb-4">Nawigacja</h4>
          <ul className="space-y-2">
            <li><Link href="/" className="hover:text-primary">Strona główna</Link></li>
            <li><Link href="/#menu" className="hover:text-primary">Menu</Link></li>
            <li><Link href="/#burger-miesiaca" className="hover:text-primary">Burger Miesiąca</Link></li>
            <li><Link href="/#kontakt" className="hover:text-primary">Kontakt</Link></li>
          </ul>
        </nav>

        {/* 2. Kontakt / Dane */}
        <div className="flex flex-col items-center md:items-start">
          <h4 className="font-bold text-lg mb-4">Kontakt</h4>
          <ul className="space-y-2">
            <li className="flex items-center justify-center md:justify-start">
              <Mail className="w-5 h-5 mr-2" aria-hidden="true" />
              <a href="mailto:kontakt@sisiciechanow.pl" className="hover:text-primary">kontakt@sisiciechanow.pl</a>
            </li>
            <li className="flex items-center justify-center md:justify-start">
              <Phone className="w-5 h-5 mr-2" aria-hidden="true" />
              <a href="tel:+48515433488" className="hover:text-primary">+48 515 433 488</a>
            </li>
            <li className="flex items-center justify-center md:justify-start">
              <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
                <path d="M3 10h18M3 6h18M3 14h18M3 18h18" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <a
                href="https://maps.app.goo.gl/"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-primary"
                aria-label="Zobacz na mapie"
              >
                ul. Spółdzielcza 7, 06-400 Ciechanów
              </a>
            </li>
          </ul>
        </div>

        {/* 3. Zamów / Social */}
        <div className="flex flex-col items-center md:items-start">
          <h4 className="font-bold text-lg mb-4">Zamów online</h4>
          <div className="flex items-center justify-center md:justify-start space-x-4 mb-6">
            <Link
              href="/order"
              aria-label="Przejdź do zamówienia online"
              className="group relative inline-flex items-center justify-center w-10 h-10 bg-primary rounded-full hover:bg-primary-light transition"
            >
              <ShoppingCart className="w-5 h-5 text-black group-hover:scale-110 transition-transform" />
            </Link>
            <a
              href="tel:+48515433488"
              aria-label="Zadzwoń do nas"
              className="group relative inline-flex items-center justify-center w-10 h-10 bg-primary rounded-full hover:bg-primary-light transition"
            >
              <Phone className="w-5 h-5 text-black group-hover:scale-110 transition-transform" />
            </a>
          </div>

          <h4 className="font-bold text-lg mb-4">Znajdź nas</h4>
          <div className="flex items-center justify-center md:justify-start space-x-4">
            <a
              href="https://facebook.com/sisiciechanow"
              target="_blank"
              rel="noopener noreferrer"
              className="group w-8 h-8 flex items-center justify-center bg-white rounded-full hover:bg-gray-600 transition"
              aria-label="Facebook"
            >
              <Facebook className="w-4 h-4 text-black group-hover:scale-110 transition-transform" />
            </a>
            <a
              href="https://instagram.com/sisiciechanow"
              target="_blank"
              rel="noopener noreferrer"
              className="group w-8 h-8 flex items-center justify-center bg-white rounded-full hover:bg-gray-600 transition"
              aria-label="Instagram"
            >
              <Instagram className="w-4 h-4 text-black group-hover:scale-110 transition-transform" />
            </a>
          </div>
        </div>

        {/* 4. Informacje prawne / Cookies */}
        <div className="flex flex-col items-center md:items-start">
          <h4 className="font-bold text-lg mb-4">Informacje</h4>
          <ul className="space-y-2">
            <li className="flex items-center justify-center md:justify-start">
              <FileText className="w-5 h-5 mr-2" aria-hidden="true" />
              <Link href="/legal/regulamin" className="hover:text-primary">Regulamin (v{TERMS_VERSION})</Link>
            </li>
            <li className="flex items-center justify-center md:justify-start">
              <ShieldCheck className="w-5 h-5 mr-2" aria-hidden="true" />
              <Link href="/legal/polityka-prywatnosci" className="hover:text-primary">Polityka prywatności</Link>
            </li>
            <li className="flex items-center justify-center md:justify-start">
              <ShieldCheck className="w-5 h-5 mr-2" aria-hidden="true" />
              <Link href="/legal/cookies" className="hover:text-primary">Polityka cookies</Link>
            </li>
            <li className="flex items-center justify-center md:justify-start">
              <button
                type="button"
                onClick={openCookieSettings}
                className="underline hover:text-primary"
                aria-label="Otwórz ustawienia cookies"
              >
                Ustawienia cookies
              </button>
            </li>
          </ul>

          <p className="text-xs text-gray-400 mt-4">
            Płatności online obsługuje <a href="https://www.przelewy24.pl" target="_blank" rel="noopener noreferrer" className="underline">Przelewy24 (PayPro S.A.)</a>.
          </p>
        </div>
      </div>

      <div className="mt-12 border-t border-gray-700 pt-6 text-center text-sm text-gray-400">
        © {new Date().getFullYear()} SiSi Ordering. Wszelkie prawa zastrzeżone. Stronę i system wykonał Karol Wyszczelski.
      </div>
    </footer>
  );
}
