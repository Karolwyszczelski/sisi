// src/components/BurgerMiesiaca.tsx
"use client";

import Image from "next/image";
import { useState, useEffect, useRef } from "react";
import useCartStore from "@/store/cartStore";
import { getSupabaseBrowser } from "@/lib/supabase-browser";
import clsx from "clsx";

const BG_URL = "/graffitiburger2.webp";      // tło desktop/tablet (jak wcześniej)
const MONTH_IMG = "/burgermiesiaca.png";     // burger miesiąca
const HALLOWEEN_IMG = "/halloween.png";      // burger halloween

// Ikony
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

type Slide = "month" | "halloween";

export default function BurgerMiesiaca() {
  const { addItem } = useCartStore();
  const supabase = getSupabaseBrowser();

  const [burgerName, setBurgerName] = useState<string>("");
  const [burgerDesc, setBurgerDesc] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);

  const [slide, setSlide] = useState<Slide>("month");
  const autoTimer = useRef<NodeJS.Timeout | null>(null);
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

  useEffect(() => {
    if (autoTimer.current) clearInterval(autoTimer.current);
    autoTimer.current = setInterval(() => {
      setSlide((s) => (s === "month" ? "halloween" : "month"));
    }, 7000);
    return () => { if (autoTimer.current) clearInterval(autoTimer.current); };
  }, []);

  const addMonth = () => {
    addItem({ name: `Burger Miesiąca – ${burgerName || "—"}`, price: 34.9, quantity: 1 });
    setAdded(true); setTimeout(() => setAdded(false), 1800);
  };
  const addHalloween = () => {
    addItem({ name: "Burger Halloween", price: 34.9, quantity: 1 });
    setAdded(true); setTimeout(() => setAdded(false), 1800);
  };

  const monthPl = new Date().toLocaleDateString("pl-PL", { month: "long" });
  const monthLabel = monthPl.charAt(0).toUpperCase() + monthPl.slice(1);

  const halloweenLines = [
    "Piekielnie dobry sos Sriracha 🌶️",
    "Świeża sałata masłowa i soczysty pomidor",
    "Podwójna moc sera: wyrazisty Cheddar i pomarańczowy Mimolette 🧀",
    "Do wyboru: potężna porcja wołowiny 🥩 lub chrupiący kurczak 🍗",
    "Idealne przełamanie smaku: czerwona cebula i ogórek kiszony.",
  ];

  /** POJEDYNCZY SLAJD — bez tła, przezroczysty */
  const SlideView = ({ kind }: { kind: Slide }) => {
    const isHalloween = kind === "halloween";
    const priceText = "34,90";
    const priceCircleBg = isHalloween ? "bg-orange-500 text-white" : "bg-yellow-400 text-black";
    const imgSrc = isHalloween ? HALLOWEEN_IMG : MONTH_IMG;

    return (
      <div className="flex-none w-screen">
        {/* marginesy jak w Twojej wersji mobile + desktop */}
        <div className="pt-12 px-6 pb-[calc(env(safe-area-inset-bottom)+56px)] md:py-20 md:px-0">
          <div className="relative z-10 max-w-6xl mx-auto md:px-0">
            {/* obraz lewo, opis prawo */}
            <div className="flex flex-col md:flex-row items-center md:items-start gap-8 md:gap-12">
              {/* Obraz + cena + plus (desktop) */}
              <div className="relative w-full md:w-[50%] flex justify-center md:justify-start">
                <div className="relative">
                  <Image
                    src={imgSrc}
                    alt={isHalloween ? "Burger Halloween" : "Burger miesiąca"}
                    width={720}
                    height={600}
                    className="object-contain md:max-h-[520px]"
                    priority
                  />

                  {/* Cena (bez błędnych klas jak -top-50) */}
                  <div
                    className={clsx(
                      "absolute -right-3 -top-3 md:-right-6 md:-top-6 w-20 h-20 md:w-24 md:h-24 rounded-full flex items-center justify-center shadow-xl border border-black/10",
                      priceCircleBg
                    )}
                    aria-label={`Cena ${priceText} zł`}
                  >
                    <div className="text-center leading-tight">
                      <div className="text-sm md:text-base font-bold">{priceText}</div>
                      <div className="text-[10px] md:text-xs opacity-90">zł</div>
                    </div>
                  </div>

                  {/* Plus przy obrazie — tylko desktop (jak wcześniej) */}
                  <button
                    onClick={isHalloween ? addHalloween : addMonth}
                    className={clsx(
                      "hidden md:flex absolute bottom-[170px] left-[50px]",
                      "items-center justify-center rounded-full bg-white text-black shadow-lg transition-all duration-300",
                      added ? "w-40 h-10 px-3" : "w-10 h-10"
                    )}
                    aria-label="Dodaj do koszyka"
                  >
                    <div className="w-8 h-8 flex items-center justify-center rounded-full">{added ? CheckSVG : PlusSVG}</div>
                    {added && <span className="ml-2 text-sm font-semibold whitespace-nowrap">Dodano</span>}
                  </button>
                </div>
              </div>

              {/* Opis — mobile center, desktop left */}
              <div className="w-full md:w-[50%] flex flex-col items-center md:items-start text-center md:text-left md:pt-4">
                {isHalloween ? (
                  <div className="relative mb-3">
                    <span className="absolute -left-2 -top-1 w-6 h-6 bg-orange-500" aria-hidden />
                    <span className="relative z-10 text-[12px] tracking-widest font-extrabold">OFERTA CZASOWA</span>
                  </div>
                ) : (
                  <h3 className="text-[12px] tracking-widest font-bold mb-1">BURGER MIESIĄCA</h3>
                )}

                {isHalloween ? (
                  <>
                    <h2 className="text-[40px] md:text-[56px] leading-none font-extrabold text-orange-400">BURGER HALLOWEEN</h2>
                    <ul className="mt-3 space-y-1 text-sm md:text-base text-orange-100/90">
                      {halloweenLines.map((l, i) => (
                        <li key={i} className="leading-snug">{l}</li>
                      ))}
                    </ul>
                    {/* CTA mobile center */}
                    <button
                      onClick={addHalloween}
                      className="mt-5 inline-flex items-center justify-center rounded-md px-5 py-2 text-sm font-semibold bg-white text-black md:hidden mx-auto"
                    >
                      {added ? (<>{CheckSVG}<span className="ml-2">Dodano</span></>) : (<>{PlusSVG}<span className="ml-2">Dodaj do koszyka</span></>)}
                    </button>
                  </>
                ) : (
                  <>
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
                    {/* CTA mobile center */}
                    <button
                      onClick={addMonth}
                      className="mt-5 inline-flex items-center justify-center rounded-md px-5 py-2 text-sm font-semibold bg-white text-black md:hidden mx-auto"
                    >
                      {added ? (<>{CheckSVG}<span className="ml-2">Dodano</span></>) : (<>{PlusSVG}<span className="ml-2">Dodaj do koszyka</span></>)}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    /**
     * WSPÓLNE TŁO:
     * - mobile: jak wcześniej — BRAK tła (bg-transparent), żadnego overlay
     * - desktop: tło graffiti + przyciemnienie (spójne dla obu slajdów)
     */
    <section className="relative w-full overflow-hidden text-white">
      {/* DESKTOP/TABLET BACKGROUND + overlay */}
      <div className="hidden md:block absolute inset-0 -z-10">
        <Image src={BG_URL} alt="" fill priority className="object-cover" />
        <div className="absolute inset-0 bg-black/80" />
      </div>

      {/* Tor slidera */}
      <div className="relative z-10 w-screen overflow-hidden">
        <div
          className="flex flex-nowrap transition-transform duration-500 ease-out"
          style={{ width: "200vw", transform: `translateX(${slide === "month" ? "0vw" : "-100vw"})` }}
        >
          <SlideView kind="month" />
          <SlideView kind="halloween" />
        </div>

        {/* Nawigacja na dole, na tle (desktop) / na treści (mobile) */}
        <div className="pointer-events-none absolute inset-x-0 bottom-4 z-20">
          <div className="absolute left-4 bottom-0 pointer-events-auto">
            <button
              aria-label="Poprzedni"
              onClick={() => setSlide((s) => (s === "month" ? "halloween" : "month"))}
              className="px-3 py-1 text-xs rounded border border-white/40 text-white/90 hover:bg-white/10"
            >
              ←
            </button>
          </div>
          <div className="absolute right-4 bottom-0 pointer-events-auto">
            <button
              aria-label="Następny"
              onClick={() => setSlide((s) => (s === "month" ? "halloween" : "month"))}
              className="px-3 py-1 text-xs rounded border border-white/40 text-white/90 hover:bg-white/10"
            >
              →
            </button>
          </div>

          <div className="pointer-events-auto flex justify-center gap-2">
            {(["month", "halloween"] as Slide[]).map((k) => (
              <button
                key={k}
                aria-label={k}
                onClick={() => setSlide(k)}
                className={clsx(
                  "w-2.5 h-2.5 rounded-full border",
                  slide === k ? "bg-white border-white" : "bg-transparent border-white/60"
                )}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
