"use client";

import Image from "next/image";
import { useState } from "react";
import useCartStore from "@/store/cartStore";

// Ikona plus (SVG)
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

// Ikona check (SVG)
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
      {/* Przejście – fala z obrazkiem z poprzedniej sekcji (Hero) */}
      <div
        className="absolute top-0 left-0 w-full h-[150px] z-10"
        style={{
          backgroundImage: "url('/tloburger.png')", // ten sam obrazek co w Hero
          backgroundSize: "120%",
          backgroundPosition: "right- 700 px",
          backgroundRepeat: "no-repeat",
          animation: "gentleShake2 5s ease-in-out infinite",
          // Przykładowy kształt fali – możesz wygenerować własny np. na getwaves.io
          clipPath: "path('M1440,0 L0,0 C300,100,1140,100,1440,0 Z')",
        }}
      ></div>

      {/* Przyciemnione tło sekcji Burger Miesiąca */}
      <div className="absolute inset-0 bg-black opacity-80 z-0"></div>

      {/* Treść sekcji – przesunięta w dół, aby efekt fali był widoczny */}
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-0 relative z-20 mt-[-110px]">
        <div className="w-full md:w-[30%] flex flex-col items-start text-left ml-auto">
          <h3 className="text-x1 text-[34px] font-bold -mb-2 font-montserrat">
            BURGER MIESIĄCA
          </h3>
          <h2 className="text-[80px] leading-none text-yellow-400 font-montserrat font-extrabold tracking-tighter mb-[-20px]">
            MARZEC
          </h2>
          <p className="italic text-[59px] font-covered mb-0">
            Azjatycki Twist
          </p>
          <p className="text-sm text-[10px] text-yellow-300 leading-snug max-w-md font-montserrat">
            bułka, majonez, rukola, piklowane warzywa, wołowina <br />
            lub kurczak, sos Teriyaki, marynowany imbir, kolendra.
          </p>

          {/* PRZYCISK */}
          <button
            onClick={handleAddToCart}
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
            <div className="flex items-center justify-center px-2 space-x-2">
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
              {added && (
                <span className="text-sm font-semibold whitespace-nowrap leading-none">
                  Dodano do koszyka
                </span>
              )}
            </div>
          </button>
        </div>

        <div className="w-full md:w-[55%] flex justify-end mt-10 md:mt-0 relative z-30">
          <div className="absolute right-[00px] top-[10%] w-[350px] h-[350px] bg-yellow-400 opacity-30 blur-3xl rounded-full z-0" />
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
