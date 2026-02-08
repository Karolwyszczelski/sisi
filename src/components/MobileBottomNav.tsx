"use client";

import React from "react";
import { Home, UtensilsCrossed, Calendar, ShoppingCart, User } from "lucide-react";
import useCartStore from "@/store/cartStore";

type MobileScreen = "hero" | "menu" | "onas" | "contact" | "burger" | "dokumenty" | "polityka" | "regulamin" | "cookies";

interface MobileBottomNavProps {
  currentScreen: MobileScreen;
  onNavigate: (screen: MobileScreen, fromMenu?: boolean) => void;
  onOpenReservation: () => void;
  onCloseReservation: () => void;
  onOpenProfile: () => void;
  onOpenCart: () => void;
  isReservationOpen?: boolean;
}

export default function MobileBottomNav({
  currentScreen,
  onNavigate,
  onOpenReservation,
  onCloseReservation,
  onOpenProfile,
  onOpenCart,
  isReservationOpen = false,
}: MobileBottomNavProps) {
  const { items } = useCartStore();
  const itemCount = items.reduce((sum, item) => sum + (item.quantity || 1), 0);

  // Określ który przycisk jest aktywny
  const getActiveButton = (): "home" | "cart" | "menu" | "reservation" | "profile" | null => {
    if (isReservationOpen) return "reservation";
    if (currentScreen === "menu") return "menu";
    if (currentScreen === "hero") return "home";
    return null;
  };

  const active = getActiveButton();

  // Wspólne style dla przycisków
  const baseButtonClass = "flex flex-col items-center justify-center py-2 flex-1 min-w-0 transition-all";
  const inactiveClass = "text-white/50";
  const activeClass = "text-yellow-400";

  // Handler dla nawigacji - zamyka rezerwację jeśli otwarta
  const handleNavigate = (screen: MobileScreen) => {
    if (isReservationOpen) {
      onCloseReservation();
    }
    onNavigate(screen, true);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden">
      <div className="bg-zinc-900 border-t border-white/10 pb-[env(safe-area-inset-bottom)]">
        <div className="flex items-center justify-around h-16">
          
          {/* Start */}
          <button
            onClick={() => handleNavigate("hero")}
            className={`${baseButtonClass} ${active === "home" ? activeClass : inactiveClass}`}
          >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
              active === "home" ? "bg-yellow-400" : ""
            }`}>
              <Home 
                size={active === "home" ? 22 : 22} 
                className={active === "home" ? "text-black" : ""} 
                strokeWidth={active === "home" ? 2.5 : 2} 
              />
            </div>
            <span className={`text-[10px] mt-0.5 font-medium ${active === "home" ? "font-bold" : ""}`}>
              Start
            </span>
          </button>

          {/* Koszyk */}
          <button
            onClick={onOpenCart}
            className={`${baseButtonClass} ${active === "cart" ? activeClass : inactiveClass}`}
          >
            <div className="relative w-10 h-10 rounded-xl flex items-center justify-center">
              <ShoppingCart size={22} strokeWidth={2} />
              {itemCount > 0 && (
                <span className="absolute top-0.5 right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
                  {itemCount > 99 ? "99" : itemCount}
                </span>
              )}
            </div>
            <span className="text-[10px] mt-0.5 font-medium">Koszyk</span>
          </button>

          {/* MENU - środkowy przycisk */}
          <button
            onClick={() => handleNavigate("menu")}
            className={`${baseButtonClass} ${active === "menu" ? activeClass : inactiveClass}`}
          >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
              active === "menu" ? "bg-yellow-400" : ""
            }`}>
              <UtensilsCrossed 
                size={22} 
                className={active === "menu" ? "text-black" : ""} 
                strokeWidth={active === "menu" ? 2.5 : 2} 
              />
            </div>
            <span className={`text-[10px] mt-0.5 font-medium ${active === "menu" ? "font-bold" : ""}`}>
              Menu
            </span>
          </button>

          {/* Rezerwacja */}
          <button
            onClick={onOpenReservation}
            className={`${baseButtonClass} ${active === "reservation" ? activeClass : inactiveClass}`}
          >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
              active === "reservation" ? "bg-yellow-400" : ""
            }`}>
              <Calendar 
                size={22} 
                className={active === "reservation" ? "text-black" : ""} 
                strokeWidth={active === "reservation" ? 2.5 : 2} 
              />
            </div>
            <span className={`text-[10px] mt-0.5 font-medium ${active === "reservation" ? "font-bold" : ""}`}>
              Rezerwuj
            </span>
          </button>

          {/* Profil */}
          <button
            onClick={onOpenProfile}
            className={`${baseButtonClass} ${active === "profile" ? activeClass : inactiveClass}`}
          >
            <div className="w-10 h-10 rounded-xl flex items-center justify-center">
              <User size={22} strokeWidth={2} />
            </div>
            <span className="text-[10px] mt-0.5 font-medium">Profil</span>
          </button>

        </div>
      </div>
    </nav>
  );
}
