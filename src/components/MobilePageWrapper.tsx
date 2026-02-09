"use client";

import React, { useState, useCallback, useEffect } from "react";
import { 
  Menu, X, ChevronLeft, Home, UtensilsCrossed, Info, Phone, User, Mail, Lock, Eye, EyeOff, ShoppingCart, Trash2, Minus, Plus,
  History, Heart, MapPin, Settings, Gift, ChevronDown, ChevronUp, Package, Clock, Check, Truck, XCircle, Star, Edit3, LogOut, Repeat, CreditCard, Building
} from "lucide-react";
import Image from "next/image";
import dynamic from "next/dynamic";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { useSession } from "@supabase/auth-helpers-react";
import MobileBottomNav from "./MobileBottomNav";
import Hero from "./Hero";
import MenuSection from "./menu/MenuSection";
import OnasSection from "./OnasSection";
import ContactSection from "./ContactSection";
import BurgerMiesiaca from "./BurgerMiesiaca";
import { LEGAL } from "@/config/legal";
import { Flame, FileText, ChevronRight, Shield, Cookie, ScrollText } from "lucide-react";
import useCartStore from "@/store/cartStore";
import AddressAutocomplete from "@/components/menu/AddressAutocomplete";

// Dynamiczne importy modali
const ReservationModal = dynamic(() => import("./ReservationModal"), { ssr: false });
const CheckoutModal = dynamic(() => import("./CheckoutModalDynamic").then(m => m.default), { ssr: false });

export type MobileScreen = "hero" | "menu" | "onas" | "contact" | "burger" | "dokumenty" | "polityka" | "regulamin" | "cookies";
type ProfileModalStep = "initial" | "login" | "register" | "logged" | "panel";
type ProfileTab = "orders" | "loyalty" | "settings";
type CartModalStep = "summary" | "full";

const screenTitles: Record<MobileScreen, string> = {
  hero: "",
  menu: "Menu",
  onas: "O nas",
  contact: "Kontakt",
  burger: "Burger Miesiąca",
  dokumenty: "Dokumenty",
  polityka: "Polityka prywatności",
  regulamin: "Regulamin",
  cookies: "Polityka cookies",
};

const menuItems = [
  { id: "hero" as const, icon: Home, label: "Strona główna" },
  { id: "menu" as const, icon: UtensilsCrossed, label: "Menu" },
  { id: "burger" as const, icon: Flame, label: "Burger Miesiąca" },
  { id: "onas" as const, icon: Info, label: "O nas" },
  { id: "contact" as const, icon: Phone, label: "Kontakt" },
  { id: "dokumenty" as const, icon: FileText, label: "Dokumenty", hasSubmenu: true },
];

const dokumentyItems = [
  { id: "polityka" as const, icon: Shield, label: "Polityka prywatności" },
  { id: "regulamin" as const, icon: ScrollText, label: "Regulamin" },
  { id: "cookies" as const, icon: Cookie, label: "Polityka cookies" },
];

export default function MobilePageWrapper() {
  const supabase = createClientComponentClient();
  const session = useSession();
  const { items, removeItem, addItem, openCheckoutModal } = useCartStore();
  
  const [currentScreen, setCurrentScreen] = useState<MobileScreen>("hero");
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isReservationOpen, setIsReservationOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [profileStep, setProfileStep] = useState<ProfileModalStep>("initial");
  const [screenHistory, setScreenHistory] = useState<MobileScreen[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [cartStep, setCartStep] = useState<CartModalStep>("summary");
  const [showMenuWelcome, setShowMenuWelcome] = useState(false);
  const [menuVisited, setMenuVisited] = useState(false);
  const [profileTab, setProfileTab] = useState<ProfileTab>("orders");
  const [showIntro, setShowIntro] = useState(false);
  
  // Auth form state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");

  // Profile settings state
  const [localName, setLocalName] = useState("");
  const [localPhone, setLocalPhone] = useState("");
  const [oldPass, setOldPass] = useState("");
  const [newPass, setNewPass] = useState("");
  const [newPass2, setNewPass2] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);

  // Orders state
  const [orders, setOrders] = useState<any[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [expandedOrderId, setExpandedOrderId] = useState<number | null>(null);

  // Cart calculations
  const itemCount = items.reduce((sum, item) => sum + (item.quantity || 1), 0);
  const totalPrice = items.reduce((sum, item) => sum + item.price * (item.quantity || 1), 0);

  const openCartModal = useCallback(() => {
    setCartStep("summary");
    setIsCartOpen(true);
  }, []);

  const closeCartModal = useCallback(() => {
    setIsCartOpen(false);
    setCartStep("summary");
  }, []);

  const goToFullCheckout = useCallback(() => {
    closeCartModal();
    openCheckoutModal();
  }, [closeCartModal, openCheckoutModal]);

  const navigateTo = useCallback((screen: MobileScreen, fromMenu: boolean = false) => {
    if (screen !== currentScreen) {
      // Jeśli nawigujemy z menu hamburger, resetujemy historię
      if (fromMenu) {
        setScreenHistory([]);
      } else {
        setScreenHistory((prev) => [...prev, currentScreen]);
      }
      
      // Pokaż animację przy pierwszym wejściu do menu
      if (screen === "menu" && !menuVisited) {
        setMenuVisited(true);
        setShowMenuWelcome(true);
        setTimeout(() => setShowMenuWelcome(false), 1800);
      }
      
      setCurrentScreen(screen);
    }
    setIsMenuOpen(false);
  }, [currentScreen, menuVisited]);

  const goBack = useCallback(() => {
    if (screenHistory.length > 0) {
      const prevScreen = screenHistory[screenHistory.length - 1];
      setScreenHistory((prev) => prev.slice(0, -1));
      setCurrentScreen(prevScreen);
    }
  }, [screenHistory]);

  const canGoBack = screenHistory.length > 0;

  const openProfileModal = useCallback(() => {
    setProfileStep(session ? "logged" : "initial");
    setProfileTab("orders");
    setIsProfileOpen(true);
    setAuthError("");
    // Initialize settings with current user data
    if (session?.user) {
      setLocalName((session.user.user_metadata as any)?.full_name || "");
      setLocalPhone((session.user.user_metadata as any)?.phone || "");
    }
  }, [session]);

  const closeProfileModal = useCallback(() => {
    setIsProfileOpen(false);
    setProfileStep("initial");
    setProfileTab("orders");
    setEmail("");
    setPassword("");
    setFullName("");
    setPhoneNumber("");
    setAuthError("");
    setOldPass("");
    setNewPass("");
    setNewPass2("");
  }, []);

  // Load orders when profile opens
  useEffect(() => {
    if (isProfileOpen && (profileStep === "logged" || profileStep === "panel") && session?.user?.id) {
      setOrdersLoading(true);
      supabase
        .from("orders")
        .select("id, created_at, status, total_price, selected_option, items, payment_method, payment_status, address")
        .eq("user", session.user.id)
        .order("created_at", { ascending: false })
        .limit(20)
        .then(({ data, error }) => {
          if (!error && data) setOrders(data);
          setOrdersLoading(false);
        });
    }
  }, [isProfileOpen, profileStep, session?.user?.id, supabase]);

  // Mobile Intro animation
  useEffect(() => {
    if (typeof window === "undefined") return;
    const INTRO_KEY = "sisi_mobile_intro_shown";
    const alreadyShown = sessionStorage.getItem(INTRO_KEY);
    if (alreadyShown) return;
    
    setShowIntro(true);
    sessionStorage.setItem(INTRO_KEY, "true");
    const t = setTimeout(() => setShowIntro(false), 2000);
    return () => clearTimeout(t);
  }, []);

  // Helper functions
  const normalizePlPhone = (input: string): string | null => {
    const d = String(input).replace(/\D/g, "");
    if (d.length === 9) return "+48" + d;
    if (d.startsWith("48") && d.length === 11) return "+" + d;
    return null;
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      const norm = normalizePlPhone(localPhone);
      if (!norm) {
        alert("Podaj prawidłowy numer telefonu (+48…).");
        return;
      }

      if (newPass || newPass2) {
        if (newPass !== newPass2) {
          alert("Nowe hasła nie pasują!");
          return;
        }
        if (!oldPass) {
          alert("Podaj obecne hasło!");
          return;
        }
        const { error: reauthErr } = await supabase.auth.signInWithPassword({
          email: session?.user?.email || "",
          password: oldPass,
        });
        if (reauthErr) {
          alert("Obecne hasło jest nieprawidłowe!");
          return;
        }
        const { error: updErr } = await supabase.auth.updateUser({ password: newPass });
        if (updErr) {
          alert("Błąd zmiany hasła: " + updErr.message);
          return;
        }
      }

      const { error: updMeta } = await supabase.auth.updateUser({
        data: { full_name: localName, phone: norm },
      });
      if (updMeta) {
        alert("Błąd zapisu: " + updMeta.message);
        return;
      }

      alert("Zapisano!");
      setOldPass("");
      setNewPass("");
      setNewPass2("");
    } finally {
      setSavingSettings(false);
    }
  };

  const getStatusConfig = (s?: string) => {
    switch(s) {
      case "placed": return { label: "Złożone", color: "text-blue-400 bg-blue-400/10", icon: Clock };
      case "accepted": return { label: "Przyjęte", color: "text-indigo-400 bg-indigo-400/10", icon: Check };
      case "preparing": return { label: "W przygotowaniu", color: "text-yellow-400 bg-yellow-400/10", icon: Package };
      case "ready": return { label: "Gotowe", color: "text-green-400 bg-green-400/10", icon: Check };
      case "delivering": return { label: "W dostawie", color: "text-purple-400 bg-purple-400/10", icon: Truck };
      case "delivered": 
      case "completed": return { label: "Zakończone", color: "text-green-400 bg-green-400/10", icon: Check };
      case "cancelled": return { label: "Anulowane", color: "text-red-400 bg-red-400/10", icon: XCircle };
      default: return { label: s ?? "—", color: "text-white/50 bg-white/5", icon: Clock };
    }
  };

  const parseItems = (items: any) => {
    try {
      return typeof items === "string" ? JSON.parse(items) : (items || []);
    } catch { return []; }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError("");
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      setProfileStep("logged");
    } catch (err: any) {
      setAuthError(err.message || "Błąd logowania");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError("");
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName, phone: phoneNumber }
        }
      });
      if (error) throw error;
      setAuthError("");
      alert("Sprawdź email aby potwierdzić konto!");
      setProfileStep("login");
    } catch (err: any) {
      setAuthError(err.message || "Błąd rejestracji");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    closeProfileModal();
  };

  const renderScreen = () => {
    switch (currentScreen) {
      case "hero":
        return <Hero onNavigateToMenu={() => navigateTo("menu")} onNavigateToBurger={() => navigateTo("burger")} onOpenReservation={() => setIsReservationOpen(true)} />;
      case "burger":
        return (
          <div className="fixed inset-0 bg-zinc-950 pt-14 pb-20 overflow-y-auto">
            <BurgerMiesiaca />
          </div>
        );
      case "menu":
        return (
          <div className="fixed inset-0 bg-zinc-950 pt-14 pb-20 overflow-y-auto">
            {/* Animacja "Co dziś zamawiamy?" przy pierwszym wejściu */}
            {showMenuWelcome && (
              <div className="menu-welcome-overlay fixed inset-0 z-50 flex items-center justify-center bg-black overflow-hidden">
                {/* Ślad świetlny za burgerem */}
                <div className="trail-container absolute inset-0 flex items-center pointer-events-none">
                  <div className="trail-glow" />
                </div>

                {/* Burger lecący z lewej na prawą */}
                <div className="burger-fly absolute w-32 h-32 z-10 will-change-transform">
                  <Image
                    src="/burgerpng.png"
                    alt=""
                    width={128}
                    height={128}
                    className="w-full h-full object-contain drop-shadow-[0_0_40px_rgba(251,191,36,0.8)]"
                  />
                </div>

                {/* Tekst */}
                <div className="relative z-20 flex flex-col items-center text-center px-6">
                  <p className="intro-text text-3xl sm:text-4xl font-black text-white leading-tight">
                    Co dziś <span className="text-yellow-400">zamawiamy</span>?
                  </p>
                </div>

                <style jsx>{`
                  .menu-welcome-overlay {
                    animation: fadeOutOverlay 0.4s ease-in 1.4s forwards;
                  }
                  @keyframes fadeOutOverlay {
                    0% { opacity: 1; }
                    100% { opacity: 0; }
                  }

                  .burger-fly {
                    left: 0;
                    top: 50%;
                    transform: translateY(-50%) translateX(-120%);
                    animation: flyAcross 0.7s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                  }
                  @keyframes flyAcross {
                    0% {
                      transform: translateY(-50%) translateX(-120%);
                      opacity: 0;
                    }
                    5% { opacity: 1; }
                    100% {
                      transform: translateY(-50%) translateX(calc(100vw + 20%));
                      opacity: 1;
                    }
                  }

                  .trail-glow {
                    position: absolute;
                    left: 0;
                    top: 50%;
                    transform: translateY(-50%) scaleX(0);
                    transform-origin: left center;
                    width: 100%;
                    height: 80px;
                    background: linear-gradient(90deg, transparent 0%, rgba(251, 191, 36, 0.3) 30%, rgba(251, 191, 36, 0.6) 70%, rgba(251, 191, 36, 0.8) 100%);
                    border-radius: 100px;
                    filter: blur(25px);
                    will-change: transform, opacity;
                    animation: trailExpand 0.7s cubic-bezier(0.16, 1, 0.3, 1) forwards, trailFadeOut 0.4s ease-out 0.6s forwards;
                  }
                  @keyframes trailExpand {
                    0% {
                      transform: translateY(-50%) scaleX(0);
                      opacity: 0;
                    }
                    10% { opacity: 1; }
                    100% {
                      transform: translateY(-50%) scaleX(1.2);
                      opacity: 0.8;
                    }
                  }
                  @keyframes trailFadeOut {
                    0% { opacity: 0.8; }
                    100% { opacity: 0; }
                  }

                  .intro-text {
                    opacity: 0;
                    animation: revealText 0.5s ease-out 0.35s forwards, fadeOutText 0.3s ease-in 1.1s forwards;
                  }
                  @keyframes revealText {
                    0% {
                      opacity: 0;
                      transform: scale(0.85);
                      filter: blur(12px);
                    }
                    100% {
                      opacity: 1;
                      transform: scale(1);
                      filter: blur(0);
                    }
                  }
                  @keyframes fadeOutText {
                    0% { opacity: 1; }
                    100% { opacity: 0; }
                  }
                `}</style>
              </div>
            )}
            <MenuSection />
          </div>
        );
      case "onas":
        return (
          <div className="fixed inset-0 bg-zinc-950 pt-14 pb-20 overflow-y-auto">
            <OnasSection />
          </div>
        );
      case "contact":
        return (
          <div className="fixed inset-0 bg-zinc-950 pt-14 pb-20 overflow-y-auto">
            <ContactSection />
          </div>
        );
      case "dokumenty":
        return (
          <div className="fixed inset-0 bg-zinc-950 pt-14 pb-20 overflow-y-auto">
            <div className="p-4 space-y-3">
              {dokumentyItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => navigateTo(item.id)}
                    className="w-full flex items-center justify-between gap-4 py-4 px-5 rounded-2xl bg-zinc-900 text-white active:bg-zinc-800 active:scale-[0.98] transition-all border border-white/5"
                  >
                    <div className="flex items-center gap-4">
                      <Icon size={22} className="text-yellow-400" />
                      <span className="text-lg font-medium">{item.label}</span>
                    </div>
                    <ChevronRight size={20} className="text-white/40" />
                  </button>
                );
              })}
            </div>
          </div>
        );
      case "polityka":
        return (
          <div className="fixed inset-0 bg-zinc-950 pt-14 pb-20 overflow-y-auto">
            <div className="px-5 py-6">
              <article className="prose prose-invert prose-sm prose-a:text-yellow-400 hover:prose-a:text-yellow-300 max-w-none">
                <h1 className="text-2xl font-bold text-white mb-6">Polityka prywatności</h1>
                
                <p className="text-white/80">
                  Administratorem danych osobowych jest <b>{LEGAL.legalName}</b>, NIP {LEGAL.nip}, REGON {LEGAL.regon}, adres rejestrowy: {LEGAL.registeredAddress}.
                  Kontakt: <a href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a>, tel. <a href={`tel:${LEGAL.phone.replace(/\s/g,"")}`}>{LEGAL.phone}</a>.
                </p>

                <h2 className="text-lg font-bold text-white mt-6 mb-3">1) Podstawy prawne i cele przetwarzania</h2>
                <ul className="text-white/80 space-y-2">
                  <li><b>Realizacja zamówień</b> – art. 6 ust. 1 lit. b RODO (umowa); dane: imię, telefon, e-mail, adres dostawy, treść zamówienia.</li>
                  <li><b>Rozliczenia i podatki</b> – art. 6 ust. 1 lit. c RODO (obowiązek prawny).</li>
                  <li><b>Kontakt, bezpieczeństwo</b> – art. 6 ust. 1 lit. f RODO (prawnie uzasadniony interes).</li>
                  <li><b>Marketing/newsletter</b> – art. 6 ust. 1 lit. a RODO (zgoda).</li>
                </ul>

                <h2 className="text-lg font-bold text-white mt-6 mb-3">2) Kategorie danych</h2>
                <ul className="text-white/80 space-y-2">
                  <li>Dane identyfikacyjne i kontaktowe (imię, telefon, e-mail).</li>
                  <li>Dane adresowe (ulica, numer, kod, miejscowość).</li>
                  <li>Dane transakcyjne (pozycje zamówienia, cena, status płatności).</li>
                  <li>Dane techniczne (logi serwera, identyfikatory cookies, adres IP).</li>
                </ul>

                <h2 className="text-lg font-bold text-white mt-6 mb-3">3) Odbiorcy danych</h2>
                <ul className="text-white/80 space-y-2">
                  <li>Dostawcy hostingu/IT, poczty e-mail i SMS.</li>
                  <li>Supabase – backend i uwierzytelnianie.</li>
                  <li>Operator płatności (PayPro S.A. – Przelewy24).</li>
                  <li>Biuro rachunkowe, doradcy prawni.</li>
                </ul>

                <h2 className="text-lg font-bold text-white mt-6 mb-3">4) Twoje prawa</h2>
                <ul className="text-white/80 space-y-2">
                  <li>Dostęp do danych, ich sprostowania, usunięcia.</li>
                  <li>Ograniczenie przetwarzania, przenoszenie danych.</li>
                  <li>Sprzeciw wobec przetwarzania.</li>
                  <li>Wniesienie skargi do Prezesa UODO.</li>
                </ul>

                <h2 className="text-lg font-bold text-white mt-6 mb-3">5) Kontakt</h2>
                <p className="text-white/80">
                  Wszelkie żądania i pytania dotyczące danych osobowych prosimy kierować na: <a href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a>.
                </p>

                <div className="mt-8 pt-4 border-t border-white/10">
                  <p className="text-sm text-white/40">
                    Wersja: {LEGAL.docsVersion} · obowiązuje od: {LEGAL.effectiveDate}
                  </p>
                </div>
              </article>
            </div>
          </div>
        );
      case "regulamin":
        return (
          <div className="fixed inset-0 bg-zinc-950 pt-14 pb-20 overflow-y-auto">
            <div className="px-5 py-6">
              <article className="prose prose-invert prose-sm prose-a:text-yellow-400 hover:prose-a:text-yellow-300 max-w-none">
                <h1 className="text-2xl font-bold text-white mb-6">Regulamin</h1>
                
                <p className="text-white/80">
                  Regulamin określa zasady korzystania z serwisu zamówień online {LEGAL.shortBrand} oraz warunki zawierania i realizacji umów sprzedaży na odległość.
                  Operatorem Serwisu jest <b>{LEGAL.legalName}</b>, NIP {LEGAL.nip}, REGON {LEGAL.regon}, z adresem rejestrowym: {LEGAL.registeredAddress}.
                </p>

                <h2 className="text-lg font-bold text-white mt-6 mb-3">1) Definicje</h2>
                <ul className="text-white/80 space-y-2">
                  <li><b>Serwis</b> – strona/aplikacja internetowa umożliwiająca składanie zamówień.</li>
                  <li><b>Sprzedawca/Operator</b> – {LEGAL.legalName}.</li>
                  <li><b>Klient</b> – konsument lub przedsiębiorca składający zamówienie.</li>
                  <li><b>Zamówienie</b> – oświadczenie woli Klienta, zmierzające do zawarcia umowy sprzedaży.</li>
                </ul>

                <h2 className="text-lg font-bold text-white mt-6 mb-3">2) Postanowienia ogólne</h2>
                <ul className="text-white/80 space-y-2">
                  <li>Serwis działa zgodnie z prawem polskim i UE.</li>
                  <li>Minimalne wymagania: przeglądarka z JavaScriptem i cookies.</li>
                  <li>Zakazuje się dostarczania treści bezprawnych.</li>
                </ul>

                <h2 className="text-lg font-bold text-white mt-6 mb-3">3) Składanie zamówień</h2>
                <ol className="text-white/80 space-y-2 list-decimal list-inside">
                  <li>Klient wybiera produkty, opcję odbioru, podaje dane kontaktowe i metodę płatności.</li>
                  <li>Po złożeniu zamówienia Klient otrzymuje potwierdzenie e-mail.</li>
                  <li>Umowa zostaje zawarta z chwilą akceptacji zamówienia przez obsługę.</li>
                </ol>

                <h2 className="text-lg font-bold text-white mt-6 mb-3">4) Ceny i płatności</h2>
                <ul className="text-white/80 space-y-2">
                  <li>Ceny są brutto (zawierają podatki).</li>
                  <li>Metody płatności: gotówka, terminal, płatność online.</li>
                  <li>Paragon fiskalny wydawany jest w lokalu lub z zamówieniem.</li>
                </ul>

                <h2 className="text-lg font-bold text-white mt-6 mb-3">5) Reklamacje</h2>
                <ul className="text-white/80 space-y-2">
                  <li>Reklamacje należy składać niezwłocznie na {LEGAL.email}.</li>
                  <li>Odpowiadamy w terminie do 14 dni kalendarzowych.</li>
                </ul>

                <div className="mt-8 pt-4 border-t border-white/10">
                  <p className="text-sm text-white/40">
                    Wersja: {LEGAL.docsVersion} · obowiązuje od: {LEGAL.effectiveDate}
                  </p>
                </div>
              </article>
            </div>
          </div>
        );
      case "cookies":
        return (
          <div className="fixed inset-0 bg-zinc-950 pt-14 pb-20 overflow-y-auto">
            <div className="px-5 py-6">
              <article className="prose prose-invert prose-sm prose-a:text-yellow-400 hover:prose-a:text-yellow-300 max-w-none">
                <h1 className="text-2xl font-bold text-white mb-6">Polityka cookies</h1>
                
                <p className="text-white/80">
                  Operatorem serwisu jest <b>{LEGAL.legalName}</b>, NIP {LEGAL.nip}. Używamy plików cookies i podobnych technologii w celu zapewnienia działania serwisu, poprawy jakości usług, statystyki i – za zgodą – marketingu.
                </p>

                <h2 className="text-lg font-bold text-white mt-6 mb-3">1) Czym są cookies?</h2>
                <p className="text-white/80">
                  Cookies to niewielkie pliki zapisywane na urządzeniu użytkownika przez przeglądarkę. Mogą być odczytywane ponownie przez serwis przy kolejnych odwiedzinach.
                </p>

                <h2 className="text-lg font-bold text-white mt-6 mb-3">2) Kategorie cookies</h2>
                <ul className="text-white/80 space-y-2">
                  <li><b>Niezbędne</b> – wymagane do prawidłowego działania serwisu.</li>
                  <li><b>Analityczne</b> – pomagają analizować ruch i działanie serwisu.</li>
                  <li><b>Marketingowe</b> – personalizacja treści/ofert (tylko po wyrażeniu zgody).</li>
                </ul>

                <h2 className="text-lg font-bold text-white mt-6 mb-3">3) Zarządzanie cookies</h2>
                <ul className="text-white/80 space-y-2">
                  <li>Podczas pierwszej wizyty wyświetlamy baner zarządzania zgodą.</li>
                  <li>Preferencje możesz zmienić w dowolnym momencie.</li>
                  <li>Większość przeglądarek pozwala blokować lub usuwać cookies.</li>
                </ul>

                <h2 className="text-lg font-bold text-white mt-6 mb-3">4) Okresy przechowywania</h2>
                <ul className="text-white/80 space-y-2">
                  <li>Cookies sesyjne – do końca sesji przeglądarki.</li>
                  <li>Cookies trwałe – od 1 dnia do 12 miesięcy.</li>
                </ul>

                <div className="mt-8 pt-4 border-t border-white/10">
                  <p className="text-sm text-white/40">
                    Wersja: {LEGAL.docsVersion} · obowiązuje od: {LEGAL.effectiveDate}
                  </p>
                </div>
              </article>
            </div>
          </div>
        );
      default:
        return <Hero />;
    }
  };

  return (
    <div className="md:hidden fixed inset-0 bg-zinc-950 overflow-hidden">
      {/* Mobile Intro Animation */}
      {showIntro && (
        <div className="mobile-intro fixed inset-0 z-[100] flex items-center justify-center bg-black overflow-hidden">
          {/* Burger spadający */}
          <div className="burger-drop absolute w-36 h-36 z-30 will-change-transform">
            <Image
              src="/burgerpng.png"
              alt=""
              width={144}
              height={144}
              className="w-full h-full object-contain drop-shadow-[0_0_50px_rgba(251,191,36,0.9)]"
              priority
            />
          </div>

          {/* Ślad świetlny */}
          <div className="trail-vertical absolute inset-0 flex justify-center pointer-events-none">
            <div className="trail-glow-vertical" />
          </div>

          {/* Tekst */}
          <div className="relative z-20 flex flex-col items-center text-center px-6">
            <p className="intro-text text-3xl font-black leading-tight tracking-tight text-white">
              Witaj w <span className="text-yellow-400">SISI</span>! 🍔
            </p>
            <p className="intro-subtext text-white/50 mt-2 text-base">Najlepsze burgery w mieście</p>
          </div>

          <style jsx>{`
            .mobile-intro {
              animation: fadeOutSection 0.4s ease-in 1.6s forwards;
            }
            @keyframes fadeOutSection {
              0% { opacity: 1; }
              100% { opacity: 0; pointer-events: none; }
            }
            .burger-drop {
              top: -150px;
              left: 50%;
              transform: translateX(-50%) rotate(-20deg);
              animation: dropDown 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
            }
            @keyframes dropDown {
              0% {
                top: -150px;
                transform: translateX(-50%) rotate(-20deg) scale(0.8);
                opacity: 0;
              }
              15% { opacity: 1; }
              60% {
                top: 50%;
                transform: translateX(-50%) translateY(-50%) rotate(10deg) scale(1.1);
              }
              80% {
                transform: translateX(-50%) translateY(-50%) rotate(-5deg) scale(1);
              }
              100% {
                top: 50%;
                transform: translateX(-50%) translateY(-50%) rotate(0deg) scale(1);
                opacity: 0;
              }
            }
            .trail-glow-vertical {
              position: absolute;
              top: 0;
              width: 100px;
              height: 0;
              background: linear-gradient(180deg, rgba(251, 191, 36, 0.8) 0%, rgba(251, 191, 36, 0.4) 50%, transparent 100%);
              border-radius: 100px;
              filter: blur(35px);
              animation: trailGrow 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards, trailFade 0.3s ease-out 0.5s forwards;
            }
            @keyframes trailGrow {
              0% { height: 0; opacity: 0; }
              20% { opacity: 0.8; }
              100% { height: 55vh; opacity: 0.6; }
            }
            @keyframes trailFade {
              0% { opacity: 0.6; }
              100% { opacity: 0; }
            }
            .intro-text {
              opacity: 0;
              animation: revealText 0.5s ease-out 0.4s forwards, fadeOutText 0.3s ease-in 1.3s forwards;
            }
            .intro-subtext {
              opacity: 0;
              animation: revealSubtext 0.4s ease-out 0.55s forwards, fadeOutText 0.3s ease-in 1.3s forwards;
            }
            @keyframes revealText {
              0% {
                opacity: 0;
                transform: translateY(25px) scale(0.9);
                filter: blur(8px);
              }
              100% {
                opacity: 1;
                transform: translateY(0) scale(1);
                filter: blur(0);
              }
            }
            @keyframes revealSubtext {
              0% { opacity: 0; transform: translateY(15px); }
              100% { opacity: 1; transform: translateY(0); }
            }
            @keyframes fadeOutText {
              0% { opacity: 1; }
              100% { opacity: 0; }
            }
          `}</style>
        </div>
      )}

      {/* Mobile Header - ukryty na hero */}
      {currentScreen !== "hero" && (
        <header className="fixed top-0 left-0 right-0 z-40 bg-zinc-950/95 backdrop-blur-xl border-b border-white/5">
          <div className="flex items-center justify-between h-14 px-4">
            {/* Lewo: Logo lub Back */}
            <div className="w-10 flex items-center">
              {canGoBack ? (
                <button
                  onClick={goBack}
                  className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-white/80 active:bg-white/10 active:scale-95 transition-all"
                  aria-label="Wstecz"
                >
                  <ChevronLeft size={24} />
                </button>
              ) : (
                <Image
                  src="/logo.png"
                  alt="SISI"
                  width={36}
                  height={36}
                  className="drop-shadow-lg"
                />
              )}
            </div>

            {/* Środek: Tytuł ekranu */}
            <h1 className="text-white font-bold text-lg tracking-wide">
              {screenTitles[currentScreen]}
            </h1>

            {/* Prawo: Menu hamburger */}
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-white/80 active:bg-white/10 active:scale-95 transition-all"
              aria-label={isMenuOpen ? "Zamknij menu" : "Otwórz menu"}
            >
              {isMenuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </header>
      )}

      {/* Hero header - tylko logo i hamburger */}
      {currentScreen === "hero" && (
        <header className="fixed top-0 left-0 right-0 z-40">
          <div className="flex items-center justify-between px-4 h-16">
            <Image
              src="/logo.png"
              alt="SISI"
              width={50}
              height={50}
              className="drop-shadow-lg"
            />
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="w-10 h-10 rounded-xl bg-black/30 backdrop-blur-sm flex items-center justify-center text-white active:bg-black/50 active:scale-95 transition-all"
              aria-label={isMenuOpen ? "Zamknij menu" : "Otwórz menu"}
            >
              {isMenuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </header>
      )}

      {/* Pełnoekranowe menu nawigacji */}
      {isMenuOpen && (
        <div className="fixed inset-0 z-50 bg-zinc-950/98 backdrop-blur-xl flex flex-col overflow-y-auto">
          {/* Header menu */}
          <div className="flex items-center justify-between px-4 h-16 border-b border-white/5 flex-shrink-0">
            <Image
              src="/logo.png"
              alt="SISI"
              width={50}
              height={50}
            />
            <button
              onClick={() => setIsMenuOpen(false)}
              className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-white active:bg-white/10 active:scale-95 transition-all"
              aria-label="Zamknij menu"
            >
              <X size={22} />
            </button>
          </div>

          {/* Menu items */}
          <nav className="flex-1 flex flex-col justify-center px-8 gap-2">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentScreen === item.id;
              const hasSubmenu = 'hasSubmenu' in item && item.hasSubmenu;
              return (
                <button
                  key={item.id}
                  onClick={() => navigateTo(item.id, true)}
                  className={`flex items-center justify-between py-4 px-5 rounded-2xl transition-all active:scale-[0.98] ${
                    isActive 
                      ? "bg-yellow-400 text-black" 
                      : "bg-white/5 text-white active:bg-white/10"
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <Icon size={24} strokeWidth={isActive ? 2.5 : 2} />
                    <span className={`text-xl ${isActive ? "font-bold" : "font-medium"}`}>
                      {item.label}
                    </span>
                  </div>
                  {hasSubmenu && (
                    <ChevronRight size={20} className={isActive ? "text-black/60" : "text-white/40"} />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Footer */}
          <div className="px-8 pb-8 text-center">
            <p className="text-white/30 text-sm">SISI Burger & Pancakes</p>
            {/* Hidden admin link */}
            <a 
              href="/admin" 
              className="inline-block mt-2 text-[10px] text-white/10 hover:text-white/30 transition"
            >
              v2.0
            </a>
          </div>
        </div>
      )}

      {/* Zawartość ekranu */}
      <main className="h-full">
        {renderScreen()}
      </main>

      {/* Modal rezerwacji - renderowany PRZED bottom nav żeby nav był widoczny */}
      <ReservationModal 
        isOpen={isReservationOpen} 
        onClose={() => setIsReservationOpen(false)} 
        onOpenMenu={() => { setIsReservationOpen(false); setIsMenuOpen(true); }}
      />

      {/* Bottom Nav - zawsze na wierzchu */}
      <MobileBottomNav
        currentScreen={currentScreen}
        onNavigate={navigateTo}
        onOpenReservation={() => setIsReservationOpen(true)}
        onCloseReservation={() => setIsReservationOpen(false)}
        onOpenProfile={openProfileModal}
        onOpenCart={openCartModal}
        isReservationOpen={isReservationOpen}
      />

      {/* CheckoutModal dla pełnego procesu (desktop i po kliknięciu "Przejdź do koszyka") */}
      <CheckoutModal />

      {/* Bottom sheet koszyka - mobile */}
      {isCartOpen && (
        <div 
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-end justify-center"
          onClick={closeCartModal}
        >
          <div 
            className="bg-zinc-900 border-t border-white/10 rounded-t-3xl w-full max-w-lg animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Handle */}
            <div className="w-12 h-1 bg-white/20 rounded-full mx-auto mt-3 mb-4" />
            
            {/* Header */}
            <div className="px-6 pb-4 border-b border-white/5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-yellow-400/10 flex items-center justify-center">
                    <ShoppingCart size={24} className="text-yellow-400" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">Twój koszyk</h3>
                    <p className="text-white/50 text-sm">{itemCount} {itemCount === 1 ? 'produkt' : itemCount < 5 ? 'produkty' : 'produktów'}</p>
                  </div>
                </div>
                <button onClick={closeCartModal} className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-white/60">
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Zawartość koszyka */}
            {items.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <ShoppingCart size={48} className="text-white/20 mx-auto mb-4" />
                <p className="text-white/60 text-lg">Koszyk jest pusty</p>
                <p className="text-white/40 text-sm mt-1">Dodaj coś pysznego!</p>
              </div>
            ) : (
              <>
                {/* Lista produktów */}
                <div className="px-6 py-4 max-h-64 overflow-y-auto space-y-3">
                  {items.map((item, index) => (
                    <div key={index} className="flex items-center gap-3 bg-zinc-800/50 rounded-xl p-3">
                      <div className="flex-1 min-w-0">
                        <h4 className="text-white font-medium text-sm truncate">{item.name}</h4>
                        <p className="text-yellow-400 font-bold">{item.price} zł</p>
                      </div>
                      
                      {/* Quantity controls */}
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => removeItem(item.name)}
                          className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-white/60 active:bg-white/10"
                        >
                          {(item.quantity || 1) === 1 ? <Trash2 size={14} /> : <Minus size={14} />}
                        </button>
                        <span className="text-white font-bold w-6 text-center">{item.quantity || 1}</span>
                        <button 
                          onClick={() => addItem({ name: item.name, price: item.price })}
                          className="w-8 h-8 rounded-lg bg-yellow-400 flex items-center justify-center text-black active:bg-yellow-300"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Podsumowanie i przycisk */}
                <div className="px-6 py-4 border-t border-white/5 pb-8">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-white/60">Suma:</span>
                    <span className="text-2xl font-black text-white">{totalPrice.toFixed(2)} zł</span>
                  </div>
                  
                  <button 
                    onClick={goToFullCheckout}
                    className="w-full py-4 bg-gradient-to-r from-yellow-400 to-amber-500 text-black font-bold text-lg rounded-2xl active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
                  >
                    <span>Przejdź do zamówienia</span>
                    <ChevronRight size={20} />
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Modal profilu - rozszerzający się */}
      {isProfileOpen && (
        <div 
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-end justify-center"
          onClick={closeProfileModal}
        >
          <div 
            className={`bg-zinc-900 border-t border-white/10 rounded-t-3xl w-full max-w-lg animate-slide-up transition-all duration-300 ${
              profileStep === "initial" ? "pb-8" : "pb-6"
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Handle */}
            <div className="w-12 h-1 bg-white/20 rounded-full mx-auto mt-3 mb-4" />
            
            {/* Initial step - tylko przyciski */}
            {profileStep === "initial" && (
              <div className="px-6">
                <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center mx-auto mb-4">
                  <User size={32} className="text-white/60" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-2 text-center">Witaj!</h3>
                <p className="text-white/50 mb-6 text-center text-sm">Zaloguj się aby zobaczyć swoje zamówienia i dane.</p>
                
                <button 
                  onClick={() => setProfileStep("login")}
                  className="w-full py-4 bg-gradient-to-r from-yellow-400 to-amber-500 text-black font-bold text-lg rounded-2xl active:scale-[0.98] transition-transform"
                >
                  Zaloguj się
                </button>
                
                <button 
                  onClick={() => setProfileStep("register")}
                  className="w-full mt-3 py-4 bg-white/5 text-white font-medium rounded-2xl active:bg-white/10 transition-colors"
                >
                  Utwórz konto
                </button>
              </div>
            )}

            {/* Login step */}
            {profileStep === "login" && (
              <div className="px-6">
                <button 
                  onClick={() => setProfileStep("initial")}
                  className="flex items-center gap-2 text-white/60 mb-4"
                >
                  <ChevronLeft size={20} />
                  <span className="text-sm">Wróć</span>
                </button>
                
                <h3 className="text-2xl font-bold text-white mb-6 text-center">Zaloguj się</h3>
                
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="relative">
                    <Mail size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" />
                    <input
                      type="email"
                      placeholder="Email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl py-4 pl-12 pr-4 text-white placeholder:text-white/40 focus:outline-none focus:border-yellow-400/50"
                      required
                    />
                  </div>
                  
                  <div className="relative">
                    <Lock size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" />
                    <input
                      type={showPassword ? "text" : "password"}
                      placeholder="Hasło"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl py-4 pl-12 pr-12 text-white placeholder:text-white/40 focus:outline-none focus:border-yellow-400/50"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40"
                    >
                      {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>

                  {authError && (
                    <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl p-3">
                      {authError}
                    </div>
                  )}
                  
                  <button
                    type="submit"
                    disabled={authLoading}
                    className="w-full py-4 bg-gradient-to-r from-yellow-400 to-amber-500 text-black font-bold text-lg rounded-2xl active:scale-[0.98] transition-transform disabled:opacity-50"
                  >
                    {authLoading ? "Logowanie..." : "Zaloguj się"}
                  </button>
                </form>
                
                <p className="text-center text-white/50 text-sm mt-4">
                  Nie masz konta?{" "}
                  <button onClick={() => setProfileStep("register")} className="text-yellow-400 font-medium">
                    Zarejestruj się
                  </button>
                </p>
              </div>
            )}

            {/* Register step */}
            {profileStep === "register" && (
              <div className="px-6 max-h-[70vh] overflow-y-auto">
                <button 
                  onClick={() => setProfileStep("initial")}
                  className="flex items-center gap-2 text-white/60 mb-4"
                >
                  <ChevronLeft size={20} />
                  <span className="text-sm">Wróć</span>
                </button>
                
                <h3 className="text-2xl font-bold text-white mb-6 text-center">Utwórz konto</h3>
                
                <form onSubmit={handleRegister} className="space-y-4">
                  <div className="relative">
                    <User size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" />
                    <input
                      type="text"
                      placeholder="Imię i nazwisko"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl py-4 pl-12 pr-4 text-white placeholder:text-white/40 focus:outline-none focus:border-yellow-400/50"
                      required
                    />
                  </div>
                  
                  <div className="relative">
                    <Phone size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" />
                    <input
                      type="tel"
                      placeholder="Numer telefonu"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl py-4 pl-12 pr-4 text-white placeholder:text-white/40 focus:outline-none focus:border-yellow-400/50"
                      required
                    />
                  </div>
                  
                  <div className="relative">
                    <Mail size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" />
                    <input
                      type="email"
                      placeholder="Email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl py-4 pl-12 pr-4 text-white placeholder:text-white/40 focus:outline-none focus:border-yellow-400/50"
                      required
                    />
                  </div>
                  
                  <div className="relative">
                    <Lock size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" />
                    <input
                      type={showPassword ? "text" : "password"}
                      placeholder="Hasło"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl py-4 pl-12 pr-12 text-white placeholder:text-white/40 focus:outline-none focus:border-yellow-400/50"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40"
                    >
                      {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>

                  {authError && (
                    <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl p-3">
                      {authError}
                    </div>
                  )}
                  
                  <button
                    type="submit"
                    disabled={authLoading}
                    className="w-full py-4 bg-gradient-to-r from-yellow-400 to-amber-500 text-black font-bold text-lg rounded-2xl active:scale-[0.98] transition-transform disabled:opacity-50"
                  >
                    {authLoading ? "Rejestracja..." : "Zarejestruj się"}
                  </button>
                </form>
                
                <p className="text-center text-white/50 text-sm mt-4 pb-4">
                  Masz już konto?{" "}
                  <button onClick={() => setProfileStep("login")} className="text-yellow-400 font-medium">
                    Zaloguj się
                  </button>
                </p>
              </div>
            )}

            {/* Logged in step - Główny widok z przyciskami */}
            {profileStep === "logged" && session && (
              <div className="px-6 pb-6">
                {/* Avatar i powitanie */}
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-yellow-400 to-amber-500 flex items-center justify-center mx-auto mb-4">
                  <User size={40} className="text-black" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-1 text-center">
                  Cześć, {(session.user?.user_metadata as any)?.full_name?.split(" ")[0] || ""}!
                </h3>
                <p className="text-white/50 mb-8 text-center text-sm">{session.user?.email}</p>
                
                {/* Główne przyciski */}
                <div className="space-y-3">
                  <button 
                    onClick={() => { closeProfileModal(); navigateTo("menu"); }}
                    className="w-full py-4 bg-gradient-to-r from-yellow-400 to-amber-500 text-black font-bold text-lg rounded-2xl active:scale-[0.98] transition-transform flex items-center justify-center gap-3"
                  >
                    <ShoppingCart size={22} />
                    Nowe zamówienie
                  </button>
                  
                  <button 
                    onClick={() => { setProfileTab("orders"); setProfileStep("panel"); }}
                    className="w-full py-4 bg-white/5 border border-white/10 text-white font-semibold rounded-2xl active:bg-white/10 transition-colors flex items-center justify-center gap-3"
                  >
                    <History size={22} />
                    Historia zamówień
                  </button>
                  
                  <button 
                    onClick={() => { setProfileTab("settings"); setProfileStep("panel"); }}
                    className="w-full py-4 bg-white/5 border border-white/10 text-white font-semibold rounded-2xl active:bg-white/10 transition-colors flex items-center justify-center gap-3"
                  >
                    <Settings size={22} />
                    Ustawienia konta
                  </button>
                  
                  <button 
                    onClick={() => { setProfileTab("loyalty"); setProfileStep("panel"); }}
                    className="w-full py-4 bg-white/5 border border-white/10 text-white/60 font-semibold rounded-2xl active:bg-white/10 transition-colors flex items-center justify-center gap-3"
                  >
                    <Gift size={22} />
                    Program lojalnościowy
                    <span className="text-[10px] bg-yellow-400/20 text-yellow-400 px-2 py-0.5 rounded-full">Wkrótce</span>
                  </button>
                  
                  <button 
                    onClick={handleLogout}
                    className="w-full py-4 bg-red-500/10 border border-red-500/30 text-red-400 font-semibold rounded-2xl active:bg-red-500/20 transition-colors flex items-center justify-center gap-3"
                  >
                    <LogOut size={22} />
                    Wyloguj się
                  </button>
                </div>
              </div>
            )}

            {/* Panel step - Zakładki z treścią */}
            {profileStep === "panel" && session && (
              <div className="flex flex-col h-[85vh]">
                {/* Header z przyciskiem wstecz */}
                <div className="px-4 pt-2 pb-3 border-b border-white/10 flex-shrink-0">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setProfileStep("logged")}
                      className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-white/70"
                    >
                      <ChevronLeft size={24} />
                    </button>
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-white">
                        {profileTab === "orders" ? "Historia zamówień" : profileTab === "settings" ? "Ustawienia" : "Program lojalnościowy"}
                      </h3>
                    </div>
                  </div>
                </div>

                {/* Tabs */}
                <div className="px-4 py-3 border-b border-white/10 flex-shrink-0">
                  <div className="flex gap-1">
                    {[
                      { id: "orders" as const, label: "Zamówienia", icon: History },
                      { id: "loyalty" as const, label: "Program", icon: Gift },
                      { id: "settings" as const, label: "Ustawienia", icon: Settings },
                    ].map(tab => {
                      const Icon = tab.icon;
                      const isActive = profileTab === tab.id;
                      return (
                        <button
                          key={tab.id}
                          onClick={() => setProfileTab(tab.id)}
                          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                            isActive 
                              ? "bg-yellow-400 text-black" 
                              : "bg-white/5 text-white/60"
                          }`}
                        >
                          <Icon size={16} />
                          {tab.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto px-4 py-4">
                  {/* Orders Tab */}
                  {profileTab === "orders" && (
                    <div className="space-y-3">
                      {ordersLoading ? (
                        <div className="text-center py-8">
                          <div className="w-8 h-8 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                          <p className="text-white/50">Ładowanie...</p>
                        </div>
                      ) : orders.length === 0 ? (
                        <div className="text-center py-8">
                          <Package className="w-12 h-12 text-white/20 mx-auto mb-3" />
                          <p className="text-white/50">Brak zamówień</p>
                          <p className="text-white/30 text-sm mt-1">Złóż pierwsze zamówienie!</p>
                        </div>
                      ) : (
                        orders.map(o => {
                          const config = getStatusConfig(o.status);
                          const StatusIcon = config.icon;
                          const isExpanded = expandedOrderId === o.id;
                          const orderItems = parseItems(o.items);

                          return (
                            <div 
                              key={o.id} 
                              className={`rounded-2xl overflow-hidden transition-all duration-200 ${
                                isExpanded 
                                  ? "bg-gradient-to-b from-white/10 to-white/5 ring-1 ring-yellow-400/30" 
                                  : "bg-white/5 border border-white/10 hover:border-white/20"
                              }`}
                            >
                              <button
                                type="button"
                                onClick={() => setExpandedOrderId(isExpanded ? null : o.id)}
                                className="w-full p-4 text-left"
                              >
                                {/* Header - Status Icon + Order Info */}
                                <div className="flex items-start gap-4">
                                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-lg ${config.color}`}>
                                    <StatusIcon size={26} />
                                  </div>
                                  
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between mb-1">
                                      <span className="font-bold text-white text-lg">#{o.id}</span>
                                      <div className={`text-xs px-2.5 py-1 rounded-full font-medium ${config.color}`}>
                                        {config.label}
                                      </div>
                                    </div>
                                    
                                    <div className="flex items-center gap-2 text-white/50 text-sm mb-2">
                                      <Clock size={12} />
                                      <span>
                                        {new Date(o.created_at).toLocaleDateString("pl-PL", { 
                                          day: "numeric", 
                                          month: "long",
                                          hour: "2-digit",
                                          minute: "2-digit"
                                        })}
                                      </span>
                                    </div>

                                    {/* Order Type Badge */}
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs px-2 py-0.5 bg-white/10 rounded-full text-white/70">
                                        {o.selected_option === "delivery" ? "🚗 Dostawa" : o.selected_option === "takeaway" ? "🥡 Na wynos" : "🍽️ Na miejscu"}
                                      </span>
                                      {o.payment_status === "paid" && (
                                        <span className="text-xs px-2 py-0.5 bg-green-500/20 text-green-400 rounded-full flex items-center gap-1">
                                          <Check size={10} />
                                          Opłacone
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                {/* Footer - Price + Expand */}
                                <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/10">
                                  <div className="flex items-center gap-2">
                                    <span className="text-white/50 text-sm">Suma:</span>
                                    <span className="text-yellow-400 font-bold text-xl">{Number(o.total_price ?? 0).toFixed(2)} zł</span>
                                  </div>
                                  <div className={`flex items-center gap-1 text-sm transition-colors ${isExpanded ? "text-yellow-400" : "text-white/40"}`}>
                                    <span>{isExpanded ? "Zwiń" : "Szczegóły"}</span>
                                    {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                                  </div>
                                </div>
                              </button>

                              {/* Expanded Details */}
                              {isExpanded && (
                                <div className="px-4 pb-4 space-y-3 animate-in slide-in-from-top-2 duration-200">
                                  {/* Payment Info */}
                                  {o.payment_method && (
                                    <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl">
                                      <div className="flex items-center gap-2">
                                        <CreditCard size={16} className="text-white/50" />
                                        <span className="text-white/70 text-sm">Metoda płatności</span>
                                      </div>
                                      <span className="text-white font-medium text-sm">{o.payment_method}</span>
                                    </div>
                                  )}

                                  {/* Items List */}
                                  {orderItems.length > 0 && (
                                    <div className="bg-white/5 rounded-xl overflow-hidden">
                                      <div className="px-3 py-2 bg-white/5 border-b border-white/10">
                                        <span className="text-white/50 text-xs font-medium uppercase tracking-wider">Zamówione produkty</span>
                                      </div>
                                      <div className="p-2 space-y-1">
                                        {orderItems.slice(0, 5).map((item: any, idx: number) => (
                                          <div key={idx} className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 transition-colors">
                                            <div className="w-7 h-7 bg-gradient-to-br from-yellow-400 to-amber-500 text-black rounded-lg text-xs flex items-center justify-center font-bold shadow-sm">
                                              {item.quantity || 1}×
                                            </div>
                                            <span className="flex-1 text-white text-sm truncate">{item.name || item.title}</span>
                                            <span className="text-yellow-400/80 text-sm font-medium">{Number(item.price ?? 0).toFixed(2)} zł</span>
                                          </div>
                                        ))}
                                        {orderItems.length > 5 && (
                                          <div className="text-center py-2">
                                            <span className="text-xs text-white/40 bg-white/5 px-3 py-1 rounded-full">
                                              +{orderItems.length - 5} więcej produktów
                                            </span>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  )}

                                  {/* Reorder Button */}
                                  <button
                                    type="button"
                                    className="w-full py-3 bg-gradient-to-r from-yellow-400 to-amber-500 text-black font-semibold rounded-xl flex items-center justify-center gap-2 hover:from-yellow-300 hover:to-amber-400 transition-all shadow-lg shadow-yellow-400/20"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      // TODO: Implement reorder
                                    }}
                                  >
                                    <Repeat size={18} />
                                    Zamów ponownie
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}

                  {/* Loyalty Tab - Coming Soon */}
                  {profileTab === "loyalty" && (
                    <div className="text-center py-8">
                      <div className="w-20 h-20 bg-gradient-to-br from-yellow-400/20 to-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-4 relative">
                        <Gift size={40} className="text-yellow-400" />
                        <div className="absolute -top-1 -right-1 w-6 h-6 bg-yellow-400 rounded-full flex items-center justify-center">
                          <Clock size={14} className="text-black" />
                        </div>
                      </div>
                      <h3 className="text-xl font-bold text-white mb-2">Program Lojalnościowy</h3>
                      <p className="text-white/50 mb-4">Wkrótce dostępny!</p>
                      
                      <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-left">
                        <p className="text-sm text-white/60 mb-3">Przygotowujemy:</p>
                        <ul className="text-sm text-white/40 space-y-2">
                          <li className="flex items-center gap-2">
                            <Star size={16} className="text-yellow-400/50" />
                            Naklejki za zamówienia
                          </li>
                          <li className="flex items-center gap-2">
                            <Gift size={16} className="text-yellow-400/50" />
                            Darmowe burgery
                          </li>
                          <li className="flex items-center gap-2">
                            <Star size={16} className="text-yellow-400/50" />
                            Ekskluzywne zniżki
                          </li>
                        </ul>
                      </div>
                    </div>
                  )}

                  {/* Settings Tab */}
                  {profileTab === "settings" && (
                    <form className="space-y-4" onSubmit={handleSaveSettings}>
                      <div className="space-y-3">
                        <p className="text-sm font-medium text-white/70 flex items-center gap-2">
                          <User size={16} />
                          Dane osobowe
                        </p>
                        <div className="relative">
                          <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" />
                          <input
                            type="text"
                            placeholder="Imię i nazwisko"
                            value={localName}
                            onChange={(e) => setLocalName(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-11 pr-4 text-white placeholder:text-white/40 focus:outline-none focus:border-yellow-400/50"
                          />
                        </div>
                        <div className="relative">
                          <Phone size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" />
                          <input
                            type="tel"
                            placeholder="Telefon (+48...)"
                            value={localPhone}
                            onChange={(e) => setLocalPhone(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-11 pr-4 text-white placeholder:text-white/40 focus:outline-none focus:border-yellow-400/50"
                          />
                        </div>
                        <div className="relative">
                          <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" />
                          <input
                            type="email"
                            value={session.user?.email || ""}
                            disabled
                            className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-11 pr-4 text-white/50 cursor-not-allowed"
                          />
                        </div>
                      </div>

                      <div className="border-t border-white/10 pt-4 space-y-3">
                        <p className="text-sm font-medium text-white/70 flex items-center gap-2">
                          <Edit3 size={16} />
                          Zmiana hasła
                        </p>
                        <input
                          type="password"
                          placeholder="Obecne hasło"
                          value={oldPass}
                          onChange={(e) => setOldPass(e.target.value)}
                          className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white placeholder:text-white/40 focus:outline-none focus:border-yellow-400/50"
                        />
                        <input
                          type="password"
                          placeholder="Nowe hasło"
                          value={newPass}
                          onChange={(e) => setNewPass(e.target.value)}
                          className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white placeholder:text-white/40 focus:outline-none focus:border-yellow-400/50"
                        />
                        <input
                          type="password"
                          placeholder="Powtórz nowe hasło"
                          value={newPass2}
                          onChange={(e) => setNewPass2(e.target.value)}
                          className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white placeholder:text-white/40 focus:outline-none focus:border-yellow-400/50"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={savingSettings}
                        className="w-full py-3.5 bg-gradient-to-r from-yellow-400 to-amber-500 text-black font-bold rounded-xl disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {savingSettings ? (
                          <>
                            <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                            Zapisuję...
                          </>
                        ) : (
                          <>
                            <Check size={20} />
                            Zapisz zmiany
                          </>
                        )}
                      </button>
                    </form>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
