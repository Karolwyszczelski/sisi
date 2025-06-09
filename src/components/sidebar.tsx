// src/components/Sidebar.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Home,
  ShoppingCart,
  Clock,
  List,
  Calendar,
  Settings,
  LogOut,
} from "lucide-react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

type Role = "admin" | "employee" | null;

interface MenuItem {
  label: string;
  href: string;
  Icon: React.ComponentType<any>;
  roles: Role[];
}

const MENU: MenuItem[] = [
  { label: "Dashboard",          href: "/admin/AdminPanel",    Icon: Home,         roles: ["admin", "employee"] },
  { label: "Odbierz zamówienie", href: "/admin/pickup-order",  Icon: ShoppingCart, roles: ["admin", "employee"] },
  { label: "Bieżące zamówienia", href: "/admin/current-orders", Icon: Clock,        roles: ["admin", "employee"] },
  { label: "Historia",           href: "/admin/history",       Icon: List,         roles: ["admin", "employee"] },
  { label: "Rezerwacje",         href: "/admin/reservations",  Icon: Calendar,     roles: ["admin", "employee"] },
  { label: "Menu",               href: "/admin/menu",          Icon: List,         roles: ["admin", "employee"] },
  { label: "Ustawienia",         href: "/admin/settings",      Icon: Settings,     roles: ["admin"] },
];

export default function Sidebar() {
  const [role, setRole] = useState<Role>(null);
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClientComponentClient();

  // 1) Pobierz rolę z profilu
  useEffect(() => {
    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        setRole(null);
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", session.user.id)
        .single();
      setRole(profile?.role ?? null);
    })();
  }, [supabase]);

  // 2) logout
  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/admin");
  };

  // 3) Jeśli jeszcze nie wiemy → loading
  if (role === null) {
    return (
      <aside className="w-64 bg-black text-white flex items-center justify-center">
        <span>Ładowanie…</span>
      </aside>
    );
  }

  return (
    <aside className="w-64 bg-black text-white flex flex-col">
      <div className="px-6 py-8 text-2xl font-bold">Panel Admina</div>
      <nav className="flex-1 overflow-y-auto">
        <ul>
          {MENU.filter((item) => item.roles.includes(role)).map(
            ({ label, href, Icon }) => {
              const active = pathname === href;
              return (
                <li
                  key={href}
                  className={`px-4 py-2 hover:bg-gray-900 ${
                    active ? "bg-gray-900" : ""
                  }`}
                >
                  <Link href={href} className="flex items-center space-x-3">
                    <Icon className="w-5 h-5" />
                    <span>{label}</span>
                  </Link>
                </li>
              );
            }
          )}
        </ul>
      </nav>
      <div className="px-4 py-4 border-t border-gray-800">
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center space-x-2 hover:bg-gray-900 px-3 py-2 rounded"
        >
          <LogOut className="w-5 h-5" />
          <span>Wyloguj</span>
        </button>
      </div>
    </aside>
  );
}
