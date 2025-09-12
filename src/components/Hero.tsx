// src/components/Hero.tsx
"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { DotLottieReact } from "@lottiefiles/dotlottie-react";
import { Facebook, Instagram } from "lucide-react";

export default function Hero() {
  const [showIntro, setShowIntro] = useState(true);
  const [slide, setSlide] = useState(0); // 0 = Burger, 1 = Pancake

  useEffect(() => {
    const timer = setTimeout(() => setShowIntro(false), 4000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const id = setInterval(() => setSlide((s) => (s === 0 ? 1 : 0)), 3500);
    return () => clearInterval(id);
  }, []);

  if (showIntro) {
    return (
      <section className="fixed inset-0 bg-black flex flex-col items-center justify-center z-50 space-y-6">
        <div className="w-64 h-64 sm:w-80 sm:h-80">
          <DotLottieReact
            src="https://lottie.host/94a05476-cced-433a-b1ed-ec400e6ac153/3H4yjKz5rT.lottie"
            loop
            autoplay
            className="w-full h-full"
          />
        </div>
        <h1 className="text-white text-3xl font-bold">Cześć!</h1>
        <p className="text-white text-xl">co dziś zamawiamy?</p>
      </section>
    );
  }

  return (
    <section className="relative w-full min-h-[100svh] overflow-hidden">
      {/* DESKTOP */}
      <div className="hidden md:block relative w-full h-screen">
        {/* 1. Tło hero */}
        <div
          className="
            absolute inset-0
            bg-no-repeat
            bg-[length:400%_auto] bg-left
            md:bg-[length:110%_auto] md:bg-right-bottom
            md:[animation:gentleShake_5s_ease-in-out_infinite]
          "
          style={{ backgroundImage: "url('/tloburger.png')" }}
        />

        {/* 2. Zawartość hero */}
        <div
          className="
            relative z-10 h-full
            flex flex-col-reverse items-center justify-center
            md:flex-row md:items-center md:justify-between
            pt-24 px-4 sm:px-6 md:px-20
          "
        >
          <div className="w-full max-w-7xl mx-auto md:px-0">
            <div className="flex flex-col-reverse md:flex-row md:items-center">
              <div className="hidden md:block md:w-1/2" />
              <div
                className="
                  w-full md:w-[46%] md:ml-auto
                  flex flex-col items-center md:items-end
                  text-center md:text-right
                  px-2 pt-8 md:pt-0
                  md:pr-15 lg:pr-33
                "
              >
                <h1 className="relative font-mrBedfort italic font-bold text-8xl sm:text-9xl md:text-[170px] leading-none text-white mb-1 drop-shadow-2xl">
                  SiSi
                  <span className="absolute left-0 bottom-0 w-full h-6 overflow-hidden hidden md:block">
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

                <h2 className="text-xl md:text-3xl text-white mb-2 drop-shadow-md">
                  BURGER &amp; PANCAKE
                </h2>

                <p className="text-sm md:text-lg max-w-md px-4 md:px-0 leading-snug mb-4 drop-shadow text-white">
                  Najlepsza restauracja z burgerami oraz pancake’ami w Ciechanowie i okolicy!
                </p>

                <a
                  href="#menu"
                  className="
                    px-6 py-2 border border-white rounded-md
                    font-semibold text-white
                    hover:bg-white hover:text-black
                    transition text-sm drop-shadow-md
                  "
                >
                  ZAMÓW TERAZ!
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* 3. Ikony social (desktop) */}
        <div className="hidden md:flex flex-col gap-6 text-white absolute right-4 sm:right-6 top-1/2 -translate-y-1/2 z-20">
          <a href="https://facebook.com" target="_blank" rel="noopener noreferrer" className="hover:scale-110 transition drop-shadow">
            <Facebook className="w-5 h-5" />
          </a>
          <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" className="hover:scale-110 transition drop-shadow">
            <Instagram className="w-5 h-5" />
          </a>
        </div>
      </div>

      {/* MOBILE */}
<div
  className="md:hidden relative w-full min-h-[100svh] text-white flex flex-col pb-[calc(env(safe-area-inset-bottom)+96px)] bg-no-repeat bg-center bg-[length:120%]"
  style={{ backgroundImage: "url('/heromobileburger.jpg')" }}
>
  {/* górny pasek */}
<div
  className="absolute inset-x-0 px-4 flex flex-col items-center"
  style={{ top: "calc(env(safe-area-inset-top) + 50px)" }}
>
  <h1 className="font-mrBedfort italic font-bold text-4xl leading-none">SiSi</h1>
  <h2 className="mt-1 text-xs tracking-widest">BURGER &amp; PANCAKE</h2>
</div>

  {/* slider niżej */}
  <div className="mt-10 px-4">
    <div className="relative w-full h-72 overflow-visible">
      <div
        className="absolute inset-0 transition-transform duration-500 ease-out"
        style={{ transform: `translateX(-${slide * 100}%)` }}
      >
        <div className="flex w-[200%] h-full">
          {/* SLIDE 1: BURGER */}
          <div className="w-1/2 h-full flex items-start justify-center">
            <div className="relative w-full max-w-sm mx-auto">
              <span className="block text-center text-[clamp(44px,18vw,68px)] font-extrabold leading-none z-0 mt-[80px]">
                Burger
              </span>
              <Image
                src="/burgerpng.png"
                alt="Burger"
                width={250}
                height={250}
                className="absolute left-1/2 -translate-x-1/2 top-[90px] z-10 pointer-events-none select-none drop-shadow"
                priority
              />
            </div>
          </div>

          {/* SLIDE 2: PANCAKE */}
          <div className="w-1/2 h-full flex items-start justify-center">
            <div className="relative w-full max-w-sm mx-auto">
              <span className="block text-center text-[clamp(44px,18vw,68px)] font-extrabold leading-none z-0 mt-[80px]">
                Pancake
              </span>
              <Image
                src="/pancakepng.png"
                alt="Pancake"
                width={280}
                height={280}
                className="absolute left-[46%] -translate-x-1/2 top-[80px] z-10 pointer-events-none select-none drop-shadow"
                priority
              />
            </div>
          </div>
        </div>
      </div>

      {/* kropki */}
      <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-2">
        <button
          aria-label="Burger"
          onClick={() => setSlide(0)}
          className={`h-2.5 w-2.5 rounded-full ${slide === 0 ? "bg-white" : "bg-white/40"}`}
        />
        <button
          aria-label="Pancake"
          onClick={() => setSlide(1)}
          className={`h-2.5 w-2.5 rounded-full ${slide === 1 ? "bg-white" : "bg-white/40"}`}
        />
      </div>
    </div>
  </div>

  {/* CTA nad opisem */}
  <div className="mt-6 px-6 text-center">
    <div className="flex gap-3 justify-center">
      <a href="#menu" className="px-4 py-2 bg-white text-black rounded-md font-semibold text-sm">
        Zamów teraz
      </a>
      <a
        href="tel:+48600000000"
        className="px-4 py-2 border border-white rounded-md font-semibold text-sm"
      >
        Zadzwoń
      </a>
    </div>
    <p className="mt-3 text-sm leading-snug">
      Najlepsze burgery i pancake w Ciechanowie i nie tylko!
    </p>
  </div>

  {/* social na mobile */}
  <div className="mt-6 flex items-center justify-center gap-6">
    <a href="https://facebook.com" target="_blank" rel="noopener noreferrer" className="hover:opacity-80">
      <Facebook className="w-5 h-5" />
    </a>
    <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" className="hover:opacity-80">
      <Instagram className="w-5 h-5" />
    </a>
  </div>
</div>

    </section>
  );
}
