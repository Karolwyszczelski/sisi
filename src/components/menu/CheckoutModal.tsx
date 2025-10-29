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
        }
      ) => any;
      reset: (id?: any) => void;
      remove: (id: any) => void;
    };
  }
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const TERMS_VERSION = process.env.NEXT_PUBLIC_TERMS_VERSION || "2025-09-15";
const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "";
const THANKS_QR_URL = process.env.NEXT_PUBLIC_REVIEW_QR_URL || "https://g.co/kgs/47NSDMH";

type Zone = {
  id: string;
  min_distance_km: number;
  max_distance_km: number;
  min_order_value: number;
  cost: number;
  free_over: number | null;
  eta_min_minutes: number;
  eta_max_minutes: number;
  pricing_type?: "per_km" | "flat";
  active?: boolean;
};

const SAUCES = [
  "Amerykański",
  "Ketchup",
  "Majonez",
  "Musztarda",
  "Meksykański",
  "Serowy chili",
  "Czosnkowy",
  "Musztardowo-miodowy",
  "BBQ",
];
const AVAILABLE_ADDONS = [
  "Ser",
  "Bekon",
  "Jalapeño",
  "Ogórek",
  "Rukola",
  "Czerwona cebula",
  "Pomidor",
  "Pikle",
  ...SAUCES,
];

type Product = { id: number; name: string; category: string | null; subcategory: string | null };

/* helpers */
const buildClientDeliveryTime = (
  selectedOption: string | null,
  deliveryTimeOption: "asap" | "schedule",
  scheduledTime: string
): string | null => {
  if (selectedOption !== "delivery") return null;
  if (deliveryTimeOption === "asap") return "asap";
  const [hours, minutes] = scheduledTime.split(":").map(Number);
  const tz = "Europe/Warsaw";
  const nowZoned = toZonedTime(new Date(), tz);
  const dt = new Date(nowZoned);
  dt.setHours(hours, minutes, 0, 0);
  if (dt.getTime() < nowZoned.getTime()) dt.setDate(dt.getDate() + 1);
  return dt.toISOString();
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

/* inferencja mięsa na podstawie metadanych z Supabase */
const inferDefaultMeat = (meta?: Product, name?: string): "wołowina" | "kurczak" | null => {
  const n = (name || meta?.name || "").toLowerCase();
  const cat = (meta?.category || "").toLowerCase();
  const sub = (meta?.subcategory || "").toLowerCase();

  // vege: brak mięsa
  if (sub.includes("vege") || n.includes("vege")) return null;

  // produkty kurczakowe z tabeli lub z nazwy
  if (sub.includes("kurczak") || n.includes("chicken") || n.includes("kurczak")) return "kurczak";

  // burger bez "vege" -> domyślnie wołowina
  if (cat === "burger" || n.includes("burger")) return "wołowina";

  return null;
};

const MEAT_OPTIONS: Array<"wołowina" | "kurczak"> = ["wołowina", "kurczak"];

/* child */
const ProductItem: React.FC<{
  prod: any;
  meta?: Product | undefined;
  defaultMeat: "wołowina" | "kurczak" | null;
  helpers: {
    changeMeatType: (name: string, type: string) => void;
    addExtraMeat: (name: string) => void;
    removeExtraMeat: (name: string) => void;
    addAddon: (name: string, addon: string) => void;
    removeAddon: (name: string, addon: string) => void;
    swapIngredient: (name: string, from: string, to: string) => void;
    removeItem: (name: string) => void;
    removeWholeItem: (name: string) => void;
  };
}> = ({ prod, meta, defaultMeat, helpers }) => {
  const { changeMeatType, addExtraMeat, removeExtraMeat, addAddon, removeAddon, swapIngredient, removeItem, removeWholeItem } =
    helpers;

  const priceNum = typeof prod.price === "string" ? parseFloat(prod.price) : prod.price || 0;
  const addonsCost = (prod.addons ?? []).reduce((sum: number, addon: string) => sum + (SAUCES.includes(addon) ? 3 : 4), 0);
  const extraMeatCost = (prod.extraMeatCount || 0) * 10;
  const lineTotal = (priceNum + addonsCost + extraMeatCost) * (prod.quantity || 1);

  const selectedMeat = (prod.meatType as string | undefined) ?? defaultMeat ?? null;
  const supportsMeat = selectedMeat !== null; // tylko dla burgerów i nie-vege

  return (
    <div className="border p-3 rounded bg-gray-50 relative">
      <div className="flex justify-between items-center font-semibold mb-2">
        <span>{prod.name} x{prod.quantity || 1}</span>
        <span>{lineTotal.toFixed(2).replace(".", ",")} zł</span>
      </div>

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

        <div className="font-semibold mt-2">Dodatki:</div>
        <div className="flex flex-wrap gap-2">
          {AVAILABLE_ADDONS.map((add) => (
            <button
              key={add}
              onClick={() => (prod.addons?.includes(add) ? removeAddon(prod.name, add) : addAddon(prod.name, add))}
              className={clsx(
                "border text-xs px-2 py-1 rounded",
                prod.addons?.includes(add) ? "bg-gray-800 text-white border-gray-900" : "bg-white text-black hover:bg-gray-50"
              )}
            >
              {prod.addons?.includes(add) ? `✓ ${add}` : `+ ${add}`}
            </button>
          ))}
        </div>

        {supportsMeat && (
          <>
            <div className="font-semibold mt-2">Dodatkowe mięso:</div>
            <div className="flex items-center gap-2 flex-wrap">
              <button onClick={() => addExtraMeat(prod.name)} className="px-2 py-1 text-xs bg-gray-200 rounded border border-gray-300">
                +1 mięso (+10 zł)
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

        {!!prod.availableSwaps?.length && (
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

/* kupony */
type PromoType = { code: string; type: "percent" | "amount"; value: number } | null;
function PromoSectionExternal({
  promo, promoError, onApply, onClear,
}: {
  promo: PromoType;
  promoError: string | null;
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
      {promoError && <p className="text-xs text-red-600 mt-1">{promoError}</p>}
      {promo && (
        <p className="text-xs text-green-700 mt-1">
          Zastosowano kod <b>{promo.code}</b> — {promo.type === "percent" ? `${promo.value}%` : `${promo.value.toFixed(2)} zł`} zniżki.
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
  const [restLoc, setRestLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [deliveryInfo, setDeliveryInfo] = useState<{ cost: number; eta: string } | null>(null);

  const [legalAccepted, setLegalAccepted] = useState(false);

  const [promo, setPromo] = useState<PromoType>(null);
  const [promoError, setPromoError] = useState<string | null>(null);

  // Turnstile
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileError, setTurnstileError] = useState(false);
  const [tsReady, setTsReady] = useState(false);
  const tsIdsRef = useRef<any[]>([]);
  const tsMobileRef = useRef<HTMLDivElement | null>(null);
  const tsDesktopRef = useRef<HTMLDivElement | null>(null);

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
      .select("id,name,category,subcategory")
      .then((r) => {
        if (!r.error && r.data) setProducts((r.data as Product[]) || []);
      });

    supabase
      .from("delivery_zones")
      .select("*")
      .order("min_distance_km", { ascending: true })
      .then((r) => { if (!r.error && r.data) setZones(r.data as Zone[]); });

    supabase
      .from("restaurant_info")
      .select("lat,lng")
      .eq("id", 1)
      .single()
      .then((r) => { if (!r.error && r.data) setRestLoc({ lat: r.data.lat, lng: r.data.lng }); });
  }, []);

  const isVisible = (el: HTMLDivElement | null) => !!el && !!el.offsetParent;

  const renderTurnstile = (target: HTMLDivElement | null) => {
    if (!TURNSTILE_SITE_KEY || !window.turnstile || !isVisible(target)) return;
    try {
      setTurnstileError(false);
      const id = window.turnstile.render(target!, {
        sitekey: TURNSTILE_SITE_KEY,
        callback: (t: string) => setTurnstileToken(t),
        "error-callback": () => { setTurnstileToken(null); setTurnstileError(true); },
        "expired-callback": () => { setTurnstileToken(null); try { window.turnstile?.reset(id); } catch {} },
        "timeout-callback": () => { setTurnstileToken(null); try { window.turnstile?.reset(id); } catch {} },
        retry: "auto",
        theme: "auto",
        appearance: "always",
        ["refresh-expired"]: "auto",
      });
      // zapamiętaj widget, żeby móc go resetować/usunąć
      tsIdsRef.current.push(id);
    } catch { setTurnstileError(true); }
  };

  const removeTurnstile = () => {
    try { tsIdsRef.current.forEach((id) => window.turnstile?.remove(id)); } catch {}
    tsIdsRef.current = [];
    setTurnstileToken(null);
    setTurnstileError(false);
  };

  useEffect(() => {
    if (!isClient || !TURNSTILE_SITE_KEY || !tsReady) return;
    if (isCheckoutOpen && checkoutStep === 3) {
      renderTurnstile(tsMobileRef.current);
      renderTurnstile(tsDesktopRef.current);
      return () => removeTurnstile();
    }
    removeTurnstile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isClient, isCheckoutOpen, checkoutStep, tsReady]);

  useEffect(() => {
    if (TURNSTILE_SITE_KEY && turnstileError) setShowConfirmation(false);
  }, [turnstileError]);

  const ensureFreshToken = async () => {
    if (!TURNSTILE_SITE_KEY) return true;
    if (turnstileToken) return true;
    try {
      tsIdsRef.current.forEach((id) => window.turnstile?.reset(id));
      for (let i = 0; i < 10; i++) {           // ~2s na wygenerowanie tokenu
        await new Promise((r) => setTimeout(r, 200));
        if (turnstileToken) return true;
      }
      return false;
    } catch { return false; }
  };

  const baseTotal = useMemo<number>(() => {
    return items.reduce((acc: number, it: any) => {
      const qty = it.quantity || 1;
      const priceNum = typeof it.price === "string" ? parseFloat(it.price) : it.price || 0;
      const addonsCost = (it.addons ?? []).reduce((sum: number, addon: string) => sum + (SAUCES.includes(addon) ? 3 : 4), 0);
      const extraMeatCost = (it.extraMeatCount || 0) * 10;
      return acc + (priceNum + addonsCost + extraMeatCost) * qty;
    }, 0);
  }, [items]);

  const packagingCost = selectedOption === "takeaway" || selectedOption === "delivery" ? 2 : 0;
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
      let cost = perKm ? zone.cost * distance_km : zone.cost;

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
    if (!promo) return 0;
    const base = subtotal + (deliveryInfo?.cost || 0);
    const val = promo.type === "percent" ? base * (Number(promo.value) / 100) : Number(promo.value || 0);
    return Math.max(0, Math.min(val, base));
  }, [promo, subtotal, deliveryInfo]);

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

  // meta produktów po nazwie
  const findMetaByName = (name: string) => products.find((p) => p.name === name);

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
      const meta = findMetaByName(item.name);
      const inferred = inferDefaultMeat(meta, item.name);
      const product = meta;
      return {
        product_id: product?.id,
        name: item.name,
        quantity: item.quantity || 1,
        unit_price: item.price,
        options: {
          meatType: item.meatType ?? inferred, // zapisz wołowina/kurczak lub null
          extraMeatCount: item.extraMeatCount,
          addons: item.addons,
          swaps: item.swaps,
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

 const applyPromo = async (codeRaw: string) => {
  setPromoError(null);
  const code = codeRaw.trim();
  if (!code) return;

  const currentBase = subtotal + (deliveryInfo?.cost || 0);

  try {
    // 1) Szybka walidacja po publicznej tabeli
    const { data, error } = await supabase
      .from("discount_codes")
      .select("*")
      .ilike("code", code)
      .eq("active", true)
      .maybeSingle();

    if (!error && data) {
      const nowIso = new Date().toISOString();

      if (data.starts_at && data.starts_at > nowIso) throw new Error("Kod jeszcze nieaktywny.");
      if (data.expires_at && data.expires_at < nowIso) throw new Error("Kod wygasł.");

      // JEDNORAZOWOŚĆ / LIMIT UŻYĆ
      if (data.max_uses !== null && Number(data.used_count || 0) >= Number(data.max_uses)) {
        throw new Error("Kod został już wykorzystany.");
      }

      if (typeof data.min_order === "number" && currentBase < data.min_order) {
        throw new Error(`Minimalna wartość zamówienia to ${Number(data.min_order).toFixed(2)} zł.`);
      }

      const type = data.type === "amount" ? "amount" : "percent";
      const value = Number(data.value || 0);
      if (value <= 0) throw new Error("Nieprawidłowa wartość kodu.");

      setPromo({ code: data.code, type, value });
      return;
    }

    // 2) Fallback: walidacja po backendzie (spójna z serwerem)
    const resp = await safeFetch("/api/promo/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, total: currentBase }),
    });

    if (resp?.valid) {
      setPromo({ code: resp.code, type: resp.type, value: Number(resp.value) });
      return;
    }

    throw new Error(resp?.message || "Kod nieprawidłowy.");
  } catch (e: any) {
    setPromo(null);
    setPromoError(e.message || "Nie udało się zastosować kodu.");
  }
};

  const clearPromo = () => { setPromo(null); setPromoError(null); };

  const requireLegalBeforeConfirm = () => {
    if (!legalAccepted) {
      setErrorMessage("Aby złożyć zamówienie, zaznacz akceptację regulaminu i polityki prywatności.");
      return false;
    }
    return true;
  };

  const requireCaptchaBeforeConfirm = () => {
    if (!TURNSTILE_SITE_KEY) return true;
    if (!turnstileToken) {
      setErrorMessage("Potwierdź, że nie jesteś robotem.");
      return false;
    }
    return true;
  };

  const handleSubmitOrder = async () => {
    setErrorMessage(null);
    if (!selectedOption) return setErrorMessage("Wybierz sposób odbioru.");
    if (!paymentMethod) return setErrorMessage("Wybierz metodę płatności.");
    if (!requireLegalBeforeConfirm()) return;
    if (hoursGuardFail()) return setErrorMessage("Zamówienia przyjmujemy tylko w godz. 10:40–21:45.");
    if (!guardEmail()) return;

    if (TURNSTILE_SITE_KEY) {
      const ok = await ensureFreshToken();
      if (!ok) return setErrorMessage("Potwierdź, że nie jesteś robotem.");
    }

    if (selectedOption === "delivery") {
      if (outOfRange) return setErrorMessage("Adres jest poza zasięgiem dostawy.");
      if (!deliveryMinOk) return setErrorMessage(`Minimalna wartość zamówienia dla tej strefy to ${deliveryMinRequired.toFixed(2)} zł.`);
      if (!custCoords) return setErrorMessage("Wybierz adres z listy, aby ustawić lokalizację dostawy.");
      if (!deliveryInfo) return setErrorMessage("Poczekaj na przeliczenie kosztu dostawy.");
    }

    try {
      const orderPayload = buildOrderPayload();
      const itemsPayload = buildItemsPayload();

      await safeFetch("/api/orders/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "cf-turnstile-response": turnstileToken || "",
        },
        body: JSON.stringify({ orderPayload, itemsPayload, turnstileToken }),
      });

      clearCart();
      setOrderSent(true);
    } catch (err: any) {
      setErrorMessage(err.message || "Wystąpił błąd podczas składania zamówienia.");
      try { tsIdsRef.current.forEach((id) => window.turnstile?.reset(id)); } catch {}
    }
  };

  const handleOnlinePayment = async () => {
    setErrorMessage(null);
    if (!selectedOption) return setErrorMessage("Wybierz sposób odbioru.");
    if (!paymentMethod) return setErrorMessage("Wybierz metodę płatności.");
    if (!requireLegalBeforeConfirm()) return;
    if (hoursGuardFail()) return setErrorMessage("Zamówienia przyjmujemy tylko w godz. 10:40–21:45.");
    if (!guardEmail()) return;

    if (TURNSTILE_SITE_KEY) {
      const ok = await ensureFreshToken();
      if (!ok) return setErrorMessage("Potwierdź, że nie jesteś robotem.");
    }

    if (selectedOption === "delivery") {
      if (outOfRange) return setErrorMessage("Adres jest poza zasięgiem dostawy.");
      if (!deliveryMinOk) return setErrorMessage(`Minimalna wartość zamówienia dla tej strefy to ${deliveryMinRequired.toFixed(2)} zł.`);
      if (!custCoords) return setErrorMessage("Wybierz adres z listy, aby ustawić lokalizację dostawy.");
      if (!deliveryInfo) return setErrorMessage("Poczekaj na przeliczenie kosztu dostawy.");
    }

    try {
      const orderPayload = buildOrderPayload();
      const itemsPayload = buildItemsPayload();

      const data = await safeFetch("/api/orders/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "cf-turnstile-response": turnstileToken || "",
        },
        body: JSON.stringify({ orderPayload, itemsPayload, turnstileToken }),
      });

      const newOrderId = data.orderId;
      const pay = await safeFetch("/api/payments/create-transaction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: newOrderId,
          amount: totalWithDelivery,
          email: effectiveEmail,
          customerName: name,
        }),
      });

      if (pay.paymentUrl) window.location.href = pay.paymentUrl;
      else throw new Error("Brak URL do płatności");
    } catch (e: any) {
      setErrorMessage(e.message || "Nie udało się zainicjować płatności.");
      try { if (window.turnstile && tsIdRef.current) window.turnstile.reset(tsIdRef.current); } catch {}
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

  const confirmDisabled = !paymentMethod || !legalAccepted || (TURNSTILE_SITE_KEY ? !turnstileToken : false) ||
    (selectedOption === "delivery" && (!!outOfRange || !deliveryMinOk || !custCoords || !deliveryInfo));

  return (
    <>
      {TURNSTILE_SITE_KEY && (
        <Script
          id="cf-turnstile"
          src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
          async
          defer
          strategy="afterInteractive"
          onLoad={() => setTsReady(true)}
        />
      )}

      <div
        className="fixed inset-0 z-50 bg-black/60 flex items-start justify-center p-4 overflow-auto"
        role="dialog"
        aria-modal="true"
        onMouseDown={(e) => { if (e.target === e.currentTarget) closeCheckoutModal(); }}
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
                {errorMessage && <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded">{errorMessage}</div>}

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
                            className={clsx(
                              "flex flex-col items-center p-4 rounded border transition",
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
                            <input type="radio" name="timeOption" value="asap" checked={deliveryTimeOption === "asap"} onChange={() => setDeliveryTimeOption("asap")} />
                            <span>Jak najszybciej</span>
                          </label>
                          <label className="flex items-center gap-2">
                            <input type="radio" name="timeOption" value="schedule" checked={deliveryTimeOption === "schedule"} onChange={() => setDeliveryTimeOption("schedule")} />
                            <span>Na godzinę</span>
                          </label>
                          {deliveryTimeOption === "schedule" && (
                            <input type="time" className="border rounded px-2 py-1" min="11:30" max="21:45" value={scheduledTime} onChange={(e) => setScheduledTime(e.target.value)} />
                          )}
                        </div>
                      </div>
                    )}

                    <div className="space-y-3">
                      {!isLoggedIn ? (
                        <>
                          <input type="text" placeholder="Email" className="w-full px-3 py-2 border rounded" value={email} onChange={(e) => setEmail(e.target.value)} />
                          <input type="password" placeholder="Hasło" className="w-full px-3 py-2 border rounded" value={password} onChange={(e) => setPassword(e.target.value)} />
                          <div className="flex flex-col gap-2">
                            <button
                              onClick={async () => {
                                const { error } = await supabase.auth.signInWithPassword({ email, password });
                                if (!error) nextStep();
                                else setErrorMessage(error.message);
                              }}
                              disabled={!email || !password || !selectedOption}
                              className="w-full bg-yellow-400 py-2 rounded font-bold disabled:opacity-50"
                            >
                              Zaloguj się
                            </button>
                            <button onClick={nextStep} disabled={!selectedOption} className="w-full bg-black text-white py-2 rounded mt-1">
                              Kontynuuj bez logowania
                            </button>
                          </div>
                        </>
                      ) : (
                        <button onClick={nextStep} className="w-full bg-black text-white py-2 rounded font-semibold">
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
    {/* najpierw wybór adresu z wyszukiwarki */}
    <AddressAutocomplete
      onAddressSelect={onAddressSelect}
      setCity={setCity}
      setPostalCode={setPostalCode}
      setFlatNumber={setFlatNumber}
    />

    {!custCoords ? (
      <p className="text-xs text-red-600">
        Najpierw wyszukaj i wybierz adres z listy powyżej.
      </p>
    ) : null}

    {/* pola odblokują się dopiero po wyborze adresu */}
    <div className={clsx("grid grid-cols-1 gap-2", !custCoords && "opacity-50 pointer-events-none")}>
      <input
        type="text"
        placeholder="Adres"
        className="w-full px-3 py-2 border rounded"
        value={street}
        onChange={(e) => setStreet(e.target.value)}
        disabled={!custCoords}
      />
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Nr mieszkania"
          className="flex-1 px-3 py-2 border rounded"
          value={flatNumber}
          onChange={(e) => setFlatNumber(e.target.value)}
          disabled={!custCoords}
        />
        <input
          type="text"
          placeholder="Kod pocztowy"
          className="flex-1 px-3 py-2 border rounded"
          value={postalCode}
          onChange={(e) => setPostalCode(e.target.value)}
          disabled={!custCoords}
        />
      </div>
      <input
        type="text"
        placeholder="Miasto"
        className="w-full px-3 py-2 border rounded"
        value={city}
        onChange={(e) => setCity(e.target.value)}
        disabled={!custCoords}
      />
    </div>

    {deliveryInfo && (
      <p className="text-xs text-gray-600">
        Koszt dostawy: {deliveryInfo.cost.toFixed(2)} zł • ETA {deliveryInfo.eta}
      </p>
    )}
  </div>
)}
                    <div className="grid grid-cols-1 gap-2">
                      <input type="text" placeholder="Imię" className="w-full px-3 py-2 border rounded" value={name} onChange={(e) => setName(e.target.value)} />
                      <input type="tel" placeholder="Telefon" className="w-full px-3 py-2 border rounded" value={phone} onChange={(e) => setPhone(e.target.value)} />
                      {(selectedOption === "local" || selectedOption === "takeaway") && (
                        <input type="text" placeholder="Adres (opcjonalnie)" className="w-full px-3 py-2 border rounded" value={optionalAddress} onChange={(e) => setOptionalAddress(e.target.value)} />
                      )}
                      <input type="email" placeholder="Email (wymagany do potwierdzenia)" className="w-full px-3 py-2 border rounded" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
                      {contactEmail !== "" && !validEmail && <p className="text-xs text-red-600">Podaj poprawny adres e-mail.</p>}
                    </div>
                    <div className="flex justify-between mt-2">
                      <button onClick={() => goToStep(1)} className="px-4 py-2 bg-gray-200 rounded">← Wstecz</button>
                      <button
                        onClick={nextStep}
                        disabled={!name || !phone || !validEmail || (selectedOption === "delivery" && (!custCoords || !deliveryInfo))}
                        className="px-4 py-2 bg-yellow-400 rounded font-semibold disabled:opacity-50"
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
                      {/* EDITOWALNE PRODUKTY */}
                      <div className="flex-1 space-y-3 max-h-[350px] overflow-y-auto">
                        {items.map((item, idx) => {
                          const meta = findMetaByName(item.name);
                          const defaultMeat = inferDefaultMeat(meta, item.name);
                          return (
                            <div key={idx}>
                              <ProductItem prod={item} meta={meta} defaultMeat={defaultMeat} helpers={productHelpers} />
                              <textarea className="w-full text-xs border rounded px-2 py-1 mt-1" placeholder="Notatka do produktu" value={notes[idx] || ""} onChange={(e) => setNotes({ ...notes, [idx]: e.target.value })} />
                            </div>
                          );
                        })}
                        {items.length === 0 && <p className="text-center text-gray-500">Brak produktów w koszyku.</p>}
                      </div>

                      {/* MOBILE SUMMARY */}
                      <div className="w-full lg:hidden flex-shrink-0">
                        <div className="border rounded p-4 bg-gray-50 space-y-3">
                          <h3 className="text-lg font-semibold">Podsumowanie</h3>
                          <div className="flex justify-between text-sm"><span>Produkty:</span><span>{baseTotal.toFixed(2)} zł</span></div>
                          {(selectedOption === "takeaway" || selectedOption === "delivery") && <div className="flex justify-between text-sm"><span>Opakowanie:</span><span>2.00 zł</span></div>}
                          {deliveryInfo && <div className="flex justify-between text-sm"><span>Dostawa:</span><span>{deliveryInfo.cost.toFixed(2)} zł</span></div>}

                          {selectedOption === "delivery" && outOfRange && (
                            <p className="text-xs text-red-600">Adres poza zasięgiem dostawy.</p>
                          )}
                          {selectedOption === "delivery" && !outOfRange && !deliveryMinOk && (
                            <p className="text-xs text-red-600">Minimalna wartość zamówienia dla tej strefy: {deliveryMinRequired.toFixed(2)} zł.</p>
                          )}

                          <PromoSectionExternal promo={promo} promoError={promoError} onApply={applyPromo} onClear={clearPromo} />

                          {discount > 0 && <div className="flex justify-between text-sm text-green-700"><span>Rabat:</span><span>-{discount.toFixed(2)} zł</span></div>}

                          <div className="flex justify-between font-semibold border-t pt-2"><span>Razem:</span><span>{totalWithDelivery.toFixed(2)} zł</span></div>
                          {deliveryInfo && <p className="text-xs text-gray-600 mt-1">Szacowany czas dostawy: {deliveryInfo.eta}</p>}

                          <div id="paymentBox" className="mt-2">
                            <h4 className="font-semibold mb-1">Metoda płatności</h4>
                            <div className="flex flex-wrap gap-2">
                              {(["Gotówka", "Terminal", "Online"] as const).map((m) => (
                                <button key={m} onClick={() => { setPaymentMethod(m); setShowConfirmation(false); }}
                                  className={clsx("px-3 py-2 rounded font-semibold text-sm transition", paymentMethod === m ? "bg-green-600 text-white" : "bg-gray-200 text-black hover:bg-gray-300")}>
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
                                  onClick={async () => {
                                    if (!(await ensureFreshToken())) return setErrorMessage("Potwierdź, że nie jesteś robotem.");
                                    setShowConfirmation(true);
                                  }}
                                  disabled={confirmDisabled}
                                  className="w-full mt-3 py-2 bg-yellow-400 text-black rounded font-semibold disabled:opacity-50"
                                >
                                  Potwierdź płatność
                                </button>
                              )
                            ) : (
                              !shouldHideOrderActions && (
                                <div className="flex flex-col gap-2 mt-2">
                                  <button onClick={paymentMethod === "Online" ? handleOnlinePayment : handleSubmitOrder} className="w-full py-2 bg-black text-white rounded font-semibold hover:opacity-95" disabled={confirmDisabled}>
                                    ✅ Zamawiam i płacę ({paymentMethod})
                                  </button>
                                  <button onClick={() => setShowConfirmation(false)} className="text-xs underline">Zmień metodę</button>
                                </div>
                              )
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Nawigacja kroku 3 */}
                    <div className="mt-2 flex justify-between">
                      <button onClick={() => goToStep(2)} className="px-4 py-2 bg-gray-200 rounded">← Wstecz</button>
                      <button
                        onClick={async () => {
                          if (!paymentMethod) setErrorMessage("Wybierz metodę płatności.");
                          else if (!legalAccepted) setErrorMessage("Zaznacz akceptację regulaminu i polityki prywatności.");
                          else if (TURNSTILE_SITE_KEY && !(await ensureFreshToken())) setErrorMessage("Potwierdź, że nie jesteś robotem.");
                          document.getElementById("paymentBox")?.scrollIntoView({ behavior: "smooth", block: "start" });
                          setShowConfirmation(true);
                        }}
                        className="px-4 py-2 bg-yellow-400 rounded font-semibold"
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
                {(selectedOption === "takeaway" || selectedOption === "delivery") && <div className="flex justify-between"><span>Opakowanie:</span><span>2.00 zł</span></div>}
                {deliveryInfo && <div className="flex justify-between"><span>Dostawa:</span><span>{deliveryInfo.cost.toFixed(2)} zł</span></div>}

                {selectedOption === "delivery" && outOfRange && (
                  <p className="text-xs text-red-600">Adres poza zasięgiem dostawy.</p>
                )}
                {selectedOption === "delivery" && !outOfRange && !deliveryMinOk && (
                  <p className="text-xs text-red-600">Minimalna wartość zamówienia dla tej strefy: {deliveryMinRequired.toFixed(2)} zł.</p>
                )}

                <PromoSectionExternal promo={promo} promoError={promoError} onApply={applyPromo} onClear={clearPromo} />

                {discount > 0 && <div className="flex justify-between text-green-700"><span>Rabat:</span><span>-{discount.toFixed(2)} zł</span></div>}

                <div className="flex justify-between font-semibold border-t pt-2"><span>RAZEM:</span><span>{totalWithDelivery.toFixed(2)} zł</span></div>
                {deliveryInfo && <p className="text-xs text-gray-600">ETA: {deliveryInfo.eta}</p>}

                <div id="paymentBox" className="mt-2">
                  <h4 className="font-semibold mb-1">Płatność</h4>
                  <div className="flex flex-wrap gap-2">
                    {(["Gotówka", "Terminal", "Online"] as const).map((m) => (
                      <button key={m} onClick={() => { setPaymentMethod(m); setShowConfirmation(false); }}
                        className={clsx("px-3 py-2 rounded font-semibold text-sm transition", paymentMethod === m ? "bg-green-600 text-white" : "bg-gray-200 text-black hover:bg-gray-300")}>
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
                        onClick={async () => {
                          if (!(await ensureFreshToken())) return setErrorMessage("Potwierdź, że nie jesteś robotem.");
                          setShowConfirmation(true);
                        }}
                        disabled={confirmDisabled}
                        className="w-full mt-3 py-2 bg-yellow-400 text-black rounded font-semibold disabled:opacity-50"
                      >
                        Potwierdź płatność
                      </button>
                    )
                  ) : (
                    !shouldHideOrderActions && (
                      <div className="flex flex-col gap-2 mt-2">
                        <button onClick={paymentMethod === "Online" ? handleOnlinePayment : handleSubmitOrder} className="w-full py-2 bg-black text-white rounded font-semibold hover:opacity-95" disabled={confirmDisabled}>
                          ✅ Zamawiam i płacę ({paymentMethod})
                        </button>
                        <button onClick={() => setShowConfirmation(false)} className="text-xs underline">Zmień</button>
                      </div>
                    )
                  )}
                </div>
              </div>
            </aside>
          )}
        </div>
      </div>
    </>
  );
}
