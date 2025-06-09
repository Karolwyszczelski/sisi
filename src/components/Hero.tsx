"use client";

import { Facebook, Instagram } from "lucide-react";

export default function Hero() {
  return (
    <section className="relative w-full h-screen overflow-hidden">
      {/* 1. Tło w absolutnym divie */}
      <div
        className="absolute inset-0 bg-no-repeat bg-cover"
        style={{
          backgroundImage: "url('/tloburger.png')",
          backgroundSize: "110%",
          backgroundPositionX: "100%",   // odpowiada right
          backgroundPositionY: "100%",
          animation: "gentleShake 5s ease-in-out infinite",  // podnieś obraz o 80px
          // backgroundPosition: "100% -80px", // też by zadziałało
        }}
      />
        
      {/* Główna treść hero */}
      <div className="max-w-4xl ml-auto flex flex-col md:flex-row items-center justify-between gap-0 md:gap-6 relative z-10 h-full pt-24 px-20">
        <div className="w-full md:w-1/2" />
        <div className="w-full md:w-1/2 flex flex-col items-center text-center">
          <h1 className="text-[170px] leading-[0.8] font-mrBedfort text-white mb-1 drop-shadow-2xl italic font-bold">
            SiSi
            {/* SVG-owy „marker” */}
  <span className="absolute left-0 bottom-0 w-full h-6 z-0 overflow-hidden">
    <svg
      viewBox="0 0 100 10"
      preserveAspectRatio="none"
      className="w-full h-full"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="
          M0,6 20,5 40,8 
          C50,8 10,4 30,7 
          C75,9 40,5 100,6
          L90,10 
          L0,10 
          Z
        "
        fill="#FBBF24"
        opacity="0.85"
      />
    </svg>
  </span>
</h1>
          <h2 className="text-2xl md:text-3xl font-white mb-2 drop-shadow-md text-white">
            BURGER &amp; PANCAKE
          </h2>
          <p className="text-base md:text-lg max-w-md leading-snug mb-2 drop-shadow text-white">
            Najlepsza Restauracja z Burgerami oraz Pancake&#39;ami w Ciechanowie i okolicy!
          </p>
          <a
            href="#menu"
            className="px-6 py-2 border border-white rounded-md font-semibold text-white hover:bg-white hover:text-black transition text-sm drop-shadow-md"
          >
            ZAMÓW TERAZ!
          </a>
        </div>
      </div>

      {/* Ikony społecznościowe */}
      <div className="hidden md:flex flex-col gap-6 text-white absolute right-6 top-1/2 transform -translate-y-1/2 z-20">
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
