"use client";

import { useState } from "react";
import { Tab } from "@headlessui/react";
import {
  IconCashBanknote,
  IconCalendarEvent,
  IconMap,
  IconBrandGoogle,
  IconBurger,
  
} from "@tabler/icons-react";

import PaymentsForm from "@/components/admin/settings/PaymentSettingsForm";
import TableLayoutForm from "@/components/admin/settings/TableLayoutForm";
import DeliveryZonesForm from "@/components/admin/settings/DeliveryZonesForm";
import IntegrationsForm from "@/components/admin/settings/IntegrationsForm";
import BurgerMonthForm from "@/components/admin/settings/BurgerMonthForm";

const tabs = [
  { key: "payments", label: "Płatności", icon: IconCashBanknote },
  { key: "tables", label: "Rezerwacje & Stoły", icon: IconCalendarEvent },
  { key: "delivery", label: "Strefy dostawy", icon: IconMap },
  { key: "integr", label: "Integracje", icon: IconBrandGoogle },
  { key: "burger",   label: "Burger miesiąca",     icon: IconBurger },
];

function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(" ");
}

export default function SettingsPage() {
  const [selectedTab, setSelectedTab] = useState(0);

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold">Ustawienia panelu</h1>

      <Tab.Group selectedIndex={selectedTab} onChange={setSelectedTab}>
        <Tab.List className="flex space-x-2 border-b">
          {tabs.map((t) => (
            <Tab
              key={t.key}
              className={({ selected }) =>
                classNames(
                  "flex items-center gap-2 px-4 py-2 rounded-t-lg text-sm transition-colors duration-200",
                  selected
                    ? "bg-indigo-600 text-white shadow"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                )
              }
            >
              <t.icon size={18} />
              {t.label}
            </Tab>
          ))}
        </Tab.List>

        <Tab.Panels className="mt-6 bg-white rounded-b-lg shadow p-6">
          <Tab.Panel>
            <PaymentsForm />
          </Tab.Panel>
          <Tab.Panel>
            <TableLayoutForm />
          </Tab.Panel>
          <Tab.Panel>
            <DeliveryZonesForm />
          </Tab.Panel>
          <Tab.Panel>
            <IntegrationsForm />
          </Tab.Panel>
          <Tab.Panel>
            <BurgerMonthForm />
            </Tab.Panel>
        </Tab.Panels>
      </Tab.Group>
    </div>
  );
}
