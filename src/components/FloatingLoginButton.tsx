// src/app/components/FloatingAuthButtons.tsx
"use client";

import React, { useState, useEffect, memo, useCallback, useRef } from "react";
import { createClientComponentClient, SupabaseClient } from "@supabase/auth-helpers-nextjs";
import { useSession, Session } from "@supabase/auth-helpers-react";
import { 
  ShoppingCart, 
  User, 
  X, 
  History, 
  Heart, 
  MapPin, 
  Settings, 
  Gift, 
  ChevronDown, 
  ChevronUp,
  Package,
  Clock,
  Check,
  Truck,
  XCircle,
  Plus,
  Trash2,
  Star,
  Bell,
  CreditCard,
  LogOut,
  Edit3,
  Home,
  Building,
  Repeat
} from "lucide-react";
import useCartStore from "../store/cartStore";
import { useRouter } from "next/navigation";
import AddressAutocomplete from "@/components/menu/AddressAutocomplete";

const TERMS_URL =
  process.env.NEXT_PUBLIC_TERMS_URL || "https://www.sisiciechanow.pl/regulamin";
const PRIVACY_URL =
  process.env.NEXT_PUBLIC_PRIVACY_URL || "https://www.sisiciechanow.pl/polityka-prywatnosci";
const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "";

// prosta, solidna walidacja
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* ------------------- utils ------------------- */
function normalizePlPhone(input: string): string | null {
  const d = String(input).replace(/\D/g, "");
  if (d.length === 9) return "+48" + d;
  if (d.startsWith("48") && d.length === 11) return "+" + d;
  if (d.startsWith("0048") && d.length === 13) return "+" + d.slice(2);
  if (/^\+48\d{9}$/.test("+" + d)) return "+48" + d.slice(-9);
  if (/^\+\d{9,15}$/.test(input)) return input;
  return null;
}

/* ------------------- Turnstile ------------------- */
const TurnstileBox: React.FC<{ onVerify: (token: string) => void }> = ({ onVerify }) => {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let rendered = false;

    function render() {
      if (rendered || !ref.current || !window.turnstile || !TURNSTILE_SITE_KEY) return;
      rendered = true;
      window.turnstile.render(ref.current, {
        sitekey: TURNSTILE_SITE_KEY,
        theme: "light",
        appearance: "always",
        callback: (token: string) => onVerify(token),
        "error-callback": () => onVerify(""),
        "timeout-callback": () => onVerify(""),
      } as any);
    }

    if (!window.turnstile) {
      const id = "cf-turnstile-api";
      if (!document.getElementById(id)) {
        const s = document.createElement("script");
        s.id = id;
        s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
        s.async = true;
        s.defer = true;
        s.onload = render;
        document.head.appendChild(s);
      } else {
        const t = setInterval(() => {
          if (window.turnstile) {
            clearInterval(t);
            render();
          }
        }, 200);
        return () => clearInterval(t);
      }
    } else {
      render();
    }
  }, [onVerify]);

  return <div ref={ref} className="cf-turnstile" />;
};

/* ------------------- Modale ------------------- */

const RegistrationModal = memo(({
  onClose,
  handleSubmitRegister,
  fullName, setFullName,
  phone, setPhone,
  email, setEmail,
  password, setPassword,
  confirmPassword, setConfirmPassword,
  captchaToken, setCaptchaToken,
  acceptTerms, setAcceptTerms,
}: {
  onClose: () => void;
  handleSubmitRegister: (e: React.FormEvent) => Promise<void>;
  fullName: string; setFullName: React.Dispatch<React.SetStateAction<string>>;
  phone: string; setPhone: React.Dispatch<React.SetStateAction<string>>;
  email: string; setEmail: React.Dispatch<React.SetStateAction<string>>;
  password: string; setPassword: React.Dispatch<React.SetStateAction<string>>;
  confirmPassword: string; setConfirmPassword: React.Dispatch<React.SetStateAction<string>>;
  captchaToken: string; setCaptchaToken: React.Dispatch<React.SetStateAction<string>>;
  acceptTerms: boolean; setAcceptTerms: React.Dispatch<React.SetStateAction<boolean>>;
}) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
    <div className="bg-zinc-900 border border-white/10 p-6 rounded-2xl max-w-md w-full relative max-h-[85vh] overflow-y-auto mx-4 shadow-2xl shadow-black/50">
      <button aria-label="Zamknij" onClick={onClose} className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors text-white/70">
        <X size={16} />
      </button>
      <h2 className="text-xl font-bold mb-6 text-center text-white">Utwórz konto</h2>
      <form onSubmit={handleSubmitRegister} className="space-y-4">
        <input
          type="text"
          placeholder="Imię i nazwisko"
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/40 focus:outline-none focus:border-yellow-400/50 transition-all"
          value={fullName}
          onChange={e => setFullName(e.target.value)}
          required
        />
        <input
          type="tel"
          inputMode="tel"
          placeholder="Telefon (+48… lub 9 cyfr)"
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/40 focus:outline-none focus:border-yellow-400/50 transition-all"
          value={phone}
          onChange={e => setPhone(e.target.value)}
          required
        />
        <input
          type="email"
          placeholder="Email"
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/40 focus:outline-none focus:border-yellow-400/50 transition-all"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Hasło"
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/40 focus:outline-none focus:border-yellow-400/50 transition-all"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Powtórz hasło"
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/40 focus:outline-none focus:border-yellow-400/50 transition-all"
          value={confirmPassword}
          onChange={e => setConfirmPassword(e.target.value)}
          required
        />

        {TURNSTILE_SITE_KEY ? (
          <div className="flex justify-center">
            <TurnstileBox onVerify={setCaptchaToken} />
            {!captchaToken && (
              <p className="mt-1 text-xs text-white/50">
                Zaznacz proszę weryfikację, aby kontynuować.
              </p>
            )}
          </div>
        ) : (
          <div className="text-xs text-amber-400/80 bg-amber-400/10 border border-amber-400/20 rounded-lg p-2">
            Uwaga: brak klucza <code>NEXT_PUBLIC_TURNSTILE_SITE_KEY</code>.
          </div>
        )}

        <label className="flex items-start gap-3 text-sm text-white/70">
          <input
            type="checkbox"
            checked={acceptTerms}
            onChange={e => setAcceptTerms(e.target.checked)}
            required
            className="mt-1 w-4 h-4 accent-yellow-400"
          />
          <span>
            Akceptuję{" "}
            <a href={TERMS_URL} target="_blank" className="text-yellow-400 hover:text-yellow-300 underline underline-offset-2">regulamin</a>{" "}
            oraz{" "}
            <a href={PRIVACY_URL} target="_blank" className="text-yellow-400 hover:text-yellow-300 underline underline-offset-2">politykę prywatności</a>.
          </span>
        </label>

        <button
          type="submit"
          className="w-full py-3 bg-gradient-to-r from-yellow-400 via-yellow-500 to-amber-500 text-black font-bold rounded-xl hover:from-yellow-300 hover:via-yellow-400 hover:to-amber-400 transition-all shadow-lg shadow-yellow-500/20"
        >
          Zarejestruj się
        </button>
      </form>
    </div>
  </div>
));
RegistrationModal.displayName = "RegistrationModal";

const SmallAuthModal: React.FC<{
  onClose: () => void;
  handleSubmitLogin: (e: React.FormEvent) => Promise<void>;
  email: string; setEmail: React.Dispatch<React.SetStateAction<string>>;
  password: string; setPassword: React.Dispatch<React.SetStateAction<string>>;
  onSwitchToLarge: () => void;
}> = ({ onClose, handleSubmitLogin, email, setEmail, password, setPassword, onSwitchToLarge }) => (
  <div className="fixed bottom-20 right-6 z-50 w-80 bg-zinc-900 border border-white/10 shadow-2xl shadow-black/50 p-5 rounded-2xl backdrop-blur-sm">
    <div className="absolute bottom-[-8px] right-8 w-4 h-4 bg-zinc-900 border-r border-b border-white/10 rotate-45" />
    <button aria-label="Zamknij" onClick={onClose} className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors text-white/70">
      <X size={16} />
    </button>
    <h2 className="text-lg font-bold mb-4 text-center text-white">Zaloguj się</h2>
    <form onSubmit={handleSubmitLogin} className="space-y-3">
      <input
        type="email"
        placeholder="Email"
        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/40 focus:outline-none focus:border-yellow-400/50 transition-all"
        value={email}
        onChange={e => setEmail(e.target.value)}
        required
      />
      <input
        type="password"
        placeholder="Hasło"
        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/40 focus:outline-none focus:border-yellow-400/50 transition-all"
        value={password}
        onChange={e => setPassword(e.target.value)}
        required
      />
      <button type="submit" className="w-full py-3 bg-gradient-to-r from-yellow-400 via-yellow-500 to-amber-500 text-black font-bold rounded-xl hover:from-yellow-300 hover:via-yellow-400 hover:to-amber-400 transition-all shadow-lg shadow-yellow-500/20">
        Zaloguj się
      </button>
    </form>
    <p className="mt-4 text-center text-sm text-white/50">
      Nie masz konta?{" "}
      <button onClick={onSwitchToLarge} className="text-yellow-400 hover:text-yellow-300 underline underline-offset-2">
        Zarejestruj się
      </button>
    </p>
  </div>
);

const SmallClientModal: React.FC<{
  onClose: () => void;
  session: Session | null;
  onSwitchToLarge: () => void;
  onLogout: () => void;
}> = ({ onClose, session, onSwitchToLarge, onLogout }) => {
  const router = useRouter();
  const name =
    (session?.user?.user_metadata as any)?.full_name ||
    session?.user?.email ||
    "Klient";
  return (
    <div className="fixed bottom-20 right-6 z-50 w-80 bg-zinc-900 border border-white/10 shadow-2xl shadow-black/50 p-5 rounded-2xl backdrop-blur-sm">
      <div className="absolute bottom-[-8px] right-8 w-4 h-4 bg-zinc-900 border-r border-b border-white/10 rotate-45" />
      <button aria-label="Zamknij" onClick={onClose} className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors text-white/70">
        <X size={16} />
      </button>
      <p className="text-center mb-4 font-semibold text-white">Hej <span className="text-yellow-400">{name}</span>!</p>
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={() => {
            router.push("/#menu");
            onClose();
          }}
          className="w-full py-3 bg-gradient-to-r from-yellow-400 via-yellow-500 to-amber-500 text-black font-bold rounded-xl hover:from-yellow-300 hover:via-yellow-400 hover:to-amber-400 transition-all shadow-lg shadow-yellow-500/20"
        >
          Nowe zamówienie
        </button>
        <button
          type="button"
          onClick={onSwitchToLarge}
          className="w-full py-3 bg-white/5 border border-white/10 text-white rounded-xl hover:bg-white/10 transition-all"
        >
          Historia zamówień
        </button>
        <button
          type="button"
          onClick={onSwitchToLarge}
          className="w-full py-3 bg-white/10 text-white rounded-xl hover:bg-white/20 transition-all"
        >
          Panel Klienta
        </button>
        <button
          type="button"
          onClick={onLogout}
          className="w-full py-3 bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl hover:bg-red-500/20 transition-all"
        >
          Wyloguj się
        </button>
      </div>
    </div>
  );
};

const OrdersHistory: React.FC<{ supabaseClient: SupabaseClient; onRepeat: (o: any) => void }> = ({ supabaseClient, onRepeat }) => {
  const session = useSession();
  const userId = session?.user?.id;
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    supabaseClient
      .from("orders")
      .select("id, created_at, status, total_price, selected_option, items, customer_name, phone, address, payment_method, payment_status")
      .eq("user", userId)
      .order("created_at", { ascending: false })
      .limit(20)
      .then(({ data, error }) => {
        if (!error && data) setOrders(data);
        setLoading(false);
      });
  }, [userId, supabaseClient]);

  if (!userId) return (
    <div className="text-center py-8">
      <Package className="w-12 h-12 text-white/20 mx-auto mb-3" />
      <p className="text-white/50">Zaloguj się, aby zobaczyć historię.</p>
    </div>
  );
  
  if (loading) return (
    <div className="text-center py-8">
      <div className="w-8 h-8 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
      <p className="text-white/50">Ładowanie zamówień…</p>
    </div>
  );
  
  if (!orders.length) return (
    <div className="text-center py-8">
      <Package className="w-12 h-12 text-white/20 mx-auto mb-3" />
      <p className="text-white/50">Nie masz jeszcze żadnych zamówień.</p>
      <p className="text-white/30 text-sm mt-1">Złóż pierwsze zamówienie!</p>
    </div>
  );

  const statusConfig = (s?: string) => {
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

  const optionLabel = (opt?: string) => 
    opt === "delivery" ? "🚗 Dostawa" : opt === "takeaway" ? "🥡 Na wynos" : "🍽️ Na miejscu";

  const parseItems = (items: any) => {
    try {
      return typeof items === "string" ? JSON.parse(items) : (items || []);
    } catch { return []; }
  };

  return (
    <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1 scrollbar-hide">
      {orders.map(o => {
        const config = statusConfig(o.status);
        const StatusIcon = config.icon;
        const isExpanded = expandedId === o.id;
        const items = parseItems(o.items);

        return (
          <div 
            key={o.id} 
            className="bg-white/5 border border-white/10 rounded-xl overflow-hidden transition-all hover:border-white/20"
          >
            {/* Header */}
            <button
              type="button"
              onClick={() => setExpandedId(isExpanded ? null : o.id)}
              className="w-full p-4 flex items-center justify-between text-left"
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${config.color}`}>
                  <StatusIcon className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-semibold text-white flex items-center gap-2">
                    #{o.id}
                    <span className={`text-xs px-2 py-0.5 rounded-full ${config.color}`}>
                      {config.label}
                    </span>
                  </p>
                  <p className="text-sm text-white/50">
                    {new Date(o.created_at).toLocaleDateString("pl-PL", { 
                      day: "numeric", 
                      month: "short", 
                      hour: "2-digit", 
                      minute: "2-digit" 
                    })}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-yellow-400 font-bold">{Number(o.total_price ?? 0).toFixed(2)} zł</span>
                {isExpanded ? <ChevronUp className="w-5 h-5 text-white/40" /> : <ChevronDown className="w-5 h-5 text-white/40" />}
              </div>
            </button>

            {/* Expanded content */}
            {isExpanded && (
              <div className="px-4 pb-4 border-t border-white/10 pt-3 space-y-3">
                {/* Order type */}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-white/50">Typ zamówienia:</span>
                  <span className="text-white">{optionLabel(o.selected_option)}</span>
                </div>

                {/* Payment */}
                {o.payment_method && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-white/50">Płatność:</span>
                    <span className="text-white flex items-center gap-1">
                      <CreditCard className="w-4 h-4" />
                      {o.payment_method === "Online" ? "Online" : o.payment_method}
                      {o.payment_status === "paid" && <Check className="w-4 h-4 text-green-400" />}
                    </span>
                  </div>
                )}

                {/* Address */}
                {o.address && (
                  <div className="flex items-start gap-2 text-sm">
                    <MapPin className="w-4 h-4 text-white/50 mt-0.5 flex-shrink-0" />
                    <span className="text-white/70">{o.address}</span>
                  </div>
                )}

                {/* Items */}
                {items.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm text-white/50 font-medium">Produkty:</p>
                    <div className="space-y-1.5">
                      {items.slice(0, 5).map((item: any, idx: number) => (
                        <div key={idx} className="flex items-center justify-between text-sm bg-white/5 rounded-lg px-3 py-2">
                          <span className="text-white flex items-center gap-2">
                            <span className="w-5 h-5 bg-yellow-400/20 text-yellow-400 rounded text-xs flex items-center justify-center font-bold">
                              {item.quantity || 1}
                            </span>
                            {item.name || item.title}
                          </span>
                          <span className="text-white/50">{Number(item.price ?? 0).toFixed(2)} zł</span>
                        </div>
                      ))}
                      {items.length > 5 && (
                        <p className="text-xs text-white/40 text-center">+{items.length - 5} więcej…</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Repeat order button */}
                <button
                  type="button"
                  onClick={() => onRepeat(o)}
                  className="w-full py-2.5 bg-gradient-to-r from-yellow-400 via-yellow-500 to-amber-500 text-black font-bold rounded-xl hover:from-yellow-300 hover:via-yellow-400 hover:to-amber-400 transition-all flex items-center justify-center gap-2"
                >
                  <Repeat className="w-4 h-4" />
                  Zamów ponownie
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

const LoyaltyProgram: React.FC<{ supabaseClient: SupabaseClient }> = ({ }) => {
  return (
    <div className="space-y-6">
      {/* Coming soon overlay */}
      <div className="text-center py-8">
        <div className="w-20 h-20 bg-gradient-to-br from-yellow-400/20 to-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-4 relative">
          <Gift className="w-10 h-10 text-yellow-400" />
          <div className="absolute -top-1 -right-1 w-6 h-6 bg-yellow-400 rounded-full flex items-center justify-center">
            <Clock className="w-3.5 h-3.5 text-black" />
          </div>
        </div>
        <h3 className="text-xl font-bold text-white mb-2">Program Lojalnościowy</h3>
        <p className="text-white/50 mb-4">Wkrótce dostępny!</p>
        
        <div className="bg-white/5 border border-white/10 rounded-xl p-4 max-w-xs mx-auto">
          <p className="text-sm text-white/60 mb-3">Przygotowujemy dla Ciebie:</p>
          <ul className="text-sm text-white/40 space-y-2 text-left">
            <li className="flex items-center gap-2">
              <Star className="w-4 h-4 text-yellow-400/50" />
              Naklejki za zamówienia
            </li>
            <li className="flex items-center gap-2">
              <Gift className="w-4 h-4 text-yellow-400/50" />
              Darmowe burgery
            </li>
            <li className="flex items-center gap-2">
              <Star className="w-4 h-4 text-yellow-400/50" />
              Ekskluzywne zniżki
            </li>
          </ul>
        </div>
        
        <p className="text-white/30 text-xs mt-4">Śledź nasze social media!</p>
      </div>
    </div>
  );
};

/* -------- Ulubione produkty -------- */
const FavoritesSection: React.FC<{ supabaseClient: SupabaseClient; onAddToCart: (item: any) => void }> = ({ supabaseClient, onAddToCart }) => {
  const session = useSession();
  const userId = session?.user?.id;
  const [favorites, setFavorites] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    supabaseClient
      .from("favorites")
      .select("id, product_id, product_name, product_price, product_image")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(10)
      .then(({ data, error }) => {
        if (!error && data) setFavorites(data);
        setLoading(false);
      });
  }, [userId, supabaseClient]);

  const removeFavorite = async (id: number) => {
    await supabaseClient.from("favorites").delete().eq("id", id);
    setFavorites(prev => prev.filter(f => f.id !== id));
  };

  if (!userId) return (
    <div className="text-center py-8">
      <Heart className="w-12 h-12 text-white/20 mx-auto mb-3" />
      <p className="text-white/50">Zaloguj się, aby zobaczyć ulubione.</p>
    </div>
  );

  if (loading) return (
    <div className="text-center py-8">
      <div className="w-8 h-8 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
      <p className="text-white/50">Ładowanie ulubionych…</p>
    </div>
  );

  if (!favorites.length) return (
    <div className="text-center py-8">
      <Heart className="w-12 h-12 text-white/20 mx-auto mb-3" />
      <p className="text-white/50">Brak ulubionych produktów.</p>
      <p className="text-white/30 text-sm mt-1">Dodaj produkty klikając ♡ przy zamówieniu!</p>
    </div>
  );

  return (
    <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1 scrollbar-hide">
      {favorites.map(f => (
        <div key={f.id} className="bg-white/5 border border-white/10 rounded-xl p-3 flex items-center gap-3">
          {f.product_image && (
            <img 
              src={f.product_image} 
              alt={f.product_name} 
              className="w-14 h-14 rounded-lg object-cover bg-white/10"
            />
          )}
          <div className="flex-1 min-w-0">
            <p className="font-medium text-white truncate">{f.product_name}</p>
            <p className="text-yellow-400 text-sm font-semibold">{Number(f.product_price ?? 0).toFixed(2)} zł</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onAddToCart({ id: f.product_id, name: f.product_name, price: f.product_price })}
              className="w-9 h-9 bg-yellow-400 text-black rounded-lg flex items-center justify-center hover:bg-yellow-300 transition-all"
            >
              <Plus className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={() => removeFavorite(f.id)}
              className="w-9 h-9 bg-white/10 text-white/60 rounded-lg flex items-center justify-center hover:bg-red-500/20 hover:text-red-400 transition-all"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

/* -------- Zarządzanie adresami -------- */
const AddressesSection: React.FC<{ supabaseClient: SupabaseClient }> = ({ supabaseClient }) => {
  const session = useSession();
  const userId = session?.user?.id;
  const [addresses, setAddresses] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [newAddress, setNewAddress] = useState("");
  const [newLabel, setNewLabel] = useState<"home" | "work" | "other">("home");

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    supabaseClient
      .from("user_addresses")
      .select("id, label, address, is_default")
      .eq("user_id", userId)
      .order("is_default", { ascending: false })
      .then(({ data, error }) => {
        if (!error && data) setAddresses(data);
        setLoading(false);
      });
  }, [userId, supabaseClient]);

  const addAddress = async () => {
    if (!newAddress.trim() || !userId) return;
    const { data, error } = await supabaseClient
      .from("user_addresses")
      .insert({ user_id: userId, label: newLabel, address: newAddress, is_default: addresses.length === 0 })
      .select()
      .single();
    if (!error && data) {
      setAddresses(prev => [...prev, data]);
      setNewAddress("");
      setShowAdd(false);
    }
  };

  const removeAddress = async (id: number) => {
    await supabaseClient.from("user_addresses").delete().eq("id", id);
    setAddresses(prev => prev.filter(a => a.id !== id));
  };

  const setDefault = async (id: number) => {
    if (!userId) return;
    await supabaseClient.from("user_addresses").update({ is_default: false }).eq("user_id", userId);
    await supabaseClient.from("user_addresses").update({ is_default: true }).eq("id", id);
    setAddresses(prev => prev.map(a => ({ ...a, is_default: a.id === id })));
  };

  const labelIcon = (label: string) => {
    switch(label) {
      case "home": return <Home className="w-4 h-4" />;
      case "work": return <Building className="w-4 h-4" />;
      default: return <MapPin className="w-4 h-4" />;
    }
  };

  const labelName = (label: string) => {
    switch(label) {
      case "home": return "Dom";
      case "work": return "Praca";
      default: return "Inny";
    }
  };

  if (!userId) return (
    <div className="text-center py-8">
      <MapPin className="w-12 h-12 text-white/20 mx-auto mb-3" />
      <p className="text-white/50">Zaloguj się, aby zarządzać adresami.</p>
    </div>
  );

  if (loading) return (
    <div className="text-center py-8">
      <div className="w-8 h-8 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
      <p className="text-white/50">Ładowanie adresów…</p>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Address list */}
      {addresses.length > 0 ? (
        <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-1 scrollbar-hide">
          {addresses.map(a => (
            <div 
              key={a.id} 
              className={`bg-white/5 border rounded-xl p-3 flex items-start gap-3 ${
                a.is_default ? "border-yellow-400/50" : "border-white/10"
              }`}
            >
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                a.is_default ? "bg-yellow-400/20 text-yellow-400" : "bg-white/10 text-white/50"
              }`}>
                {labelIcon(a.label)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-white">{labelName(a.label)}</p>
                  {a.is_default && (
                    <span className="text-[10px] px-1.5 py-0.5 bg-yellow-400/20 text-yellow-400 rounded-full font-medium">
                      Domyślny
                    </span>
                  )}
                </div>
                <p className="text-sm text-white/50 truncate">{a.address}</p>
              </div>
              <div className="flex items-center gap-1">
                {!a.is_default && (
                  <button
                    type="button"
                    onClick={() => setDefault(a.id)}
                    className="w-8 h-8 bg-white/10 text-white/60 rounded-lg flex items-center justify-center hover:bg-yellow-400/20 hover:text-yellow-400 transition-all"
                    title="Ustaw jako domyślny"
                  >
                    <Star className="w-4 h-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => removeAddress(a.id)}
                  className="w-8 h-8 bg-white/10 text-white/60 rounded-lg flex items-center justify-center hover:bg-red-500/20 hover:text-red-400 transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-6">
          <MapPin className="w-10 h-10 text-white/20 mx-auto mb-2" />
          <p className="text-white/50 text-sm">Brak zapisanych adresów</p>
        </div>
      )}

      {/* Add new address */}
      {showAdd ? (
        <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3">
          <div className="flex gap-2">
            {(["home", "work", "other"] as const).map(l => (
              <button
                key={l}
                type="button"
                onClick={() => setNewLabel(l)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-1.5 transition-all ${
                  newLabel === l 
                    ? "bg-yellow-400 text-black" 
                    : "bg-white/10 text-white/60 hover:bg-white/20"
                }`}
              >
                {labelIcon(l)}
                {labelName(l)}
              </button>
            ))}
          </div>
          <AddressAutocomplete
            onAddressSelect={(addr) => setNewAddress(addr)}
            setCity={() => {}}
            setPostalCode={() => {}}
            setFlatNumber={() => {}}
          />
          {newAddress && (
            <div className="bg-white/5 rounded-lg px-3 py-2 text-sm text-white/70">
              {newAddress}
            </div>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => { setShowAdd(false); setNewAddress(""); }}
              className="flex-1 py-2.5 bg-white/10 text-white rounded-xl hover:bg-white/20 transition-all"
            >
              Anuluj
            </button>
            <button
              type="button"
              onClick={addAddress}
              disabled={!newAddress.trim()}
              className="flex-1 py-2.5 bg-yellow-400 text-black font-bold rounded-xl hover:bg-yellow-300 transition-all disabled:opacity-50"
            >
              Zapisz
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowAdd(true)}
          className="w-full py-3 border-2 border-dashed border-white/20 rounded-xl text-white/50 hover:border-yellow-400/50 hover:text-yellow-400 transition-all flex items-center justify-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Dodaj nowy adres
        </button>
      )}
    </div>
  );
};

/* ------------------- Main ------------------- */

export default function FloatingAuthButtons() {
  const router = useRouter();
  const session = useSession();
  const supabase = createClientComponentClient(); // PKCE (domyślnie)
  const isLoggedIn = !!session?.user;

  const toggleCart = useCartStore(s => s.toggleCart);
  const items = useCartStore(s => s.items);
  const itemCount = items.reduce((sum, i) => sum + (i.quantity || 0), 0);

  const [modalType, setModalType] = useState<"small" | "large">("small");
  const [showModal, setShowModal] = useState(false);

  // logowanie
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmitLogin = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return alert("Błąd logowania: " + error.message);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return alert("Brak użytkownika");
      const { data: profile, error: profileErr } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      if (profileErr) console.warn("Błąd pobierania profilu:", profileErr);
      const role = (profile as any)?.role;
      if (role === "admin" || role === "employee") {
        alert("Jesteś pracownikiem → Panel Admina");
        router.push("/admin");
        return;
      }
      alert("Zalogowano pomyślnie!");
      setShowModal(false);
      router.refresh();
    },
    [email, password, supabase, router]
  );

  // rejestracja
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [captchaToken, setCaptchaToken] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);

  const handleSubmitRegister = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      if (!emailRegex.test(email)) return alert("Podaj poprawny adres e-mail.");
      if (!acceptTerms) return alert("Musisz zaakceptować regulamin i politykę prywatności.");
      if (!captchaToken && TURNSTILE_SITE_KEY) return alert("Potwierdź proszę captcha.");
      if (password !== confirmPassword) return alert("Hasła muszą być identyczne.");

      const normalizedPhone = normalizePlPhone(phone);
      if (!normalizedPhone) return alert("Podaj prawidłowy polski numer telefonu (9 cyfr lub +48…).");

      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/verify?next=/`,
          data: {
            role: "client",
            full_name: fullName,
            phone: normalizedPhone,
            legal_accept: { terms: true, privacy: true, at: new Date().toISOString() },
          },
        },
      });

      if (signUpError) return alert("Błąd: " + signUpError.message);

      alert("Zarejestrowano! Sprawdź skrzynkę i potwierdź adres e-mail.");
      setShowModal(false);
    },
    [email, password, confirmPassword, acceptTerms, captchaToken, phone, fullName, supabase]
  );

  const handleLogout = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) alert("Błąd wylogowania: " + error.message);
    else {
      alert("Wylogowano");
      router.refresh();
      setShowModal(false);
    }
  }, [supabase, router]);

  const repeatOrder = useCallback(
    (o: any) => {
      try {
        const items = typeof o.items === "string" ? JSON.parse(o.items) : (o.items || []);
        localStorage.setItem("reorder_items", JSON.stringify(items));
      } catch {}
      router.push("/#menu");
    },
    [router]
  );

  return (
    <>
      {/* przyciski - ukryte na mobile */}
      <div className="fixed bottom-6 right-6 z-50 hidden md:flex items-center gap-6 pointer-events-auto">
        <button
          type="button"
          aria-label="Użytkownik"
          onClick={() => {
            setModalType("small");
            setShowModal(true);
          }}
          className="w-11 h-11 rounded-full bg-zinc-900/90 backdrop-blur-sm border border-white/10 shadow-lg flex items-center justify-center hover:bg-zinc-800 hover:border-white/20 transition-all duration-200"
        >
          <User className="text-white/80 w-5 h-5" />
        </button>
        <button
          type="button"
          aria-label="Koszyk"
          onClick={() => toggleCart()}
          className="w-12 h-12 rounded-full bg-yellow-400 shadow-lg shadow-yellow-400/20 flex items-center justify-center hover:bg-yellow-300 hover:scale-105 transition-all duration-200 relative"
        >
          <ShoppingCart className="text-black w-5 h-5" />
          {itemCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-black text-yellow-400 text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
              {itemCount}
            </span>
          )}
        </button>
      </div>

      {showModal && (
        <>
          {modalType === "small" ? (
            isLoggedIn ? (
              <SmallClientModal
                onClose={() => setShowModal(false)}
                session={session}
                onSwitchToLarge={() => setModalType("large")}
                onLogout={handleLogout}
              />
            ) : (
              <SmallAuthModal
                onClose={() => setShowModal(false)}
                handleSubmitLogin={handleSubmitLogin}
                email={email}
                setEmail={setEmail}
                password={password}
                setPassword={setPassword}
                onSwitchToLarge={() => setModalType("large")}
              />
            )
          ) : isLoggedIn ? (
            <ClientPanelWithTabsWrapper
              onClose={() => setShowModal(false)}
              supabaseClient={supabase}
              repeatOrder={repeatOrder}
              onLogout={handleLogout}
            />
          ) : (
            <RegistrationModal
              onClose={() => setShowModal(false)}
              handleSubmitRegister={handleSubmitRegister}
              fullName={fullName}
              setFullName={setFullName}
              phone={phone}
              setPhone={setPhone}
              email={email}
              setEmail={setEmail}
              password={password}
              setPassword={setPassword}
              confirmPassword={confirmPassword}
              setConfirmPassword={setConfirmPassword}
              captchaToken={captchaToken}
              setCaptchaToken={setCaptchaToken}
              acceptTerms={acceptTerms}
              setAcceptTerms={setAcceptTerms}
            />
          )}
        </>
      )}
    </>
  );
}

/* -------- Panel klienta (tabs) -------- */

const ClientPanelWithTabsWrapper: React.FC<{
  onClose: () => void;
  supabaseClient: SupabaseClient;
  repeatOrder: (o: any) => void;
  onLogout: () => void;
}> = ({ onClose, supabaseClient, repeatOrder, onLogout }) => {
  const session = useSession();
  const router = useRouter();
  const addItem = useCartStore(s => s.addItem);
  const [tab, setTab] = useState<"orders" | "favorites" | "addresses" | "loyalty" | "settings">("orders");

  const [localName, setLocalName] = useState<string>(
    ((session?.user?.user_metadata as any)?.full_name as string) || ""
  );
  const [localPhone, setLocalPhone] = useState<string>(
    ((session?.user?.user_metadata as any)?.phone as string) || ""
  );
  const [localEmail, setLocalEmail] = useState<string>(session?.user?.email || "");
  const [oldPass, setOldPass] = useState("");
  const [newPass, setNewPass] = useState("");
  const [newPass2, setNewPass2] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

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
        const { error: reauthErr } = await supabaseClient.auth.signInWithPassword({
          email: localEmail,
          password: oldPass,
        });
        if (reauthErr) {
          alert("Stare hasło nieprawidłowe!");
          return;
        }
        const { error: updErr } = await supabaseClient.auth.updateUser({ password: newPass });
        if (updErr) {
          alert("Błąd zmiany hasła: " + updErr.message);
          return;
        }
      }

      const { error: updMeta } = await supabaseClient.auth.updateUser({
        data: { full_name: localName, phone: norm },
      });
      if (updMeta) {
        alert("Błąd zapisu profilu: " + updMeta.message);
        return;
      }

      alert("Ustawienia zapisane!");
      setOldPass("");
      setNewPass("");
      setNewPass2("");
    } finally {
      setSaving(false);
    }
  };

  const handleAddToCart = (item: any) => {
    addItem({ ...item, quantity: 1, selectedAddons: [] });
    alert(`Dodano "${item.name}" do koszyka!`);
  };

  const tabs = [
    { id: "orders", label: "Zamówienia", icon: History },
    { id: "favorites", label: "Ulubione", icon: Heart },
    { id: "addresses", label: "Adresy", icon: MapPin },
    { id: "loyalty", label: "Program", icon: Gift },
    { id: "settings", label: "Profil", icon: Settings },
  ] as const;

  const userName = ((session?.user?.user_metadata as any)?.full_name as string)?.split(" ")[0] || "Użytkowniku";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-zinc-900 border border-white/10 rounded-2xl w-full max-w-2xl relative max-h-[90vh] overflow-hidden shadow-2xl shadow-black/50 flex flex-col">
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-white/10 flex-shrink-0">
          <button 
            aria-label="Zamknij" 
            onClick={onClose} 
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors text-white/70"
          >
            <X size={16} />
          </button>
          
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-yellow-400 to-amber-500 flex items-center justify-center flex-shrink-0">
              <User className="w-7 h-7 text-black" />
            </div>
            <div>
              <p className="text-xl font-bold text-white">Cześć, {userName}!</p>
              <p className="text-sm text-white/50">{session?.user?.email}</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="px-4 sm:px-6 py-3 border-b border-white/10 flex-shrink-0 overflow-x-auto scrollbar-hide">
          <div className="flex gap-1 min-w-max">
            {tabs.map(t => {
              const Icon = t.icon;
              const isActive = tab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                    isActive 
                      ? "bg-yellow-400 text-black" 
                      : "text-white/60 hover:text-white hover:bg-white/10"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{t.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {tab === "orders" && (
            <OrdersHistory supabaseClient={supabaseClient} onRepeat={repeatOrder} />
          )}
          
          {tab === "favorites" && (
            <FavoritesSection supabaseClient={supabaseClient} onAddToCart={handleAddToCart} />
          )}
          
          {tab === "addresses" && (
            <AddressesSection supabaseClient={supabaseClient} />
          )}
          
          {tab === "loyalty" && (
            <LoyaltyProgram supabaseClient={supabaseClient} />
          )}
          
          {tab === "settings" && (
            <form className="space-y-4" onSubmit={handleSaveSettings}>
              {/* Profile info */}
              <div className="space-y-3">
                <p className="text-sm font-medium text-white/70 flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Dane osobowe
                </p>
                <input
                  type="text"
                  placeholder="Imię i nazwisko"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/40 focus:outline-none focus:border-yellow-400/50 transition-all"
                  value={localName}
                  onChange={e => setLocalName(e.target.value)}
                  required
                />
                <input
                  type="tel"
                  placeholder="Telefon (+48…)"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/40 focus:outline-none focus:border-yellow-400/50 transition-all"
                  value={localPhone}
                  onChange={e => setLocalPhone(e.target.value)}
                  required
                />
                <input
                  type="email"
                  placeholder="Email"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white/50 cursor-not-allowed"
                  value={localEmail}
                  readOnly
                  disabled
                />
                <p className="text-xs text-white/30">Email nie może być zmieniony</p>
              </div>

              {/* Password change */}
              <div className="border-t border-white/10 pt-4 space-y-3">
                <p className="text-sm font-medium text-white/70 flex items-center gap-2">
                  <Edit3 className="w-4 h-4" />
                  Zmiana hasła (opcjonalnie)
                </p>
                <input
                  type="password"
                  placeholder="Obecne hasło"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/40 focus:outline-none focus:border-yellow-400/50 transition-all"
                  value={oldPass}
                  onChange={e => setOldPass(e.target.value)}
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    type="password"
                    placeholder="Nowe hasło"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/40 focus:outline-none focus:border-yellow-400/50 transition-all"
                    value={newPass}
                    onChange={e => setNewPass(e.target.value)}
                  />
                  <input
                    type="password"
                    placeholder="Powtórz nowe hasło"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/40 focus:outline-none focus:border-yellow-400/50 transition-all"
                    value={newPass2}
                    onChange={e => setNewPass2(e.target.value)}
                  />
                </div>
              </div>

              {/* Submit button */}
              <button 
                type="submit" 
                disabled={saving}
                className="w-full py-3 bg-gradient-to-r from-yellow-400 via-yellow-500 to-amber-500 text-black font-bold rounded-xl hover:from-yellow-300 hover:via-yellow-400 hover:to-amber-400 transition-all shadow-lg shadow-yellow-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saving ? (
                  <>
                    <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                    Zapisuję…
                  </>
                ) : (
                  <>
                    <Check className="w-5 h-5" />
                    Zapisz zmiany
                  </>
                )}
              </button>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-6 border-t border-white/10 flex-shrink-0">
          <div className="flex flex-col sm:flex-row gap-2">
            <button
              type="button"
              onClick={() => { onClose(); router.push("/#menu"); }}
              className="flex-1 py-3 bg-gradient-to-r from-yellow-400 via-yellow-500 to-amber-500 text-black font-bold rounded-xl hover:from-yellow-300 hover:via-yellow-400 hover:to-amber-400 transition-all flex items-center justify-center gap-2"
            >
              <ShoppingCart className="w-5 h-5" />
              Nowe zamówienie
            </button>
            <button
              type="button"
              onClick={onLogout}
              className="sm:w-auto py-3 px-6 bg-red-500/10 border border-red-500/30 text-red-400 font-medium rounded-xl hover:bg-red-500/20 transition-all flex items-center justify-center gap-2"
            >
              <LogOut className="w-5 h-5" />
              <span className="sm:hidden">Wyloguj</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
