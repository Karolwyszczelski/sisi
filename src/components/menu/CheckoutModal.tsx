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
    <div className="border p-3 rounded bg-gray-50 relative">
      <div className="flex justify-between items-center font-semibold mb-2">
        <span>{prod.name} x{prod.quantity || 1}</span>
        <span>{lineTotal.toFixed(2).replace(".", ",")} zł</span>
      </div>
      
      {drinkWithDeposit && (
        <div className="text-xs text-orange-600 mb-2">
          +{(DEPOSIT_AMOUNT * (prod.quantity || 1)).toFixed(2).replace(".", ",")} zł kaucja za butelkę/puszkę
        </div>
      )}

      <div className="text-xs text-gray-700 space-y-2">
        {supportsMeat && (
          <>
            <div className="font-semibold">Mięso:</div>
            <div className="flex gap-2 flex-wrap">
              {MEAT_OPTIONS.map((opt) => (
                <button
                  key={opt}
                  className={clsx(
                    "px-2 py-1 rounded text-xs border",
                    selectedMeat === opt ? "bg-yellow-300 border-yellow-400" : "bg-gray-200 border-gray-300"
                  )}
                  onClick={() => changeMeatType(prod.name, opt)}
                >
                  {opt === "wołowina" ? "Wołowina" : "Kurczak"}
                </button>
              ))}
            </div>
          </>
        )}

                {supportsAddons && (
          <>
            <div className="font-semibold mt-2">{addonsTitle}</div>
            <div className="flex flex-wrap gap-2">
              {addonPool.map((add) => {
                const has = prod.addons?.includes(add);
                return (
                  <button
                    key={add}
                    onClick={() => (has ? removeAddon(prod.name, add) : addAddon(prod.name, add))}
                    className={clsx(
                      "border text-xs px-2 py-1 rounded",
                      has ? "bg-gray-800 text-white border-gray-900" : "bg-white text-black hover:bg-gray-50"
                    )}
                  >
                    {has ? `✓ ${add}` : `+ ${add}`}
                  </button>
                );
              })}
            </div>
          </>
        )}


        {supportsMeat && (
          <>
            <div className="font-semibold mt-2">Dodatkowe mięso:</div>
            <div className="flex items-center gap-2 flex-wrap">
              <button onClick={() => addExtraMeat(prod.name)} className="px-2 py-1 text-xs bg-gray-200 rounded border border-gray-300">
                +1 mięso (+15 zł)
              </button>
              {prod.extraMeatCount > 0 && (
                <button onClick={() => removeExtraMeat(prod.name)} className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded border border-red-200">
                  Usuń mięso
                </button>
              )}
              <span className="text-xs text-gray-600">Ilość: {prod.extraMeatCount || 0}</span>
            </div>
          </>
        )}

        {burger && !!prod.availableSwaps?.length && (
          <>
            <div className="font-semibold mt-2">Wymiana składnika:</div>
            <div className="flex flex-wrap gap-2">
              {prod.swaps?.map((sw: any, i: number) => (
                <div key={i} className="bg-gray-200 text-xs px-2 py-1 rounded border border-gray-300">
                  {sw.from} → {sw.to}
                </div>
              ))}
              {prod.availableSwaps?.map((opt: any, i: number) => (
                <button key={i} onClick={() => swapIngredient(prod.name, opt.from, opt.to)} className="bg-white border px-2 py-1 text-xs rounded hover:bg-gray-100">
                  {opt.from} → {opt.to}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="flex justify-end items-center mt-2 gap-2 flex-wrap text-[11px]">
        <button onClick={() => removeItem(prod.name)} className="text-red-600 underline">Usuń 1 szt.</button>
        <button onClick={() => removeWholeItem(prod.name)} className="text-red-600 underline">Usuń produkt</button>
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
      <h4 className="font-semibold mb-1">Kod promocyjny</h4>
      <div className="flex gap-2">
        <input
          type="text"
          inputMode="text"
          autoComplete="off"
          spellCheck={false}
          value={localCode}
          onChange={(e) => setLocalCode(e.target.value)}
          placeholder="Wpisz kod"
          className="flex-1 border rounded px-3 py-2 text-sm"
        />
        {!promo ? (
          <button onClick={handleApply} className="px-3 py-2 bg-gray-900 text-white rounded text-sm">Zastosuj</button>
        ) : (
          <button onClick={onClear} className="px-3 py-2 bg-gray-200 rounded text-sm">Usuń kod</button>
        )}
      </div>
      {promoError && (
        <p className="text-xs text-red-600 mt-1">{promoError}</p>
      )}

      {promo && (
        <p className="text-xs text-green-700 mt-1">
          Zastosowano kod <b>{promo.code}</b> —{" "}
          {promo.type === "percent"
            ? `${promo.value}%`
            : `${promo.value.toFixed(2)} zł`}{" "}
          zniżki.
        </p>
      )}

      {!promo && autoPromo && autoPromo.amount > 0 && (
        <p className="text-xs text-indigo-700 mt-1">
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

      const zone = zones
        .filter(z => z.active !== false)
        .find(z => distance_km >= z.min_distance_km && distance_km <= z.max_distance_km);

      if (!zone) {
        setOutOfRange(true);
        setDeliveryMinOk(false);
        setDeliveryMinRequired(0);
        setDeliveryInfo({ cost: 0, eta: "Poza zasięgiem" });
        return;
      }

      setOutOfRange(false);

      const perKm = (zone.pricing_type ?? (zone.min_distance_km === 0 ? "flat" : "per_km")) === "per_km";
      // Używamy nowych pól cost_fixed/cost_per_km jeśli dostępne, fallback do starego cost
      let cost: number;
      if (perKm) {
        cost = (zone.cost_per_km ?? zone.cost ?? 0) * distance_km;
      } else {
        cost = zone.cost_fixed ?? zone.cost ?? 0;
      }

      if (zone.free_over != null && subtotal >= zone.free_over) cost = 0;

      const minOk = subtotal >= (zone.min_order_value || 0);
      setDeliveryMinOk(minOk);
      setDeliveryMinRequired(zone.min_order_value || 0);

      const eta = `${zone.eta_min_minutes}-${zone.eta_max_minutes} min`;
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
    <label className="flex items-start gap-2 mt-3 text-xs leading-5">
      <input type="checkbox" checked={legalAccepted} onChange={(e) => setLegalAccepted(e.target.checked)} className="mt-0.5" />
      <span>
        Akceptuję{" "}
        <a href="/legal/regulamin" target="_blank" rel="noopener noreferrer" className="underline">Regulamin</a>{" "}
        oraz{" "}
        <a href="/legal/polityka-prywatnosci" target="_blank" rel="noopener noreferrer" className="underline">Politykę prywatności</a>{" "}
        (v{TERMS_VERSION}).
      </span>
    </label>
  );

  // UWAGA: nie blokujemy przycisku brakiem tokenu. Token generujemy JIT.
  const confirmDisabled =
    !paymentMethod ||
    !legalAccepted ||
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
        className="fixed inset-0 z-50 bg-black/60 flex items-start justify-center p-4 overflow-auto"
        role="dialog"
        aria-modal="true"
        onMouseDown={(e) => { if (e.target === e.currentTarget) closeCheckoutModal(); }}
        style={{ transform: "none", WebkitTransform: "none" }}
      >
        <div className="relative flex flex-col lg:flex-row w-full max-w-4xl gap-6" onMouseDown={(e) => e.stopPropagation()}>
          {/* MAIN CARD */}
          <div className="flex-1 bg-white rounded-md shadow-lg p-6 overflow-auto max-h-[90vh]">
            {!orderSent && (
              <button aria-label="Zamknij" onClick={closeCheckoutModal} className="absolute top-3 right-3 text-gray-700 hover:text-black">
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
                <h2 className="text-2xl font-bold">Dziękujemy za zamówienie!</h2>
                {showBurger ? (
                  <img src="/animations/Animationburger.gif" alt="Animacja burgera" className="mx-auto w-40 h-40 object-contain" />
                ) : (
                  <p className="text-xl font-semibold text-yellow-600">Twoje zamówienie ląduje w kuchni...</p>
                )}
                <div className="flex justify-center gap-4 mt-2 flex-wrap">
                  <button onClick={() => window.open(THANKS_QR_URL, "_blank")} className="px-4 py-2 bg-blue-500 text-white rounded">
                    Zostaw opinię
                  </button>
                  <button onClick={closeCheckoutModal} className="px-4 py-2 bg-gray-300 text-black rounded">
                    Zamknij
                  </button>
                </div>
              </div>
            ) : (
              <>
                {errorMessage && !promo && <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded">{errorMessage}</div>}

                {/* STEP 1 */}
                {checkoutStep === 1 && (
                  <div className="space-y-6">
                    <h2 className="text-2xl font-bold text-center">Sposób odbioru</h2>
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
                              "flex flex-col items-center p-4 rounded border transition disabled:opacity-60 disabled:cursor-not-allowed",
                              selectedOption === opt ? "bg-yellow-400 text-black border-yellow-500" : "bg-gray-100 text-gray-800 hover:bg-gray-200 border-gray-200"
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
                        <h3 className="font-semibold">Czas dostawy</h3>
                        <div className="flex flex-wrap gap-6 items-center">
                          <label className="flex items-center gap-2">
                            <input type="radio" name="timeOption" value="asap" checked={deliveryTimeOption === "asap"} onChange={() => setDeliveryTimeOption("asap")} disabled={submitting} />
                            <span>Jak najszybciej</span>
                          </label>
                          <label className="flex items-center gap-2">
                            <input type="radio" name="timeOption" value="schedule" checked={deliveryTimeOption === "schedule"} onChange={() => setDeliveryTimeOption("schedule")} disabled={submitting} />
                            <span>Na godzinę</span>
                          </label>
                          {deliveryTimeOption === "schedule" && (
                            <input type="time" className="border rounded px-2 py-1" min="11:30" max="21:45" value={scheduledTime} onChange={(e) => setScheduledTime(e.target.value)} disabled={submitting} />
                          )}
                        </div>
                      </div>
                    )}

                    <div className="space-y-3">
                      {!isLoggedIn ? (
                        <>
                          <input type="text" placeholder="Email" className="w-full px-3 py-2 border rounded" value={email} onChange={(e) => setEmail(e.target.value)} disabled={submitting} />
                          <input type="password" placeholder="Hasło" className="w-full px-3 py-2 border rounded" value={password} onChange={(e) => setPassword(e.target.value)} disabled={submitting} />
                          <div className="flex flex-col gap-2">
                            <button
                              onClick={async () => {
                                const { error } = await supabase.auth.signInWithPassword({ email, password });
                                if (!error) nextStep();
                                else setErrorMessage(error.message);
                              }}
                              disabled={!email || !password || !selectedOption || submitting}
                              className="w-full bg-yellow-400 py-2 rounded font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              Zaloguj się
                            </button>
                            <button onClick={nextStep} disabled={!selectedOption || submitting} className="w-full bg-black text-white py-2 rounded mt-1 disabled:opacity-50 disabled:cursor-not-allowed">
                              Kontynuuj bez logowania
                            </button>
                          </div>
                        </>
                      ) : (
                        <button onClick={nextStep} className="w-full bg-black text-white py-2 rounded font-semibold disabled:opacity-50 disabled:cursor-not-allowed" disabled={submitting}>
                          Dalej
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* STEP 2 */}
                {checkoutStep === 2 && (
                  <div className="space-y-6">
                    <h2 className="text-2xl font-bold text-center">Dane kontaktowe</h2>
                    {selectedOption === "delivery" && (
                      <div className="space-y-3">
                        <AddressAutocomplete onAddressSelect={onAddressSelect} setCity={setCity} setPostalCode={setPostalCode} setFlatNumber={setFlatNumber} />

                        {!custCoords ? <p className="text-xs text-red-600">Najpierw wyszukaj i wybierz adres z listy powyżej.</p> : null}

                        <div className={clsx("grid grid-cols-1 gap-2", !custCoords && "opacity-50 pointer-events-none")}>
                          <input type="text" placeholder="Adres" className="w-full px-3 py-2 border rounded" value={street} onChange={(e) => setStreet(e.target.value)} disabled={!custCoords || submitting} />
                          <div className="flex gap-2">
                            <input type="text" placeholder="Nr mieszkania" className="flex-1 px-3 py-2 border rounded" value={flatNumber} onChange={(e) => setFlatNumber(e.target.value)} disabled={!custCoords || submitting} />
                            <input type="text" placeholder="Kod pocztowy" className="flex-1 px-3 py-2 border rounded" value={postalCode} onChange={(e) => setPostalCode(e.target.value)} disabled={!custCoords || submitting} />
                          </div>
                          <input type="text" placeholder="Miasto" className="w-full px-3 py-2 border rounded" value={city} onChange={(e) => setCity(e.target.value)} disabled={!custCoords || submitting} />
                        </div>

                        {deliveryInfo && (
                          <p className="text-xs text-gray-600">
                            Koszt dostawy: {deliveryInfo.cost.toFixed(2)} zł • ETA {deliveryInfo.eta}
                          </p>
                        )}
                      </div>
                    )}
                    <div className="grid grid-cols-1 gap-2">
                      <input type="text" placeholder="Imię" className="w-full px-3 py-2 border rounded" value={name} onChange={(e) => setName(e.target.value)} disabled={submitting} />
                      <input type="tel" placeholder="Telefon" className="w-full px-3 py-2 border rounded" value={phone} onChange={(e) => setPhone(e.target.value)} disabled={submitting} />
                      {(selectedOption === "local" || selectedOption === "takeaway") && (
                        <input type="text" placeholder="Adres (opcjonalnie)" className="w-full px-3 py-2 border rounded" value={optionalAddress} onChange={(e) => setOptionalAddress(e.target.value)} disabled={submitting} />
                      )}
                      <input type="email" placeholder="Email (wymagany do potwierdzenia)" className="w-full px-3 py-2 border rounded" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} disabled={submitting} />
                      {contactEmail !== "" && !validEmail && <p className="text-xs text-red-600">Podaj poprawny adres e-mail.</p>}
                    </div>
                    <div className="flex justify-between mt-2">
                      <button onClick={() => goToStep(1)} className="px-4 py-2 bg-gray-200 rounded disabled:opacity-50 disabled:cursor-not-allowed" disabled={submitting}>← Wstecz</button>
                      <button
                        onClick={nextStep}
                        disabled={!name || !phone || !validEmail || (selectedOption === "delivery" && (!custCoords || !deliveryInfo)) || submitting}
                        className="px-4 py-2 bg-yellow-400 rounded font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Dalej →
                      </button>
                    </div>
                  </div>
                )}

                {/* STEP 3 */}
                {checkoutStep === 3 && (
                  <div className="space-y-6">
                    <h2 className="text-2xl font-bold text-center">Podsumowanie zamówienia</h2>

                    <div className="flex flex-col lg:flex-row gap-6">
                      {/* EDITOWALNE PRODUKTY + NOTATKA DO ZAMÓWIENIA */}
                      <div className="flex-1 space-y-3">
                        <div className="max-h-[350px] overflow-y-auto space-y-3">
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
                                <textarea className="w-full text-xs border rounded px-2 py-1 mt-1" placeholder="Notatka do produktu" value={notes[idx] || ""} onChange={(e) => setNotes({ ...notes, [idx]: e.target.value })} />
                              </div>
                            );
                          })}
                          {items.length === 0 && <p className="text-center text-gray-500">Brak produktów w koszyku.</p>}
                        </div>
                        
                        {/* NOTATKA DO ZAMÓWIENIA - POD PRODUKTAMI */}
                        <div className="mt-4 pt-4 border-t">
                          <h3 className="font-semibold text-sm mb-1">Notatka do zamówienia (opcjonalnie)</h3>
                          <textarea
                            className="w-full text-sm border rounded px-3 py-2"
                            placeholder="Np. nie dzwonić domofonem, proszę o sztućce, itp."
                            value={orderNote}
                            onChange={(e) => setOrderNote(e.target.value)}
                            maxLength={500}
                            disabled={submitting}
                          />
                          <div className="text-[11px] text-gray-500 mt-1">
                            Maks. 500 znaków.
                          </div>
                        </div>
                      </div>



                      {/* MOBILE SUMMARY */}
                      <div className="w-full lg:hidden flex-shrink-0">
                        <div className="border rounded p-4 bg-gray-50 space-y-3">
                          <h3 className="text-lg font-semibold">Podsumowanie</h3>
                          <div className="flex justify-between text-sm"><span>Produkty:</span><span>{baseTotal.toFixed(2)} zł</span></div>
                          {(selectedOption === "takeaway" || selectedOption === "delivery") && <div className="flex justify-between text-sm"><span>Opakowanie:</span><span>{packagingCost.toFixed(2)} zł</span></div>}
                          {deliveryInfo && <div className="flex justify-between text-sm"><span>Dostawa:</span><span>{deliveryInfo.cost.toFixed(2)} zł</span></div>}

                          {selectedOption === "delivery" && outOfRange && (
                            <p className="text-xs text-red-600">Adres poza zasięgiem dostawy.</p>
                          )}
                          {selectedOption === "delivery" && !outOfRange && !deliveryMinOk && (
                            <p className="text-xs text-red-600">Minimalna wartość zamówienia dla tej strefy: {deliveryMinRequired.toFixed(2)} zł.</p>
                          )}

                          <PromoSectionExternal
  promo={promo}
  promoError={promoError}
  autoPromo={autoPromo}
  onApply={applyPromo}
  onClear={clearPromo}
/>

                          {discount > 0 && <div className="flex justify-between text-sm text-green-700"><span>Rabat:</span><span>-{discount.toFixed(2)} zł</span></div>}

                          <div className="flex justify-between font-semibold border-t pt-2"><span>Razem:</span><span>{totalWithDelivery.toFixed(2)} zł</span></div>
                          {deliveryInfo && <p className="text-xs text-gray-600 mt-1">Szacowany czas dostawy: {deliveryInfo.eta}</p>}

                          <div id="paymentBox" className="mt-2">
                            <h4 className="font-semibold mb-1">Metoda płatności</h4>
                            <div className="flex flex-wrap gap-2">
                              {(["Gotówka", "Terminal", "Online"] as const).map((m) => (
                                <button key={m} onClick={() => { setPaymentMethod(m); setShowConfirmation(false); }}
                                  disabled={submitting}
                                  className={clsx("px-3 py-2 rounded font-semibold text-sm transition disabled:opacity-60 disabled:cursor-not-allowed", paymentMethod === m ? "bg-green-600 text-white" : "bg-gray-200 text-black hover:bg-gray-300")}>
                                  {m}
                                </button>
                              ))}
                            </div>

                            {LegalConsentEl}

                            {TURNSTILE_SITE_KEY ? (
                              <div className="mt-2">
                                <h4 className="font-semibold mb-1">Weryfikacja</h4>
                                {turnstileError ? (
                                  <p className="text-sm text-red-600">Nie udało się załadować weryfikacji. Sprawdź blokery.</p>
                                ) : (
                                  <>
                                    <div ref={tsMobileRef} />
                                    <p className="text-[11px] text-gray-500 mt-1">Chronimy formularz przed botami.</p>
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
                                  className="w-full mt-3 py-2 bg-yellow-400 text-black rounded font-semibold disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation inline-flex items-center justify-center gap-2"
                                >
                                  {submitting ? <Spinner /> : null}
                                  {submitting ? "Przetwarzanie…" : "Potwierdź płatność"}
                                </button>
                              )
                            ) : (
                              !shouldHideOrderActions && (
                                <div className="flex flex-col gap-2 mt-2">
                                  <button
                                    onClick={paymentMethod === "Online" ? handleOnlinePayment : handleSubmitOrder}
                                    disabled={confirmDisabled}
                                    aria-busy={submitting}
                                    className="w-full py-2 bg-black text-white rounded font-semibold hover:opacity-95 touch-manipulation inline-flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                                  >
                                    {submitting ? <Spinner /> : "✅"}
                                    {submitting ? "Składanie zamówienia…" : `Zamawiam i płacę (${paymentMethod})`}
                                  </button>
                                  <button onClick={() => setShowConfirmation(false)} className="text-xs underline disabled:opacity-50" disabled={submitting}>Zmień metodę</button>
                                </div>
                              )
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Nawigacja kroku 3 */}
                    <div className="mt-2 flex justify-between">
                      <button onClick={() => goToStep(2)} className="px-4 py-2 bg-gray-200 rounded disabled:opacity-50 disabled:cursor-not-allowed" disabled={submitting}>← Wstecz</button>
                      <button
                        onClick={() => {
                          if (!paymentMethod) setErrorMessage("Wybierz metodę płatności.");
                          else if (!legalAccepted) setErrorMessage("Zaznacz akceptację regulaminu i polityki prywatności.");
                          document.getElementById("paymentBox")?.scrollIntoView({ behavior: "smooth", block: "start" });
                          setShowConfirmation(true);
                        }}
                        className="px-4 py-2 bg-yellow-400 rounded font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={submitting}
                      >
                        Dalej →
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* DESKTOP SUMMARY */}
          {!orderSent && (
            <aside className="hidden lg:block w-[320px] flex-shrink-0">
              <div className="sticky top-16 bg-white border rounded-md shadow p-5 space-y-4">
                <h2 className="text-xl font-bold">Podsumowanie</h2>
                <div className="flex justify-between"><span>Produkty:</span><span>{baseTotal.toFixed(2)} zł</span></div>
                {(selectedOption === "takeaway" || selectedOption === "delivery") && <div className="flex justify-between"><span>Opakowanie:</span><span>{packagingCost.toFixed(2)} zł</span></div>}
                {deliveryInfo && <div className="flex justify-between"><span>Dostawa:</span><span>{deliveryInfo.cost.toFixed(2)} zł</span></div>}

                {selectedOption === "delivery" && outOfRange && (
                  <p className="text-xs text-red-600">Adres poza zasięgiem dostawy.</p>
                )}
                {selectedOption === "delivery" && !outOfRange && !deliveryMinOk && (
                  <p className="text-xs text-red-600">Minimalna wartość zamówienia dla tej strefy: {deliveryMinRequired.toFixed(2)} zł.</p>
                )}

           <PromoSectionExternal
  promo={promo}
  promoError={promoError}
  autoPromo={autoPromo}
  onApply={applyPromo}
  onClear={clearPromo}
/>


                {discount > 0 && <div className="flex justify-between text-green-700"><span>Rabat:</span><span>-{discount.toFixed(2)} zł</span></div>}

                <div className="flex justify-between font-semibold border-t pt-2"><span>RAZEM:</span><span>{totalWithDelivery.toFixed(2)} zł</span></div>
                {deliveryInfo && <p className="text-xs text-gray-600">ETA: {deliveryInfo.eta}</p>}

                <div id="paymentBox" className="mt-2">
                  <h4 className="font-semibold mb-1">Płatność</h4>
                  <div className="flex flex-wrap gap-2">
                    {(["Gotówka", "Terminal", "Online"] as const).map((m) => (
                      <button key={m} onClick={() => { setPaymentMethod(m); setShowConfirmation(false); }}
                        disabled={submitting}
                        className={clsx("px-3 py-2 rounded font-semibold text-sm transition disabled:opacity-60 disabled:cursor-not-allowed", paymentMethod === m ? "bg-green-600 text-white" : "bg-gray-200 text-black hover:bg-gray-300")}>
                        {m}
                      </button>
                    ))}
                  </div>

                  {LegalConsentEl}

                  {TURNSTILE_SITE_KEY ? (
                    <div className="mt-2">
                      <h4 className="font-semibold mb-1">Weryfikacja</h4>
                      {turnstileError ? (
                        <p className="text-sm text-red-600">Nie udało się załadować weryfikacji. Sprawdź blokery.</p>
                      ) : (
                        <>
                          <div ref={tsDesktopRef} />
                          <p className="text-[11px] text-gray-500 mt-1">Chronimy formularz przed botami.</p>
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
                        className="w-full mt-3 py-2 bg-yellow-400 text-black rounded font-semibold disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
                      >
                        {submitting ? <Spinner /> : null}
                        {submitting ? "Przetwarzanie…" : "Potwierdź płatność"}
                      </button>
                    )
                  ) : (
                    !shouldHideOrderActions && (
                      <div className="flex flex-col gap-2 mt-2">
                        <button
                          onClick={paymentMethod === "Online" ? handleOnlinePayment : handleSubmitOrder}
                          disabled={confirmDisabled}
                          aria-busy={submitting}
                          className="w-full py-2 bg-black text-white rounded font-semibold hover:opacity-95 inline-flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                          {submitting ? <Spinner /> : "✅"}
                          {submitting ? "Składanie zamówienia…" : `Zamawiam i płacę (${paymentMethod})`}
                        </button>
                        <button onClick={() => setShowConfirmation(false)} className="text-xs underline disabled:opacity-50" disabled={submitting}>Zmień</button>
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
        <div className="fixed inset-0 z-[60] grid place-items-center bg-black/40">
          <div className="rounded-xl bg-white px-4 py-3 shadow inline-flex items-center gap-3">
            <Spinner />
            <div className="text-sm font-medium">Przetwarzanie zamówienia…</div>
          </div>
        </div>
      )}
    </>
  );

  return mounted ? createPortal(modal, document.body) : null;
}
