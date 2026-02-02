// src/components/BurgerMiesiaca.tsx
"use client";

import Image from "next/image";
import { useState, useEffect, useMemo } from "react";
import useCartStore from "@/store/cartStore";
import { getSupabaseBrowser } from "@/lib/supabase-browser";
import clsx from "clsx";

const BG_DESKTOP = "/graffitiburger2.webp";   // desktop/tablet (zostaje)
const BG_MOBILE = "/backgroundsisi.jpg";      // mobile: ma być backgroundsisi.jpg
const MONTH_IMG = "/halloween.svg";           // obraz burgera miesiąca

const PlusSVG = (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M12 5v14M5 12h14" />
  </svg>
);

const CheckSVG = (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
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
        setBurgerName(data.name || "");
        setBurgerDesc(data.description || "");
      } else if (error) {
        console.error("burger_of_month:", error.message);
      }
      setLoading(false);
    })();
  }, [supabase]);

  const addMonth = () => {
    addItem({
      name: `Burger Miesiąca – ${burgerName || "—"}`,
      price: 34.9,
      quantity: 1,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 1600);
  };

  const monthLabel = useMemo(() => {
    const monthPl = new Date().toLocaleDateString("pl-PL", { month: "long" });
    return monthPl.charAt(0).toUpperCase() + monthPl.slice(1);
  }, []);

  const descLines = useMemo(() => {
    if (!burgerDesc) return [];
    return burgerDesc.split("\n").map((l) => l.trim()).filter(Boolean);
  }, [burgerDesc]);

  return (
    <section className="burger-sec relative w-full overflow-hidden text-white">
      {/* Przyciemnienie jak w sekcji MENU (bez glassa) */}
      <div className="overlay" />

      <div className="relative z-10 mx-auto max-w-6xl px-5 pt-12 pb-[calc(env(safe-area-inset-bottom)+56px)] md:px-0 md:py-20">
        <div className="flex flex-col items-center gap-8 md:flex-row md:items-center md:gap-12">
          {/* Burger (mniejszy) */}
          <div className="relative w-full md:w-[52%]">
            <div className="relative mx-auto w-full max-w-[520px] md:mx-0 md:max-w-none">
              <div
                className={clsx(
                  // lekkie dociągnięcie w stronę tekstów (ale bez uciekania poza ekran)
                  "relative",
                  "md:translate-x-20"
                )}
              >
                <Image
                  src={MONTH_IMG}
                  alt="Burger miesiąca"
                  width={640}
                  height={520}
                  priority
                  className={clsx(
                    "h-auto w-full object-contain",
                    // mniejszy na desktop
                    "md:max-h-[420px] md:w-auto"
                  )}
                />

                {/* Cena (minimalistycznie) */}
                <div className="absolute left-3 top-3 md:left-6 md:top-6 rounded-full bg-white/95 px-4 py-2 text-black shadow-lg">
                  <div className="text-[16px] font-extrabold leading-none md:text-[18px]">
                    34,90
                    <span className="ml-1 text-[12px] font-semibold opacity-80">zł</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Teksty (bez tła) + CTA pod opisem */}
          <div className="w-full md:w-[48%]">
            <div className="text-center md:text-left">
              <div className="inline-flex items-center rounded-full border border-white/25 px-3 py-1 text-[11px] font-bold tracking-[0.22em]">
                BURGER MIESIĄCA
              </div>

              <h2 className="mt-4 text-[34px] font-extrabold leading-[0.95] md:text-[56px]">
                {loading ? "…" : monthLabel.toUpperCase()}
              </h2>

              <p className="mt-2 text-[22px] font-semibold italic text-yellow-300 md:text-[34px]">
                {loading ? "Ładowanie…" : burgerName || "—"}
              </p>

              {descLines.length > 0 && (
                <div className="mt-4 space-y-2 text-[13px] leading-relaxed text-white/90 md:text-[15px]">
                  {descLines.map((line, i) => (
                    <p key={i}>{line}</p>
                  ))}
                </div>
              )}

              <button
                onClick={addMonth}
                className={clsx(
                  "mt-6 inline-flex items-center justify-center gap-2 rounded-md px-5 py-3 text-sm font-semibold",
                  "bg-white text-black hover:bg-white/90 active:scale-[0.99] transition",
                  "w-full md:w-auto"
                )}
                aria-label="Dodaj burger miesiąca do koszyka"
              >
                <span className="inline-flex items-center justify-center">
                  {added ? CheckSVG : PlusSVG}
                </span>
                <span>{added ? "Dodano do koszyka" : "Dodaj do koszyka"}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .burger-sec {
          background-image: url("${BG_MOBILE}");
          background-position: center top;
          background-repeat: no-repeat;
          background-size: cover;
          background-attachment: scroll; /* mobile */
        }

        @media (min-width: 768px) {
          .burger-sec {
            background-image: url("${BG_DESKTOP}");
            background-attachment: fixed; /* desktop jak wcześniej */
            background-position: center center;
          }
        }

        .overlay {
          position: absolute;
          inset: 0;
          /* przyciemnienie podobne do MENU: równe + delikatna winieta */
          background: radial-gradient(
              1200px 700px at 65% 55%,
              rgba(0, 0, 0, 0.35),
              rgba(0, 0, 0, 0.82)
            ),
            rgba(0, 0, 0, 0.55);
          pointer-events: none;
        }
      `}</style>
    </section>
  );
}
