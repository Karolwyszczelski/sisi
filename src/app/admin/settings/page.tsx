"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { useTheme } from "@/components/admin/ThemeContext";
import {
  Settings,
  Plus,
  Trash2,
  Save,
  Loader2,
  Users,
  Hash,
  Check,
  RefreshCw,
  Edit3,
  X,
  AlertCircle,
  Table2,
  ToggleLeft,
  ToggleRight,
  MapPin,
  Percent,
  Link2,
  Store,
  RotateCw,
  Move,
  Power,
  CreditCard,
  Package,
  Truck,
  UtensilsCrossed,
  Palette,
  Sun,
  Moon,
} from "lucide-react";
import DeliveryZonesForm from "@/components/admin/settings/DeliveryZonesForm";
import IntegrationsForm from "@/components/admin/settings/IntegrationsForm";
import DiscountsSettingsForm from "@/components/admin/settings/DiscountsSettingsForm";

interface TableRow {
  id: string;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
  capacity: number;
  active: boolean;
}

interface RestaurantSettings {
  ordering_open: boolean;
  packaging_cost: number;
}

interface OrderSettings {
  orders_enabled: boolean;
  local_enabled: boolean;
  takeaway_enabled: boolean;
  delivery_enabled: boolean;
}

const GRID = 10;
const MIN_SIZE = 60;

type TabKey = "tables" | "restaurant" | "delivery" | "discounts" | "integrations" | "appearance";

const tabs: { key: TabKey; label: string; icon: React.ElementType }[] = [
  { key: "tables", label: "Stoliki", icon: Table2 },
  { key: "restaurant", label: "Restauracja", icon: Store },
  { key: "delivery", label: "Strefy dostawy", icon: MapPin },
  { key: "discounts", label: "Rabaty", icon: Percent },
  { key: "integrations", label: "Integracje", icon: Link2 },
  { key: "appearance", label: "Wygląd", icon: Palette },
];

export default function SettingsPage() {
  const { isDark, setTheme } = useTheme();
  const supabase = createClientComponentClient();

  const [activeTab, setActiveTab] = useState<TabKey>("tables");

  // ==================== STOLIKI ====================
  const [tables, setTables] = useState<TableRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loadingTables, setLoadingTables] = useState(true);
  const [savingTables, setSavingTables] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  // ==================== RESTAURANT SETTINGS ====================
  const [restaurantSettings, setRestaurantSettings] = useState<RestaurantSettings>({
    ordering_open: true,
    packaging_cost: 2,
  });
  const [orderSettings, setOrderSettings] = useState<OrderSettings>({
    orders_enabled: true,
    local_enabled: true,
    takeaway_enabled: true,
    delivery_enabled: true,
  });
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [orderSettingsLoading, setOrderSettingsLoading] = useState(false);

  // ==================== GENERAL ====================
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Theme classes
  const t = {
    bg: isDark ? "bg-slate-900" : "bg-gray-50",
    bgCard: isDark ? "bg-slate-800" : "bg-white",
    border: isDark ? "border-slate-700" : "border-gray-200",
    text: isDark ? "text-white" : "text-gray-900",
    textMuted: isDark ? "text-slate-400" : "text-gray-500",
    input: `w-full rounded-xl px-4 py-3 transition focus:ring-2 ${
      isDark
        ? "bg-slate-700 border border-slate-600 text-white placeholder:text-slate-400 focus:border-amber-500 focus:ring-amber-500/20"
        : "bg-white border border-gray-300 text-gray-900 placeholder:text-gray-400 focus:border-amber-500 focus:ring-amber-500/20"
    }`,
  };

  // ==================== FETCH TABLES ====================
  const fetchTables = useCallback(async () => {
    setLoadingTables(true);
    try {
      const res = await fetch("/api/table-layout", { cache: "no-store" });
      const json = await res.json();
      const plan = Array.isArray(json?.layout?.plan) ? json.layout.plan : [];
      setTables(
        plan.map((t: any) => ({
          id: String(t.id),
          label: t.label ?? t.name ?? "Stół",
          x: Number(t.x) || 0,
          y: Number(t.y) || 0,
          w: Math.max(MIN_SIZE, Number(t.w) || 90),
          h: Math.max(MIN_SIZE, Number(t.h) || 90),
          rotation: Number(t.rotation ?? t.rot ?? 0),
          capacity: Math.max(1, Number(t.capacity ?? t.seats ?? 2)),
          active: Boolean(t.active ?? true),
        }))
      );
    } catch (e) {
      console.error("Błąd pobierania stolików:", e);
    } finally {
      setLoadingTables(false);
    }
  }, []);

  // ==================== FETCH RESTAURANT SETTINGS ====================
  const fetchRestaurantSettings = useCallback(async () => {
    setLoadingSettings(true);
    try {
      const { data } = await supabase
        .from("restaurant_info")
        .select("ordering_open, packaging_cost")
        .eq("id", 1)
        .single();

      if (data) {
        setRestaurantSettings({
          ordering_open: data.ordering_open ?? true,
          packaging_cost: data.packaging_cost ?? 2,
        });
      }
    } catch (e) {
      console.error("Błąd pobierania ustawień:", e);
    } finally {
      setLoadingSettings(false);
    }
  }, [supabase]);

  // ==================== FETCH ORDER SETTINGS ====================
  const fetchOrderSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/settings/orders");
      if (res.ok) {
        const data = await res.json();
        setOrderSettings(data);
      }
    } catch (e) {
      console.error("Błąd pobierania ustawień zamówień:", e);
    }
  }, []);

  // ==================== TOGGLE ORDER SETTING ====================
  const toggleOrderSetting = async (key: keyof OrderSettings) => {
    setOrderSettingsLoading(true);
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
    } catch (e) {
      console.error("Błąd aktualizacji ustawienia:", e);
    } finally {
      setOrderSettingsLoading(false);
    }
  };

  useEffect(() => {
    fetchTables();
    fetchRestaurantSettings();
    fetchOrderSettings();
  }, [fetchTables, fetchRestaurantSettings, fetchOrderSettings]);

  // ==================== TABLE OPERATIONS ====================
  const selected = tables.find((t) => t.id === selectedId) || null;

  const addTable = () => {
    const id = crypto.randomUUID();
    const newTable: TableRow = {
      id,
      label: `Stolik ${tables.length + 1}`,
      x: 40 + ((tables.length * 30) % 400),
      y: 40 + ((tables.length * 25) % 250),
      w: 90,
      h: 90,
      rotation: 0,
      capacity: 2,
      active: true,
    };
    setTables((prev) => [...prev, newTable]);
    setSelectedId(id);
  };

  const removeSelected = () => {
    if (!selected) return;
    setTables((prev) => prev.filter((t) => t.id !== selected.id));
    setSelectedId(null);
  };

  const rotateSelected = (deg: number) => {
    if (!selected) return;
    setTables((prev) =>
      prev.map((t) =>
        t.id === selected.id
          ? { ...t, rotation: ((t.rotation + deg) % 360 + 360) % 360 }
          : t
      )
    );
  };

  const updateSelected = (patch: Partial<TableRow>) => {
    if (!selected) return;
    setTables((prev) => prev.map((t) => (t.id === selected.id ? { ...t, ...patch } : t)));
  };

  const saveTables = async () => {
    setSavingTables(true);
    setError(null);
    try {
      const compact = tables.map((t) => ({
        id: t.id,
        label: t.label,
        x: Math.round(t.x),
        y: Math.round(t.y),
        w: Math.round(t.w),
        h: Math.round(t.h),
        rotation: Math.round(t.rotation),
        capacity: Math.round(t.capacity),
        active: t.active,
      }));

      const res = await fetch("/api/table-layout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "default", active: true, plan: compact }),
      });

      if (!res.ok) throw new Error("Błąd zapisu");

      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError("Nie udało się zapisać układu stolików");
    } finally {
      setSavingTables(false);
    }
  };

  // Drag & drop for tables
  const startDrag = (e: React.MouseEvent, id: string, mode: "move" | "resize") => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedId(id);

    const wrap = wrapRef.current!;
    const rect = wrap.getBoundingClientRect();
    const table = tables.find((t) => t.id === id)!;
    const startX = e.clientX;
    const startY = e.clientY;
    const orig = { ...table };

    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;

      if (mode === "move") {
        let nx = orig.x + dx;
        let ny = orig.y + dy;
        nx = Math.max(0, Math.min(nx, rect.width - orig.w));
        ny = Math.max(0, Math.min(ny, rect.height - orig.h));
        nx = Math.round(nx / GRID) * GRID;
        ny = Math.round(ny / GRID) * GRID;
        setTables((prev) => prev.map((t) => (t.id === id ? { ...t, x: nx, y: ny } : t)));
      } else {
        let nw = Math.max(MIN_SIZE, orig.w + dx);
        let nh = Math.max(MIN_SIZE, orig.h + dy);
        nw = Math.min(nw, rect.width - orig.x);
        nh = Math.min(nh, rect.height - orig.y);
        nw = Math.round(nw / GRID) * GRID;
        nh = Math.round(nh / GRID) * GRID;
        setTables((prev) => prev.map((t) => (t.id === id ? { ...t, w: nw, h: nh } : t)));
      }
    };

    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  // ==================== SAVE RESTAURANT SETTINGS ====================
  const saveRestaurantSettings = async () => {
    setSavingSettings(true);
    setError(null);
    try {
      const { error: updateError } = await supabase
        .from("restaurant_info")
        .update({
          ordering_open: restaurantSettings.ordering_open,
          packaging_cost: restaurantSettings.packaging_cost,
        })
        .eq("id", 1);

      if (updateError) throw updateError;

      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError("Nie udało się zapisać ustawień");
    } finally {
      setSavingSettings(false);
    }
  };

  // ==================== RENDER ====================
  return (
    <div className={`min-h-screen ${t.bg} p-4 sm:p-6`}>
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className={`rounded-2xl ${t.bgCard} border ${t.border} p-6 mb-6`}>
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-lg">
              <Settings className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className={`text-2xl font-bold ${t.text}`}>Ustawienia</h1>
              <p className={`text-sm ${t.textMuted}`}>
                Zarządzaj stolikami, dostawami i konfiguracją restauracji
              </p>
            </div>
          </div>
        </div>

        {/* Alerts */}
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-red-400" />
            <p className="text-sm text-red-400">{error}</p>
            <button onClick={() => setError(null)} className="ml-auto">
              <X className="h-4 w-4 text-red-400" />
            </button>
          </div>
        )}

        {saved && (
          <div className="mb-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-3">
            <Check className="h-5 w-5 text-emerald-400" />
            <p className="text-sm text-emerald-400">Zmiany zostały zapisane!</p>
          </div>
        )}

        {/* Tabs */}
        <div className={`rounded-2xl ${t.bgCard} border ${t.border} overflow-hidden`}>
          {/* Tab header - scrollable on mobile */}
          <div className={`flex overflow-x-auto border-b ${t.border} scrollbar-hide`} style={{ WebkitOverflowScrolling: 'touch' }}>
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-4 sm:px-6 py-3 sm:py-4 text-sm font-medium whitespace-nowrap transition flex-shrink-0 ${
                  activeTab === tab.key
                    ? isDark
                      ? "text-amber-400 border-b-2 border-amber-400 bg-slate-700/30"
                      : "text-amber-600 border-b-2 border-amber-500 bg-amber-50"
                    : isDark
                      ? "text-slate-400 hover:text-slate-200 hover:bg-slate-700/30"
                      : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                }`}
              >
                <tab.icon className="h-4 w-4" />
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden">{tab.label.split(' ')[0]}</span>
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="p-6">
            {/* ==================== STOLIKI TAB ==================== */}
            {activeTab === "tables" && (
              <div className="space-y-6">
                {/* Toolbar */}
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    onClick={addTable}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-medium transition"
                  >
                    <Plus className="h-4 w-4" />
                    Dodaj stolik
                  </button>
                  <button
                    onClick={() => rotateSelected(90)}
                    disabled={!selected}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition disabled:opacity-50 ${
                      isDark
                        ? "bg-sky-600 hover:bg-sky-500 text-white"
                        : "bg-sky-500 hover:bg-sky-600 text-white"
                    }`}
                  >
                    <RotateCw className="h-4 w-4" />
                    Obróć 90°
                  </button>
                  <button
                    onClick={removeSelected}
                    disabled={!selected}
                    className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl font-medium transition disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4" />
                    Usuń
                  </button>
                  <button
                    onClick={saveTables}
                    disabled={savingTables}
                    className="ml-auto flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-semibold transition disabled:opacity-50"
                  >
                    {savingTables ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Zapisz układ
                  </button>
                </div>

                {/* Selected table editor */}
                <div className={`rounded-xl p-4 ${isDark ? "bg-slate-700/50" : "bg-gray-50"}`}>
                  {selected ? (
                    <div className="flex flex-wrap items-end gap-4">
                      <div>
                        <label className={`block text-xs mb-1 ${t.textMuted}`}>Nazwa</label>
                        <input
                          value={selected.label}
                          onChange={(e) => updateSelected({ label: e.target.value })}
                          className={`h-10 rounded-lg border px-3 ${
                            isDark ? "bg-slate-600 border-slate-500 text-white" : "bg-white border-gray-300"
                          }`}
                        />
                      </div>
                      <div>
                        <label className={`block text-xs mb-1 ${t.textMuted}`}>Miejsca</label>
                        <input
                          type="number"
                          min={1}
                          value={selected.capacity}
                          onChange={(e) => updateSelected({ capacity: Math.max(1, +e.target.value) })}
                          className={`h-10 w-20 rounded-lg border px-3 ${
                            isDark ? "bg-slate-600 border-slate-500 text-white" : "bg-white border-gray-300"
                          }`}
                        />
                      </div>
                      <div className={`text-sm ${t.textMuted}`}>
                        Pozycja: <b>{selected.x}</b>×<b>{selected.y}</b> • 
                        Rozmiar: <b>{selected.w}</b>×<b>{selected.h}</b> • 
                        Obrót: <b>{selected.rotation}°</b>
                      </div>
                      <label className="ml-auto inline-flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selected.active}
                          onChange={(e) => updateSelected({ active: e.target.checked })}
                          className="sr-only"
                        />
                        <div className={`w-5 h-5 rounded border flex items-center justify-center ${
                          selected.active ? "bg-emerald-500 border-emerald-500" : isDark ? "border-slate-500" : "border-gray-400"
                        }`}>
                          {selected.active && <Check className="h-3 w-3 text-white" />}
                        </div>
                        <span className={t.text}>Aktywny</span>
                      </label>
                    </div>
                  ) : (
                    <p className={t.textMuted}>Kliknij stolik, aby edytować właściwości</p>
                  )}
                </div>

                {/* Canvas */}
                <div
                  ref={wrapRef}
                  onMouseDown={() => setSelectedId(null)}
                  className={`relative mx-auto aspect-[16/9] w-full rounded-xl border-2 ${
                    isDark ? "border-slate-600 bg-slate-700/30" : "border-gray-300 bg-gray-100"
                  }`}
                  style={{
                    backgroundImage: `linear-gradient(to right, ${isDark ? "rgba(255,255,255,.05)" : "rgba(0,0,0,.05)"} 1px, transparent 1px), 
                                      linear-gradient(to bottom, ${isDark ? "rgba(255,255,255,.05)" : "rgba(0,0,0,.05)"} 1px, transparent 1px)`,
                    backgroundSize: `${GRID}px ${GRID}px`,
                  }}
                >
                  {loadingTables ? (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
                    </div>
                  ) : (
                    tables.map((table) => (
                      <div
                        key={table.id}
                        style={{
                          left: table.x,
                          top: table.y,
                          width: table.w,
                          height: table.h,
                          transform: `rotate(${table.rotation}deg)`,
                        }}
                        onMouseDown={(e) => startDrag(e, table.id, "move")}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedId(table.id);
                        }}
                        className={`absolute cursor-move select-none rounded-xl border-2 p-2 text-xs font-medium shadow-lg transition ${
                          table.active
                            ? isDark
                              ? "bg-amber-500/30 border-amber-500"
                              : "bg-amber-100 border-amber-400"
                            : isDark
                              ? "bg-slate-600/50 border-slate-500"
                              : "bg-gray-200 border-gray-400"
                        } ${selectedId === table.id ? "ring-2 ring-indigo-500 ring-offset-2" : ""}`}
                      >
                        <div className={`truncate font-semibold ${isDark ? "text-white" : "text-gray-800"}`}>
                          {table.label}
                        </div>
                        <div className={`flex items-center gap-1 mt-1 ${t.textMuted}`}>
                          <Users className="h-3 w-3" />
                          {table.capacity}
                        </div>
                        {/* Resize handle */}
                        <div
                          onMouseDown={(e) => startDrag(e, table.id, "resize")}
                          className="absolute bottom-0 right-0 w-5 h-5 cursor-nwse-resize rounded-br-xl bg-indigo-500 flex items-center justify-center"
                          title="Zmień rozmiar"
                        >
                          <Move className="h-3 w-3 text-white rotate-45" />
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Tips */}
                <p className={`text-xs ${t.textMuted}`}>
                  💡 Przeciągnij stolik aby zmienić pozycję • Fioletowy narożnik = zmiana rozmiaru • Kliknij aby edytować
                </p>

                {/* Stats */}
                {tables.length > 0 && (
                  <div className="grid grid-cols-3 gap-4">
                    <div className={`rounded-xl ${isDark ? "bg-slate-700/50" : "bg-gray-50"} p-4 text-center`}>
                      <p className={`text-2xl font-bold ${t.text}`}>{tables.length}</p>
                      <p className={`text-sm ${t.textMuted}`}>Stolików</p>
                    </div>
                    <div className={`rounded-xl ${isDark ? "bg-slate-700/50" : "bg-gray-50"} p-4 text-center`}>
                      <p className="text-2xl font-bold text-emerald-400">{tables.filter((t) => t.active).length}</p>
                      <p className={`text-sm ${t.textMuted}`}>Aktywnych</p>
                    </div>
                    <div className={`rounded-xl ${isDark ? "bg-slate-700/50" : "bg-gray-50"} p-4 text-center`}>
                      <p className="text-2xl font-bold text-amber-400">{tables.reduce((s, t) => s + t.capacity, 0)}</p>
                      <p className={`text-sm ${t.textMuted}`}>Miejsc</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ==================== RESTAURANT TAB ==================== */}
            {activeTab === "restaurant" && (
              <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                  <h3 className={`text-lg font-semibold ${t.text}`}>Ustawienia restauracji</h3>
                  <button
                    onClick={saveRestaurantSettings}
                    disabled={savingSettings}
                    className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-semibold transition disabled:opacity-50"
                  >
                    {savingSettings ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Zapisz
                  </button>
                </div>

                {loadingSettings ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Sekcja: Typy zamówień */}
                    <div className={`rounded-2xl border ${t.border} ${t.bgCard} p-5`}>
                      <h4 className={`font-semibold mb-4 flex items-center gap-2 ${t.text}`}>
                        <UtensilsCrossed className="h-5 w-5 text-amber-500" />
                        Dostępność typów zamówień
                      </h4>
                      <div className="grid gap-3">
                        {/* Główny przełącznik */}
                        <div
                          onClick={() => !orderSettingsLoading && toggleOrderSetting("orders_enabled")}
                          className={`flex items-center justify-between p-4 rounded-xl cursor-pointer transition ${
                            orderSettings.orders_enabled
                              ? isDark ? "bg-emerald-500/10 border border-emerald-500/30" : "bg-emerald-50 border border-emerald-200"
                              : isDark ? "bg-slate-700/50 hover:bg-slate-700" : "bg-gray-50 hover:bg-gray-100"
                          } ${orderSettingsLoading ? "opacity-50 pointer-events-none" : ""}`}
                        >
                          <div className="flex items-center gap-4">
                            <div className={`p-3 rounded-xl ${orderSettings.orders_enabled ? "bg-emerald-500/20" : isDark ? "bg-slate-600" : "bg-gray-200"}`}>
                              <Power className={`h-5 w-5 ${orderSettings.orders_enabled ? "text-emerald-400" : t.textMuted}`} />
                            </div>
                            <div>
                              <p className={`font-medium ${t.text}`}>Zamawianie online</p>
                              <p className={`text-sm ${t.textMuted}`}>Główny przełącznik wszystkich zamówień</p>
                            </div>
                          </div>
                          {orderSettings.orders_enabled ? (
                            <ToggleRight className="h-8 w-8 text-emerald-400" />
                          ) : (
                            <ToggleLeft className={`h-8 w-8 ${t.textMuted}`} />
                          )}
                        </div>

                        {/* Na miejscu */}
                        <div
                          onClick={() => !orderSettingsLoading && orderSettings.orders_enabled && toggleOrderSetting("local_enabled")}
                          className={`flex items-center justify-between p-4 rounded-xl transition ${
                            !orderSettings.orders_enabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"
                          } ${
                            orderSettings.local_enabled && orderSettings.orders_enabled
                              ? isDark ? "bg-purple-500/10 border border-purple-500/30" : "bg-purple-50 border border-purple-200"
                              : isDark ? "bg-slate-700/50 hover:bg-slate-700" : "bg-gray-50 hover:bg-gray-100"
                          } ${orderSettingsLoading ? "opacity-50 pointer-events-none" : ""}`}
                        >
                          <div className="flex items-center gap-4">
                            <div className={`p-3 rounded-xl ${orderSettings.local_enabled && orderSettings.orders_enabled ? "bg-purple-500/20" : isDark ? "bg-slate-600" : "bg-gray-200"}`}>
                              <Store className={`h-5 w-5 ${orderSettings.local_enabled && orderSettings.orders_enabled ? "text-purple-400" : t.textMuted}`} />
                            </div>
                            <div>
                              <p className={`font-medium ${t.text}`}>Na miejscu</p>
                              <p className={`text-sm ${t.textMuted}`}>Zamówienia do zjedzenia w restauracji</p>
                            </div>
                          </div>
                          {orderSettings.local_enabled && orderSettings.orders_enabled ? (
                            <ToggleRight className="h-8 w-8 text-purple-400" />
                          ) : (
                            <ToggleLeft className={`h-8 w-8 ${t.textMuted}`} />
                          )}
                        </div>

                        {/* Na wynos */}
                        <div
                          onClick={() => !orderSettingsLoading && orderSettings.orders_enabled && toggleOrderSetting("takeaway_enabled")}
                          className={`flex items-center justify-between p-4 rounded-xl transition ${
                            !orderSettings.orders_enabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"
                          } ${
                            orderSettings.takeaway_enabled && orderSettings.orders_enabled
                              ? isDark ? "bg-amber-500/10 border border-amber-500/30" : "bg-amber-50 border border-amber-200"
                              : isDark ? "bg-slate-700/50 hover:bg-slate-700" : "bg-gray-50 hover:bg-gray-100"
                          } ${orderSettingsLoading ? "opacity-50 pointer-events-none" : ""}`}
                        >
                          <div className="flex items-center gap-4">
                            <div className={`p-3 rounded-xl ${orderSettings.takeaway_enabled && orderSettings.orders_enabled ? "bg-amber-500/20" : isDark ? "bg-slate-600" : "bg-gray-200"}`}>
                              <Package className={`h-5 w-5 ${orderSettings.takeaway_enabled && orderSettings.orders_enabled ? "text-amber-400" : t.textMuted}`} />
                            </div>
                            <div>
                              <p className={`font-medium ${t.text}`}>Na wynos</p>
                              <p className={`text-sm ${t.textMuted}`}>Odbiór osobisty w restauracji</p>
                            </div>
                          </div>
                          {orderSettings.takeaway_enabled && orderSettings.orders_enabled ? (
                            <ToggleRight className="h-8 w-8 text-amber-400" />
                          ) : (
                            <ToggleLeft className={`h-8 w-8 ${t.textMuted}`} />
                          )}
                        </div>

                        {/* Dostawa */}
                        <div
                          onClick={() => !orderSettingsLoading && orderSettings.orders_enabled && toggleOrderSetting("delivery_enabled")}
                          className={`flex items-center justify-between p-4 rounded-xl transition ${
                            !orderSettings.orders_enabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"
                          } ${
                            orderSettings.delivery_enabled && orderSettings.orders_enabled
                              ? isDark ? "bg-blue-500/10 border border-blue-500/30" : "bg-blue-50 border border-blue-200"
                              : isDark ? "bg-slate-700/50 hover:bg-slate-700" : "bg-gray-50 hover:bg-gray-100"
                          } ${orderSettingsLoading ? "opacity-50 pointer-events-none" : ""}`}
                        >
                          <div className="flex items-center gap-4">
                            <div className={`p-3 rounded-xl ${orderSettings.delivery_enabled && orderSettings.orders_enabled ? "bg-blue-500/20" : isDark ? "bg-slate-600" : "bg-gray-200"}`}>
                              <Truck className={`h-5 w-5 ${orderSettings.delivery_enabled && orderSettings.orders_enabled ? "text-blue-400" : t.textMuted}`} />
                            </div>
                            <div>
                              <p className={`font-medium ${t.text}`}>Dostawa</p>
                              <p className={`text-sm ${t.textMuted}`}>Zamówienia z dostawą pod adres</p>
                            </div>
                          </div>
                          {orderSettings.delivery_enabled && orderSettings.orders_enabled ? (
                            <ToggleRight className="h-8 w-8 text-blue-400" />
                          ) : (
                            <ToggleLeft className={`h-8 w-8 ${t.textMuted}`} />
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Sekcja: Inne ustawienia */}
                    <div className={`rounded-2xl border ${t.border} ${t.bgCard} p-5`}>
                      <h4 className={`font-semibold mb-4 flex items-center gap-2 ${t.text}`}>
                        <CreditCard className="h-5 w-5 text-amber-500" />
                        Opłaty dodatkowe
                      </h4>
                      <div className={`p-4 rounded-xl ${isDark ? "bg-slate-700/50" : "bg-gray-50"}`}>
                        <div className="flex items-center gap-4 mb-3">
                          <div>
                            <p className={`font-medium ${t.text}`}>Koszt opakowania</p>
                            <p className={`text-sm ${t.textMuted}`}>Doliczany do zamówień na wynos i z dostawą</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <input
                            type="number"
                            min={0}
                            step={0.5}
                            value={restaurantSettings.packaging_cost}
                            onChange={(e) =>
                              setRestaurantSettings((prev) => ({
                                ...prev,
                                packaging_cost: Math.max(0, +e.target.value),
                              }))
                            }
                            className={`w-32 rounded-lg border px-3 py-2 ${
                              isDark ? "bg-slate-600 border-slate-500 text-white" : "bg-white border-gray-300"
                            }`}
                          />
                          <span className={t.textMuted}>zł</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ==================== DELIVERY ZONES TAB ==================== */}
            {activeTab === "delivery" && (
              <div>
                <DeliveryZonesForm />
              </div>
            )}

            {/* ==================== DISCOUNTS TAB ==================== */}
            {activeTab === "discounts" && (
              <div>
                <DiscountsSettingsForm />
              </div>
            )}

            {/* ==================== INTEGRATIONS TAB ==================== */}
            {activeTab === "integrations" && (
              <div>
                <IntegrationsForm />
              </div>
            )}

            {/* ==================== APPEARANCE TAB ==================== */}
            {activeTab === "appearance" && (
              <div className="space-y-6">
                <h3 className={`text-lg font-semibold ${t.text}`}>Ustawienia wyglądu</h3>

                {/* Motyw */}
                <div className={`rounded-2xl border ${t.border} ${t.bgCard} p-5`}>
                  <div className="flex items-center gap-3 mb-5">
                    <div className={`p-2.5 rounded-xl ${isDark ? "bg-indigo-500/20" : "bg-indigo-100"}`}>
                      <Palette className={`h-5 w-5 ${isDark ? "text-indigo-400" : "text-indigo-600"}`} />
                    </div>
                    <div>
                      <h4 className={`font-semibold ${t.text}`}>Motyw kolorystyczny</h4>
                      <p className={`text-sm ${t.textMuted}`}>Wybierz preferowany schemat kolorów</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Light theme */}
                    <button
                      onClick={() => setTheme("light")}
                      className={`relative p-4 rounded-xl border-2 transition-all ${
                        !isDark
                          ? "border-amber-500 bg-amber-500/5"
                          : `${t.border} hover:border-gray-400`
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-xl ${!isDark ? "bg-amber-500/20" : isDark ? "bg-slate-600" : "bg-gray-100"}`}>
                          <Sun className={`h-6 w-6 ${!isDark ? "text-amber-500" : t.textMuted}`} />
                        </div>
                        <div className="text-left">
                          <p className={`font-semibold ${t.text}`}>Jasny</p>
                          <p className={`text-sm ${t.textMuted}`}>Biały interfejs</p>
                        </div>
                      </div>
                      {!isDark && (
                        <div className="absolute top-3 right-3 w-6 h-6 bg-amber-500 rounded-full flex items-center justify-center">
                          <Check className="h-4 w-4 text-white" />
                        </div>
                      )}
                      {/* Preview */}
                      <div className="mt-4 rounded-lg overflow-hidden border border-gray-200 bg-white">
                        <div className="h-3 bg-gray-100 flex items-center px-2 gap-1">
                          <div className="w-1.5 h-1.5 rounded-full bg-red-400" />
                          <div className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
                          <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
                        </div>
                        <div className="flex">
                          <div className="w-8 bg-gray-50 h-12" />
                          <div className="flex-1 bg-gray-100 h-12 p-1">
                            <div className="w-full h-2 bg-gray-200 rounded mb-1" />
                            <div className="w-3/4 h-2 bg-gray-200 rounded" />
                          </div>
                        </div>
                      </div>
                    </button>

                    {/* Dark theme */}
                    <button
                      onClick={() => setTheme("dark")}
                      className={`relative p-4 rounded-xl border-2 transition-all ${
                        isDark
                          ? "border-amber-500 bg-amber-500/5"
                          : `${t.border} hover:border-gray-400`
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-xl ${isDark ? "bg-amber-500/20" : "bg-gray-100"}`}>
                          <Moon className={`h-6 w-6 ${isDark ? "text-amber-500" : t.textMuted}`} />
                        </div>
                        <div className="text-left">
                          <p className={`font-semibold ${t.text}`}>Ciemny</p>
                          <p className={`text-sm ${t.textMuted}`}>Tryb nocny</p>
                        </div>
                      </div>
                      {isDark && (
                        <div className="absolute top-3 right-3 w-6 h-6 bg-amber-500 rounded-full flex items-center justify-center">
                          <Check className="h-4 w-4 text-white" />
                        </div>
                      )}
                      {/* Preview */}
                      <div className="mt-4 rounded-lg overflow-hidden border border-slate-700 bg-slate-900">
                        <div className="h-3 bg-slate-800 flex items-center px-2 gap-1">
                          <div className="w-1.5 h-1.5 rounded-full bg-red-400" />
                          <div className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
                          <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
                        </div>
                        <div className="flex">
                          <div className="w-8 bg-slate-800 h-12" />
                          <div className="flex-1 bg-slate-850 h-12 p-1" style={{ backgroundColor: '#1a2332' }}>
                            <div className="w-full h-2 bg-slate-700 rounded mb-1" />
                            <div className="w-3/4 h-2 bg-slate-700 rounded" />
                          </div>
                        </div>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Info */}
                <div className={`rounded-xl p-4 ${isDark ? "bg-slate-700/30" : "bg-gray-50"} flex items-start gap-3`}>
                  <AlertCircle className={`h-5 w-5 flex-shrink-0 mt-0.5 ${t.textMuted}`} />
                  <p className={`text-sm ${t.textMuted}`}>
                    Wybrany motyw zostanie zapisany i zastosowany automatycznie przy następnym logowaniu.
                    Motyw wpływa na wygląd panelu administracyjnego oraz paska bocznego.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
