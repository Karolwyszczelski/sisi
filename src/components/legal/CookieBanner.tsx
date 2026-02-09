"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Cookie, X, Shield, ChevronDown } from "lucide-react";

const KEY = "cookie_consent_v1";

type Consent = {
  necessary: true;
  analytics: boolean;
  marketing: boolean;
};

export default function CookieBanner() {
  const [open, setOpen] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) setOpen(true);
      else setOpen(false);
    } catch { setOpen(true); }
  }, []);

  const save = (c: Consent) => {
    try {
      localStorage.setItem(KEY, JSON.stringify(c));
      if (c.analytics) {
        // Tutaj GA/Tag Manager jeśli potrzebny
      }
    } catch {}
    setOpen(false);
  };

  if (!open) return null;

  return (
    <>
      {/* Mobile: Bottom sheet modal - podobny do koszyka/panelu */}
      <div className="md:hidden fixed inset-0 z-[60]">
        {/* Overlay */}
        <div 
          className="absolute inset-0 bg-black/80 backdrop-blur-sm" 
          onClick={() => save({ necessary: true, analytics: false, marketing: false })} 
        />
        
        {/* Bottom Sheet */}
        <div className="absolute bottom-0 left-0 right-0 bg-zinc-900 rounded-t-[24px] border-t border-white/10 animate-slide-up safe-area-bottom">
          {/* Drag indicator */}
          <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto mt-3 mb-4" />
          
          {/* Header */}
          <div className="flex items-center justify-between px-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-yellow-400 to-amber-500 rounded-2xl flex items-center justify-center shadow-lg shadow-yellow-400/20">
                <Cookie className="w-6 h-6 text-black" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Ciasteczka 🍪</h3>
                <p className="text-xs text-white/50">Twoja prywatność ma znaczenie</p>
              </div>
            </div>
            <button 
              onClick={() => save({ necessary: true, analytics: false, marketing: false })}
              className="w-10 h-10 flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 rounded-xl transition"
            >
              <X size={20} />
            </button>
          </div>
          
          {/* Content */}
          <div className="px-5 pb-6">
            <p className="text-white/60 text-sm leading-relaxed mb-5">
              Używamy plików cookie, aby strona działała poprawnie i mogliśmy ją ulepszać.
            </p>

            {/* Expandable details */}
            <button 
              onClick={() => setShowDetails(!showDetails)}
              className="w-full flex items-center justify-between text-sm text-white/50 hover:text-white/70 mb-4 py-2 transition"
            >
              <span className="flex items-center gap-2">
                <Shield size={16} />
                Szczegóły plików cookie
              </span>
              <ChevronDown className={`w-5 h-5 transition-transform duration-200 ${showDetails ? 'rotate-180' : ''}`} />
            </button>
            
            {showDetails && (
              <div className="bg-white/5 rounded-2xl p-4 mb-5 text-sm text-white/60 space-y-3 border border-white/5">
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-yellow-400 mt-1.5 flex-shrink-0" />
                  <div>
                    <span className="text-yellow-400 font-medium">Niezbędne</span>
                    <p className="text-xs text-white/40 mt-0.5">Wymagane do działania strony</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-white/30 mt-1.5 flex-shrink-0" />
                  <div>
                    <span className="text-white/70 font-medium">Analityczne</span>
                    <p className="text-xs text-white/40 mt-0.5">Pomagają nam ulepszać stronę</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-white/30 mt-1.5 flex-shrink-0" />
                  <div>
                    <span className="text-white/70 font-medium">Marketingowe</span>
                    <p className="text-xs text-white/40 mt-0.5">Personalizują reklamy</p>
                  </div>
                </div>
              </div>
            )}
            
            {/* Buttons */}
            <div className="flex flex-col gap-3">
              <button
                onClick={() => save({ necessary: true, analytics: true, marketing: true })}
                className="w-full py-4 bg-gradient-to-r from-yellow-400 to-amber-500 text-black rounded-2xl font-bold text-base hover:from-yellow-300 hover:to-amber-400 transition-all active:scale-[0.98] shadow-lg shadow-yellow-400/25"
              >
                Akceptuj wszystkie
              </button>
              <button
                onClick={() => save({ necessary: true, analytics: false, marketing: false })}
                className="w-full py-4 bg-white/5 text-white rounded-2xl font-medium text-base border border-white/10 hover:bg-white/10 transition-all active:scale-[0.98]"
              >
                Tylko niezbędne
              </button>
            </div>
            
            {/* Links */}
            <p className="text-center text-xs text-white/30 mt-5">
              <Link href="/polityka-prywatnosci" className="hover:text-yellow-400 transition underline">Polityka prywatności</Link>
              <span className="mx-2">•</span>
              <Link href="/cookies" className="hover:text-yellow-400 transition underline">Polityka cookies</Link>
            </p>
          </div>
        </div>
      </div>

      {/* Desktop: Floating card w lewym dolnym rogu */}
      <div className="hidden md:block fixed bottom-6 left-6 z-[60] max-w-md">
        <div className="bg-zinc-900/95 backdrop-blur-xl rounded-2xl border border-white/10 p-5 shadow-2xl shadow-black/40 animate-fade-in">
          {/* Header */}
          <div className="flex items-start gap-4 mb-4">
            <div className="w-11 h-11 bg-gradient-to-br from-yellow-400 to-amber-500 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg shadow-yellow-400/20">
              <Cookie className="w-5 h-5 text-black" />
            </div>
            <div className="flex-1">
              <h3 className="text-white font-bold mb-1">Ciasteczka 🍪</h3>
              <p className="text-white/50 text-sm leading-relaxed">
                Używamy plików cookie, aby strona działała poprawnie.{" "}
                <Link href="/polityka-prywatnosci" className="text-yellow-400 hover:underline">Dowiedz się więcej</Link>
              </p>
            </div>
            <button 
              onClick={() => save({ necessary: true, analytics: false, marketing: false })}
              className="w-8 h-8 flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 rounded-lg transition -mt-1 -mr-1"
            >
              <X size={16} />
            </button>
          </div>
          
          {/* Buttons */}
          <div className="flex gap-3">
            <button
              onClick={() => save({ necessary: true, analytics: false, marketing: false })}
              className="flex-1 py-2.5 bg-white/5 text-white rounded-xl font-medium text-sm border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all"
            >
              Tylko niezbędne
            </button>
            <button
              onClick={() => save({ necessary: true, analytics: true, marketing: true })}
              className="flex-1 py-2.5 bg-gradient-to-r from-yellow-400 to-amber-500 text-black rounded-xl font-bold text-sm hover:from-yellow-300 hover:to-amber-400 transition-all shadow-lg shadow-yellow-400/20"
            >
              Akceptuj wszystkie
            </button>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes slide-up {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-slide-up {
          animation: slide-up 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .animate-fade-in {
          animation: fade-in 0.3s ease-out;
        }
        .safe-area-bottom {
          padding-bottom: max(1.5rem, env(safe-area-inset-bottom));
        }
      `}</style>
    </>
  );
}
