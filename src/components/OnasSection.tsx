// src/components/OnasSection.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import ReservationModal from "@/components/ReservationModal";

export default function OnasSection() {
  const [isResOpen, setResOpen] = useState(false);

  const ReserveButton = ({
    className = "",
    label = "Zarezerwuj stolik",
  }: { className?: string; label?: string }) => (
    <button
      type="button"
      onClick={() => setResOpen(true)}
      className={`inline-flex items-center justify-center rounded-full px-6 py-3 text-sm md:text-base font-semibold text-black bg-white hover:bg-neutral-200 transition ${className}`}
      aria-label="Otwórz okno rezerwacji stolika"
      aria-haspopup="dialog"
      aria-expanded={isResOpen}
      aria-controls="reservation-modal"
    >
      {label}
    </button>
  );

  const FeatureCard = ({
    icon,
    title,
    desc,
    alt,
  }: { icon: string; title: string; desc: string; alt: string }) => (
    <div className="rounded-2xl bg-neutral-900 border border-neutral-800 p-6 md:p-7 text-white">
      <div className="flex flex-col items-center text-center gap-3">
        <div className="rounded-xl bg-neutral-800 p-4 ring-1 ring-neutral-700/60">
          <Image src={icon} alt={alt} width={56} height={56} />
        </div>
        <h4 className="text-base md:text-lg font-semibold">{title}</h4>
        <p className="text-sm md:text-base text-neutral-300 leading-relaxed">{desc}</p>
      </div>
    </div>
  );

  return (
    <>
      <section
        id="onas"
        className="
          relative w-full text-white overflow-hidden
          bg-[url('/backgroundsisi.jpg')] bg-cover bg-center bg-no-repeat
        "
        aria-labelledby="onas-heading"
      >
        {/* overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black/60" aria-hidden="true" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 py-14 md:py-20">
          {/* Nagłówek + opis */}
          <div className="flex flex-col items-center text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-black/40 px-3 py-1 text-[11px] font-medium text-neutral-200 tracking-wide">
              <span className="h-1.5 w-1.5 rounded-full bg-yellow-400" />
              Lokal w centrum Ciechanowa
            </span>

            <h2 id="onas-heading" className="mt-4 text-4xl md:text-6xl font-extrabold tracking-tight">
              O nas
            </h2>

            <p className="mt-4 max-w-2xl text-sm md:text-base text-neutral-200 leading-relaxed">
              <strong className="text-white">SISI Burger &amp; Pancake</strong> — chrupiące burgery i puszyste
              pancake w jednym menu, z sezonowych, lokalnych składników.
            </p>

            {/* CTA */}
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <ReserveButton />
              <Link
                href="#menu"
                className="inline-flex items-center justify-center rounded-full px-6 py-3 text-sm md:text-base font-semibold text-white border border-white hover:bg-white/10 transition"
              >
                Zobacz menu
              </Link>
            </div>

            {/* Statystyki */}
            <div className="mt-6 grid grid-cols-3 gap-3 max-w-xl w-full justify-items-center">
              <div className="rounded-xl border border-white/25 bg-neutral-900/80 px-4 py-3 text-center">
                <div className="text-lg md:text-2xl font-extrabold">100%</div>
                <div className="text-[11px] md:text-xs text-neutral-200">Świeże składniki</div>
              </div>
              <div className="rounded-xl border border-white/25 bg-neutral-900/80 px-4 py-3 text-center">
                <div className="text-lg md:text-2xl font-extrabold">#1</div>
                <div className="text-[11px] md:text-xs text-neutral-200">Smak w okolicy</div>
              </div>
              <div className="rounded-xl border border-white/25 bg-neutral-900/80 px-4 py-3 text-center">
                <div className="text-lg md:text-2xl font-extrabold">24/7</div>
                <div className="text-[11px] md:text-xs text-neutral-200">Rezerwacje online</div>
              </div>
            </div>
          </div>

          {/* Atuty */}
          <div className="mt-12 md:mt-16 max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-5 md:gap-7 place-items-center">
            <FeatureCard
              icon="/icons/meat.png"
              alt="Ikona mięsa"
              title="Najlepsze mięso"
              desc="Wołowina siekana na miejscu, bez konserwantów — od sprawdzonych dostawców."
            />
            <FeatureCard
              icon="/icons/vegetable.png"
              alt="Ikona warzyw"
              title="Świeże składniki"
              desc="Codziennie współpracujemy z lokalnymi dostawcami, by zapewnić najwyższą jakość."
            />
            <FeatureCard
              icon="/icons/reservation.png"
              alt="Ikona rezerwacji"
              title="Rezerwacja online"
              desc="Kilka kliknięć i stolik gotowy. Szybko i wygodnie."
            />
          </div>

          {/* Obraz pod tekstem */}
          <div className="mt-12 md:mt-16 flex justify-center">
            <Image
              src="/onas-main.jpg"
              alt="SISI Burger & Pancake — wnętrze lokalu"
              width={1200}
              height={700}
              className="w-full max-w-5xl h-auto rounded-2xl object-cover"
            />
          </div>

          {/* CTA mobile pełna szerokość */}
          <div className="mt-10 text-center md:hidden">
            <ReserveButton className="w-full" />
          </div>
        </div>

        {isResOpen && (
          <ReservationModal
            isOpen={isResOpen}
            onClose={() => setResOpen(false)}
            id="reservation-modal"
          />
        )}
      </section>
    </>
  );
}
