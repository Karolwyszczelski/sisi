"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import EditOrderButton from "@/components/EditOrderButton";
import CancelButton from "@/components/CancelButton";
import PushNotificationControl from "@/components/admin/PushNotificationControl";
import ThemeToggle from "@/components/admin/ThemeToggle";
import { useTheme } from "@/components/admin/ThemeContext";
import { Power, Truck, ShoppingBag, MapPin, RefreshCw, ChevronDown, ChevronUp, Settings, Filter, Clock, CalendarDays, Users, Phone, CheckCircle, XCircle, AlertCircle } from "lucide-react";

type Any = Record<string, any>;
type PaymentMethod = "Gotówka" | "Terminal" | "Online";
type PaymentStatus = "pending" | "paid" | "failed" | null;

interface Order {
  id: string;
  name?: string;
  total_price: number;
  delivery_cost?: number | null;
  discount_amount?: number | null;
  promo_code?: string | null;
  created_at: string;
  status: "new" | "pending" | "placed" | "accepted" | "cancelled" | "completed";
  clientDelivery?: string;
  delivery_time?: string;
  address?: string;
  street?: string;
  flat_number?: string;
  city?: string;
  phone?: string;
  items?: any;
  order_items?: any;
  selected_option?: "local" | "takeaway" | "delivery";
  payment_method?: PaymentMethod;
  payment_status?: PaymentStatus;
  order_note?: string | null;
}

const APP_TZ = "Europe/Warsaw";

const getOptionLabel = (opt?: Order["selected_option"]) =>
  opt === "delivery" ? "DOSTAWA" : opt === "takeaway" ? "NA WYNOS" : opt === "local" ? "NA MIEJSCU" : "BRAK";

const statusTone = (s: Order["status"]) =>
  s === "accepted" ? "border-blue-500/30 bg-slate-800/80"
  : s === "cancelled" ? "border-rose-500/30 bg-slate-800/80"
  : s === "completed" ? "border-slate-600/30 bg-slate-800/60"
  : "border-amber-500/30 bg-slate-800/80";

const toNumber = (x: any, d = 0) => {
  if (typeof x === "number" && !isNaN(x)) return x;
  const n = Number(x);
  return isFinite(n) ? n : d;
};

const isValidDateString = (s: any) =>
  typeof s === "string" && s.trim().length > 0 && !Number.isNaN(Date.parse(s)) && new Date(s).toString() !== "Invalid Date";

// Bezpieczne formatowanie czasu dostawy klienta
const formatClientDeliveryTime = (clientDelivery: string | undefined): string => {
  if (!clientDelivery) return "-";
  
  // Próbuj sparsować JSON jeśli to obiekt (np. {"client_delivery_time":"asap","delivery_time":null})
  let value = clientDelivery;
  try {
    const parsed = JSON.parse(clientDelivery);
    if (parsed && typeof parsed === "object") {
      value = parsed.client_delivery_time || parsed.clientDelivery || "-";
    }
  } catch {
    // Nie jest JSONem, użyj oryginalnej wartości
  }
  
  if (!value || value === "-") return "-";
  if (value === "asap" || value.toLowerCase() === "asap") return "Jak najszybciej";
  
  // Sprawdź czy to już jest czas w formacie HH:MM
  if (/^\d{1,2}:\d{2}$/.test(value)) {
    return value;
  }
  
  // Próbuj sparsować jako datę
  const date = new Date(value);
  if (isNaN(date.getTime()) || date.toString() === "Invalid Date") {
    return "-";
  }
  
  return date.toLocaleTimeString("pl-PL", { 
    timeZone: APP_TZ, 
    hour: "2-digit", 
    minute: "2-digit" 
  });
};


/* -------------------------------- produkty -------------------------------- */

const parseProducts = (itemsData: any): any[] => {
  if (!itemsData) return [];
  if (typeof itemsData === "string") {
    try { return parseProducts(JSON.parse(itemsData)); }
    catch { return itemsData.split(",").map((n) => ({ name: n.trim(), quantity: 1, price: 0 })); }
  }
  if (Array.isArray(itemsData)) return itemsData;
  if (typeof itemsData === "object") {
    const keys = ["items", "order_items", "cart", "positions", "products", "lines"];
    for (const k of keys) if (Array.isArray((itemsData as any)[k])) return (itemsData as any)[k];
    return [itemsData];
  }
  return [];
};

const collectStrings = (val: any): string[] => {
  if (!val) return [];
  if (typeof val === "string") return [val];
  if (Array.isArray(val)) return val.flatMap((v) => collectStrings(v)).filter(Boolean);
  if (typeof val === "object") {
    const truthy = Object.entries(val)
      .filter(([, v]) => v === true || v === 1 || v === "1")
      .map(([k]) => k);
    if (truthy.length) return truthy;
    if ((val as any).items && Array.isArray((val as any).items)) return collectStrings((val as any).items);
    const preferred = ["name", "title", "label", "value", "option", "variant"]
      .map((k) => (typeof (val as any)[k] === "string" ? (val as any)[k] : undefined))
      .filter(Boolean) as string[];
    if (preferred.length) return preferred;
  }
  return [];
};

const deepFindName = (root: Any): string | undefined => {
  const skipKeys = new Set(["addons","extras","toppings","ingredients","options","selected_addons"]);
  const nameMatchers = [
    /^name$/i, /^title$/i, /^label$/i,
    /product.*name/i, /menu.*name/i, /item.*name/i,
    /^menu_item_name$/i, /^item_name$/i, /^nazwa(_pl)?$/i,
  ];
  const q: Array<{node:any}> = [{ node: root }];
  const seen = new Set<any>();
  while (q.length) {
    const { node } = q.shift()!;
    if (!node || typeof node !== "object" || seen.has(node)) continue;
    seen.add(node);
    if (Array.isArray(node)) { q.push(...node.map((n) => ({ node: n }))); continue; }
    for (const [k, v] of Object.entries(node)) {
      if (skipKeys.has(k)) continue;
      if (typeof v === "string" && nameMatchers.some((r) => r.test(k)) && v.trim()) return v.trim();
      if (typeof v === "object") q.push({ node: v });
    }
  }
  return undefined;
};

/* --------------------------- dodatki i warianty --------------------------- */

type Addon = { name: string; qty: number };
type Attribute = { key: string; value: string };

const cleanLabel = (s: string) =>
  s.replace(/\s*[+\-]?\s*\d+[.,]?\d*\s*zł/gi, "").replace(/\s{2,}/g, " ").trim();

const ATTR_KEYS = [/^mi[eę]so$/i, /^stopie[nń]/i, /^rozmiar$/i, /^sos$/i, /^ostro/i];
const ADDON_BLOCK = [/^mi[eę]so\b/i, /wysmaż/i, /^stopie[nń]/i, /^rozmiar\b/i];

const isAddonAllowed = (label: string) => {
  const t = cleanLabel(label);
  if (!t || t === "-" || t === "0") return false;
  if (t.includes(":")) return false;
  return !ADDON_BLOCK.some((re) => re.test(t));
};

const shouldShowAttributeForProduct = (productName: string, attrKey: string) => {
  const key = attrKey.toLowerCase();
  if (key.startsWith("mięso") || key.startsWith("mieso")) {
    return /(burger|cheeseburger|kebab|wrap|tortilla)/i.test(productName);
  }
  return true;
};

const parseAddonString = (s: string): Addon | null => {
  if (!s) return null;
  let raw = cleanLabel(String(s));
  let m = raw.match(/^\s*(\d+)\s*[x×]\s*(.+)$/i);
  if (m) return { name: cleanLabel(m[2]), qty: Math.max(1, Number(m[1])) };
  m = raw.match(/^(.+?)\s*[x×]\s*(\d+)\s*$/i);
  if (m) return { name: cleanLabel(m[1]), qty: Math.max(1, Number(m[2])) };
  m = raw.match(/^(.+?)\s*\(\s*(?:x\s*)?(\d+)\s*\)\s*$/i);
  if (m) return { name: cleanLabel(m[1]), qty: Math.max(1, Number(m[2])) };
  return { name: raw, qty: 1 };
};

const collectAddonsDetailed = (val: any): Addon[] => {
  if (!val) return [];
  if (typeof val === "string") {
    const a = parseAddonString(val);
    return a ? [a] : [];
  }
  if (Array.isArray(val)) return val.flatMap((v) => collectAddonsDetailed(v));
  if (typeof val === "object") {
    const truthy = Object.entries(val)
      .filter(([, v]) => v === true || v === 1 || v === "1")
      .map(([k]) => ({ name: cleanLabel(k), qty: 1 }));
    if (truthy.length) return truthy;

    const name =
      (typeof (val as any).name === "string" && (val as any).name) ||
      (typeof (val as any).title === "string" && (val as any).title) ||
      (typeof (val as any).label === "string" && (val as any).label) ||
      deepFindName(val);

    const qty = toNumber((val as any).qty ?? (val as any).quantity ?? (val as any).amount ?? 1, 1) || 1;
    if (name) return [{ name: cleanLabel(name), qty: Math.max(1, qty) }];
  }
  return [];
};

const aggregateAddons = (list: Addon[]): Addon[] => {
  const map = new Map<string, Addon>();
  for (const a of list) {
    const key = cleanLabel(a.name).toLowerCase();
    if (!key) continue;
    const prev = map.get(key);
    if (prev) prev.qty += a.qty;
    else map.set(key, { name: cleanLabel(a.name), qty: a.qty });
  }
  return Array.from(map.values());
};

const parseAttributePair = (s: string): Attribute | null => {
  const m = s.split(":");
  if (m.length < 2) return null;
  const key = cleanLabel(m[0]);
  const value = cleanLabel(m.slice(1).join(":"));
  if (!key || !value) return null;
  if (!ATTR_KEYS.some((re) => re.test(key))) return null;
  return { key, value };
};

const collectAttributes = (val: any): Attribute[] => {
  if (!val) return [];
  if (typeof val === "string") {
    const a = parseAttributePair(val);
    return a ? [a] : [];
  }
  if (Array.isArray(val)) return val.flatMap((v) => collectAttributes(v));
  if (typeof val === "object") {
    const key =
      (typeof (val as any).label === "string" && (val as any).label) ||
      (typeof (val as any).name === "string" && (val as any).name) ||
      (typeof (val as any).title === "string" && (val as any).title) ||
      "";
    const value =
      (typeof (val as any).value === "string" && (val as any).value) ||
      (typeof (val as any).option === "string" && (val as any).option) ||
      (typeof (val as any).variant === "string" && (val as any).variant) ||
      "";
    const a = key && value ? { key: cleanLabel(key), value: cleanLabel(value) } : null;
    return a ? [a] : [];
  }
  return [];
};

const aggregateAttributes = (list: Attribute[]): Attribute[] => {
  const map = new Map<string, Attribute>();
  for (const a of list) {
    const k = cleanLabel(a.key);
    const v = cleanLabel(a.value);
    if (!k || !v) continue;
    const id = `${k.toLowerCase()}::${v.toLowerCase()}`;
    if (!map.has(id)) map.set(id, { key: k, value: v });
  }
  return Array.from(map.values());
};

/* ----------------------- helper do wykrywania mięsa ----------------------- */

const MEAT_KEYS = [/^mi[eę]so/i, /meat/i];
const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

const pickMeat = (src: any): string | undefined => {
  if (!src) return;
  if (typeof src === "string") return src.trim() || undefined;
  if (Array.isArray(src)) {
    for (const el of src) { const v = pickMeat(el); if (v) return v; }
    return;
  }
  if (typeof src === "object") {
    const direct = ["meatType","meat","meat_type","meatLabel","meat_value","meatOption","meat_option","meatSelected","selected_meat"];
    for (const k of direct) {
      const v = (src as any)[k];
      if (typeof v === "string" && v.trim()) return v.trim();
    }
    if ((src as any).label && (src as any).value && MEAT_KEYS.some(re => re.test((src as any).label))) {
      return String((src as any).value).trim();
    }
    for (const [k,v] of Object.entries(src)) {
      if (MEAT_KEYS.some(re => re.test(k)) && typeof v === "string" && v.trim()) return v.trim();
    }
    return (
      pickMeat((src as any).selected_options) ||
      pickMeat((src as any).attributes) ||
      pickMeat((src as any).options) ||
      pickMeat((src as any).variants) ||
      pickMeat((src as any).choices)
    );
  }
};

/* ---------------------------- normalizacja pozycji ---------------------------- */

const normalizeProduct = (raw: Any) => {
  const shallow = [
    raw.name, raw.product_name, raw.productName, raw.title, raw.label, raw.menu_item_name, raw.item_name,
    raw.nazwa, raw.nazwa_pl, typeof raw.product === "string" ? raw.product : undefined,
    raw.product?.name, raw.item?.name, raw.product?.title,
  ].filter((x) => typeof x === "string" && x.trim()) as string[];

  const deep = deepFindName(raw);
  const name = (shallow[0] || deep || "(bez nazwy)") as string;

  const price = toNumber(raw.price ?? raw.unit_price ?? raw.total_price ?? raw.amount_price ?? raw.item?.price ?? 0);
  const quantity = toNumber(raw.quantity ?? raw.qty ?? raw.amount ?? 1, 1) || 1;

  const optionsRaw = raw.options;
  const optionsWasString = typeof optionsRaw === "string";
  let opts: any = {};
  if (optionsWasString) { try { opts = JSON.parse(optionsRaw as string); } catch {} }
  else { opts = optionsRaw || {}; }

  const addonArrays = [
    raw.addons, raw.extras, raw.selected_addons, raw.toppings,
    opts?.addons, opts?.extras, opts?.selected_addons, opts?.toppings,
  ].filter(Boolean);

  let addonsDetailed = aggregateAddons(
    addonArrays.flatMap((v) => collectAddonsDetailed(v))
  ).filter((a) => isAddonAllowed(a.name));

  const extraMeatCount = toNumber(opts?.extraMeatCount ?? raw.extraMeatCount ?? 0, 0);
  if (extraMeatCount > 0) addonsDetailed.push({ name: "Dodatkowe mięso", qty: extraMeatCount });

  const addons = addonsDetailed.map((a) => a.name);
  const addonsTotalQty = addonsDetailed.reduce((s, a) => s + a.qty, 0);

  let attributes = aggregateAttributes([
    ...collectAttributes(raw.selected_options),
    ...collectAttributes(raw.attributes),
    ...collectAttributes(opts?.selected_options),
    ...collectAttributes(opts?.attributes),
    ...collectStrings(raw.addons).map((s) => parseAttributePair(s)).filter(Boolean) as Attribute[],
    ...collectStrings(raw.options).map((s) => parseAttributePair(s)).filter(Boolean) as Attribute[],
    ...collectStrings(raw.selected_addons).map((s) => parseAttributePair(s)).filter(Boolean) as Attribute[],
    ...(optionsWasString ? collectAttributes(optionsRaw) : []),
  ]);

  const meat =
    pickMeat(opts) ||
    pickMeat(raw.selected_options) ||
    pickMeat(raw.attributes) ||
    (optionsWasString ? pickMeat(optionsRaw) : undefined);

  if (meat) attributes.push({ key: "Mięso", value: cap(meat) });

  attributes = aggregateAttributes(attributes).filter((a) => shouldShowAttributeForProduct(name, a.key));

  const ingredients =
    collectStrings(raw.ingredients).length
      ? collectStrings(raw.ingredients)
      : collectStrings(
          raw.components ?? raw.composition ?? raw.sklad ?? raw.skladniki ?? raw.ingredients_list ?? raw.product?.ingredients
        );

  const description =
    (typeof raw.description === "string" && raw.description) ||
    (typeof raw.opis === "string" && raw.opis) ||
    (typeof raw.product?.description === "string" && raw.product.description) ||
    undefined;

  const note =
    (typeof opts?.note === "string" && opts.note) ||
    (typeof opts?.comments === "string" && opts.comments) ||
    (typeof raw.note === "string" && raw.note) ||
    (typeof raw.comment === "string" && raw.comment) ||
    (typeof raw.notes === "string" && raw.notes) ||
    undefined;

  return {
    name, price, quantity,
    addons, addonsDetailed, addonsTotalQty,
    attributes, ingredients, description, note, _raw: raw
  };
};

/* ----------------------------------- UI ----------------------------------- */

const Badge: React.FC<{ tone: "amber" | "blue" | "rose" | "slate" | "green" | "yellow"; children: React.ReactNode; isDark?: boolean }> = ({ tone, children, isDark = true }) => {
  const cls =
    tone === "amber" 
      ? isDark ? "bg-amber-500/20 text-amber-400 border-amber-500/30" : "bg-amber-100 text-amber-700 border-amber-300"
    : tone === "blue" 
      ? isDark ? "bg-blue-500/20 text-blue-400 border-blue-500/30" : "bg-blue-100 text-blue-700 border-blue-300"
    : tone === "rose" 
      ? isDark ? "bg-rose-500/20 text-rose-400 border-rose-500/30" : "bg-rose-100 text-rose-700 border-rose-300"
    : tone === "green" 
      ? isDark ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" : "bg-emerald-100 text-emerald-700 border-emerald-300"
    : tone === "yellow" 
      ? isDark ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" : "bg-yellow-100 text-yellow-700 border-yellow-300"
    : isDark ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" : "bg-emerald-100 text-emerald-700 border-emerald-300";
  return <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold border ${cls}`}>{children}</span>;
};

const InlineCountdown: React.FC<{ targetTime: string; onComplete?: () => void }> = ({ targetTime, onComplete }) => {
  const [ms, setMs] = useState(() => Math.max(0, new Date(targetTime).getTime() - Date.now()));
  useEffect(() => {
    const iv = setInterval(() => {
      const left = new Date(targetTime).getTime() - Date.now();
      setMs(Math.max(0, left));
      if (left <= 0) onComplete?.();
    }, 1000);
    return () => clearInterval(iv);
  }, [targetTime, onComplete]);
  const sec = Math.floor(ms / 1000);
  const mm = String(Math.floor(sec / 60)).padStart(2, "0");
  const ss = String(sec % 60).padStart(2, "0");
  const isLow = sec < 120;
  return <span className={`rounded-lg px-3 py-1 font-mono text-sm font-semibold ${isLow ? 'bg-rose-500/20 text-rose-400' : 'bg-slate-700 text-white'}`}>{mm}:{ss}</span>;
};

const AcceptButton: React.FC<{
  order: Order;
  onAccept: (minutes: number) => Promise<void> | void;
}> = ({ order, onAccept }) => {
  const isDelivery = order.selected_option === "delivery";
  const options = isDelivery ? [30, 60, 90, 120] : [15, 30, 45, 60];
  const [open, setOpen] = useState(false);
  const [minutes, setMinutes] = useState(options[0]);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        className="h-10 rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white shadow-lg shadow-emerald-900/30 hover:bg-emerald-500 transition-colors"
        onClick={() => setOpen((o) => !o)}
      >
        Akceptuj ({minutes >= 60 ? `${minutes / 60} h` : `${minutes} min`})
      </button>
      {open && (
        <div className="absolute left-0 top-11 z-10 w-44 overflow-hidden rounded-lg border border-slate-700 bg-slate-800 shadow-xl">
          {options.map((m) => (
            <button
              key={m}
              onClick={async () => { setMinutes(m); setOpen(false); await onAccept(m); }}
              className="flex w-full items-center justify-between px-3 py-2.5 text-sm text-slate-300 hover:bg-slate-700 transition-colors"
            >
              <span>{m >= 60 ? `${m / 60} h` : `${m} min`}</span>
              {minutes === m && <span className="text-emerald-400">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default function PickupOrdersPage() {
  const supabase = createClientComponentClient();
  const { isDark } = useTheme();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);

  const [page, setPage] = useState(1);
  const perPage = 10;
  const [total, setTotal] = useState(0);

  const [filterStatus, setFilterStatus] = useState<"all" | Order["status"]>("all");
  const [filterOption, setFilterOption] = useState<"all" | Order["selected_option"]>("all");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);

  // Ustawienia dostępności zamówień
  const [orderSettings, setOrderSettings] = useState({
    orders_enabled: true,
    local_enabled: true,
    takeaway_enabled: true,
    delivery_enabled: true,
  });
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Rezerwacje oczekujące
  interface PendingReservation {
    id: string;
    customer_name: string;
    customer_phone: string;
    reservation_date: string;
    reservation_time: string;
    party_size: number;
    number_of_guests?: number;
    notes?: string;
    status: string;
  }
  const [pendingReservations, setPendingReservations] = useState<PendingReservation[]>([]);
  const [showReservations, setShowReservations] = useState(true);
  const [reservationsLoading, setReservationsLoading] = useState(false);

  // Pobierz oczekujące rezerwacje
  const fetchPendingReservations = useCallback(async () => {
    setReservationsLoading(true);
    try {
      const today = new Date();
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
      
      const { data, error } = await supabase
        .from("reservations")
        .select("*")
        .eq("status", "pending")
        .gte("reservation_date", todayStr)
        .order("reservation_date", { ascending: true })
        .order("reservation_time", { ascending: true });

      if (!error && data) {
        setPendingReservations(data as PendingReservation[]);
      }
    } catch (e) {
      console.error("Błąd pobierania rezerwacji:", e);
    } finally {
      setReservationsLoading(false);
    }
  }, [supabase]);

  // Akceptuj/odrzuć rezerwację - używa API z wysyłką e-maila
  const handleReservationStatus = async (id: string, newStatus: "confirmed" | "cancelled") => {
    try {
      const res = await fetch("/api/reservations/status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: newStatus }),
      });

      if (res.ok) {
        setPendingReservations((prev) => prev.filter((r) => r.id !== id));
      }
    } catch (error) {
      console.error("Błąd zmiany statusu rezerwacji:", error);
    }
  };

  useEffect(() => {
    fetchPendingReservations();
  }, [fetchPendingReservations]);

  // Realtime dla rezerwacji
  useEffect(() => {
    const channel = supabase
      .channel("reservations-pickup")
      .on("postgres_changes", { event: "*", schema: "public", table: "reservations" }, () => {
        fetchPendingReservations();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, fetchPendingReservations]);

  // Pobierz ustawienia zamówień
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await fetch("/api/settings/orders");
        if (res.ok) {
          const data = await res.json();
          setOrderSettings(data);
        }
      } catch {}
    };
    fetchSettings();
  }, []);

  // Aktualizuj pojedyncze ustawienie
  const toggleSetting = async (key: keyof typeof orderSettings) => {
    setSettingsLoading(true);
    try {
      const newValue = !orderSettings[key];
      const res = await fetch("/api/settings/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: newValue }),
      });
      if (res.ok) {
        setOrderSettings((prev) => ({ ...prev, [key]: newValue }));
      }
    } catch {} finally {
      setSettingsLoading(false);
    }
  };

  // Helper do klas w zależności od motywu
  const t = useMemo(() => ({
    bg: isDark ? "bg-slate-900" : "bg-gray-50",
    bgCard: isDark ? "bg-slate-800/60" : "bg-white",
    bgSection: isDark ? "bg-slate-900/50" : "bg-gray-100",
    bgInput: isDark ? "bg-slate-900" : "bg-white",
    bgHeader: isDark ? "bg-slate-800/95" : "bg-white/95",
    border: isDark ? "border-slate-700/50" : "border-gray-200",
    borderInput: isDark ? "border-slate-700" : "border-gray-300",
    text: isDark ? "text-white" : "text-gray-900",
    textMuted: isDark ? "text-slate-400" : "text-gray-600",
    textSubtle: isDark ? "text-slate-500" : "text-gray-500",
    textPrice: isDark ? "text-amber-400" : "text-amber-600",
    cardNew: isDark ? "border-amber-500/30 bg-slate-800/80" : "border-amber-400 bg-amber-50",
    cardAccepted: isDark ? "border-blue-500/30 bg-slate-800/80" : "border-blue-400 bg-blue-50",
    cardCancelled: isDark ? "border-rose-500/30 bg-slate-800/80" : "border-rose-400 bg-rose-50",
    cardCompleted: isDark ? "border-emerald-500/30 bg-slate-800/60" : "border-emerald-400 bg-emerald-50",
  }), [isDark]);

  const getStatusTone = (s: Order["status"]) =>
    s === "accepted" ? t.cardAccepted
    : s === "cancelled" ? t.cardCancelled
    : s === "completed" ? t.cardCompleted
    : t.cardNew;

  // audio
  const newOrderAudio = useRef<HTMLAudioElement | null>(null);
  useEffect(() => {
    const a = new Audio("/new-order.mp3");
    a.preload = "auto";
    a.volume = 1;
    newOrderAudio.current = a;
    const unlock = async () => { try { a.currentTime = 0; await a.play(); a.pause(); } catch {} };
    window.addEventListener("pointerdown", unlock, { once: true });
    return () => window.removeEventListener("pointerdown", unlock);
  }, []);
  const playDing = useCallback(async () => {
    try { if (newOrderAudio.current) { newOrderAudio.current.currentTime = 0; await newOrderAudio.current.play(); } } catch {}
  }, []);

  const prevIdsRef = useRef<Set<string>>(new Set());
  const initializedRef = useRef(false);

  // fetchOrders z opcją "silent"
  const fetchOrders = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = !!opts?.silent;
    try {
      if (!silent && !editingOrderId) setLoading(true);
      const offset = (page - 1) * perPage;
      const res = await fetch(`/api/orders/current?limit=${perPage}&offset=${offset}`, { cache: "no-store" });
      if (!res.ok) return;

      const { orders: raw, totalCount } = await res.json();
      const mapped: Order[] = raw.map((o: any) => ({
        id: o.id,
        name: o.name ?? o.customer_name ?? o.client_name ?? undefined,
        total_price: toNumber(o.total_price),
        delivery_cost: o.delivery_cost ?? null,
        discount_amount: o.discount_amount ?? null,
        promo_code: o.promo_code ?? null,
        created_at: o.created_at,
        status: o.status,
        clientDelivery: o.client_delivery_time ?? o.clientDelivery,
delivery_time: o.delivery_time ?? undefined,

        address:
          o.selected_option === "delivery"
            ? `${o.street || ""}${o.flat_number ? `, nr ${o.flat_number}` : ""}${o.city ? `, ${o.city}` : ""}`
            : o.address || "",
        street: o.street,
        flat_number: o.flat_number,
        city: o.city,
        phone: o.phone,
        order_note: o.order_note ?? null,
        items: o.items ?? o.order_items ?? [],
        selected_option: o.selected_option,
        payment_method: (o.payment_method as PaymentMethod) ?? "Gotówka",
        payment_status: (o.payment_status as PaymentStatus) ?? null,
      }));

      setTotal(totalCount ?? 0);

      mapped.sort((a, b) => {
        const ta = +new Date(a.created_at);
        const tb = +new Date(b.created_at);
        return sortOrder === "desc" ? tb - ta : ta - tb;
      });

      const prev = prevIdsRef.current;
      const newOnes = mapped.filter((o) => (o.status === "new" || o.status === "pending" || o.status === "placed") && !prev.has(o.id));
      if (!silent && initializedRef.current && newOnes.length > 0) void playDing();
      prevIdsRef.current = new Set(mapped.map((o) => o.id));
      initializedRef.current = true;

      setOrders(mapped);
    } finally {
      if (!silent && !editingOrderId) setLoading(false);
    }
  }, [page, perPage, sortOrder, editingOrderId, playDing]);

  useEffect(() => {
    fetchOrders();
    const ch = supabase
      .channel("orders-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => fetchOrders())
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [fetchOrders, supabase]);

  // lekki nasłuch płatności
  useEffect(() => {
    const ch = supabase
      .channel("orders-payments")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders" }, (payload: any) => {
        const n = payload.new;
        setOrders((prev) => prev.map((o) => (o.id === n.id ? { ...o, payment_status: n.payment_status, payment_method: n.payment_method } : o)));
      })
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [supabase]);

  // polling płatności (pełny refresh)
  useEffect(() => {
    const hasPending = orders.some((o) => o.payment_method === "Online" && o.payment_status === "pending");
    if (!hasPending || editingOrderId) return;
    const iv = setInterval(() => fetchOrders(), 3000);
    return () => clearInterval(iv);
  }, [orders, editingOrderId, fetchOrders]);

  const lastRefreshRef = useRef<Map<string, number>>(new Map());
  const refreshPaymentStatus = async (id: string) => {
    try {
      setEditingOrderId(id);
      const res = await fetch(`/api/payments/p24/refresh?id=${id}`, { method: "POST" });
      if (!res.ok) return;
      const { payment_status } = await res.json();
      setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, payment_status: payment_status as PaymentStatus } : o)));
    } finally {
      setEditingOrderId(null);
    }
  };
  useEffect(() => {
    const iv = setInterval(() => {
      const now = Date.now();
      orders.forEach((o) => {
        if (o.payment_method === "Online" && o.payment_status === "pending") {
          const last = lastRefreshRef.current.get(o.id) ?? 0;
          if (now - last >= 15000) {
            lastRefreshRef.current.set(o.id, now);
            void refreshPaymentStatus(o.id);
          }
        }
      });
    }, 15000);
    return () => clearInterval(iv);
  }, [orders]);

  // dźwięk co 2 s dopóki są „new” (działa tylko gdy ekran/aplikacja jest aktywna;
// na zablokowanym ekranie dźwięk zapewnia systemowa notyfikacja Web Push)
const hasNew = useMemo(
  () => orders.some((o) => o.status === "new" || o.status === "pending" || o.status === "placed"),
  [orders]
);

useEffect(() => {
  if (!initializedRef.current) return;
  if (!hasNew) return;

  const tick = () => {
    if (document.visibilityState === "visible") void playDing();
  };

  tick();
  const iv = setInterval(tick, 2000);
  return () => clearInterval(iv);
}, [hasNew, playDing]);


  // AUTO-refresh co 5s (taki sam jak przycisk) + odśwież po powrocie
  useEffect(() => {
    const iv = setInterval(() => {
      if (document.hidden) return;
      if (editingOrderId) return;
      void fetchOrders(); // pełny (bez "silent")
    }, 5000);
    return () => clearInterval(iv);
  }, [fetchOrders, editingOrderId]);

  useEffect(() => {
    const onWake = () => { void fetchOrders(); };
    window.addEventListener("focus", onWake);
    document.addEventListener("visibilitychange", onWake);
    return () => {
      window.removeEventListener("focus", onWake);
      document.removeEventListener("visibilitychange", onWake);
    };
  }, [fetchOrders]);

  const updateLocal = (id: string, upd: Partial<Order>) =>
    setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, ...upd } : o)));

  const completeOrder = async (id: string) => {
    const res = await fetch(`/api/orders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "completed" }),
    });
    if (res.ok) updateLocal(id, { status: "completed" });
  };

  const acceptAndSetTime = async (order: Order, minutes: number) => {
    const dt = new Date(Date.now() + minutes * 60000).toISOString();
    try {
      setEditingOrderId(order.id);
      const res = await fetch(`/api/orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "accepted", delivery_time: dt }),
      });
      if (!res.ok) return;
      updateLocal(order.id, { status: "accepted", delivery_time: dt });
      fetchOrders();
    } finally { setEditingOrderId(null); }
  };

  const extendTime = async (order: Order, minutes: number) => {
    const base = order.delivery_time && !isNaN(Date.parse(order.delivery_time)) ? new Date(order.delivery_time) : new Date();
    const dt = new Date(base.getTime() + minutes * 60000).toISOString();
    try {
      setEditingOrderId(order.id);
      const res = await fetch(`/api/orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ delivery_time: dt }),
      });
      if (!res.ok) return;
      updateLocal(order.id, { delivery_time: dt });
      fetchOrders();
    } finally { setEditingOrderId(null); }
  };

  const restoreOrder = async (id: string) => {
    const res = await fetch(`/api/orders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "new" }),
    });
    if (res.ok) { updateLocal(id, { status: "new" }); fetchOrders(); }
  };

  const paymentBadge = (o: Order) => {
    if (o.payment_method === "Online") {
      if (o.payment_status === "paid")   return <Badge tone="green" isDark={isDark}>OPŁACONE ONLINE</Badge>;
      if (o.payment_status === "failed") return <Badge tone="rose" isDark={isDark}>ONLINE – BŁĄD</Badge>;
      return <Badge tone="yellow" isDark={isDark}>ONLINE – OCZEKUJE</Badge>;
    }
    if (o.payment_method === "Terminal") return <Badge tone="blue" isDark={isDark}>TERMINAL</Badge>;
    return <Badge tone="amber" isDark={isDark}>GOTÓWKA</Badge>;
  };

  const setPaymentMethod = async (o: Order, method: PaymentMethod) => {
    try {
      setEditingOrderId(o.id);
      const patch: any = { payment_method: method };
      if (method !== "Online") patch.payment_status = null;
      const res = await fetch(`/api/orders/${o.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) return;
      updateLocal(o.id, { payment_method: method, payment_status: patch.payment_status ?? o.payment_status });
    } finally { setEditingOrderId(null); }
  };

  const filtered = useMemo(
    () =>
      orders
        .filter((o) => (filterStatus === "all" ? true : o.status === filterStatus))
        .filter((o) => (filterOption === "all" ? true : o.selected_option === filterOption)),
    [orders, filterStatus, filterOption]
  );

  const newList = filtered.filter((o) =>
    o.status === "new" || o.status === "pending" || o.status === "placed"
  );
  const currList = filtered.filter((o) => o.status === "accepted");
  const histList = filtered.filter((o) => o.status === "cancelled" || o.status === "completed");

  const ProductItem: React.FC<{ raw: any; onDetails?: (p: any) => void }> = ({ raw, onDetails }) => {
    const p = normalizeProduct(raw);
    const attrsLine =
      p.attributes?.length ? `Warianty: ${p.attributes.map((a: Attribute) => `${a.key}: ${a.value}`).join(", ")}` : "";
    const addonsLine =
      p.addonsDetailed.length > 0
        ? `Dodatki: ${p.addonsDetailed.map((a) => `${a.name} ×${a.qty}`).join(", ")}`
        : "";
    return (
      <div className={`rounded-lg border p-4 ${isDark ? "border-slate-700/50 bg-slate-900/60" : "border-gray-200 bg-gray-50"}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className={`text-sm font-semibold ${t.text}`}>{p.name}</div>
            <div className={`mt-1 text-xs ${t.textMuted}`}>Ilość: <span className={`font-medium ${isDark ? "text-slate-300" : "text-gray-700"}`}>{p.quantity}</span></div>
            {attrsLine && <div className={`mt-1 text-xs ${t.textMuted}`}>{attrsLine}</div>}
            {addonsLine && <div className={`mt-1 text-xs ${t.textMuted}`}>{addonsLine}</div>}
            {p.ingredients.length > 0 && (
              <div className={`mt-1 text-xs ${t.textSubtle}`}>Skład: {p.ingredients.join(", ")}</div>
            )}
            {p.note && <div className="mt-2 text-xs italic text-amber-500">Notatka: {p.note}</div>}
            {onDetails && (
              <button onClick={() => onDetails(p)} className="mt-2 text-xs font-medium text-blue-500 hover:text-blue-400 transition-colors">
                Szczegóły
              </button>
            )}
          </div>
          <div className={`whitespace-nowrap text-sm font-semibold ${t.textPrice}`}>{p.price.toFixed(2)} zł</div>
        </div>
      </div>
    );
  };

  const ProductDetailsModal: React.FC<{ product: any; onClose(): void }> = ({ product, onClose }) => {
    const p = normalizeProduct(product);
    const title = p.quantity > 1 ? `${p.name} x${p.quantity}` : p.name;
    return (
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 backdrop-blur-sm p-4 sm:items-center" onClick={onClose}>
        <div className={`w-full max-w-lg rounded-xl border p-6 shadow-2xl ${isDark ? "border-slate-700 bg-slate-800" : "border-gray-200 bg-white"}`} onClick={(e) => e.stopPropagation()}>
          <div className="mb-4 flex items-center justify-between">
            <h2 className={`text-lg font-semibold ${t.text}`}>{title}</h2>
            <button onClick={onClose} className={`h-8 w-8 flex items-center justify-center rounded-lg transition-colors ${isDark ? "hover:bg-slate-700" : "hover:bg-gray-100"}`}>
              <span className={`text-xl ${t.textMuted}`}>&times;</span>
            </button>
          </div>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between"><span className={t.textMuted}>Cena:</span><span className={`font-semibold ${t.textPrice}`}>{p.price.toFixed(2)} zł</span></div>
            {p.attributes?.length > 0 && (
              <div>
                <span className={t.textMuted}>Warianty:</span>
                <ul className={`ml-5 mt-1 list-disc ${isDark ? "text-slate-300" : "text-gray-700"}`}>
                  {p.attributes.map((a: Attribute, i: number) => (
                    <li key={i}>{a.key}: <span className={t.text}>{a.value}</span></li>
                  ))}
                </ul>
              </div>
            )}
            {p.description && <div><span className={t.textMuted}>Opis:</span> <span className={isDark ? "text-slate-300" : "text-gray-700"}>{p.description}</span></div>}
            {p.ingredients.length > 0 && (
              <div>
                <span className={t.textMuted}>Składniki:</span>
                <ul className={`ml-5 mt-1 list-disc ${isDark ? "text-slate-300" : "text-gray-700"}`}>{p.ingredients.map((x: string, i: number) => <li key={i}>{x}</li>)}</ul>
              </div>
            )}
            {p.addonsDetailed.length > 0 && (
              <div>
                <span className={t.textMuted}>Dodatki:</span>
                <ul className={`ml-5 mt-1 list-disc ${isDark ? "text-slate-300" : "text-gray-700"}`}>
                  {p.addonsDetailed.map((a, i) => (
                    <li key={i}>{a.name} <span className={t.textSubtle}>×{a.qty}</span></li>
                  ))}
                </ul>
              </div>
            )}
            {p.note && <div className="mt-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-500 italic">Notatka: {p.note}</div>}
          </div>
        </div>
      </div>
    );
  };

  const ProductList = ({ list, title }: { list: Order[]; title: string }) => (
    <section className="space-y-4">
      <h2 className={`text-xl font-semibold ${t.text}`}>{title}</h2>
      {loading && list === newList && <p className={`text-center ${t.textSubtle}`}>Ładowanie…</p>}
      {list.length === 0 ? (
        <p className={`text-center ${t.textSubtle}`}>Brak pozycji.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {list.map((o) => {
            const prods = parseProducts(o.items);
            return (
              <article key={o.id} className={`rounded-xl border-2 p-5 ${getStatusTone(o.status)}`}>
                <header className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className={`text-lg font-bold tracking-tight ${t.text}`}>{getOptionLabel(o.selected_option)}</h3>
                      <Badge tone={o.status === "accepted" ? "blue" : o.status === "cancelled" ? "rose" : o.status === "completed" ? "green" : "amber"} isDark={isDark}>
                        {o.status.toUpperCase()}
                      </Badge>
                      {paymentBadge(o)}
                      {toNumber(o.discount_amount) > 0 && (
                        <Badge tone="green" isDark={isDark}>RABAT{o.promo_code ? `: ${o.promo_code}` : ""}</Badge>
                      )}
                    </div>
                    <div className={`text-sm ${t.textMuted}`}>
                      <span className={t.textSubtle}>Klient:</span> <span className={isDark ? "text-slate-300" : "text-gray-700"}>{o.name || "—"}</span>
                      <span className={isDark ? "mx-3 text-slate-700" : "mx-3 text-gray-300"}>|</span>
                      <span className={t.textSubtle}>Czas:</span>{" "}
                      <span className={isDark ? "text-slate-300" : "text-gray-700"}>{formatClientDeliveryTime(o.clientDelivery)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
{o.status === "accepted" && isValidDateString(o.delivery_time) && (
  <InlineCountdown targetTime={o.delivery_time!} onComplete={() => completeOrder(o.id)} />
)}<span className={t.textSubtle}>
  {new Date(o.created_at).toLocaleString("pl-PL", { timeZone: APP_TZ })}
</span>
                  </div>
                </header>

                <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
                  <div className="space-y-2 text-sm">
                    <div className={`rounded-lg p-4 space-y-2 ${t.bgSection}`}>
                      <div className="flex justify-between"><span className={t.textSubtle}>Kwota:</span><span className={`font-semibold ${t.text}`}>{o.total_price.toFixed(2)} zł</span></div>
                      {toNumber(o.discount_amount) > 0 && (
                        <div className="flex justify-between">
                          <span className={t.textSubtle}>Rabat:</span>
                          <span className="font-medium text-emerald-500">-{toNumber(o.discount_amount).toFixed(2)} zł
                            {o.promo_code ? <span className="ml-1 text-xs text-emerald-500/70">({o.promo_code})</span> : null}
                          </span>
                        </div>
                      )}
                      {o.selected_option === "delivery" && typeof o.delivery_cost === "number" && (
                        <div className="flex justify-between"><span className={t.textSubtle}>Dostawa:</span><span className={t.textMuted}>{o.delivery_cost.toFixed(2)} zł</span></div>
                      )}
                      {o.selected_option === "delivery" && o.address && (
                        <div className={`pt-2 border-t ${t.border}`}><span className={t.textSubtle}>Adres:</span><div className={`mt-1 ${t.textMuted}`}>{o.address}</div></div>
                      )}
                      {o.phone && <div className="flex justify-between"><span className={t.textSubtle}>Telefon:</span><span className={`font-mono ${t.textMuted}`}>{o.phone}</span></div>}
                    </div>
                    {o.order_note && o.order_note.trim() && (
                      <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-500">
                        <span className="font-semibold">Notatka:</span>{" "}
                        <span className="whitespace-pre-wrap break-words">{o.order_note.trim()}</span>
                      </div>
                    )}
                    <div className={`rounded-lg p-4 ${t.bgSection}`}>
                      <div className={`text-xs mb-2 ${t.textSubtle}`}>Płatność</div>
                      <div className="flex flex-wrap items-center gap-2">
                        <select
                          value={o.payment_method || "Gotówka"}
                          onChange={(e) => setPaymentMethod(o, e.target.value as PaymentMethod)}
                          className={`h-9 rounded-lg border px-3 text-sm focus:outline-none ${isDark ? "border-slate-700 bg-slate-800 text-slate-300 focus:border-slate-600" : "border-gray-300 bg-white text-gray-700"}`}
                          disabled={editingOrderId === o.id}
                        >
                          <option>Gotówka</option>
                          <option>Terminal</option>
                          <option>Online</option>
                        </select>

                        {o.payment_method === "Online" && (
                          <>
                            {o.payment_status === "pending" && (
                              <button
                                onClick={() => refreshPaymentStatus(o.id)}
                                className="h-9 rounded-lg bg-blue-600 px-3 text-xs font-semibold text-white hover:bg-blue-500 transition-colors"
                                disabled={editingOrderId === o.id}
                              >
                                Odśwież status
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="lg:col-span-2">
                    <div className={`mb-3 text-sm font-semibold ${t.textMuted}`}>Produkty</div>
                    {prods.length === 0 ? (
                      <div className={`rounded-lg border p-4 text-sm ${isDark ? "border-slate-700/50 bg-slate-900/40 text-slate-600" : "border-gray-200 bg-gray-50 text-gray-500"}`}>brak</div>
                    ) : (
                      <div className="space-y-2">
                        {prods.map((p: any, i: number) => (
                          <ProductItem key={i} raw={p} onDetails={(np) => setSelectedProduct(np)} />
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <footer className="mt-5 flex flex-wrap items-center gap-2">
                  {(o.status === "new" || o.status === "pending" || o.status === "placed") && (
                    <>
                      <AcceptButton order={o} onAccept={(m) => acceptAndSetTime(o, m)} />
                      <EditOrderButton
                        orderId={o.id}
                        currentProducts={parseProducts(o.items).map(normalizeProduct)}
                        currentSelectedOption={o.selected_option || "local"}
                        onOrderUpdated={(id, data) => (data ? updateLocal(id, data) : fetchOrders())}
                        onEditStart={() => setEditingOrderId(o.id)}
                        onEditEnd={() => setEditingOrderId(null)}
                      />
                      <CancelButton orderId={o.id} onOrderUpdated={() => fetchOrders()} />
                    </>
                  )}

                  {o.status === "accepted" && (
                    <>
                      <CancelButton orderId={o.id} onOrderUpdated={() => fetchOrders()} />
                      <div className="flex flex-wrap gap-2">
                        {[15, 30, 45, 60].map((m) => (
                          <button
                            key={m}
                            onClick={() => extendTime(o, m)}
                            className={`h-10 rounded-lg px-4 text-sm font-medium transition-colors ${isDark ? "bg-slate-700 text-slate-300 hover:bg-slate-600" : "bg-gray-200 text-gray-700 hover:bg-gray-300"}`}
                          >
                            +{m >= 60 ? `${m / 60} h` : `${m} min`}
                          </button>
                        ))}
                      </div>
                      <EditOrderButton
                        orderId={o.id}
                        currentProducts={parseProducts(o.items).map(normalizeProduct)}
                        currentSelectedOption={o.selected_option || "local"}
                        onOrderUpdated={(id, data) => (data ? updateLocal(id, data) : fetchOrders())}
                        onEditStart={() => setEditingOrderId(o.id)}
                        onEditEnd={() => setEditingOrderId(null)}
                      />
                      <button
                        onClick={() => completeOrder(o.id)}
                        className="h-10 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-500 transition-colors"
                      >
                        Zrealizowany
                      </button>
                    </>
                  )}

                  {o.status === "cancelled" && (
                    <button
                      onClick={() => restoreOrder(o.id)}
                      className={`h-10 rounded-lg px-4 text-sm font-semibold transition-colors ${isDark ? "bg-slate-700 text-slate-300 hover:bg-slate-600" : "bg-gray-200 text-gray-700 hover:bg-gray-300"}`}
                    >
                      Przywróć
                    </button>
                  )}
                </footer>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );

  return (
    <div className={`min-h-screen ${t.bg} p-2 sm:p-4 lg:p-6`}>
      <div className="mx-auto max-w-6xl">
        {/* Górny pasek sterowania */}
        <div className={`mb-4 sm:mb-6`}>
          <div className={`rounded-2xl border ${t.border} ${isDark ? "bg-slate-800/80" : "bg-white"} shadow-xl ${isDark ? "shadow-black/20" : "shadow-gray-200/50"}`}>
            
            {/* Główny wiersz */}
            <div className="p-3 sm:p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                
                {/* Lewa strona - Tytuł i liczniki */}
                <div className="flex items-center gap-3">
                  <div className={`relative w-12 h-12 rounded-2xl flex items-center justify-center ${
                    orderSettings.orders_enabled 
                      ? isDark ? "bg-gradient-to-br from-emerald-500/30 to-emerald-600/10" : "bg-gradient-to-br from-emerald-100 to-emerald-50"
                      : isDark ? "bg-gradient-to-br from-rose-500/30 to-rose-600/10" : "bg-gradient-to-br from-rose-100 to-rose-50"
                  }`}>
                    <ShoppingBag className={`w-6 h-6 ${
                      orderSettings.orders_enabled 
                        ? isDark ? "text-emerald-400" : "text-emerald-600"
                        : isDark ? "text-rose-400" : "text-rose-600"
                    }`} />
                    {newList.length > 0 && (
                      <span className="absolute -top-1 -right-1 w-5 h-5 bg-amber-500 text-white text-xs font-bold rounded-full flex items-center justify-center animate-pulse">
                        {newList.length}
                      </span>
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h1 className={`text-xl font-bold ${t.text}`}>Zamówienia</h1>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                        orderSettings.orders_enabled 
                          ? isDark ? "bg-emerald-500/20 text-emerald-400" : "bg-emerald-100 text-emerald-700"
                          : isDark ? "bg-rose-500/20 text-rose-400" : "bg-rose-100 text-rose-700"
                      }`}>
                        {orderSettings.orders_enabled ? "ONLINE" : "OFFLINE"}
                      </span>
                    </div>
                    <div className={`flex items-center gap-3 text-xs ${t.textMuted} mt-0.5`}>
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-amber-500" />
                        {newList.length} nowych
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-blue-500" />
                        {currList.length} w trakcie
                      </span>
                    </div>
                  </div>
                </div>

                {/* Prawa strona - Akcje */}
                <div className="flex items-center gap-2 flex-wrap">
                  <ThemeToggle />
                  <PushNotificationControl compact isDark={isDark} />
                  
                  <button
                    onClick={() => setShowSettings(!showSettings)}
                    className={`h-10 w-10 rounded-xl flex items-center justify-center transition-all ${
                      showSettings
                        ? isDark ? "bg-slate-700 text-white" : "bg-gray-200 text-gray-900"
                        : !orderSettings.orders_enabled 
                          ? "bg-rose-500/20 text-rose-400" 
                          : isDark 
                            ? "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-300" 
                            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                    title="Ustawienia zamówień"
                  >
                    <Settings className={`w-5 h-5 ${showSettings ? "animate-spin-slow" : ""}`} />
                  </button>
                  
                  <button
                    className={`h-10 px-4 rounded-xl flex items-center gap-2 text-sm font-semibold transition-all ${
                      loading 
                        ? "bg-emerald-700 text-emerald-200" 
                        : "bg-emerald-600 text-white hover:bg-emerald-500 shadow-lg shadow-emerald-600/20"
                    }`}
                    onClick={() => fetchOrders()}
                    disabled={loading}
                  >
                    <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                    <span className="hidden sm:inline">{loading ? "Ładowanie..." : "Odśwież"}</span>
                  </button>
                </div>
              </div>

              {/* Filtry - drugi wiersz */}
              <div className={`flex flex-wrap items-center gap-2 mt-3 pt-3 border-t ${t.border}`}>
                <Filter className={`w-4 h-4 ${t.textMuted} hidden sm:block`} />
                
                <select 
                  className={`h-9 px-3 rounded-xl text-sm border ${t.borderInput} ${t.bgInput} ${isDark ? "text-slate-300" : "text-gray-700"} focus:outline-none cursor-pointer`}
                  value={filterStatus} 
                  onChange={(e) => setFilterStatus(e.target.value as any)}
                >
                  <option value="all">Wszystkie statusy</option>
                  <option value="new">🆕 Nowe</option>
                  <option value="placed">📝 Złożone</option>
                  <option value="accepted">⏳ W trakcie</option>
                  <option value="cancelled">❌ Anulowane</option>
                  <option value="completed">✅ Zrealizowane</option>
                </select>
                
                <select 
                  className={`h-9 px-3 rounded-xl text-sm border ${t.borderInput} ${t.bgInput} ${isDark ? "text-slate-300" : "text-gray-700"} focus:outline-none cursor-pointer`}
                  value={filterOption} 
                  onChange={(e) => setFilterOption(e.target.value as any)}
                >
                  <option value="all">Wszystkie typy</option>
                  <option value="local">🪑 Na miejscu</option>
                  <option value="takeaway">🥡 Na wynos</option>
                  <option value="delivery">🚗 Dostawa</option>
                </select>
                
                <button 
                  className={`h-9 px-3 rounded-xl text-sm font-medium transition-colors flex items-center gap-1.5 border ${t.borderInput} ${isDark ? "bg-slate-800 text-slate-300 hover:bg-slate-700" : "bg-gray-50 text-gray-700 hover:bg-gray-100"}`}
                  onClick={() => setSortOrder((o) => (o === "desc" ? "asc" : "desc"))}
                >
                  <Clock className="w-4 h-4" />
                  {sortOrder === "desc" ? "Najnowsze" : "Najstarsze"}
                </button>
              </div>
            </div>

            {/* Panel kontroli zamówień (rozwijany) */}
            {showSettings && (
              <div className={`border-t ${t.border} p-4 ${isDark ? "bg-slate-800/50" : "bg-gray-50/80"}`}>
                <div className="grid gap-4 sm:grid-cols-2">
                  {/* Główny wyłącznik */}
                  <div className={`p-4 rounded-xl ${isDark ? "bg-slate-900/50" : "bg-white"} border ${t.border}`}>
                    <div className="flex items-center justify-between mb-3">
                      <span className={`text-sm font-medium ${t.text}`}>Przyjmowanie zamówień</span>
                      <button
                        onClick={() => toggleSetting("orders_enabled")}
                        disabled={settingsLoading}
                        className={`relative w-14 h-8 rounded-full transition-all disabled:opacity-50 ${
                          orderSettings.orders_enabled
                            ? "bg-emerald-500"
                            : isDark ? "bg-slate-700" : "bg-gray-300"
                        }`}
                      >
                        <span className={`absolute top-1 w-6 h-6 rounded-full bg-white shadow-md transition-all ${
                          orderSettings.orders_enabled ? "left-7" : "left-1"
                        }`} />
                      </button>
                    </div>
                    <p className={`text-xs ${t.textMuted}`}>
                      {orderSettings.orders_enabled 
                        ? "Klienci mogą składać zamówienia" 
                        : "Zamówienia są wstrzymane"}
                    </p>
                  </div>

                  {/* Typy zamówień */}
                  <div className={`p-4 rounded-xl ${isDark ? "bg-slate-900/50" : "bg-white"} border ${t.border}`}>
                    <span className={`text-sm font-medium ${t.text} block mb-3`}>Dostępne opcje</span>
                    <div className="space-y-3">
                      {/* Na miejscu */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                            orderSettings.local_enabled && orderSettings.orders_enabled
                              ? isDark ? "bg-blue-500/20 text-blue-400" : "bg-blue-100 text-blue-600"
                              : isDark ? "bg-slate-800 text-slate-500" : "bg-gray-100 text-gray-400"
                          }`}>
                            <MapPin className="w-4 h-4" />
                          </div>
                          <span className={`text-sm ${t.text}`}>Na miejscu</span>
                        </div>
                        <button
                          onClick={() => toggleSetting("local_enabled")}
                          disabled={settingsLoading || !orderSettings.orders_enabled}
                          className={`relative w-12 h-7 rounded-full transition-all disabled:opacity-40 ${
                            orderSettings.local_enabled && orderSettings.orders_enabled
                              ? "bg-blue-500"
                              : isDark ? "bg-slate-700" : "bg-gray-300"
                          }`}
                        >
                          <span className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow-md transition-all ${
                            orderSettings.local_enabled && orderSettings.orders_enabled ? "left-6" : "left-1"
                          }`} />
                        </button>
                      </div>

                      {/* Na wynos */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                            orderSettings.takeaway_enabled && orderSettings.orders_enabled
                              ? isDark ? "bg-amber-500/20 text-amber-400" : "bg-amber-100 text-amber-600"
                              : isDark ? "bg-slate-800 text-slate-500" : "bg-gray-100 text-gray-400"
                          }`}>
                            <ShoppingBag className="w-4 h-4" />
                          </div>
                          <span className={`text-sm ${t.text}`}>Na wynos</span>
                        </div>
                        <button
                          onClick={() => toggleSetting("takeaway_enabled")}
                          disabled={settingsLoading || !orderSettings.orders_enabled}
                          className={`relative w-12 h-7 rounded-full transition-all disabled:opacity-40 ${
                            orderSettings.takeaway_enabled && orderSettings.orders_enabled
                              ? "bg-amber-500"
                              : isDark ? "bg-slate-700" : "bg-gray-300"
                          }`}
                        >
                          <span className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow-md transition-all ${
                            orderSettings.takeaway_enabled && orderSettings.orders_enabled ? "left-6" : "left-1"
                          }`} />
                        </button>
                      </div>

                      {/* Dostawa */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                            orderSettings.delivery_enabled && orderSettings.orders_enabled
                              ? isDark ? "bg-purple-500/20 text-purple-400" : "bg-purple-100 text-purple-600"
                              : isDark ? "bg-slate-800 text-slate-500" : "bg-gray-100 text-gray-400"
                          }`}>
                            <Truck className="w-4 h-4" />
                          </div>
                          <span className={`text-sm ${t.text}`}>Dostawa</span>
                        </div>
                        <button
                          onClick={() => toggleSetting("delivery_enabled")}
                          disabled={settingsLoading || !orderSettings.orders_enabled}
                          className={`relative w-12 h-7 rounded-full transition-all disabled:opacity-40 ${
                            orderSettings.delivery_enabled && orderSettings.orders_enabled
                              ? "bg-purple-500"
                              : isDark ? "bg-slate-700" : "bg-gray-300"
                          }`}
                        >
                          <span className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow-md transition-all ${
                            orderSettings.delivery_enabled && orderSettings.orders_enabled ? "left-6" : "left-1"
                          }`} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Alert gdy wyłączone */}
                {!orderSettings.orders_enabled && (
                  <div className="mt-4 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-rose-500/20 flex items-center justify-center shrink-0">
                      <Power className="w-5 h-5 text-rose-400" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-rose-400">System zamówień jest wyłączony</p>
                      <p className="text-xs text-rose-400/70">Klienci widzą komunikat o tymczasowym wstrzymaniu zamówień</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Panel oczekujących rezerwacji */}
        {pendingReservations.length > 0 && (
          <div className={`mb-4 sm:mb-6 rounded-2xl border ${t.border} ${isDark ? "bg-amber-500/5" : "bg-amber-50/50"} overflow-hidden`}>
            <button
              onClick={() => setShowReservations(!showReservations)}
              className={`w-full flex items-center justify-between p-4 transition ${isDark ? "hover:bg-amber-500/10" : "hover:bg-amber-100/50"}`}
            >
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-xl ${isDark ? "bg-amber-500/20" : "bg-amber-100"}`}>
                  <CalendarDays className={`w-5 h-5 ${isDark ? "text-amber-400" : "text-amber-600"}`} />
                </div>
                <div className="text-left">
                  <div className="flex items-center gap-2">
                    <span className={`font-semibold ${t.text}`}>Oczekujące rezerwacje</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${isDark ? "bg-amber-500/20 text-amber-400" : "bg-amber-200 text-amber-700"}`}>
                      {pendingReservations.length}
                    </span>
                  </div>
                  <p className={`text-xs ${t.textMuted}`}>
                    {pendingReservations.length === 1 
                      ? "1 rezerwacja czeka na akceptację" 
                      : `${pendingReservations.length} rezerwacji czeka na akceptację`}
                  </p>
                </div>
              </div>
              {showReservations ? (
                <ChevronUp className={`w-5 h-5 ${t.textMuted}`} />
              ) : (
                <ChevronDown className={`w-5 h-5 ${t.textMuted}`} />
              )}
            </button>

            {showReservations && (
              <div className={`border-t ${t.border} p-4 space-y-3`}>
                {pendingReservations.map((r) => {
                  const dateObj = new Date(`${r.reservation_date}T${r.reservation_time}`);
                  const isToday = r.reservation_date === new Date().toISOString().slice(0, 10);
                  const dateLabel = isToday 
                    ? "Dzisiaj" 
                    : dateObj.toLocaleDateString("pl-PL", { weekday: "short", day: "numeric", month: "short" });
                  const timeLabel = r.reservation_time?.slice(0, 5) || "–";
                  const guestCount = r.party_size || r.number_of_guests || 1;

                  return (
                    <div
                      key={r.id}
                      className={`flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-xl border ${
                        isDark 
                          ? "border-amber-500/20 bg-slate-800/60" 
                          : "border-amber-200 bg-white"
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`font-semibold ${t.text}`}>{r.customer_name}</span>
                          <span className={`px-2 py-0.5 rounded-md text-xs font-medium flex items-center gap-1 ${
                            isDark ? "bg-amber-500/20 text-amber-400" : "bg-amber-100 text-amber-700"
                          }`}>
                            <AlertCircle className="w-3 h-3" />
                            Oczekuje
                          </span>
                        </div>
                        <div className={`flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 text-sm ${t.textMuted}`}>
                          <span className="flex items-center gap-1.5">
                            <CalendarDays className="w-4 h-4" />
                            {dateLabel}, {timeLabel}
                          </span>
                          <span className="flex items-center gap-1.5">
                            <Users className="w-4 h-4" />
                            {guestCount} os.
                          </span>
                          <a href={`tel:${r.customer_phone}`} className="flex items-center gap-1.5 hover:underline">
                            <Phone className="w-4 h-4" />
                            {r.customer_phone}
                          </a>
                        </div>
                        {r.notes && (
                          <p className={`mt-2 text-xs italic ${isDark ? "text-amber-400/80" : "text-amber-600"}`}>
                            {r.notes}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleReservationStatus(r.id, "confirmed")}
                          className="flex items-center gap-1.5 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-medium text-sm transition"
                        >
                          <CheckCircle className="w-4 h-4" />
                          Potwierdź
                        </button>
                        <button
                          onClick={() => handleReservationStatus(r.id, "cancelled")}
                          className="flex items-center gap-1.5 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium text-sm transition"
                        >
                          <XCircle className="w-4 h-4" />
                          Odrzuć
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

      <ProductList list={newList} title="Nowe zamówienia" />
      <div className="mt-8" />
      <ProductList list={currList} title="Zamówienia w realizacji" />
      <div className="mt-8" />
      <ProductList list={histList} title="Historia" />

      {selectedProduct && <ProductDetailsModal product={selectedProduct} onClose={() => setSelectedProduct(null)} />}

      {/* Paginacja */}
      <div className={`mb-24 mt-8 flex items-center justify-center`}>
        <div className={`inline-flex items-center gap-1 p-1 rounded-xl ${isDark ? "bg-slate-800" : "bg-white shadow-sm border border-gray-200"}`}>
          <button 
            onClick={() => setPage((p) => Math.max(1, p - 1))} 
            disabled={page === 1} 
            className={`h-9 px-4 rounded-lg text-sm font-medium transition-colors disabled:opacity-40 ${isDark ? "text-slate-300 hover:bg-slate-700 disabled:hover:bg-transparent" : "text-gray-700 hover:bg-gray-100 disabled:hover:bg-transparent"}`}
          >
            ← Poprzednia
          </button>
          <div className={`px-4 py-2 text-sm font-medium ${t.text}`}>
            {page} / {Math.max(1, Math.ceil(total / perPage))}
          </div>
          <button
            onClick={() => setPage((p) => (p < Math.ceil(total / perPage) ? p + 1 : p))}
            disabled={page >= Math.ceil(total / perPage)}
            className={`h-9 px-4 rounded-lg text-sm font-medium transition-colors disabled:opacity-40 ${isDark ? "text-slate-300 hover:bg-slate-700 disabled:hover:bg-transparent" : "text-gray-700 hover:bg-gray-100 disabled:hover:bg-transparent"}`}
          >
            Następna →
          </button>
        </div>
      </div>
    </div>
  </div>
  );
}
