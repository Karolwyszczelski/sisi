"use client";

import Image from "next/image";
import { useState } from "react";
import useCartStore from "@/store/cartStore";

// Ikona plus w formie inline SVG (nic nie zależy od fontu)
const PlusSVG = (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="leading-none"
  >
    <path d="M12 5v14M5 12h14" />
  </svg>
);

// Ikona check (ptaszek) w formie inline SVG
const CheckSVG = (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="leading-none"
  >
    <path d="M5 13l4 4L19 7" />
  </svg>
);

export default function BurgerMiesiaca() {
  const { addItem } = useCartStore();
  const [added, setAdded] = useState(false);

  const handleAddToCart = () => {
    addItem({
      name: "Burger Miesiąca – Azjatycki Twist",
      price: 29,
      quantity: 1,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  return (
    <section
      className="relative w-full text-white py-20 px-0 overflow-hidden max-h-[600px]"
      style={{
        backgroundImage: "url('/graffitiburger2.png')",
        backgroundPosition: "center top",
        backgroundRepeat: "no-repeat",
        backgroundSize: "cover",
        backgroundAttachment: "fixed",
      }}
    >
      {/* 🔲 Przyciemnione tło - takie samo jak w BurgerMiesiaca */}
      <div className="absolute inset-0 bg-black opacity-80 z-0"></div>
      
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-0 relative z-20 mt-[-110px]">
        <div className="w-full md:w-[30%] flex flex-col items-start text-left ml-auto">
          <h3 className="text-x1 text-[34px] font-bold -mb-2 font-montserrat opacity-0 animate-fade-down animate-delay-1">
            BURGER MIESIĄCA
          </h3>
          <h2 className="text-[80px] leading-none text-yellow-400 font-montserrat font-extrabold tracking-tighter mb-[-20px] opacity-0 animate-fade-down animate-delay-2">
            MARZEC
          </h2>
          <p className="italic text-[59px] font-covered mb-0 opacity-0 animate-fade-down animate-delay-3">
            Azjatycki Twist
          </p>
          <p className="text-sm text-[12px] text-yellow-300 leading-snug max-w-md font-montserrat opacity-0 animate-fade-down animate-delay-4">
            bułka, majonez, rukola, piklowane warzywa, wołowina <br />
            lub kurczak, sos Teriyaki, marynowany imbir, kolendra.
          </p>

          {/* PRZYCISK */}
          <button
            onClick={handleAddToCart}
            // W zależności od stanu `added`, szerokość to w-10 albo w-52
            className={`
              relative
              overflow-hidden
              flex items-center justify-center
              h-10
              rounded-full
              bg-white
              text-black
              shadow-lg
              transition-all
              duration-300
              ease-in-out
              mt-6
              ${added ? "w-52" : "w-10"}
            `}
          >
            {/* Środkowy kontener */}
            <div className="flex items-center justify-center px-2 space-x-2">
              {/* Kółko z ikoną plus/check – by mieć pewność, że jest na środku */}
              <div
                className="
                  w-8 h-8
                  flex items-center justify-center
                  bg-white 
                  text-black
                  rounded-full 
                  shadow-inner
                "
              >
                {added ? CheckSVG : PlusSVG}
              </div>

              {/* Tekst pojawia się TYLKO, gdy added = true */}
              {added && (
                <span className="text-sm font-semibold whitespace-nowrap leading-none">
                  Dodano do koszyka
                </span>
              )}
            </div>
          </button>
        </div>

        <div className="w-full md:w-[55%] flex justify-end mt-10 md:mt-0 relative z-30">
          <div className="absolute right-[200px] top-[10%] w-[350px] h-[350px] bg-yellow-400 opacity-30 blur-3xl rounded-full z-0" />
          <Image
            src="/burgermiesiaca.png"
            alt="Burger miesiąca"
            width={700}
            height={600}
            className="object-contain -mr-20 md:-mr-32 animate-slide-in-right z-10"
          />
        </div>
      </div>
    </section>
  );
}
