// src/components/menu/CheckoutModal.tsx
"use client";

import React, { useState, useEffect, useMemo, useRef, useDeferredValue, useCallback } from "react";
import Script from "next/script";
import { X, MapPin, ShoppingBag, Truck } from "lucide-react";
import useIsClient from "@/lib/useIsClient";
import useCartStore from "@/store/cartStore";
import { createClient } from "@supabase/supabase-js";
import QRCode from "react-qr-code";
import AddressAutocomplete from "@/components/menu/AddressAutocomplete";
import { useSession } from "@supabase/auth-helpers-react";
import { toZonedTime } from "date-fns-tz";
import clsx from "clsx";
import { createPortal } from "react-dom";

declare global {
  interface Window {
    turnstile?: {
      render: (
        el: Element,
        opts: {
          sitekey: string;
          callback?: (token: string) => void;
          "error-callback"?: () => void;
          "expired-callback"?: () => void;
          "timeout-callback"?: () => void;
          retry?: "never" | "auto";
          theme?: "auto" | "light" | "dark";
          appearance?: "always" | "execute" | "interaction-only";
          ["refresh-expired"]?: "auto" | "manual";
          action?: string;
        }
      ) => any;
      reset: (id?: any) => void;
      remove: (id: any) => void;
      execute?: (id: any) => void;
      getResponse?: (id: any) => string | null;
    };
    onTsReady?: () => void;
  }
}

const Spinner = () => (
  <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" className="opacity-25" />
    <path d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" fill="currentColor" className="opacity-75" />
  </svg>
);

const getSupabase = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Missing Supabase environment variables");
  return createClient(url, key);
};

let _supabase: ReturnType<typeof getSupabase> | null = null;
const supabase = new Proxy({} as ReturnType<typeof getSupabase>, {
  get(_, prop) {
    if (!_supabase) _supabase = getSupabase();
    return (_supabase as any)[prop];
  },
});

const TERMS_VERSION = process.env.NEXT_PUBLIC_TERMS_VERSION || "2025-09-15";
const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "";
const THANKS_QR_URL = process.env.NEXT_PUBLIC_REVIEW_QR_URL || "https://g.co/kgs/47NSDMH";


type Zone = {
  id: string;
  min_distance_km: number;
  max_distance_km: number;
  min_order_value: number;
  cost: number;
  cost_fixed?: number;
  cost_per_km?: number;
  free_over: number | null;
  eta_min_minutes: number;
  eta_max_minutes: number;
  pricing_type?: "per_km" | "flat";
  active?: boolean;
};

type Addon = {
  id: string;
  name: string;
  price: number;
  category: string;
  available: boolean;
};

const SAUCES = [
  "Amerykański","Ketchup","Majonez","Musztarda","Meksykański","Serowy chili","Czosnkowy","Musztardowo-miodowy","BBQ",
];
const PREMIUM_ADDONS = ["Płynny ser"];
const AVAILABLE_ADDONS = ["Ser","Bekon","Jalapeño","Ogórek","Rukola","Czerwona cebula","Pomidor","Pikle","Nachosy","Konfitura z cebuli","Gruszka","Ser cheddar", ...PREMIUM_ADDONS, ...SAUCES];

/* helper ceny: zamienia "20,90" -> 20.90 */
const toPrice = (v: any): number => {
  if (typeof v === "number" && Number.isFinite(v)) return Math.round(v * 100) / 100;
  if (typeof v === "string") {
    const s = v.replace(/[^0-9,.\-]/g, "").replace(",", ".");
    const n = Number(s);
    return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
  }
  return 0;
};

type Product = { id: number; name: string; category: string | null; subcategory: string | null; available_addons: string[] | null };

/* === normalizacja nazw dla pewnego dopasowania product_id === */
const normalizeName = (s?: string) =>
  (s || "")
    .toLowerCase()
    .replace(/[ą]/g, "a")
    .replace(/[ć]/g, "c")
    .replace(/[ę]/g, "e")
    .replace(/[ł]/g, "l")
    .replace(/[ń]/g, "n")
    .replace(/[ó]/g, "o")
    .replace(/[ś]/g, "s")
    .replace(/[żź]/g, "z")
    .replace(/[\u2013\u2014\-–—]+/g, " ") // różne myślniki → spacja
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/* helpers */
const buildClientDeliveryTime = (
  selectedOption: string | null,
  deliveryTimeOption: "asap" | "schedule",
  scheduledTime: string
): string | null => {
  if (selectedOption !== "delivery") return null;
  if (deliveryTimeOption === "asap") return "asap";
  // krótkie "HH:mm" zgodnie z kolumną
  return scheduledTime;
};

const safeFetch = async (url: string, opts: RequestInit) => {
  const res = await fetch(url, opts);
  const text = await res.text();
  let data: any;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  if (!res.ok) {
    console.error("API error:", { url, status: res.status, body: data });
    throw new Error(data.error || data.message || `HTTP ${res.status}`);
  }
  return data;
};

/* burger/mięso */
const inferDefaultMeat = (meta?: Product, name?: string): "wołowina" | "kurczak" | null => {
  const n = (name || meta?.name || "").toLowerCase();
  const cat = (meta?.category || "").toLowerCase();
  const sub = (meta?.subcategory || "").toLowerCase();

  if (sub.includes("vege") || n.includes("vege")) return null;
  if (sub.includes("kurczak") || n.includes("chicken")) return "kurczak";
  if (cat === "burger" || n.includes("burger")) return "wołowina";
  return null;
};

const isBurger = (meta?: Product, name?: string) => {
  const cat = (meta?.category || "").toLowerCase();
  const n = (name || meta?.name || "").toLowerCase();
  return cat === "burger" || n.includes("burger");
};

const isFries = (meta?: Product, name?: string) => {
  const n = (name || meta?.name || "").toLowerCase();
  const cat = (meta?.category || "").toLowerCase();
  const sub = (meta?.subcategory || "").toLowerCase();

  // łapiemy: "frytki", "fryty", "fries" + ewentualne odmiany
  return (
    n.includes("fryt") ||
    sub.includes("fryt") ||
    cat.includes("fryt") ||
    n.includes("fries")
  );
};

// Kaucja za butelki/puszki (1 zł) - dla napojów oprócz wody
const DEPOSIT_AMOUNT = 1;

const isDrinkWithDeposit = (meta?: Product, name?: string) => {
  const cat = (meta?.category || "").toLowerCase();
  const n = (name || meta?.name || "").toLowerCase();
  
  // Sprawdź czy to napój
  const isDrink = cat === "napoje" || cat === "napój";
  if (!isDrink) return false;
  
  // Woda nie ma kaucji
  const isWater = n.includes("woda") || n.includes("kropla");
  return !isWater;
};

const MEAT_OPTIONS: Array<"wołowina" | "kurczak"> = ["wołowina", "kurczak"];

/* child */
const ProductItem: React.FC<{
  prod: any;
  meta?: Product | undefined;
  defaultMeat: "wołowina" | "kurczak" | null;
  getAddonPrice: (addonName: string) => number;
  allAddons: Addon[];
  helpers: {
    changeMeatType: (name: string, type: "wołowina" | "kurczak") => void;
    addExtraMeat: (name: string) => void;
    removeExtraMeat: (name: string) => void;
    addAddon: (name: string, addon: string) => void;
    removeAddon: (name: string, addon: string) => void;
    swapIngredient: (name: string, from: string, to: string) => void;
    removeItem: (name: string) => void;
    removeWholeItem: (name: string) => void;
  };
}> = ({ prod, meta, defaultMeat, getAddonPrice, allAddons, helpers }) => {
  const { changeMeatType, addExtraMeat, removeExtraMeat, addAddon, removeAddon, swapIngredient, removeItem, removeWholeItem } =
    helpers;

  const priceNum = toPrice(prod.price);

  // dodatki i mięso tylko dla burgerów
    // burger: pełne dodatki; frytki: tylko sosy
  const burger = isBurger(meta, prod?.name);
  const fries = isFries(meta, prod?.name);
  const drinkWithDeposit = isDrinkWithDeposit(meta, prod?.name);

  // Dla burgerów i frytek - zawsze wszystkie dodatki z bazy (lub fallback)
  // Fallback do AVAILABLE_ADDONS gdy baza nie zwróci danych
  const allAddonNames = allAddons.length > 0 
    ? allAddons.filter(a => a.category !== 'sos').map(a => a.name)
    : AVAILABLE_ADDONS.filter(n => !SAUCES.includes(n));
  const allSauceNames = allAddons.length > 0
    ? allAddons.filter(a => a.category === 'sos').map(a => a.name)
    : SAUCES;
  const premiumAddons = allAddons.length > 0
    ? allAddons.filter(a => a.category === 'premium').map(a => a.name)
    : PREMIUM_ADDONS;
  
  // Dla frytek: sprawdź czy nazwa zawiera "ser" - jeśli tak, nie pokazuj płynnego sera
  const friesHasCheese = fries && (prod?.name || "").toLowerCase().includes("ser");
  const friesAddons = friesHasCheese 
    ? allSauceNames 
    : [...allSauceNames, ...premiumAddons];
  
  // Burgery: zawsze wszystkie dodatki + sosy
  // Frytki: sosy + płynny ser (chyba że mają ser w nazwie)
  const addonPool = burger 
    ? [...allAddonNames, ...allSauceNames]
    : fries 
      ? friesAddons
      : [];
  const sanitizedAddons: string[] = (prod.addons ?? []).filter((a: string) => addonPool.includes(a));

  // Używamy cen z bazy danych
  const addonsCost = sanitizedAddons.reduce((sum: number, addon: string) => sum + getAddonPrice(addon), 0);

  const extraMeatCost = burger ? (prod.extraMeatCount || 0) * 15 : 0;
  
  // Kaucja za napoje (oprócz wody)
  const depositCost = drinkWithDeposit ? DEPOSIT_AMOUNT * (prod.quantity || 1) : 0;

  const lineTotal = (priceNum + addonsCost + extraMeatCost) * (prod.quantity || 1) + depositCost;

  const selectedMeat =
    (prod.meatType as string | undefined) ?? (burger ? defaultMeat : null) ?? null;

  const supportsMeat = burger && selectedMeat !== null;
  const supportsAddons = burger || fries;
  const addonsTitle = burger ? "Dodatki:" : "Sosy:";

  return (
    <div className="border border-white/10 p-4 rounded-2xl bg-white/5 relative">
      <div className="flex justify-between items-start mb-3">
        <div>
          <span className="text-white font-semibold text-base">{prod.name}</span>
          <span className="text-white/50 text-sm ml-2">x{prod.quantity || 1}</span>
        </div>
        <span className="text-yellow-400 font-bold text-lg">{lineTotal.toFixed(2).replace(".", ",")} zł</span>
      </div>
      
      {drinkWithDeposit && (
        <div className="text-xs text-orange-400 mb-3 bg-orange-400/10 px-3 py-1.5 rounded-lg inline-block">
          +{(DEPOSIT_AMOUNT * (prod.quantity || 1)).toFixed(2).replace(".", ",")} zł kaucja
        </div>
      )}

      <div className="text-xs text-white/70 space-y-2">
        {supportsMeat && (
          <>
            <div className="font-semibold text-white text-sm">Mięso: <span className="text-white/50 font-normal text-xs">(w cenie)</span></div>
            <div className="flex gap-2">
              {MEAT_OPTIONS.map((opt) => (
                <button
                  key={opt}
                  className={clsx(
                    "flex-1 px-3 py-2.5 rounded-xl text-xs font-medium border transition",
                    selectedMeat === opt 
                      ? "bg-yellow-400 border-yellow-500 text-black" 
                      : "bg-zinc-800 border-white/10 text-white hover:bg-zinc-700"
                  )}
                  onClick={() => changeMeatType(prod.name, opt)}
                >
                  {opt === "wołowina" ? "🐂 Wołowina" : "🐔 Kurczak"}
                </button>
              ))}
            </div>
          </>
        )}

                {supportsAddons && (
          <>
            <div className="font-semibold mt-3 text-white text-sm">{addonsTitle}</div>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {addonPool.map((add) => {
                const has = prod.addons?.includes(add);
                const price = getAddonPrice(add);
                return (
                  <button
                    key={add}
                    onClick={() => (has ? removeAddon(prod.name, add) : addAddon(prod.name, add))}
                    className={clsx(
                      "flex items-center justify-between text-xs px-3 py-2.5 rounded-xl transition",
                      has 
                        ? "bg-yellow-400 text-black border border-yellow-500" 
                        : "bg-zinc-800 text-white border border-white/10 hover:bg-zinc-700"
                    )}
                  >
                    <span className="font-medium truncate">{add}</span>
                    {price > 0 && <span className={clsx("text-[11px] font-semibold ml-2", has ? "text-black/70" : "text-yellow-400")}>+{price}zł</span>}
                  </button>
                );
              })}
            </div>
          </>
        )}


        {supportsMeat && (
          <>
            <div className="font-semibold mt-3 text-white text-sm">Dodatkowe mięso:</div>
            <div className="flex items-center gap-3 mt-2 bg-white/5 rounded-lg p-2 border border-white/10">
              <button 
                onClick={() => removeExtraMeat(prod.name)} 
                disabled={!prod.extraMeatCount}
                className="w-8 h-8 rounded-lg bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition disabled:opacity-30 disabled:cursor-not-allowed"
              >
                −
              </button>
              <div className="flex-1 text-center">
                <span className="text-white font-medium">{prod.extraMeatCount || 0}</span>
                <span className="text-white/50 text-xs ml-1">szt.</span>
              </div>
              <button 
                onClick={() => addExtraMeat(prod.name)} 
                className="w-8 h-8 rounded-lg bg-yellow-400 text-black flex items-center justify-center hover:bg-yellow-300 transition font-bold"
              >
                +
              </button>
              <span className="text-xs text-white/50 ml-2">+15 zł/szt.</span>
            </div>
          </>
        )}

        {burger && !!prod.availableSwaps?.length && (
          <>
            <div className="font-semibold mt-2 text-white">Wymiana składnika:</div>
            <div className="flex flex-wrap gap-2">
              {prod.swaps?.map((sw: any, i: number) => (
                <div key={i} className="bg-white/10 text-xs px-2 py-1 rounded-lg border border-white/20 text-white">
                  {sw.from} → {sw.to}
                </div>
              ))}
              {prod.availableSwaps?.map((opt: any, i: number) => (
                <button key={i} onClick={() => swapIngredient(prod.name, opt.from, opt.to)} className="bg-white/5 border border-white/10 px-2 py-1 text-xs rounded-lg text-white hover:bg-white/10 transition">
                  {opt.from} → {opt.to}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="flex justify-end items-center mt-4 pt-3 border-t border-white/10 gap-3">
        <button onClick={() => removeItem(prod.name)} className="text-xs text-white/50 hover:text-white transition">
          Usuń 1 szt.
        </button>
        <button onClick={() => removeWholeItem(prod.name)} className="text-xs text-red-400 hover:text-red-300 transition flex items-center gap-1">
          <span>🗑️</span> Usuń produkt
        </button>
      </div>
    </div>
  );
};

type AutoPromoType = {
  code: string;
  type: "percent" | "amount";
  value: number;
  amount: number;
} | null;

/* kupony */
type PromoType = { code: string; type: "percent" | "amount"; value: number } | null;

function PromoSectionExternal({
  promo,
  promoError,
  autoPromo,
  onApply,
  onClear,
}: {
  promo: PromoType;
  promoError: string | null;
  autoPromo: AutoPromoType;
  onApply: (code: string) => void;
  onClear: () => void;
}) {
  const [localCode, setLocalCode] = useState("");
  const deferred = useDeferredValue(localCode);
  const handleApply = useCallback(() => onApply(deferred), [deferred, onApply]);

  return (
    <div className="mt-2">
      <h4 className="font-semibold mb-1 text-white">Kod promocyjny</h4>
      <div className="flex gap-2">
        <input
          type="text"
          inputMode="text"
          autoComplete="off"
          spellCheck={false}
          value={localCode}
          onChange={(e) => setLocalCode(e.target.value)}
          placeholder="Wpisz kod"
          className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-white/40 focus:border-yellow-400/50 focus:outline-none"
        />
        {!promo ? (
          <button onClick={handleApply} className="px-4 py-2 bg-white text-black font-semibold rounded-xl text-sm hover:bg-white/90 transition">Zastosuj</button>
        ) : (
          <button onClick={onClear} className="px-4 py-2 bg-white/10 text-white rounded-xl text-sm border border-white/10 hover:bg-white/20 transition">Usuń kod</button>
        )}
      </div>
      {promoError && (
        <p className="text-xs text-red-400 mt-1">{promoError}</p>
      )}

      {promo && (
        <p className="text-xs text-white/60 mt-1">
          Zastosowano kod <b className="text-white">{promo.code}</b> —{" "}
          {promo.type === "percent"
            ? `${promo.value}%`
            : `${promo.value.toFixed(2)} zł`}{" "}
          zniżki.
        </p>
      )}

      {!promo && autoPromo && autoPromo.amount > 0 && (
        <p className="text-xs text-white/50 mt-1">
          Globalna promocja bez kodu:{" "}
          {autoPromo.type === "percent"
            ? `${autoPromo.value}%`
            : `${autoPromo.amount.toFixed(2)} zł`}{" "}
          rabatu zostanie naliczona automatycznie.
        </p>
      )}
    </div>
  );
}

/* main */
export default function CheckoutModal() {
  const isClient = useIsClient();
  const session = useSession();
  const isLoggedIn = !!session?.user;
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); return () => setMounted(false); }, []);

  const {
    isCheckoutOpen,
    closeCheckoutModal: originalCloseCheckoutModal,
    checkoutStep,
    goToStep,
    nextStep,
    items,
    clearCart,
    removeItem,
    removeWholeItem,
    changeMeatType,
    addExtraMeat,
    removeExtraMeat,
    addAddon,
    removeAddon,
    swapIngredient,
  } = useCartStore();

  const [notes, setNotes] = useState<{ [key: number]: string }>({});
  const [orderNote, setOrderNote] = useState<string>("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [street, setStreet] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [city, setCity] = useState("");
  const [flatNumber, setFlatNumber] = useState("");
  const [optionalAddress, setOptionalAddress] = useState("");
  const [selectedOption, setSelectedOption] = useState<"local" | "takeaway" | "delivery" | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<("Gotówka" | "Terminal" | "Online") | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [orderSent, setOrderSent] = useState(false);
  const [showBurger, setShowBurger] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [deliveryTimeOption, setDeliveryTimeOption] = useState<"asap" | "schedule">("asap");
  const [scheduledTime, setScheduledTime] = useState<string>("10:40");

  const [products, setProducts] = useState<Product[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [addonsFromDb, setAddonsFromDb] = useState<Addon[]>([]);
  const [restLoc, setRestLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [packagingCostSetting, setPackagingCostSetting] = useState<number>(2); // domyślnie 2zł, pobierany z bazy
  const [deliveryInfo, setDeliveryInfo] = useState<{ cost: number; eta: string } | null>(null);

  const [legalAccepted, setLegalAccepted] = useState(false);

  const [promo, setPromo] = useState<PromoType>(null);
  const [promoError, setPromoError] = useState<string | null>(null);

    // auto-promocja (bez kodu)
  const [autoPromo, setAutoPromo] = useState<AutoPromoType>(null);
  const [autoPromoKey, setAutoPromoKey] = useState<string | null>(null);

  // Turnstile
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileError, setTurnstileError] = useState(false);
  const [tsReady, setTsReady] = useState(false);
  const tsIdsRef = useRef<any[]>([]);
  const tsMobileRef = useRef<HTMLDivElement | null>(null);
  const tsDesktopRef = useRef<HTMLDivElement | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Idempotency key for create/charge requests
  const makeIdem = () =>
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const idemKeyRef = useRef<string>(makeIdem());

  // dodatkowe stany dostawy
  const [deliveryMinOk, setDeliveryMinOk] = useState(true);
  const [deliveryMinRequired, setDeliveryMinRequired] = useState(0);
  const [outOfRange, setOutOfRange] = useState(false);
  const [custCoords, setCustCoords] = useState<{ lat: number; lng: number } | null>(null);

  // email
  const sessionEmail = session?.user?.email || "";
  const effectiveEmail = (contactEmail || sessionEmail).trim();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const validEmail = emailRegex.test(effectiveEmail);

  useEffect(() => {
    const id = setInterval(() => setShowBurger((b) => !b), 2000);
    return () => clearInterval(id);
  }, []);

  // ESC + blokada scrolla
  useEffect(() => {
    if (!isCheckoutOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") closeCheckoutModal(); };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCheckoutOpen]);

  // Guard: jeśli skrypt był już wstrzyknięty wcześniej
  useEffect(() => {
    if (!TURNSTILE_SITE_KEY) return;
    if (typeof window !== "undefined" && (window as any).turnstile) setTsReady(true);
  }, []);

  useEffect(() => {
    if (isLoggedIn && session) {
      setName(session.user.user_metadata?.full_name || "");
      setPhone(session.user.user_metadata?.phone || "");
      setContactEmail(session.user.email || "");
      setStreet(session.user.user_metadata?.street || "");
      setPostalCode(session.user.user_metadata?.postal_code || "");
      setCity(session.user.user_metadata?.city || "");
      setFlatNumber(session.user.user_metadata?.flat_number || "");
    }
  }, [isLoggedIn, session]);

  useEffect(() => {
    supabase
      .from("products")
      .select("id,name,category,subcategory,available_addons")
      .then((r) => {
        if (!r.error && r.data) setProducts((r.data as Product[]) || []);
      });

    supabase
      .from("delivery_zones")
      .select("*")
      .eq("active", true)
      .order("min_distance_km", { ascending: true })
      .then((r) => { if (!r.error && r.data) setZones(r.data as Zone[]); });

    // Pobierz dodatki z tabeli addons
    supabase
      .from("addons")
      .select("id,name,price,category,available")
      .eq("available", true)
      .order("display_order", { ascending: true })
      .then((r) => {
        if (r.error) {
          console.error("[CheckoutModal] Błąd pobierania addons:", r.error.message);
        } else if (r.data) {
          console.log("[CheckoutModal] Pobrano addons z bazy:", r.data.length, "pozycji");
          setAddonsFromDb(r.data as Addon[]);
        }
      });

    supabase
      .from("restaurant_info")
      .select("lat,lng,packaging_cost")
      .eq("id", 1)
      .single()
      .then((r) => {
        if (!r.error && r.data) {
          setRestLoc({ lat: r.data.lat, lng: r.data.lng });
          if (typeof r.data.packaging_cost === "number") {
            setPackagingCostSetting(r.data.packaging_cost);
          }
        }
      });
  }, []);

  /* Mapa cen dodatków z bazy */
  const addonPriceMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of addonsFromDb) {
      m.set(a.name.toLowerCase(), a.price);
    }
    return m;
  }, [addonsFromDb]);

  /* Funkcja do pobierania ceny dodatku */
  const getAddonPrice = (addonName: string): number => {
    const price = addonPriceMap.get(addonName.toLowerCase());
    if (price !== undefined) return price;
    // Fallback do starych cen jeśli nie ma w bazie
    if (addonName.toLowerCase() === "płynny ser") return 6;
    if (SAUCES.map(s => s.toLowerCase()).includes(addonName.toLowerCase())) return 3;
    return 4;
  };

  /* szybka mapa name->product z normalizacją */
  const productByNorm = useMemo(() => {
    const m = new Map<string, Product>();
    for (const p of products) m.set(normalizeName(p.name), p);
    return m;
  }, [products]);

  const isVisible = (el: HTMLDivElement | null) => !!el && !!el.offsetParent;

  // === Turnstile: poprawione renderowanie i lifecycle ===
  const renderTurnstile = (target: HTMLDivElement | null) => {
    if (!TURNSTILE_SITE_KEY || !window.turnstile || !target) return;
    if ((target as any)._tsId) return; // nie renderuj drugi raz w ten sam element
    try {
      setTurnstileError(false);
      const id = window.turnstile.render(target, {
        sitekey: TURNSTILE_SITE_KEY,
        appearance: "execute",
        action: "order",
        retry: "auto",
        theme: "auto",
        ["refresh-expired"]: "auto",
        callback: (t: string) => setTurnstileToken(t),
        "error-callback": () => { setTurnstileToken(null); setTurnstileError(true); },
        "expired-callback": () => { setTurnstileToken(null); try { window.turnstile?.reset(id); } catch {} },
        "timeout-callback": () => { setTurnstileToken(null); try { window.turnstile?.reset(id); } catch {} },
      });
      (target as any)._tsId = id;
      tsIdsRef.current.push({ id, el: target });
    } catch { setTurnstileError(true); }
  };

  const removeTurnstile = () => {
    try {
      tsIdsRef.current.forEach(({ id, el }) => {
        try { window.turnstile?.remove(id); } catch {}
        if (el) { (el as any)._tsId = undefined; el.innerHTML = ""; }
      });
    } catch {}
    tsIdsRef.current = [];
    setTurnstileToken(null);
    setTurnstileError(false);
  };

  const getActiveWidgetId = () => {
    const last = tsIdsRef.current[tsIdsRef.current.length - 1];
    return last?.id;
  };

  // uzyskaj świeży token tuż przed POST
  const getFreshTurnstileToken = async (): Promise<string> => {
    if (!TURNSTILE_SITE_KEY) return "";
    if (!window.turnstile) throw new Error("Weryfikacja niedostępna");

    if (!tsIdsRef.current.length) {
      const target =
        (tsMobileRef.current && isVisible(tsMobileRef.current) ? tsMobileRef.current : null) ??
        (tsDesktopRef.current && isVisible(tsDesktopRef.current) ? tsDesktopRef.current : null);
      renderTurnstile(target);
    }

    const id = getActiveWidgetId();
    if (!id) throw new Error("Weryfikacja niedostępna");

    setTurnstileToken(null);
    try {
      window.turnstile.execute?.(id);
      for (let i = 0; i < 30; i++) {
        await new Promise((r) => setTimeout(r, 200));
        const t = window.turnstile.getResponse?.(id) || turnstileToken;
        if (t) return String(t);
      }
      try { window.turnstile.reset(id); window.turnstile.execute?.(id); } catch {}
      for (let i = 0; i < 20; i++) {
        await new Promise((r) => setTimeout(r, 200));
        const t = window.turnstile.getResponse?.(id) || turnstileToken;
        if (t) return String(t);
      }
      throw new Error("timeout");
    } catch {
      throw new Error("Nieudana weryfikacja");
    }
  };

  useEffect(() => {
    if (!isClient || !TURNSTILE_SITE_KEY || !tsReady) return;

    if (isCheckoutOpen && checkoutStep === 3) {
      if (tsMobileRef.current && isVisible(tsMobileRef.current)) renderTurnstile(tsMobileRef.current);
      if (tsDesktopRef.current && isVisible(tsDesktopRef.current)) renderTurnstile(tsDesktopRef.current);
      return () => removeTurnstile();
    }

    removeTurnstile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isClient, isCheckoutOpen, checkoutStep, tsReady]);

  useEffect(() => {
    if (TURNSTILE_SITE_KEY && turnstileError) setShowConfirmation(false);
  }, [turnstileError]);

  const baseTotal = useMemo<number>(() => {
    return items.reduce((acc: number, it: any) => {
      const qty = it.quantity || 1;
      const priceNum = toPrice(it.price);
      const meta = productByNorm.get(normalizeName(it.name));
      const burger = isBurger(meta, it?.name);
      const fries = isFries(meta, it?.name);
      const drinkWithDeposit = isDrinkWithDeposit(meta, it?.name);

      // Pobierz listę dodatków - zawsze wszystkie z bazy lub fallback
      const allAddonNames = addonsFromDb.length > 0 
        ? addonsFromDb.filter(a => a.category !== 'sos').map(a => a.name)
        : AVAILABLE_ADDONS.filter(n => !SAUCES.includes(n));
      const allSauceNames = addonsFromDb.length > 0
        ? addonsFromDb.filter(a => a.category === 'sos').map(a => a.name)
        : SAUCES;
      const premiumAddons = addonsFromDb.length > 0
        ? addonsFromDb.filter(a => a.category === 'premium').map(a => a.name)
        : PREMIUM_ADDONS;
      
      // Dla frytek: sprawdź czy nazwa zawiera "ser"
      const friesHasCheese = fries && (it.name || "").toLowerCase().includes("ser");
      const friesAddons = friesHasCheese ? allSauceNames : [...allSauceNames, ...premiumAddons];
      
      const addonPool = burger 
        ? [...allAddonNames, ...allSauceNames]
        : fries 
          ? friesAddons
          : [];
      const sanitizedAddons: string[] = (it.addons ?? []).filter((a: string) => addonPool.includes(a));

      // Używamy cen z bazy
      const addonsCost = sanitizedAddons.reduce((sum: number, addon: string) => sum + getAddonPrice(addon), 0);

      const extraMeatCost = burger ? (it.extraMeatCount || 0) * 15 : 0;
      
      // Kaucja za napoje (oprócz wody)
      const depositCost = drinkWithDeposit ? DEPOSIT_AMOUNT : 0;
      
      return acc + (priceNum + addonsCost + extraMeatCost + depositCost) * qty;

    }, 0);
  }, [items, productByNorm, addonsFromDb, getAddonPrice]);

  const packagingCost = selectedOption === "takeaway" || selectedOption === "delivery" ? packagingCostSetting : 0;
  const subtotal = baseTotal + packagingCost;

  const calcDelivery = async (custLat: number, custLng: number) => {
    if (!restLoc) return;
    try {
      const resp = await fetch(`/api/distance?origin=${restLoc.lat},${restLoc.lng}&destination=${custLat},${custLng}`);
      const { distance_km, error } = await resp.json();
      if (error) { console.error("Distance API:", error); return; }

      console.log("[calcDelivery] distance_km:", distance_km, "zones:", zones.map(z => ({
        min: z.min_distance_km, max: z.max_distance_km, pricing_type: z.pricing_type, 
        cost: z.cost, cost_fixed: z.cost_fixed, cost_per_km: z.cost_per_km
      })));

      // Konwersja na number + sortowanie dla pewności (Supabase może zwrócić stringi)
      const sortedZones = zones
        .filter(z => z.active !== false)
        .sort((a, b) => Number(a.min_distance_km) - Number(b.min_distance_km));
      
      const zone = sortedZones.find(z => 
        distance_km >= Number(z.min_distance_km) && distance_km <= Number(z.max_distance_km)
      );

      console.log("[calcDelivery] selected zone:", zone);

      if (!zone) {
        setOutOfRange(true);
        setDeliveryMinOk(false);
        setDeliveryMinRequired(0);
        setDeliveryInfo({ cost: 0, eta: "Poza zasięgiem" });
        return;
      }

      setOutOfRange(false);

      // Konwersja wszystkich wartości na number (Supabase może zwrócić stringi)
      const pricingType = zone.pricing_type ?? (Number(zone.min_distance_km) === 0 ? "flat" : "per_km");
      const perKm = pricingType === "per_km";
      
      let cost: number;
      if (perKm) {
        // Mnożymy stawkę za km przez całą odległość
        const perKmRate = Number(zone.cost_per_km ?? zone.cost ?? 0);
        const costFixed = Number(zone.cost_fixed ?? 0);
        cost = costFixed + perKmRate * distance_km;
        console.log("[calcDelivery] per_km calc:", { perKmRate, costFixed, distance_km, cost });
      } else {
        cost = Number(zone.cost_fixed ?? zone.cost ?? 0);
        console.log("[calcDelivery] flat calc:", { cost });
      }

      const freeOver = zone.free_over != null ? Number(zone.free_over) : null;
      if (freeOver != null && subtotal >= freeOver) cost = 0;

      const minOrderValue = Number(zone.min_order_value || 0);
      const minOk = subtotal >= minOrderValue;
      setDeliveryMinOk(minOk);
      setDeliveryMinRequired(minOrderValue);

      const eta = `${zone.eta_min_minutes}-${zone.eta_max_minutes} min`;
      console.log("[calcDelivery] final cost:", cost, "eta:", eta);
      setDeliveryInfo({ cost: Math.max(0, Math.round(cost * 100) / 100), eta });
    } catch (e) {
      console.error("calcDelivery error:", e);
    }
  };

  const onAddressSelect = (address: string, lat: number, lng: number) => {
    setStreet(address);
    setCustCoords({ lat, lng });
    calcDelivery(lat, lng);
  };

   const discount = useMemo(() => {
    const base = subtotal + (deliveryInfo?.cost || 0);

    if (promo) {
      const val =
        promo.type === "percent"
          ? base * (Number(promo.value) / 100)
          : Number(promo.value || 0);
      return Math.max(0, Math.min(val, base));
    }

    if (autoPromo && typeof autoPromo.amount === "number") {
      const val = Number(autoPromo.amount || 0);
      return Math.max(0, Math.min(val, base));
    }

    return 0;
  }, [promo, autoPromo, subtotal, deliveryInfo]);

   // auto-promocja (bez kodu) – podgląd z backendu
  useEffect(() => {
    const base = subtotal + (deliveryInfo?.cost || 0);

    // brak koszyka / brak sumy / jest ręczny kod → czyścimy auto-promkę
    if (!items.length || base <= 0 || promo) {
      setAutoPromo(null);
      setAutoPromoKey(null);
      return;
    }

    const key = `${base.toFixed(2)}|${effectiveEmail || ""}|${
      isLoggedIn ? session!.user.id : ""
    }`;

    // jeśli już sprawdzaliśmy dla tego samego koszyka – nic nie rób
    if (autoPromoKey === key) return;
    setAutoPromoKey(key);

    (async () => {
      try {
        const resp = await safeFetch("/api/promo/auto-preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            total: base,
            email: effectiveEmail || null,
            userId: isLoggedIn ? session!.user.id : null,
          }),
        });

        if (resp?.hasAuto) {
          setAutoPromo({
            code: resp.code,
            type: resp.type,
            value: Number(resp.value || 0),
            amount: Number(resp.amount || 0),
          });
        } else {
          setAutoPromo(null);
        }
      } catch (e) {
        // w razie błędu po prostu nie pokazujemy globalnego rabatu
        setAutoPromo(null);
      }
    })();
  }, [
    subtotal,
    deliveryInfo,
    items.length,
    promo,
    effectiveEmail,
    isLoggedIn,
    session,
    autoPromoKey,
  ]);

  const totalWithDelivery = Math.max(0, subtotal + (deliveryInfo?.cost || 0) - discount);
  const shouldHideOrderActions = Boolean(TURNSTILE_SITE_KEY && turnstileError);

  const closeCheckoutModal = () => {
    originalCloseCheckoutModal();
    setOrderSent(false);
    goToStep(1);
    setErrorMessage(null);
    setShowConfirmation(false);
    setPromo(null);
    setPromoError(null);
    setLegalAccepted(false);
    removeTurnstile();
    setNotes({});
    setOrderNote("");
  };

  const productHelpers = {
    changeMeatType,
    addExtraMeat,
    removeExtraMeat,
    addAddon,
    removeAddon,
    swapIngredient,
    removeItem,
    removeWholeItem,
  };

  // meta produktów po nazwie (z normalizacją)
  const findMetaByName = (name: string) => productByNorm.get(normalizeName(name));

  const buildOrderPayload = () => {
    const client_delivery_time = buildClientDeliveryTime(selectedOption, deliveryTimeOption, scheduledTime);
    const payload: any = {
      selected_option: selectedOption,
      payment_method: paymentMethod || "Gotówka",
      user: isLoggedIn ? session!.user.id : null,
      name,
      phone,
      contact_email: effectiveEmail,
      delivery_cost: deliveryInfo?.cost || 0,
      total_price: totalWithDelivery,
      discount_amount: 0,
      promo_code: promo?.code || null,
      legal_accept: { terms_version: TERMS_VERSION, privacy_version: TERMS_VERSION, marketing_opt_in: false },
      order_note: orderNote.trim() ? orderNote.trim().slice(0, 500) : null,
      status: "placed",
    };
    if (selectedOption === "delivery") {
      payload.street = street || null;
      payload.postal_code = postalCode || null;
      payload.city = city || null;
      payload.flat_number = flatNumber || null;
      payload.client_delivery_time = client_delivery_time;
      if (custCoords) {
        payload.delivery_lat = custCoords.lat;
        payload.delivery_lng = custCoords.lng;
      }
    } else if (optionalAddress.trim()) {
      payload.address = optionalAddress.trim();
    }
    return payload;
  };

  const buildItemsPayload = () =>
    items.map((item: any, index: number) => {
      // jeżeli w koszyku mamy już id, użyjemy go; w przeciwnym razie dopasujemy po nazwie
      const meta = item.product_id ? { id: item.product_id } as Product : findMetaByName(item.name);
      const inferred = inferDefaultMeat(meta, item.name);
            const burger = isBurger(meta, item.name);
      const fries = isFries(meta, item.name);

      const sanitizedAddons: string[] = burger
        ? (item.addons ?? [])
        : fries
          ? (item.addons ?? []).filter((a: string) => SAUCES.includes(a))
          : [];

      return {
        product_id: (meta as any)?.id ?? null,
        name: item.name,
        quantity: item.quantity || 1,
        unit_price: toPrice(item.price),
        options: {
          meatType: burger ? (item.meatType ?? inferred) : null,
          extraMeatCount: burger ? item.extraMeatCount : 0,
          addons: sanitizedAddons,
          swaps: burger ? item.swaps : [],
          note: notes[index] || "",
        },
      };

    });

  const hoursGuardFail = () => {
    const nowPl = toZonedTime(new Date(), "Europe/Warsaw");
    const h = nowPl.getHours();
    const m = nowPl.getMinutes();
    const beforeOpen = h < 10 || (h === 10 && m < 40);
    const afterClose = h > 21 || (h === 21 && m > 45);
    return beforeOpen || afterClose;
  };

  const guardEmail = () => {
    if (!validEmail) {
      setErrorMessage("Podaj poprawny adres e-mail – wyślemy potwierdzenie i link śledzenia.");
      return false;
    }
    return true;
  };

  /* walidacja kodu po backendzie */
  const applyPromo = async (codeRaw: string) => {
    setPromoError(null);
    setErrorMessage(null);
    const code = codeRaw.trim();
    if (!code) return;
    const base = subtotal + (deliveryInfo?.cost || 0);

    try {
      const resp = await safeFetch("/api/promo/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          total: base,
          email: effectiveEmail || null,
          userId: isLoggedIn ? session!.user.id : null
       }),
      });

      if (resp?.valid) {
        setPromo({ code: resp.code, type: resp.type, value: Number(resp.value) });
        setPromoError(null);
        setErrorMessage(null);
        return;
      }
      throw new Error(resp?.message || "Kod nieprawidłowy.");
    } catch (e: any) {
      setPromo(null);
      setPromoError(e.message || "Nie udało się zastosować kodu.");
    }
  };

  const clearPromo = () => { setPromo(null); setPromoError(null); setErrorMessage(null); };

  const requireLegalBeforeConfirm = () => {
    if (!legalAccepted) {
      setErrorMessage("Aby złożyć zamówienie, zaznacz akceptację regulaminu i polityki prywatności.");
      return false;
    }
    return true;
  };

  // --- POST z Turnstile + 1x retry na 409 (timeout-or-duplicate)
  const postWithTurnstile = async (url: string, payload: any) => {
    const attempt = async () => {
      const tsToken = TURNSTILE_SITE_KEY ? await getFreshTurnstileToken() : "";
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "CF-Turnstile-Response": tsToken,
          "X-Idempotency-Key": idemKeyRef.current,
        },
        body: JSON.stringify(payload),
        cache: "no-store",
      });

      if (res.status === 409) return { retry: true as const };
      const text = await res.text();
      let data: any; try { data = JSON.parse(text); } catch { data = { raw: text }; }
      if (!res.ok) throw new Error(data.error || data.message || `HTTP ${res.status}`);
      return { retry: false as const, data };
    };

    let out = await attempt();
    if (!out.retry) return out.data;

    // twardy reset i druga próba z nowym tokenem
    try { tsIdsRef.current.forEach(({ id }) => window.turnstile?.reset(id)); } catch {}
    out = await attempt();
    if (out.retry) throw new Error("Nieudana weryfikacja. Odśwież stronę i spróbuj ponownie.");
    return out.data;
  };

  const handleSubmitOrder = async () => {
    if (submitting) return;
    setSubmitting(true);
    setErrorMessage(null);
    try {
      if (!selectedOption) throw new Error("Wybierz sposób odbioru.");
      if (!paymentMethod) throw new Error("Wybierz metodę płatności.");
      if (!requireLegalBeforeConfirm()) throw new Error("Brak zgody prawnej.");
      if (hoursGuardFail()) throw new Error("Zamówienia przyjmujemy tylko w godz. 10:40–21:45.");
      if (!guardEmail()) throw new Error("Niepoprawny e-mail.");

      if (selectedOption === "delivery") {
        if (outOfRange) throw new Error("Adres jest poza zasięgiem dostawy.");
        if (!deliveryMinOk) throw new Error(`Minimalna wartość zamówienia dla tej strefy to ${deliveryMinRequired.toFixed(2)} zł.`);
        if (!custCoords) throw new Error("Wybierz adres z listy, aby ustawić lokalizację dostawy.");
        if (!deliveryInfo) throw new Error("Poczekaj na przeliczenie kosztu dostawy.");
      }

      const orderPayload = buildOrderPayload();
      const itemsPayload = buildItemsPayload();

      await postWithTurnstile("/api/orders/create", { orderPayload, itemsPayload });

      try { tsIdsRef.current.forEach(({ id }) => window.turnstile?.reset(id)); } catch {}
      clearCart();
      setOrderSent(true);
    } catch (err: any) {
      setErrorMessage(err.message || "Wystąpił błąd podczas składania zamówienia.");
      try { tsIdsRef.current.forEach(({ id }) => window.turnstile?.reset(id)); } catch {}
    } finally {
      setSubmitting(false);
      idemKeyRef.current = makeIdem(); // nowy klucz po próbie
    }
  };

  const handleOnlinePayment = async () => {
    if (submitting) return;
    setSubmitting(true);
    setErrorMessage(null);
    try {
      if (!selectedOption) throw new Error("Wybierz sposób odbioru.");
      if (!paymentMethod) throw new Error("Wybierz metodę płatności.");
      if (!requireLegalBeforeConfirm()) throw new Error("Brak zgody prawnej.");
      if (hoursGuardFail()) throw new Error("Zamówienia przyjmujemy tylko w godz. 10:40–21:45.");
      if (!guardEmail()) throw new Error("Niepoprawny e-mail.");

      if (selectedOption === "delivery") {
        if (outOfRange) throw new Error("Adres jest poza zasięgiem dostawy.");
        if (!deliveryMinOk) throw new Error(`Minimalna wartość zamówienia dla tej strefy to ${deliveryMinRequired.toFixed(2)} zł.`);
        if (!custCoords) throw new Error("Wybierz adres z listy, aby ustawić lokalizację dostawy.");
        if (!deliveryInfo) throw new Error("Poczekaj na przeliczenie kosztu dostawy.");
      }

      const orderPayload = buildOrderPayload();
      const itemsPayload = buildItemsPayload();

      const data = await postWithTurnstile("/api/orders/create", {
        orderPayload,
        itemsPayload,
      });

      try {
        tsIdsRef.current.forEach(({ id }) => window.turnstile?.reset(id));
      } catch {}

      const newOrderId = data.orderId;
      const amountFromServer =
        typeof data.total === "number" && !Number.isNaN(data.total)
          ? data.total
          : totalWithDelivery;

      const pay = await safeFetch("/api/payments/create-transaction", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Idempotency-Key": idemKeyRef.current, // ta sama idempotencja dla pary create+charge
        },
        body: JSON.stringify({
          orderId: newOrderId,
          amount: amountFromServer,
          email: effectiveEmail,
          customerName: name,
        }),
      });

      if (pay.paymentUrl) window.location.href = pay.paymentUrl;
      else throw new Error("Brak URL do płatności");
    } catch (e: any) {
      setErrorMessage(e.message || "Nie udało się zainicjować płatności.");
      try {
        tsIdsRef.current.forEach(({ id }) => window.turnstile?.reset(id));
      } catch {}
    } finally {
      setSubmitting(false);
      idemKeyRef.current = makeIdem(); // nowy klucz po próbie
    }
  };

  if (!isClient || !isCheckoutOpen) return null;

  /* zgody */
  const LegalConsentEl = (
    <label className="flex items-start gap-2 mt-3 text-xs leading-5 text-white/80">
      <input type="checkbox" checked={legalAccepted} onChange={(e) => setLegalAccepted(e.target.checked)} className="mt-0.5 accent-yellow-400" />
      <span>
        Akceptuję{" "}
        <a href="/legal/regulamin" target="_blank" rel="noopener noreferrer" className="underline text-yellow-400 hover:text-yellow-300">Regulamin</a>{" "}
        oraz{" "}
        <a href="/legal/polityka-prywatnosci" target="_blank" rel="noopener noreferrer" className="underline text-yellow-400 hover:text-yellow-300">Politykę prywatności</a>{" "}
        (v{TERMS_VERSION}).
      </span>
    </label>
  );

  // Przycisk nieaktywny gdy brak weryfikacji Turnstile
  const confirmDisabled =
    !paymentMethod ||
    !legalAccepted ||
    (TURNSTILE_SITE_KEY && !turnstileToken) ||
    (selectedOption === "delivery" && (!!outOfRange || !deliveryMinOk || !custCoords || !deliveryInfo)) ||
    submitting;

  // === PORTAL ===
  const modal = (
    <>
      {TURNSTILE_SITE_KEY && (
        <Script
          id="cf-turnstile"
          src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
          strategy="afterInteractive"
          async
          defer
          onLoad={() => setTsReady(true)}
        />
      )}

      <div
        className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-stretch md:items-center justify-center p-0 md:p-4 overflow-auto"
        role="dialog"
        aria-modal="true"
        onMouseDown={(e) => { if (e.target === e.currentTarget) closeCheckoutModal(); }}
        style={{ transform: "none", WebkitTransform: "none" }}
      >
        <div className="relative flex flex-col lg:flex-row w-full max-w-4xl gap-4 md:my-auto" onMouseDown={(e) => e.stopPropagation()}>
          {/* MAIN CARD */}
          <div className="flex-1 bg-zinc-900 md:rounded-2xl shadow-2xl pt-12 px-5 pb-5 md:p-6 overflow-auto min-h-screen md:min-h-0 md:max-h-[85vh] border-0 md:border md:border-white/10">
            {!orderSent && (
              <button aria-label="Zamknij" onClick={closeCheckoutModal} className="absolute top-4 right-4 text-white/60 hover:text-white transition z-10">
                <X size={24} />
              </button>
            )}

            {orderSent ? (
              <div className="text-center space-y-4">
                <div className="w-full flex justify-center">
                  <div className="bg-white p-3 rounded-xl shadow-sm">
                    <QRCode value={THANKS_QR_URL} size={160} />
                  </div>
                </div>
                <h2 className="text-2xl font-bold text-white">Dziękujemy za zamówienie!</h2>
                {showBurger ? (
                  <img src="/animations/Animationburger.gif" alt="Animacja burgera" className="mx-auto w-40 h-40 object-contain" />
                ) : (
                  <p className="text-xl font-semibold text-yellow-400">Twoje zamówienie ląduje w kuchni...</p>
                )}
                <div className="flex justify-center gap-4 mt-2 flex-wrap">
                  <button onClick={() => window.open(THANKS_QR_URL, "_blank")} className="px-5 py-2.5 bg-gradient-to-r from-yellow-400 via-yellow-500 to-amber-500 text-black font-bold rounded-xl hover:from-yellow-300 hover:via-yellow-400 hover:to-amber-400 transition-all">
                    Zostaw opinię
                  </button>
                  <button onClick={closeCheckoutModal} className="px-5 py-2.5 bg-white/10 text-white border border-white/20 rounded-xl hover:bg-white/20 transition">
                    Zamknij
                  </button>
                </div>
              </div>
            ) : (
              <>
                {errorMessage && !promo && <div className="mb-4 bg-red-500/20 border border-red-500/30 text-red-400 px-4 py-2 rounded-xl">{errorMessage}</div>}

                {/* STEP 2 - Sposób odbioru */}
                {checkoutStep === 2 && (
                  <div className="space-y-6">
                    <h2 className="text-2xl font-bold text-center text-white">Sposób odbioru</h2>
                    <div className="grid grid-cols-3 gap-4">
                      {(["local", "takeaway", "delivery"] as const).map((opt) => {
                        const Icon = opt === "local" ? MapPin : opt === "takeaway" ? ShoppingBag : Truck;
                        const label = opt === "local" ? "Na miejscu" : opt === "takeaway" ? "Na wynos" : "Dostawa";
                        return (
                          <button
                            key={opt}
                            onClick={() => setSelectedOption(opt)}
                            disabled={submitting}
                            className={clsx(
                              "flex flex-col items-center p-4 rounded-xl border transition disabled:opacity-60 disabled:cursor-not-allowed",
                              selectedOption === opt ? "bg-yellow-400 text-black border-yellow-500" : "bg-white/5 text-white hover:bg-white/10 border-white/10"
                            )}
                          >
                            <Icon size={24} />
                            <span className="mt-1 text-sm font-medium">{label}</span>
                          </button>
                        );
                      })}
                    </div>

                    {selectedOption === "delivery" && (
                      <div className="space-y-2">
                        <h3 className="font-semibold text-white">Czas dostawy</h3>
                        <div className="flex flex-wrap gap-6 items-center">
                          <label className="flex items-center gap-2 text-white/80">
                            <input type="radio" name="timeOption" value="asap" checked={deliveryTimeOption === "asap"} onChange={() => setDeliveryTimeOption("asap")} disabled={submitting} className="accent-yellow-400" />
                            <span>Jak najszybciej</span>
                          </label>
                          <label className="flex items-center gap-2 text-white/80">
                            <input type="radio" name="timeOption" value="schedule" checked={deliveryTimeOption === "schedule"} onChange={() => setDeliveryTimeOption("schedule")} disabled={submitting} className="accent-yellow-400" />
                            <span>Na godzinę</span>
                          </label>
                          {deliveryTimeOption === "schedule" && (
                            <input type="time" className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white focus:border-yellow-400/50 focus:outline-none" min="11:30" max="21:45" value={scheduledTime} onChange={(e) => setScheduledTime(e.target.value)} disabled={submitting} />
                          )}
                        </div>
                      </div>
                    )}

                    <div className="space-y-3">
                      {!isLoggedIn ? (
                        <>
                          <input type="text" placeholder="Email" className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/40 focus:border-yellow-400/50 focus:outline-none" value={email} onChange={(e) => setEmail(e.target.value)} disabled={submitting} />
                          <input type="password" placeholder="Hasło" className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/40 focus:border-yellow-400/50 focus:outline-none" value={password} onChange={(e) => setPassword(e.target.value)} disabled={submitting} />
                          <div className="flex flex-col gap-2">
                            <button
                              onClick={async () => {
                                const { error } = await supabase.auth.signInWithPassword({ email, password });
                                if (!error) nextStep();
                                else setErrorMessage(error.message);
                              }}
                              disabled={!email || !password || !selectedOption || submitting}
                              className="w-full py-3 bg-gradient-to-r from-yellow-400 via-yellow-500 to-amber-500 text-black font-bold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed hover:from-yellow-300 hover:via-yellow-400 hover:to-amber-400 transition-all"
                            >
                              Zaloguj się
                            </button>
                            <button onClick={nextStep} disabled={!selectedOption || submitting} className="w-full bg-white/10 text-white py-3 rounded-xl mt-1 font-semibold disabled:opacity-50 disabled:cursor-not-allowed border border-white/10 hover:bg-white/20 transition">
                              Kontynuuj bez logowania
                            </button>
                          </div>
                        </>
                      ) : (
                        /* Desktop navigation for logged in users */
                        <div className="hidden lg:flex justify-between">
                          <button onClick={() => goToStep(1)} className="px-4 py-2 bg-white/10 text-white rounded-xl border border-white/10 hover:bg-white/20 transition disabled:opacity-50 disabled:cursor-not-allowed" disabled={submitting}>← Wstecz</button>
                          <button onClick={nextStep} className="px-5 py-2 bg-gradient-to-r from-yellow-400 via-yellow-500 to-amber-500 text-black font-bold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed hover:from-yellow-300 hover:via-yellow-400 hover:to-amber-400 transition-all" disabled={!selectedOption || submitting}>
                            Dalej →
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Sticky bottom navigation for mobile - Krok 2 (niezalogowani) */}
                    {!isLoggedIn && (
                      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-zinc-900 border-t border-white/10 p-4 z-50">
                        <div className="flex gap-3">
                          <button onClick={() => goToStep(1)} className="flex-1 px-4 py-3 bg-white/10 text-white rounded-xl border border-white/10 hover:bg-white/20 transition disabled:opacity-50 disabled:cursor-not-allowed font-medium" disabled={submitting}>
                            ← Wstecz
                          </button>
                          <button onClick={nextStep} disabled={!selectedOption || submitting} className="flex-[2] py-3 bg-gradient-to-r from-yellow-400 via-yellow-500 to-amber-500 text-black font-bold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed hover:from-yellow-300 hover:via-yellow-400 hover:to-amber-400 transition-all">
                            Dalej →
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Sticky bottom navigation for mobile - Krok 2 (zalogowani) */}
                    {isLoggedIn && (
                      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-zinc-900 border-t border-white/10 p-4 z-50">
                        <div className="flex gap-3">
                          <button onClick={() => goToStep(1)} className="flex-1 px-4 py-3 bg-white/10 text-white rounded-xl border border-white/10 hover:bg-white/20 transition disabled:opacity-50 disabled:cursor-not-allowed font-medium" disabled={submitting}>
                            ← Wstecz
                          </button>
                          <button onClick={nextStep} disabled={!selectedOption || submitting} className="flex-[2] py-3 bg-gradient-to-r from-yellow-400 via-yellow-500 to-amber-500 text-black font-bold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed hover:from-yellow-300 hover:via-yellow-400 hover:to-amber-400 transition-all">
                            Dalej →
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Spacer for mobile */}
                    <div className="lg:hidden h-24"></div>
                  </div>
                )}

                {/* STEP 3 - Dane kontaktowe */}
                {checkoutStep === 3 && (
                  <div className="space-y-6">
                    <h2 className="text-2xl font-bold text-center text-white">Dane kontaktowe</h2>
                    {selectedOption === "delivery" && (
                      <div className="space-y-3">
                        <AddressAutocomplete onAddressSelect={onAddressSelect} setCity={setCity} setPostalCode={setPostalCode} setFlatNumber={setFlatNumber} />

                        {!custCoords ? <p className="text-xs text-red-400">Najpierw wyszukaj i wybierz adres z listy powyżej.</p> : null}

                        <div className={clsx("grid grid-cols-1 gap-2", !custCoords && "opacity-50 pointer-events-none")}>
                          <input type="text" placeholder="Adres" className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/40 focus:border-yellow-400/50 focus:outline-none" value={street} onChange={(e) => setStreet(e.target.value)} disabled={!custCoords || submitting} />
                          <div className="flex gap-2">
                            <input type="text" placeholder="Nr mieszkania" className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/40 focus:border-yellow-400/50 focus:outline-none" value={flatNumber} onChange={(e) => setFlatNumber(e.target.value)} disabled={!custCoords || submitting} />
                            <input type="text" placeholder="Kod pocztowy" className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/40 focus:border-yellow-400/50 focus:outline-none" value={postalCode} onChange={(e) => setPostalCode(e.target.value)} disabled={!custCoords || submitting} />
                          </div>
                          <input type="text" placeholder="Miasto" className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/40 focus:border-yellow-400/50 focus:outline-none" value={city} onChange={(e) => setCity(e.target.value)} disabled={!custCoords || submitting} />
                        </div>

                        {deliveryInfo && (
                          <p className="text-xs text-white/60">
                            Koszt dostawy: {deliveryInfo.cost.toFixed(2)} zł • ETA {deliveryInfo.eta}
                          </p>
                        )}
                      </div>
                    )}
                    <div className="grid grid-cols-1 gap-2">
                      <input type="text" placeholder="Imię" className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/40 focus:border-yellow-400/50 focus:outline-none" value={name} onChange={(e) => setName(e.target.value)} disabled={submitting} />
                      <input type="tel" placeholder="Telefon" className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/40 focus:border-yellow-400/50 focus:outline-none" value={phone} onChange={(e) => setPhone(e.target.value)} disabled={submitting} />
                      {(selectedOption === "local" || selectedOption === "takeaway") && (
                        <input type="text" placeholder="Adres (opcjonalnie)" className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/40 focus:border-yellow-400/50 focus:outline-none" value={optionalAddress} onChange={(e) => setOptionalAddress(e.target.value)} disabled={submitting} />
                      )}
                      <input type="email" placeholder="Email (wymagany do potwierdzenia)" className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/40 focus:border-yellow-400/50 focus:outline-none" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} disabled={submitting} />
                      {contactEmail !== "" && !validEmail && <p className="text-xs text-red-400">Podaj poprawny adres e-mail.</p>}
                    </div>

                    {/* MOBILE SUMMARY z płatnością i Turnstile */}
                    <div className="w-full lg:hidden">
                      <div className="border border-white/10 rounded-xl p-4 bg-white/5 space-y-3">
                        <h3 className="text-base font-semibold text-white">Podsumowanie zamówienia</h3>
                        
                        {/* Rozpisane produkty z dodatkami */}
                        <div className="space-y-2 max-h-[200px] overflow-y-auto">
                          {items.map((item, idx) => {
                            const addonsCost = (item.addons || []).reduce((sum: number, addon: string) => sum + getAddonPrice(addon), 0);
                            const extraMeatCost = isBurger(findMetaByName(item.name), item.name) ? (item.extraMeatCount || 0) * 15 : 0;
                            const depositCost = isDrinkWithDeposit(findMetaByName(item.name), item.name) ? DEPOSIT_AMOUNT * (item.quantity || 1) : 0;
                            const itemTotal = (toPrice(item.price) + addonsCost + extraMeatCost) * (item.quantity || 1) + depositCost;
                            
                            return (
                              <div key={idx} className="bg-zinc-800/50 rounded-lg p-3 border border-white/5">
                                <div className="flex justify-between items-start">
                                  <div className="flex-1">
                                    <span className="text-white font-medium text-sm">{item.name}</span>
                                    <span className="text-white/50 text-xs ml-1">x{item.quantity || 1}</span>
                                  </div>
                                  <span className="text-yellow-400 font-semibold text-sm">{itemTotal.toFixed(2)} zł</span>
                                </div>
                                {/* Mięso */}
                                {item.meatType && (
                                  <div className="text-xs text-white/50 mt-1">
                                    Mięso: {item.meatType === "wołowina" ? "🐂 Wołowina" : "🐔 Kurczak"}
                                  </div>
                                )}
                                {/* Dodatki */}
                                {item.addons && item.addons.length > 0 && (
                                  <div className="text-xs text-white/50 mt-1">
                                    + {item.addons.join(", ")}
                                  </div>
                                )}
                                {/* Extra mięso */}
                                {(item.extraMeatCount || 0) > 0 && (
                                  <div className="text-xs text-white/50 mt-1">
                                    + {item.extraMeatCount}x dodatkowe mięso
                                  </div>
                                )}
                                {/* Notatka do produktu */}
                                {notes[idx] && (
                                  <div className="text-xs text-yellow-400/70 mt-1 italic">
                                    📝 {notes[idx]}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>

                        <div className="border-t border-white/10 pt-3 space-y-2">
                          <div className="flex justify-between text-sm"><span className="text-white/60">Produkty:</span><span className="text-white font-medium">{baseTotal.toFixed(2)} zł</span></div>
                          {(selectedOption === "takeaway" || selectedOption === "delivery") && <div className="flex justify-between text-sm"><span className="text-white/60">Opakowanie:</span><span className="text-white font-medium">{packagingCost.toFixed(2)} zł</span></div>}
                          {deliveryInfo && <div className="flex justify-between text-sm"><span className="text-white/60">Dostawa:</span><span className="text-white font-medium">{deliveryInfo.cost.toFixed(2)} zł</span></div>}
                          {discount > 0 && <div className="flex justify-between text-sm"><span className="text-white/60">Rabat:</span><span className="text-white font-medium">-{discount.toFixed(2)} zł</span></div>}
                        </div>

                        {selectedOption === "delivery" && outOfRange && (
                          <p className="text-xs text-red-400">Adres poza zasięgiem dostawy.</p>
                        )}
                        {selectedOption === "delivery" && !outOfRange && !deliveryMinOk && (
                          <p className="text-xs text-red-400">Minimalna wartość zamówienia dla tej strefy: {deliveryMinRequired.toFixed(2)} zł.</p>
                        )}

                        <PromoSectionExternal
                          promo={promo}
                          promoError={promoError}
                          autoPromo={autoPromo}
                          onApply={applyPromo}
                          onClear={clearPromo}
                        />

                        <div className="flex justify-between items-center font-bold text-lg border-t border-white/10 pt-3 mt-2">
                          <span className="text-white">Razem:</span>
                          <span className="text-white text-xl">{totalWithDelivery.toFixed(2)} zł</span>
                        </div>
                        {deliveryInfo && <p className="text-xs text-white/40">Szacowany czas dostawy: {deliveryInfo.eta}</p>}

                        <div id="paymentBox" className="pt-3 border-t border-white/10">
                          <h4 className="font-semibold mb-2 text-white text-sm">Metoda płatności</h4>
                          <div className="flex gap-2">
                            {(["Gotówka", "Terminal", "Online"] as const).map((m) => (
                              <button key={m} onClick={() => { setPaymentMethod(m); setShowConfirmation(false); }}
                                disabled={submitting}
                                className={clsx("flex-1 px-2 py-2.5 rounded-xl font-medium text-xs transition disabled:opacity-60 disabled:cursor-not-allowed border", paymentMethod === m ? "bg-white text-black border-white" : "bg-zinc-800 text-white border-white/10 hover:bg-zinc-700")}>
                                {m}
                              </button>
                            ))}
                          </div>

                          {LegalConsentEl}

                          {TURNSTILE_SITE_KEY ? (
                            <div className="mt-3">
                              <h4 className="font-semibold mb-1 text-white text-sm">Weryfikacja</h4>
                              {turnstileError ? (
                                <p className="text-sm text-red-400">Nie udało się załadować weryfikacji. Sprawdź blokery.</p>
                              ) : (
                                <>
                                  <div ref={tsMobileRef} />
                                  <p className="text-[11px] text-white/40 mt-1">Chronimy formularz przed botami.</p>
                                </>
                              )}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    {/* Sticky bottom navigation for mobile */}
                    <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-zinc-900/95 backdrop-blur-sm border-t border-white/10 p-4 z-50 safe-area-pb">
                      <div className="flex gap-3">
                        <button 
                          onClick={() => goToStep(2)} 
                          className="px-4 py-3 bg-zinc-800 text-white rounded-xl border border-white/10 hover:bg-zinc-700 transition disabled:opacity-50 disabled:cursor-not-allowed font-medium" 
                          disabled={submitting}
                        >
                          ←
                        </button>
                        {!showConfirmation ? (
                          <button
                            onClick={() => {
                              if (!paymentMethod) {
                                setErrorMessage("Wybierz metodę płatności.");
                                document.getElementById("paymentBox")?.scrollIntoView({ behavior: "smooth", block: "center" });
                                return;
                              }
                              if (!legalAccepted) {
                                setErrorMessage("Zaakceptuj regulamin i politykę prywatności.");
                                return;
                              }
                              setShowConfirmation(true);
                            }}
                            disabled={!name || !phone || !validEmail || (selectedOption === "delivery" && (!custCoords || !deliveryInfo)) || submitting || (!!TURNSTILE_SITE_KEY && !turnstileToken)}
                            aria-busy={submitting}
                            className="flex-1 py-3 bg-white text-black rounded-xl font-bold disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation inline-flex items-center justify-center gap-2 hover:bg-white/90 transition-all text-sm"
                          >
                            {submitting ? <Spinner /> : null}
                            {submitting ? "Przetwarzanie…" : `Zamawiam • ${totalWithDelivery.toFixed(2)} zł`}
                          </button>
                        ) : (
                          <button
                            onClick={paymentMethod === "Online" ? handleOnlinePayment : handleSubmitOrder}
                            disabled={confirmDisabled || !name || !phone || !validEmail || (selectedOption === "delivery" && (!custCoords || !deliveryInfo))}
                            aria-busy={submitting}
                            className="flex-1 py-3 bg-green-500 text-white rounded-xl font-bold hover:bg-green-400 touch-manipulation inline-flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed transition text-sm"
                          >
                            {submitting ? <Spinner /> : "✓"}
                            {submitting ? "Składanie…" : `Potwierdź • ${paymentMethod}`}
                          </button>
                        )}
                      </div>
                      {showConfirmation && (
                        <button onClick={() => setShowConfirmation(false)} className="w-full text-xs text-white/50 hover:text-white transition mt-2" disabled={submitting}>
                          ← Zmień metodę płatności
                        </button>
                      )}
                    </div>

                    {/* Nawigacja kroku 3 - Desktop */}
                    <div className="hidden lg:flex justify-between mt-2">
                      <button onClick={() => goToStep(2)} className="px-4 py-2 bg-white/10 text-white rounded-xl border border-white/10 hover:bg-white/20 transition disabled:opacity-50 disabled:cursor-not-allowed" disabled={submitting}>← Wstecz</button>
                    </div>

                    {/* Spacer for mobile to account for fixed bottom nav */}
                    <div className="lg:hidden h-24"></div>
                  </div>
                )}

                {/* STEP 1 - Twoje zamówienie (produkty + notatki) */}
                {checkoutStep === 1 && (
                  <div className="space-y-6">
                    <h2 className="text-2xl font-bold text-center text-white">Twoje zamówienie</h2>

                    {/* EDITOWALNE PRODUKTY */}
                    <div className="max-h-[400px] overflow-y-auto space-y-3">
                      {items.map((item, idx) => {
                        const meta = findMetaByName(item.name);
                        const defaultMeat = inferDefaultMeat(meta, item.name);
                        return (
                          <div key={idx}>
                            <ProductItem
                              prod={item}
                              meta={meta}
                              defaultMeat={defaultMeat}
                              getAddonPrice={getAddonPrice}
                              allAddons={addonsFromDb}
                              helpers={productHelpers}
                            />
                            <textarea className="w-full text-xs bg-white/5 border border-white/10 text-white rounded-lg px-3 py-2 mt-1 placeholder-white/40 focus:border-yellow-400/50 focus:outline-none" placeholder="Notatka do produktu" value={notes[idx] || ""} onChange={(e) => setNotes({ ...notes, [idx]: e.target.value })} />
                          </div>
                        );
                      })}
                      {items.length === 0 && <p className="text-center text-white/40">Brak produktów w koszyku.</p>}
                    </div>
                    
                    {/* NOTATKA DO ZAMÓWIENIA */}
                    <div className="pt-4 border-t border-white/10">
                      <h3 className="font-semibold text-sm mb-1 text-white">Notatka do zamówienia (opcjonalnie)</h3>
                      <textarea
                        className="w-full text-sm bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/40 focus:border-yellow-400/50 focus:outline-none"
                        placeholder="Np. nie dzwonić domofonem, proszę o sztućce, itp."
                        value={orderNote}
                        onChange={(e) => setOrderNote(e.target.value)}
                        maxLength={500}
                        disabled={submitting}
                      />
                      <div className="text-[11px] text-white/40 mt-1">
                        Maks. 500 znaków.
                      </div>
                    </div>

                    {/* Podsumowanie ceny - prosty widok - hidden on mobile */}
                    <div className="border-t border-white/10 pt-4 hidden lg:block">
                      <div className="flex justify-between font-semibold text-white text-lg">
                        <span>Suma produktów:</span>
                        <span>{baseTotal.toFixed(2)} zł</span>
                      </div>
                    </div>

                    {/* Nawigacja kroku 1 - Desktop */}
                    <div className="hidden lg:flex mt-2 justify-end">
                      <button
                        onClick={nextStep}
                        disabled={items.length === 0 || submitting}
                        className="px-5 py-2 bg-gradient-to-r from-yellow-400 via-yellow-500 to-amber-500 text-black font-bold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed hover:from-yellow-300 hover:via-yellow-400 hover:to-amber-400 transition-all"
                      >
                        Dalej →
                      </button>
                    </div>

                    {/* Sticky bottom navigation for mobile - Krok 1 */}
                    <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-zinc-900 border-t border-white/10 p-4 z-50">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-white/70 text-sm">Suma:</span>
                        <span className="text-yellow-400 font-bold text-lg">{baseTotal.toFixed(2)} zł</span>
                      </div>
                      <button
                        onClick={nextStep}
                        disabled={items.length === 0 || submitting}
                        className="w-full py-3 bg-gradient-to-r from-yellow-400 via-yellow-500 to-amber-500 text-black font-bold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed hover:from-yellow-300 hover:via-yellow-400 hover:to-amber-400 transition-all"
                      >
                        Dalej →
                      </button>
                    </div>

                    {/* Spacer for mobile */}
                    <div className="lg:hidden h-28"></div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* DESKTOP SUMMARY */}
          {!orderSent && (
            <aside className="hidden lg:block w-[300px] flex-shrink-0">
              <div className="sticky top-4 bg-zinc-900 border border-white/10 rounded-2xl shadow-xl p-5 space-y-3">
                <h2 className="text-lg font-semibold text-white">Podsumowanie</h2>
                <div className="flex justify-between text-sm text-white/70"><span>Produkty:</span><span className="text-white">{baseTotal.toFixed(2)} zł</span></div>
                {(selectedOption === "takeaway" || selectedOption === "delivery") && <div className="flex justify-between text-sm text-white/70"><span>Opakowanie:</span><span className="text-white">{packagingCost.toFixed(2)} zł</span></div>}
                {deliveryInfo && <div className="flex justify-between text-sm text-white/70"><span>Dostawa:</span><span className="text-white">{deliveryInfo.cost.toFixed(2)} zł</span></div>}

                {selectedOption === "delivery" && outOfRange && (
                  <p className="text-xs text-red-400">Adres poza zasięgiem dostawy.</p>
                )}
                {selectedOption === "delivery" && !outOfRange && !deliveryMinOk && (
                  <p className="text-xs text-red-400">Minimalna wartość zamówienia dla tej strefy: {deliveryMinRequired.toFixed(2)} zł.</p>
                )}

           <PromoSectionExternal
  promo={promo}
  promoError={promoError}
  autoPromo={autoPromo}
  onApply={applyPromo}
  onClear={clearPromo}
/>


                {discount > 0 && <div className="flex justify-between text-sm text-green-400"><span>Rabat:</span><span>-{discount.toFixed(2)} zł</span></div>}

                <div className="flex justify-between font-semibold text-white border-t border-white/10 pt-3 mt-2"><span>RAZEM:</span><span>{totalWithDelivery.toFixed(2)} zł</span></div>
                {deliveryInfo && <p className="text-xs text-white/40">ETA: {deliveryInfo.eta}</p>}

                <div className="mt-3 pt-3 border-t border-white/10">
                  <h4 className="font-medium mb-2 text-white text-sm">Płatność</h4>
                  <div className="flex gap-2">
                    {(["Gotówka", "Terminal", "Online"] as const).map((m) => (
                      <button key={m} onClick={() => { setPaymentMethod(m); setShowConfirmation(false); }}
                        disabled={submitting}
                        className={clsx("flex-1 px-2 py-2 rounded-lg font-medium text-xs transition disabled:opacity-60 disabled:cursor-not-allowed border", paymentMethod === m ? "bg-white text-black border-white" : "bg-transparent text-white/70 hover:text-white border-white/20 hover:border-white/40")}>
                        {m}
                      </button>
                    ))}
                  </div>

                  {LegalConsentEl}

                  {TURNSTILE_SITE_KEY ? (
                    <div className="mt-2">
                      <h4 className="font-semibold mb-1 text-white">Weryfikacja</h4>
                      {turnstileError ? (
                        <p className="text-sm text-red-400">Nie udało się załadować weryfikacji. Sprawdź blokery.</p>
                      ) : (
                        <>
                          <div ref={tsDesktopRef} />
                          <p className="text-[11px] text-white/40 mt-1">Chronimy formularz przed botami.</p>
                        </>
                      )}
                    </div>
                  ) : null}

                  {!showConfirmation ? (
                    !shouldHideOrderActions && (
                      <button
                        onClick={() => setShowConfirmation(true)}
                        disabled={confirmDisabled}
                        aria-busy={submitting}
                        className="w-full mt-3 py-2.5 bg-white text-black rounded-xl font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2 hover:bg-white/90 transition"
                      >
                        {submitting ? <Spinner /> : null}
                        {submitting ? "Przetwarzanie…" : "Potwierdź płatność"}
                      </button>
                    )
                  ) : (
                    !shouldHideOrderActions && (
                      <div className="flex flex-col gap-2 mt-3">
                        <button
                          onClick={paymentMethod === "Online" ? handleOnlinePayment : handleSubmitOrder}
                          disabled={confirmDisabled}
                          aria-busy={submitting}
                          className="w-full py-2.5 bg-green-500 text-white rounded-xl font-semibold text-sm hover:bg-green-400 inline-flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed transition"
                        >
                          {submitting ? <Spinner /> : "✓"}
                          {submitting ? "Składanie zamówienia…" : `Zamawiam (${paymentMethod})`}
                        </button>
                        <button onClick={() => setShowConfirmation(false)} className="text-xs text-white/50 hover:text-white transition" disabled={submitting}>Zmień metodę</button>
                      </div>
                    )
                  )}
                </div>
              </div>
            </aside>
          )}
        </div>
      </div>

      {/* Overlay blokujący interakcje podczas submitu */}
      {submitting && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-black/60 backdrop-blur-sm">
          <div className="rounded-2xl bg-zinc-900 border border-white/10 px-6 py-4 shadow-2xl inline-flex items-center gap-3">
            <Spinner />
            <div className="text-sm font-medium text-white">Przetwarzanie zamówienia…</div>
          </div>
        </div>
      )}
    </>
  );

  return mounted ? createPortal(modal, document.body) : null;
}
