// components/sidebar.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import React from "react";

type MenuItem = {
  label: string;
  href: string;
  iconSrc: string; // Ścieżka do obrazka PNG
  highlight?: boolean; // Wyróżnienie elementu
};

const menuItems: MenuItem[] = [
  { label: "Dashboard", href: "/admin/dashboard", iconSrc: "/icons/dashboard.png" },
  { label: "Odbierz zamówienie", href: "/admin/pickup-order", iconSrc: "/icons/pickup-order.png", highlight: true },
  { label: "Bieżące zamówienia", href: "/admin/current-orders", iconSrc: "/icons/current-orders.png" },
  { label: "Historia", href: "/admin/history", iconSrc: "/icons/history.png" },
  { label: "Rezerwacje", href: "/admin/reservations", iconSrc: "/icons/reservations.png" },
  { label: "Menu", href: "/admin/menu", iconSrc: "/icons/menu.png" },
  { label: "Ustawienia", href: "/admin/settings", iconSrc: "/icons/settings.png" },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-black text-white min-h-screen p-4">
      <div className="mb-6 text-2xl font-bold">Panel</div>
      <nav>
        <ul className="space-y-2">
          {menuItems.map((item) => {
            const isActive = pathname === item.href;
            const bgColor = item.highlight ? "bg-blue-700" : (isActive ? "bg-gray-700" : "");
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`flex items-center p-2 rounded hover:bg-gray-700 ${bgColor}`}
                >
                  <Image 
                    src={item.iconSrc} 
                    alt={`${item.label} icon`} 
                    width={24} 
                    height={24} 
                    className="mr-3" 
                  />
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
