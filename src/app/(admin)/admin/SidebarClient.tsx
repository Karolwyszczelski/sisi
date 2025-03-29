"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  List,
  Calendar,
  Menu as MenuIcon,
  BarChart,
  Settings,
  Users,
  Percent,
  Truck,
} from 'lucide-react';

interface SidebarClientProps {
  role: string; // 'manager' lub 'employee'
}

export default function SidebarClient({ role }: SidebarClientProps) {
  const pathname = usePathname();

  // Pełna lista zakładek (dla managera)
  const allNavItems = [
    { label: 'Dashboard', href: '/admin', icon: <Home className="w-5 h-5" /> },
    { label: 'Bieżące zamówienia', href: '/admin/orders', icon: <List className="w-5 h-5" /> },
    { label: 'Historia zamówień', href: '/admin/history', icon: <Calendar className="w-5 h-5" /> },
    { label: 'Rezerwacje', href: '/admin/reservations', icon: <Calendar className="w-5 h-5" /> },
    { label: 'Menu', href: '/admin/menu', icon: <MenuIcon className="w-5 h-5" /> },
    { label: 'Raporty', href: '/admin/reports', icon: <BarChart className="w-5 h-5" /> },
    { label: 'Ustawienia', href: '/admin/settings', icon: <Settings className="w-5 h-5" /> },
    { label: 'Klienci', href: '/admin/customers', icon: <Users className="w-5 h-5" /> },
    { label: 'Promocje', href: '/admin/promotions', icon: <Percent className="w-5 h-5" /> },
    { label: 'Dostawcy', href: '/admin/deliveries', icon: <Truck className="w-5 h-5" /> },
  ];

  let navItems = allNavItems;

  // 1. Jeśli rola to 'employee', ukrywamy zaawansowane zakładki
  if (role === 'employee') {
    // Ukryjemy np. Raporty, Ustawienia, Klienci, Promocje, Dostawcy
    navItems = allNavItems.filter(
      (item) =>
        ![
          '/admin/reports',
          '/admin/settings',
          '/admin/customers',
          '/admin/promotions',
          '/admin/deliveries',
        ].includes(item.href),
    );
  }

  return (
    <aside className="w-64 bg-black text-white p-6">
      <div className="mb-8">
        <h2 className="text-2xl font-bold">Panel Admin ({role})</h2>
      </div>
      <nav>
        <ul className="space-y-4">
          {navItems.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className={`flex items-center gap-3 p-2 rounded hover:bg-gray-700 transition-colors ${
                  pathname === item.href ? 'bg-gray-800' : ''
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}
