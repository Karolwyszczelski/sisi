// components/sidebar.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import React from "react";

const menuItems = [
  { label: "Dashboard", href: "/admin/dashboard", icon: "🏠" },
  { label: "Bieżące zamówienia", href: "/admin/current-orders", icon: "🛒" },
  { label: "Historia", href: "/admin/history", icon: "📜" },
  { label: "Rezerwacje", href: "/admin/reservations", icon: "📅" },
  { label: "Menu", href: "/admin/menu", icon: "🍽️" },
  { label: "Ustawienia", href: "/admin/settings", icon: "⚙️" },
];

export default function Sidebar() {
  const pathname = usePathname();
  
  return (
    <aside className="w-64 bg-gray-800 text-white min-h-screen p-4">
      <div className="mb-6 text-2xl font-bold">Panel</div>
      <nav>
        <ul className="space-y-2">
          {menuItems.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className={`flex items-center p-2 rounded hover:bg-gray-700 ${pathname === item.href ? "bg-gray-700" : ""}`}
              >
                <span className="mr-3">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}
