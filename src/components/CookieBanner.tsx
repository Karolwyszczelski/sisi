"use client";
import { useEffect, useState } from "react";
import { Cookie, X } from "lucide-react";

const KEY = "cookie-consent-v1";

export default function CookieBanner() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const v = localStorage.getItem(KEY);
    if (!v) setOpen(true);
  }, []);

  if (!open) return null;

  const save = (prefs: { necessary: boolean; analytics: boolean; marketing: boolean }) => {
    localStorage.setItem(KEY, JSON.stringify(prefs));
    setOpen(false);
  };

  return (
    <>
      {/* Mobile: Bottom sheet modal */}
      <div className="md:hidden fixed inset-0 z-50">
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => save({ necessary: true, analytics: false, marketing: false })} />
        <div className="absolute bottom-0 left-0 right-0 bg-zinc-900 rounded-t-3xl border-t border-white/10 p-6 animate-slide-up">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-yellow-400/10 rounded-full flex items-center justify-center">
                <Cookie className="w-5 h-5 text-yellow-400" />
              </div>
              <h3 className="text-lg font-bold text-white">Ciasteczka 🍪</h3>
            </div>
            <button 
              onClick={() => save({ necessary: true, analytics: false, marketing: false })}
              className="w-8 h-8 flex items-center justify-center text-white/60 hover:text-white transition"
            >
              <X size={20} />
            </button>
          </div>
          
          <p className="text-white/70 text-sm mb-4">
            Używamy plików cookie, aby zapewnić Ci najlepsze doświadczenia.{" "}
            <a href="/polityka-prywatnosci" className="text-yellow-400 underline">Polityka prywatności</a>
          </p>
          
          <div className="flex flex-col gap-2">
            <button
              onClick={() => save({ necessary: true, analytics: true, marketing: true })}
              className="w-full py-3 bg-white text-black rounded-xl font-semibold text-sm hover:bg-white/90 transition"
            >
              Akceptuj wszystkie
            </button>
            <button
              onClick={() => save({ necessary: true, analytics: false, marketing: false })}
              className="w-full py-3 bg-zinc-800 text-white rounded-xl font-medium text-sm border border-white/10 hover:bg-zinc-700 transition"
            >
              Tylko niezbędne
            </button>
          </div>
        </div>
      </div>

      {/* Desktop: Bottom bar */}
      <div className="hidden md:block fixed inset-x-0 bottom-0 z-50">
        <div className="bg-zinc-900/95 backdrop-blur-md border-t border-white/10 p-4 shadow-2xl">
          <div className="mx-auto flex max-w-4xl items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-yellow-400/10 rounded-full flex items-center justify-center flex-shrink-0">
                <Cookie className="w-5 h-5 text-yellow-400" />
              </div>
              <p className="text-white/70 text-sm">
                Używamy plików cookie, aby zapewnić Ci najlepsze doświadczenia.{" "}
                <a href="/polityka-prywatnosci" className="text-yellow-400 hover:underline">Polityka prywatności</a>
              </p>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <button
                onClick={() => save({ necessary: true, analytics: false, marketing: false })}
                className="px-4 py-2 bg-zinc-800 text-white rounded-xl font-medium text-sm border border-white/10 hover:bg-zinc-700 transition"
              >
                Tylko niezbędne
              </button>
              <button
                onClick={() => save({ necessary: true, analytics: true, marketing: true })}
                className="px-4 py-2 bg-white text-black rounded-xl font-semibold text-sm hover:bg-white/90 transition"
              >
                Akceptuj wszystkie
              </button>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes slide-up {
          from {
            transform: translateY(100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
      `}</style>
    </>
  );
}
