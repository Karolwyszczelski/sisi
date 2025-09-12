// src/components/BurgerMiesiaca.tsx
"use client";

import Image from "next/image";
import { useState, useEffect } from "react";
import useCartStore from "@/store/cartStore";
import { getSupabaseBrowser } from "@/lib/supabase-browser";

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
  const supabase = getSupabaseBrowser();

  // stan danych z Supabase
  const [burgerName, setBurgerName] = useState<string>("");
  const [burgerDesc, setBurgerDesc] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);

  // stan przycisku
  const [added, setAdded] = useState(false);

  // fetch z tabeli burger_of_month → pola name i description
  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("burger_of_month")
        .select("name, description")
        .eq("id", "current")
        .single();

      if (error) {
        console.error("❌ Błąd pobierania burgera miesiąca:", error.message);
      } else if (data) {
        setBurgerName(data.name);
        setBurgerDesc(data.description);
      }
      setLoading(false);
    })();
  }, [supabase]);

  // Dodawanie do koszyka
  const handleAddToCart = () => {
    addItem({
      name: `Burger Miesiąca – ${burgerName}`,
      price: 29,
      quantity: 1,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  // polska nazwa miesiąca
  const monthPl = new Date().toLocaleDateString("pl-PL", { month: "long" });
  const monthLabel = monthPl.charAt(0).toUpperCase() + monthPl.slice(1);

  return (
    <>
      {/* === wersja mobile === */}
      <div className="block md:hidden">
        <section className="relative w-full bg-transparent text-white pt-12 px-6 pb-[calc(env(safe-area-inset-bottom)+56px)] overflow-hidden">
          {/* treści */}
          <div className="relative z-10 flex flex-col items-center text-center">
            <h3 className="text-[12px] tracking-widest font-bold mb-1">
              BURGER MIESIĄCA
            </h3>

            <h2 className="text-[36px] leading-none font-extrabold text-yellow-400">
              {loading ? "..." : monthLabel.toUpperCase()}
            </h2>

            <p className="italic text-[24px] mt-1">
              {loading ? "Ładowanie..." : burgerName}
            </p>

            <p className="text-[11px] text-yellow-300 leading-snug mt-2 px-2">
              {loading
                ? ""
                : burgerDesc.split("\n").map((line, i) => (
                    <span key={i}>
                      {line}
                      <br />
                    </span>
                  ))}
            </p>

            {/* CTA jak w hero */}
            <button
              onClick={handleAddToCart}
              className={`mt-4 inline-flex items-center justify-center rounded-md px-5 py-2 text-sm font-semibold transition bg-white text-black`}
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

          {/* Obraz burgera miesiąca */}
          <div className="relative z-10 mt-6 flex justify-center">
            <Image
              src="/miesiaca2.png"
              alt="Burger miesiąca"
              width={300}
              height={260}
              className="object-contain"
              priority
            />
          </div>
        </section>
      </div>

      {/* === wersja desktop — BEZ ZMIAN === */}
      <div className="hidden md:block">
        <section
          className="relative w-full text-white py-20 px-0 overflow-hidden max-h-[500px]"
          style={{
            backgroundImage: "url('/graffitiburger2.webp')",
            backgroundPosition: "center top",
            backgroundRepeat: "no-repeat",
            backgroundSize: "cover",
            backgroundAttachment: "fixed",
          }}
        >
          {/* Przyciemnione tło sekcji */}
          <div className="absolute inset-0 bg-black opacity-80 z-0"></div>

          <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between relative z-20 mt-[-110px]">
            {/* Lewa kolumna z opisem */}
            <div className="w-full md:w-[30%] flex flex-col items-start text-left ml-auto">
              <h3 className="text-xl text-[34px] font-bold -mb-2 font-montserrat">
                BURGER MIESIĄCA
              </h3>

              {/* miesiąc */}
              <h2 className="text-[80px] leading-none text-yellow-400 font-montserrat font-extrabold tracking-tighter mb-[-20px]">
                {loading ? "..." : monthLabel.toUpperCase()}
              </h2>

              {/* nazwa burgera */}
              <p className="italic text-[59px] font-covered mb-0">
                {loading ? "Ładowanie..." : burgerName}
              </p>

              {/* opis */}
              <p className="text-sm text-[10px] text-yellow-300 leading-snug max-w-md font-montserrat">
                {loading
                  ? ""
                  : burgerDesc.split("\n").map((line, i) => (
                      <span key={i}>
                        {line}
                        <br />
                      </span>
                    ))}
              </p>
            </div>

            {/* Prawa kolumna z burgerem i przyciskiem */}
            <div className="w-full md:w-[55%] flex justify-end mt-10 md:mt-0 relative z-30">
              {/* dekoracyjny glow */}
              <div className="absolute right-0 top-[10%] w-[350px] h-[350px] bg-yellow-400 opacity-30 blur-3xl rounded-full z-0" />

              {/* Kontener obrazka */}
              <div className="relative">
                <Image
                  src="/burgermiesiaca.png"
                  alt="Burger miesiąca"
                  width={700}
                  height={600}
                  className="object-contain -mr-20 md:-mr-32 animate-slide-in-right z-10"
                />

                {/* Przycisk: absolutnie */}
                <button
                  onClick={handleAddToCart}
                  className={`
                    absolute
                    bottom-[170px] left-[50px]
                    transform translate-x-2 translate-y-2
                    flex items-center justify-center
                    overflow-hidden
                    rounded-full
                    bg-white text-black
                    shadow-lg
                    transition-all duration-300 ease-in-out
                    ${added ? "w-40" : "w-10"} h-10
                    z-20
                  `}
                >
                  <div className="w-8 h-8 flex items-center justify-center rounded-full shadow-inner">
                    {added ? CheckSVG : PlusSVG}
                  </div>
                  {added && (
                    <span className="ml-2 text-sm font-semibold whitespace-nowrap leading-none">
                      Dodano
                    </span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
