"use client";

import { Facebook, Instagram } from "lucide-react";
import { Gochi_Hand } from 'next/font/google';

export default function Hero() {
  return (
    <section
      className="relative w-full h-screen overflow-hidden bg-no-repeat"
      style={{
        backgroundImage: "url('/tloburger.png')",
        backgroundSize: "120%",
        backgroundPosition: "right -100px",
        animation: "gentleShake 5s ease-in-out infinite",
      }}
    >
      {/* Główna treść hero */}
      <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 md:gap-6 relative z-20 h-full pt-20 px-4">
        <div className="w-full md:w-1/2" />
        <div className="w-full md:w-1/2 flex flex-col items-center text-center">
          <h1 className="text-[250px] leading-[0.8] font-covered tracking-extrabold uppercase mb-1 drop-shadow-2xl">
            SISI
          </h1>
          <h2 className="text-2xl md:text-3xl font-black mb-2 drop-shadow-md">
            BURGER &amp; PANCAKE
          </h2>
          <p className="text-base md:text-lg max-w-md leading-snug mb-2 drop-shadow">
            Najlepsza Restauracja z Burgerami oraz Pancake&#39;ami w Ciechanowie i okolicy!
          </p>
          <a
            href="#menu"
            className="px-6 py-2 border border-black rounded-md font-semibold hover:bg-black hover:text-white transition text-sm drop-shadow-md"
          >
            ZAMÓW TERAZ!
          </a>
        </div>
      </div>

      {/* Ikony społecznościowe */}
      <div className="hidden md:flex flex-col gap-6 absolute right-6 top-1/2 transform -translate-y-1/2 z-20">
        <a href="https://facebook.com" target="_blank" rel="noopener noreferrer">
          <Facebook className="w-5 h-5 hover:scale-110 transition drop-shadow" />
        </a>
        <a href="https://instagram.com" target="_blank" rel="noopener noreferrer">
          <Instagram className="w-5 h-5 hover:scale-110 transition drop-shadow" />
        </a>
      </div>
    </section>
  );
}
