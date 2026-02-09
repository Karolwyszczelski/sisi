"use client";

import React, { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import "react-calendar/dist/Calendar.css";
import { 
  ShoppingCart, 
  Clock, 
  History, 
  CalendarDays, 
  TrendingUp, 
  DollarSign, 
  Timer, 
  Utensils,
  Settings,
  Package,
  ChevronRight,
} from "lucide-react";
import clsx from "clsx";
import ThemeToggle from "@/components/admin/ThemeToggle";
import { useTheme } from "@/components/admin/ThemeContext";

const Calendar = dynamic(() => import("react-calendar"), { ssr: false });
const Chart = dynamic(() => import("../dashboard/Chart"), { ssr: false });

type StatsResponse = {
  ordersPerDay?: Record<string, number>;
  avgFulfillmentTime?: Record<string, number>;
  popularProducts?: Record<string, number>;
  kpis?: {
    todayOrders?: number;
    todayRevenue?: number;
    todayReservations?: number;
    monthOrders?: number;
    monthRevenue?: number;
    monthAvgFulfillment?: number;
    newOrders?: number;
    currentOrders?: number;
    reservations?: number;
  };
};

const PLN = new Intl.NumberFormat("pl-PL", {
  style: "currency",
  currency: "PLN",
  maximumFractionDigits: 0,
});

function toPln(v: number | undefined | null): string {
  if (v == null || Number.isNaN(v)) return "—";
  const val = v > 100000 ? v / 100 : v;
  return PLN.format(Math.round(val));
}

// Prosta karta statystyk - stonowana
function StatCard({ 
  title, 
  value, 
  subtitle, 
  icon: Icon, 
  onClick,
  isDark = true,
}: { 
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
  onClick?: () => void;
  isDark?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        "rounded-xl border p-5 text-left transition-all duration-200",
        isDark 
          ? "border-slate-700/50 bg-slate-800/60 hover:bg-slate-800 hover:border-slate-600" 
          : "border-gray-200 bg-white hover:bg-gray-50 hover:border-gray-300 shadow-sm",
        onClick && "cursor-pointer"
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className={`text-sm ${isDark ? "text-slate-400" : "text-gray-500"}`}>{title}</p>
          <p className={`mt-1 text-2xl font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>{value}</p>
          {subtitle && (
            <p className={`mt-1 text-xs ${isDark ? "text-slate-500" : "text-gray-400"}`}>{subtitle}</p>
          )}
        </div>
        <div className={`rounded-lg p-2.5 ${isDark ? "bg-slate-700/50" : "bg-gray-100"}`}>
          <Icon className={`h-5 w-5 ${isDark ? "text-slate-400" : "text-gray-500"}`} />
        </div>
      </div>
    </button>
  );
}

// Sekcja z tytułem
function SectionCard({ 
  title, 
  children,
  className,
  isDark = true,
}: { 
  title: string;
  children: React.ReactNode;
  className?: string;
  isDark?: boolean;
}) {
  return (
    <div className={clsx(
      "rounded-xl border p-5",
      isDark ? "border-slate-700/50 bg-slate-800/60" : "border-gray-200 bg-white shadow-sm",
      className
    )}>
      <h2 className={`text-sm font-medium mb-4 ${isDark ? "text-slate-400" : "text-gray-500"}`}>{title}</h2>
      {children}
    </div>
  );
}

// Mini statystyka
function MiniStat({ label, value, isDark = true }: { label: string; value: string | number; isDark?: boolean }) {
  return (
    <div className="text-center">
      <p className={`text-xl font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>{value}</p>
      <p className={`text-xs mt-0.5 ${isDark ? "text-slate-500" : "text-gray-500"}`}>{label}</p>
    </div>
  );
}

export default function DashboardPage() {
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [live, setLive] = useState({ newOrders: 0, currentOrders: 0, reservations: 0 });
  const [showCalendar, setShowCalendar] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const router = useRouter();

  useEffect(() => {
    let stop = false;

    const loadStats = async () => {
      try {
        const res = await fetch(`/api/orders/stats?t=${Date.now()}`, { cache: "no-store" });
        const d = (await res.json()) as StatsResponse;
        if (!stop) setStats(d ?? {});
      } catch {
        if (!stop) setStats({});
      } finally {
        if (!stop) setLoading(false);
      }
    };

    const loadLiveCounts = async () => {
      try {
        const r = await fetch(`/api/orders/current?limit=200&offset=0&t=${Date.now()}`, { cache: "no-store" });
        const j = await r.json();
        const arr: unknown[] = Array.isArray(j?.orders) ? j.orders : [];
        const newOrders = arr.filter((o: unknown) => {
          const order = o as { status?: string };
          return order.status === "new" || order.status === "placed";
        }).length;
        const currentOrders = arr.filter((o: unknown) => {
          const order = o as { status?: string };
          return order.status === "accepted";
        }).length;
        if (!stop) setLive({ newOrders, currentOrders, reservations: 0 });
      } catch {
        // ignore
      }
    };

    const tick = async () => {
      await Promise.all([loadStats(), loadLiveCounts()]);
    };

    tick();
    const iv = setInterval(() => {
      if (document.visibilityState === "visible") tick();
    }, 10000);

    return () => { stop = true; clearInterval(iv); };
  }, []);

  const safeEntries = (o?: Record<string, number>) => Object.entries(o ?? {});

  const dailyOrdersData = useMemo(
    () => safeEntries(stats?.ordersPerDay).map(([name, value]) => ({ name, value })),
    [stats]
  );

  const fulfillmentTimeData = useMemo(
    () => safeEntries(stats?.avgFulfillmentTime).map(([name, value]) => ({ name, value })),
    [stats]
  );

  const topDishesData = useMemo(
    () =>
      safeEntries(stats?.popularProducts)
        .sort(([, a], [, b]) => (b as number) - (a as number))
        .slice(0, 6)
        .map(([dish, orders]) => ({ dish, orders: orders as number })),
    [stats]
  );

  const todayKey = new Date().toISOString().slice(0, 10);
  const ym = todayKey.slice(0, 7);
  const k = stats?.kpis ?? {};

  const todayOrders = k.todayOrders ?? (stats?.ordersPerDay ? stats.ordersPerDay[todayKey] ?? 0 : 0);
  const monthOrders = k.monthOrders ?? (stats?.ordersPerDay
    ? Object.entries(stats.ordersPerDay).reduce((acc, [d, v]) => (d.startsWith(ym) ? acc + (v || 0) : acc), 0)
    : 0);
  const monthAvgFulfillment = k.monthAvgFulfillment ?? (stats?.avgFulfillmentTime
    ? (() => {
        const arr = Object.entries(stats.avgFulfillmentTime).filter(([d]) => d.startsWith(ym));
        if (!arr.length) return undefined;
        const sum = arr.reduce((s, [, v]) => s + (v || 0), 0);
        return Math.round(sum / arr.length);
      })()
    : undefined);

  const todayRevenue = k.todayRevenue;
  const monthRevenue = k.monthRevenue;
  const todayReservations = k.todayReservations;
  const newOrders = k.newOrders ?? live.newOrders;
  const currentOrders = k.currentOrders ?? live.currentOrders;
  const reservations = k.reservations ?? live.reservations;

  const maxDishOrders = Math.max(...topDishesData.map(d => d.orders), 1);

  const { isDark } = useTheme();

  return (
    <div className={`min-h-screen p-4 sm:p-6 lg:p-8 ${isDark ? "bg-slate-900" : "bg-gray-50"}`}>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className={`text-2xl font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>Dashboard</h1>
          <p className={`text-sm ${isDark ? "text-slate-500" : "text-gray-500"}`}>Panel administracyjny SiSi Burger</p>
        </div>
        <ThemeToggle />
      </div>

      {/* Główne statystyki */}
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          title="Nowe zamówienia"
          value={newOrders}
          subtitle={`Dzisiaj: ${todayOrders}`}
          icon={ShoppingCart}
          onClick={() => router.push("/admin/current-orders")}
          isDark={isDark}
        />
        <StatCard
          title="W realizacji"
          value={currentOrders}
          subtitle={`Miesiąc: ${monthOrders}`}
          icon={Clock}
          onClick={() => router.push("/admin/current-orders")}
          isDark={isDark}
        />
        <StatCard
          title="Historia"
          value={monthOrders}
          subtitle="Ten miesiąc"
          icon={History}
          onClick={() => router.push("/admin/history")}
          isDark={isDark}
        />
        <StatCard
          title="Rezerwacje"
          value={reservations}
          subtitle={`Dzisiaj: ${todayReservations ?? "—"}`}
          icon={CalendarDays}
          onClick={() => setShowCalendar(true)}
          isDark={isDark}
        />
      </div>

      {/* Podsumowanie dzienne i miesięczne */}
      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SectionCard title="Dzisiaj" isDark={isDark}>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <MiniStat label="Zamówienia" value={todayOrders} isDark={isDark} />
            <MiniStat label="Przychód" value={toPln(todayRevenue)} isDark={isDark} />
            <MiniStat label="Rezerwacje" value={todayReservations ?? "—"} isDark={isDark} />
          </div>
          <div className={`h-[200px] rounded-lg p-3 ${isDark ? "bg-slate-900/40" : "bg-gray-100"}`}>
            {loading ? (
              <div className="flex h-full items-center justify-center">
                <div className={`h-6 w-6 animate-spin rounded-full border-2 ${isDark ? "border-slate-600 border-t-slate-400" : "border-gray-300 border-t-gray-500"}`} />
              </div>
            ) : dailyOrdersData.length === 0 ? (
              <div className={`flex h-full items-center justify-center text-sm ${isDark ? "text-slate-600" : "text-gray-400"}`}>
                Brak danych
              </div>
            ) : (
              <Chart type="line" data={dailyOrdersData} />
            )}
          </div>
        </SectionCard>

        <SectionCard title="Ten miesiąc" isDark={isDark}>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <MiniStat label="Zamówienia" value={monthOrders} isDark={isDark} />
            <MiniStat label="Przychód" value={toPln(monthRevenue)} isDark={isDark} />
            <MiniStat label="Śr. czas" value={monthAvgFulfillment ? `${monthAvgFulfillment} min` : "—"} isDark={isDark} />
          </div>
          <div className={`h-[200px] rounded-lg p-3 ${isDark ? "bg-slate-900/40" : "bg-gray-100"}`}>
            {loading ? (
              <div className="flex h-full items-center justify-center">
                <div className={`h-6 w-6 animate-spin rounded-full border-2 ${isDark ? "border-slate-600 border-t-slate-400" : "border-gray-300 border-t-gray-500"}`} />
              </div>
            ) : fulfillmentTimeData.length === 0 ? (
              <div className={`flex h-full items-center justify-center text-sm ${isDark ? "text-slate-600" : "text-gray-400"}`}>
                Brak danych
              </div>
            ) : (
              <Chart type="bar" data={fulfillmentTimeData} />
            )}
          </div>
        </SectionCard>
      </div>

      {/* Dolna sekcja */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Popularne dania */}
        <SectionCard title="Popularne dania" className="lg:col-span-2" isDark={isDark}>
          {loading ? (
            <div className="flex h-[200px] items-center justify-center">
              <div className={`h-6 w-6 animate-spin rounded-full border-2 ${isDark ? "border-slate-600 border-t-slate-400" : "border-gray-300 border-t-gray-500"}`} />
            </div>
          ) : topDishesData.length === 0 ? (
            <div className={`flex h-[200px] items-center justify-center text-sm ${isDark ? "text-slate-600" : "text-gray-500"}`}>
              Brak danych
            </div>
          ) : (
            <div className="space-y-3">
              {topDishesData.map((d, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-medium ${isDark ? "bg-slate-700/60 text-slate-400" : "bg-gray-200 text-gray-600"}`}>
                    {i + 1}
                  </span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between text-sm mb-1.5">
                      <span className={`font-medium ${isDark ? "text-slate-300" : "text-gray-700"}`}>{d.dish}</span>
                      <span className={`text-xs ${isDark ? "text-slate-500" : "text-gray-500"}`}>{d.orders} szt.</span>
                    </div>
                    <div className={`h-1.5 rounded-full overflow-hidden ${isDark ? "bg-slate-700/50" : "bg-gray-200"}`}>
                      <div 
                        className={`h-full rounded-full transition-all duration-500 ${isDark ? "bg-gradient-to-r from-slate-500 to-slate-400" : "bg-gradient-to-r from-gray-500 to-gray-400"}`}
                        style={{ width: `${(d.orders / maxDishOrders) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        {/* Szybkie akcje */}
        <SectionCard title="Szybkie akcje" isDark={isDark}>
          <div className="space-y-2">
            <button
              onClick={() => router.push("/admin/pickup-order")}
              className={`w-full flex items-center justify-between rounded-lg p-3 text-left transition-colors ${isDark ? "bg-slate-700/40 hover:bg-slate-700/60" : "bg-gray-100 hover:bg-gray-200"}`}
            >
              <div className="flex items-center gap-3">
                <ShoppingCart className={`h-4 w-4 ${isDark ? "text-slate-400" : "text-gray-500"}`} />
                <span className={`text-sm ${isDark ? "text-slate-300" : "text-gray-700"}`}>Odbierz zamówienie</span>
              </div>
              <ChevronRight className={`h-4 w-4 ${isDark ? "text-slate-600" : "text-gray-400"}`} />
            </button>
            <button
              onClick={() => router.push("/admin/menu")}
              className={`w-full flex items-center justify-between rounded-lg p-3 text-left transition-colors ${isDark ? "bg-slate-700/40 hover:bg-slate-700/60" : "bg-gray-100 hover:bg-gray-200"}`}
            >
              <div className="flex items-center gap-3">
                <Utensils className={`h-4 w-4 ${isDark ? "text-slate-400" : "text-gray-500"}`} />
                <span className={`text-sm ${isDark ? "text-slate-300" : "text-gray-700"}`}>Zarządzaj menu</span>
              </div>
              <ChevronRight className={`h-4 w-4 ${isDark ? "text-slate-600" : "text-gray-400"}`} />
            </button>
            <button
              onClick={() => router.push("/admin/reservations")}
              className={`w-full flex items-center justify-between rounded-lg p-3 text-left transition-colors ${isDark ? "bg-slate-700/40 hover:bg-slate-700/60" : "bg-gray-100 hover:bg-gray-200"}`}
            >
              <div className="flex items-center gap-3">
                <CalendarDays className={`h-4 w-4 ${isDark ? "text-slate-400" : "text-gray-500"}`} />
                <span className={`text-sm ${isDark ? "text-slate-300" : "text-gray-700"}`}>Rezerwacje</span>
              </div>
              <ChevronRight className={`h-4 w-4 ${isDark ? "text-slate-600" : "text-gray-400"}`} />
            </button>
            <button
              onClick={() => router.push("/admin/settings")}
              className={`w-full flex items-center justify-between rounded-lg p-3 text-left transition-colors ${isDark ? "bg-slate-700/40 hover:bg-slate-700/60" : "bg-gray-100 hover:bg-gray-200"}`}
            >
              <div className="flex items-center gap-3">
                <Settings className={`h-4 w-4 ${isDark ? "text-slate-400" : "text-gray-500"}`} />
                <span className={`text-sm ${isDark ? "text-slate-300" : "text-gray-700"}`}>Ustawienia</span>
              </div>
              <ChevronRight className={`h-4 w-4 ${isDark ? "text-slate-600" : "text-gray-400"}`} />
            </button>
          </div>
        </SectionCard>
      </div>

      {/* Modal kalendarza */}
      {showCalendar && (
        <div 
          className={`fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm p-4 ${isDark ? "bg-black/80" : "bg-black/50"}`}
          onClick={() => setShowCalendar(false)}
        >
          <div 
            className={`w-full max-w-md rounded-2xl p-6 shadow-2xl ${isDark ? "bg-slate-800 border border-slate-700/80" : "bg-white border border-gray-200"}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h3 className={`text-lg font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>Kalendarz rezerwacji</h3>
              <button
                onClick={() => setShowCalendar(false)}
                className={`h-8 w-8 flex items-center justify-center rounded-lg transition-colors ${isDark ? "hover:bg-slate-700" : "hover:bg-gray-200"}`}
              >
                <span className={`text-xl ${isDark ? "text-slate-400" : "text-gray-500"}`}>&times;</span>
              </button>
            </div>
            <div className={`${isDark ? "calendar-dark" : "calendar-light"} rounded-xl p-4 ${isDark ? "bg-slate-900/50" : "bg-gray-50"}`}>
              <Calendar onChange={(date) => setSelectedDate(date as Date)} value={selectedDate} />
            </div>
            {selectedDate && (
              <div className={`mt-4 p-3 rounded-lg text-sm ${isDark ? "bg-slate-700/40 text-slate-300" : "bg-gray-100 text-gray-600"}`}>
                Wybrana data: <span className={`font-medium ${isDark ? "text-white" : "text-gray-900"}`}>{selectedDate.toLocaleDateString('pl-PL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
              </div>
            )}
            <div className="mt-5 flex gap-3">
              <button
                onClick={() => setShowCalendar(false)}
                className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors ${isDark ? "bg-slate-700/60 text-slate-300 hover:bg-slate-700" : "bg-gray-200 text-gray-700 hover:bg-gray-300"}`}
              >
                Zamknij
              </button>
              <button
                onClick={() => {
                  router.push("/admin/reservations");
                  setShowCalendar(false);
                }}
                className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-medium text-white transition-colors ${isDark ? "bg-slate-600 hover:bg-slate-500" : "bg-gray-600 hover:bg-gray-700"}`}
              >
                Przejdź do rezerwacji
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        .calendar-dark .react-calendar {
          background: transparent;
          border: none;
          font-family: inherit;
          width: 100%;
        }
        .calendar-dark .react-calendar__tile {
          color: #94a3b8;
          padding: 0.75em 0.5em;
          border-radius: 0.5rem;
          font-size: 0.875rem;
          transition: all 0.15s ease;
        }
        .calendar-dark .react-calendar__tile:hover {
          background: rgba(71, 85, 105, 0.5);
          color: #e2e8f0;
        }
        .calendar-dark .react-calendar__tile--now {
          background: rgba(100, 116, 139, 0.4);
          color: #f1f5f9;
          font-weight: 600;
        }
        .calendar-dark .react-calendar__tile--active {
          background: #475569 !important;
          color: white !important;
          font-weight: 600;
        }
        .calendar-dark .react-calendar__tile--active:hover {
          background: #64748b !important;
        }
        .calendar-dark .react-calendar__navigation {
          margin-bottom: 0.5rem;
        }
        .calendar-dark .react-calendar__navigation button {
          color: #e2e8f0;
          font-size: 1rem;
          font-weight: 600;
          min-width: 36px;
          border-radius: 0.5rem;
          transition: all 0.15s ease;
        }
        .calendar-dark .react-calendar__navigation button:hover {
          background: rgba(71, 85, 105, 0.5);
        }
        .calendar-dark .react-calendar__navigation button:disabled {
          color: #475569;
        }
        .calendar-dark .react-calendar__month-view__weekdays {
          color: #64748b;
          font-weight: 600;
          font-size: 0.75rem;
          text-transform: uppercase;
          padding-bottom: 0.5rem;
          border-bottom: 1px solid rgba(71, 85, 105, 0.3);
          margin-bottom: 0.5rem;
        }
        .calendar-dark .react-calendar__month-view__weekdays abbr {
          text-decoration: none;
        }
        .calendar-dark .react-calendar__month-view__days__day--weekend {
          color: #94a3b8;
        }
        .calendar-dark .react-calendar__month-view__days__day--neighboringMonth {
          color: #475569;
        }
        
        /* Light theme calendar */
        .calendar-light .react-calendar {
          background: transparent;
          border: none;
          font-family: inherit;
          width: 100%;
        }
        .calendar-light .react-calendar__tile {
          color: #374151;
          padding: 0.75em 0.5em;
          border-radius: 0.5rem;
          font-size: 0.875rem;
          transition: all 0.15s ease;
        }
        .calendar-light .react-calendar__tile:hover {
          background: #e5e7eb;
          color: #111827;
        }
        .calendar-light .react-calendar__tile--now {
          background: #d1d5db;
          color: #111827;
          font-weight: 600;
        }
        .calendar-light .react-calendar__tile--active {
          background: #4b5563 !important;
          color: white !important;
          font-weight: 600;
        }
        .calendar-light .react-calendar__tile--active:hover {
          background: #6b7280 !important;
        }
        .calendar-light .react-calendar__navigation {
          margin-bottom: 0.5rem;
        }
        .calendar-light .react-calendar__navigation button {
          color: #111827;
          font-size: 1rem;
          font-weight: 600;
          min-width: 36px;
          border-radius: 0.5rem;
          transition: all 0.15s ease;
        }
        .calendar-light .react-calendar__navigation button:hover {
          background: #e5e7eb;
        }
        .calendar-light .react-calendar__navigation button:disabled {
          color: #9ca3af;
        }
        .calendar-light .react-calendar__month-view__weekdays {
          color: #6b7280;
          font-weight: 600;
          font-size: 0.75rem;
          text-transform: uppercase;
          padding-bottom: 0.5rem;
          border-bottom: 1px solid #d1d5db;
          margin-bottom: 0.5rem;
        }
        .calendar-light .react-calendar__month-view__weekdays abbr {
          text-decoration: none;
        }
        .calendar-light .react-calendar__month-view__days__day--weekend {
          color: #374151;
        }
        .calendar-light .react-calendar__month-view__days__day--neighboringMonth {
          color: #9ca3af;
        }
      `}</style>
    </div>
  );
}
