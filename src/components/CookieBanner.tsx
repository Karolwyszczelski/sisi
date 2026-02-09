"use client";
import { useEffect, useState } from "react";
import { Cookie, X, Shield, ChevronRight } from "lucide-react";
import Link from "next/link";

const KEY = "cookie-consent-v1";

export default function CookieBanner() {
  const [open, setOpen] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

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
        <div 
          className="absolute inset-0 bg-black/70 backdrop-blur-sm" 
          onClick={() => save({ necessary: true, analytics: false, marketing: false })} 
        />
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-b from-zinc-900 to-black rounded-t-[28px] border-t border-yellow-400/20 p-5 pb-8 animate-slide-up shadow-2xl shadow-black/50">
          {/* Drag indicator */}
          <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-5" />
          
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 bg-gradient-to-br from-yellow-400/20 to-amber-500/10 rounded-2xl flex items-center justify-center border border-yellow-400/20">
                <Cookie className="w-5 h-5 text-yellow-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Ciasteczka</h3>
                <p className="text-xs text-white/50">Twoja prywatność jest dla nas ważna</p>
              </div>
            </div>
            <button 
              onClick={() => save({ necessary: true, analytics: false, marketing: false })}
              className="w-8 h-8 flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 rounded-full transition"
            >
              <X size={18} />
            </button>
          </div>
          
          <p className="text-white/60 text-sm leading-relaxed mb-5">
            Używamy plików cookie, aby zapewnić Ci najlepsze doświadczenia na naszej stronie.
          </p>

          {/* Expandable details */}
          <button 
            onClick={() => setShowDetails(!showDetails)}
            className="w-full flex items-center justify-between text-sm text-white/50 hover:text-white/70 mb-4 transition"
          >
            <span className="flex items-center gap-2">
              <Shield size={14} />
              Szczegóły plików cookie
            </span>
            <ChevronRight className={`w-4 h-4 transition-transform ${showDetails ? 'rotate-90' : ''}`} />
          </button>
          
          {showDetails && (
            <div className="bg-white/5 rounded-xl p-3 mb-4 text-xs text-white/50 space-y-2 border border-white/5">
              <p><span className="text-yellow-400">Niezbędne:</span> Wymagane do działania strony</p>
              <p><span className="text-white/70">Analityczne:</span> Pomagają nam ulepszać stronę</p>
              <p><span className="text-white/70">Marketingowe:</span> Personalizują reklamy</p>
            </div>
          )}
          
          <div className="flex flex-col gap-2.5">
            <button
              onClick={() => save({ necessary: true, analytics: true, marketing: true })}
              className="w-full py-3.5 bg-gradient-to-r from-yellow-400 to-amber-500 text-black rounded-2xl font-bold text-sm hover:from-yellow-300 hover:to-amber-400 transition-all active:scale-[0.98] shadow-lg shadow-yellow-400/20"
            >
              Akceptuj wszystkie
            </button>
            <button
              onClick={() => save({ necessary: true, analytics: false, marketing: false })}
              className="w-full py-3.5 bg-white/5 text-white rounded-2xl font-medium text-sm border border-white/10 hover:bg-white/10 transition-all active:scale-[0.98]"
            >
              Tylko niezbędne
            </button>
          </div>
          
          <p className="text-center text-[11px] text-white/30 mt-4">
            <Link href="/polityka-prywatnosci" className="hover:text-yellow-400 transition">Polityka prywatności</Link>
            {" · "}
            <Link href="/cookies" className="hover:text-yellow-400 transition">Polityka cookies</Link>
          </p>
        </div>
      </div>

      {/* Desktop: Floating card */}
      <div className="hidden md:block fixed bottom-6 left-6 right-6 z-50 pointer-events-none">
        <div className="max-w-3xl mx-auto pointer-events-auto">
          <div className="bg-gradient-to-br from-zinc-900/98 to-black/98 backdrop-blur-xl rounded-2xl border border-white/10 p-5 shadow-2xl shadow-black/50">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-4 flex-1">
                <div className="w-12 h-12 bg-gradient-to-br from-yellow-400/20 to-amber-500/10 rounded-2xl flex items-center justify-center flex-shrink-0 border border-yellow-400/20">
                  <Cookie className="w-6 h-6 text-yellow-400" />
                </div>
                <div>
                  <h3 className="text-white font-semibold mb-0.5">Szanujemy Twoją prywatność</h3>
                  <p className="text-white/50 text-sm">
                    Używamy plików cookie, aby zapewnić Ci najlepsze doświadczenia.{" "}
                    <Link href="/polityka-prywatnosci" className="text-yellow-400 hover:underline">Dowiedz się więcej</Link>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <button
                  onClick={() => save({ necessary: true, analytics: false, marketing: false })}
                  className="px-5 py-2.5 bg-white/5 text-white rounded-xl font-medium text-sm border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all"
                >
                  Tylko niezbędne
                </button>
                <button
                  onClick={() => save({ necessary: true, analytics: true, marketing: true })}
                  className="px-5 py-2.5 bg-gradient-to-r from-yellow-400 to-amber-500 text-black rounded-xl font-bold text-sm hover:from-yellow-300 hover:to-amber-400 transition-all shadow-lg shadow-yellow-400/20"
                >
                  Akceptuj wszystkie
                </button>
              </div>
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
          animation: slide-up 0.35s cubic-bezier(0.16, 1, 0.3, 1);
        }
      `}</style>
    </>
  );
}
