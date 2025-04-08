"use client";

import React, { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import Image from "next/image";
import "react-calendar/dist/Calendar.css";
import { RadialIcon } from "./RadialIcon"; // nazwany eksport z RadialIcon.tsx

// Dynamicznie importujemy react-calendar i Chart
const Calendar = dynamic(() => import("react-calendar"), { ssr: false });
const Chart = dynamic(() => import("./Chart"), { ssr: false });

interface StatsData {
  ordersPerDay: Record<string, number>;
  avgFulfillmentTime: Record<string, number>;
  popularProducts: Record<string, number>;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<StatsData | null>(null);

  // Kalendarz
  const [showCalendar, setShowCalendar] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const router = useRouter();

  // Pobranie statystyk z API
  useEffect(() => {
    fetch("/api/orders/stats")
      .then((res) => res.json())
      .then((data) => setStats(data))
      .catch(console.error);
  }, []);

  const openCalendar = () => setShowCalendar(true);
  const closeCalendar = () => setShowCalendar(false);

  // Górne 4 karty
  const topCards = [
    {
      label: "Nowe Zamówienia",
      radialValue: 72,
      color: "bg-lime-100",
      textColor: "text-lime-800",
      description: "Sprawdź nowe zamówienia",
      onClick: () => router.push("/admin/current-orders"),
    },
    {
      label: "Bieżące Zamówienia",
      radialValue: 45,
      color: "bg-sky-100",
      textColor: "text-sky-800",
      description: "Podgląd bieżących zamówień",
      onClick: () => router.push("/admin/current-orders"),
    },
    {
      label: "Historia",
      radialValue: 83,
      color: "bg-yellow-100",
      textColor: "text-yellow-800",
      description: "Archiwalne zamówienia",
      onClick: () => router.push("/admin/history"),
    },
    {
      label: "Rezerwacje",
      radialValue: 25,
      color: "bg-pink-100",
      textColor: "text-pink-800",
      description: "Kalendarz rezerwacji",
      onClick: openCalendar,
    },
  ];

  // Przykładowe dane do karty "Top Dishes"
  const topDishes = [
    { dish: "Cheeseburger", orders: 120 },
    { dish: "TexMex Burger", orders: 95 },
    { dish: "Chicken Crunchy", orders: 80 },
    { dish: "Sweet Onion Burger", orders: 75 },
  ];

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <h1 className="text-3xl font-bold mb-8 text-gray-800">Dashboard</h1>

      {/* Górne 4 karty */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {topCards.map((card, idx) => (
          <div
            key={idx}
            onClick={card.onClick}
            className={`cursor-pointer flex items-center p-4 gap-3 rounded-lg border shadow-sm hover:shadow-md transition ${card.color}`}
          >
            <RadialIcon percentage={card.radialValue} size={40} />
            <div>
              <h2 className={`text-lg font-semibold ${card.textColor}`}>
                {card.label}
              </h2>
              <p className={`text-sm mt-1 ${card.textColor}`}>{card.description}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Dwukolumnowa sekcja: dzienne / miesięczne statystyki */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Lewa kolumna: Statystyki dzienne */}
        <div className="bg-white rounded-lg p-5 shadow border">
          <h2 className="text-xl font-semibold mb-4 text-gray-700">
            Statystyki dzienne
          </h2>
          {/* Przykładowe dane tekstowe */}
          <div className="flex flex-col gap-2 mb-4 text-sm text-gray-500">
            <p>Dzisiejsze zamówienia: <span className="font-bold">24</span></p>
            <p>Dzisiejszy obrót: <span className="font-bold">1240 zł</span></p>
            <p>Dzisiejsze rezerwacje: <span className="font-bold">5</span></p>
          </div>
          {/* Trzy łuki */}
          <div className="flex gap-3 mb-4">
            <div className="text-center">
              <RadialIcon percentage={24} size={60} />
              <p className="text-xs text-gray-500 mt-1">Zamówienia</p>
            </div>
            <div className="text-center">
              <RadialIcon percentage={50} size={60} />
              <p className="text-xs text-gray-500 mt-1">Obrót % planu</p>
            </div>
            <div className="text-center">
              <RadialIcon percentage={70} size={60} />
              <p className="text-xs text-gray-500 mt-1">Rezerwacje</p>
            </div>
          </div>
          {/* Dodatkowy wykres (line) pod łukami */}
          <div className="border border-gray-100 p-2 rounded">
            {stats ? (
              <Chart
                type="line"
                data={Object.entries(stats.ordersPerDay).map(([d, v]) => ({
                  name: d,
                  value: v,
                }))}
              />
            ) : (
              <p className="text-sm text-gray-400">Ładowanie wykresu...</p>
            )}
          </div>
        </div>

        {/* Prawa kolumna: Statystyki miesięczne */}
        <div className="bg-white rounded-lg p-5 shadow border">
          <h2 className="text-xl font-semibold mb-4 text-gray-700">
            Statystyki miesięczne
          </h2>
          <div className="flex flex-col gap-2 mb-4 text-sm text-gray-500">
            <p>Zamówienia w tym miesiącu: <span className="font-bold">486</span></p>
            <p>Obrót w tym miesiącu: <span className="font-bold">12 800 zł</span></p>
            <p>Średni czas realizacji: <span className="font-bold">30 min</span></p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Lewy mini-wykres: bar */}
            <div className="border border-gray-100 p-2 rounded">
              {stats ? (
                <Chart
                  type="bar"
                  data={Object.entries(stats.avgFulfillmentTime).map(([d, v]) => ({
                    name: d,
                    value: v,
                  }))}
                />
              ) : (
                <p className="text-sm text-gray-400">Ładowanie...</p>
              )}
            </div>
            {/* Prawy mini-wykres: radialIcon mniejszy */}
            <div className="flex flex-col items-center justify-center">
              <RadialIcon percentage={60} size={40} />
              <p className="text-xs text-gray-500 mt-1">
                Wypełnienie planu <br /> (60%)
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Kolejny wiersz: Top Dishes + Ustawienia (czerwone) */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Szeroka kolumna (lg:col-span-3) – Top Dishes */}
        <div className="bg-white rounded-lg p-5 shadow border lg:col-span-3">
          <h2 className="text-xl font-semibold mb-4 text-gray-700">Top Dishes</h2>
          <p className="text-sm text-gray-500 mb-4">Najbardziej zamawiane dania</p>
          <ul className="space-y-2 text-sm text-gray-600">
            {topDishes.map((d, i) => (
              <li
                key={i}
                className="border-b border-gray-200 pb-1 flex justify-between"
              >
                <span>{d.dish}</span>
                <span className="font-medium text-gray-700">
                  {d.orders} zamówień
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Karta ustawień: czerwona z settings2.png */}
        <div className="bg-red-100 rounded-lg p-5 shadow border relative flex flex-col">
          <h2 className="text-xl font-semibold mb-4 text-red-800">Ustawienia</h2>
          <div className="absolute right-3 top-3">
            <Image src="/settings2.png" alt="Settings" width={32} height={32} />
          </div>
          <p className="text-sm text-red-700 mb-4">
            Panel konfiguracyjny systemu
          </p>
          <button
            onClick={() => router.push("/admin/settings")}
            className="mt-auto px-4 py-2 bg-red-200 text-sm text-red-800 rounded hover:bg-red-300"
          >
            Przejdź do ustawień
          </button>
        </div>
      </div>

      {/* Popup kalendarza */}
      {showCalendar && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white text-black p-6 rounded shadow-lg max-w-md w-full">
            <h3 className="text-xl font-bold mb-4">Wybierz datę rezerwacji</h3>
            <Calendar
              onChange={(date) => setSelectedDate(date as Date)}
              value={selectedDate}
            />
            <div className="mt-4 flex justify-between">
              <button
                onClick={closeCalendar}
                className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-400"
              >
                Zamknij
              </button>
              <button
                onClick={() => {
                  router.push("/admin/reservations");
                  closeCalendar();
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-500"
              >
                Przejdź do rezerwacji
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
