"use client";

import { useState, useMemo } from "react";
import { Tab } from "@headlessui/react";
import {
  IconCalendarEvent,
  IconMap,
  IconBrandGoogle,
  IconPercentage,
} from "@tabler/icons-react";

import TableLayoutForm from "@/components/admin/settings/TableLayoutForm";
import DeliveryZonesForm from "@/components/admin/settings/DeliveryZonesForm";
import IntegrationsForm from "@/components/admin/settings/IntegrationsForm";
import DiscountsSettingsForm from "@/components/admin/settings/DiscountsSettingsForm";

// Uwaga: karta "Płatności" została usunięta na Twoją prośbę.
const tabs = [
  {
    key: "tables",
    label: "Rezerwacje & Stoły",
    icon: IconCalendarEvent,
    component: <TableLayoutForm />,
  },
  {
    key: "delivery",
    label: "Strefy dostawy",
    icon: IconMap,
    component: <DeliveryZonesForm />,
  },
  {
    key: "integr",
    label: "Integracje",
    icon: IconBrandGoogle,
    component: <IntegrationsForm />,
  },
  {
    key: "discounts",
    label: "Rabaty & promocje",
    icon: IconPercentage,
    component: <DiscountsSettingsForm />,
  },
];

function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(" ");
}

export default function SettingsPage() {
  const [selectedTab, setSelectedTab] = useState(0);
  const current = useMemo(() => tabs[selectedTab], [selectedTab]);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Ustawienia panelu</h1>

      {/* mobile selector */}
      <div className="md:hidden">
        <label htmlFor="mobile-tab" className="sr-only">
          Wybierz sekcję
        </label>
        <div className="relative">
          <select
            id="mobile-tab"
            aria-label="Wybierz sekcję ustawień"
            value={selectedTab}
            onChange={(e) => setSelectedTab(Number(e.target.value))}
            className="appearance-none w-full border rounded-lg px-4 py-2 pr-8 bg-white shadow-sm"
          >
            {tabs.map((t, idx) => (
              <option key={t.key} value={idx}>
                {t.label}
              </option>
            ))}
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
            <svg
              width="16"
              height="16"
              viewBox="0 0 20 20"
              fill="none"
              aria-hidden="true"
              className="text-gray-500"
            >
              <path
                d="M6 8l4 4 4-4"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>
      </div>

      <Tab.Group selectedIndex={selectedTab} onChange={setSelectedTab}>
        {/* tabs desktop */}
        <div className="hidden md:block">
          <Tab.List className="flex space-x-2 overflow-x-auto scrollbar-hide">
            {tabs.map((t) => (
              <Tab
                key={t.key}
                className={({ selected }) =>
                  classNames(
                    "flex items-center gap-2 px-5 py-2 text-sm font-medium rounded-full transition",
                    selected
                      ? "bg-indigo-600 text-white shadow-lg"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  )
                }
              >
                <t.icon size={18} />
                {t.label}
              </Tab>
            ))}
          </Tab.List>
        </div>

        <div className="mt-4">
          <div className="bg-white rounded-lg shadow border overflow-hidden">
            <div className="px-6 py-5 border-b md:hidden">
              {/* mobile header with icon + label */}
              <div className="flex items-center gap-3">
                <current.icon className="w-5 h-5 text-indigo-600" />
                <h2 className="text-lg font-semibold">{current.label}</h2>
              </div>
            </div>
            <Tab.Panels className="p-6">
              {tabs.map((t) => (
                <Tab.Panel key={t.key} className="space-y-6">
                  <div className="hidden md:flex items-center gap-3 mb-2">
                    <t.icon className="w-5 h-5 text-indigo-600" />
                    <h2 className="text-xl font-semibold">{t.label}</h2>
                  </div>
                  <div>{t.component}</div>
                </Tab.Panel>
              ))}
            </Tab.Panels>
          </div>
        </div>
      </Tab.Group>
    </div>
  );
}
