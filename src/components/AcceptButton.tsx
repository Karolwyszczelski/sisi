// src/app/components/AcceptButton.tsx
"use client";

import React, { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

const supabase = createClientComponentClient();

interface Props {
  orderId: string;
  orderType: 'local' | 'takeaway' | 'delivery';
  onAccept: (minutes: number) => void;
}

interface Settings {
  prep_time_delivery: number;
  prep_time_takeaway: number;
  prep_time_local: number;
}

export default function AcceptButton({ orderId, orderType, onAccept }: Props) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [settings, setSettings] = useState<Settings | null>(null);

  // Pobierz ustawienia czasów przygotowania przy pierwszym renderowaniu
  useEffect(() => {
    supabase
      .from('restaurant_settings')
      .select('setting_key, setting_value')
      .in('setting_key', ['prep_time_delivery', 'prep_time_takeaway', 'prep_time_local'])
      .then(({ data }) => {
        if (data) {
          const fetchedSettings = data.reduce((acc, { setting_key, setting_value }) => {
            acc[setting_key] = parseInt(setting_value || '30', 10); // Domyślnie 30 min, jeśli brak
            return acc;
          }, {} as any);
          setSettings(fetchedSettings);
        }
      });
  }, []);

  if (!settings) {
    return <button className="px-4 py-2 bg-gray-400 text-white rounded-full" disabled>Ładowanie...</button>;
  }
  
  // Wybierz domyślny czas na podstawie typu zamówienia
  const defaultTime = settings[`prep_time_${orderType}`] || 30;

  // Predefiniowane opcje czasowe
  const timeOptions = [
    defaultTime, // Inteligentna sugestia jako pierwsza!
    15,
    20,
    30,
    45,
    60,
    90,
  ].filter((value, index, self) => self.indexOf(value) === index).sort((a,b) => a - b); // Usuń duplikaty i posortuj

  const handleAcceptClick = (minutes: number) => {
    onAccept(minutes);
    setIsDropdownOpen(false);
  };

  return (
    <div className="relative inline-block text-left">
      <div>
        <button
          onClick={() => handleAcceptClick(defaultTime)}
          className="w-32 h-10 bg-green-600 hover:bg-green-700 text-white rounded-l-full font-semibold text-sm transition-colors"
        >
          Akceptuj ({defaultTime} min)
        </button>
        <button
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          className="w-10 h-10 bg-green-700 hover:bg-green-800 text-white rounded-r-full font-semibold text-sm transition-colors inline-flex items-center justify-center"
          aria-haspopup="true"
          aria-expanded={isDropdownOpen}
        >
          ▼
        </button>
      </div>

      {isDropdownOpen && (
        <div className="origin-top-right absolute right-0 mt-2 w-40 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-10">
          <div className="py-1" role="menu" aria-orientation="vertical" aria-labelledby="options-menu">
            {timeOptions.map((minutes) => (
              <a
                key={minutes}
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  handleAcceptClick(minutes);
                }}
                className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                role="menuitem"
              >
                {minutes} minut
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}