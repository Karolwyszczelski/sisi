// src/components/OnasSection.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { MapPin, Clock, Phone, Sparkles, Flame, Heart } from "lucide-react";
import ReservationModal from "@/components/ReservationModal";

export default function OnasSection() {
  const [isResOpen, setResOpen] = useState(false);

  return (
    <>
      <section
        id="onas"
        className="relative w-full bg-black overflow-hidden"
        aria-labelledby="onas-heading"
      >
        {/* Gradient tła - zaczyna od czarnego */}
        <div className="absolute inset-0 bg-black" />
        
        {/* Dekoracyjne elementy */}
        <div className="absolute top-40 left-10 w-72 h-72 bg-yellow-400/5 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-yellow-400/5 rounded-full blur-3xl" />

        <div className="relative z-10 max-w-6xl mx-auto px-5 sm:px-8 lg:px-10 py-12 md:py-28">
          
          {/* Nagłówek */}
          <div className="text-center mb-10 md:mb-16">
            <span className="inline-flex items-center gap-2 rounded-full bg-yellow-400/10 border border-yellow-400/20 px-3 py-1.5 text-xs sm:text-sm font-medium text-yellow-400 mb-4 md:mb-6">
              <MapPin size={14} className="sm:w-4 sm:h-4" />
              Centrum Ciechanowa
            </span>

            <h2 id="onas-heading" className="text-3xl sm:text-4xl md:text-6xl lg:text-7xl font-black text-white tracking-tight">
              O <span className="text-yellow-400">NAS</span>
            </h2>

            <p className="mt-4 md:mt-6 max-w-2xl mx-auto text-base md:text-xl text-white/60 leading-relaxed px-2">
              Jesteśmy miejscem, gdzie tradycyjne receptury spotykają się z nowoczesnym smakiem
            </p>
          </div>

          {/* Główna treść - dwie kolumny */}
          <div className="grid md:grid-cols-2 gap-8 md:gap-16 items-center mb-12 md:mb-20">
            
            {/* Lewa kolumna - tekst */}
            <div className="space-y-4 md:space-y-6 text-center md:text-left">
              <h3 className="text-xl sm:text-2xl md:text-3xl font-bold text-white leading-tight">
                <span className="text-yellow-400">SISI</span> Burger & Pancake
              </h3>
              
              <p className="text-sm md:text-base text-white/50 leading-relaxed">
                Od pierwszego dnia stawiamy na jakość i świeżość. Nasze burgery powstają z najlepszej wołowiny, 
                którą codziennie siekamy na miejscu. Bułki pieczone według własnej receptury, warzywa od lokalnych 
                dostawców, a sosy przygotowywane z pasją.
              </p>
              
              <p className="text-sm md:text-base text-white/50 leading-relaxed">
                Pancake? To nasza druga specjalność! Puszyste, złociste i podawane z najlepszymi dodatkami — 
                od klasycznego syropu klonowego, przez świeże owoce, aż po nutellę i bitą śmietanę.
              </p>

              <div className="flex flex-wrap justify-center md:justify-start gap-3 pt-2 md:pt-4">
                <button
                  type="button"
                  onClick={() => setResOpen(true)}
                  className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 md:px-6 md:py-3 text-sm font-bold text-black bg-yellow-400 hover:bg-yellow-300 transition-all duration-300 hover:scale-105"
                >
                  Zarezerwuj stolik
                </button>
                <Link
                  href="#menu"
                  className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 md:px-6 md:py-3 text-sm font-bold text-white border border-white/20 hover:border-yellow-400/50 hover:text-yellow-400 transition-all duration-300"
                >
                  Zobacz menu
                </Link>
              </div>
            </div>

            {/* Prawa kolumna - statystyki */}
            <div className="grid grid-cols-2 gap-3 md:gap-4">
              <div className="bg-gradient-to-br from-zinc-800/80 to-zinc-900/80 rounded-2xl md:rounded-3xl p-4 md:p-6 border border-white/5 hover:border-yellow-400/30 transition-colors duration-300">
                <div className="text-2xl sm:text-3xl md:text-5xl font-black text-yellow-400">5+</div>
                <div className="text-xs md:text-sm text-white/50 mt-1 md:mt-2">lat doświadczenia</div>
              </div>
              <div className="bg-gradient-to-br from-zinc-800/80 to-zinc-900/80 rounded-2xl md:rounded-3xl p-4 md:p-6 border border-white/5 hover:border-yellow-400/30 transition-colors duration-300">
                <div className="text-2xl sm:text-3xl md:text-5xl font-black text-white">100%</div>
                <div className="text-xs md:text-sm text-white/50 mt-1 md:mt-2">świeżych składników</div>
              </div>
              <div className="bg-gradient-to-br from-zinc-800/80 to-zinc-900/80 rounded-2xl md:rounded-3xl p-4 md:p-6 border border-white/5 hover:border-yellow-400/30 transition-colors duration-300">
                <div className="text-2xl sm:text-3xl md:text-5xl font-black text-white">1000+</div>
                <div className="text-xs md:text-sm text-white/50 mt-1 md:mt-2">zadowolonych klientów</div>
              </div>
              <div className="bg-gradient-to-br from-yellow-400 to-amber-500 rounded-2xl md:rounded-3xl p-4 md:p-6">
                <div className="text-2xl sm:text-3xl md:text-5xl font-black text-black">#1</div>
                <div className="text-xs md:text-sm text-black/60 mt-1 md:mt-2">smak w Ciechanowie</div>
              </div>
            </div>
          </div>

          {/* Cechy - trzy karty */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6 mb-12 md:mb-20">
            <div className="group bg-gradient-to-br from-zinc-800/60 to-zinc-900/60 rounded-2xl md:rounded-3xl p-5 md:p-8 border border-white/5 hover:border-yellow-400/30 transition-all duration-500 hover:-translate-y-2">
              <div className="w-12 h-12 md:w-14 md:h-14 rounded-xl md:rounded-2xl bg-yellow-400/10 flex items-center justify-center mb-4 md:mb-5 group-hover:bg-yellow-400/20 transition-colors">
                <Flame className="text-yellow-400" size={24} />
              </div>
              <h4 className="text-lg md:text-xl font-bold text-white mb-2 md:mb-3">Grillowane na ogniu</h4>
              <p className="text-white/40 text-xs md:text-sm leading-relaxed">
                Każdy burger grillujemy na otwartym ogniu, co nadaje mu wyjątkowy, głęboki smak.
              </p>
            </div>

            <div className="group bg-gradient-to-br from-zinc-800/60 to-zinc-900/60 rounded-2xl md:rounded-3xl p-5 md:p-8 border border-white/5 hover:border-yellow-400/30 transition-all duration-500 hover:-translate-y-2">
              <div className="w-12 h-12 md:w-14 md:h-14 rounded-xl md:rounded-2xl bg-yellow-400/10 flex items-center justify-center mb-4 md:mb-5 group-hover:bg-yellow-400/20 transition-colors">
                <Sparkles className="text-yellow-400" size={24} />
              </div>
              <h4 className="text-lg md:text-xl font-bold text-white mb-2 md:mb-3">Świeżość codziennie</h4>
              <p className="text-white/40 text-xs md:text-sm leading-relaxed">
                Składniki dostarczane każdego ranka. Bułki pieczone na miejscu. Zero kompromisów.
              </p>
            </div>

            <div className="group bg-gradient-to-br from-zinc-800/60 to-zinc-900/60 rounded-2xl md:rounded-3xl p-5 md:p-8 border border-white/5 hover:border-yellow-400/30 transition-all duration-500 hover:-translate-y-2">
              <div className="w-12 h-12 md:w-14 md:h-14 rounded-xl md:rounded-2xl bg-yellow-400/10 flex items-center justify-center mb-4 md:mb-5 group-hover:bg-yellow-400/20 transition-colors">
                <Heart className="text-yellow-400" size={24} />
              </div>
              <h4 className="text-lg md:text-xl font-bold text-white mb-2 md:mb-3">Robione z pasją</h4>
              <p className="text-white/40 text-xs md:text-sm leading-relaxed">
                Każde danie przygotowujemy z miłością. Bo wiemy, że smak zaczyna się od serca.
              </p>
            </div>
          </div>

          {/* Informacje kontaktowe */}
          <div className="bg-gradient-to-br from-zinc-800/40 to-zinc-900/40 rounded-2xl md:rounded-3xl p-5 md:p-10 border border-white/5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 md:gap-8 text-center md:text-left">
              <div className="flex flex-col md:flex-row items-center gap-3 md:gap-4">
                <div className="w-10 h-10 md:w-12 md:h-12 rounded-lg md:rounded-xl bg-yellow-400 flex items-center justify-center shrink-0">
                  <MapPin className="text-black" size={20} />
                </div>
                <div>
                  <div className="text-xs md:text-sm text-white/40 mb-0.5 md:mb-1">Adres</div>
                  <div className="text-sm md:text-base text-white font-semibold">ul. Płońska 35, Ciechanów</div>
                </div>
              </div>

              <div className="flex flex-col md:flex-row items-center gap-3 md:gap-4">
                <div className="w-10 h-10 md:w-12 md:h-12 rounded-lg md:rounded-xl bg-yellow-400 flex items-center justify-center shrink-0">
                  <Clock className="text-black" size={20} />
                </div>
                <div>
                  <div className="text-xs md:text-sm text-white/40 mb-0.5 md:mb-1">Godziny otwarcia</div>
                  <div className="text-sm md:text-base text-white font-semibold">Pon-Nd: 12:00 - 21:00</div>
                </div>
              </div>

              <div className="flex flex-col md:flex-row items-center gap-3 md:gap-4">
                <div className="w-10 h-10 md:w-12 md:h-12 rounded-lg md:rounded-xl bg-yellow-400 flex items-center justify-center shrink-0">
                  <Phone className="text-black" size={20} />
                </div>
                <div>
                  <div className="text-xs md:text-sm text-white/40 mb-0.5 md:mb-1">Telefon</div>
                  <div className="text-sm md:text-base text-white font-semibold">+48 123 456 789</div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* Modal poza sekcją + wymuszony czarny tekst */}
      {isResOpen && (
        <div className="text-black">
          <ReservationModal
            isOpen={isResOpen}
            onClose={() => setResOpen(false)}
            id="reservation-modal"
          />
        </div>
      )}
    </>
  );
}
