// src/components/BurgerMiesiaca.tsx
"use client";

import Image from "next/image";
import { useState, useEffect, useMemo } from "react";
import useCartStore from "@/store/cartStore";
import { getSupabaseBrowser } from "@/lib/supabase-browser";
import clsx from "clsx";

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

// Latające składniki burgerów - rozrzucone po całym ekranie
const FloatingIngredients = () => {
  const ingredients = [
    // Górny rząd
    { emoji: "🍅", size: "text-5xl md:text-6xl", delay: "0s", duration: "25s", left: "5%", top: "3%" },
    { emoji: "🧀", size: "text-4xl md:text-5xl", delay: "2s", duration: "22s", left: "25%", top: "8%" },
    { emoji: "🥬", size: "text-5xl md:text-6xl", delay: "1s", duration: "28s", left: "55%", top: "2%" },
    { emoji: "🍔", size: "text-4xl md:text-5xl", delay: "3s", duration: "24s", left: "80%", top: "6%" },
    
    // Środkowy-górny
    { emoji: "🧅", size: "text-4xl md:text-5xl", delay: "1.5s", duration: "26s", left: "8%", top: "28%" },
    { emoji: "🌶️", size: "text-5xl md:text-6xl", delay: "4s", duration: "23s", left: "35%", top: "22%" },
    { emoji: "🥓", size: "text-4xl md:text-5xl", delay: "2.5s", duration: "27s", left: "70%", top: "25%" },
    { emoji: "🥒", size: "text-5xl md:text-6xl", delay: "0.5s", duration: "25s", left: "92%", top: "30%" },
    
    // Środek
    { emoji: "🍳", size: "text-4xl md:text-5xl", delay: "3.5s", duration: "24s", left: "3%", top: "50%" },
    { emoji: "🥑", size: "text-5xl md:text-6xl", delay: "1.8s", duration: "29s", left: "18%", top: "55%" },
    { emoji: "🧄", size: "text-4xl md:text-5xl", delay: "4.5s", duration: "22s", left: "45%", top: "48%" },
    { emoji: "🫒", size: "text-4xl md:text-5xl", delay: "2.8s", duration: "26s", left: "75%", top: "52%" },
    { emoji: "🥬", size: "text-5xl md:text-6xl", delay: "0.8s", duration: "28s", left: "95%", top: "55%" },
    
    // Dolny-środkowy
    { emoji: "🍅", size: "text-4xl md:text-5xl", delay: "2.2s", duration: "25s", left: "6%", top: "75%" },
    { emoji: "🧀", size: "text-5xl md:text-6xl", delay: "3.8s", duration: "23s", left: "30%", top: "78%" },
    { emoji: "🥓", size: "text-4xl md:text-5xl", delay: "1.2s", duration: "27s", left: "60%", top: "72%" },
    { emoji: "🌶️", size: "text-5xl md:text-6xl", delay: "4.2s", duration: "24s", left: "88%", top: "76%" },
    
    // Dolny rząd
    { emoji: "🥑", size: "text-4xl md:text-5xl", delay: "0.3s", duration: "26s", left: "12%", top: "92%" },
    { emoji: "🍔", size: "text-5xl md:text-6xl", delay: "2.7s", duration: "28s", left: "42%", top: "88%" },
    { emoji: "🥒", size: "text-4xl md:text-5xl", delay: "3.3s", duration: "25s", left: "68%", top: "94%" },
    { emoji: "🧅", size: "text-5xl md:text-6xl", delay: "1.7s", duration: "23s", left: "93%", top: "90%" },
  ];

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {ingredients.map((item, i) => (
        <span
          key={i}
          className={clsx(
            "absolute opacity-40",
            item.size,
            "animate-float"
          )}
          style={{
            left: item.left,
            top: item.top,
            animationDelay: item.delay,
            animationDuration: item.duration,
          }}
        >
          {item.emoji}
        </span>
      ))}
    </div>
  );
};

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
    <section className="relative w-full overflow-hidden text-white">
      {/* Tło sekcji */}
      <div className="absolute inset-0 bg-black" />
      <div className="absolute inset-0 bg-gradient-to-b from-zinc-900/50 via-black to-black" />
      
      {/* Subtelne świecące akcenty */}
      <div className="absolute top-1/4 left-0 w-80 h-80 bg-yellow-500/5 rounded-full blur-[100px]" />
      <div className="absolute bottom-1/4 right-0 w-96 h-96 bg-orange-500/5 rounded-full blur-[120px]" />
      
      {/* Latające składniki - tylko desktop */}
      <div className="hidden md:block">
        <FloatingIngredients />
      </div>

      {/* MOBILE VIEW */}
      <div className="md:hidden relative z-10 px-5 py-6 pb-28">
        {/* Hero section z burgerem */}
        <div className="relative">
          {/* Badge limitowana edycja */}
          <div className="flex justify-center mb-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-yellow-400/30 bg-yellow-400/10 px-4 py-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-yellow-400"></span>
              </span>
              <span className="text-[10px] font-bold tracking-[0.2em] text-yellow-400 uppercase">
                Limitowana edycja
              </span>
            </div>
          </div>

          {/* Grafika burgera */}
          <div className="relative mx-auto w-64 h-64 mb-6">
            {/* Świecący ring */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-full h-full rounded-full bg-gradient-to-r from-yellow-500/20 via-orange-500/15 to-red-500/20 blur-2xl" />
            </div>
            
            {/* Dekoracyjne pierścienie */}
            <div className="absolute inset-4 rounded-full border border-white/5" />
            <div className="absolute inset-8 rounded-full border border-yellow-400/10" />
            
            <Image
              src={MONTH_IMG}
              alt="Burger miesiąca"
              width={280}
              height={280}
              priority
              className="relative z-10 h-full w-full object-contain drop-shadow-2xl animate-float-slow"
            />

            {/* Badge z ceną - absolutny na burgerze */}
            <div className="absolute -right-2 top-4 z-20">
              <div className="relative">
                <div className="absolute inset-0 bg-yellow-400 rounded-2xl blur-md opacity-50" />
                <div className="relative bg-gradient-to-br from-yellow-400 to-amber-500 rounded-2xl px-4 py-2 shadow-xl">
                  <div className="text-black font-black text-xl leading-none">
                    34,90<span className="text-[10px] font-bold ml-0.5">zł</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Miesiąc i nazwa */}
          <div className="text-center mb-6">
            <span className="text-white/40 text-[10px] font-semibold tracking-[0.25em] uppercase block mb-1">
              Edycja · {loading ? "..." : monthLabel}
            </span>
            <h2 className="text-3xl font-black text-white leading-tight">
              BURGER <span className="text-yellow-400">MIESIĄCA</span>
            </h2>
            <p className="mt-2 text-xl font-bold text-yellow-400 italic">
              {loading ? "Ładowanie…" : `„${burgerName || "—"}"`}
            </p>
          </div>
        </div>

        {/* Składniki - karty */}
        {descLines.length > 0 && (
          <div className="mb-6">
            <p className="text-[10px] font-semibold tracking-[0.2em] text-white/40 uppercase mb-3 text-center">
              Co w środku?
            </p>
            <div className="grid grid-cols-2 gap-2">
              {descLines.map((line, i) => (
                <div 
                  key={i} 
                  className="flex items-center gap-3 px-4 py-3 rounded-xl bg-zinc-900 border border-white/5"
                >
                  <span className="w-2 h-2 rounded-full bg-yellow-400 flex-shrink-0"></span>
                  <span className="text-white/80 text-sm">{line}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Info o dostępności */}
        <div className="bg-gradient-to-r from-yellow-400/10 to-orange-400/10 border border-yellow-400/20 rounded-2xl p-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-yellow-400/20 flex items-center justify-center flex-shrink-0">
              <span className="text-lg">⏰</span>
            </div>
            <div>
              <p className="text-white font-semibold text-sm">Tylko do końca miesiąca!</p>
              <p className="text-white/50 text-xs">Nie przegap tej wyjątkowej kompozycji smaków</p>
            </div>
          </div>
        </div>

        {/* Duży przycisk CTA */}
        <button
          onClick={addMonth}
          className={clsx(
            "w-full relative overflow-hidden rounded-2xl px-6 py-5 text-lg font-bold",
            "bg-gradient-to-r from-yellow-400 to-amber-500 text-black",
            "active:scale-[0.98] transition-transform shadow-lg shadow-yellow-500/20",
            "flex items-center justify-center gap-3"
          )}
          aria-label="Dodaj burger miesiąca do koszyka"
        >
          <span className="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-black/10">
            {added ? CheckSVG : PlusSVG}
          </span>
          <span>{added ? "Dodano do koszyka! 🎉" : "Dodaj do koszyka"}</span>
        </button>
      </div>

      {/* DESKTOP VIEW */}
      <div className="hidden md:block relative z-10 mx-auto max-w-6xl px-5 py-16 md:px-8 md:py-24">
        {/* Nagłówek sekcji */}
        <div className="text-center mb-12 md:mb-16">
          <div className="inline-flex items-center gap-2 rounded-full border border-yellow-400/30 bg-yellow-400/10 px-4 py-2 mb-4">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-yellow-400"></span>
            </span>
            <span className="text-xs font-bold tracking-[0.2em] text-yellow-400 uppercase">
              Limitowana edycja
            </span>
          </div>
          <h2 className="text-4xl md:text-6xl font-black tracking-tight">
            BURGER <span className="text-yellow-400">MIESIĄCA</span>
          </h2>
          <p className="mt-3 text-white/60 text-sm md:text-base max-w-md mx-auto">
            Wyjątkowa kompozycja smaków dostępna tylko przez ograniczony czas
          </p>
        </div>

        <div className="flex flex-col items-center gap-10 lg:flex-row lg:items-center lg:gap-16">
          {/* Burger - lewa strona */}
          <div className="relative w-full lg:w-1/2">
            <div className="relative mx-auto max-w-[420px] lg:max-w-[480px]">
              {/* Świecący ring za burgerem */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-[80%] h-[80%] rounded-full bg-gradient-to-r from-yellow-500/15 via-orange-500/10 to-red-500/15 blur-3xl" />
              </div>
              
              {/* Dekoracyjny pierścień */}
              <div className="absolute inset-8 rounded-full border border-white/5" />
              <div className="absolute inset-16 rounded-full border border-yellow-400/10" />
              
              <Image
                src={MONTH_IMG}
                alt="Burger miesiąca"
                width={480}
                height={480}
                priority
                className="relative z-10 h-auto w-full object-contain drop-shadow-2xl animate-float-slow"
              />

              {/* Badge z ceną */}
              <div className="absolute right-0 top-4 md:right-0 md:top-8 z-20">
                <div className="relative">
                  <div className="absolute inset-0 bg-yellow-400 rounded-2xl blur-lg opacity-40" />
                  <div className="relative bg-gradient-to-br from-yellow-400 to-yellow-500 rounded-2xl px-4 py-2.5 shadow-2xl border border-yellow-300/20">
                    <div className="text-black font-black text-lg md:text-xl leading-none">
                      34,90<span className="text-xs font-bold ml-0.5">zł</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Treść - prawa strona */}
          <div className="w-full lg:w-1/2 text-center lg:text-left">
            {/* Miesiąc */}
            <div>
              <span className="text-white/40 text-xs font-semibold tracking-[0.2em] uppercase">
                Edycja
              </span>
              <h3 className="text-5xl md:text-6xl lg:text-7xl font-black leading-none tracking-tight text-white">
                {loading ? "…" : monthLabel.toUpperCase()}
              </h3>
            </div>

            {/* Nazwa burgera */}
            <p className="mt-3 text-2xl md:text-3xl lg:text-4xl font-bold text-yellow-400 italic">
              {loading ? "Ładowanie…" : `„${burgerName || "—"}"`}
            </p>

            {/* Składniki - tagi */}
            {descLines.length > 0 && (
              <div className="mt-8">
                <p className="text-xs font-semibold tracking-[0.15em] text-white/40 uppercase mb-4 text-center lg:text-left">
                  Składniki
                </p>
                <div className="flex flex-wrap gap-2 justify-center lg:justify-start">
                  {descLines.map((line, i) => (
                    <span 
                      key={i} 
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 text-white/90 text-sm"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-yellow-400"></span>
                      {line}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Przycisk */}
            <div className="mt-8 flex justify-center lg:justify-start">
              <button
                onClick={addMonth}
                className={clsx(
                  "group relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-full px-8 py-4 text-base font-bold",
                  "bg-gradient-to-r from-yellow-400 to-yellow-500 text-black",
                  "hover:from-yellow-300 hover:to-yellow-400 hover:shadow-[0_0_30px_rgba(251,191,36,0.3)]",
                  "transition-all duration-300 active:scale-[0.98]"
                )}
                aria-label="Dodaj burger miesiąca do koszyka"
              >
                <span className="inline-flex items-center justify-center">
                  {added ? CheckSVG : PlusSVG}
                </span>
                <span>{added ? "Dodano!" : "Dodaj do koszyka"}</span>
              </button>
            </div>

            {/* Dodatkowe info */}
            <p className="mt-4 text-xs text-white/30 text-center lg:text-left">
              ⏰ Dostępny tylko do końca miesiąca
            </p>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes float {
          0%, 100% {
            transform: translateY(0px) rotate(0deg);
          }
          25% {
            transform: translateY(-20px) rotate(5deg);
          }
          50% {
            transform: translateY(-10px) rotate(-3deg);
          }
          75% {
            transform: translateY(-25px) rotate(3deg);
          }
        }
        
        @keyframes float-slow {
          0%, 100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-15px);
          }
        }
        
        :global(.animate-float) {
          animation: float 20s ease-in-out infinite;
        }
        
        :global(.animate-float-slow) {
          animation: float-slow 4s ease-in-out infinite;
        }
      `}</style>
    </section>
  );
}
