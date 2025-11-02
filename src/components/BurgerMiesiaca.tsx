// src/components/BurgerMiesiaca.tsx
"use client";

import Image from "next/image";
import { useState, useEffect } from "react";
import useCartStore from "@/store/cartStore";
import { getSupabaseBrowser } from "@/lib/supabase-browser";
import clsx from "clsx";

const BG_DESKTOP = "/graffitiburger2.webp";     // tło desktop/tablet
const BG_MOBILE  = "/heromobileburger.jpg";     // tło mobile jak wcześniej
const MONTH_IMG  = "/halloween.png";            // obraz burgera miesiąca

const PlusSVG = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 5v14M5 12h14" />
  </svg>
);
const CheckSVG = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 13l4 4L19 7" />
  </svg>
);

export default function BurgerMiesiaca() {
  const { addItem } = useCartStore();
  const supabase = getSupabaseBrowser();

  const [burgerName, setBurgerName] = useState("");
  const [burgerDesc, setBurgerDesc] = useState("");
  const [loading, setLoading] = useState(true);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("burger_of_month")
        .select("name, description")
        .eq("id", "current")
        .single();
      if (!error && data) {
        setBurgerName(data.name);
        setBurgerDesc(data.description);
      } else if (error) {
        console.error("burger_of_month:", error.message);
      }
      setLoading(false);
    })();
  }, [supabase]);

  const addMonth = () => {
    addItem({ name: `Burger Miesiąca – ${burgerName || "—"}`, price: 34.9, quantity: 1 });
    setAdded(true);
    setTimeout(() => setAdded(false), 1800);
  };

  const monthPl = new Date().toLocaleDateString("pl-PL", { month: "long" });
  const monthLabel = monthPl.charAt(0).toUpperCase() + monthPl.slice(1);

  return (
    <section className="burger-sec relative w-full overflow-hidden text-white">
      <div className="overlay" />

      <div className="relative z-10 max-w-6xl mx-auto px-6 md:px-0 pt-12 pb-[calc(env(safe-area-inset-bottom)+56px)] md:py-20">
        <div className="flex flex-col md:flex-row items-center md:items-start gap-8 md:gap-12">
          {/* Obraz + cena + plus (desktop) */}
          <div className="relative w-full md:w-[50%] flex justify-center md:justify-start">
            <div className="relative">
              <Image
                src={MONTH_IMG}
                alt="Burger miesiąca"
                width={720}
                height={600}
                className="object-contain md:max-h-[520px]"
                priority
              />

              {/* Cena */}
              <div className="absolute -right-3 -top-3 md:-right-6 md:-top-6 w-20 h-20 md:w-24 md:h-24 rounded-full flex items-center justify-center shadow-xl border border-black/10 bg-yellow-400 text-black">
                <div className="text-center leading-tight">
                  <div className="text-sm md:text-base font-bold">34,90</div>
                  <div className="text-[10px] md:text-xs opacity-90">zł</div>
                </div>
              </div>

              {/* Plus – tylko desktop */}
              <button
                onClick={addMonth}
                className={clsx(
                  "hidden md:flex absolute bottom-[170px] left-[50px]",
                  "items-center justify-center rounded-full bg-white text-black shadow-lg transition-all duration-300",
                  added ? "w-40 h-10 px-3" : "w-10 h-10"
                )}
                aria-label="Dodaj do koszyka"
              >
                <div className="w-8 h-8 flex items-center justify-center rounded-full">
                  {added ? CheckSVG : PlusSVG}
                </div>
                {added && <span className="ml-2 text-sm font-semibold whitespace-nowrap">Dodano</span>}
              </button>
            </div>
          </div>

          {/* Opis — mobile center, desktop left */}
          <div className="w-full md:w-[50%] flex flex-col items-center md:items-start text-center md:text-left md:pt-4">
            <h3 className="text-[12px] tracking-widest font-bold mb-1">BURGER MIESIĄCA</h3>
            <h2 className="text-[36px] md:text-[56px] leading-none font-extrabold text-yellow-400">
              {loading ? "…" : monthLabel.toUpperCase()}
            </h2>
            <p className="italic text-[28px] md:text-[40px] mt-1">{loading ? "Ładowanie…" : burgerName}</p>
            <p className="text-[11px] md:text-sm text-yellow-300 leading-snug mt-2 md:max-w-md">
              {loading
                ? ""
                : burgerDesc.split("\n").map((line, i) => (
                    <span key={i}>
                      {line}
                      <br />
                    </span>
                  ))}
            </p>

            {/* CTA mobile */}
            <button
              onClick={addMonth}
              className="mt-5 inline-flex items-center justify-center rounded-md px-5 py-2 text-sm font-semibold bg-white text-black md:hidden mx-auto"
            >
              {added ? (
                <>
                  {CheckSVG}
                  <span className="ml-2">Dodano</span>
                </>
              ) : (
                <>
                  {PlusSVG}
                  <span className="ml-2">Dodaj do koszyka</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* różne tła dla mobile i desktop; desktop z fixed dla ciągłości z następną sekcją */}
      <style jsx>{`
        .burger-sec {
          background-image: url('${BG_MOBILE}');
          background-position: center top;
          background-repeat: no-repeat;
          background-size: cover;
          background-attachment: fixed;
        }
        @media (min-width: 768px) {
          .burger-sec {
            background-image: url('${BG_DESKTOP}');
          }
        }
        .overlay {
          position: absolute;
          inset: 0;
          background: rgba(0, 0, 0, 0.8);
          pointer-events: none;
        }
      `}</style>
    </section>
  );
}
