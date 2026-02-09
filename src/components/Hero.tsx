// src/components/Hero.tsx
"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import { DotLottieReact } from "@lottiefiles/dotlottie-react";
import { Facebook, Instagram } from "lucide-react";

interface HeroProps {
  onNavigateToMenu?: () => void;
  onNavigateToBurger?: () => void;
  onOpenReservation?: () => void;
}

const INTRO_SHOWN_KEY = "sisi_intro_shown";

export default function Hero({ onNavigateToMenu, onNavigateToBurger, onOpenReservation }: HeroProps) {
  const [showIntro, setShowIntro] = useState(false); // Start as false, then check
  const [slide, setSlide] = useState<0 | 1>(0);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
      setReducedMotion(mq.matches);
      const onChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
      mq.addEventListener?.("change", onChange);
      return () => mq.removeEventListener?.("change", onChange);
    }
  }, []);

  // Check if intro was already shown this session
  useEffect(() => {
    if (typeof window === "undefined") return;
    
    const alreadyShown = sessionStorage.getItem(INTRO_SHOWN_KEY);
    if (alreadyShown || reducedMotion) {
      setShowIntro(false);
      return;
    }
    
    // Show intro for first visit
    setShowIntro(true);
    sessionStorage.setItem(INTRO_SHOWN_KEY, "true");
    
    const t = setTimeout(() => setShowIntro(false), 1800);
    return () => clearTimeout(t);
  }, [reducedMotion]);

  useEffect(() => {
    if (reducedMotion) return;
    const id = setInterval(() => setSlide((s) => (s === 0 ? 1 : 0)), 3500);
    return () => clearInterval(id);
  }, [reducedMotion]);

  if (showIntro) {
    return (
      <section className="intro-section fixed inset-0 z-50 flex items-center justify-center bg-black text-white overflow-hidden">
        {/* Burger spadający z góry */}
        <div className="burger-drop absolute w-40 h-40 sm:w-48 sm:h-48 z-30 will-change-transform">
          <Image
            src="/burgerpng.png"
            alt=""
            width={192}
            height={192}
            className="w-full h-full object-contain drop-shadow-[0_0_60px_rgba(251,191,36,0.9)]"
            priority
          />
        </div>

        {/* Ślad świetlny za burgerem */}
        <div className="trail-vertical absolute inset-0 flex justify-center pointer-events-none">
          <div className="trail-glow-vertical" />
        </div>

        {/* Tekst odsłaniany przez burgera */}
        <div className="relative z-20 flex flex-col items-center text-center px-6">
          <p className="intro-text text-4xl sm:text-5xl md:text-6xl font-black leading-tight tracking-tight">
            Witaj w <span className="text-yellow-400">SISI</span>! 🍔
          </p>
          <p className="intro-subtext text-white/50 mt-3 text-lg sm:text-xl">Najlepsze burgery w mieście</p>
        </div>

        <style jsx>{`
          .intro-section {
            animation: fadeOutSection 0.4s ease-in 1.4s forwards;
          }

          @keyframes fadeOutSection {
            0% { opacity: 1; }
            100% { opacity: 0; }
          }

          .burger-drop {
            top: -200px;
            left: 50%;
            transform: translateX(-50%) rotate(-20deg);
            animation: dropDown 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
          }
          
          @keyframes dropDown {
            0% {
              top: -200px;
              transform: translateX(-50%) rotate(-20deg) scale(0.8);
              opacity: 0;
            }
            15% {
              opacity: 1;
            }
            60% {
              top: 50%;
              transform: translateX(-50%) translateY(-50%) rotate(10deg) scale(1.1);
            }
            80% {
              transform: translateX(-50%) translateY(-50%) rotate(-5deg) scale(1);
            }
            100% {
              top: 50%;
              transform: translateX(-50%) translateY(-50%) rotate(0deg) scale(1);
              opacity: 0;
            }
          }

          .trail-glow-vertical {
            position: absolute;
            top: 0;
            width: 120px;
            height: 0;
            background: linear-gradient(180deg, rgba(251, 191, 36, 0.8) 0%, rgba(251, 191, 36, 0.4) 50%, transparent 100%);
            border-radius: 100px;
            filter: blur(40px);
            will-change: height, opacity;
            animation: trailGrow 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards, trailFade 0.3s ease-out 0.5s forwards;
          }

          @keyframes trailGrow {
            0% { height: 0; opacity: 0; }
            20% { opacity: 0.8; }
            100% { height: 60vh; opacity: 0.6; }
          }

          @keyframes trailFade {
            0% { opacity: 0.6; }
            100% { opacity: 0; }
          }
          
          .intro-text {
            opacity: 0;
            animation: revealText 0.5s ease-out 0.4s forwards, fadeOutText 0.3s ease-in 1.1s forwards;
          }

          .intro-subtext {
            opacity: 0;
            animation: revealSubtext 0.4s ease-out 0.55s forwards, fadeOutText 0.3s ease-in 1.1s forwards;
          }
          
          @keyframes revealText {
            0% {
              opacity: 0;
              transform: translateY(30px) scale(0.9);
              filter: blur(10px);
            }
            100% {
              opacity: 1;
              transform: translateY(0) scale(1);
              filter: blur(0);
            }
          }

          @keyframes revealSubtext {
            0% {
              opacity: 0;
              transform: translateY(20px);
            }
            100% {
              opacity: 1;
              transform: translateY(0);
            }
          }

          @keyframes fadeOutText {
            0% { opacity: 1; }
            100% { opacity: 0; }
          }
        `}</style>
      </section>
    );
  }

  return (
    <section className="relative w-full min-h-[100svh] overflow-hidden text-white">
      <h1 className="sr-only">
        SISI Burger and Pancakes — najlepsze burgery i pancake w Ciechanowie
      </h1>

      {/* DESKTOP */}
      <div className="hidden md:block relative w-full h-screen">
        <div className="absolute inset-0 -z-10">
          <Image
            src="/tloburger.webp"
            alt="SISI Burger and Pancake - wnętrze restauracji"
            fill
            priority
            className="object-cover object-left"
          />
          <div className="absolute inset-0 bg-black/50" />
        </div>

        <div className="relative z-10 h-full flex items-center justify-center">
          <div className="text-center max-w-4xl mx-auto px-6">

            <h2 className="text-5xl md:text-6xl lg:text-7xl font-black text-white leading-[1.1] mb-6">
              Najlepsze <span className="text-yellow-400">burgery</span>
              <br />
              w Ciechanowie
            </h2>

            <div className="w-20 h-1 bg-yellow-400 mx-auto mb-8" />

            <p className="text-lg md:text-xl text-white/70 max-w-2xl mx-auto leading-relaxed mb-10">
              Świeże składniki od lokalnych dostawców, mięso robione codziennie rano i smażone na grillu. 
              Zamów online lub odwiedź nas!
            </p>

            <div className="flex flex-wrap gap-5 justify-center">
              <a
                href="#menu"
                className="group px-10 py-4 bg-gradient-to-r from-yellow-400 via-yellow-500 to-amber-500 text-black font-bold text-base rounded-xl hover:from-yellow-300 hover:via-yellow-400 hover:to-amber-400 hover:scale-105 transition-all duration-300 shadow-xl shadow-yellow-400/25"
              >
                ZOBACZ MENU
                <span className="inline-block ml-2 group-hover:translate-x-1 transition-transform">→</span>
              </a>
              <a
                href="tel:+48515433488"
                className="px-10 py-4 bg-white/10 backdrop-blur-sm border border-white/20 text-white font-bold text-base rounded-xl hover:bg-white hover:text-black transition-all duration-300"
              >
                ZADZWOŃ
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* MOBILE */}
      <div className="md:hidden relative w-full min-h-[100svh] flex flex-col justify-center">
        <div className="absolute inset-0 -z-10">
          <Image
            src="/hero-mobile-burger.webp"
            alt="SISI Burger and Pancake"
            fill
            priority
            className="object-cover"
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-black/50" />
        </div>

        <div className="relative z-10 text-center px-6 pt-20 pb-32">
          <h2 className="text-4xl font-black text-white leading-[1.15] mb-4">
            Najlepsze <span className="text-yellow-400">burgery</span>
            <br />
            w Ciechanowie
          </h2>

          <div className="w-16 h-1 bg-yellow-400 mx-auto mb-6" />

          <p className="text-base text-white/70 max-w-sm mx-auto leading-relaxed mb-8">
            Składniki od lokalnych dostawców, mięso robione codziennie rano. Zamów online lub odwiedź nas!
          </p>

          <div className="flex flex-col gap-3 max-w-xs mx-auto">
            {onNavigateToMenu ? (
              <button
                onClick={onNavigateToMenu}
                className="w-full py-3.5 bg-gradient-to-r from-yellow-400 via-yellow-500 to-amber-500 text-black font-bold text-sm rounded-xl shadow-lg shadow-yellow-400/25"
              >
                ZOBACZ MENU →
              </button>
            ) : (
              <a
                href="#menu"
                className="w-full py-3.5 bg-gradient-to-r from-yellow-400 via-yellow-500 to-amber-500 text-black font-bold text-sm rounded-xl shadow-lg shadow-yellow-400/25 text-center"
              >
                ZOBACZ MENU →
              </a>
            )}
            {onNavigateToBurger ? (
              <button
                onClick={onNavigateToBurger}
                className="w-full py-3.5 bg-white/10 backdrop-blur-sm border border-yellow-400/30 text-yellow-400 font-bold text-sm rounded-xl"
              >
                🍔 BURGER MIESIĄCA
              </button>
            ) : (
              <a
                href="#burger-miesiaca"
                className="w-full py-3.5 bg-white/10 backdrop-blur-sm border border-yellow-400/30 text-yellow-400 font-bold text-sm rounded-xl text-center"
              >
                🍔 BURGER MIESIĄCA
              </a>
            )}
            {onOpenReservation ? (
              <button
                onClick={onOpenReservation}
                className="w-full py-3.5 bg-white/10 backdrop-blur-sm border border-white/20 text-white font-bold text-sm rounded-xl"
              >
                ZAREZERWUJ STOLIK
              </button>
            ) : (
              <a
                href="tel:+48515433488"
                className="w-full py-3.5 bg-white/10 backdrop-blur-sm border border-white/20 text-white font-bold text-sm rounded-xl text-center"
              >
                ZADZWOŃ
              </a>
            )}
          </div>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-32 md:h-48 bg-gradient-to-b from-transparent to-black pointer-events-none z-20" />
    </section>
  );
}
